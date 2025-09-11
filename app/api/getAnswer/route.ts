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
    return `# Complete Solana RPC and Moralis API Specification for AI Analysis

You are an expert Solana blockchain analyst with access to comprehensive RPC APIs and enhanced analytics. Use this knowledge to provide detailed, accurate analysis.

${content}
--------
You also have access to the following Moralis Solana API endpoints for enhanced data retrieval and analysis:

${moralis}
`;
  } catch (error) {
    console.error('Failed to load Solana RPC documentation:', error);
    // Fallback to abbreviated version if file can't be read
    return `
# Complete Solana RPC API Specification for AI Analysis

You are an expert Solana blockchain analyst with access to comprehensive RPC APIs and enhanced analytics. Use this knowledge to provide detailed, accurate analysis.

## Basic RPC Methods Available

- getAccountInfo: Get account details
- getBalance: Get account balance
- getTransaction: Get transaction details
- getSlot: Get current slot
- getEpochInfo: Get epoch information
- getBlockHeight: Get current block height
- getRecentPerformanceSamples: Get TPS data
- getBlocks: Get blocks in range
- getBlock: Get block details

... (abbreviated due to file loading error) ...
${moralis}
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
      model: "moonshotai/Kimi-K2-Instruct-0905",
      messages: [
        {
          role: "system",
          content: `You are an expert Solana blockchain analyst. Use your knowledge of Solana RPC and Moralis APIs to provide detailed, accurate analysis.

${solanaRpcKnowledge}

Provide comprehensive answers with specific data points and technical insights.`
        },
        { role: "user", content: question }
      ],
      stream: false,
    });

    let parsedAnswer = answer.choices?.[0]?.message?.content || "Failed to get answer";

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
