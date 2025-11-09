import { Tool, ToolContext, ToolResult } from "./types";
import { OpenRouter } from "@openrouter/sdk";
import * as MoralisAPI from '../../../../lib/moralis-api';
import { CHART_GENERATION_PROMPT } from './chartGenerationPrompt';

interface AIPlanStep {
    tool: string;
    reason: string;
    narrative: string;
    input?: string | any;
}

export const aiPlanExecutionTool: Tool = {
    name: "aiPlanExecution",
    description: "AI-powered dynamic tool selection and execution with rich formatting and charts",

    canHandle: (context: ToolContext): boolean => {
        const { qLower, question } = context;

        // Skip for simple greetings
        if (/^(hi|hello|hey|yo|gm|hi there|ok|yes|no|thanks|thank you)$/i.test(question.trim())) {
            return false;
        }

        // Handle all analytical queries that would benefit from charts and rich formatting
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
                if (!process.env.OPENROUTER_API_KEY) {
                    console.warn('No AI API key - skipping review loop');
                    break;
                }

                // 4) Summarize for review and call review LLM
                const summary = summarizeForReview(accumulatedResults);
                const review = await reviewAnswerLLM(question, summary);

                // Guard against invalid responses
                const approved = !!review?.approved;
                console.log(`◇ Review LLM approval: ${approved ? 'APPROVED' : 'REQUIRES MORE'}`);

                // Always approve after first iteration to avoid hallucinated tools
                if (approved || iteration >= 1) {
                    if (iteration >= 1) {
                        console.log(`◇ Auto-approving after iteration ${iteration} to prevent hallucinated tools`);
                    }
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
        if (!process.env.OPENROUTER_API_KEY) {
            console.warn('No AI API key - falling back to basic plan');
            return generateBasicFallbackPlan(question);
        }

        const openRouter = new OpenRouter({
            apiKey: process.env.OPENROUTER_API_KEY,
            defaultHeaders: {
                'HTTP-Referer': 'https://opensvm.com',
                'X-Title': 'OpenSVM',
                'origin': 'https://opensvm.com'
            }
        } as any);

        const availableTools = `
Available Tools (Comprehensive)

Birdeye API (PRIMARY Market Data - requires BIRDEYE_API_KEY)
⚡ Fast, accurate, real-time Solana DEX data - USE THESE TOOLS FIRST for token analysis

- tokenMarketData(mint): Comprehensive token market data [PRIMARY TOOL FOR TOKEN ANALYSIS]
  • input: Token mint address (e.g., "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263" for BONK)
  • Returns: price, market cap, 24h volume, liquidity, holder count, supply, price changes
  • When to call: ANY token price/market query - this is your go-to tool
  • Data quality: ⭐⭐⭐⭐⭐ Most accurate and up-to-date
  • Automatic fallbacks: Birdeye → DexScreener → GeckoTerminal → RPC

- birdeyeOHLCV(address, type?, time_from?, time_to?): Historical price data & charts [ESSENTIAL FOR TRENDS]
  • address: Token mint address
  • type: "1m"|"3m"|"5m"|"15m"|"30m"|"1H"|"2H"|"4H"|"6H"|"8H"|"12H"|"1D"|"3D"|"1W"|"1M"
  • time_from/time_to: Unix timestamps in seconds (default: last 24h)
  • Returns: OHLCV candles - open, high, low, close, volume per time period
  • When to call: Price trends, technical analysis, volatility, "show me a chart", historical performance
  • Use cases: Pump detection, dump analysis, price patterns, support/resistance
  • Example: birdeyeOHLCV("BONK_ADDRESS", "1H") → last 24 hours of hourly candles

- birdeyeTokenSecurity(address): Security & holder analysis [CRITICAL FOR RISK ASSESSMENT]
  • address: Token mint address
  • Returns: Creator holdings, top holder %, freeze authority, mint authority, LP burned, honeypot risk
  • When to call: "Is this safe?", rug pull detection, security audit, holder concentration
  • Essential for: Risk analysis, whale warnings, smart contract safety

- birdeyeMultiPrice(addresses[]): Batch price lookup [EFFICIENT FOR PORTFOLIOS]
  • input: Array of token mint addresses
  • Returns: {address: price} map for all tokens
  • When to call: Portfolio valuation, multiple token queries, comparison analysis
  • Performance: Much faster than individual calls

- birdeyeTokenSearch(query, limit?): Find tokens by name/symbol [DISCOVERY TOOL]
  • query: Token name or symbol (e.g., "BONK", "Solana")
  • limit: Max results (default: 10)
  • Returns: Array of matching tokens with addresses and basic info
  • When to call: User asks about token but doesn't provide address
  • Use case: "What's the address for BONK?", "Find SOL tokens"

- birdeyeOrderbook(address, offset?): Market depth [ADVANCED - DEX PAIR REQUIRED]
  • address: DEX market/pair address (NOT token mint)
  • offset: Price levels from best bid/ask (default: 100)
  • Returns: Bids/asks orderbook snapshot
  • When to call: Liquidity depth analysis, spread analysis
  • Note: Requires pair address from tokenMarketData or token_overview

Blockchain Data API (Wallet & NFT Data)
- getTokenHolders(address): Top token holders
- getPortfolio(address, includeNftMetadata?): Wallet portfolio (SOL + tokens + NFTs)
- getTokenBalances(address): SPL token balances for a wallet
- getNativeBalance(address): SOL balance
- getNFTsForAddress(address, { nftMetadata?, limit?, cursor? }): NFTs held by wallet
- getNFTMetadata(address): NFT metadata
- getNFTCollectionStats(address): Collection stats (floor, volume, owners)
- getNFTCollectionItems(address, { limit?, nftMetadata? }): Items in collection
- getSwapsByWalletAddress(address, { limit?, cursor? }): DEX swaps by wallet
- getSwapsByTokenAddress(address, { limit?, cursor? }): DEX swaps for token
- getSPLTokenTransfers(address, { limit?, fromDate?, toDate?, cursor? }): Token transfer history
- getSOLTransfers(address, { limit?, fromDate?, toDate?, cursor? }): SOL transfer history
- getTransactionsByAddress(address, { limit?, fromDate?, toDate?, cursor? }): Transaction history
- getTransactionBySignature(signature): Transaction details
- getDomainInfo(address): Domain records for wallet
- resolveDomain(domain): Resolve .sol domain to address
- getComprehensiveBlockchainData(query): Auto-detect and fetch relevant data

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

🎯 TOOL SELECTION PRIORITY (Most Important → Least Important):

TOKEN ANALYSIS:
1. ⭐ tokenMarketData - Your PRIMARY tool (Birdeye-powered, most comprehensive)
2. ⭐ birdeyeTokenSecurity - Essential for risk/safety questions
3. ⭐ birdeyeOHLCV - Required for trends/charts/history
4. birdeyeTokenSearch - When user doesn't provide token address
5. birdeyeMultiPrice - For multiple tokens at once (efficient)
6. Solana RPC tools - ONLY when Birdeye doesn't provide what you need

WALLET/NFT ANALYSIS:
- Use Blockchain Data API tools (getPortfolio, getNFTs, etc.)

NETWORK/CHAIN STATE:
- Use Solana RPC methods (getEpochInfo, getHealth, etc.)

Notes:
- 🔥 ALWAYS try Birdeye tools FIRST for any token-related query
- tokenMarketData provides: price, volume, liquidity, market cap, holders - all in ONE call
- birdeyeTokenSecurity reveals: holder concentration, creator balance, freeze/mint authority
- birdeyeOHLCV gives you: complete price history for ANY timeframe
- Birdeye data quality: ⭐⭐⭐⭐⭐ (most accurate real-time Solana DEX data)
- If the user provides a mint address in the query, USE THAT EXACT ADDRESS
- For token discovery, use birdeyeTokenSearch("SYMBOL") to find addresses

Token Query Examples:
✅ "What's BONK price?" → birdeyeTokenSearch("BONK") + tokenMarketData(result.address)
✅ "Is X token safe?" → tokenMarketData(X) + birdeyeTokenSecurity(X)
✅ "Show price chart" → birdeyeOHLCV(address, "1H" or "1D")
✅ "Analyze token ABC..." → tokenMarketData(ABC) first, then add tools based on what analysis needs

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

        const planningPrompt = `You are an intelligent blockchain analyst. Analyze the user's question and create a COMPREHENSIVE data collection plan.

User Question: "${question}"

Additional planning context from previous review (if any):
${planningContext || "N/A"}

${availableTools}

COMPREHENSIVE DATA COLLECTION RULES:

For TOKEN ANALYSIS queries (price, market, volume, or $SYMBOL):
You MUST collect these ESSENTIAL data points using BIRDEYE-FIRST approach:

RECOMMENDED DATA COLLECTION (prioritize based on query):

1. tokenMarketData(mint) - [ALWAYS REQUIRED FOR TOKEN QUERIES]
   • Current price, market cap, 24h volume, liquidity, holders
   • Powered by Birdeye API (most accurate real-time data)
   • Returns comprehensive market metrics in ONE call

2. birdeyeTokenSecurity(mint) - [HIGHLY RECOMMENDED FOR SAFETY/RISK QUERIES]
   • Creator holdings %, top holders %, freeze/mint authority status
   • Essential for: "Is this safe?", rug detection, risk assessment
   • Reveals: Whale concentration, honeypot risks, LP status

3. birdeyeOHLCV(mint, timeframe) - [REQUIRED FOR TREND/CHART QUERIES]
   • Historical price candles for technical analysis
   • Use when query mentions: chart, trend, history, pump, dump, volatility
   • Timeframes: "15m", "1H", "1D" (choose based on analysis period)

4. getTokenLargestAccounts(mint) - [OPTIONAL - ONLY IF DETAILED HOLDER ANALYSIS NEEDED]
   • Top token holder addresses and balances
   • Use if: Need specific wallet addresses, deep holder distribution
   • NOTE: birdeyeTokenSecurity provides holder % which is usually sufficient

5. getSwapsByTokenAddress(mint, {limit: 30}) - [OPTIONAL - ONLY FOR ACTIVITY ANALYSIS]
   • Recent DEX swap transactions
   • Use if: Need trade history, manipulation detection, specific transactions
   • Keep limit LOW (30 max) for performance

CRITICAL PERFORMANCE RULES:
✅ Always use tokenMarketData FIRST - it provides 80% of what you need
✅ Use birdeyeTokenSecurity for ANY safety/risk question
✅ Use birdeyeOHLCV for ANY trend/chart/historical question
❌ DON'T call getSwapsByTokenAddress unless specifically needed for the query
❌ DON'T use getTokenLargestAccounts if birdeyeTokenSecurity suffices

DATA HIERARCHY (choose tools based on what query needs):
Level 1: tokenMarketData (price/volume/liquidity) - ALWAYS
Level 2: birdeyeTokenSecurity (safety/holders) - for risk queries
Level 3: birdeyeOHLCV (trends/charts) - for historical queries
Level 4: RPC tools (holders/swaps) - ONLY if Birdeye tools insufficient

CRITICAL RULES FOR TOKEN QUERIES:
1) If the user provides a mint address in their query, ALWAYS use that exact address - do not substitute it
2) Extract mint addresses from the query (they are 32-44 character base58 strings)
3) For token analysis with a provided mint, include data collection steps using that mint
4) If no mint address is provided, use birdeyeTokenSearch to find it by name/symbol
5) DO NOT use getEpochInfo or network tools for token queries
6) Use tokenMarketData as your PRIMARY tool - it's powered by Birdeye and provides the most complete data
7) Prioritize Birdeye tools (tokenMarketData, birdeyeOHLCV, birdeyeTokenSecurity) over RPC calls
8) Return ONLY valid JSON array, no explanatory text

