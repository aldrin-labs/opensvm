import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { transactions } = await request.json();

    if (!transactions || !Array.isArray(transactions)) {
      return NextResponse.json(
        { error: 'Invalid transactions data' },
        { status: 400 }
      );
    }

    // Known spam/analytics tokens and addresses to filter out
    const SPAM_TOKENS = new Set([
      'FLiP', 'FLIP', 'flipside',
      'Bot', 'BOT', 'SPAM', 'DUST',
      'Airdrop', 'AIRDROP', 'FREE',
      'Test', 'TEST', 'DEMO'
    ]);

    const SPAM_ADDRESSES = new Set([
      // Flipside/analytics addresses
      'FetTyW8xAYfd33x4GMHoE7hTuEdWLj1fNnhJuyVMUGGa',
      'WaLLeTaS7qTaSnKFTYJNGAeu7VzoLMUV9QCMfKxFsgt',
      'RecipienTEKQQQQQQQQQQQQQQQQQQQQQQQQQQFrThs',
      // Add other known spam addresses
      'ComputeBudget111111111111111111111111111111'
    ]);

    // Pre-filter obvious spam before AI analysis
    const preFiltered = transactions.filter(tx => {
      const amount = parseFloat(tx.tokenAmount || '0');
      const token = (tx.tokenSymbol || '').toLowerCase();
      const from = tx.from || '';
      const to = tx.to || '';
      
      // Filter out dust transactions
      if (amount < 0.001) return false;
      
      // Filter out spam tokens
      if (SPAM_TOKENS.has(tx.tokenSymbol) || 
          [...SPAM_TOKENS].some(spam => token.includes(spam.toLowerCase()))) {
        return false;
      }
      
      // Filter out spam addresses
      if (SPAM_ADDRESSES.has(from) || SPAM_ADDRESSES.has(to)) {
        return false;
      }
      
      return true;
    });

    // If too many transactions were filtered, use the pre-filtered results
    if (preFiltered.length < transactions.length * 0.5) {
      return NextResponse.json({ 
        filteredTransactions: preFiltered,
        aiAnalysis: false,
        preFiltered: true,
        originalCount: transactions.length,
        filteredCount: preFiltered.length
      });
    }

    // Prepare remaining transaction data for AI analysis
    const transactionSummary = preFiltered.map(tx => ({
      id: tx.txId || tx.signature,
      from: tx.from,
      to: tx.to,
      amount: tx.tokenAmount,
      token: tx.tokenSymbol,
      type: tx.transferType,
      tx: JSON.stringify(tx),
    }));

    const prompt = `Analyze these SPL token transactions and filter out spam/irrelevant transactions. Return a JSON array with only the transaction IDs that are legitimate and relevant (not spam, bot activity, or micro-transactions).

Transactions to analyze:
${JSON.stringify(transactionSummary, null, 2)}

Criteria for filtering:
1. Remove transactions with amounts < 0.001 tokens (likely spam/dust)
2. Remove transactions to/from known spam addresses or analytics services
3. Remove repetitive bot-like patterns (same amounts, regular intervals)
4. Remove transactions with suspicious token names containing: flip, spam, bot, airdrop, test
5. Keep legitimate transfers, swaps, and meaningful token movements
6. Keep transactions with significant amounts or unique patterns

Return only a JSON array of transaction IDs that should be kept, like: ["txId1", "txId2", ...]`;

    // Use GPT-4.1-nano or similar model for analysis
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4.1-nano', // Using available model instead of non-existent gpt-4.1-nano
        messages: [
          {
            role: 'system',
            content: 'You are a Solana transaction analyzer. Respond only with valid JSON arrays of transaction IDs. Filter out meaningless transactions, focus only one wallet <> wallet transfers'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 32000,
        temperature: 0.1,
        response_format: { type: 'json_object' }
      }),
    });

    if (!response.ok) {
      // Fallback: if AI analysis fails, apply enhanced basic filtering
      const basicFiltered = transactions.filter(tx => {
        const amount = parseFloat(tx.tokenAmount || '0');
        const token = (tx.tokenSymbol || '').toLowerCase();
        const from = tx.from || '';
        const to = tx.to || '';
        
        // Filter out dust transactions
        if (amount < 0.001) return false;
        
        // Filter out spam tokens and addresses (same as above)
        const SPAM_TOKENS = ['flip', 'bot', 'spam', 'dust', 'airdrop', 'free', 'test', 'demo'];
        const SPAM_ADDRESSES = [
          'FetTyW8xAYfd33x4GMHoE7hTuEdWLj1fNnhJuyVMUGGa',
          'WaLLeTaS7qTaSnKFTYJNGAeu7VzoLMUV9QCMfKxFsgt',
          'RecipienTEKQQQQQQQQQQQQQQQQQQQQQQQQQQFrThs',
          'ComputeBudget111111111111111111111111111111'
        ];
        
        if (SPAM_TOKENS.some(spam => token.includes(spam))) return false;
        if (SPAM_ADDRESSES.includes(from) || SPAM_ADDRESSES.includes(to)) return false;
        
        return true;
      });
      
      return NextResponse.json({ 
        filteredTransactions: basicFiltered,
        aiAnalysis: false,
        fallback: true
      });
    }

    const data = await response.json();
    let validTxIds: string[] = [];
    
    try {
      const aiResponse = JSON.parse(data.choices[0].message.content);
      validTxIds = aiResponse.validTransactions || aiResponse;
    } catch (parseError) {
      console.warn('Failed to parse AI response, using fallback filtering');
      const basicFiltered = transactions.filter(tx => {
        const amount = parseFloat(tx.tokenAmount || '0');
        const token = (tx.tokenSymbol || '').toLowerCase();
        const from = tx.from || '';
        const to = tx.to || '';
        
        // Filter out dust transactions
        if (amount < 0.001) return false;
        
        // Filter out spam tokens and addresses
        const SPAM_TOKENS = ['flip', 'bot', 'spam', 'dust', 'airdrop', 'free', 'test', 'demo'];
        const SPAM_ADDRESSES = [
          'FetTyW8xAYfd33x4GMHoE7hTuEdWLj1fNnhJuyVMUGGa',
          'WaLLeTaS7qTaSnKFTYJNGAeu7VzoLMUV9QCMfKxFsgt',
          'RecipienTEKQQQQQQQQQQQQQQQQQQQQQQQQQQFrThs',
          'ComputeBudget111111111111111111111111111111'
        ];
        
        if (SPAM_TOKENS.some(spam => token.includes(spam))) return false;
        if (SPAM_ADDRESSES.includes(from) || SPAM_ADDRESSES.includes(to)) return false;
        
        return true;
      });
      
      return NextResponse.json({ 
        filteredTransactions: basicFiltered,
        aiAnalysis: false,
        fallback: true
      });
    }

    // Filter transactions based on AI analysis
    const filteredTransactions = transactions.filter(tx => 
      validTxIds.includes(tx.txId || tx.signature)
    );

    return NextResponse.json({ 
      filteredTransactions,
      aiAnalysis: true,
      originalCount: transactions.length,
      filteredCount: filteredTransactions.length
    });
  } catch (error) {
    console.error('Error filtering transactions:', error);
    
    // Fallback to basic filtering if anything fails
    try {
      const { transactions } = await request.json();
      const basicFiltered = transactions.filter(tx => {
        const amount = parseFloat(tx.tokenAmount || '0');
        const token = (tx.tokenSymbol || '').toLowerCase();
        const from = tx.from || '';
        const to = tx.to || '';
        
        // Filter out dust transactions
        if (amount < 0.001) return false;
        
        // Filter out spam tokens and addresses
        const SPAM_TOKENS = ['flip', 'bot', 'spam', 'dust', 'airdrop', 'free', 'test', 'demo'];
        const SPAM_ADDRESSES = [
          'FetTyW8xAYfd33x4GMHoE7hTuEdWLj1fNnhJuyVMUGGa',
          'WaLLeTaS7qTaSnKFTYJNGAeu7VzoLMUV9QCMfKxFsgt',
          'RecipienTEKQQQQQQQQQQQQQQQQQQQQQQQQQQFrThs',
          'ComputeBudget111111111111111111111111111111'
        ];
        
        if (SPAM_TOKENS.some(spam => token.includes(spam))) return false;
        if (SPAM_ADDRESSES.includes(from) || SPAM_ADDRESSES.includes(to)) return false;
        
        return true;
      });
      
      return NextResponse.json({ 
        filteredTransactions: basicFiltered,
        aiAnalysis: false,
        fallback: true,
        error: 'AI analysis failed, used basic filtering'
      });
    } catch (fallbackError) {
      return NextResponse.json(
        { error: 'Failed to filter transactions' },
        { status: 500 }
      );
    }
  }
}
