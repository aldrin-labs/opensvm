import { NextResponse } from 'next/server';
import { 
  MIN_TRANSFER_SOL, 
  MAX_TRANSFER_COUNT,
  isSpamAddress,
  isSpamToken,
  isDexLikeAddress,
  isAboveDustThreshold,
  AI_MODEL,
  AI_MAX_TOKENS,
  AI_TEMPERATURE,
  SPAM_TOKEN_KEYWORDS
} from '@/lib/transaction-constants';

export async function POST(request: Request) {
  try {
    const { transactions } = await request.json();

    if (!transactions || !Array.isArray(transactions)) {
      return NextResponse.json(
        { error: 'Invalid transactions data' },
        { status: 400 }
      );
    }

    // Known spam/analytics tokens and addresses to filter out - now using shared constants
    // (Legacy code kept for backward compatibility, but migrating to shared constants)

    // Pre-filter obvious spam before AI analysis and prioritize by volume
    const preFiltered = transactions
      .filter(tx => {
        const amount = parseFloat(tx.tokenAmount || '0');
        const token = (tx.tokenSymbol || '').toLowerCase();
        const from = tx.from || '';
        const to = tx.to || '';
        
        // Filter out dust transactions (using named constant)
        if (!isAboveDustThreshold(amount, MIN_TRANSFER_SOL)) return false;
        
        // Filter out spam tokens (using shared function)
        if (isSpamToken(tx.tokenSymbol)) return false;
        
        // Filter out spam addresses (using shared function)
        if (isSpamAddress(from) || isSpamAddress(to)) return false;
        
        // Only include simple wallet-to-wallet transfers (filter out DEX/trading activity)
        if (isDexLikeAddress(from) || isDexLikeAddress(to)) return false;
        
        return true;
      })
      .sort((a, b) => parseFloat(b.tokenAmount || '0') - parseFloat(a.tokenAmount || '0')) // Sort by volume desc
      .slice(0, MAX_TRANSFER_COUNT); // Limit to top transfers by volume

    // If too many transactions were filtered, use the pre-filtered results (already limited to top 10)
    if (preFiltered.length < transactions.length * 0.5 || preFiltered.length <= 10) {
      return NextResponse.json({ 
        filteredTransactions: preFiltered,
        aiAnalysis: false,
        preFiltered: true,
        originalCount: transactions.length,
        filteredCount: preFiltered.length,
        limitedToTop10: true
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
1. Remove transactions with amounts < ${MIN_TRANSFER_SOL} tokens (increased threshold for performance)
2. Remove transactions to/from known spam addresses or analytics services
3. Remove repetitive bot-like patterns (same amounts, regular intervals)
4. Remove transactions with suspicious token names containing: ${SPAM_TOKEN_KEYWORDS.join(', ')}
5. Remove DEX/trading activity (keep only simple wallet-to-wallet transfers)
6. Keep only top ${MAX_TRANSFER_COUNT} transfers by volume for performance
7. Keep legitimate transfers between user wallets with significant amounts

Return only a JSON array of transaction IDs for the top ${MAX_TRANSFER_COUNT} transfers by volume that should be kept, like: ["txId1", "txId2", ...]`;

    // Use correct AI model instead of non-existent gpt-4.1-nano
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: AI_MODEL, // Using available model instead of non-existent gpt-4.1-nano
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
        max_tokens: AI_MAX_TOKENS,
        temperature: AI_TEMPERATURE,
        response_format: { type: 'json_object' }
      }),
    });

    if (!response.ok) {
      // Fallback: if AI analysis fails, apply enhanced basic filtering with top transfer limit
      const basicFiltered = transactions
        .filter(tx => {
          const amount = parseFloat(tx.tokenAmount || '0');
          const from = tx.from || '';
          const to = tx.to || '';
          
          // Filter out dust transactions (using named constant)
          if (!isAboveDustThreshold(amount, MIN_TRANSFER_SOL)) return false;
          
          // Filter out spam tokens and addresses (using shared functions)
          if (isSpamToken(tx.tokenSymbol) || isSpamAddress(from) || isSpamAddress(to)) return false;
          
          // Filter out DEX/trading activity (using shared function)
          if (isDexLikeAddress(from) || isDexLikeAddress(to)) return false;
          
          return true;
        })
        .sort((a, b) => parseFloat(b.tokenAmount || '0') - parseFloat(a.tokenAmount || '0'))
        .slice(0, MAX_TRANSFER_COUNT); // Limit to top transfers by volume
      
      return NextResponse.json({ 
        filteredTransactions: basicFiltered,
        aiAnalysis: false,
        fallback: true,
        limitedToTop10: true
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
        const from = tx.from || '';
        const to = tx.to || '';
        
        // Filter out dust transactions (using named constant)
        if (!isAboveDustThreshold(amount, MIN_TRANSFER_SOL)) return false;
        
        // Filter out spam tokens and addresses (using shared functions)
        if (isSpamToken(tx.tokenSymbol) || isSpamAddress(from) || isSpamAddress(to)) return false;
        
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
        const from = tx.from || '';
        const to = tx.to || '';
        
        // Filter out dust transactions (using named constant)
        if (!isAboveDustThreshold(amount, MIN_TRANSFER_SOL)) return false;
        
        // Filter out spam tokens and addresses (using shared functions)
        if (isSpamToken(tx.tokenSymbol) || isSpamAddress(from) || isSpamAddress(to)) return false;
        
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
