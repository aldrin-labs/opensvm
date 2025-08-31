import { NextResponse } from 'next/server';

// Mock responses for E2E testing
const getMockResponse = (userMessage: string): string => {
  const message = userMessage.toLowerCase();
  
  if (message.includes('tps') || message.includes('network load')) {
    return `Based on current network analysis, Solana is processing approximately 2,847 TPS (transactions per second) with a network load of 68%. The network is performing optimally with low latency and high throughput. Network load metrics show healthy distribution across validators.`;
  }
  
  if (message.includes('account info') || message.includes('token balances')) {
    return `Account analysis for address: 11111111111111111111111111111111

**Account Details:**
- Balance: 0.00253 SOL
- Owner: System Program  
- Token balances: No SPL tokens found
- Account type: System account
- Last activity: Recent

This is a system program account with minimal SOL balance for rent exemption.`;
  }
  
  if (message.includes('transaction details') || message.includes('get transaction')) {
    return `Transaction analysis shows an Error: Invalid transaction signature format. Please provide a valid 64-character base58 signature. The transaction lookup failed due to malformed input.`;
  }
  
  if (message.includes('program') && (message.includes('research') || message.includes('accounts summary'))) {
    return `Program research for programId: 11111111111111111111111111111111

**Program Analysis:**
- accounts: 847,293 associated accounts
- Recent signature activity detected
- Program type: System Program
- Active usage: High transaction volume`;
  }
  
  if (message.includes('subscribe') && message.includes('logs')) {
    return `Started logs subscription for account 11111111111111111111111111111111. Monitoring for 10 seconds...

[Log events would stream here in real implementation]

Logs subscription ended after timeout. No log events detected during monitoring period.`;
  }
  
  // Default response for other queries
  return `I understand you're asking about: "${userMessage.slice(0, 100)}...". In mock mode, I can help analyze Solana blockchain data, account information, transaction details, and network metrics. Please try asking about specific TPS data, account balances, or transaction analysis.`;
};

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    const url = new URL(req.url);
    const isMockMode = url.searchParams.get('mock') === '1' || 
                      req.headers.get('referer')?.includes('aimock=1') ||
                      req.headers.get('referer')?.includes('ai=1');
    
    // In mock mode, return deterministic responses for E2E testing
    if (isMockMode) {
      const lastMessage = messages[messages.length - 1];
      const mockResponse = getMockResponse(lastMessage?.content || '');
      
      // Add minimum delay to ensure processing indicator stays visible for at least 400ms as required by E2E tests
      await new Promise(resolve => setTimeout(resolve, 450));
      
      return NextResponse.json({ 
        response: mockResponse
      });
    }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY environment variable is not set' },
      { status: 500 }
    );
  }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-opus-20240229',
        max_tokens: 1024,
        messages: messages.map((msg: { role: string; content: string; }) => ({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content
        }))
      })
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.statusText}`);
    }

    const data = await response.json();
    return NextResponse.json({ response: data.content[0].text });
  } catch (error) {
    console.error('Error in chat API route:', error);
    return NextResponse.json(
      { error: 'Failed to process chat request' },
      { status: 500 }
    );
  }
}
