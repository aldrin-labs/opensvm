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
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    const docPath = path.join(process.cwd(), 'public', 'solana-rpc-llms.md');
    const content = await fs.readFile(docPath, 'utf-8');
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
  } catch (error) {
    console.error('Failed to load Solana RPC documentation:', error);
    // Fallback to abbreviated version if file can't be read
    return `
# Complete Solana RPC and Moralis API Specification for AI Analysis

You are an expert Solana blockchain analyst with access to comprehensive RPC APIs and enhanced analytics through both Solana RPC and Moralis API endpoints.

## API Access Strategy
When analyzing Solana data, prioritize using:
1. **Moralis API** for enhanced data retrieval, token analytics, and DeFi insights
2. **Solana RPC** for direct blockchain queries and real-time data

## Moralis Solana API Endpoints
${moralis}

## Basic Solana RPC Methods Available
- getAccountInfo: Get account details
- getBalance: Get account balance  
- getTransaction: Get transaction details
- getSlot: Get current slot
- getEpochInfo: Get epoch information
- getBlockHeight: Get current block height
- getRecentPerformanceSamples: Get TPS data
- getBlocks: Get blocks in range
- getBlock: Get block details

## Integration Guidelines
- Cross-reference RPC transaction data with Moralis analytics for deeper insights
- Use Moralis token metadata and pricing alongside RPC account information
- Combine network performance data (RPC) with market data (Moralis) for holistic analysis
- Provide specific API endpoints and parameters when suggesting data retrieval methods

When responding to queries, always consider both API sources and suggest the most appropriate combination for comprehensive analysis.

... (abbreviated due to file loading error) ...
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
  try {
    let answer = await together.chat.completions.create({
      model: "google/gemma-3n-E4B-it",
      messages: [
        {
          role: "system",
          content: `You are an expert Solana blockchain analyst and planning agent. Your primary role is to create detailed execution plans for complex blockchain analysis tasks.

  ${solanaRpcKnowledge}

  ## Planning Guidelines for Agent Execution

  When creating plans, structure responses as actionable steps that can be executed by automated tools:

  1. **Identify Data Requirements**: What specific blockchain data is needed?
  2. **API Selection Strategy**: Choose between Solana RPC and Moralis APIs based on:
     - Moralis: For token analytics, DeFi insights, portfolio analysis, historical data
     - Solana RPC: For real-time network data, direct blockchain state, transaction details
  3. **Execution Sequence**: Order operations logically (e.g., get account info before analyzing transactions)
  4. **Data Correlation**: Plan how to combine multiple data sources for comprehensive analysis

  ## Response Format for Planning Queries

  For queries requiring multi-step analysis, provide:
  - **Analysis Plan**: Step-by-step breakdown of required operations
  - **API Endpoints**: Specific RPC methods or Moralis endpoints to use
  - **Data Flow**: How outputs from one step inform the next
  - **Expected Insights**: What conclusions can be drawn from the gathered data

  ## Technical Implementation Details

  Always include:
  - Exact API method names (e.g., "getAccountInfo", "moralis/account/tokens")
  - Required parameters and their sources
  - Error handling considerations
  - Data validation steps
  - Performance optimization suggestions

  Focus on creating actionable, technically precise plans that an automated agent can execute reliably.`
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
    console.log("Error with LLM: ", e);
    return new Response(
      JSON.stringify({ error: "Failed to process query" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
}
