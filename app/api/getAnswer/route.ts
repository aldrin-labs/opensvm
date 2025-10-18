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

export const maxDuration = 135;

// Stability monitoring
class StabilityMonitor {
  private static requests: number = 0;
  private static failures: number = 0;
  private static timeouts: number = 0;
  private static lastReset: number = Date.now();

  static recordRequest() {
    this.requests++;
    this.checkReset();
  }

  static recordFailure() {
    this.failures++;
    this.checkReset();
  }

  static recordTimeout() {
    this.timeouts++;
    this.checkReset();
  }

  private static checkReset() {
    // Reset metrics every 10 minutes
    if (Date.now() - this.lastReset > 600000) {
      this.requests = 0;
      this.failures = 0;
      this.timeouts = 0;
      this.lastReset = Date.now();
    }
  }

  static getMetrics() {
    this.checkReset();
    const successRate = this.requests > 0 ? ((this.requests - this.failures) / this.requests * 100).toFixed(1) : '100.0';
    return {
      requests: this.requests,
      failures: this.failures,
      timeouts: this.timeouts,
      successRate: `${successRate}%`,
      period: '10min'
    };
  }

  static isHealthy(): boolean {
    this.checkReset();
    if (this.requests < 5) return true; // Not enough data
    const failureRate = this.failures / this.requests;
    const timeoutRate = this.timeouts / this.requests;
    return failureRate < 0.3 && timeoutRate < 0.2; // < 30% failure rate, < 20% timeout rate
  }
}

export async function POST(request: Request) {
  const requestStart = Date.now();
  StabilityMonitor.recordRequest();

  const HAS_TOGETHER = !!process.env.TOGETHER_API_KEY;
  if (!HAS_TOGETHER) {
    console.warn("TOGETHER_API_KEY not set. Proceeding without LLM; tools-only mode.");
  }

  // Overall request timeout of 120 seconds (3x increase, leave 15 seconds buffer for cleanup)
  const requestTimeout = new Promise<never>((_, reject) => {
    setTimeout(() => {
      StabilityMonitor.recordTimeout();
      reject(new Error('Request timeout after 120 seconds'));
    }, 120000);
  });

  try {
    const mainProcessingPromise = async () => {
      const conn = getConnection();
      let body = await request.json();
      let question = body.question || body.message || "";

      // New: Check for ownPlan mode
      const ownPlan = body.ownPlan || null;
      const customSystemPrompt = body.systemPrompt || null;

      console.log(`📝 Processing query: "${question?.substring(0, 100)}${question?.length > 100 ? '...' : ''}"`);
      console.log(`🏥 System health: ${StabilityMonitor.isHealthy() ? 'HEALTHY' : 'DEGRADED'}`);

      // If ownPlan mode is enabled, skip tool execution and go directly to planning
      if (ownPlan) {
        console.log(`📋 OwnPlan mode activated - generating plan without execution`);
        return await handleOwnPlanMode(question, customSystemPrompt, requestStart);
      }

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
        const processingTime = Date.now() - requestStart;
        console.log(`✅ Tool handling successful in ${processingTime}ms`);
        return new Response(toolResult.response.body, {
          status: 200,
          headers: {
            "Content-Type": "text/plain",
            "Cache-Control": "no-cache",
            "X-Processing-Time": `${processingTime}ms`,
            "X-System-Health": StabilityMonitor.isHealthy() ? 'HEALTHY' : 'DEGRADED'
          },
        });
      }

      // If no tool handled it, proceed with LLM fallback
      // Pass any partial data we collected to help with the response
      const partialData = (toolResult as any).partialData || null;
      return await handleLLMFallback(question, requestStart, partialData);
    };

    const result = await Promise.race([mainProcessingPromise(), requestTimeout]);
    return result;

  } catch (error) {
    const processingTime = Date.now() - requestStart;
    console.error(`🔥 Request failed after ${processingTime}ms:`, error);

    if ((error as Error).message.includes('timeout')) {
      StabilityMonitor.recordTimeout();
    } else {
      StabilityMonitor.recordFailure();
    }

    const metrics = StabilityMonitor.getMetrics();
    console.log(`📊 System metrics:`, metrics);

    // Return graceful error response
    const isTimeout = (error as Error).message.includes('timeout');
    const errorResponse = isTimeout
      ? `# System Timeout

The system took too long to process your request. This might be due to:

- Network connectivity issues
- High system load
- Complex query requiring more time

**System Status**: ${metrics.successRate} success rate over ${metrics.period}

Please try:
1. A simpler, more specific query
2. Waiting a moment and retrying
3. Breaking complex requests into smaller parts

*Request processing time: ${processingTime}ms*`
      : `# System Error

An error occurred while processing your request.

**System Status**: ${metrics.successRate} success rate over ${metrics.period}

Please try your request again, or simplify your query if the issue persists.

*Error: ${(error as Error).message}*`;

    return new Response(errorResponse, {
      status: isTimeout ? 408 : 500,
      headers: {
        "Content-Type": "text/plain",
        "Cache-Control": "no-cache",
        "X-Processing-Time": `${processingTime}ms`,
        "X-System-Health": StabilityMonitor.isHealthy() ? 'HEALTHY' : 'DEGRADED'
      }
    });
  }
}

