import { NextRequest, NextResponse } from 'next/server';
import Together from 'together-ai';

// Route segment config: Set timeout to 120 seconds
export const maxDuration = 120;


export const runtime = 'edge';

interface TradeCommand {
  action: 'buy' | 'sell';
  amount: number;
  token: string;
  orderType: 'market' | 'limit';
  price?: number;
  estimatedValue?: number;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

// Parse natural language trading commands
function parseTradingCommand(text: string, market: string): TradeCommand | null {
  const lowerText = text.toLowerCase();
  
  // Extract action (buy/sell)
  const isBuy = /\b(buy|long|purchase)\b/.test(lowerText);
  const isSell = /\b(sell|short|close)\b/.test(lowerText);
  
  if (!isBuy && !isSell) return null;
  
  // Extract amount
  const amountMatch = lowerText.match(/(\d+(?:\.\d+)?)\s*(?:sol|usdc|tokens?)?/);
  if (!amountMatch) return null;
  
  const amount = parseFloat(amountMatch[1]);
  
  // Extract token from market (e.g., "SOL/USDC" -> "SOL")
  const [baseToken] = market.split('/');
  
  // Determine order type
  const isLimit = /\blimit\b/.test(lowerText);
  const orderType = isLimit ? 'limit' : 'market';
  
  // Extract price for limit orders
  let price: number | undefined;
  if (isLimit) {
    const priceMatch = lowerText.match(/(?:at|@)\s*\$?(\d+(?:\.\d+)?)/);
    if (priceMatch) {
      price = parseFloat(priceMatch[1]);
    }
  }
  
  // Estimate value (mock calculation - would need real price data)
  const estimatedPrice = price || 150; // Mock SOL price
  const estimatedValue = amount * estimatedPrice;
  
  return {
    action: isBuy ? 'buy' : 'sell',
    amount,
    token: baseToken,
    orderType,
    price,
    estimatedValue,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, market, walletConnected, chatHistory, marketData } = body;

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Check for Together AI API key
    const apiKey = process.env.TOGETHER_API_KEY;

    if (!apiKey) {
      return NextResponse.json({
        message: "I'm currently unavailable as the AI service is not configured. Please set the TOGETHER_API_KEY environment variable.",
        tradeCommand: null,
      });
    }

    // Check if this is a trading command
    const tradeCommand = parseTradingCommand(message, market);

    // If it's a trading command, generate a confirmation message
    if (tradeCommand) {
      if (!walletConnected) {
        return NextResponse.json({
          message: `⚠️ I detected a trading command:\n\n**${tradeCommand.action.toUpperCase()}** ${tradeCommand.amount} ${tradeCommand.token} at ${tradeCommand.orderType} price\n\nHowever, your wallet is not connected. Please connect your wallet to execute trades.`,
          tradeCommand: null,
        });
      }

      const confirmationMessage = `I'll place a **${tradeCommand.orderType} ${tradeCommand.action}** order for you:\n\n` +
        `• Token: ${tradeCommand.token}\n` +
        `• Amount: ${tradeCommand.amount}\n` +
        `• Type: ${tradeCommand.orderType}\n` +
        (tradeCommand.price ? `• Price: $${tradeCommand.price.toFixed(2)}\n` : '') +
        (tradeCommand.estimatedValue ? `• Est. Value: $${tradeCommand.estimatedValue.toFixed(2)}\n` : '') +
        `\n**Please confirm this trade to proceed.**`;

      return NextResponse.json({
        message: confirmationMessage,
        tradeCommand,
      });
    }

    // If not a trading command, use AI for analysis/conversation
    const together = new Together({ apiKey });

    // Build context from chat history
    const contextMessages = (chatHistory || []).slice(-5).map((msg: ChatMessage) => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content,
    }));

    // System prompt for trading assistant
    let systemPrompt = `You are an expert AI trading assistant for a Solana DEX trading terminal. Your capabilities include:

1. **Market Analysis**: Provide insights on price trends, volume, and market conditions
2. **Trading Advice**: Suggest strategies, explain order types, and discuss risk management
3. **Position Monitoring**: Help users understand their positions and portfolio
4. **Educational**: Explain trading concepts, DeFi protocols, and blockchain mechanics

Current Market: ${market}
Wallet Status: ${walletConnected ? 'Connected' : 'Not Connected'}
`;

    // Add real-time market data if available
    if (marketData) {
      systemPrompt += `\n**REAL-TIME MARKET DATA:**
• Current Price: $${marketData.price?.toFixed(4) || 'N/A'}
• 24h Change: ${marketData.change24h ? (marketData.change24h > 0 ? '+' : '') + marketData.change24h.toFixed(2) + '%' : 'N/A'}
• 24h Volume: $${marketData.volume24h ? (marketData.volume24h / 1000000).toFixed(2) + 'M' : 'N/A'}
• 24h High: $${marketData.high24h?.toFixed(4) || 'N/A'}
• 24h Low: $${marketData.low24h?.toFixed(4) || 'N/A'}
`;

      if (marketData.orderBook) {
        const topBid = marketData.orderBook.topBid;
        const topAsk = marketData.orderBook.topAsk;
        const spread = marketData.orderBook.spread;
        
        systemPrompt += `\n**ORDER BOOK:**
• Best Bid: $${topBid?.price?.toFixed(4) || 'N/A'} (${topBid?.amount?.toFixed(2) || 'N/A'} tokens)
• Best Ask: $${topAsk?.price?.toFixed(4) || 'N/A'} (${topAsk?.amount?.toFixed(2) || 'N/A'} tokens)
• Spread: ${spread ? spread.toFixed(3) + '%' : 'N/A'}
`;
      }

      if (marketData.recentTrades && marketData.recentTrades.length > 0) {
        const lastTrade = marketData.recentTrades[0];
        const buyPressure = marketData.recentTrades.filter((t: any) => t.side === 'buy').length;
        const totalTrades = marketData.recentTrades.length;
        
        systemPrompt += `\n**RECENT TRADING ACTIVITY:**
• Last Trade: $${lastTrade.price?.toFixed(4)} (${lastTrade.side})
• Buy Pressure: ${((buyPressure / totalTrades) * 100).toFixed(0)}% of last ${totalTrades} trades
`;
      }
    } else {
      systemPrompt += `\n⚠️ **Note:** Real-time market data is currently unavailable. Provide general guidance only.
`;
    }

    systemPrompt += `
Guidelines:
- Be concise but informative
- Use bullet points for clarity
- Base your analysis on the REAL-TIME DATA provided above
- If data is unavailable, clearly state you cannot provide specific analysis
- Warn about risks when discussing trading strategies
- If asked about price predictions, emphasize uncertainty
- For trading commands (buy/sell), I handle them separately

Keep responses under 200 words unless detailed analysis is requested.`;

    const response = await together.chat.completions.create({
      model: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        ...contextMessages,
        { role: 'user', content: message },
      ],
      max_tokens: 500,
      temperature: 0.7,
      top_p: 0.9,
    });

    const aiMessage = response.choices[0]?.message?.content || 
      "I'm sorry, I couldn't generate a response. Please try again.";

    return NextResponse.json({
      message: aiMessage,
      tradeCommand: null,
    });

  } catch (error) {
    console.error('Trading chat API error:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to process message',
        message: 'An error occurred while processing your message. Please try again.',
        tradeCommand: null,
      },
      { status: 500 }
    );
  }
}
