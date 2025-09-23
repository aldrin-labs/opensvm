import { Tool, ToolContext, ToolResult } from "./types";
import Together from "together-ai";

interface AIPlanStep {
    tool: string;
    reason: string;
    narrative: string;
    input?: string | any;
}

export const aiPlanExecutionTool: Tool = {
    name: "aiPlanExecution",
    description: "AI-powered dynamic tool selection and execution",

    canHandle: (context: ToolContext): boolean => {
        const { qLower, question } = context;

        // Skip for simple greetings
        if (/^(hi|hello|hey|yo|gm|hi there|ok|yes|no|thanks|thank you)$/i.test(question.trim())) {
            return false;
        }

        // Handle all analytical queries
        return qLower.includes("price") || qLower.includes("market") || qLower.includes("volume") ||
            qLower.includes("token") || qLower.includes("memecoin") || qLower.includes("validator") ||
            qLower.includes("account") || qLower.includes("balance") || qLower.includes("transaction") ||
            qLower.includes("epoch") || qLower.includes("network") || qLower.includes("analysis") ||
            /\$[A-Z0-9]{3,10}/.test(question) || // Detect token symbols
            /[1-9A-HJ-NP-Za-km-z]{32,44}/.test(question); // Detect addresses
    },

    execute: async (context: ToolContext): Promise<ToolResult> => {
        const { conn, question } = context;

        try {
            console.log('◈ Generating AI-powered plan with review loop...');

            // Up to 3 cycles: plan -> execute -> review -> (maybe) replan
            const maxIterations = 3;
            let iteration = 0;
            let planningContext: string | undefined = undefined;
            let lastPlan: AIPlanStep[] = [];
            let accumulatedResults: Record<string, any> = {};

            while (iteration < maxIterations) {
                // Safety: check remaining time budget roughly via Date.now() (route has 120s limit)
                // If time is tight, break and synthesize best-effort answer
                // (We rely on route timeout protection; just avoid extra cycles if we're already in late iterations)

                // 1) Generate plan
                const plan = await generateAIPoweredPlan(question, planningContext);
                lastPlan = plan;
                console.log('◆ AI-generated plan:', plan.map(p => ({ tool: p.tool, input: p.input })));

                // 2) Execute plan
                const iterationResults = await executePlan(plan, conn);

                // Merge results into accumulatedResults (dedupe by key)
                for (const [k, v] of Object.entries(iterationResults)) {
                    if (accumulatedResults[k] == null) {
                        accumulatedResults[k] = v;
                    }
                }

                // 3) If we don't have an API key for review LLM, break after first pass
                if (!process.env.TOGETHER_API_KEY) {
                    console.warn('No AI API key - skipping review loop');
                    break;
                }

                // 4) Summarize for review and call review LLM
                const summary = summarizeForReview(accumulatedResults);
                const review = await reviewAnswerLLM(question, summary);

                // Guard against invalid responses
                const approved = !!review?.approved;
                console.log(`◇ Review LLM approval: ${approved ? 'APPROVED' : 'REQUIRES MORE'}`);

                if (approved) {
                    break;
                }

                // Prepare planning context for next iteration using missing/additional steps
                const missingList = Array.isArray(review?.missing) ? review.missing : [];
                const additionalSteps = Array.isArray(review?.additional_steps) ? review.additional_steps : [];
                planningContext = `The previous result was missing: ${missingList.join(', ')}. Consider these additional steps: ${JSON.stringify(additionalSteps)}`;

                iteration++;
            }

            // 5) Synthesize final text answer (deterministic header + narrative)
            const finalAnswer = await synthesizeResults(context, lastPlan, accumulatedResults);

            console.log('▪ Final answer length:', finalAnswer.length);

            return {
                handled: true,
                response: new Response(finalAnswer, {
                    status: 200,
                    headers: {
                        "Content-Type": "text/plain; charset=utf-8",
                        "Cache-Control": "no-cache",
                    }
                })
            };

        } catch (error) {
            console.error('⚡ AI plan execution error:', error);
            return {
                handled: false
            };
        }
    }
};