async function handleOwnPlanMode(question: string, customSystemPrompt: string | null, requestStart: number): Promise<Response> {
  // Generate a plan using custom system prompt without executing it
  console.log(`🎯 Starting handleOwnPlanMode`);

  // Determine which system prompt to use
  const useCustomPrompt = customSystemPrompt !== null && customSystemPrompt !== undefined;
  
  console.log(`🎯 Generating plan with ${useCustomPrompt ? 'custom' : 'OpenSVM'} system prompt`);

  // Build the base system prompt
  let baseSystemPrompt = '';
  
  if (useCustomPrompt) {
    // Use the custom system prompt provided by the caller
    baseSystemPrompt = customSystemPrompt;
  } else {
    // Use OpenSVM's default tool definitions
    baseSystemPrompt = `You are a blockchain analyst with access to the following specialized tools:

## Available Tools for OpenSVM

### PRIMARY TOOLS (Use these first):
1. **coingecko** - Cryptocurrency market data, prices, and trends
   - Get current prices, market caps, volume, price changes
   - Historical price data and charts
   - Trending tokens and market overview

2. **aiPlanExecution** - AI-powered intelligent tool selection and execution
   - Analyzes complex queries and selects appropriate tools
   - Coordinates multiple tool executions
   - Handles sophisticated multi-step operations

3. **transactionAnalysis** - Solana transaction analysis
   - Decode and analyze transaction signatures
   - Extract transfer details, programs used, and fees
   - Identify transaction patterns and types

4. **transactionInstructionAnalysis** - Deep instruction-level analysis
   - Decode individual transaction instructions
   - Parse program interactions and data
   - Analyze complex DeFi operations

### SECONDARY TOOLS:
5. **accountAnalysis** - Solana account and wallet analysis
   - Get account balances (SOL and tokens)
   - Analyze account history and activity
   - Token holdings and NFT collections

6. **dynamicPlanExecution** - Multi-step operation planning
   - Creates execution plans for complex queries
   - Coordinates data from multiple sources
   - Handles portfolio analysis and tracking

7. **networkAnalysis** - Solana network statistics
   - Current slot, epoch information
   - Network performance metrics
   - Validator information and stake distribution

8. **moralisAnalysis** - Enhanced blockchain data via Moralis API
   - Token metadata and pricing
   - Wallet portfolio analysis
   - Historical data and trends

### RPC METHODS (Direct Solana blockchain access):
- getAccountInfo - Get account data
- getBalance - Get SOL balance
- getTokenAccountsByOwner - Get token accounts
- getTransaction - Get transaction details
- getSignaturesForAddress - Get transaction history
- getBlockTime - Get block timestamp
- getSlot - Get current slot
- getEpochInfo - Get epoch information

## Planning Mode Instructions
You are in PLANNING MODE. Your task is to analyze the request and create a structured execution plan using the available tools listed above.`;
  }

  // Add the common XML output format requirements
  const planningSystemPrompt = `${baseSystemPrompt}

## OUTPUT FORMAT REQUIREMENTS
You MUST format your response using the following XML structure:

<osvm_plan>
  <overview>Brief description of what the plan will accomplish</overview>

  <tools>
    <tool name="tool_name" priority="high|medium|low">
      <description>What this tool does</description>
      <endpoint>API endpoint or RPC method</endpoint>
      <parameters>
        <param name="param_name" type="string|number|object" required="true|false">Description</param>
      </parameters>
      <expected_output>What data this will return</expected_output>
    </tool>
    <!-- Add more tools as needed -->
  </tools>

  <steps>
    <step number="1">
      <action>What action to take</action>
      <tool_ref>tool_name from the available tools list</tool_ref>
      <dependencies>None or step numbers this depends on</dependencies>
      <data_flow>How data flows from/to this step</data_flow>
    </step>
    <!-- Add more steps as needed -->
  </steps>

  <error_handling>
    <scenario>Potential error scenario</scenario>
    <mitigation>How to handle this error</mitigation>
  </error_handling>

  <validation>
    <check>What to validate after execution</check>
  </validation>

  <estimated_time>Estimated total execution time</estimated_time>
</osvm_plan>

IMPORTANT:
- Use ONLY the tools defined in the system prompt above
- Return ONLY the XML structure. No additional text before or after the XML
- Ensure tool_ref in steps matches the available tools from the system prompt
- Be specific about endpoints and parameters
- Do NOT execute anything, only plan`;

  try {
    console.log(`📡 Calling Together AI API directly with fetch`);
    console.log(`⏱️  Starting LLM request at ${new Date().toISOString()}`);
    
    // Use direct fetch instead of Together SDK to avoid event loop blocking
    const apiKey = process.env.TOGETHER_API_KEY;
    if (!apiKey) {
      throw new Error('TOGETHER_API_KEY not configured');
    }

    const requestBody = {
      model: "openai/gpt-oss-120b",
      messages: [
        {
          role: "system",
          content: planningSystemPrompt
        },
        { role: "user", content: question }
      ],
      stream: false,
      max_tokens: 2000
    };

    console.log(`📤 Sending request to Together AI...`);
    
    const llmTimeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Planning timeout after 60 seconds')), 60000);
    });

    const llmPromise = fetch('https://api.together.xyz/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    console.log(`⏳ Waiting for LLM response...`);
    const response = await Promise.race([llmPromise, llmTimeout]);
    console.log(`✅ Got response, status: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Together AI API error: ${response.status} - ${errorText}`);
    }

    const answer = await response.json();
    console.log(`✅ LLM response parsed at ${new Date().toISOString()}`);
    let plan = answer.choices?.[0]?.message?.content || "Failed to generate plan";

    // Clean up the response to ensure it's valid XML
    // Remove any text before <osvm_plan> or after </osvm_plan>
    const planMatch = plan.match(/<osvm_plan>[\s\S]*<\/osvm_plan>/);
    if (planMatch) {
      plan = planMatch[0];
    } else {
      // If the LLM didn't follow the format, wrap it in a basic structure
      plan = `<osvm_plan>
  <overview>Plan generation did not follow the structured format</overview>
  <raw_plan>${plan}</raw_plan>
</osvm_plan>`;
    }

    const processingTime = Date.now() - requestStart;
    console.log(`✅ Plan generated in ${processingTime}ms`);

    // Return the plan with special headers to indicate it's a plan-only response
    return new Response(plan, {
      status: 200,
      headers: {
        "Content-Type": "application/xml",
        "Cache-Control": "no-cache",
        "X-Processing-Time": `${processingTime}ms`,
        "X-Response-Type": "plan-only",
        "X-Custom-Prompt": "true"
      },
    });
  } catch (error) {
    const processingTime = Date.now() - requestStart;
    console.error(`❌ Plan generation failed after ${processingTime}ms:`, error);

    return new Response(`Failed to generate plan: ${(error as Error).message}`, {
      status: 500,
      headers: {
        "Content-Type": "text/plain",
        "Cache-Control": "no-cache",
        "X-Processing-Time": `${processingTime}ms`,
        "X-Response-Type": "plan-error"
      }
    });
  }
}

