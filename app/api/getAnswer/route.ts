import Together from "together-ai";
import { GenerativeCapability } from "../../../lib/ai/capabilities/generative";
import getConnection from "../../../lib/solana-connection-server";
import { ToolRegistry, ToolContext } from "./tools";

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
    return `# Complete Solana RPC API Specification for AI Analysis

You are an expert Solana blockchain analyst with access to comprehensive RPC APIs and enhanced analytics. Use this knowledge to provide detailed, accurate analysis.

${content}`;
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
  let { question } = await request.json();

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
    return toolResult.response;
  }

  // Fallback: use LLM (Together) to craft an answer
  const together = new Together({
    apiKey: process.env.TOGETHER_API_KEY,
  });

  const solanaRpcKnowledge = await getSolanaRpcKnowledge();
  const mainAnswerPrompt = `You are an expert Solana blockchain analyst with comprehensive knowledge of the Solana ecosystem and RPC APIs. Given a user question and some context, please write a clean, concise and accurate answer to the question based on the context. You will be given a set of related contexts to the question, each starting with a reference number like [[citation:x]], where x is a number. Please use the context when crafting your answer.

Your answer must be correct, accurate and written by an expert using an unbiased and professional tone. Please limit to 1024 tokens. Do not give any information that is not related to the question, and do not repeat. Say "information is missing on" followed by the related topic, if the given context do not provide sufficient information.

${solanaRpcKnowledge}

Remember, don't blindly repeat the contexts verbatim and don't tell the user how you used the citations – just respond with the answer. It is very important for my career that you follow these instructions. Do not generate plan objects in your response. Here is the user question:`;

  try {
    // Use non-streaming response for better control over post-processing
    console.log("[getAnswer] Fetching non-stream answer from Together API");

    let answer = await together.chat.completions.create({
      model: "moonshotai/Kimi-K2-Instruct-0905",
      messages: [
        { role: "system", content: mainAnswerPrompt },
        {
          role: "user",
          content: question,
        },
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
    console.log("Error is: ", e);
    return new Response("Failed to get answer", { status: 500 });
  }
}
