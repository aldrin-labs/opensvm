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

        // Declare variables outside try block for error handling
        let lastPlan: AIPlanStep[] = [];
        let accumulatedResults: Record<string, any> = {};

        try {
            console.log('◈ Generating AI-powered plan with review loop...');

            // Up to 3 cycles: plan -> execute -> review -> (maybe) replan
            const maxIterations = 3;
            let iteration = 0;
            let planningContext: string | undefined = undefined;

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

            // If we have partial results from successful steps, pass them along
            if (typeof accumulatedResults !== 'undefined' && Object.keys(accumulatedResults).length > 0) {
                console.log(`📦 Returning partial results from ${Object.keys(accumulatedResults).length} successful steps`);
                const partialError = new Error(`AI plan execution failed: ${(error as Error).message}`);
                (partialError as any).partialData = {
                    aiPlanExecutionTool: {
                        partialResults: accumulatedResults,
                        lastPlan: typeof lastPlan !== 'undefined' ? lastPlan : [],
                        executionError: (error as Error).message
                    }
                };
                throw partialError;
            }

            return {
                handled: false
            };
        }
    }
};

// Helper function to add timeout to AI API calls
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
            reject(new Error(`${operation} timeout after ${timeoutMs}ms`));
        }, timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]);
}

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
Available Tools (Comprehensive)

Moralis API (Solana Gateway & Deep Index)
- moralisMarketData (custom orchestrator): price, computed market cap (price * supply), 24h volume via pair stats. input: mint
- getNFTMetadata(address)
- getNFTsForAddress(address, { nftMetadata?, limit?, cursor? }, network?)
- getTokenMetadata(address)
- getTokenPrice(address)
- getPortfolio(address, includeNftMetadata?)
- getTokenBalances(address)
- getNativeBalance(address)
- getSwapsByWalletAddress(address, { limit?, cursor? })
- getSwapsByTokenAddress(address, { limit?, cursor? })
- getTokenHolders(address)
- getSPLTokenTransfers(address, { limit?, fromDate?, toDate?, cursor? })
- getSOLTransfers(address, { limit?, fromDate?, toDate?, cursor? })
- getTransactionBySignature(signature)
- getTransactionsByAddress(address, { limit?, fromDate?, toDate?, cursor? })
- getDomainInfo(address)
- resolveDomain(domain)
- getHistoricalTokenPrice(address, days?)
- getTokenStats(address)
- getNFTCollectionStats(address)
- getNFTCollectionItems(address, { limit?, nftMetadata? })
- getComprehensiveBlockchainData(query)
- getTopTokens(limit?)           (note: currently returns null; path deprecated upstream)
- getNewListings(limit?, daysBack?) (note: currently returns null; path unsupported upstream)
- getTokenMarketData({ limit?, cursor?, sort_by?, sort_order?, min_market_cap?, min_volume? })
- clearCache()

Solana RPC (web3.js Connection methods)
- getAccountInfo(address)
- getMultipleAccountsInfo(addresses)
- getBalance(address)
- getBlock(slot, opts?)
- getBlockHeight()
- getBlockProduction(opts?)
- getBlockTime(slot)
- getClusterNodes()
- getEpochInfo()
- getEpochSchedule()
- getFeeForMessage(message, commitment?)
- getFirstAvailableBlock()
- getGenesisHash()
- getHealth()
- getHighestSnapshotSlot()
- getIdentity()
- getInflationGovernor()
- getInflationRate()
- getInflationReward(addresses, epoch?, commitment?)
- getLargestAccounts(opts?)
- getLeaderSchedule(slot?, commitment?, identity?)
- getLatestBlockhash(commitment?)
- getMaxRetransmitSlot()
- getMaxShredInsertSlot()
- getMinimumBalanceForRentExemption(dataLen, commitment?)
- getProgramAccounts(programId, opts?)
- getRecentPerformanceSamples(limit?)
- getSignaturesForAddress(address, { limit?, before?, until? })
- getSignatureStatuses(signatures, options?)
- getSlot(commitment?)
- getSlotLeader(commitment?)
- getSlotLeaders(startSlot, limit)
- getSupply(commitment?)
- getTokenAccountBalance(tokenAccount)
- getTokenAccountsByDelegate(delegate, filter, commitment?)
- getTokenAccountsByOwner(owner, filter, commitment?)
- getTokenLargestAccounts(mint)
- getTokenSupply(mint)
- getTransaction(signature, opts?)
- getTransactionCount(commitment?)
- getVersion()
- getVoteAccounts(commitment?)
- isBlockhashValid(blockhash, commitment?)
- requestAirdrop(address, lamports, commitment?)
- sendRawTransaction(rawTx, opts?)
- simulateTransaction(txOrMessage, opts?)

Notes:
- Prefer Moralis for token price/market data, DEX swaps, holders, portfolio, NFTs.
- Use Solana RPC for direct chain state: account info, balances, token supply, program accounts, leader schedule, validators, etc.
- For moralisMarketData you MUST pass the Solana mint address.

Token Symbol → Mint Address (for moralisMarketData):
- SVMAI -> Cpzvdx6pppc9TNArsGsqgShCsKC9NCCjA2gtzHvUpump
- For other tokens, provide the exact Solana mint address.