async function generateAIPoweredPlan(question: string, planningContext?: string): Promise<AIPlanStep[]> {
    try {
        if (!process.env.TOGETHER_API_KEY) {
            console.warn('No AI API key - falling back to basic plan');
            return generateBasicFallbackPlan(question);
        }

        const together = new Together({
            apiKey: process.env.TOGETHER_API_KEY,
        });

        const availableTools = `
Available Tools:
1. tokenMarketData - Get cryptocurrency token price, market cap, and volume from CoinGecko (requires coinId parameter)
2. getEpochInfo - Get current Solana network epoch information  
3. getVoteAccounts - Get Solana validators and voting information
4. getAccountInfo - Get Solana account details (requires address)
5. getBalance - Get SOL balance for an address (requires address) 
6. getRecentPerformanceSamples - Get network performance metrics
7. getSlot - Get current slot number
8. getBlockHeight - Get current block height
9. getClusterNodes - Get network cluster node information
10. getSignaturesForAddress - Get transaction signatures for address (requires address)
11. getTokenSupply - Get token supply information (requires mint address)
12. getTokenLargestAccounts - Get largest token holders (requires mint address)

Token Symbol Mappings (for tokenMarketData tool):
- SVMAI -> opensvm
- SOL -> solana  
- BONK -> bonk
- WIF -> dogwifcoin
- PEPE -> pepe
- CHAN -> memechan
- PIX404 -> pix404
- RAY -> raydium
- ORCA -> orca
- JUP -> jupiter
- JITO -> jito
- PYTH -> pyth-network
- MNDE -> marinade
- MNGO -> mango-markets
- SAMO -> samoyedcoin
- JTO -> jito-governance-token
- UXD -> uxd-stablecoin
- For unknown tokens, use lowercase symbol
`;

        const planningPrompt = `You are an intelligent blockchain analyst. Analyze the user's question and create a JSON plan for which tools to use.

User Question: "${question}"

Additional planning context from previous review (if any):
${planningContext || "N/A"}

${availableTools}

Hard rules for planning:
1) If the user asks about "price", "market cap", or "volume", or uses $SYMBOL notation, you MUST include "tokenMarketData" as the FIRST step for each detected token.
2) Use the provided symbol→CoinGecko ID mapping where available (e.g., SVMAI → opensvm-com). If a token is not in the mapping, pass the lowercase symbol as coinId (the executor will resolve via CoinGecko search if needed).
3) If multiple tokens are requested, include one tokenMarketData step per token (deduplicated). Keep tokenMarketData steps first, then any extra RPC steps if the user also asked for them.
4) Do NOT use getEpochInfo, getSlot, or other network tools to answer price/market/volume unless explicitly required in addition to market data.
5) Return ONLY a JSON array of tool steps, no extra text.

Response format (JSON only):
[
  {
    "tool": "toolName",
    "reason": "why this tool is needed",
    "narrative": "engaging description",
    "input": "parameter if needed"
  }
]

Examples:
- For "$SVMAI price":
  [
    { "tool": "tokenMarketData", "reason": "Get market data for SVMAI", "narrative": "⟨ ⟩ Fetching price for SVMAI", "input": "opensvm-com" }
  ]

- For "compare $SVMAI and $BONK market caps":
  [
    { "tool": "tokenMarketData", "reason": "SVMAI market data", "narrative": "⟨ ⟩ Fetching SVMAI", "input": "opensvm-com" },
    { "tool": "tokenMarketData", "reason": "BONK market data", "narrative": "⟨ ⟩ Fetching BONK", "input": "bonk" }
  ]

- For "$SOL account balance of address X": do not use tokenMarketData; use account/balance tools instead.`;

        const response = await together.chat.completions.create({
            model: "openai/gpt-oss-120b",
            messages: [{ role: "user", content: planningPrompt }],
            max_tokens: 2000,
            temperature: 0.1
        });

        const aiResponse = response.choices[0]?.message?.content?.trim();
        if (!aiResponse) {
            throw new Error('Empty AI response');
        }

        // Parse the AI response as JSON
        const aiPlan = JSON.parse(aiResponse);

        if (!Array.isArray(aiPlan)) {
            throw new Error('AI response is not an array');
        }

        console.log('◈ AI generated plan:', aiPlan);

        return aiPlan;

    } catch (error) {
        console.warn('AI planning failed:', (error as Error).message);
        return generateBasicFallbackPlan(question);
    }
}