async function handleLLMFallback(question: string, requestStart: number, partialData?: any): Promise<Response> {

  // Fallback: use LLM (Together) to craft an answer if no tool handled it
  const together = new Together({
    apiKey: process.env.TOGETHER_API_KEY,
  });

  const solanaRpcKnowledge = await getSolanaRpcKnowledge();

  console.log("🤖 No tool handled query, using LLM fallback");

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

**IMPORTANT: NO EMOJIS, only neat ascii**

**Vibe Matching Guidelines:**
- If the user is casual/playful, be casual and playful back
- Use similar expressions and tone as the user
- Keep responses engaging and conversational
- NO EMOJIS - use neat ascii art or text expressions instead
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

Remember: Match their energy, be genuine, and have fun with it!`;
  } else {
    systemPrompt = `You are an expert Solana blockchain analyst who can adapt your communication style to match the user's vibe. You have deep technical knowledge but can explain things casually or formally as needed.

**IMPORTANT: NO EMOJIS, only neat ascii**

    Solana RPC:
  ${solanaRpcKnowledge} 
  ----
  Moralis API:
  ${moralis}
  ----

  ## Tooling Pipeline Context
  - Server executes Solana tools first. You are only being called as a fallback.
  - Do not attempt to produce JSON tool plans or [ACTION] tags.
  - Do not claim to have executed RPC or Moralis calls; if specific data was not provided, explain conceptually and suggest what data would be needed.
  - Prefer concise, direct analysis using the documentation context above.

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
  - Ask follow‑up questions when appropriate
  - Use emojis and casual language if they do

  Focus on being helpful while matching the user's communication style and energy level.

  ## Memcoin Analytics Guidance
  For queries about a memecoin (e.g., $SVMAI) on Solana, suggest the following actionable steps:
  1. **Obtain Mint Address** – Retrieve the token's mint address from Solscan, the project's docs, or by searching on-chain.
  2. **Fetch Token Supply** – Use \`solana rpc getTokenSupply <mint>\` or the Moralis \`/token/{address}/supply\` endpoint.
  3. **Get Current Price** – Query a price oracle (Pyth, Switchboard) or an off‑chain API (CoinGecko, CoinMarketCap) for the token/USD price.
  4. **Calculate Market‑Cap** – Multiply the circulating supply by the current price.
  5. **Gather 24h Volume** – Sum trade volumes from known DEX pools (Serum, Raydium) via their APIs or on‑chain order‑book data.
  6. **Provide Sources** – Cite the data sources used (oracle account, API endpoint) in the answer.

  Incorporate these steps into the final response, presenting the computed values and any required follow‑up if data is missing.`;
  }

  // Add partial data context if available
  if (partialData && Object.keys(partialData).length > 0) {
    console.log(`📊 Adding partial data context to LLM: ${Object.keys(partialData).join(', ')}`);
    systemPrompt += `\n\n## Partial Data Available\nSome tools partially executed before failing. Use this available data in your response:\n\n`;

    for (const [toolName, data] of Object.entries(partialData)) {
      systemPrompt += `**${toolName}**:\n`;
      try {
        systemPrompt += `${JSON.stringify(data, null, 2)}\n\n`;
      } catch (e) {
        systemPrompt += `${String(data)}\n\n`;
      }
    }

    systemPrompt += `Use this partial data to provide the most comprehensive answer possible. If some data is missing, explain what additional information would be needed and suggest how to obtain it.`;
  }

  try {
    // Adjust max tokens based on query type and fix the token overload issue
    const maxTokens = userVibe.isCasual && !userVibe.isTechnical ? 1000 : 4000;

    // Add timeout for LLM call (3x increase)
    const llmTimeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('LLM call timeout')), 60000); // 60 second LLM timeout
    });

    const llmPromise = together.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        { role: "user", content: question }
      ],
      stream: false,
      max_tokens: maxTokens,
    });

    let answer = await Promise.race([llmPromise, llmTimeout]);
    let parsedAnswer: any = answer.choices?.[0]?.message?.content || "Failed to get answer";

    // Post-process the response to handle plan objects and improve formatting
    const generativeCapability = new GenerativeCapability();
    parsedAnswer = generativeCapability.postProcessResponse(parsedAnswer);

    const processingTime = Date.now() - requestStart;
    console.log(`✅ LLM fallback completed in ${processingTime}ms`);

    return new Response(parsedAnswer, {
      status: 200,
      headers: {
        "Content-Type": "text/plain",
        "Cache-Control": "no-cache",
        "X-Processing-Time": `${processingTime}ms`,
        "X-Fallback": "LLM"
      },
    });
  } catch (e) {
    const processingTime = Date.now() - requestStart;
    console.error(`❌ LLM processing failed after ${processingTime}ms:`, e);
    console.error("Query that failed:", question);
    console.error("User vibe detected:", userVibe);

    StabilityMonitor.recordFailure();

    // Return a more helpful error response that still matches potential user vibe
    const isTimeout = (e as Error).message.includes('timeout');
    const errorResponse = isTimeout
      ? (userVibe?.isCasual
        ? "Sorry! That took too long to process. Could you try a simpler question?"
        : "Request timed out. Please try a simpler query or retry in a moment.")
      : (userVibe?.isCasual
        ? "Oops! Something went wrong on my end. Could you try asking again?"
        : "I encountered an error while processing your query. Please try again.");

    return new Response(errorResponse, {
      status: isTimeout ? 408 : 500,
      headers: {
        "Content-Type": "text/plain",
        "Cache-Control": "no-cache",
        "X-Processing-Time": `${processingTime}ms`,
        "X-Fallback": "LLM-ERROR"
      }
    });
  }
}