Method Reference (Moralis API - Solana Gateway & Deep Index)
- moralisMarketData(mint)
  • Description: Custom orchestrator that combines Solana RPC supply with Moralis price and optional pair stats.
  • Output (normalized): { success, source: "moralis", data: { name, symbol, current_price: { usd }, market_cap: { usd }, trading_volume: { usd, h24 }, last_updated, extra: { mint, supply_tokens, supply_raw, decimals, pairAddress } } }
  • When to call: Price, market cap, and 24h volume for a specific token. Always pass Solana mint.

- getTokenPrice(address, network?)
  • Description: Current token price and pair details when available.
  • Output: { price_usd|usdPrice|usd|price, pairAddress? }
  • When to call: Lightweight spot price without needing supply.

- getTokenMetadata(address, network?)
  • Description: Metadata for a token mint (name, symbol, logo, decimals).
  • Output: { name, symbol, decimals, logo?, ... }
  • When to call: Enrich UI or validate token info before analytics.

- getTokenStats(address, network?)
  • Description: Misc token stats if available for the mint.
  • Output: { volume_24h?, market_cap?, holders?, ... }
  • When to call: Supplemental metrics beyond price/supply.

- getHistoricalTokenPrice(address, days?, network?)
  • Description: Price history in a time-window.
  • Output: { prices: [{ timestamp, price_usd }], ... } (shape may vary)
  • When to call: Trendlines, momentum, and historical patterns.

- getTokenHolders(address, network?)
  • Description: Holder accounts for a token mint (top holders).
  • Output: Array/list with holder addresses and balances.
  • When to call: Concentration, distribution, whale analysis.

- getSwapsByTokenAddress(address, { limit?, cursor? }, network?)
  • Description: Recent DEX swaps for a token mint.
  • Output: Array of swaps with amounts, timestamps, counterparties (shape depends on indexer).
  • When to call: Activity, 24h volume aggregation, liquidity pulse.

- getSwapsByWalletAddress(address, { limit?, cursor? }, network?)
  • Description: Recent DEX swaps performed by a wallet.
  • Output: Array of swaps with token pairs and amounts.
  • When to call: Wallet trading behavior and PnL analysis.

- getComprehensiveBlockchainData(query, network?)
  • Description: Smart inspector that detects query type (signature/token/account/domain) and bundles relevant data.
  • Output: { type: "transaction"|"token"|"nft"|"account"|"unknown", data: {...} }
  • When to call: One-shot enrichment when input type is unknown.

- getPortfolio(address, includeNftMetadata?, network?)
  • Description: Portfolio summary incl. native SOL, tokens, NFTs (optionally with metadata).
  • Output: { nativeBalance, tokens[], nfts[]? }
  • When to call: Wallet overview and valuation (pair with price API for USD).

- getTokenBalances(address, network?)
  • Description: SPL token balances for a wallet.
  • Output: Array of { mint, amount, decimals, uiAmount?, ... }
  • When to call: Token inventory snapshot per wallet.

- getNativeBalance(address, network?)
  • Description: SOL balance for a wallet.
  • Output: { lamports } or number value depending on gateway.
  • When to call: Check funding/rent-exempt conditions or net worth.

- getNFTsForAddress(address, { nftMetadata?, limit?, cursor? }, network?)
  • Description: NFTs held by a wallet with optional metadata expansion.
  • Output: Array of NFTs; when nftMetadata=true includes collection/name/image.
  • When to call: Wallet NFT holdings and collection insights.

- getNFTMetadata(address, network?)
  • Description: Metadata for a specific NFT mint/collection.
  • Output: { name, symbol, image, attributes, ... }
  • When to call: NFT detail page or item enrichment.

- getNFTCollectionStats(address, network?)
  • Description: Stats for an NFT collection.
  • Output: { floor_price?, volume_24h?, owners?, ... }
  • When to call: Collection overview and market interest.

- getNFTCollectionItems(address, { limit?, nftMetadata? }, network?)
  • Description: Items inside a collection.
  • Output: Array of items; with metadata if requested.
  • When to call: Browsing collection inventory.

- getSPLTokenTransfers(address, { limit?, fromDate?, toDate?, cursor? }, network?)
  • Description: Transfer events related to SPL tokens for a wallet.
  • Output: Array of token transfer records.
  • When to call: Token activity timeline and inflow/outflow.

- getSOLTransfers(address, { limit?, fromDate?, toDate?, cursor? }, network?)
  • Description: SOL transfers for a wallet.
  • Output: Array of SOL transfer records.
  • When to call: Funding, withdrawals, and payment analysis.

- getTransactionsByAddress(address, { limit?, fromDate?, toDate?, cursor? }, network?)
  • Description: Transaction history for a wallet.
  • Output: Array of transactions (signatures + metadata).
  • When to call: Broad activity analysis and audit trails.

- getTransactionBySignature(signature, network?)
  • Description: Transaction detail by signature.
  • Output: Parsed transaction or raw fields.
  • When to call: Inspect specific on-chain event.

