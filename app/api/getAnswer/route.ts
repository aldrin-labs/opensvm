
import Together from "together-ai";
import { GenerativeCapability } from "../../../lib/ai/capabilities/generative";
import { Connection, PublicKey } from "@solana/web3.js";
import getConnection from "../../../lib/solana-connection-server";

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

## Websocket Methods

### accountSubscribe

Subscribe to an account to receive notifications when the lamports or data for a given account public key changes.

Example request:
\`\`\`jsonc
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "accountSubscribe",
  "params": [
    "CM78CPUeXjn8o3yroDHxUtKsZZgoy4GPkPPXfouKNH12",
    {
      "encoding": "jsonParsed",
      "commitment": "finalized"
    }
  ]
}
\`\`\`
- Param 0: Account Pubkey (string, required)
- Param 1: Config object (encoding, commitment)

Result: Subscription id (number)

Notification format matches \`getAccountInfo\` RPC HTTP method.

### accountUnsubscribe

Unsubscribe from account change notifications.

Example request:
\`\`\`jsonc
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "accountUnsubscribe",
  "params": [0]
}
\`\`\`
- Param 0: Subscription id (number, required)

Result: boolean (unsubscribe success)

### blockSubscribe

Subscribe to receive notification anytime a new block is \`confirmed\` or \`finalized\`.

Example request:
\`\`\`jsonc
{
  "jsonrpc": "2.0",
  "id": "1",
  "method": "blockSubscribe",
  "params": [
    { "mentionsAccountOrProgram": "<pubkey>" },
    {
      "commitment": "confirmed",
      "encoding": "base64",
      "transactionDetails": "full",
      "maxSupportedTransactionVersion": 0,
      "showRewards": true
    }
  ]
}
\`\`\`
- Param 0: filter criteria (string | object, required)
- Param 1: Config object

Result: subscription id (integer)

Notification format: see \`getBlock\` RPC HTTP method.

### blockUnsubscribe

Unsubscribe from block notifications.

Example request:
\`\`\`jsonc
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "blockUnsubscribe",
  "params": [0]
}
\`\`\`
- Param 0: subscription id (integer, required)

Result: boolean

### logsSubscribe

Subscribe to transaction logging.

Example request:
\`\`\`jsonc
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "logsSubscribe",
  "params": [
    { "mentions": ["<pubkey>"] },
    { "commitment": "finalized" }
  ]
}
\`\`\`
- Param 0: filter criteria (string | object, required)
- Param 1: Config object

Result: subscription id (integer)

Notification includes: signature, err, logs.

### logsUnsubscribe

Unsubscribe from transaction logging.

Example request:
\`\`\`jsonc
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "logsUnsubscribe",
  "params": [0]
}
\`\`\`
- Param 0: subscription id (integer, required)

Result: boolean

### programSubscribe

Subscribe to a program to receive notifications when the lamports or data for an account owned by the given program changes.

Example request:
\`\`\`jsonc
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "programSubscribe",
  "params": [
    "<program_id>",
    {
      "encoding": "base64",
      "filters": [{ "dataSize": 80 }]
    }
  ]
}
\`\`\`
- Param 0: program_id (string, required)
- Param 1: Config object

Result: subscription id (integer)

Notification format matches \`getProgramAccounts\` RPC HTTP method.

### programUnsubscribe

Unsubscribe from program-owned account change notifications.

Example request:
\`\`\`jsonc
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "programUnsubscribe",
  "params": [0]
}
\`\`\`
- Param 0: subscription id (number, required)

Result: boolean

### rootSubscribe

Subscribe to receive notification anytime a new root is set by the validator.

Example request:
\`\`\`jsonc
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "rootSubscribe"
}
\`\`\`

Result: subscription id (integer)

Notification: latest root slot number.

### rootUnsubscribe

Unsubscribe from root notifications.

Example request:
\`\`\`jsonc
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "rootUnsubscribe",
  "params": [0]
}
\`\`\`
- Param 0: subscription id (integer, required)

Result: boolean

### signatureSubscribe

Subscribe to receive a notification when the transaction with the given signature reaches the specified commitment level.

Example request:
\`\`\`jsonc
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "signatureSubscribe",
  "params": [
    "<signature>",
    {
      "commitment": "finalized",
      "enableReceivedNotification": false
    }
  ]
}
\`\`\`
- Param 0: signature (string, required)
- Param 1: Config object

Result: subscription id (integer)

Notification: slot, value (err or "receivedSignature").

### signatureUnsubscribe

Unsubscribe from signature confirmation notification.

Example request:
\`\`\`jsonc
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "signatureUnsubscribe",
  "params": [0]
}
\`\`\`
- Param 0: subscription id (number, required)

Result: boolean

### slotSubscribe

Subscribe to receive notification anytime a slot is processed by the validator.

Example request:
\`\`\`jsonc
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "slotSubscribe"
}
\`\`\`

Result: subscription id (integer)

Notification: parent, root, slot.

### slotUnsubscribe

Unsubscribe from slot notifications.

Example request:
\`\`\`jsonc
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "slotUnsubscribe",
  "params": [0]
}
\`\`\`
- Param 0: subscription id (integer, required)

Result: boolean

### slotsUpdatesSubscribe

Subscribe to receive a notification from the validator on a variety of updates on every slot.

Example request:
\`\`\`jsonc
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "slotsUpdatesSubscribe"
}
\`\`\`

Result: subscription id (integer)

Notification: err, parent, slot, stats, timestamp, type.

### slotsUpdatesUnsubscribe

Unsubscribe from slot-update notifications.

Example request:
\`\`\`jsonc
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "slotsUpdatesUnsubscribe",
  "params": [0]
}
\`\`\`
- Param 0: subscription id (integer, required)

Result: boolean

### voteSubscribe

Subscribe to receive notification anytime a new vote is observed in gossip.

Example request:
\`\`\`jsonc
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "voteSubscribe"
}
\`\`\`

Result: subscription id (integer)

Notification: hash, slots, timestamp, signature, votePubkey.

### voteUnsubscribe

Unsubscribe from vote notifications.

Example request:
\`\`\`jsonc
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "voteUnsubscribe",
  "params": [0]
}
\`\`\`
- Param 0: subscription id (integer, required)

Result: boolean

## See HTTP Methods for full details on each RPC call.

... (rest of the HTTP methods and details omitted for brevity) ...
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

  const conn = getConnection();

  let { question, sources } = await request.json();
  const qLower = String(question || "").toLowerCase();

  // Dynamic Plan Execution System
  // First, get an AI plan for what RPC methods to call
  async function getExecutionPlan(query: string): Promise<{ methods: string[], parameters: any[] }> {
    const planningPrompt = `Given this Solana blockchain query: '${query}'