function generateBasicFallbackPlan(question: string): AIPlanStep[] {
    const qLower = question.toLowerCase();

    // Token detection fallback
    if (qLower.includes('price') || qLower.includes('market') || qLower.includes('volume') ||
        qLower.includes('token') || /\$[A-Z]{3,10}/.test(question)) {

        // Map of known tokens to CoinGecko IDs (unambiguous where possible)
        const tokenMappings: Record<string, string> = {
            'SVMAI': 'opensvm-com',
            'SOL': 'solana',
            'BONK': 'bonk',
            'WIF': 'dogwifcoin',
            'PEPE': 'pepe',
            'CHAN': 'chan-cat',
            'PIX404': 'pix404',
            // DeFi tokens
            'RAY': 'raydium',
            'ORCA': 'orca',
            'JUP': 'jupiter',
            'JITO': 'jito',
            'PYTH': 'pyth-network',
            'MNDE': 'marinade',
            'MNGO': 'mango-markets',
            'SAMO': 'samoyedcoin',
            'JTO': 'jito-governance-token',
            'UXD': 'uxd-stablecoin'
        };

        // Extract all $SYMBOL occurrences and de-duplicate
        const symbolMatches = [...question.toUpperCase().matchAll(/\$([A-Z0-9]{3,10})/g)].map(m => m[1]);
        const uniqueSymbols = Array.from(new Set(symbolMatches));

        if (uniqueSymbols.length > 0) {
            return uniqueSymbols.map(symbol => {
                const coinId = tokenMappings[symbol] || symbol.toLowerCase();
                return {
                    tool: 'tokenMarketData',
                    reason: `Get current market data for ${symbol} token from CoinGecko API`,
                    narrative: `▣ Getting market data for ${symbol}`,
                    input: coinId
                };
            });
        }

        // Fallback to single symbol detection (no explicit $SYMBOL found)
        const tokenMatch = question.match(/\$([A-Z0-9]{3,10})/i);
        const tokenSymbol = tokenMatch ? tokenMatch[1].toUpperCase() : 'UNKNOWN';
        const coinId = tokenMappings[tokenSymbol] || tokenSymbol.toLowerCase();

        return [{
            tool: 'tokenMarketData',
            reason: `Get current market data for ${tokenSymbol} token from CoinGecko API`,
            narrative: `▣ Getting market data for ${tokenSymbol}`,
            input: coinId
        }];
    }

    // Validator queries fallback
    if (qLower.includes('validator')) {
        return [{
            tool: 'getVoteAccounts',
            reason: 'Get current validator information and voting accounts',
            narrative: '◎ Retrieving validator data...'
        }];
    }

    // Default fallback
    return [{
        tool: 'getEpochInfo',
        reason: 'Get current network status as starting point for analysis',
        narrative: '◦ Establishing blockchain baseline...'
    }];
}

async function executePlan(plan: AIPlanStep[], conn: any): Promise<Record<string, any>> {
    const results: Record<string, any> = {};

    console.log('▶ Beginning AI plan execution...');

    for (const step of plan) {
        console.log(`\n${step.narrative}`);

        try {
            let result;

            // Handle tokenMarketData tool
            if (step.tool === 'tokenMarketData') {
                try {
                    const tokenTool = await import('./tokenMarketData');
                    result = await tokenTool.tokenMarketDataTool.execute({ coinId: step.input });
                    console.log(`   ◈ Token market data retrieved: ${result.success ? 'SUCCESS' : 'FAILED'}`);
                } catch (error) {
                    result = { error: `Token market data error: ${(error as Error).message}` };
                    console.log(`   ◌ Token market data failed`);
                }
            }
            // Handle standard RPC calls
            else if (typeof conn[step.tool] === 'function') {
                if (step.input) {
                    if (step.tool === 'getAccountInfo' || step.tool === 'getBalance' ||
                        step.tool === 'getTokenSupply' || step.tool === 'getTokenLargestAccounts') {
                        const { PublicKey } = await import('@solana/web3.js');
                        try {
                            const pubkey = new PublicKey(step.input);
                            result = await conn[step.tool](pubkey);
                        } catch (error) {
                            result = { error: `Invalid address: ${(error as Error).message}` };
                        }
                    } else {
                        result = await conn[step.tool](step.input);
                    }
                } else {
                    result = await conn[step.tool]();
                }
                console.log(`   ◉ ${step.reason}`);
            } else {
                // Fallback: if LLM returned a token id/symbol as a tool name (e.g., "jupiter"),
                // treat it as CoinGecko coinId and fetch via tokenMarketData.
                try {
                    const maybeCoinId = (typeof step.input === 'string' && step.input) ? step.input : step.tool;
                    // basic validation for coingecko id/symbol pattern
                    if (typeof maybeCoinId === 'string' && /^[a-z0-9-]{2,}$/.test(maybeCoinId)) {
                        const tokenTool = await import('./tokenMarketData');
                        result = await tokenTool.tokenMarketDataTool.execute({ coinId: maybeCoinId });
                        console.log(`   ◈ Token market data (fallback:${maybeCoinId}) retrieved: ${result.success ? 'SUCCESS' : 'FAILED'}`);
                    } else {
                        console.warn(`   ◭ Method ${step.tool} not available`);
                        result = { error: `Method ${step.tool} not available` };
                    }
                } catch (e) {
                    console.warn(`   ◭ Fallback tokenMarketData failed for '${step.tool}': ${(e as Error).message}`);
                    result = { error: `Method ${step.tool} not available` };
                }
            }

            const resultKey = typeof step.input === 'string' && step.input
                ? `${step.tool}:${step.input}`
                : step.tool;
            results[resultKey] = result;

        } catch (error) {
            console.error(`   ⚡ Error in ${step.tool}:`, error);
            const resultKey = typeof step.input === 'string' && step.input
                ? `${step.tool}:${step.input}`
                : step.tool;
            results[resultKey] = { error: (error as Error).message };
        }
    }

    console.log('\n◆ AI plan execution complete! Results gathered:', Object.keys(results).length);
    return results;
}

