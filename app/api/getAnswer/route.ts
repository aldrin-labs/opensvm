import Together from "together-ai";
import { GenerativeCapability } from "../../../lib/ai/capabilities/generative";
import getConnection from "../../../lib/solana-connection-server";
import { ToolRegistry, ToolContext } from "./tools";
import { moralis_swagger as moralis } from "./tools/moralis";

/**
 * This API endpoint uses a modular tool system to handle common Solana queries
 * (network TPS/load, current block height & epoch, wallet balance, transaction analysis)
 * by calling the appropriate tools first. If no tool handles the query,
 * it falls back to the LLM (Together) pipeline.
 *
 * This ensures "tools" (RPC calls) are executed on the server prior to
 * returning the response to the user.
 */

// Read the full Solana RPC documentation from the docs file
async function getSolanaRpcKnowledge(): Promise<string> {
  // Try multiple possible locations for the documentation file
  const possiblePaths = [
    'public/solana-rpc-llms.md',  // Standard Next.js public directory
    './public/solana-rpc-llms.md',  // Relative path
    '/var/task/public/solana-rpc-llms.md'  // Netlify function absolute path
  ];
  
  let content = '';
  let loadedSuccessfully = false;
  
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    // Try each possible path
    for (const relativePath of possiblePaths) {
      try {
        const docPath = path.resolve(process.cwd(), relativePath);
        content = await fs.readFile(docPath, 'utf-8');
        loadedSuccessfully = true;
        console.log(`✅ Successfully loaded Solana RPC documentation from: ${docPath}`);
        break;
      } catch (pathError) {
        // Continue to next path
        continue;
      }
    }
    
    if (!loadedSuccessfully) {
      throw new Error('Documentation file not found in any expected location');
    }
    
  } catch (error) {
    console.error('❌ Failed to load Solana RPC documentation:', error);
    console.log('🔄 Using fallback abbreviated documentation');
  }
  
  // Return either full documentation or fallback
  if (loadedSuccessfully && content) {
    return `
# Complete Solana RPC and Moralis API Specification for AI Analysis

You are an expert Solana blockchain analyst with access to comprehensive RPC APIs and enhanced analytics through both Solana RPC and Moralis API endpoints.

## API Access Strategy
When analyzing Solana data, prioritize using:
1. **Moralis API** for enhanced data retrieval, token analytics, and DeFi insights
2. **Solana RPC** for direct blockchain queries and real-time data

## Moralis Solana API Endpoints
${moralis}

## Additional Analysis Capabilities
- Use Moralis for token price data, portfolio analysis, and DeFi protocol interactions
- Combine RPC data with Moralis insights for comprehensive transaction analysis
- Leverage Moralis historical data for trend analysis and market insights
- Use RPC for real-time network status and direct blockchain state queries

## Solana RPC Documentation
${content}

## Integration Guidelines
- Cross-reference RPC transaction data with Moralis analytics for deeper insights
- Use Moralis token metadata and pricing alongside RPC account information
- Combine network performance data (RPC) with market data (Moralis) for holistic analysis
- Provide specific API endpoints and parameters when suggesting data retrieval methods

When responding to queries, always consider both API sources and suggest the most appropriate combination for comprehensive analysis.
--------
`;
  } else {
    // Enhanced fallback with more comprehensive documentation
    return `
# Complete Solana RPC and Moralis API Specification for AI Analysis

You are an expert Solana blockchain analyst with access to comprehensive RPC APIs and enhanced analytics through both Solana RPC and Moralis API endpoints.

## API Access Strategy
When analyzing Solana data, prioritize using:
1. **Moralis API** for enhanced data retrieval, token analytics, and DeFi insights
2. **Solana RPC** for direct blockchain queries and real-time data

## Moralis Solana API Endpoints
${moralis}

## Essential Solana RPC Methods Available

### Account Operations
- **getAccountInfo**: Get account details including balance, owner, executable status
- **getBalance**: Get lamport balance for any account
- **getMultipleAccounts**: Batch retrieve multiple account information
- **getProgramAccounts**: Get all accounts owned by a specific program

### Transaction Operations  
- **getTransaction**: Get detailed transaction information by signature
- **getSignaturesForAddress**: Get transaction signatures for an address
- **getSignatureStatuses**: Check confirmation status of transactions
- **sendTransaction**: Submit signed transactions to the network
- **simulateTransaction**: Test transactions before sending

### Block & Network Information
- **getSlot**: Get current slot number
- **getBlock**: Get block information and all transactions
- **getBlockHeight**: Get current block height
- **getEpochInfo**: Get current epoch information
- **getRecentPerformanceSamples**: Get network TPS and performance data

### Token Operations
- **getTokenAccountBalance**: Get SPL token balance
- **getTokenAccountsByOwner**: Get all token accounts for an owner
- **getTokenSupply**: Get total supply of a token
- **getTokenLargestAccounts**: Get largest holders of a token

### Network Status
- **getHealth**: Check node health status  
- **getVersion**: Get Solana version information
- **getGenesisHash**: Get genesis block hash
- **getRecentPrioritizationFees**: Get fee estimates

## Integration Guidelines
- Cross-reference RPC transaction data with Moralis analytics for deeper insights
- Use Moralis token metadata and pricing alongside RPC account information
- Combine network performance data (RPC) with market data (Moralis) for holistic analysis
- Provide specific API endpoints and parameters when suggesting data retrieval methods
- Always include error handling for network requests
- Use appropriate commitment levels (processed, confirmed, finalized) based on use case

⚠️  Note: Running with abbreviated documentation due to file loading issue. Full documentation should be available after deployment fix.
--------
`;
  }
}

export const maxDuration = 45;

