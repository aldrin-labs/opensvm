import { Readability } from "@mozilla/readability";
import jsdom, { JSDOM } from "jsdom";
import { TogetherAIStream } from "../../../utils/TogetherAIStream";
import type { TogetherAIStreamPayload } from "../../../utils/TogetherAIStream";
import Together from "together-ai";
import { GenerativeCapability } from "../../../lib/ai/capabilities/generative";
import { Connection, PublicKey } from "@solana/web3.js";
import { getRpcEndpoints, getRpcHeaders } from "../../../lib/opensvm-rpc-fixed";

/**
 * This API endpoint prefers to satisfy some common factual queries
 * (network TPS/load, current block height & epoch, wallet balance)
 * by calling the Solana RPC on the server-side and returning concrete
 * numeric results to the client. If the question is not one of those
 * fast-lookups, it falls back to the LLM (Together) pipeline as before.
 *
 * This ensures "tools" (RPC calls) are executed on the server prior to
 * returning the response to the user.
 */


const SOLANA_RPC_KNOWLEDGE = `
# Complete Solana RPC API Specification for AI Analysis

You are an expert Solana blockchain analyst with access to comprehensive RPC APIs and enhanced analytics. Use this knowledge to provide detailed, accurate analysis.

... (omitted for brevity - unchanged) ...
`;

export const maxDuration = 45;

async function fetchWithTimeout(url: string, options = {}, timeout = 3000) {
  const controller = new AbortController();
  const { signal } = controller;
  const fetchTimeout = setTimeout(() => controller.abort(), timeout);
  return fetch(url, { ...options, signal })
    .then((response) => {
      clearTimeout(fetchTimeout);
      return response;
    })
    .catch((error) => {
      if ((error as any).name === "AbortError") throw new Error("Fetch request timed out");
      throw error;
    });
}

const cleanedText = (text: string) => {
  let newText = text
    .trim()
    .replace(/(\n){4,}/g, "\n\n\n")
    .replace(/\n\n/g, " ")
    .replace(/ {3,}/g, "  ")
    .replace(/\t/g, "")
    .replace(/\n+(\s*\n)*/g, "\n");

  return newText.substring(0, 20000);
};

