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
            console.log('🤖 Generating AI-powered plan...');

            // Generate AI-powered plan
            const plan = await generateAIPoweredPlan(question);
            console.log('🎭 AI-generated plan:', plan.map(p => ({
                tool: p.tool,
                input: p.input
            })));

            // Execute the plan
            const results = await executePlan(plan, conn);

            // Synthesize response
            const finalAnswer = await synthesizeResults(context, plan, results);

            console.log('📚 Final answer length:', finalAnswer.length);

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
            console.error('🔥 AI plan execution error:', error);
            return {
                handled: false
            };
        }
    }
};

async function generateAIPoweredPlan(question: string): Promise<AIPlanStep[]> {
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
- SVMAI -> opensvm-com
- SOL -> solana  
- BONK -> bonk
- WIF -> dogwifcoin
- PEPE -> pepe
- CHAN -> chan-cat
- PIX404 -> pix404
- For unknown tokens, use lowercase symbol
`;

        const planningPrompt = `You are an intelligent blockchain analyst. Analyze the user's question and create a JSON plan for which tools to use.

User Question: "${question}"

${availableTools}

Instructions:
1. Analyze the user's question carefully
2. For token price/market cap/volume questions, ALWAYS use tokenMarketData tool first
3. For account/address analysis, use account-related tools
4. For network status, use network-related tools
5. Extract token symbols from questions (like $SVMAI, $CHAN, $PIX404)
6. Return ONLY a JSON array of tool steps, no other text

Response format (JSON only):
[
  {
    "tool": "toolName",
    "reason": "why this tool is needed",
    "narrative": "engaging description",
    "input": "parameter if needed"
  }
]

For token queries, extract the symbol and map to CoinGecko ID.
Example for "$SVMAI price": use tool "tokenMarketData" with input "opensvm-com"
Example for "$CHAN market cap": use tool "tokenMarketData" with input "chan-cat"`;

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

        console.log('🤖 AI generated plan:', aiPlan);

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

        const tokenMatch = question.match(/\$([A-Z0-9]{3,10})/i);
        const tokenSymbol = tokenMatch ? tokenMatch[1].toUpperCase() : 'UNKNOWN';

        const tokenMappings: Record<string, string> = {
            'SVMAI': 'opensvm-com',
            'SOL': 'solana',
            'BONK': 'bonk',
            'WIF': 'dogwifcoin',
            'PEPE': 'pepe',
            'CHAN': 'chan-cat',
            'PIX404': 'pix404'
        };

        const coinId = tokenMappings[tokenSymbol] || tokenSymbol.toLowerCase();

        return [{
            tool: 'tokenMarketData',
            reason: `Get current market data for ${tokenSymbol} token from CoinGecko API`,
            narrative: `📊 Getting market data for ${tokenSymbol}`,
            input: coinId
        }];
    }

    // Validator queries fallback
    if (qLower.includes('validator')) {
        return [{
            tool: 'getVoteAccounts',
            reason: 'Get current validator information and voting accounts',
            narrative: '🗳️ Retrieving validator data...'
        }];
    }

    // Default fallback
    return [{
        tool: 'getEpochInfo',
        reason: 'Get current network status as starting point for analysis',
        narrative: '🌐 Establishing blockchain baseline...'
    }];
}

async function executePlan(plan: AIPlanStep[], conn: any): Promise<Record<string, any>> {
    const results: Record<string, any> = {};

    console.log('🎬 Beginning AI plan execution...');

    for (const step of plan) {
        console.log(`\n${step.narrative}`);

        try {
            let result;

            // Handle tokenMarketData tool
            if (step.tool === 'tokenMarketData') {
                try {
                    const tokenTool = await import('./tokenMarketData');
                    result = await tokenTool.tokenMarketDataTool.execute({ coinId: step.input });
                    console.log(`   💎 Token market data retrieved: ${result.success ? 'SUCCESS' : 'FAILED'}`);
                } catch (error) {
                    result = { error: `Token market data error: ${(error as Error).message}` };
                    console.log(`   ❌ Token market data failed`);
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
                console.log(`   ✅ ${step.reason}`);
            } else {
                console.warn(`   ⚠️ Method ${step.tool} not available`);
                result = { error: `Method ${step.tool} not available` };
            }

            results[step.tool] = result;

        } catch (error) {
            console.error(`   🔥 Error in ${step.tool}:`, error);
            results[step.tool] = { error: (error as Error).message };
        }
    }

    console.log('\n🎭 AI plan execution complete! Results gathered:', Object.keys(results).length);
    return results;
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

    console.log('📖 Synthesizing AI-powered response...');

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

    console.log(`🗜️ Compressed data: ${dataContext.length} → ${compressedDataContext.length} chars (${Math.round((1 - compressedDataContext.length / dataContext.length) * 100)}% reduction)`);

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

        console.log('✨ AI synthesis complete with decompression');
        return decompressedResponse;

    } catch (error) {
        console.error('🔥 LLM synthesis error:', error);
        return generateSimpleFallback(results, question);
    }
}

function generateSimpleFallback(results: Record<string, any>, question: string): string {
    let response = `**Answer for: ${question}**\n\n`;

    for (const [method, result] of Object.entries(results)) {
        if (result && !result.error) {
            if (method === 'tokenMarketData' && result.success) {
                const data = result.data;
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

    return response;
}
