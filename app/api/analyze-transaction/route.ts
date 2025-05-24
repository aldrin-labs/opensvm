import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { logs, type, status, amount, from, to } = await request.json();

    // Validate required parameters
    if (!logs || !Array.isArray(logs)) {
      return NextResponse.json(
        { error: 'Transaction logs are required and must be an array' },
        { status: 400 }
      );
    }

    // Generate a default fallback response in case API key is missing
    let fallbackAnalysis = `
This appears to be a ${type || 'unknown'} transaction that ${status || 'executed'}.
${amount ? `The transaction involved ${amount} SOL.` : ''}
${from && to ? `Funds moved from ${from.slice(0, 8)}... to ${to.slice(0, 8)}...` : ''}

Without more context or API access, I cannot provide a detailed analysis of the logs.
`;

    // Check if API key is available
    if (!process.env.TOGETHER_API_KEY) {
      console.warn('TOGETHER_API_KEY is not set, using fallback response');
      return NextResponse.json({ analysis: fallbackAnalysis.trim() });
    }

    // Create analysis prompt
    const prompt = `Analyze this Solana transaction:
Type: ${type || 'Unknown'}
Status: ${status || 'Unknown'}
Amount: ${amount ? `${amount} SOL` : 'Unknown'}
From: ${from || 'Unknown'}
To: ${to || 'Unknown'}

Transaction Logs:
${logs.join('\n')}

Please explain in simple terms what happened in this transaction, including:
1. What type of operation was performed
2. Whether it was successful
3. Any notable details from the logs
4. Potential purpose of the transaction`;

    // Make API request
    const response = await fetch('https://api.together.xyz/inference', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `******      },
      body: JSON.stringify({
        model: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
        prompt,
        max_tokens: 500,
        temperature: 0.7,
        top_p: 0.7,
        top_k: 50,
        repetition_penalty: 1,
        stop: ['<human>', '<assistant>'],
      }),
    });

    if (!response.ok) {
      console.error('API response not OK:', response.status, response.statusText);
      throw new Error('GPT API request failed');
    }

    const data = await response.json();
    
    if (!data?.output?.choices?.[0]?.text) {
      console.error('Unexpected API response format:', data);
      throw new Error('Invalid API response format');
    }
    
    return NextResponse.json({ analysis: data.output.choices[0].text.trim() });
  } catch (error) {
    console.error('Error analyzing transaction:', error);
    return NextResponse.json(
      { error: 'Failed to analyze transaction' },
      { status: 500 }
    );
  }
}