- getDomainInfo(address, network?) / resolveDomain(domain, network?)
  • Description: Domain records for a wallet or resolve .sol domain to address.
  • Output: Domain list / { address }.
  • When to call: Reverse lookups and vanity resolution.


- getTokenMarketData({ limit?, cursor?, sort_by?, sort_order?, min_market_cap?, min_volume? })
  • Description: Market list via Deep Index trending, sorted best-effort.
  • Output: { tokens: [...] }
  • When to call: Market overviews and paged lists.

- getTopTokens(limit?) / getNewListings(limit?, daysBack?)
  • Description: Not available on gateway; return null with warnings.
  • Output: null
  • When to call: Do not call unless testing availability; prefer trending endpoints.

- clearCache()
  • Description: Clears in-memory cache for Moralis API wrapper.
  • Output: void
  • When to call: After config changes or to force refreshes.

Method Reference (Solana RPC via @solana/web3.js Connection)
- getAccountInfo(address)
  • Description: Raw account data, owner, lamports, executable.
  • Output: { value: { lamports, owner, executable, data[...] } }
  • When to call: Determine account type (wallet/program/mint).

- getBalance(address)
  • Description: SOL balance in lamports.
  • Output: number or { value }
  • When to call: Funding/rent checks and net worth context.

- getTokenSupply(mint)
  • Description: Total supply and decimals for a mint.
  • Output: { value: { amount, decimals } }
  • When to call: Market cap calculation with price.

- getTokenLargestAccounts(mint)
  • Description: Top holders for a mint.
  • Output: { value: [{ address, amount }...] }
  • When to call: Holder concentration and risk.

- getTokenAccountsByOwner(owner, filter, commitment?)
  • Description: Token accounts owned by a wallet.
  • Output: { value: [...] }
  • When to call: Inventory of SPL token accounts.

- getParsedTokenAccountsByOwner(owner, filter, commitment?)
  • Description: Parsed token accounts (easier to read).
  • Output: { value: [{ account: { data: { parsed: {...} } } }] }
  • When to call: Human-readable token holdings.

- getSignaturesForAddress(address, { limit?, before?, until? })
  • Description: Recent transaction signatures.
  • Output: Array of { signature, slot, err?, ... }
  • When to call: Activity timelines and pagination.

- getParsedTransaction(signature, opts?) / getTransaction(signature, opts?)
  • Description: Decode a transaction (parsed/raw).
  • Output: Parsed structure or wire format.
  • When to call: Instruction-level inspection.

- getRecentPerformanceSamples(limit?)
  • Description: Throughput samples for TPS.
  • Output: Array of { numTransactions, samplePeriodSecs }
  • When to call: Performance/TPS analysis.

- getEpochInfo()
  • Description: Epoch number, slots, progress.
  • Output: { epoch, slotIndex, slotsInEpoch, ... }
  • When to call: Temporal context and schedules.

- getLeaderSchedule(slot?, commitment?, identity?)
  • Description: Validator leadership schedule.
  • Output: Map of leader slots per validator.
  • When to call: Block production and timing.

- getVoteAccounts(commitment?)
  • Description: Validator status and stake.
  • Output: { current[], delinquent[] }
  • When to call: Health and top validator tables.

- getClusterNodes()
  • Description: Nodes and RPC endpoints.
  • Output: Array of nodes with pubkeys and gossip.
  • When to call: Topology and network map.

- getBlock(slot, opts?) / getBlockHeight() / getBlockTime(slot)
  • Description: Block data, height, timestamps.
  • Output: Block details / height / unix time.
  • When to call: Slot-to-time mapping and audits.

- getSlot(commitment?) / getSlotLeader(commitment?) / getSlotLeaders(startSlot, limit)
  • Description: Current slot and leaders.
  • Output: Slot number / leader pubkey(s).
  • When to call: Realtime positioning and leadership.

- getProgramAccounts(programId, opts?)
  • Description: Accounts under a program.
  • Output: Array of account infos.
  • When to call: Protocol state scanning.

- getSupply(commitment?)
  • Description: Cluster native supply info.
  • Output: Circulating/non-circulating metrics.
  • When to call: Macro supply trends (SOL).

- requestAirdrop(address, lamports, commitment?)
  • Description: Devnet airdrop utility.
  • Output: Signature string.
  • When to call: Dev/test funding.

- sendRawTransaction(rawTx, opts?) / simulateTransaction(txOrMessage, opts?)
  • Description: Broadcast or simulate a transaction.
  • Output: Signature / simulation logs.
  • When to call: Program interactions and dry-runs.

- getBlocks(startSlot, endSlot)
  • Description: Returns a list of confirmed blocks between two slots (inclusive).
  • Output: number[] of slot numbers.
  • When to call: Time‑range scans, analytics windows, backfills.

- getBlocksWithLimit(startSlot, limit)
  • Description: Returns up to limit blocks starting at startSlot.
  • Output: number[] of slot numbers.
  • When to call: Paginated historical scans and cursors.

- getBlockCommitment(slot)
  • Description: Returns commitment for a block at a given slot.
  • Output: { commitment: number[]; totalStake: number } (shape may vary by RPC).
  • When to call: Assess finality and network stake commitment for a slot.