Analyze what specific RPC methods need to be called to answer this question. Return ONLY a JSON object in this exact format:
{
  "methods": ["method1", "method2"],
  "parameters": [{"param1": "value1"}, {"param2": "value2"}]
}

CRITICAL RULES:
- For getBlocks: startSlot and endSlot must be actual slot numbers (integers), NOT strings like "latest-10" 
- For getBlock: slot must be an actual slot number (integer), NOT strings like "latest"
- For queries asking for "last X transactions", plan this sequence: ["getSlot"] first, then use that result to calculate proper slot ranges
- Never use string values like "latest", "current", "recent" for slot parameters

Available RPC methods:
- getRecentBlockhash: Get recent blockhash
- getBlocks: Get blocks in slot range (needs startSlot, endSlot as integers)  
- getBlock: Get block details (needs slot as integer)
- getTransaction: Get transaction details (needs signature)
- getAccountInfo: Get account info (needs publicKey)
- getBalance: Get account balance (needs publicKey)
- getSlot: Get current slot (returns integer)
- getEpochInfo: Get current epoch info
- getBlockHeight: Get current block height
- getRecentPerformanceSamples: Get TPS data
- getSignaturesForAddress: Get transaction signatures for address (needs address, limit)

For transaction queries like "last 10 transactions", use this pattern: 
1. First call getSlot to get current slot number
2. Then execute dependent calls with calculated slot ranges

Example for "last 10 txs": {"methods": ["getSlot"], "parameters": [{}]}
The execution will handle the sequential dependency.