TOKEN DISCOVERY (when user doesn't provide address):
- If query is like "show me BONK", "what's the price of WIF", etc.
- First use: birdeyeTokenSearch("BONK") to get the mint address
- Then use: tokenMarketData(found_address) for market data

EXAMPLE PLAN for "What's the price of BONK?":
[
  { "tool": "birdeyeTokenSearch", "reason": "Find BONK token address", "narrative": "🔍 Searching for BONK token...", "input": "BONK" },
  { "tool": "tokenMarketData", "reason": "Get current price and market data", "narrative": "💰 Fetching BONK market data...", "input": "{{BONK_ADDRESS_FROM_SEARCH}}" }
]

EXAMPLE PLAN for "Is OVSM token safe?" with address pvv4fu1RvQBkKXozyH5A843sp1mt6gTy9rPoZrBBAGS:
[
  { "tool": "tokenMarketData", "reason": "Get basic market data", "narrative": "📊 Fetching OVSM market overview...", "input": "pvv4fu1RvQBkKXozyH5A843sp1mt6gTy9rPoZrBBAGS" },
  { "tool": "birdeyeTokenSecurity", "reason": "Analyze holder concentration and security", "narrative": "🔒 Analyzing OVSM security & holders...", "input": "pvv4fu1RvQBkKXozyH5A843sp1mt6gTy9rPoZrBBAGS" }
]

EXAMPLE PLAN for "Show me BONK price chart last 24h":
[
  { "tool": "birdeyeOHLCV", "reason": "Get hourly price data for chart", "narrative": "📈 Loading 24h price history...", "input": { "address": "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", "type": "1H" } }
]

Response format (JSON only):
[
  {
    "tool": "toolName",
    "reason": "why this tool is needed",
    "narrative": "engaging description",
    "input": "parameter if needed"
  }
]

Example for "insights on token $OVSM pvv4fu1RvQBkKXozyH5A843sp1mt6gTy9rPoZrBBAGS":
[
  { "tool": "tokenMarketData", "reason": "Current price/mcap/volume/liquidity", "narrative": "📊 Fetching real-time market data", "input": "pvv4fu1RvQBkKXozyH5A843sp1mt6gTy9rPoZrBBAGS" },
  { "tool": "getTokenHolders", "reason": "Top holder analysis", "narrative": "👥 Analyzing holder distribution", "input": "pvv4fu1RvQBkKXozyH5A843sp1mt6gTy9rPoZrBBAGS" },
  { "tool": "getTokenLargestAccounts", "reason": "Whale concentration", "narrative": "� Identifying major holders", "input": "pvv4fu1RvQBkKXozyH5A843sp1mt6gTy9rPoZrBBAGS" }
]

Example for "show me hourly price chart for BONK":
[
  { "tool": "birdeyeOHLCV", "reason": "Get hourly candlestick data", "narrative": "📈 Loading price history", "input": { "address": "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", "type": "1H" } }
]`;

        const response = await withTimeout(
            openRouter.chat.send({
                model: "x-ai/grok-4-fast",
                messages: [{ role: "user", content: planningPrompt }],
                maxTokens: 2000,
                temperature: 0.1,
                stream: false
            }),
            30000, // 30 second timeout for plan generation
            "AI plan generation"
        );

        const aiResponse = (response as any).choices[0]?.message?.content?.trim();
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

    // Token detection fallback (uses Birdeye with multi-tier fallback)
    if (qLower.includes('price') || qLower.includes('market') || qLower.includes('volume') ||
        qLower.includes('token') || /\$[A-Z]{3,10}/.test(question)) {

        // Extract mint addresses from the question (44-char base58 strings)
        const mintPattern = /[1-9A-HJ-NP-Za-km-z]{32,44}/g;
        const potentialMints = question.match(mintPattern) || [];
        
        // If a mint address is provided in the query, use it directly
        if (potentialMints.length > 0) {
            return potentialMints.map(mint => ({
                tool: 'tokenMarketData',
                reason: `Get current market data for token ${mint}`,
                narrative: `▣ Getting market data for token`,
                input: mint
            }));
        }

        // If no mint address provided, return empty to avoid wrong substitutions
        console.log('⚠️ Token query without mint address - skipping automatic market data fetch');
        return [];
    }

    // Chart/OHLCV queries
    if (qLower.includes('chart') || qLower.includes('candle') || qLower.includes('ohlcv') || qLower.includes('price history')) {
        const mintPattern = /[1-9A-HJ-NP-Za-km-z]{32,44}/g;
        const potentialMints = question.match(mintPattern) || [];
        
        if (potentialMints.length > 0) {
            return potentialMints.map(mint => ({
                tool: 'birdeyeOHLCV',
                reason: `Get candlestick data for token ${mint}`,
                narrative: `📈 Loading price history`,
                input: { address: mint, type: '1H' }
            }));
        }
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

            // Handle market data - use Birdeye PRIMARY, then Moralis fallback
            if (step.tool === 'moralisMarketData' || step.tool === 'tokenMarketData') {
                try {
                    if (typeof step.input !== 'string' || !step.input) {
                        throw new Error('tokenMarketData requires mint address as input');
                    }
                    const { PublicKey } = await import('@solana/web3.js');
                    const moralisApi = await import('../../../../lib/moralis-api'); // Import once, use throughout

                    const mint = step.input;
                    const pubkey = new PublicKey(mint);

                    // 1) Get token supply from RPC
                    const supplyRes = await conn.getTokenSupply(pubkey);
                    const amount = Number(supplyRes?.value?.amount || 0);
                    const decimals = Number(supplyRes?.value?.decimals || 0);
                    const supplyTokens = decimals >= 0 ? (amount / Math.pow(10, decimals)) : 0;

                    // 2) Get price - TRY BIRDEYE FIRST (primary), then Moralis fallback
                    let priceUsd = 0;
                    let pairAddress: string | null = null;
                    let priceSource = 'unknown';

                    // Try Birdeye API first
                    if (process.env.BIRDEYE_API_KEY) {
                        try {
                            console.log(`   🐦 Fetching price from Birdeye API (PRIMARY)...`);
                            const birdeyeApi = await import('../../../../lib/birdeye-api');
                            const birdeyeData = await birdeyeApi.getTokenOverview(mint);
                            
                            if (birdeyeData && birdeyeData.price > 0) {
                                priceUsd = birdeyeData.price;
                                priceSource = 'birdeye';
                                console.log(`   ✓ Birdeye API: $${priceUsd}`);
                            } else {
                                console.log(`   ⚠️  Birdeye returned no price`);
                            }
                        } catch (e) {
                            console.log(`   ⚠️  Birdeye API error: ${(e as Error).message}`);
                        }
                    }

                    // Fallback to Moralis if Birdeye failed
                    let priceRes: any = null;
                    if (priceUsd === 0) {
                        console.log(`   ⚠️  Falling back to Moralis API...`);
                        priceRes = await moralisApi.getTokenPrice(mint, 'mainnet');
                        priceUsd = Number(
                            (priceRes?.price_usd ?? priceRes?.usdPrice ?? priceRes?.usd ?? priceRes?.price ?? 0)
                        ) || 0;
                        if (priceUsd > 0) {
                            priceSource = 'moralis';
                            console.log(`   ✓ Moralis API: $${priceUsd}`);
                        }
                    }

                    // Extract pair address from Moralis response (if available)
                    if (!pairAddress && priceRes) {
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
                            pairAddress = candidates.find(Boolean) || null;
                        } catch {}
                    }

                    // 3) Derive 24h volume - Try Birdeye first, then Moralis fallback
                    let volume24hUsd = 0;
                    
                    // Get volume from Birdeye if we got price from Birdeye
                    if (priceSource === 'birdeye' && process.env.BIRDEYE_API_KEY) {
                        try {
                            const birdeyeApi = await import('../../../../lib/birdeye-api');
                            const birdeyeData = await birdeyeApi.getTokenOverview(mint);
                            if (birdeyeData) {
                                volume24hUsd = Number(birdeyeData.v24hUSD || 0);
                                console.log(`   ✓ Birdeye 24h volume: $${volume24hUsd}`);
                            }
                        } catch (e) {
                            console.log(`   ⚠️  Birdeye volume fetch failed`);
                        }
                    }
                    
                    // Moralis volume fallback (original complex logic)
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

                    // Get token metadata for name/symbol - Try Birdeye first
                    let tokenName = 'Unknown Token';
                    let tokenSymbol = 'UNKNOWN';
                    
                    // Try getting metadata from Birdeye first (if we used Birdeye for price)
                    if (priceSource === 'birdeye' && process.env.BIRDEYE_API_KEY) {
                        try {
                            const birdeyeApi = await import('../../../../lib/birdeye-api');
                            const birdeyeData = await birdeyeApi.getTokenOverview(mint);
                            if (birdeyeData) {
                                if (birdeyeData.name) tokenName = birdeyeData.name;
                                if (birdeyeData.symbol) tokenSymbol = birdeyeData.symbol;
                                console.log(`   ✓ Token metadata from Birdeye: ${tokenSymbol}`);
                            }
                        } catch (e) {
                            console.log(`   ⚠️  Birdeye metadata fetch failed, trying Moralis...`);
                        }
                    }
                    
                    // Fallback to Moralis for metadata if needed
                    if (tokenName === 'Unknown Token') {
                        try {
                            const tokenMetadata = await moralisApi.getTokenMetadata(mint, 'mainnet');
                            if (tokenMetadata?.name) tokenName = tokenMetadata.name;
                            if (tokenMetadata?.symbol) tokenSymbol = tokenMetadata.symbol;
                            console.log(`   ✓ Token metadata from Moralis: ${tokenSymbol}`);
                        } catch (e) {
                            console.log(`   ⚠️ Could not fetch token metadata: ${(e as Error).message}`);
                        }
                    }

                    // If we still don't have price, try additional fallbacks (DexScreener, GeckoTerminal, RPC)
                    if (priceUsd === 0) {
                        console.log(`   ⚠️ No price from Birdeye or Moralis - trying additional fallbacks...`);
                        
                        try {
                            // Birdeye API fallback (for when API key might not be set above)
                            const birdeyeHeaders: HeadersInit = {
                                'Accept': 'application/json'
                            };
                            
                            // Add API key if available
                            if (process.env.BIRDEYE_API_KEY) {
                                birdeyeHeaders['X-API-KEY'] = process.env.BIRDEYE_API_KEY;
                                
                                const birdeyeUrl = `https://public-api.birdeye.so/defi/token_overview?address=${mint}`;
                                const birdeyeResp = await fetch(birdeyeUrl, { headers: birdeyeHeaders });
                                
                                if (birdeyeResp.ok) {
                                    const birdeyeJson = await birdeyeResp.json();
                                    if (birdeyeJson?.success !== false) {
                                        const birdeyeData = birdeyeJson?.data;
                                        
                                        const birdeyePrice = Number(birdeyeData?.price || 0);
                                        const birdeyeVolume24h = Number(birdeyeData?.v24hUSD || birdeyeData?.volume24h || 0);
                                        const birdeyeLiquidity = Number(birdeyeData?.liquidity || 0);
                                        
                                        if (birdeyePrice > 0) {
                                            console.log(`   ✓ Birdeye API provided price: $${birdeyePrice}, 24h volume: $${birdeyeVolume24h}`);
                                            const birdeyeMarketCap = birdeyePrice * supplyTokens;
                                            
                                            // Update token name/symbol from Birdeye if available
                                            if (birdeyeData?.name) tokenName = birdeyeData.name;
                                            if (birdeyeData?.symbol) tokenSymbol = birdeyeData.symbol;
                                            
                                            result = {
                                                success: true,
                                                source: 'birdeye-fallback',
                                                resolved_id: 'birdeye',
                                                data: {
                                                    name: tokenName,
                                                    symbol: tokenSymbol,
                                                    current_price: { usd: birdeyePrice },
                                                    market_cap: { usd: birdeyeMarketCap },
                                                    trading_volume: { usd: birdeyeVolume24h, h24: birdeyeVolume24h },
                                                    last_updated: new Date().toISOString(),
                                                    extra: {
                                                        mint,
                                                        supply_tokens: supplyTokens,
                                                        supply_raw: amount,
                                                        decimals,
                                                        liquidity: birdeyeLiquidity,
                                                        note: 'Data from Birdeye API - comprehensive token data with high accuracy.'
                                                    }
                                                }
                                            };
                                            console.log(`   ◈ Birdeye fallback successful`);
                                        } else {
                                            console.log(`   ⚠️ Birdeye returned $0 - trying DexScreener API...`);
                                        }
                                    } else {
                                        console.log(`   ⚠️ Birdeye API returned error: ${birdeyeJson?.message || 'Unknown'} - trying DexScreener API...`);
                                    }
                                }
                            } else {
                                console.log(`   ⚠️ Birdeye API key not configured - trying DexScreener API...`);
                            }
                        } catch (birdeyeError) {
                            console.log(`   ⚠️ Birdeye API failed: ${(birdeyeError as Error).message} - trying DexScreener API...`);
                        }
                    }

                    // If Moralis and Birdeye failed, try DexScreener API as second fallback
                    if (priceUsd === 0 && !result) {
                        console.log(`   ⚠️ Trying DexScreener API fallback...`);
                        
                        try {
                            // DexScreener API - free, no API key required, excellent Solana coverage
                            const dexscreenerUrl = `https://api.dexscreener.com/latest/dex/tokens/${mint}`;
                            const dexResp = await fetch(dexscreenerUrl);
                            
                            if (dexResp.ok) {
                                const dexData = await dexResp.json();
                                const pairs = dexData?.pairs || [];
                                
                                // Find the most liquid pair (highest volume)
                                const bestPair = pairs.sort((a: any, b: any) => 
                                    (Number(b?.volume?.h24 || 0) - Number(a?.volume?.h24 || 0))
                                )[0];
                                
                                if (bestPair) {
                                    const dexPrice = Number(bestPair?.priceUsd || 0);
                                    const dexVolume24h = Number(bestPair?.volume?.h24 || 0);
                                    const dexLiquidity = Number(bestPair?.liquidity?.usd || 0);
                                    
                                    if (dexPrice > 0) {
                                        console.log(`   ✓ DexScreener API provided price: $${dexPrice}, 24h volume: $${dexVolume24h}`);
                                        const dexMarketCap = dexPrice * supplyTokens;
                                        
                                        // Update token name/symbol from DexScreener if available
                                        if (bestPair?.baseToken?.name) tokenName = bestPair.baseToken.name;
                                        if (bestPair?.baseToken?.symbol) tokenSymbol = bestPair.baseToken.symbol;
                                        
                                        result = {
                                            success: true,
                                            source: 'dexscreener-fallback',
                                            resolved_id: 'dexscreener',
                                            data: {
                                                name: tokenName,
                                                symbol: tokenSymbol,
                                                current_price: { usd: dexPrice },
                                                market_cap: { usd: dexMarketCap },
                                                trading_volume: { usd: dexVolume24h, h24: dexVolume24h },
                                                last_updated: new Date().toISOString(),
                                                extra: {
                                                    mint,
                                                    supply_tokens: supplyTokens,
                                                    supply_raw: amount,
                                                    decimals,
                                                    liquidity: dexLiquidity,
                                                    pairAddress: bestPair?.pairAddress,
                                                    dexId: bestPair?.dexId,
                                                    note: 'Data from DexScreener API - using DexScreener price fallback.'
                                                }
                                            }
                                        };
                                        console.log(`   ◈ DexScreener fallback successful`);
                                    } else {
                                        console.log(`   ⚠️ DexScreener returned $0 - trying GeckoTerminal API...`);
                                    }
                                } else {
                                    console.log(`   ⚠️ DexScreener found no pairs - trying GeckoTerminal API...`);
                                }
                            }
                        } catch (dexError) {
                            console.log(`   ⚠️ DexScreener API failed: ${(dexError as Error).message} - trying GeckoTerminal API...`);
                        }
                    }

                    // If Moralis, Birdeye, and DexScreener failed, try GeckoTerminal API as third fallback
                    if (priceUsd === 0 && !result) {
                        console.log(`   ⚠️ Trying GeckoTerminal API fallback...`);
                        
                        try {
                            // GeckoTerminal API - free, no API key required, CoinGecko's DEX data
                            const geckoUrl = `https://api.geckoterminal.com/api/v2/networks/solana/tokens/${mint}`;
                            const geckoResp = await fetch(geckoUrl, {
                                headers: { 'Accept': 'application/json' }
                            });
                            
                            if (geckoResp.ok) {
                                const geckoData = await geckoResp.json();
                                const tokenData = geckoData?.data?.attributes;
                                
                                if (tokenData) {
                                    const geckoPrice = Number(tokenData?.price_usd || 0);
                                    const geckoVolume24h = Number(tokenData?.volume_usd?.h24 || 0);
                                    
                                    if (geckoPrice > 0) {
                                        console.log(`   ✓ GeckoTerminal API provided price: $${geckoPrice}, 24h volume: $${geckoVolume24h}`);
                                        const geckoMarketCap = geckoPrice * supplyTokens;
                                        
                                        // Update token name/symbol from GeckoTerminal if available
                                        if (tokenData?.name) tokenName = tokenData.name;
                                        if (tokenData?.symbol) tokenSymbol = tokenData.symbol;
                                        
                                        result = {
                                            success: true,
                                            source: 'geckoterminal-fallback',
                                            resolved_id: 'geckoterminal',
                                            data: {
                                                name: tokenName,
                                                symbol: tokenSymbol,
                                                current_price: { usd: geckoPrice },
                                                market_cap: { usd: geckoMarketCap },
                                                trading_volume: { usd: geckoVolume24h, h24: geckoVolume24h },
                                                last_updated: new Date().toISOString(),
                                                extra: {
                                                    mint,
                                                    supply_tokens: supplyTokens,
                                                    supply_raw: amount,
                                                    decimals,
                                                    note: 'Data from GeckoTerminal API - using CoinGecko DEX aggregator fallback.'
                                                }
                                            }
                                        };
                                        console.log(`   ◈ GeckoTerminal fallback successful`);
                                    } else {
                                        console.log(`   ⚠️ GeckoTerminal returned $0 - falling back to RPC-only data`);
                                    }
                                }
                            }
                        } catch (geckoError) {
                            console.log(`   ⚠️ GeckoTerminal API failed: ${(geckoError as Error).message} - falling back to RPC-only data`);
                        }
                    }

                    // If all price APIs failed (Moralis, Birdeye, DexScreener, GeckoTerminal), use RPC-only data as last resort
                    if (priceUsd === 0 && !result) {
                        console.log(`   ⚠️ All price APIs failed - falling back to RPC-only data`);
                        
                        // Try to get basic holder info from RPC
                        let holderCount = 0;
                        try {
                            const largestAccounts = await conn.getTokenLargestAccounts(pubkey);
                            if (largestAccounts?.value) {
                                const nonZeroAccounts = largestAccounts.value.filter(
                                    (account: any) => account.uiAmount && account.uiAmount > 0
                                );
                                holderCount = nonZeroAccounts.length >= 20 
                                    ? Math.floor(nonZeroAccounts.length * 5) 
                                    : nonZeroAccounts.length;
                            }
                        } catch (e) {
                            console.log(`   ⚠️ Could not get holder count: ${(e as Error).message}`);
                        }

                        result = {
                            success: true,
                            source: 'rpc-fallback',
                            resolved_id: 'solana-rpc',
                            data: {
                                name: tokenName,
                                symbol: tokenSymbol,
                                current_price: { usd: 0 },
                                market_cap: { usd: 0 },
                                trading_volume: { usd: 0, h24: 0 },
                                last_updated: new Date().toISOString(),
                                extra: {
                                    mint,
                                    supply_tokens: supplyTokens,
                                    supply_raw: amount,
                                    decimals,
                                    holders: holderCount,
                                    note: 'Price data unavailable - using RPC fallback. Token supply and holder data from Solana RPC.'
                                }
                            }
                        };
                    } else {
                        result = {
                            success: true,
                            source: 'moralis',
                            resolved_id: 'moralis',
                            data: {
                                name: tokenName,
                                symbol: tokenSymbol,
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
                    }
                    console.log(`   ◈ Market data retrieved: ${result.success ? 'SUCCESS' : 'FAILED'}`);
                } catch (error) {
                    result = { error: `Moralis market data error: ${(error as Error).message}` };
                    console.log(`   ◌ Moralis market data failed`);
                }
            }
            // Handle Birdeye OHLCV
            else if (step.tool === 'birdeyeOHLCV') {
                try {
                    if (!process.env.BIRDEYE_API_KEY) {
                        throw new Error('BIRDEYE_API_KEY not configured');
                    }
                    
                    const address = typeof step.input === 'string' ? step.input : step.input?.address;
                    if (!address) {
                        throw new Error('Token address required for birdeyeOHLCV');
                    }
                    
                    const type = step.input?.type || '15m';
                    const time_to = step.input?.time_to || Math.floor(Date.now() / 1000);
                    const time_from = step.input?.time_from || (time_to - 24 * 60 * 60); // 24h ago
                    
                    const url = `https://public-api.birdeye.so/defi/ohlcv?address=${address}&type=${type}&time_from=${time_from}&time_to=${time_to}`;
                    const response = await fetch(url, {
                        headers: {
                            'Accept': 'application/json',
                            'X-API-KEY': process.env.BIRDEYE_API_KEY
                        }
                    });
                    
                    if (!response.ok) {
                        throw new Error(`Birdeye OHLCV API returned ${response.status}`);
                    }
                    
                    const data = await response.json();
                    result = {
                        success: data.success !== false,
                        source: 'birdeye-ohlcv',
                        data: data.data || data,
                        meta: { type, time_from, time_to }
                    };
                    
                    console.log(`   ◈ Birdeye OHLCV: Retrieved ${result.data?.items?.length || 0} candles`);
                } catch (error) {
                    result = { error: `Birdeye OHLCV error: ${(error as Error).message}` };
                    console.log(`   ◌ Birdeye OHLCV failed: ${(error as Error).message}`);
                }
            }
            // Handle Birdeye Orderbook
            else if (step.tool === 'birdeyeOrderbook') {
                try {
                    if (!process.env.BIRDEYE_API_KEY) {
                        throw new Error('BIRDEYE_API_KEY not configured');
                    }
                    
                    const address = typeof step.input === 'string' ? step.input : step.input?.address;
                    if (!address) {
                        throw new Error('Token address required for birdeyeOrderbook');
                    }
                    
                    const offset = step.input?.offset || 100;
                    
                    const url = `https://public-api.birdeye.so/defi/orderbook?address=${address}&offset=${offset}`;
                    const response = await fetch(url, {
                        headers: {
                            'Accept': 'application/json',
                            'X-API-KEY': process.env.BIRDEYE_API_KEY
                        }
                    });
                    
                    if (!response.ok) {
                        throw new Error(`Birdeye Orderbook API returned ${response.status}`);
                    }
                    
                    const data = await response.json();
                    result = {
                        success: data.success !== false,
                        source: 'birdeye-orderbook',
                        data: data.data || data,
                        meta: { offset, updateUnixTime: data.data?.updateUnixTime }
                    };
                    
                    const bidCount = result.data?.bids?.length || 0;
                    const askCount = result.data?.asks?.length || 0;
                    console.log(`   ◈ Birdeye Orderbook: ${bidCount} bids, ${askCount} asks`);
                } catch (error) {
                    result = { error: `Birdeye Orderbook error: ${(error as Error).message}` };
                    console.log(`   ◌ Birdeye Orderbook failed: ${(error as Error).message}`);
                }
            }
            // Handle Birdeye Token Security
            else if (step.tool === 'birdeyeTokenSecurity') {
                try {
                    if (!process.env.BIRDEYE_API_KEY) {
                        throw new Error('BIRDEYE_API_KEY not configured');
                    }
                    
                    const address = typeof step.input === 'string' ? step.input : step.input?.address;
                    if (!address) {
                        throw new Error('Token address required for birdeyeTokenSecurity');
                    }
                    
                    const birdeyeApi = await import('../../../../lib/birdeye-api');
                    const securityData = await birdeyeApi.getTokenSecurity(address);
                    
                    if (!securityData) {
                        throw new Error('No security data returned from Birdeye');
                    }
                    
                    result = {
                        success: true,
                        source: 'birdeye-security',
                        data: securityData,
                        meta: { 
                            address,
                            analyzed_at: new Date().toISOString()
                        }
                    };
                    
                    console.log(`   ◈ Birdeye Security: Retrieved for ${address}`);
                } catch (error) {
                    result = { error: `Birdeye Token Security error: ${(error as Error).message}` };
                    console.log(`   ◌ Birdeye Token Security failed: ${(error as Error).message}`);
                }
            }
            // Handle Birdeye Multi Price
            else if (step.tool === 'birdeyeMultiPrice') {
                try {
                    if (!process.env.BIRDEYE_API_KEY) {
                        throw new Error('BIRDEYE_API_KEY not configured');
                    }
                    
                    const addresses = Array.isArray(step.input) ? step.input : 
                                     step.input?.addresses ? step.input.addresses : [];
                    
                    if (!addresses.length) {
                        throw new Error('Array of token addresses required for birdeyeMultiPrice');
                    }
                    
                    const birdeyeApi = await import('../../../../lib/birdeye-api');
                    const prices = await birdeyeApi.getMultiPrice(addresses);
                    
                    result = {
                        success: true,
                        source: 'birdeye-multiprice',
                        data: prices,
                        meta: { 
                            count: Object.keys(prices).length,
                            addresses
                        }
                    };
                    
                    console.log(`   ◈ Birdeye Multi Price: Retrieved ${Object.keys(prices).length} prices`);
                } catch (error) {
                    result = { error: `Birdeye Multi Price error: ${(error as Error).message}` };
                    console.log(`   ◌ Birdeye Multi Price failed: ${(error as Error).message}`);
                }
            }
            // Handle Birdeye Token Search
            else if (step.tool === 'birdeyeTokenSearch') {
                try {
                    if (!process.env.BIRDEYE_API_KEY) {
                        throw new Error('BIRDEYE_API_KEY not configured');
                    }
                    
                    const query = typeof step.input === 'string' ? step.input : step.input?.query;
                    if (!query) {
                        throw new Error('Search query required for birdeyeTokenSearch');
                    }
                    
                    const limit = step.input?.limit || 10;
                    
                    const birdeyeApi = await import('../../../../lib/birdeye-api');
                    const searchResults = await birdeyeApi.searchTokens(query, limit);
                    
                    result = {
                        success: true,
                        source: 'birdeye-search',
                        data: searchResults,
                        meta: { 
                            query,
                            count: searchResults.length
                        }
                    };
                    
                    console.log(`   ◈ Birdeye Token Search: Found ${searchResults.length} tokens for "${query}"`);
                } catch (error) {
                    result = { error: `Birdeye Token Search error: ${(error as Error).message}` };
                    console.log(`   ◌ Birdeye Token Search failed: ${(error as Error).message}`);
                }
            }
            // Handle other Moralis API methods
            else if (step.tool in MoralisAPI && typeof (MoralisAPI as any)[step.tool] === 'function') {
                try {
                    const moralisMethod = (MoralisAPI as any)[step.tool];
                    
                    // Parse input parameters based on method requirements
                    if (step.input) {
                        // Handle methods that take an address and optional params
                        if (step.tool === 'getSOLTransfers' || step.tool === 'getSPLTokenTransfers' || 
                            step.tool === 'getTransactionsByAddress') {
                            // These methods take (address, params, network)
                            const address = typeof step.input === 'string' ? step.input : step.input.address;
                            const params = typeof step.input === 'object' ? step.input : {};
                            result = await moralisMethod(address, params, 'mainnet');
                        }
                        // Handle methods that take just an address
                        else if (typeof step.input === 'string') {
                            result = await moralisMethod(step.input, 'mainnet');
                        }
                        // Handle methods with object parameters
                        else if (typeof step.input === 'object') {
                            // For methods like getTokenMarketData that take an object
                            result = await moralisMethod(step.input);
                        }
                        else {
                            result = await moralisMethod(step.input);
                        }
                    } else {
                        // Methods without parameters
                        result = await moralisMethod();
                    }
                    
                    console.log(`   ◈ Moralis API: ${step.tool} - ${result ? 'SUCCESS' : 'EMPTY'}`);
                } catch (error) {
                    result = { error: `Moralis API error: ${(error as Error).message}` };
                    console.log(`   ◌ Moralis API ${step.tool} failed: ${(error as Error).message}`);
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
        if (!process.env.OPENROUTER_API_KEY) {
            return { approved: true, missing: [], additional_steps: [] };
        }

        const openRouter = new OpenRouter({
            apiKey: process.env.OPENROUTER_API_KEY,
            defaultHeaders: {
                'HTTP-Referer': 'https://opensvm.com',
                'X-Title': 'OpenSVM'
            }
        } as any);

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
            openRouter.chat.send({
                model: "x-ai/grok-4-fast",
                messages: [{ role: "user", content: reviewPrompt }],
                maxTokens: 1000,
                temperature: 0.1,
                stream: false
            }),
            20000, // 20 second timeout for review
            "AI review"
        );

        const content = (response as any).choices?.[0]?.message?.content?.trim() || "";
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
    console.log('◈ OPENROUTER_API_KEY check:', process.env.OPENROUTER_API_KEY ? 'PRESENT' : 'MISSING');

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
    // Note: We always continue to LLM synthesis to generate charts, even if we have market data
    console.log('◈ Token header built, continuing to LLM synthesis...');

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
            if (process.env.OPENROUTER_API_KEY) {
                try {
                    const openRouter = new OpenRouter({
                        apiKey: process.env.OPENROUTER_API_KEY,
                        defaultHeaders: {
                            'HTTP-Referer': 'https://opensvm.com',
                            'X-Title': 'OpenSVM',
                            'origin': 'https://opensvm.com'
                        }
                    } as any);

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

                    const llm = await openRouter.chat.send({
                        model: "x-ai/grok-4-fast",
                        messages: [{ role: "system", content: analysisPrompt }],
                        maxTokens: 1200,
                        temperature: 0.2,
                        stream: false
                    });

                    const llmText = (llm as any).choices[0]?.message?.content?.trim() || '';
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

    if (!process.env.OPENROUTER_API_KEY) {
        console.log('◈ OPENROUTER_API_KEY missing, using fallback');
        return generateSimpleFallback(results, question);
    }
    console.log('◈ OPENROUTER_API_KEY present, proceeding with LLM synthesis');

    const dataContext = Object.entries(results)
        .map(([method, result]) => {
            if (result && !result.error) {
                // Truncate large validator data MUCH more aggressively to prevent context overflow
                if (method === 'getVoteAccounts' && result.current && result.current.length > 10) {
                    const truncatedResult = {
                        ...result,
                        current: result.current.slice(0, 10), // Only top 10 validators
                        delinquent: result.delinquent ? result.delinquent.slice(0, 3) : [], // Only first 3 delinquent
                        _note: `Showing 10 of ${result.current.length} validators to prevent context overflow`
                    };
                    return `${method}: ${JSON.stringify(truncatedResult, null, 2)}`;
                }
                
                // Truncate any result larger than 5KB
                let jsonString = JSON.stringify(result, null, 2);
                if (jsonString.length > 5000) {
                    jsonString = jsonString.substring(0, 5000) + '...[truncated]';
                }
                
                return `${method}: ${jsonString}`;
            } else {
                return `${method}: ERROR - ${result?.error || 'Failed'}`;
            }
        })
        .join('\n\n');

    // Compress data before sending to LLM
    const { compressed: compressedDataContext, aliasMap } = compressDataForLLM(dataContext);

    // Additional safety: hard limit to prevent context overflow (2M token limit = ~8M chars max input)
    let finalCompressedContext = compressedDataContext;
    if (finalCompressedContext.length > 500000) { // 500KB limit to stay well under 2M token budget
        console.warn(`⚠️ Compressed data still too large (${finalCompressedContext.length} chars), applying hard truncation`);
        finalCompressedContext = finalCompressedContext.substring(0, 500000) + '\n\n[...truncated for context length]';
    }

    console.log(`◪ Compressed data: ${dataContext.length} → ${finalCompressedContext.length} chars (${Math.round((1 - finalCompressedContext.length / dataContext.length) * 100)}% reduction)`);
    console.log('◈ Creating OpenRouter client...');

    const openRouter = new OpenRouter({
        apiKey: process.env.OPENROUTER_API_KEY,
        defaultHeaders: {
            'HTTP-Referer': 'https://opensvm.com',
            'X-Title': 'OpenSVM',
            'origin': 'https://opensvm.com'
        }
    } as any);

    // Build the synthesis prompt using the imported chart generation principles
    const fullPrompt = `${CHART_GENERATION_PROMPT}

Question: ${question}

Data Retrieved:
${finalCompressedContext}

Now analyze this data and create a compelling response with discovery-worthy charts.`;

    console.log('◈ Sending request to OpenRouter for synthesis...');
    console.log(`◈ Max tokens: 3500, Timeout: 45000ms`);

    try {
        const answer = await withTimeout(
            openRouter.chat.send({
                model: "x-ai/grok-4-fast",
                messages: [{ role: "user", content: fullPrompt }],
                maxTokens: 3500,  // Increased for comprehensive chart generation
                temperature: 0.2,
                stream: false
            }),
            45000,  // Increased timeout for chart generation
            "LLM synthesis"
        );

        console.log('◈ OpenRouter response structure:', JSON.stringify(answer, null, 2).substring(0, 500));
        console.log('◈ Response choices:', answer?.choices);
        console.log('◈ First choice:', answer?.choices?.[0]);
        console.log('◈ Message:', answer?.choices?.[0]?.message);
        console.log('◈ Content length:', answer?.choices?.[0]?.message?.content?.length);

        const response = (answer as any).choices[0]?.message?.content;

        if (!response || response.trim().length === 0) {
            throw new Error('Empty response from LLM');
        }

        // Decompress the response
        const decompressedResponse = decompressLLMResponse(response, aliasMap);

        console.log('◊ AI synthesis complete with decompression');
        console.log(`◊ Final response length: ${decompressedResponse.length} chars`);
        return (tokenHeader ? tokenHeader + '\n\n' : '') + decompressedResponse;

    } catch (error) {
        console.error('⚡ LLM synthesis error:', error);
        console.error('⚡ Error type:', (error as Error).constructor.name);
        console.error('⚡ Error message:', (error as Error).message);
        return generateSimpleFallback(results, question);
    }
}

function generateSimpleFallback(results: Record<string, any>, question: string): string {
    let response = `**Answer for: ${question}**\n\n`;

    // Collect token metrics for possible comparison
    const tokenSummaries: { name: string; symbol: string; price: number; marketCap: number }[] = [];

    for (const [method, result] of Object.entries(results)) {
        if (result && !result.error) {
            if ((method.startsWith('tokenMarketData') || method.startsWith('moralisMarketData')) && result.success) {
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