export async function POST(request: Request) {
  if (!process.env.TOGETHER_API_KEY) {
    return new Response(
      JSON.stringify({ error: "TOGETHER_API_KEY environment variable is not set" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const conn = getConnection();
  let body = await request.json();
  let question = body.question || body.message || "";

  // Create tool context for modular tool execution
  const toolContext: ToolContext = {
    conn: conn,
    question: String(question || ""),
    qLower: String(question || "").toLowerCase()
  };

  // Try to execute relevant tools first
  const toolRegistry = new ToolRegistry();
  const toolResult = await toolRegistry.executeTools(toolContext);

  if (toolResult.handled && toolResult.response) {
    return new Response(toolResult.response.body, {
      status: 200,
      headers: {
        "Content-Type": "text/plain",
        "Cache-Control": "no-cache",
      },
    });
  }

  // Fallback: use LLM (Together) to craft an answer if no tool handled it
  const together = new Together({
    apiKey: process.env.TOGETHER_API_KEY,
  });

  const solanaRpcKnowledge = await getSolanaRpcKnowledge();

  console.log("[getAnswer] No tool handled query, using LLM fallback");
  
  // Detect user's vibe and adjust response style accordingly
  function detectUserVibe(query: string) {
    const lowerQuery = query.toLowerCase().trim();
    
    // Check for casual/fun expressions
    const casualPatterns = [
      /uwu|owo|xd|lol|lmao|bruh|yo|hey|sup|wassup/,
      /😂|😎|🚀|🔥|💯|😭|😍|🤔|👀|💀/,
      /hows?\s*(it\s*)?(going|goin)/,
      /whats?\s*up/,
      /how\s*(are\s*)?you/
    ];
    
    const isCasual = casualPatterns.some(pattern => pattern.test(lowerQuery));
    
    // Check for technical/analytical queries
    const technicalPatterns = [
      /analyze|transaction|account|balance|validator|network|block|epoch|program|defi|dex/,
      /rpc|api|endpoint|smart\s*contract|liquidity|yield|farming|staking/,
      /sol|solana|usdc|usdt|ray|srm|mango|serum|jupiter|raydium/
    ];
    
    const isTechnical = technicalPatterns.some(pattern => pattern.test(lowerQuery));
    
    return { isCasual, isTechnical, originalQuery: query };
  }
  
  const userVibe = detectUserVibe(question);
  
  // Create adaptive system prompt based on user's vibe
  let systemPrompt = "";
  
  if (userVibe.isCasual && !userVibe.isTechnical) {
    systemPrompt = `You are a friendly, knowledgeable assistant with expertise in Solana blockchain. You match the user's energy and communication style while being helpful and informative.

**Vibe Matching Guidelines:**
- If the user is casual/playful, be casual and playful back
- Use similar expressions and tone as the user
- Keep responses engaging and conversational
- Use emojis if the user uses them
- Be concise for simple questions
- Still provide accurate information when needed

**For Solana-related casual queries:**
- Give brief, accessible explanations
- Use analogies and simple language
- Focus on what's most interesting or relevant
- Keep the energy up!

**For general casual conversation:**
- Just be a friendly, helpful assistant
- Match their vibe while being genuine
- Ask follow-up questions if appropriate

Remember: Match their energy, be genuine, and have fun with it! 🚀`;
  } else {
    systemPrompt = `You are an expert Solana blockchain analyst who can adapt your communication style to match the user's vibe. You have deep technical knowledge but can explain things casually or formally as needed.

  ${solanaRpcKnowledge}

  ## Adaptive Communication Style
  - **Casual queries**: Respond in a friendly, conversational tone with accessible language
  - **Technical queries**: Provide detailed, precise technical information
  - **Mixed queries**: Balance technical accuracy with approachable explanations
  - Always match the user's energy level and communication style

  ## For Technical Analysis
  When creating plans, structure responses as actionable steps:
  1. **Identify Data Requirements**: What specific blockchain data is needed?
  2. **API Selection Strategy**: Choose between Solana RPC and Moralis APIs
  3. **Execution Sequence**: Order operations logically
  4. **Data Correlation**: Plan how to combine multiple data sources

  ## For Casual Conversation
  - Keep it engaging and match their vibe
  - Use simple explanations for complex concepts
  - Ask follow-up questions when appropriate
  - Use emojis and casual language if they do

  Focus on being helpful while matching the user's communication style and energy level.`;
  }

  try {
    let answer = await together.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        { role: "user", content: question }
      ],
      stream: false,
      max_tokens: 150000,
    });

    let parsedAnswer: any = answer.choices?.[0]?.message?.content || "Failed to get answer";

    // Post-process the response to handle plan objects and improve formatting
    const generativeCapability = new GenerativeCapability();
    parsedAnswer = generativeCapability.postProcessResponse(parsedAnswer);

    return new Response(parsedAnswer, {
      status: 200,
      headers: {
        "Content-Type": "text/plain",
        "Cache-Control": "no-cache",
      },
    });
  } catch (e) {
    console.error("Error with LLM processing:", e);
    console.error("Query that failed:", question);
    console.error("User vibe detected:", userVibe);
    console.error("Error details:", {
      name: e instanceof Error ? e.name : 'Unknown',
      message: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack : 'No stack trace'
    });
    
    // Return a more helpful error response that still matches potential user vibe
    const errorResponse = userVibe?.isCasual 
      ? "Oops! Something went wrong on my end 😅 Could you try asking again?"
      : "I encountered an error while processing your query. Please try again.";
    
    return new Response(errorResponse, {
      status: 500,
      headers: { 
        "Content-Type": "text/plain",
        "Cache-Control": "no-cache"
      }
    });
  }
}