Return JSON only no explanation.`;

    try {
      const together = new Together({ apiKey: process.env.TOGETHER_API_KEY });
      const response = await together.chat.completions.create({
        model: "moonshotai/Kimi-K2-Instruct-0905",
        messages: [
          { role: "system", content: "You are a Solana RPC planning assistant. Output ONLY valid JSON matching the required schema. Never use string placeholders for numeric slot parameters." },
          { role: "user", content: planningPrompt }
        ],
        max_tokens: 22000,
        temperature: 0,
        top_p: 0.9,
        response_format: { type: "json_object" } // Safeguards JSON-only output (ignored if unsupported)
      });

      const content = response.choices[0]?.message?.content?.trim();
      if (!content) return { methods: [], parameters: [] };

      // Extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return { methods: [], parameters: [] };

      const plan = JSON.parse(jsonMatch[0]);
      return {
        methods: Array.isArray(plan.methods) ? plan.methods : [],
        parameters: Array.isArray(plan.parameters) ? plan.parameters : []
      };
    } catch (error) {
      console.error('Plan generation error:', error);
      return { methods: [], parameters: [] };
    }
  }

  // Execute RPC methods based on the plan with smart sequential handling
  async function executePlan(plan: { methods: string[], parameters: any[] }, query: string): Promise<string> {
    const results: any[] = [];
    let currentSlot: number | null = null;

    // Check if this is a transaction query that needs sequential slot-based execution
    const isTransactionQuery = query.toLowerCase().includes('transaction') ||
      query.toLowerCase().includes('txs') ||
      query.toLowerCase().includes('last') ||
      query.toLowerCase().includes('recent');

    for (let i = 0; i < plan.methods.length; i++) {
      const method = plan.methods[i];
      let params = plan.parameters[i] || {};

      try {
        let result;
        switch (method) {
          case 'getRecentBlockhash':
            result = await conn.getRecentBlockhash();
            break;
          case 'getSlot':
            result = await conn.getSlot();
            currentSlot = result; // Store for dependent calls
            break;
          case 'getEpochInfo':
            result = await conn.getEpochInfo();
            break;
          case 'getBlockHeight':
            result = await conn.getBlockHeight();
            break;
          case 'getRecentPerformanceSamples':
            result = await conn.getRecentPerformanceSamples(params.limit || 20);
            break;
          case 'getBlocks':
            // Smart parameter handling for transaction queries
            if (isTransactionQuery && currentSlot && (!params.startSlot || !params.endSlot)) {
              // Auto-calculate recent block range
              const blocksToFetch = 50; // Get last 50 blocks to find transactions
              params = {
                startSlot: Math.max(0, currentSlot - blocksToFetch),
                endSlot: currentSlot
              };
            }
            if (params.startSlot !== undefined && params.endSlot !== undefined) {
              result = await conn.getBlocks(params.startSlot, params.endSlot);
            }
            break;
          case 'getBlock':
            // Smart parameter handling for transaction queries
            if (isTransactionQuery && currentSlot && !params.slot) {
              params = { slot: currentSlot };
            }
            if (params.slot !== undefined) {
              result = await conn.getBlock(params.slot, {
                commitment: 'confirmed',
                maxSupportedTransactionVersion: 0,
                transactionDetails: 'full'
              });
            }
            break;
          case 'getTransaction':
            if (params.signature) {
              result = await conn.getTransaction(params.signature, {
                commitment: 'confirmed',
                maxSupportedTransactionVersion: 0
              });
            }
            break;
          case 'getAccountInfo':
            if (params.publicKey) {
              result = await conn.getAccountInfo(new PublicKey(params.publicKey));
            }
            break;
          case 'getBalance':
            if (params.publicKey) {
              result = await conn.getBalance(new PublicKey(params.publicKey));
            }
            break;
          case 'getSignaturesForAddress':
            if (params.address) {
              result = await conn.getSignaturesForAddress(
                new PublicKey(params.address),
                { limit: params.limit || 1000 }
              );
            }
            break;
          default:
            result = { error: `Unknown method: ${method}` };
        }

        results.push({ method, params, result });

        // If this is a transaction query and we just got blocks, auto-fetch recent block details
        if (isTransactionQuery && method === 'getBlocks' && Array.isArray(result) && result.length > 0) {
          // Get the last few blocks with transaction details
          const recentSlots = result.slice(-10) as number[]; // Last 10 slots with blocks
          for (const slot of recentSlots) {
            try {
              const blockResult = await conn.getBlock(slot, {
                commitment: 'confirmed',
                maxSupportedTransactionVersion: 0,
                transactionDetails: 'full'
              });
              if (blockResult && blockResult.transactions && blockResult.transactions.length > 0) {
                results.push({
                  method: 'getBlock',
                  params: { slot },
                  result: blockResult,
                  auto_fetched: true
                });
              }
            } catch (blockError) {
              // Skip blocks that can't be fetched
            }
          }
        }
      } catch (error) {
        results.push({ method, params, error: (error as Error).message });
      }
    }

    return JSON.stringify(results, null, 2);
  }

  // Try dynamic plan execution for complex queries
  if (qLower.includes('transaction') || qLower.includes('txs') ||
    qLower.includes('recent') || qLower.includes('latest') ||
    qLower.includes('last') || qLower.includes('show')) {

    try {
      const plan = await getExecutionPlan(question);
      if (plan.methods.length > 0) {
        const results = await executePlan(plan, question);

        // Now pass the raw results to LLM for human-readable response
        // Create a summarized version of results for LLM analysis
        const summarizeResults = (rawResults: string): string => {
          try {
            const parsed = JSON.parse(rawResults);
            const summary: any[] = [];

            parsed.forEach((item: any) => {
              const summarizedItem: any = {
                method: item.method,
                params: item.params
              };

              if (item.error) {
                summarizedItem.error = item.error;
              } else if (item.result) {
                if (item.method === 'getSlot') {
                  summarizedItem.result = item.result;
                } else if (item.method === 'getBlocks') {
                  summarizedItem.result = {
                    count: Array.isArray(item.result) ? item.result.length : 0,
                    slots: Array.isArray(item.result) ? item.result.slice(0, 10) : []
                  };
                } else if (item.method === 'getBlock') {
                  const block = item.result;
                  summarizedItem.result = {
                    slot: block?.slot || item.params?.slot,
                    blockHeight: block?.blockHeight,
                    blockTime: block?.blockTime,
                    transactionCount: block?.transactions ? block.transactions.length : 0,
                    transactions: block?.transactions ?
                      block.transactions.slice(0, 20).map((tx: any) => {
                        // Handle different transaction formats
                        if (typeof tx === 'string') {
                          return { signature: tx };
                        } else if (tx && typeof tx === 'object') {
                          return {
                            signature: tx.signature || tx.transaction?.signatures?.[0] || 'unknown',
                            fee: tx.meta?.fee,
                            success: tx.meta?.err === null,
                            accounts: tx.transaction?.message?.accountKeys?.length || 0,
                            instructions: tx.transaction?.message?.instructions?.length || 0
                          };
                        }
                        return { signature: 'unknown' };
                      }) : []
                  };
                } else if (item.method === 'getEpochInfo') {
                  summarizedItem.result = {
                    epoch: item.result.epoch,
                    absoluteSlot: item.result.absoluteSlot,
                    blockHeight: item.result.blockHeight
                  };
                } else if (Array.isArray(item.result)) {
                  summarizedItem.result = {
                    count: item.result.length,
                    sample: item.result.slice(0, 3)
                  };
                } else {
                  summarizedItem.result = typeof item.result === 'object'
                    ? JSON.stringify(item.result).slice(0, 20000) + '...'
                    : item.result;
                }
              }

              summary.push(summarizedItem);
            });

            return JSON.stringify(summary, null, 2);
          } catch (e) {
            return rawResults.slice(0, 200000) + '...';
          }
        };

        const summarizedResults = summarizeResults(results);

        const analysisPrompt = `The user asked: "${question}"