/**
 * Build a compact summary of results for the review LLM (internal only).
 */
function summarizeForReview(results: Record<string, any>) {
    const summary: any = {
        tokenMarketData: [] as any[],
        otherSignals: [] as any[],
    };

    for (const [key, value] of Object.entries(results)) {
        if (key.startsWith('tokenMarketData') && value && value.success && value.data) {
            const d = value.data;
            summary.tokenMarketData.push({
                id: value.resolved_id || null,
                name: d.name,
                symbol: d.symbol,
                price_usd: Number(d.current_price?.usd ?? 0),
                market_cap_usd: Number(d.market_cap?.usd ?? 0),
                volume_24h_usd: Number(d.trading_volume?.h24 ?? d.trading_volume?.usd ?? 0),
                source: value.source || null,
                last_updated: d.last_updated || null,
            });
        } else if (value && !value.error) {
            // Keep this compact; only high-level signal that something was retrieved
            summary.otherSignals.push({ key, ok: true });
        } else {
            summary.otherSignals.push({ key, ok: false, error: value?.error || 'Failed' });
        }
    }

    return summary;
}

/**
 * Ask an LLM to review whether the current info answers the question.
 * Returns STRICT JSON: { approved: boolean, missing: string[], additional_steps: AIPlanStep[] }
 */
async function reviewAnswerLLM(question: string, summary: any) {
    try {
        if (!process.env.TOGETHER_API_KEY) {
            return { approved: true, missing: [], additional_steps: [] };
        }

        const together = new Together({
            apiKey: process.env.TOGETHER_API_KEY,
        });

        const reviewPrompt = `You are a meticulous reviewer. Determine if the provided information answers the user's question.

User Question:
${question}

Summary of current info (internal):
${JSON.stringify(summary, null, 2)}

Instructions:
- Decide if the current info directly answers the question.
- If not approved, list precisely what is missing in "missing".
- Propose minimal "additional_steps" as a JSON array of tool steps (same structure as planning steps).
- Return STRICT JSON ONLY in this exact format:
{
  "approved": true | false,
  "missing": string[],
  "additional_steps": [
    { "tool": "toolName", "reason": "string", "narrative": "string", "input": "string or omitted" }
  ]
}`;

        const response = await together.chat.completions.create({
            model: "openai/gpt-oss-120b",
            messages: [{ role: "user", content: reviewPrompt }],
            max_tokens: 1000,
            temperature: 0.1
        });

        const content = response.choices?.[0]?.message?.content?.trim() || "";
        const jsonStart = content.indexOf("{");
        const jsonEnd = content.lastIndexOf("}");
        const jsonText = jsonStart !== -1 && jsonEnd !== -1 ? content.slice(jsonStart, jsonEnd + 1) : content;

        return JSON.parse(jsonText);
    } catch (e) {
        console.warn('Review LLM failed, defaulting to approved:', (e as Error).message);
        return { approved: true, missing: [], additional_steps: [] };
    }
}