function extractFirstSolanaAddress(text: string): string | null {
  // Rough base58 heuristic: 32-44 chars from the Base58 alphabet
  const match = text.match(/\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/);
  return match ? match[0] : null;
}

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

  // Get OpenSVM RPC endpoints
  const rpcEndpoints = getRpcEndpoints();
  const rpcHeaders = getRpcHeaders('');
  
  // Use the first available OpenSVM RPC endpoint or fallback to environment variable
  const rpcUrl = rpcEndpoints.length > 0 ? rpcEndpoints[0] : (process.env.RPC_URL || "https://api.mainnet-beta.solana.com");
  const conn = new Connection(rpcUrl, { 
    httpHeaders: rpcHeaders 
  });

  let { question, sources } = await request.json();
  const qLower = String(question || "").toLowerCase();

  // Server-side fast-paths: call RPC directly and return numeric/structured results
  try {
    // 1) Network TPS / load
    if (qLower.includes("tps") || qLower.includes("transactions per second") || qLower.includes("network load")) {
      const samples = await conn.getRecentPerformanceSamples(20);
      const valid = (samples || []).filter(s => s && typeof (s as any).numTransactions === "number" && (s as any).samplePeriodSecs > 0);
      if (valid.length === 0) {
        return new Response("Unable to retrieve recent performance samples.", { status: 200, headers: { "Content-Type": "text/plain" } });
      }

      const avgTps = Math.round(
        valid.reduce((acc, s: any) => acc + (s.numTransactions / s.samplePeriodSecs), 0) / valid.length
      );

      const maxTps = Math.round(Math.max(...valid.map((s: any) => s.numTransactions / s.samplePeriodSecs)));
      // Simple network load heuristic against a theoretical max TPS
      const THEORETICAL_MAX_TPS = 3000;
      const loadPercent = Math.round((avgTps / THEORETICAL_MAX_TPS) * 100 * 100) / 100; // 2 decimals

      const reply = `Current network performance:
- Average TPS (recent samples): ${avgTps}
- Peak TPS (sampled): ${maxTps}
- Network load (approx): ${loadPercent}% (based on theoretical ${THEORETICAL_MAX_TPS} TPS)`;

      return new Response(reply, { status: 200, headers: { "Content-Type": "text/plain" } });
    }

    // 2) Block height & epoch
    if (qLower.includes("block height") || qLower.includes("epoch")) {
      const [blockHeight, epochInfo] = await Promise.all([conn.getBlockHeight(), conn.getEpochInfo()]);
      const reply = `Current chain info:
- Block height: ${blockHeight}
- Epoch: ${epochInfo.epoch}
- Slot index: ${epochInfo.slotIndex ?? "N/A"}
- Absolute slot: ${epochInfo.absoluteSlot ?? "N/A"}`;

      return new Response(reply, { status: 200, headers: { "Content-Type": "text/plain" } });
    }

    // 3) Wallet balance (if an address is present)
    if (qLower.includes("balance") || qLower.includes("wallet balance") || qLower.includes("balance of")) {
      const addr = extractFirstSolanaAddress(String(question || ""));
      if (addr) {
        try {
          const bal = await conn.getBalance(new PublicKey(addr));
          const sol = bal / 1_000_000_000;
          const reply = `Balance for ${addr}:\n- Lamports: ${bal}\n- SOL: ${sol}`;
          return new Response(reply, { status: 200, headers: { "Content-Type": "text/plain" } });
        } catch (e) {
          return new Response(`Failed to fetch balance for ${addr}: ${(e as Error).message}`, { status: 200, headers: { "Content-Type": "text/plain" } });
        }
      }
      // If no address provided, fallthrough to LLM guidance
    }

    // 4) Account analysis (if an address is present in queries like "check on", "analyze", "account info")
    const addr = extractFirstSolanaAddress(String(question || ""));
    if (addr && (qLower.includes("check") || qLower.includes("analyze") || qLower.includes("account") || qLower.includes("info") || qLower.includes("details"))) {
      try {
        const [accountInfo, balance] = await Promise.all([
          conn.getAccountInfo(new PublicKey(addr)),
          conn.getBalance(new PublicKey(addr))
        ]);

        if (!accountInfo) {
          return new Response(`Account ${addr} does not exist or has no data.`, { 
            status: 200, 
            headers: { "Content-Type": "text/plain" } 
          });
        }

        const sol = balance / 1_000_000_000;
        const reply = `Account Analysis for ${addr}:

**Balance:**
- SOL: ${sol}
- Lamports: ${balance}

**Account Details:**
- Owner: ${accountInfo.owner.toString()}
- Data Length: ${accountInfo.data.length} bytes
- Executable: ${accountInfo.executable ? 'Yes' : 'No'}
- Rent Epoch: ${accountInfo.rentEpoch}

**Account Type:**
${accountInfo.executable ? '🔧 This is an executable program account' : 
  accountInfo.data.length > 0 ? '📄 This is a data account (may contain tokens, NFTs, or program state)' : 
  '💰 This is a simple wallet account'}`;

        return new Response(reply, { status: 200, headers: { "Content-Type": "text/plain" } });
      } catch (e) {
        return new Response(`Failed to analyze account ${addr}: ${(e as Error).message}`, { 
          status: 200, 
          headers: { "Content-Type": "text/plain" } 
        });
      }
    }
  } catch (e) {
    console.error("Server-side RPC check failed:", e);
    // Fallthrough to LLM fallback below so the user still receives an answer
  }

  // Fallback: use LLM (Together) to craft an answer (previous behavior)
  const together = new Together({
    apiKey: process.env.TOGETHER_API_KEY,
  });

  const mainAnswerPrompt = `You are an expert Solana blockchain analyst with comprehensive knowledge of the Solana ecosystem and RPC APIs. Given a user question and some context, please write a clean, concise and accurate answer to the question based on the context. You will be given a set of related contexts to the question, each starting with a reference number like [[citation:x]], where x is a number. Please use the context when crafting your answer.

Your answer must be correct, accurate and written by an expert using an unbiased and professional tone. Please limit to 1024 tokens. Do not give any information that is not related to the question, and do not repeat. Say "information is missing on" followed by the related topic, if the given context do not provide sufficient information.

${SOLANA_RPC_KNOWLEDGE}

Remember, don't blindly repeat the contexts verbatim and don't tell the user how you used the citations – just respond with the answer. It is very important for my career that you follow these instructions. Do not generate plan objects in your response. Here is the user question:`;

  try {
    // Use non-streaming response for better control over post-processing
    console.log("[getAnswer] Fetching non-stream answer from Together API");

    let answer = await together.chat.completions.create({
      model: "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
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