I executed Solana RPC methods and got this summarized data:

${summarizedResults}

Task: Analyze this blockchain data and provide a clear, direct answer to the user's question.

Required format:
- Start with a direct answer to their question
- Extract transaction signatures if they asked for transactions  
- Count transactions accurately if they asked "how many"
- Explain any errors in simple terms
- Be specific and factual, no speculation

IMPORTANT: Provide a complete response. Don't stop mid-sentence.`;

        try {
          console.log('Attempting LLM analysis...');
          const together = new Together({ apiKey: process.env.TOGETHER_API_KEY });
          const response = await together.chat.completions.create({
            model: "moonshotai/Kimi-K2-Instruct-0905",
            messages: [
              { role: "system", content: "You are a Solana blockchain data analyst. Always provide complete, human-readable responses. Never stop mid-sentence." },
              { role: "user", content: analysisPrompt }
            ],
            max_tokens: 120000,
            temperature: 0.1,
            top_p: 0.9
          });

          const finalResponse = response.choices[0]?.message?.content?.trim();
          console.log('LLM response length:', finalResponse ? finalResponse.length : 0);
          console.log('LLM response preview:', finalResponse ? finalResponse.substring(0, 100) + '...' : 'no response');

          if (finalResponse && finalResponse.length > 10) {
            return new Response(finalResponse, {
              status: 200,
              headers: { "Content-Type": "text/plain" }
            });
          } else {
            console.log('LLM response too short or empty, falling back');
          }
        } catch (llmError) {
          console.error('LLM analysis error:', llmError);
          // Fallback to raw formatted results if LLM fails
        }

        // Fallback: Format the results manually if LLM processing fails
        const parsed = JSON.parse(results);
        let formattedResponse = `Query: ${question}\n\nExecution Results:\n\n`;

        parsed.forEach((item: any, index: number) => {
          formattedResponse += `${index + 1}. ${item.method}\n`;
          if (item.error) {
            formattedResponse += `   Error: ${item.error}\n`;
          } else if (item.result) {
            if (Array.isArray(item.result)) {
              formattedResponse += `   Found ${item.result.length} items\n`;
              if (item.method === 'getBlocks') {
                formattedResponse += `   Slots: ${item.result.slice(0, 5).join(', ')}${item.result.length > 5 ? '...' : ''}\n`;
              } else if (item.method === 'getSignaturesForAddress') {
                formattedResponse += `   Signatures: ${item.result.slice(0, 3).map((s: any) => s.signature.slice(0, 20) + '...').join(', ')}\n`;
              }
            } else if (typeof item.result === 'object') {
              if (item.method === 'getEpochInfo') {
                formattedResponse += `   Epoch: ${item.result.epoch}, Slot: ${item.result.absoluteSlot}\n`;
              } else if (item.method === 'getRecentBlockhash') {
                formattedResponse += `   Blockhash: ${item.result.blockhash.slice(0, 20)}...\n`;
              } else {
                formattedResponse += `   Data: ${JSON.stringify(item.result).slice(0, 100)}...\n`;
              }
            } else {
              formattedResponse += `   Result: ${item.result}\n`;
            }
          }
          formattedResponse += '\n';
        });

        return new Response(formattedResponse, {
          status: 200,
          headers: { "Content-Type": "text/plain" }
        });
      }
    } catch (error) {
      console.error('Dynamic execution error:', error);
      // Fall through to existing hardcoded checks
    }
  }

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

    // 3) Recent transactions / latest transactions
    if (qLower.includes("recent transactions") || qLower.includes("latest transactions") ||
      qLower.includes("last") && (qLower.includes("transactions") || qLower.includes("txs")) ||
      qLower.includes("show") && (qLower.includes("transactions") || qLower.includes("txs"))) {

      try {
        // Get the current slot to fetch recent blocks
        const currentSlot = await conn.getSlot();
        const blocksToCheck = 3; // Check last 3 blocks for transactions
        const startSlot = Math.max(0, currentSlot - blocksToCheck);

        // Get block slots in the range
        const slots = await conn.getBlocks(startSlot, currentSlot);
        const recentSlots = slots.slice(-blocksToCheck);

        let allTransactions: Array<{ signature: string, slot: number, blockTime: number | null }> = [];

        // Fetch transactions from recent blocks
        for (const slot of recentSlots) {
          try {
            const block = await conn.getBlock(slot, {
              commitment: 'confirmed',
              maxSupportedTransactionVersion: 0,
              transactionDetails: 'signatures'
            });

            if (block && (block as any).signatures) {
              const blockTxs = (block as any).signatures.slice(0, 20).map((sig: string) => ({
                signature: sig,
                slot: slot,
                blockTime: block.blockTime
              }));
              allTransactions.push(...blockTxs);
            }        // Sort by slot (most recent first) and take the requested number
            allTransactions.sort((a, b) => b.slot - a.slot);
            const limit = qLower.includes("10") ? 10 : qLower.includes("5") ? 5 : 15;
            const recentTxs = allTransactions.slice(0, limit);

            if (recentTxs.length === 0) {
              return new Response("No recent transactions found in the last few blocks.", {
                status: 200,
                headers: { "Content-Type": "text/plain" }
              });
            }

            const reply = `Recent Transactions (Last ${recentTxs.length}):

${recentTxs.map((tx, i) => {
              const timeStr = tx.blockTime ? new Date(tx.blockTime * 1000).toISOString().replace('T', ' ').slice(0, 19) + ' UTC' : 'Unknown time';
              return `${i + 1}. ${tx.signature}
   Slot: ${tx.slot} | Time: ${timeStr}`;
            }).join('\n\n')}

💡 These are actual transaction signatures from recent blocks on Solana mainnet.
   You can explore them further on osvm.ai.`;

            return new Response(reply, { status: 200, headers: { "Content-Type": "text/plain" } });

          } catch (error) {
            console.error('Error fetching recent transactions:', error);
            return new Response(`Error fetching recent transactions: ${(error as Error).message}`, {
              status: 200,
              headers: { "Content-Type": "text/plain" }
            });
          }
        }

        // 4) Wallet balance (if an address is present)
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
  } catch (error) {
    console.error('Server error:', error);
    return new Response("Internal server error", { status: 500 });
  }
}