- getBlockSignatures(slot)
  • Description: Returns transaction signatures for a block (if supported by node).
  • Output: { signatures: string[] } or array, depending on node version.
  • When to call: Signature enumeration without fetching full block details.

- getRecentPrioritizationFees(addresses?)
  • Description: Returns recent prioritization fees suggested by the network for provided addresses (or global if omitted).
  • Output: Array of { slot, prioritizationFee } samples.
  • When to call: Estimate Jito/priority fee strategy, cost forecasting.

- getStakeActivation(stakeAccount, epoch?)
  • Description: Returns activation state of a stake account at an epoch.
  • Output: { state: "active"|"inactive"|"activating"|"deactivating", active: lamports, inactive: lamports }.
  • When to call: Stake position analytics and warm‑up/cool‑down tracking.

- getStakeMinimumDelegation()
  • Description: Returns the minimum delegation amount for staking.
  • Output: number (lamports).
  • When to call: UX validation and auto‑suggested min stake amounts.

- minimumLedgerSlot()
  • Description: Returns the lowest slot that the node has information about in its ledger.
  • Output: number (slot).
  • When to call: Backfill bounds, avoid querying pruned history.

- getAddressLookupTable(address)
  • Description: Fetches an Address Lookup Table account for v0 transactions.
  • Output: { value: { addresses: string[], ... } }.
  • When to call: Decoding/constructing v0 transactions or audit of LUT usage.

- getFeeRateGovernor() [deprecated]
  • Description: Old fee governor info (largely deprecated with prioritized fees evolution).
  • Output: { feeRateGovernor: ... }.
  • When to call: Legacy analytics only; prefer prioritization fees.

- getFees() [deprecated]
  • Description: Old fee info endpoint (deprecated).
  • Output: { blockhash, feeCalculator }.
  • When to call: Legacy tools only; prefer getFeeForMessage and getRecentPrioritizationFees.

- getParsedTransaction(signature, opts?)
  • Description: Returns parsed transaction (layout‑decoded).
  • Output: Parsed structure with instructions and token balances.
  • When to call: Human‑readable transaction analysis and UIs.

- getParsedTransactions(signatures[], opts?)
  • Description: Batch form of parsed transaction retrieval (if supported).
  • Output: Array of parsed txs in same order.
  • When to call: Efficient batched inspection across signatures.

- getMultipleAccounts(addresses, opts?)
  • Description: Raw multiple account fetch (different from getMultipleAccountsInfo in some versions).
  • Output: { value: AccountInfo[] }.
  • When to call: Bulk state fetches, scanners, and indexers.

- getHighestLedgerSlot() [if supported by node]
  • Description: Returns the highest slot fully stored in ledger (may differ from snapshot slot).
  • Output: number (slot).
  • When to call: Ledger coverage checks and synchronization analytics.

Notes:
- Some endpoints vary by node version. Prefer getBlock over legacy confirmed endpoints.
- Prefer getFeeForMessage + getRecentPrioritizationFees over deprecated fee endpoints.
`;

        const planningPrompt = `You are an intelligent blockchain analyst. Analyze the user's question and create a JSON plan for which tools to use.

User Question: "${question}"

Additional planning context from previous review (if any):
${planningContext || "N/A"}

${availableTools}

Hard rules for planning:
1) If the user asks about "price", "market cap", or "volume", or uses $SYMBOL notation, you MUST include "moralisMarketData" as the FIRST step for each detected token.
2) "moralisMarketData" REQUIRES the Solana mint address. Use the provided symbol→mint mapping (SVMAI supported). If the mint is unknown, omit the step instead of guessing.
3) If multiple tokens are requested, include one moralisMarketData step per token (deduplicated). Keep moralisMarketData steps first, then any extra RPC steps if the user also asked for them.
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
    { "tool": "moralisMarketData", "reason": "Get market data for SVMAI via Moralis", "narrative": "⟨ ⟩ Fetching Moralis price/volume for SVMAI", "input": "Cpzvdx6pppc9TNArsGsqgShCsKC9NCCjA2gtzHvUpump" }
  ]