// Compression utility functions
function compressDataForLLM(dataContext: string): { compressed: string; aliasMap: Record<string, string> } {
    const aliasMap: Record<string, string> = {};
    let aliasCounter = 1;
    let compressed = dataContext;

    // Find all quoted strings longer than 20 characters
    const quotedStrings = dataContext.match(/"[^"]{20,}"/g) || [];

    // Create unique quoted strings set
    const uniqueQuotedStrings = [...new Set(quotedStrings)];

    // Create aliases only for Solana addresses and transaction signatures
    uniqueQuotedStrings.forEach(quotedString => {
        const originalString = quotedString.slice(1, -1); // Remove quotes

        // Only compress if it looks like a Solana address or transaction signature
        if (isSolanaAddressOrSignature(originalString)) {
            const alias = `alias-${aliasCounter}`;
            aliasMap[alias] = originalString;

            // Replace all occurrences of the quoted string with quoted alias
            compressed = compressed.replace(new RegExp(quotedString.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), `"${alias}"`);
            aliasCounter++;
        }
    });

    return { compressed, aliasMap };
}

function isSolanaAddressOrSignature(str: string): boolean {
    // Skip numeric values, percentages, and other non-address strings
    if (/^[\d.%]+$/.test(str)) return false; // Numbers and percentages
    if (/^[\d,]+$/.test(str)) return false; // Numbers with commas
    if (str.length < 32) return false; // Too short to be an address

    // Check if it looks like a Solana address (32-44 base58 characters)
    // or transaction signature (64+ base58 characters)
    const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;

    return base58Regex.test(str) && (
        (str.length >= 32 && str.length <= 44) || // Solana address
        str.length >= 64 // Transaction signature
    );
}

function decompressLLMResponse(response: string, aliasMap: Record<string, string>): string {
    let decompressed = response;

    // Replace aliases back to original strings (without quotes in the response)
    Object.entries(aliasMap).forEach(([alias, originalString]) => {
        // Handle different dash characters that LLM might use (regular dash, en-dash, em-dash, etc.)
        const aliasVariations = [
            alias,
            alias.replace(/-/g, '‑'), // en-dash
            alias.replace(/-/g, '—'), // em-dash
            alias.replace(/-/g, '−'), // minus sign
            alias.replace(/-/g, '–')  // en-dash variant
        ];

        aliasVariations.forEach(aliasVariation => {
            // Replace alias occurrences (not surrounded by quotes in response)
            const regex = new RegExp(aliasVariation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
            decompressed = decompressed.replace(regex, originalString);
        });
    });

    return decompressed;
}

async function synthesizeResults(
    context: ToolContext,
    plan: AIPlanStep[],
    results: Record<string, any>
): Promise<string> {
    const { question } = context;

    console.log('◈ Synthesizing AI-powered response...');

    // Build deterministic market-data header (for human readability and automated verification)
    function buildTokenHeader(results: Record<string, any>): string {
        let header = '';
        for (const [key, value] of Object.entries(results)) {
            if (key.startsWith('tokenMarketData') && value && value.success && value.data) {
                const d = value.data;
                const name = d.name || 'Unknown';
                const symbol = (d.symbol || '').toUpperCase();
                const price = Number(d.current_price?.usd ?? 0);
                const mcap = Number(d.market_cap?.usd ?? 0);
                const vol = Number(d.trading_volume?.usd ?? 0);

                header += `**${name} (${symbol}) Market Data:**\n`;
                header += `- Current Price: $${price}\n`;
                header += `- Market Cap: $${mcap.toLocaleString()}\n`;
                header += `- 24h Volume: $${vol.toLocaleString()}\n\n`;
            }
        }
        return header.trim();
    }
    const tokenHeader = buildTokenHeader(results);

    // Guardrail: deterministically format validator results to avoid any LLM hallucinations
    try {
        const voteRes = (results['getVoteAccounts'] as any) || undefined;
        const qLower = question.toLowerCase();
        if (voteRes && voteRes.current && qLower.includes('validator')) {
            const topMatch = question.match(/top\s+(\d{1,3})/i);
            const topN = Math.max(1, Math.min(50, topMatch ? Number(topMatch[1]) : 10));

            const sorted = [...voteRes.current].sort(
                (a: any, b: any) => Number(b.activatedStake ?? 0) - Number(a.activatedStake ?? 0)
            ).slice(0, topN);

            // Explicitly log that we're bypassing LLM and using on-chain data directly
            console.log('◊ Using deterministic validator formatter', {
                validators_total: Array.isArray(voteRes.current) ? voteRes.current.length : 0,
                topN
            });

            const toSol = (lamports: any) => {
                const n = Number(lamports ?? 0);
                return (n / 1_000_000_000).toFixed(0);
            };

            const formatNum = (n: any) => {
                const x = Number(n ?? 0);
                return x.toLocaleString();
            };

            let table = `## ◈ Top ${topN} Validators by Activated Stake\n\n`;
            table += `| # | Vote-account (node) | Activated Stake (SOL) | Commission % | Last Vote Slot | Latest Epoch Credits |\n`;
            table += `|---|---------------------|----------------------:|-------------:|---------------:|---------------------:|\n`;

            sorted.forEach((v: any, idx: number) => {
                const vote = String(v.votePubkey ?? '');
                const node = String(v.nodePubkey ?? '');
                const sol = formatNum(toSol(v.activatedStake));
                const comm = Number(v.commission ?? 0);
                const lastVote = formatNum(v.lastVote ?? 0);

                // epochCredits is array of [epoch, credits, prev_credits?]; take last tuple's credits
                let latestCredits = '-';
                if (Array.isArray(v.epochCredits) && v.epochCredits.length > 0) {
                    const lastTuple = v.epochCredits[v.epochCredits.length - 1];
                    if (Array.isArray(lastTuple) && lastTuple.length >= 2) {
                        latestCredits = formatNum(lastTuple[1]);
                    }
                }

                table += `| ${idx + 1} | **${vote}** (node ${node || '—'}) | **${sol}** | ${comm} | ${lastVote} | ${latestCredits} |\n`;
            });

            // Summary line using actual data only
            const totalActiveStake = (voteRes.current as any[]).reduce(
                (sum: number, v: any) => sum + Number(v.activatedStake ?? 0), 0
            );
            const topStake = sorted.reduce(
                (sum: number, v: any) => sum + Number(v.activatedStake ?? 0), 0
            );
            const pct = totalActiveStake > 0 ? ((topStake / totalActiveStake) * 100).toFixed(2) : '0.00';
            table += `\n- Total active validators: ${voteRes.current.length}\n`;
            table += `- Top ${topN} control ${pct}% of total stake\n`;
            table += `- Total network stake: ${(totalActiveStake / 1_000_000_000).toFixed(0).toLocaleString()} SOL\n`;

            // Append AI analysis while keeping the table deterministic and unchanged
            let analysis = '';
            if (process.env.TOGETHER_API_KEY) {
                try {
                    const together = new Together({
                        apiKey: process.env.TOGETHER_API_KEY,
                    });

                    // Provide the exact table to the LLM and strictly forbid modifying it.
                    // The LLM should only add commentary/insights below it, and never restate full addresses.
                    const analysisPrompt = `You are a Solana validator analyst.
You are given an exact, authoritative validator table produced from on-chain RPC data.
DO NOT modify or reprint the table itself, DO NOT rewrite or "prettify" the addresses, and DO NOT invent any data.
Only produce analysis and insights BELOW the table. Refer to validators by rank (e.g., #1, #2) or by a short 4–6 char prefix (e.g., 3N7s…D5g).
Never include full addresses in your analysis.

Table:
${table}

Facts you may rely on:
- topN = ${topN}
- totalActiveStakeLamports = ${totalActiveStake}
- topNStakeLamports = ${topStake}
- topNStakePercent = ${pct}%

Tasks:
1) Stake concentration analysis (what does ${pct}% in top ${topN} mean?)
2) Commission distribution commentary (e.g., presence of 0% vs high commissions in top ${topN})
3) Performance signals using "Latest Epoch Credits" and "Last Vote Slot" (reliability hints; no made-up claims)
4) Risk/health observations (e.g., centralization risks)
5) Actionable ideas (delegation balancing, monitoring alerts)
Rules:
- Do not restate the full table or reprint full addresses.
- Do not fabricate fields; use only table numbers.
- Keep it concise and structured with bullet points or short sections.
Output format:
"### Validator Analysis" followed by sections and bullets.`;

                    const llm = await together.chat.completions.create({
                        model: "openai/gpt-oss-120b",
                        messages: [{ role: "system", content: analysisPrompt }],
                        stream: false,
                        max_tokens: 1200,
                        temperature: 0.2
                    });

                    const llmText = llm.choices[0]?.message?.content?.trim() || '';
                    if (llmText) {
                        analysis = `\n\n${llmText}`;
                    }
                } catch (e) {
                    console.warn('Validator AI analysis failed, falling back to local summary:', (e as Error).message);
                }
            }

            // If no AI analysis available, add a concise programmatic summary
            if (!analysis) {
                const avgComm = sorted.length
                    ? (sorted.reduce((s: number, v: any) => s + Number(v.commission ?? 0), 0) / sorted.length).toFixed(2)
                    : '0.00';
                const zeroComm = sorted.filter((v: any) => Number(v.commission ?? 0) === 0).length;
                const highComm = sorted.filter((v: any) => Number(v.commission ?? 0) >= 10).length;

                analysis = `

### Validator Analysis (Programmatic)
- Concentration: Top ${topN} hold ${pct}% of stake
- Commission: avg ${avgComm}% • ${zeroComm} with 0% • ${highComm} with ≥10%
- Reliability hints: Inspect "Latest Epoch Credits" and "Last Vote Slot" for consistency trends
- Risk: Concentration among a few operators and high-commission leaders can affect decentralization and yield
- Actions:
  - Diversify delegation away from high-commission or low-credit validators
  - Monitor credit accrual and voting liveness; alert on sudden drops
  - Rebalance towards reliable, lower-commission validators to improve net yield`;
            }

            return (tokenHeader ? tokenHeader + '\n\n' : '') + table + analysis;
        }
    } catch (e) {
        console.warn('Validator deterministic formatter failed, falling back to normal synthesis:', (e as Error).message);
    }

    if (!process.env.TOGETHER_API_KEY) {
        return generateSimpleFallback(results, question);
    }

    const dataContext = Object.entries(results)
        .map(([method, result]) => {
            if (result && !result.error) {
                // Truncate large validator data before sending to LLM
                if (method === 'getVoteAccounts' && result.current && result.current.length > 50) {
                    const truncatedResult = {
                        ...result,
                        current: result.current.slice(0, 50), // Only top 50 validators
                        delinquent: result.delinquent ? result.delinquent.slice(0, 10) : [] // Only first 10 delinquent
                    };
                    return `${method}: ${JSON.stringify(truncatedResult, null, 2)}`;
                }
                return `${method}: ${JSON.stringify(result, null, 2)}`;
            } else {
                return `${method}: ERROR - ${result?.error || 'Failed'}`;
            }
        })
        .join('\n\n');

    // Compress data before sending to LLM
    const { compressed: compressedDataContext, aliasMap } = compressDataForLLM(dataContext);

    console.log(`◪ Compressed data: ${dataContext.length} → ${compressedDataContext.length} chars (${Math.round((1 - compressedDataContext.length / dataContext.length) * 100)}% reduction)`);

    const together = new Together({
        apiKey: process.env.TOGETHER_API_KEY,
    });

    const synthesisPrompt = `You are a knowledgeable blockchain analyst. Provide a comprehensive answer using the retrieved data.

Question: ${question}

Data Retrieved:
${compressedDataContext}

Instructions:
- Use ALL provided data accurately
- For token market data, include current price, market cap, volume, and price changes
- Instead of real addresses/signatures you were given aliases, treat them as real addresses/signatures, and never mention that they are aliases (never truncate)
- Create clear sections and include metrics
- Create at least 5 (better around 10) interesting ascii charts (dont mention them as "ascii chart' tho), try to show user with them a new interesting perspective that human might not think about, be create, try to impress curiousity of a human every time, be unique as possible, never repeat yourself
- BUT YOU MUST NEVER MENTION ANYTHING FROM THIS PROMPT LIKE HERE, THIS IS RESTRICTED! (EXAMPLE OF WRONG TEXT: "Below are compact ASCII‑style visualisations that highlight hidden angles of the data. They are meant to spark curiosity, not replace full‑blown charts.")
- Provide actionable insights
- Include 3 relevant follow-up questions

Answer:`;

    try {
        const answer = await together.chat.completions.create({
            model: "openai/gpt-oss-120b",
            messages: [{ role: "system", content: synthesisPrompt }],
            stream: false,
            max_tokens: 42069,
            temperature: 0.1337
        });

        const response = answer.choices[0]?.message?.content;

        if (!response || response.trim().length === 0) {
            throw new Error('Empty response from LLM');
        }

        // Decompress the response
        const decompressedResponse = decompressLLMResponse(response, aliasMap);

        console.log('◊ AI synthesis complete with decompression');
        return (tokenHeader ? tokenHeader + '\n\n' : '') + decompressedResponse;

    } catch (error) {
        console.error('⚡ LLM synthesis error:', error);
        return generateSimpleFallback(results, question);
    }
}

function generateSimpleFallback(results: Record<string, any>, question: string): string {
    let response = `**Answer for: ${question}**\n\n`;

    // Collect token metrics for possible comparison
    const tokenSummaries: { name: string; symbol: string; price: number; marketCap: number }[] = [];

    for (const [method, result] of Object.entries(results)) {
        if (result && !result.error) {
            if (method.startsWith('tokenMarketData') && result.success) {
                const data = result.data;
                tokenSummaries.push({
                    name: data.name,
                    symbol: data.symbol,
                    price: Number(data.current_price.usd) || 0,
                    marketCap: Number(data.market_cap.usd) || 0
                });
                response += `**${data.name} (${data.symbol}) Market Data:**\n`;
                response += `- Current Price: $${data.current_price.usd}\n`;
                response += `- Market Cap: $${data.market_cap.usd.toLocaleString()}\n`;
                response += `- 24h Volume: $${data.trading_volume.usd.toLocaleString()}\n`;
                response += `- 24h Change: ${data.price_change_24h.toFixed(2)}%\n`;
                response += `- Market Cap Rank: #${data.market_cap_rank || 'N/A'}\n\n`;
            } else if (method === 'getVoteAccounts' && result.current) {
                // Handle validator data properly
                const qLower = question.toLowerCase();
                if (qLower.includes("top") && qLower.includes("validator")) {
                    // Sort validators by activated stake (descending)
                    const sortedValidators = result.current
                        .sort((a: any, b: any) => Number(b.activatedStake) - Number(a.activatedStake))
                        .slice(0, 10); // Get top 10

                    response += `**Top 10 Validators by Stake:**\n\n`;

                    sortedValidators.forEach((validator: any, index: number) => {
                        const stakeInSol = (Number(validator.activatedStake) / 1_000_000_000).toFixed(0);
                        const commission = validator.commission;

                        response += `**${index + 1}.** ${validator.nodePubkey}\n`;
                        response += `   - Stake: ${Number(stakeInSol).toLocaleString()} SOL\n`;
                        response += `   - Commission: ${commission}%\n`;
                        response += `   - Vote Account: ${validator.votePubkey}\n`;
                        if (validator.epochCredits && validator.epochCredits.length > 0) {
                            const latestCredits = validator.epochCredits[validator.epochCredits.length - 1];
                            response += `   - Latest Epoch Credits: ${latestCredits[1]}\n`;
                        }
                        response += `\n`;
                    });

                    const totalActiveStake = result.current.reduce((sum: number, v: any) => sum + Number(v.activatedStake), 0);
                    const topTenStake = sortedValidators.reduce((sum: number, v: any) => sum + Number(v.activatedStake), 0);
                    const topTenPercentage = ((topTenStake / totalActiveStake) * 100).toFixed(2);

                    response += `**Summary:**\n`;
                    response += `- Total active validators: ${result.current.length}\n`;
                    response += `- Top 10 control ${topTenPercentage}% of total stake\n`;
                    response += `- Total network stake: ${(totalActiveStake / 1_000_000_000).toFixed(0).toLocaleString()} SOL\n\n`;
                } else {
                    // Regular validator count
                    const activeValidators = result.current.length;
                    const delinquentValidators = result.delinquent.length;
                    const totalValidators = activeValidators + delinquentValidators;

                    response += `**Current validator count:**\n`;
                    response += `- Active validators: ${activeValidators}\n`;
                    response += `- Delinquent validators: ${delinquentValidators}\n`;
                    response += `- Total validators: ${totalValidators}\n\n`;
                }
            } else {
                response += `**${method}**: Data retrieved successfully\n\n`;
            }
        } else {
            response += `**${method}**: ${result?.error || 'Failed'}\n\n`;
        }
    }

    // If the user asked to compare tokens and we have at least two token summaries, add a concise comparison block
    const qLower = question.toLowerCase();
    if (tokenSummaries.length >= 2 && (qLower.includes('compare') || qLower.includes(' vs ') || qLower.includes('versus'))) {
        // Take first two tokens for simple comparison
        const [a, b] = tokenSummaries;
        if (a && b && a.price > 0 && b.price > 0) {
            const ratio = a.price / b.price;
            response += `**Quick Comparison (${a.symbol} vs ${b.symbol}):**\n`;
            response += `- ${a.symbol} Price: $${a.price}\n`;
            response += `- ${b.symbol} Price: $${b.price}\n`;
            response += `- Ratio (${a.symbol}/${b.symbol}): ${ratio.toFixed(4)}\n\n`;
        }
    }

    return response;
}