- For "$SOL account balance of address X": do not use moralisMarketData; use account/balance tools instead.`;

        const response = await withTimeout(
            together.chat.completions.create({
                model: "openai/gpt-oss-120b",
                messages: [{ role: "user", content: planningPrompt }],
                max_tokens: 2000,
                temperature: 0.1
            }),
            30000, // 30 second timeout for plan generation
            "AI plan generation"
        );

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

    // Token detection fallback (Moralis-only)
    if (qLower.includes('price') || qLower.includes('market') || qLower.includes('volume') ||
        qLower.includes('token') || /\$[A-Z]{3,10}/.test(question)) {

        // Map of known tokens to Solana mint address (Moralis requires mint)
        const tokenMintMappings: Record<string, string> = {
            'SVMAI': 'Cpzvdx6pppc9TNArsGsqgShCsKC9NCCjA2gtzHvUpump'
        };

        // Extract all $SYMBOL occurrences and de-duplicate
        const symbolMatches = [...question.toUpperCase().matchAll(/\$([A-Z0-9]{3,10})/g)].map(m => m[1]);
        const uniqueSymbols = Array.from(new Set(symbolMatches));

        // Only include tokens where we know the mint
        const steps: AIPlanStep[] = [];
        for (const symbol of uniqueSymbols) {
            const mint = tokenMintMappings[symbol];
            if (mint) {
                steps.push({
                    tool: 'moralisMarketData',
                    reason: `Get current market data for ${symbol} via Moralis`,
                    narrative: `▣ Getting Moralis market data for ${symbol}`,
                    input: mint
                });
            }
        }
        if (steps.length > 0) return steps;

        // If we don't know the mint, return empty plan to avoid guessing external sources
        return [];
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

function extractUsd24hVolumeDeep(obj: any): number {
    let best = 0;
    try {
        const visit = (node: any, path: string[]) => {
            if (!node || typeof node !== 'object') return;
            for (const [key, val] of Object.entries(node)) {
                const k = String(key).toLowerCase();
                const p = [...path, k];
                if (typeof val === 'number' && Number.isFinite(val)) {
                    const joined = p.join('.');
                    const hasVol = joined.includes('vol') || joined.includes('volume');
                    const has24 = joined.includes('24h') || joined.includes('h24') || joined.includes('24');
                    const hasUsd = joined.includes('usd') || joined.includes('quote_usd') || joined.includes('usdquote');
                    const notLiquidity = !joined.includes('liquidity');
                    if (hasVol && has24 && hasUsd && notLiquidity && val > best) {
                        best = val;
                    }
                } else if (val && typeof val === 'object') {
                    visit(val as any, p);
                }
            }
        };
        visit(obj, []);
    } catch {}
    return best;
}

function extractVolume24hAny(obj: any): number {
    let best = 0;
    try {
        const visit = (node: any, path: string[]) => {
            if (!node || typeof node !== 'object') return;
            for (const [key, val] of Object.entries(node)) {
                const k = String(key).toLowerCase();
                const p = [...path, k];
                if (typeof val === 'number' && Number.isFinite(val)) {
                    const joined = p.join('.');
                    const hasVol = joined.includes('vol') || joined.includes('volume');
                    const has24 = joined.includes('24h') || joined.includes('h24') || joined.includes('24');
                    const notLiquidity = !joined.includes('liquidity');
                    if (hasVol && has24 && notLiquidity && val > best) {
                        best = val;
                    }
                } else if (val && typeof val === 'object') {
                    visit(val as any, p);
                }
            }
        };
        visit(obj, []);
    } catch {}
    return best;
}

async function executePlan(plan: AIPlanStep[], conn: any): Promise<Record<string, any>> {
    const results: Record<string, any> = {};

    console.log('▶ Beginning AI plan execution...');

    for (const step of plan) {
        console.log(`\n${step.narrative}`);

        try {
            let result;

            // Handle Moralis market data tool
            if (step.tool === 'moralisMarketData') {
                try {
                    if (typeof step.input !== 'string' || !step.input) {
                        throw new Error('moralisMarketData requires mint address as input');
                    }
                    const { PublicKey } = await import('@solana/web3.js');
                    const moralisApi = await import('../../../../lib/moralis-api');

                    const mint = step.input;
                    const pubkey = new PublicKey(mint);

                    // 1) Get token supply from RPC
                    const supplyRes = await conn.getTokenSupply(pubkey);
                    const amount = Number(supplyRes?.value?.amount || 0);
                    const decimals = Number(supplyRes?.value?.decimals || 0);
                    const supplyTokens = decimals >= 0 ? (amount / Math.pow(10, decimals)) : 0;

                    // 2) Get price (Moralis)
                    const priceRes = await moralisApi.getTokenPrice(mint, 'mainnet');

                    // Robust extraction of price and pair address
                    const priceUsd =
                        Number(
                            (priceRes?.price_usd ?? priceRes?.usdPrice ?? priceRes?.usd ?? priceRes?.price ?? 0)
                        ) || 0;

                    const pairAddress = (() => {
                        const candidates: any[] = [];
                        try {
                            if (priceRes?.pairAddress) candidates.push(priceRes.pairAddress);
                            if (priceRes?.pair_address) candidates.push(priceRes.pair_address);
                            if (priceRes?.pair?.address) candidates.push(priceRes.pair.address);
                            if (Array.isArray(priceRes?.pair) && priceRes.pair[0]?.address) candidates.push(priceRes.pair[0].address);
                            if (Array.isArray(priceRes?.pairs) && priceRes.pairs[0]?.address) candidates.push(priceRes.pairs[0].address);
                            if (priceRes?.result?.pairAddress) candidates.push(priceRes.result.pairAddress);
                            if (Array.isArray(priceRes?.result?.pairs) && priceRes.result.pairs[0]?.address) candidates.push(priceRes.result.pairs[0].address);
                            if (Array.isArray(priceRes?.result) && priceRes.result[0]?.address) candidates.push(priceRes.result[0].address);
                        } catch {}
                        return candidates.find(Boolean) || null;
                    })();

                    // 3) Derive 24h volume via pair stats if pair available
                    let volume24hUsd = 0;
                    if (pairAddress && process.env.MORALIS_API_KEY) {
                        try {
                            const statsUrl = `https://solana-gateway.moralis.io/token/mainnet/pairs/${pairAddress}/stats`;
                            const resp = await fetch(statsUrl, {
                                headers: {
                                    'X-API-Key': process.env.MORALIS_API_KEY,
                                    'accept': 'application/json'
                                }
                            });
                            if (resp.ok) {
const stats = await resp.json();
// Try common keys first
volume24hUsd = Number(
    stats?.volume_24h_usd ?? stats?.volume24hUsd ?? stats?.volume_24h ?? 0
) || 0;

// Heuristic: scan any numeric key that looks like 24h USD volume
if (!volume24hUsd && stats && typeof stats === 'object') {
    try {
        const candidates: number[] = [];
        for (const [k, v] of Object.entries(stats)) {
            if (typeof v === 'number') {
                const kLower = k.toLowerCase();
                const looksVolume = kLower.includes('vol');
                const looks24h = kLower.includes('24') || kLower.includes('24h') || kLower.includes('h24');
                const looksUsd = kLower.includes('usd');
                if (looksVolume && looks24h && looksUsd) candidates.push(v);
            }
        }
        if (candidates.length) {
            volume24hUsd = Math.max(...candidates);
        }
    } catch {}
}
// Deep-scan nested structures for 24h USD volume if still zero
if (!volume24hUsd) {
    const deep = extractUsd24hVolumeDeep(stats);
    if (deep > 0) volume24hUsd = deep;
}
// If still zero, try 24h volume without USD suffix (assumed USD by API defaults)
if (!volume24hUsd) {
    const any = extractVolume24hAny(stats);
    if (any > 0) volume24hUsd = any;
}
                            }
                        } catch (e) {
                            // Non-fatal
                        }
                    }

                    // Fallback #1b: aggregate across all pairs (sum 24h USD volumes)
                    if (process.env.MORALIS_API_KEY) {
                        try {
                            const pairsUrl = `https://solana-gateway.moralis.io/token/mainnet/${mint}/pairs`;
                            const resp = await fetch(pairsUrl, {
                                headers: {
                                    'X-API-Key': process.env.MORALIS_API_KEY,
                                    'accept': 'application/json'
                                }
                            });
                            if (resp.ok) {
                                const json = await resp.json();
                                let pairs: any[] = [];
                                if (Array.isArray(json?.pairs)) {
                                    pairs = json.pairs;
                                } else if (Array.isArray(json?.result?.pairs)) {
                                    pairs = json.result.pairs;
                                } else if (Array.isArray(json?.result)) {
                                    pairs = json.result;
                                } else if (Array.isArray(json?.data?.pairs)) {
                                    pairs = json.data.pairs;
                                } else if (Array.isArray(json?.data)) {
                                    pairs = json.data;
                                } else if (Array.isArray(json)) {
                                    pairs = json;
                                } else {
                                    pairs = [];
                                }
                                let sum = 0;
                                for (const p of pairs.slice(0, 20)) { // expanded cap for better coverage while keeping latency reasonable
                                    const pAddr = p?.pairAddress || p?.address || p?.pair_address;
                                    if (!pAddr) continue;
                                    try {
                                        const statsUrl = `https://solana-gateway.moralis.io/token/mainnet/pairs/${pAddr}/stats`;
                                        const sresp = await fetch(statsUrl, {
                                            headers: {
                                                'X-API-Key': process.env.MORALIS_API_KEY,
                                                'accept': 'application/json'
                                            }
                                        });
                                        if (sresp.ok) {
const s = await sresp.json();
let v = Number(
    s?.volume_24h_usd ??
    s?.volume24hUsd ??
    s?.volume_24h ??
    s?.volumeUsd ??
    0
) || 0;
if (v <= 0) {
    const deep = extractUsd24hVolumeDeep(s);
    if (deep > 0) v = deep;
}
if (v <= 0) {
    const any = extractVolume24hAny(s);
    if (any > 0) v = any;
}
if (v > 0) sum += v;
                                        }
                                    } catch {}
                                }
                                if (sum > volume24hUsd) volume24hUsd = sum;
                            }
                        } catch (e) {
                            // ignore
                        }
                    }

                                        // Fallback #1: try Moralis token stats (may aggregate across pairs)
                    {
                        try {
                            const tokenStats = await moralisApi.getTokenStats(mint, 'mainnet');
let v = Number(
    tokenStats?.volume_24h_usd ??
    tokenStats?.volume24hUsd ??
    tokenStats?.volume_24h ??
    tokenStats?.volume24h ??
    0
) || 0;
// Heuristic scan for any numeric key resembling 24h USD volume
if (!v && tokenStats && typeof tokenStats === 'object') {
    try {
        const candidates: number[] = [];
        for (const [k, val] of Object.entries(tokenStats)) {
            if (typeof val === 'number') {
                const kLower = k.toLowerCase();
                const looksVolume = kLower.includes('vol');
                const looks24h = kLower.includes('24') || kLower.includes('24h') || kLower.includes('h24');
                const looksUsd = kLower.includes('usd');
                if (looksVolume && looks24h && looksUsd) candidates.push(val);
            }
        }
        if (candidates.length) v = Math.max(...candidates);
    } catch {}
}
if (!v) {
    const deep = extractUsd24hVolumeDeep(tokenStats);
    if (deep > 0) v = deep;
}
if (v > volume24hUsd) volume24hUsd = v;
                        } catch (e) {
                            // ignore
                        }
                    }

                    // Fallback #2a: try pair swaps directly (if pairAddress available)
                    if (pairAddress && process.env.MORALIS_API_KEY) {
                        try {
                            const since = Date.now() - 24 * 60 * 60 * 1000;
                            const swapsUrl = `https://solana-gateway.moralis.io/token/mainnet/pairs/${pairAddress}/swaps?limit=100`;
                            const resp = await fetch(swapsUrl, {
                                headers: {
                                    'X-API-Key': process.env.MORALIS_API_KEY,
                                    'accept': 'application/json'
                                }
                            });
                            if (resp.ok) {
                                const json = await resp.json();
                                const rows = Array.isArray(json) ? json : Array.isArray(json?.result) ? json.result : [];
                                const toMs = (t: any) => {
                                    if (typeof t === 'number') return t > 1e12 ? t : t * 1000;
                                    const parsed = Date.parse(String(t) || '');
                                    return Number.isFinite(parsed) ? parsed : 0;
                                };
                                const detectUsd = (s: any) =>
                                    Number(
                                        s?.usd_value ??
                                        s?.usd ??
                                        s?.amount_usd ??
                                        s?.value_usd ??
                                        s?.amountUsd ??
                                        s?.valueUsd ??
                                        s?.volumeUsd ??
                                        0
                                    ) || 0;
                                const detectAmt = (s: any) =>
                                    Number(s?.amount_out ?? s?.amountOut ?? s?.amount_in ?? s?.amountIn ?? s?.amount ?? 0) || 0;

                                let sum = 0;
                                for (const s of rows) {
                                    const ts = toMs(s?.timestamp ?? s?.block_timestamp ?? s?.date ?? s?.time ?? 0);
                                    if (ts >= since) {
                                        const usd = detectUsd(s);
                                        if (usd > 0) {
                                            sum += usd;
                                        } else {
                                            const amt = detectAmt(s);
                                            if (amt > 0 && priceUsd > 0) {
                                                sum += amt * priceUsd;
                                            }
                                        }
                                    }
                                }
                                if (sum > volume24hUsd) volume24hUsd = sum;
                            }
                        } catch (e) {
                            // ignore
                        }
                    }

                    // Fallback #2: aggregate recent swaps in the last 24h (best-effort USD)
                    {
                        try {
                            const since = Date.now() - 24 * 60 * 60 * 1000;
                            const swaps = await moralisApi.getSwapsByTokenAddress(mint, { limit: 100 }, 'mainnet');

                            const toMs = (t: any) => {
                                if (typeof t === 'number') return t > 1e12 ? t : t * 1000;
                                const parsed = Date.parse(String(t) || '');
                                return Number.isFinite(parsed) ? parsed : 0;
                            };
                            const detectUsd = (s: any) =>
                                Number(
                                    s?.usd_value ??
                                    s?.usd ??
                                    s?.amount_usd ??
                                    s?.value_usd ??
                                    s?.amountUsd ??
                                    s?.valueUsd ??
                                    s?.volumeUsd ??
                                    0
                                ) || 0;
                            const detectAmt = (s: any) =>
                                Number(s?.amount_out ?? s?.amountOut ?? s?.amount_in ?? s?.amountIn ?? s?.amount ?? 0) || 0;

                            let sum = 0;

                            const accumulate = (arr: any[]) => {
                                for (const s of arr) {
                                    const ts = toMs(s?.timestamp ?? s?.block_timestamp ?? s?.date ?? s?.time ?? 0);
                                    if (ts >= since) {
                                        const usd = detectUsd(s);
                                        if (usd > 0) {
                                            sum += usd;
                                        } else {
                                            const amt = detectAmt(s);
                                            if (amt > 0 && priceUsd > 0) {
                                                sum += amt * priceUsd;
                                            }
                                        }
                                    }
                                }
                            };

                            if (Array.isArray(swaps)) {
                                accumulate(swaps);
                            } else if (swaps?.result && Array.isArray(swaps.result)) {
                                accumulate(swaps.result);
                            }

                            if (sum > volume24hUsd) volume24hUsd = sum;
                        } catch (e) {
                            // ignore
                        }
                    }

                    // Fallback #3: pair OHLCV aggregation (USD), 1h buckets over last 24h
                    if (pairAddress && process.env.MORALIS_API_KEY) {
                        try {
                            const to = new Date();
                            const from = new Date(to.getTime() - 24 * 60 * 60 * 1000);
                            const ohlcvUrl = `https://solana-gateway.moralis.io/token/mainnet/pairs/${pairAddress}/ohlcv?fromDate=${encodeURIComponent(from.toISOString())}&toDate=${encodeURIComponent(to.toISOString())}&timeframe=1h&currency=usd&limit=100`;
                            const resp = await fetch(ohlcvUrl, {
                                headers: {
                                    'X-API-Key': process.env.MORALIS_API_KEY,
                                    'accept': 'application/json'
                                }
                            });
                            if (resp.ok) {
                                const json = await resp.json();
                                const rows = Array.isArray(json?.result) ? json.result : (Array.isArray(json) ? json : []);
                                let sum = 0;
for (const r of rows) {
    // Try common volume fields; otherwise scan numeric keys with 'vol' and 'usd'
    const v = Number(
        r?.volume_usd ??
        r?.volumeUsd ??
        r?.v_usd ??
        r?.volUsd ??
        0
    ) || 0;
    if (v > 0) {
        sum += v;
    } else if (r && typeof r === 'object') {
        try {
            const candidates: number[] = [];
            for (const [k, val] of Object.entries(r)) {
                if (typeof val === 'number') {
                    const kLower = k.toLowerCase();
                    const looksVolume = kLower.includes('vol') || kLower.includes('volume');
                    const looksUsd = kLower.includes('usd');
                    if (looksVolume && looksUsd) candidates.push(val);
                }
            }
            if (candidates.length) {
                sum += Math.max(...candidates);
            } else {
                // Deep-scan nested structures for per-bucket USD volume
                const deep = extractUsd24hVolumeDeep(r);
                if (deep > 0) {
                    sum += deep;
                }
            }
        } catch {}
    }
}
                                if (sum > volume24hUsd) volume24hUsd = sum;
                            }
                        } catch (e) {
                            // ignore
                        }
                    }

                    const marketCapUsd = priceUsd * supplyTokens;

                    // Normalized result (compatible with summarizers)
                    result = {
                        success: true,
                        source: 'moralis',
                        resolved_id: 'moralis',
                        data: {
                            name: 'opensvm.com',
                            symbol: 'SVMAI',
                            current_price: { usd: priceUsd },
                            market_cap: { usd: marketCapUsd },
                            trading_volume: { usd: volume24hUsd, h24: volume24hUsd },
                            last_updated: new Date().toISOString(),
                            extra: {
                                mint,
                                supply_tokens: supplyTokens,
                                supply_raw: amount,
                                decimals,
                                pairAddress
                            }
                        }
                    };
                    console.log(`   ◈ Moralis market data retrieved: ${result.success ? 'SUCCESS' : 'FAILED'}`);
                } catch (error) {
                    result = { error: `Moralis market data error: ${(error as Error).message}` };
                    console.log(`   ◌ Moralis market data failed`);
                }
            }
            // Handle standard RPC calls
            else if (typeof conn[step.tool] === 'function') {
                if (step.input) {
                    if (step.tool === 'getAccountInfo' || step.tool === 'getBalance' ||
                        step.tool === 'getTokenSupply' || step.tool === 'getTokenLargestAccounts' ||
                        step.tool === 'getSignaturesForAddress') {
                        const { PublicKey } = await import('@solana/web3.js');
                        try {
                            // Validate input is a string before creating PublicKey
                            if (typeof step.input !== 'string' || !step.input.trim()) {
                                throw new Error(`Invalid input: expected string address, got ${typeof step.input}`);
                            }
                            const pubkey = new PublicKey(step.input);
                            if (step.tool === 'getSignaturesForAddress') {
                                result = await conn[step.tool](pubkey, { limit: 50 });
                            } else {
                                result = await conn[step.tool](pubkey);
                            }
                        } catch (error) {
                            result = { error: `Invalid address: ${(error as Error).message}` };
                        }
                    } else {
                        // Convert string numbers to actual numbers for RPC methods that need them
                        const processedInput = (typeof step.input === 'string' && /^\d+$/.test(step.input))
                            ? parseInt(step.input, 10)
                            : step.input;
                        result = await conn[step.tool](processedInput);
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
        if ((key.startsWith('tokenMarketData') || key.startsWith('moralisMarketData')) && value && value.success && value.data) {
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

        const response = await withTimeout(
            together.chat.completions.create({
                model: "openai/gpt-oss-120b",
                messages: [{ role: "user", content: reviewPrompt }],
                max_tokens: 1000,
                temperature: 0.1
            }),
            20000, // 20 second timeout for review
            "AI review"
        );

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
            if ((key.startsWith('tokenMarketData') || key.startsWith('moralisMarketData')) && value && value.success && value.data) {
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
    // Fast path: if user asked for market data and we have a deterministic header, return immediately
    try {
        const ql = (question || "").toLowerCase();
        const askedMarket = ql.includes("price") || ql.includes("market") || ql.includes("volume") || /\$[A-Z0-9]{2,10}/.test(question || "");
        if (askedMarket && tokenHeader) {
            return tokenHeader;
        }
    } catch {}

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
        const answer = await withTimeout(
            together.chat.completions.create({
                model: "openai/gpt-oss-120b",
                messages: [{ role: "system", content: synthesisPrompt }],
                stream: false,
                max_tokens: 1800,
                temperature: 0.2
            }),
            12000,
            "LLM synthesis"
        );

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
