import { Tool, ToolContext, ToolResult } from "./types";
import Together from "together-ai";

interface PlanStep {
    tool: string;
    reason: string;
    input?: string | any; // Allow both string and object inputs for advanced analytics
}

// Well-known DeFi protocol addresses for analysis
const DEFI_PROTOCOLS = {
    // DEX Programs
    RAYDIUM: 'RVKd61ztZW9GUwhRbbLoYVRE5Xf1B2tVscKqwZqXgEr',
    SERUM: '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin',
    ORCA: 'DjVE6JNiYqPL2QXyCUUh8rNjHrbz9hXHNYt99MQ59qw1',
    JUPITER: 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',

    // Lending Protocols  
    SOLEND: 'So1endDq2YkqhipRh3WViPa8hdiSpxWy6z3Z6tMCpAo',
    MANGO: 'mv3ekLzLbnVPNxjSKvqBpU3ZeZXPQdEC3bp5MDEBG68',

    // Yield Farming
    TULIP: 'TuLipcqtGVXP9XR62wM8WWCm6a9vhLs7T1uoWBk6FDs',
    FRANCIUM: 'FC81tbGt6JWRXidaWYFXxGnTk4VgobhJHATvTRVMqgWj',

    // Token Mints
    USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    SOL: 'So11111111111111111111111111111111111111112'
}; export const dynamicPlanExecutionTool: Tool = {
    name: "dynamicPlanExecution",
    description: "Dynamically generates and executes plans to answer user questions",

    canHandle: (context: ToolContext): boolean => {
        // Handle questions that need dynamic analysis but aren't hardcoded
        const { qLower, question } = context;

        // Don't handle if asking for examples/tutorials
        if (qLower.includes("example") || qLower.includes("how to") || qLower.includes("curl") ||
            qLower.includes("tutorial") || qLower.includes("explain how") || qLower.includes("show me how")) {
            return false;
        }

        // Don't handle simple greetings or short nonsensical queries
        if (/^(hi|hello|hey|yo|gm|hi there|ok|yes|no|thanks|thank you)$/i.test(question.trim())) {
            return false;
        }

        // Check if input looks like a potential Solana address (base58, 32-44 chars)
        const trimmedQuestion = question.trim();
        const base58Pattern = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
        const isPotentialSolanaAddress = base58Pattern.test(trimmedQuestion);

        // Be more strict about random strings - require longer length and more context
        const isRandomStringLikeAddress = trimmedQuestion.length >= 20 &&
            /^[a-zA-Z0-9\s]+$/.test(trimmedQuestion) &&
            !qLower.includes("what") && !qLower.includes("how") &&
            !qLower.includes("why") && !qLower.includes("when") &&
            !qLower.includes("explain") && !qLower.includes("tell") &&
            (qLower.includes("account") || qLower.includes("address") ||
                qLower.includes("transaction") || qLower.includes("balance"));

        // Handle analytical questions that need data fetching
        const hasAnalyticalKeywords = qLower.includes("validator") || qLower.includes("count") ||
            qLower.includes("network") || qLower.includes("current") ||
            qLower.includes("epoch") || qLower.includes("performance") ||
            qLower.includes("tps") || qLower.includes("slot") ||
            qLower.includes("leader") || qLower.includes("schedule") ||
            qLower.includes("producing") || qLower.includes("block") ||
            qLower.includes("account") || qLower.includes("balance") ||
            qLower.includes("address") || qLower.includes("transaction") ||
            qLower.includes("history") || qLower.includes("analytics") ||
            qLower.includes("analyze") || qLower.includes("check") ||
            qLower.includes("info") || qLower.includes("details") ||
            qLower.includes("defi") || qLower.includes("amm") ||
            qLower.includes("liquidity") || qLower.includes("lending") ||
            qLower.includes("yield") || qLower.includes("farming") ||
            qLower.includes("protocol") || qLower.includes("dex") ||
            qLower.includes("swap") || qLower.includes("pool") ||
            qLower.includes("active") || qLower.includes("patterns");

        // Handle explicit RPC method calls
        const hasRPCMethodNames = qLower.includes("get") && (
            qLower.includes("cluster") || qLower.includes("nodes") ||
            qLower.includes("supply") || qLower.includes("vote") ||
            qLower.includes("signatures") || qLower.includes("confirmed") ||
            qLower.includes("recent") || qLower.includes("minimum") ||
            qLower.includes("stake") || qLower.includes("inflation") ||
            qLower.includes("genesis") || qLower.includes("version") ||
            qLower.includes("identity") || qLower.includes("fees")
        );

        // Handle explicit call/execution requests
        const hasCallKeywords = qLower.includes("call") || qLower.includes("invoke") ||
            qLower.includes("execute") || qLower.includes("run") ||
            qLower.includes("show response") || qLower.includes("response of");

        // Handle RPC-specific terminology
        const hasRPCTerminology = qLower.includes("rpc") || qLower.includes("method") ||
            qLower.includes("endpoint") || qLower.includes("api");

        return hasAnalyticalKeywords || hasRPCMethodNames || hasCallKeywords || hasRPCTerminology || isPotentialSolanaAddress || isRandomStringLikeAddress;
    },

    execute: async (context: ToolContext): Promise<ToolResult> => {
        const { conn, question } = context;

        try {
            // Step 1: Generate a plan using LLM
            const plan = await generatePlan(question);
            console.log('Generated plan:', plan);

            // Step 2: Execute the plan steps
            const results = await executePlan(plan, conn);

            // Step 3: Synthesize the results into a final answer
            const finalAnswer = await synthesizeResults(context, plan, results);
            console.log('Final answer length:', finalAnswer.length);
            console.log('Final answer content:', JSON.stringify(finalAnswer));

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
            console.error('Dynamic plan execution error:', error);
            return {
                handled: false // Fall back to LLM
            };
        }
    }
};

async function generatePlan(question: string): Promise<PlanStep[]> {
    // Use intelligent rule-based planning instead of LLM calls to avoid circular dependencies
    return generateSmartPlan(question);
}

function generateSmartPlan(question: string): PlanStep[] {
    const qLower = question.toLowerCase();
    const plan: PlanStep[] = [];

    // Analyze question intent and generate appropriate plan

    // Explicit cluster nodes queries
    if (qLower.includes('getcluster') || (qLower.includes('cluster') && qLower.includes('nodes'))) {
        plan.push({
            tool: 'getClusterNodes',
            reason: 'Get cluster nodes information showing network topology and validator connectivity'
        });
    }

    // Validator-related queries
    if (qLower.includes('validator')) {
        plan.push({
            tool: 'getVoteAccounts',
            reason: 'Get current validator information including active and delinquent validators'
        });

        if (qLower.includes('network') || qLower.includes('status') || qLower.includes('overall')) {
            plan.push({
                tool: 'getEpochInfo',
                reason: 'Get current epoch and network status information'
            });
        }

        if (qLower.includes('node') || qLower.includes('cluster')) {
            plan.push({
                tool: 'getClusterNodes',
                reason: 'Get cluster node information for comprehensive validator data'
            });
        }
    }

    // Epoch-related queries
    if (qLower.includes('epoch') && !plan.some(step => step.tool === 'getEpochInfo')) {
        plan.push({
            tool: 'getEpochInfo',
            reason: 'Get current epoch information including progress and timing'
        });
    }

    // Performance/TPS queries
    if (qLower.includes('tps') || qLower.includes('performance') || qLower.includes('speed')) {
        plan.push({
            tool: 'getRecentPerformanceSamples',
            reason: 'Get recent network performance and TPS metrics'
        });

        if (!plan.some(step => step.tool === 'getEpochInfo')) {
            plan.push({
                tool: 'getEpochInfo',
                reason: 'Get current network state for performance context'
            });
        }
    }

    // Network status queries
    if (qLower.includes('network') && qLower.includes('status')) {
        if (!plan.some(step => step.tool === 'getEpochInfo')) {
            plan.push({
                tool: 'getEpochInfo',
                reason: 'Get current epoch and network information'
            });
        }
        if (!plan.some(step => step.tool === 'getVoteAccounts')) {
            plan.push({
                tool: 'getVoteAccounts',
                reason: 'Get validator status for network health assessment'
            });
        }
    }

    // Leader/block production queries
    if (qLower.includes('leader') || qLower.includes('schedule') ||
        (qLower.includes('validator') && (qLower.includes('producing') || qLower.includes('current') || qLower.includes('block')))) {
        plan.push({
            tool: 'getSlot',
            reason: 'Get current slot number for leader schedule context'
        });
        plan.push({
            tool: 'getEpochInfo',
            reason: 'Get epoch information for leader schedule analysis'
        });
        plan.push({
            tool: 'getLeaderSchedule',
            reason: 'Get the current leader schedule showing which validators will produce blocks'
        });
    }

    // Account analytics queries
    else if (qLower.includes('account') || qLower.includes('address') || qLower.includes('balance') ||
        qLower.includes('analyze') || qLower.includes('check') || qLower.includes('info') || qLower.includes('details')) {
        // Check if it looks like a Solana address (base58, roughly 32-44 chars)
        const addressPattern = /[1-9A-HJ-NP-Za-km-z]{32,44}/;
        const potentialAddress = question.match(addressPattern);

        if (potentialAddress) {
            const address = potentialAddress[0];

            // Core account information (Solana RPC)
            plan.push({
                tool: 'getAccountInfo',
                reason: 'Get basic account information including owner, data, executable status',
                input: address
            });
            plan.push({
                tool: 'getBalance',
                reason: 'Get current SOL balance in lamports',
                input: address
            });

            // Enhanced Moralis API analytics
            plan.push({
                tool: 'getMoralisPortfolio',
                reason: 'Get complete portfolio including native SOL and all token holdings with USD values',
                input: address
            });

            plan.push({
                tool: 'getMoralisTokenBalances',
                reason: 'Get detailed SPL token balances with metadata, prices, and USD values',
                input: address
            });

            plan.push({
                tool: 'getMoralisNFTs',
                reason: 'Get NFT holdings with metadata, collections, and valuations',
                input: address
            });

            plan.push({
                tool: 'getMoralisSwapHistory',
                reason: 'Get recent swap transactions and DeFi activity patterns',
                input: address
            });

            plan.push({
                tool: 'getMoralisTransactionHistory',
                reason: 'Get comprehensive transaction history with enhanced metadata',
                input: address
            });

            // Advanced financial analytics with Moralis
            plan.push({
                tool: 'getMoralisAdvancedAnalytics',
                reason: 'Get comprehensive financial analytics including PnL, fees, and volume analysis',
                input: address
            });

            plan.push({
                tool: 'getMoralisPnlAnalysis',
                reason: 'Calculate profit/loss for each token position with entry/exit prices and unrealized gains',
                input: address
            });

            plan.push({
                tool: 'getMoralisFeesAnalysis',
                reason: 'Analyze total fees paid across all transactions, swaps, and network costs',
                input: address
            });

            plan.push({
                tool: 'getMoralisInflowOutflow',
                reason: 'Get top inflow/outflow analysis by value and frequency',
                input: address
            });

            plan.push({
                tool: 'getMoralisVolumeAnalysis',
                reason: 'Get top 10 tokens by volume and top 10 transactions by USD value',
                input: address
            });

            // Enhanced Analytics Suite - Next Level Intelligence
            plan.push({
                tool: 'getMultiTimeframeAnalytics',
                reason: 'Comprehensive performance analysis across multiple timeframes with ROI and volatility metrics',
                input: { address: address, timeframes: ['7d', '30d', '90d'] }
            });

            plan.push({
                tool: 'getBehavioralPatterns',
                reason: 'Advanced behavioral analysis including trading patterns, risk tolerance, and timing analysis',
                input: { address: address, includeTimePatterns: true, includeRiskProfile: true }
            });

            plan.push({
                tool: 'getPortfolioRiskAnalytics',
                reason: 'Comprehensive risk analysis including concentration, correlation, and diversification metrics',
                input: { address: address, includeCorrelations: true, riskTimeframe: '30d' }
            });

            plan.push({
                tool: 'getPredictiveAnalytics',
                reason: 'AI-powered trend forecasting and portfolio optimization recommendations',
                input: { address: address, predictionHorizon: '7d', includeOptimization: true }
            });

            plan.push({
                tool: 'getDefiProtocolAnalytics',
                reason: 'Deep analysis of DeFi protocol interactions and yield farming performance',
                input: { address: address, includeYieldAnalysis: true }
            });

            plan.push({
                tool: 'getAiPoweredInsights',
                reason: 'Generate AI-powered insights with personalized recommendations and strategic advice',
                input: { address: address, insightTypes: ['summary', 'recommendations', 'opportunities', 'warnings'] }
            });

            plan.push({
                tool: 'getAdvancedVisualizationData',
                reason: 'Generate data for advanced visualizations including portfolio maps and correlation heatmaps',
                input: { address: address, visualizationType: 'all', timeframe: '30d' }
            });

            // Token holdings analysis (Solana RPC for comparison)
            plan.push({
                tool: 'getParsedTokenAccountsByOwner',
                reason: 'Get raw SPL token accounts from RPC for data verification',
                input: address
            });

            // Get detailed transactions for pattern analysis (Solana RPC)
            plan.push({
                tool: 'getRecentTransactionsDetails',
                reason: 'Get detailed transaction data for analyzing transfer patterns and account usage',
                input: address
            });

            // Get epoch info for context
            plan.push({
                tool: 'getEpochInfo',
                reason: 'Get current epoch context for rent exemption and timing analysis'
            });

        } else {
            // General account info request without specific address
            plan.push({
                tool: 'getEpochInfo',
                reason: 'Get current network context for account analysis'
            });
        }
    }    // Transaction analysis queries
    else if (qLower.includes('transaction') && !qLower.includes('account')) {
        // Check if it looks like a transaction signature
        const txPattern = /[1-9A-HJ-NP-Za-km-z]{64,88}/;
        const potentialTx = question.match(txPattern);

        if (potentialTx) {
            const signature = potentialTx[0];
            plan.push({
                tool: 'getTransaction',
                reason: 'Get detailed transaction information',
                input: signature
            });
        } else {
            // General transaction info - get recent performance data
            plan.push({
                tool: 'getRecentPerformanceSamples',
                reason: 'Get recent network transaction activity'
            });
        }
    }

    // Other slot queries
    else if (qLower.includes('slot')) {
        if (qLower.includes('current')) {
            plan.push({
                tool: 'getSlot',
                reason: 'Get current slot number for leader schedule context'
            });
            plan.push({
                tool: 'getEpochInfo',
                reason: 'Get epoch information for leader schedule analysis'
            });
            plan.push({
                tool: 'getLeaderSchedule',
                reason: 'Get the current leader schedule showing which validators will produce blocks'
            });
        } else if (qLower.includes('current')) {
            plan.push({
                tool: 'getSlot',
                reason: 'Get current slot number'
            });
        }
    }

    // Block height queries
    if (qLower.includes('block') && qLower.includes('height')) {
        plan.push({
            tool: 'getBlockHeight',
            reason: 'Get current block height'
        });

        // If asking for both slot and block height, add slot too
        if (qLower.includes('slot') && !plan.some(step => step.tool === 'getSlot')) {
            plan.push({
                tool: 'getSlot',
                reason: 'Get current slot number'
            });
        }
    }

    // DeFi and protocol analysis queries
    if (qLower.includes('defi') || qLower.includes('amm') || qLower.includes('liquidity') ||
        qLower.includes('lending') || qLower.includes('yield') || qLower.includes('farming') ||
        qLower.includes('protocol') || qLower.includes('dex') || qLower.includes('swap') ||
        qLower.includes('pool') || (qLower.includes('active') && qLower.includes('patterns'))) {

        // Get network performance for DeFi activity analysis
        if (!plan.some(step => step.tool === 'getRecentPerformanceSamples')) {
            plan.push({
                tool: 'getRecentPerformanceSamples',
                reason: 'Get recent network performance metrics to analyze DeFi activity levels'
            });
        }

        // Get current epoch context
        if (!plan.some(step => step.tool === 'getEpochInfo')) {
            plan.push({
                tool: 'getEpochInfo',
                reason: 'Get current epoch and network context for DeFi analysis'
            });
        }

        // Get validator information to understand network health for DeFi
        if (!plan.some(step => step.tool === 'getVoteAccounts')) {
            plan.push({
                tool: 'getVoteAccounts',
                reason: 'Get validator status to assess network stability for DeFi protocols'
            });
        }

        // Get current slot and block height for comprehensive activity context
        if (!plan.some(step => step.tool === 'getSlot')) {
            plan.push({
                tool: 'getSlot',
                reason: 'Get current slot for DeFi activity timing context'
            });
        }

        // Add intelligent DeFi analysis steps combining Solana RPC + Moralis API
        plan.push({
            tool: 'analyzeDeFiEcosystem',
            reason: 'Comprehensive DeFi ecosystem analysis using both Solana RPC and Moralis market data'
        });

        plan.push({
            tool: 'analyzeDeFiProtocolActivity',
            reason: 'Analyze specific DeFi protocol account activity and trading patterns'
        });

        plan.push({
            tool: 'analyzeDeFiMarketTrends',
            reason: 'Get real-time market trends, top gainers, and new token listings from Moralis'
        });
    }

    // Check if this might be a potential Solana address or random string that could be mistaken for one
    if (plan.length === 0) {
        const trimmedQuestion = question.trim();
        const base58Pattern = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
        const isPotentialAddress = base58Pattern.test(trimmedQuestion);

        // Also check for shorter strings or strings with spaces that might be intended as addresses
        const couldBeAddressAttempt = trimmedQuestion.length >= 10 &&
            /^[a-zA-Z0-9\s]+$/.test(trimmedQuestion) &&
            !qLower.includes("what") && !qLower.includes("how");

        if (isPotentialAddress || couldBeAddressAttempt) {
            // Remove spaces and try to validate as address
            const cleanedInput = trimmedQuestion.replace(/\s+/g, '');

            plan.push({
                tool: 'getAccountInfo',
                reason: `Check if the provided string '${trimmedQuestion}' is a valid base-58 Solana address; if not, no further action can be taken.`,
                input: cleanedInput
            });

            // Also try to get balance if it might be valid
            if (base58Pattern.test(cleanedInput)) {
                plan.push({
                    tool: 'getBalance',
                    reason: 'Get account balance if the address is valid',
                    input: cleanedInput
                });
            }
        } else {
            // Provide general network overview for other cases
            plan.push({
                tool: 'getEpochInfo',
                reason: 'Get current network status as starting point for analysis'
            });
        }
    }

    return plan;
}

// ASCII Chart Generation Functions
function generateTimelineChart(leaders: any[], currentSlot: number, rangeSlots: number): string {
    const timeBlocks = 20; // 20 time segments
    const slotsPerBlock = Math.floor(rangeSlots / timeBlocks);
    const chart = [];

    // Header
    chart.push('Timeline Chart (Next 600 minutes):');
    chart.push('Time  │' + '─'.repeat(60) + '│');
    chart.push('      │' + Array.from({ length: 6 }, (_, i) => `${i * 100}min`.padEnd(10)).join('') + '│');
    chart.push('      │' + '─'.repeat(60) + '│');

    // Activity levels for each time block
    const activity = new Array(timeBlocks).fill(0);
    leaders.forEach(leader => {
        leader.upcomingSlots.forEach((slot: number) => {
            const blockIndex = Math.floor((slot - currentSlot) / slotsPerBlock);
            if (blockIndex >= 0 && blockIndex < timeBlocks) {
                activity[blockIndex]++;
            }
        });
    });

    const maxActivity = Math.max(...activity);
    const heights = activity.map(a => Math.floor((a / maxActivity) * 10));

    // Draw bars
    for (let row = 10; row >= 0; row--) {
        let line = `${row.toString().padStart(3)}   │`;
        for (let col = 0; col < timeBlocks; col++) {
            const chars = Math.floor(60 / timeBlocks);
            const bar = heights[col] >= row ? '█'.repeat(chars) : ' '.repeat(chars);
            line += bar;
        }
        line += '│';
        chart.push(line);
    }

    chart.push('      │' + '─'.repeat(60) + '│');
    chart.push('      └' + '─'.repeat(60) + '┘');
    chart.push('');

    return chart.join('\n');
}

function generateValidatorDistributionChart(leaders: any[]): string {
    const chart = [];
    chart.push('Validator Slot Distribution:');
    chart.push('');

    // Sort by total slots and take top 15
    const sorted = leaders.sort((a, b) => b.totalNearSlots - a.totalNearSlots).slice(0, 15);
    const maxSlots = sorted[0]?.totalNearSlots || 1;

    sorted.forEach((leader, index) => {
        const shortName = leader.validator.substring(0, 8) + '...';
        const slots = leader.totalNearSlots;
        const barLength = Math.floor((slots / maxSlots) * 40);
        const bar = '█'.repeat(barLength) + '░'.repeat(40 - barLength);
        chart.push(`${(index + 1).toString().padStart(2)}. ${shortName} │${bar}│ ${slots} slots`);
    });

    chart.push('');
    return chart.join('\n');
}

function generateSlotPatternChart(leaders: any[], currentSlot: number): string {
    const chart = [];
    chart.push('Slot Assignment Pattern (Next 100 slots):');
    chart.push('');

    // Create a map of next 100 slots
    const slotMap = new Map();
    leaders.forEach(leader => {
        leader.upcomingSlots.forEach((slot: number) => {
            if (slot >= currentSlot && slot < currentSlot + 100) {
                slotMap.set(slot, leader.validator.substring(0, 6));
            }
        });
    });

    // Draw pattern
    for (let row = 0; row < 10; row++) {
        let line = `${(currentSlot + row * 10).toString().padStart(8)} │`;
        for (let col = 0; col < 10; col++) {
            const slot = currentSlot + row * 10 + col;
            const validator = slotMap.get(slot);
            line += validator ? '●' : '·';
        }
        line += '│';
        chart.push(line);
    }

    chart.push('         └' + '─'.repeat(10) + '┘');
    chart.push('Legend: ● = Assigned slot, · = Empty/Other validator');
    chart.push('');

    return chart.join('\n');
}

async function executePlan(plan: PlanStep[], conn: any): Promise<Record<string, any>> {
    const results: Record<string, any> = {};
    const startTime = Date.now();
    const MAX_EXECUTION_TIME = 25000; // 25 seconds to leave room for synthesis

    for (const step of plan) {
        // Check if we're approaching timeout
        if (Date.now() - startTime > MAX_EXECUTION_TIME) {
            console.warn(`Plan execution stopped due to timeout after ${Date.now() - startTime}ms`);
            results[step.tool] = { error: 'Execution timeout - plan truncated' };
            break;
        }

        try {
            let result;

            // Handle custom DeFi analysis methods
            if (step.tool === 'analyzeDeFiEcosystem') {
                result = await analyzeDeFiEcosystem(conn);
            } else if (step.tool === 'analyzeDeFiProtocolActivity') {
                result = await analyzeDeFiProtocolActivity(conn);
            } else if (step.tool === 'analyzeDeFiMarketTrends') {
                result = await analyzeDeFiMarketTrends();
            }
            // Handle Moralis API methods for enhanced account analysis
            else if (step.tool === 'getMoralisPortfolio' && step.input) {
                const { getPortfolio } = await import('../../../../lib/moralis-api');
                result = await getPortfolio(step.input, true, 'mainnet');
            } else if (step.tool === 'getMoralisTokenBalances' && step.input) {
                const { getTokenBalances } = await import('../../../../lib/moralis-api');
                result = await getTokenBalances(step.input, 'mainnet');
            } else if (step.tool === 'getMoralisNFTs' && step.input) {
                const { getNFTsForAddress } = await import('../../../../lib/moralis-api');
                result = await getNFTsForAddress(step.input, { nftMetadata: true, limit: 20 }, 'mainnet');
            } else if (step.tool === 'getMoralisSwapHistory' && step.input) {
                const { getSwapsByWalletAddress } = await import('../../../../lib/moralis-api');
                result = await getSwapsByWalletAddress(step.input, { limit: 100 }, 'mainnet');
            } else if (step.tool === 'getMoralisTransactionHistory' && step.input) {
                const { getTransactionsByAddress } = await import('../../../../lib/moralis-api');
                result = await getTransactionsByAddress(step.input, { limit: 50 }, 'mainnet');
            }
            // Enhanced financial analytics with Moralis
            else if (step.tool === 'getMoralisAdvancedAnalytics' && step.input) {
                // Comprehensive analytics combining multiple Moralis APIs
                const { getSwapsByWalletAddress, getTokenBalances, getPortfolio } = await import('../../../../lib/moralis-api');
                const [swaps, tokens, portfolio] = await Promise.all([
                    getSwapsByWalletAddress(step.input, { limit: 100 }, 'mainnet'),
                    getTokenBalances(step.input, 'mainnet'),
                    getPortfolio(step.input, true, 'mainnet')
                ]);
                result = {
                    address: step.input,
                    swapHistory: swaps,
                    tokenBalances: tokens,
                    portfolio: portfolio,
                    analytics: 'comprehensive_financial_analysis'
                };
            } else if (step.tool === 'getMoralisPnlAnalysis' && step.input) {
                // PnL analysis using swap history
                const { getSwapsByWalletAddress, getTokenBalances } = await import('../../../../lib/moralis-api');
                const [swaps, currentTokens] = await Promise.all([
                    getSwapsByWalletAddress(step.input, { limit: 100 }, 'mainnet'),
                    getTokenBalances(step.input, 'mainnet')
                ]);
                result = {
                    address: step.input,
                    swapHistory: swaps,
                    currentPositions: currentTokens,
                    analysis: 'position_pnl_calculation'
                };
            } else if (step.tool === 'getMoralisFeesAnalysis' && step.input) {
                // Fees analysis from transaction history
                const { getSwapsByWalletAddress } = await import('../../../../lib/moralis-api');
                const swaps = await getSwapsByWalletAddress(step.input, { limit: 100 }, 'mainnet');
                result = {
                    address: step.input,
                    transactionData: swaps,
                    analysis: 'fees_and_costs_breakdown'
                };
            } else if (step.tool === 'getMoralisInflowOutflow' && step.input) {
                // Inflow/outflow analysis
                const { getSwapsByWalletAddress } = await import('../../../../lib/moralis-api');
                const swaps = await getSwapsByWalletAddress(step.input, { limit: 100 }, 'mainnet');
                result = {
                    address: step.input,
                    transactionData: swaps,
                    analysis: 'fund_flow_patterns'
                };
            } else if (step.tool === 'getMoralisVolumeAnalysis' && step.input) {
                // Volume and top transactions analysis
                const { getSwapsByWalletAddress } = await import('../../../../lib/moralis-api');
                const swaps = await getSwapsByWalletAddress(step.input, { limit: 100 }, 'mainnet');
                result = {
                    address: step.input,
                    transactionData: swaps,
                    analysis: 'volume_and_top_transactions'
                };
            }
            // Advanced Analytics Tools
            else if (step.tool === 'getMultiTimeframeAnalytics' && step.input) {
                // Multi-timeframe performance analysis
                const { getSwapsByWalletAddress, getPortfolio } = await import('../../../../lib/moralis-api');
                const params = typeof step.input === 'object' ? step.input as any : { address: step.input };
                const [swaps, portfolio] = await Promise.all([
                    getSwapsByWalletAddress(params.address, { limit: 200 }, 'mainnet'),
                    getPortfolio(params.address, true, 'mainnet')
                ]);
                result = {
                    address: params.address,
                    timeframes: params.timeframes || ['7d', '30d', '90d'],
                    swapHistory: swaps,
                    portfolio: portfolio,
                    analysis: 'multi_timeframe_performance'
                };
            } else if (step.tool === 'getBehavioralPatterns' && step.input) {
                // Behavioral pattern analysis
                const { getSwapsByWalletAddress } = await import('../../../../lib/moralis-api');
                const params = typeof step.input === 'object' ? step.input as any : { address: step.input };
                const swaps = await getSwapsByWalletAddress(params.address, { limit: 200 }, 'mainnet');
                result = {
                    address: params.address,
                    includeTimePatterns: params.includeTimePatterns || true,
                    includeRiskProfile: params.includeRiskProfile || true,
                    swapHistory: swaps,
                    analysis: 'behavioral_patterns'
                };
            } else if (step.tool === 'getPortfolioRiskAnalytics' && step.input) {
                // Portfolio risk analysis
                const { getPortfolio, getTokenBalances, getSwapsByWalletAddress } = await import('../../../../lib/moralis-api');
                const params = typeof step.input === 'object' ? step.input as any : { address: step.input };
                const [portfolio, tokens, swaps] = await Promise.all([
                    getPortfolio(params.address, true, 'mainnet'),
                    getTokenBalances(params.address, 'mainnet'),
                    getSwapsByWalletAddress(params.address, { limit: 100 }, 'mainnet')
                ]);
                result = {
                    address: params.address,
                    includeCorrelations: params.includeCorrelations || true,
                    riskTimeframe: params.riskTimeframe || '30d',
                    portfolio: portfolio,
                    tokens: tokens,
                    swapHistory: swaps,
                    analysis: 'risk_analytics'
                };
            } else if (step.tool === 'getCompetitiveBenchmarking' && step.input) {
                // Competitive benchmarking analysis
                const { getPortfolio, getSwapsByWalletAddress } = await import('../../../../lib/moralis-api');
                const params = typeof step.input === 'object' ? step.input as any : { address: step.input };
                const [portfolio, swaps] = await Promise.all([
                    getPortfolio(params.address, true, 'mainnet'),
                    getSwapsByWalletAddress(params.address, { limit: 100 }, 'mainnet')
                ]);
                result = {
                    address: params.address,
                    benchmarkType: params.benchmarkType || 'all',
                    portfolioSize: params.portfolioSize,
                    portfolio: portfolio,
                    swapHistory: swaps,
                    analysis: 'competitive_benchmarking'
                };
            } else if (step.tool === 'getPredictiveAnalytics' && step.input) {
                // Predictive analytics
                const { getSwapsByWalletAddress, getPortfolio } = await import('../../../../lib/moralis-api');
                const params = typeof step.input === 'object' ? step.input as any : { address: step.input };
                const [swaps, portfolio] = await Promise.all([
                    getSwapsByWalletAddress(params.address, { limit: 150 }, 'mainnet'),
                    getPortfolio(params.address, true, 'mainnet')
                ]);
                result = {
                    address: params.address,
                    predictionHorizon: params.predictionHorizon || '7d',
                    includeOptimization: params.includeOptimization || true,
                    swapHistory: swaps,
                    portfolio: portfolio,
                    analysis: 'predictive_analytics'
                };
            } else if (step.tool === 'getDefiProtocolAnalytics' && step.input) {
                // DeFi protocol analytics
                const { getSwapsByWalletAddress, getPortfolio } = await import('../../../../lib/moralis-api');
                const params = typeof step.input === 'object' ? step.input as any : { address: step.input };
                const [swaps, portfolio] = await Promise.all([
                    getSwapsByWalletAddress(params.address, { limit: 200 }, 'mainnet'),
                    getPortfolio(params.address, true, 'mainnet')
                ]);
                result = {
                    address: params.address,
                    protocols: params.protocols,
                    includeYieldAnalysis: params.includeYieldAnalysis || true,
                    swapHistory: swaps,
                    portfolio: portfolio,
                    analysis: 'defi_protocol_analytics'
                };
            } else if (step.tool === 'getTokenSpecificAnalytics' && step.input) {
                // Token-specific analytics
                const { getSwapsByWalletAddress, getTokenBalances } = await import('../../../../lib/moralis-api');
                const params = typeof step.input === 'object' ? step.input as any : { address: step.input };
                const [swaps, tokens] = await Promise.all([
                    getSwapsByWalletAddress(params.address, { limit: 200 }, 'mainnet'),
                    getTokenBalances(params.address, 'mainnet')
                ]);
                result = {
                    address: params.address,
                    tokenAddress: params.tokenAddress,
                    includeMarketImpact: params.includeMarketImpact || true,
                    swapHistory: swaps,
                    tokens: tokens,
                    analysis: 'token_specific_analytics'
                };
            } else if (step.tool === 'getNftPortfolioAnalytics' && step.input) {
                // NFT portfolio analytics
                const { getNFTsForAddress } = await import('../../../../lib/moralis-api');
                const params = typeof step.input === 'object' ? step.input as any : { address: step.input };
                const nfts = await getNFTsForAddress(params.address, { nftMetadata: true, limit: 50 }, 'mainnet');
                result = {
                    address: params.address,
                    includeRarityAnalysis: params.includeRarityAnalysis || true,
                    includeMarketTrends: params.includeMarketTrends || true,
                    nfts: nfts,
                    analysis: 'nft_portfolio_analytics'
                };
            } else if (step.tool === 'getTransactionOptimization' && step.input) {
                // Transaction optimization analysis
                const { getSwapsByWalletAddress } = await import('../../../../lib/moralis-api');
                const params = typeof step.input === 'object' ? step.input as any : { address: step.input };
                const swaps = await getSwapsByWalletAddress(params.address, { limit: 100 }, 'mainnet');
                result = {
                    address: params.address,
                    optimizationType: params.optimizationType || 'all',
                    timeframe: params.timeframe || '30d',
                    swapHistory: swaps,
                    analysis: 'transaction_optimization'
                };
            } else if (step.tool === 'setupRealTimeMonitoring' && step.input) {
                // Real-time monitoring setup
                const params = typeof step.input === 'object' ? step.input as any : { address: step.input };
                result = {
                    address: params.address,
                    alertTypes: params.alertTypes || ['large_transactions', 'portfolio_changes', 'risk_alerts'],
                    thresholds: params.thresholds || {},
                    analysis: 'real_time_monitoring_setup'
                };
            } else if (step.tool === 'getCrossChainAnalytics' && step.input) {
                // Cross-chain analytics
                const { getPortfolio } = await import('../../../../lib/moralis-api');
                const params = typeof step.input === 'object' ? step.input as any : { address: step.input };
                const portfolio = await getPortfolio(params.address, true, 'mainnet');
                result = {
                    address: params.address,
                    relatedAddresses: params.relatedAddresses || [],
                    includePortfolioCorrelation: params.includePortfolioCorrelation || true,
                    portfolio: portfolio,
                    analysis: 'cross_chain_analytics'
                };
            } else if (step.tool === 'getAdvancedVisualizationData' && step.input) {
                // Advanced visualization data
                const { getPortfolio, getSwapsByWalletAddress } = await import('../../../../lib/moralis-api');
                const params = typeof step.input === 'object' ? step.input as any : { address: step.input };
                const [portfolio, swaps] = await Promise.all([
                    getPortfolio(params.address, true, 'mainnet'),
                    getSwapsByWalletAddress(params.address, { limit: 100 }, 'mainnet')
                ]);
                result = {
                    address: params.address,
                    visualizationType: params.visualizationType || 'all',
                    timeframe: params.timeframe || '30d',
                    portfolio: portfolio,
                    swapHistory: swaps,
                    analysis: 'advanced_visualization_data'
                };
            } else if (step.tool === 'getAiPoweredInsights' && step.input) {
                // AI-powered insights
                const { getPortfolio, getSwapsByWalletAddress, getTokenBalances } = await import('../../../../lib/moralis-api');
                const params = typeof step.input === 'object' ? step.input as any : { address: step.input };
                const [portfolio, swaps, tokens] = await Promise.all([
                    getPortfolio(params.address, true, 'mainnet'),
                    getSwapsByWalletAddress(params.address, { limit: 100 }, 'mainnet'),
                    getTokenBalances(params.address, 'mainnet')
                ]);
                result = {
                    address: params.address,
                    insightTypes: params.insightTypes || ['summary', 'recommendations', 'opportunities'],
                    personalityProfile: params.personalityProfile || 'auto_detect',
                    portfolio: portfolio,
                    swapHistory: swaps,
                    tokens: tokens,
                    analysis: 'ai_powered_insights'
                };
            } else if (step.tool === 'getGamificationMetrics' && step.input) {
                // Gamification metrics
                const { getSwapsByWalletAddress, getPortfolio } = await import('../../../../lib/moralis-api');
                const params = typeof step.input === 'object' ? step.input as any : { address: step.input };
                const [swaps, portfolio] = await Promise.all([
                    getSwapsByWalletAddress(params.address, { limit: 200 }, 'mainnet'),
                    getPortfolio(params.address, true, 'mainnet')
                ]);
                result = {
                    address: params.address,
                    includeLeaderboards: params.includeLeaderboards || true,
                    includeAchievements: params.includeAchievements || true,
                    swapHistory: swaps,
                    portfolio: portfolio,
                    analysis: 'gamification_metrics'
                };
            }
            // Handle custom account analysis methods
            else if (step.tool === 'getParsedTokenAccountsByOwner' && step.input) {
                // Get SPL token accounts for the address
                const { PublicKey } = await import('@solana/web3.js');
                const tokenProgramId = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
                result = await conn.getParsedTokenAccountsByOwner(new PublicKey(step.input), {
                    programId: tokenProgramId
                });
            } else if (step.tool === 'getRecentTransactionsDetails' && step.input) {
                // Get detailed transaction data for analysis
                const { PublicKey } = await import('@solana/web3.js');
                try {
                    const signatures = await conn.getSignaturesForAddress(new PublicKey(step.input), { limit: 10 });
                    const detailedTxs = await Promise.all(
                        signatures.slice(0, 5).map(async (sig: any) => {
                            try {
                                const tx = await conn.getParsedTransaction(sig.signature, {
                                    maxSupportedTransactionVersion: 0
                                });
                                return { signature: sig, transaction: tx };
                            } catch (e) {
                                return { signature: sig, transaction: null, error: (e as Error).message };
                            }
                        })
                    );
                    result = detailedTxs;
                } catch (error) {
                    result = { error: (error as Error).message };
                }
            }
            // Check if the method exists on the connection object
            else if (typeof conn[step.tool] === 'function') {
                // Add timeout wrapper for RPC calls to prevent hanging
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error(`RPC call ${step.tool} timed out after 10 seconds`)), 10000);
                });

                const rpcCallPromise = (async () => {
                    // Handle methods that need specific parameters
                    if (step.tool === 'getRecentPerformanceSamples') {
                        return await conn[step.tool](20);
                    } else if (step.input) {
                        // If step has input parameter, pass it
                        // For Solana RPC methods that need PublicKey, convert string to PublicKey
                        if (step.tool === 'getAccountInfo' || step.tool === 'getBalance') {
                            const { PublicKey } = await import('@solana/web3.js');
                            try {
                                const pubkey = new PublicKey(step.input);
                                return await conn[step.tool](pubkey);
                            } catch (error) {
                                return { error: `Invalid address for ${step.tool}: ${(error as Error).message}` };
                            }
                        } else {
                            return await conn[step.tool](step.input);
                        }
                    } else {
                        // Call method without parameters
                        return await conn[step.tool]();
                    }
                })();

                try {
                    result = await Promise.race([rpcCallPromise, timeoutPromise]);
                } catch (error) {
                    result = { error: `RPC call failed: ${(error as Error).message}` };
                }
            } else {
                console.warn(`Method ${step.tool} not found on connection object`);
                results[step.tool] = { error: `Method ${step.tool} not available` };
                continue;
            }

            results[step.tool] = result;

            // Debug logging for leader schedule
            if (step.tool === 'getLeaderSchedule' && result) {
                console.log(`[DEBUG] ${step.tool} result type:`, typeof result);
                if (typeof result === 'object' && result !== null) {
                    const entries = Object.entries(result);
                    console.log(`[DEBUG] ${step.tool} entries count:`, entries.length);
                    console.log(`[DEBUG] ${step.tool} first 3 entries:`, entries.slice(0, 3));
                }
            }

        } catch (error) {
            console.error(`Error executing ${step.tool}:`, error);
            results[step.tool] = { error: (error as Error).message };
        }
    }

    console.log('[DEBUG] All plan results:', Object.keys(results));
    return results;
}

// Enhanced DeFi Analysis Functions using both Solana RPC and Moralis API

async function analyzeDeFiEcosystem(conn: any): Promise<any> {
    try {
        console.log('Starting comprehensive DeFi ecosystem analysis...');
        const ecosystem = {
            networkMetrics: {} as any,
            protocolActivity: [] as any[],
            marketTrends: {} as any,
            liquidityAnalysis: {} as any,
            summary: '' as string
        };

        // Step 1: Network performance analysis (Solana RPC)
        try {
            const performance = await conn.getRecentPerformanceSamples(20);
            if (Array.isArray(performance) && performance.length > 0) {
                const validSamples = performance.filter(s => s && typeof s.numTransactions === 'number' && s.samplePeriodSecs > 0);
                if (validSamples.length > 0) {
                    const avgTps = validSamples.reduce((acc, s) => acc + (s.numTransactions / s.samplePeriodSecs), 0) / validSamples.length;
                    const maxTps = Math.max(...validSamples.map(s => s.numTransactions / s.samplePeriodSecs));
                    ecosystem.networkMetrics = {
                        avgTps: Math.round(avgTps),
                        maxTps: Math.round(maxTps),
                        samples: validSamples.length,
                        defiActivityLevel: avgTps > 2000 ? 'High' : avgTps > 1000 ? 'Medium' : 'Low'
                    };
                }
            }
        } catch (error) {
            console.warn('Network metrics analysis failed:', error);
            ecosystem.networkMetrics = { error: 'Failed to fetch network metrics' };
        }

        // Step 2: Moralis market trends analysis
        try {
            // Import Moralis functions dynamically to avoid import issues
            const { getTopGainers, getTopTokens, getTrendingTokens } = await import('../../../../lib/moralis-api');

            const [topGainers, topTokens, trending] = await Promise.allSettled([
                getTopGainers(10, 'mainnet'),
                getTopTokens(20, 'mainnet'),
                getTrendingTokens(10, '24h', 'mainnet')
            ]);

            ecosystem.marketTrends = {
                topGainers: topGainers.status === 'fulfilled' ? topGainers.value : null,
                topTokens: topTokens.status === 'fulfilled' ? topTokens.value : null,
                trending: trending.status === 'fulfilled' ? trending.value : null
            };
        } catch (error) {
            console.warn('Moralis market trends analysis failed:', error);
            ecosystem.marketTrends = { error: 'Failed to fetch market trends from Moralis' };
        }

        // Step 3: Major protocol analysis
        const protocolPromises = Object.entries(DEFI_PROTOCOLS).map(async ([name, address]) => {
            try {
                const [accountInfo, balance] = await Promise.all([
                    conn.getAccountInfo(address),
                    conn.getBalance(address)
                ]);

                return {
                    name,
                    address,
                    balance: balance || 0,
                    status: accountInfo?.value ? 'Active' : 'Inactive',
                    executable: accountInfo?.value?.executable || false,
                    dataSize: accountInfo?.value?.data?.length || 0
                };
            } catch (error) {
                return {
                    name,
                    address,
                    status: 'Error',
                    error: (error as Error).message
                };
            }
        });

        ecosystem.protocolActivity = await Promise.all(protocolPromises);

        // Generate intelligent summary
        const activeProtocols = ecosystem.protocolActivity.filter(p => p.status === 'Active').length;
        const networkActivity = ecosystem.networkMetrics.defiActivityLevel || 'Unknown';

        ecosystem.summary = `DeFi Ecosystem Health: ${activeProtocols}/${ecosystem.protocolActivity.length} protocols active, Network activity: ${networkActivity}`;

        return ecosystem;
    } catch (error) {
        console.error('Error in analyzeDeFiEcosystem:', error);
        return { error: (error as Error).message };
    }
}

async function analyzeDeFiProtocolActivity(conn: any): Promise<any> {
    try {
        console.log('Analyzing DeFi protocol activity patterns...');
        const activity = {
            dexAnalysis: {} as any,
            lendingAnalysis: {} as any,
            yieldFarmingAnalysis: {} as any,
            tokenData: {} as any
        };

        // Analyze DEX protocols
        const dexProtocols = ['RAYDIUM', 'SERUM', 'ORCA', 'JUPITER'];
        const dexResults = await Promise.allSettled(
            dexProtocols.map(async (protocol) => {
                const address = DEFI_PROTOCOLS[protocol as keyof typeof DEFI_PROTOCOLS];
                try {
                    // Get swap data from Moralis if available
                    const { getSwapsByTokenAddress } = await import('../../../../lib/moralis-api');
                    const swaps = await getSwapsByTokenAddress(address, { limit: 10 }, 'mainnet');

                    const accountInfo = await conn.getAccountInfo(address);
                    return {
                        protocol,
                        swapActivity: swaps,
                        accountActive: !!accountInfo?.value,
                        accountData: accountInfo?.value
                    };
                } catch (error) {
                    return {
                        protocol,
                        error: (error as Error).message
                    };
                }
            })
        );

        activity.dexAnalysis = dexResults.map((result, index) => ({
            protocol: dexProtocols[index],
            data: result.status === 'fulfilled' ? result.value : { error: 'Failed to analyze' }
        }));

        // Analyze major tokens with price data
        const majorTokens = ['USDC', 'USDT', 'SOL'];
        try {
            const { getTokenPrice } = await import('../../../../lib/moralis-api');
            const tokenPrices = await Promise.allSettled(
                majorTokens.map(token => {
                    const address = DEFI_PROTOCOLS[token as keyof typeof DEFI_PROTOCOLS];
                    return getTokenPrice(address, 'mainnet');
                })
            );

            activity.tokenData = majorTokens.map((token, index) => ({
                token,
                address: DEFI_PROTOCOLS[token as keyof typeof DEFI_PROTOCOLS],
                priceData: tokenPrices[index].status === 'fulfilled' ? tokenPrices[index].value : null
            }));
        } catch (error) {
            console.warn('Token price analysis failed:', error);
            activity.tokenData = { error: 'Failed to fetch token prices' };
        }

        return activity;
    } catch (error) {
        console.error('Error in analyzeDeFiProtocolActivity:', error);
        return { error: (error as Error).message };
    }
}

async function analyzeDeFiMarketTrends(): Promise<any> {
    try {
        console.log('Analyzing DeFi market trends with Moralis API...');
        const trends = {
            newListings: null as any,
            marketData: null as any,
            topPerformers: null as any,
            insights: [] as string[]
        };

        try {
            const { getNewListings, getTokenMarketData, getTopGainers } = await import('../../../../lib/moralis-api');

            // Get comprehensive market data
            const [newListings, marketData, topGainers] = await Promise.allSettled([
                getNewListings(20, 7, 'mainnet'),
                getTokenMarketData({ limit: 50, sort_by: 'volume', sort_order: 'desc' }, 'mainnet'),
                getTopGainers(15, 'mainnet')
            ]);

            trends.newListings = newListings.status === 'fulfilled' ? newListings.value : null;
            trends.marketData = marketData.status === 'fulfilled' ? marketData.value : null;
            trends.topPerformers = topGainers.status === 'fulfilled' ? topGainers.value : null;

            // Generate insights
            if (trends.newListings && Array.isArray(trends.newListings)) {
                trends.insights.push(`${trends.newListings.length} new tokens listed in the past 7 days`);
            }

            if (trends.topPerformers && Array.isArray(trends.topPerformers)) {
                const avgGain = trends.topPerformers
                    .slice(0, 5)
                    .reduce((acc, token) => acc + (token.priceChange24h || 0), 0) / 5;
                trends.insights.push(`Top 5 gainers averaging ${avgGain.toFixed(2)}% 24h change`);
            }

            if (trends.marketData && trends.marketData.tokens) {
                trends.insights.push(`Market analysis includes ${trends.marketData.tokens.length} tokens by volume`);
            }

        } catch (error) {
            console.warn('Moralis API calls failed:', error);
            trends.insights.push('Market trend analysis limited due to API access');
        }

        return trends;
    } catch (error) {
        console.error('Error in analyzeDeFiMarketTrends:', error);
        return { error: (error as Error).message };
    }
}

async function synthesizeResults(context: ToolContext, plan: PlanStep[], results: Record<string, any>): Promise<string> {
    const { question } = context;
    console.log(`Synthesizing results for ${plan.length} plan steps:`, plan.map(p => p.tool).join(', '));

    if (!process.env.TOGETHER_API_KEY) {
        throw new Error("TOGETHER_API_KEY environment variable is not set");
    }

    // Extract requested number of validators from question
    const numberMatch = question.match(/top\s+(\d+)|(\d+)\s+validators?/i);
    const requestedCount = numberMatch ? parseInt(numberMatch[1] || numberMatch[2]) : 10;
    console.log(`[DEBUG] Requested validator count: ${requestedCount}`);

    // Special processing for leader schedule to handle requested count
    if (results['getLeaderSchedule'] && typeof results['getLeaderSchedule'] === 'object') {
        const scheduleResult = results['getLeaderSchedule'];
        const scheduleEntries = Object.entries(scheduleResult);
        const currentSlotInfo = results['getSlot'];
        const epochInfo = results['getEpochInfo'];

        if (currentSlotInfo && epochInfo) {
            const currentSlotInEpoch = epochInfo.slotIndex;
            const currentLeaders = [];
            // 600 minutes = 36,000 seconds = ~90,000 slots (each slot ~400ms)
            const nearFutureRange = 90000;

            for (const [validatorPubkey, slots] of scheduleEntries) {
                if (Array.isArray(slots)) {
                    const nearSlots = slots.filter(slot =>
                        slot >= currentSlotInEpoch &&
                        slot <= currentSlotInEpoch + nearFutureRange
                    );

                    if (nearSlots.length > 0) {
                        currentLeaders.push({
                            validator: validatorPubkey,
                            upcomingSlots: nearSlots.slice(0, 5),
                            totalNearSlots: nearSlots.length
                        });
                    }
                }
            }

            currentLeaders.sort((a, b) => a.upcomingSlots[0] - b.upcomingSlots[0]);
            const sampleSize = Math.min(requestedCount, currentLeaders.length);
            const currentSample = currentLeaders.slice(0, sampleSize);

            // Update the results with processed leader schedule
            results['getLeaderSchedule'] = {
                processedData: `Current/upcoming leaders around slot ${currentSlotInEpoch} (next 600 minutes):
${currentSample.map(leader =>
                    `  ${leader.validator} will produce blocks at slots: ${leader.upcomingSlots.join(', ')}${leader.totalNearSlots > 5 ? ` (and ${leader.totalNearSlots - 5} more)` : ''}`
                ).join('\n')}
${currentLeaders.length > sampleSize ? `  ... and ${currentLeaders.length - sampleSize} more validators with upcoming slots` : ''}
Total validators in epoch: ${scheduleEntries.length}`
            };
        }
    }

    // Prepare data context for LLM
    const dataContext = Object.entries(results)
        .map(([method, result]) => {
            if (result && !result.error) {
                // Handle processed leader schedule data
                if (method === 'getLeaderSchedule' && result.processedData) {
                    return `${method}: ${result.processedData}`;
                }

                // Handle original leader schedule fallback
                if (method === 'getLeaderSchedule' && result && typeof result === 'object' && !result.processedData) {
                    const scheduleEntries = Object.entries(result);
                    const sampleSize = Math.min(requestedCount, scheduleEntries.length);
                    const sample = scheduleEntries.slice(0, sampleSize);

                    return `${method}: Leader schedule retrieved with ${scheduleEntries.length} validators. Sample entries:
${sample.map(([validator, slots]) => `  ${validator} has ${Array.isArray(slots) ? slots.length : 'unknown'} slots`).join('\n')}
${scheduleEntries.length > sampleSize ? `  ... and ${scheduleEntries.length - sampleSize} more validators` : ''}`;
                }

                // Handle account information
                if (method === 'getAccountInfo' && result && result.value) {
                    const account = result.value;
                    return `${method}: Account found - Owner: ${account.owner}, Lamports: ${account.lamports} (${(account.lamports / 1e9).toFixed(4)} SOL), Data size: ${account.data?.length || 0} bytes, Executable: ${account.executable}`;
                }

                // Handle Moralis portfolio data
                if (method === 'getMoralisPortfolio' && result) {
                    let portfolioSummary = `${method}: Portfolio Analysis:\n`;

                    if (result.tokens && Array.isArray(result.tokens)) {
                        const totalTokens = result.tokens.length;
                        const tokensWithValue = result.tokens.filter((t: any) => t.usdValue && parseFloat(t.usdValue) > 0);
                        portfolioSummary += `  • ${totalTokens} tokens held (${tokensWithValue.length} with USD value)\n`;

                        // Show top tokens by value
                        const topTokens = tokensWithValue
                            .sort((a: any, b: any) => parseFloat(b.usdValue || '0') - parseFloat(a.usdValue || '0'))
                            .slice(0, 5);

                        if (topTokens.length > 0) {
                            portfolioSummary += `  Top holdings:\n`;
                            topTokens.forEach((token: any, i: number) => {
                                portfolioSummary += `    ${i + 1}. ${token.symbol || 'Unknown'}: $${parseFloat(token.usdValue).toFixed(2)} (${token.amount} tokens)\n`;
                            });
                        }
                    }

                    if (result.nativeBalance) {
                        portfolioSummary += `  • Native SOL: ${result.nativeBalance.solana || 'N/A'} SOL`;
                        if (result.nativeBalance.usdValue) {
                            portfolioSummary += ` ($${parseFloat(result.nativeBalance.usdValue).toFixed(2)})`;
                        }
                        portfolioSummary += '\n';
                    }

                    if (result.nfts && Array.isArray(result.nfts)) {
                        portfolioSummary += `  • ${result.nfts.length} NFTs owned\n`;
                    }

                    return portfolioSummary;
                }

                // Handle Moralis token balances
                if (method === 'getMoralisTokenBalances' && result && Array.isArray(result)) {
                    if (result.length > 0) {
                        const tokenSummary = result.slice(0, 10).map((token: any, index: number) => {
                            const symbol = token.symbol || 'Unknown';
                            const amount = token.amount || '0';
                            const decimals = token.decimals || 0;
                            const usdValue = token.usdValue ? ` ($${parseFloat(token.usdValue).toFixed(2)})` : '';
                            return `    ${index + 1}. ${symbol}: ${amount} (${decimals} decimals)${usdValue}`;
                        }).join('\n');

                        return `${method}: Found ${result.length} token holdings:\n${tokenSummary}${result.length > 10 ? `\n    ... and ${result.length - 10} more tokens` : ''}`;
                    } else {
                        return `${method}: No token holdings found`;
                    }
                }

                // Handle Moralis NFT data
                if (method === 'getMoralisNFTs' && result && Array.isArray(result)) {
                    if (result.length > 0) {
                        const nftSummary = result.slice(0, 5).map((nft: any, index: number) => {
                            const name = nft.name || nft.metadata?.name || 'Unnamed NFT';
                            const collection = nft.collection || 'Unknown Collection';
                            const mint = nft.mint || 'Unknown';
                            return `    ${index + 1}. ${name} (${collection}) - Mint: ${mint}`;
                        }).join('\n');

                        return `${method}: Found ${result.length} NFTs:\n${nftSummary}${result.length > 5 ? `\n    ... and ${result.length - 5} more NFTs` : ''}`;
                    } else {
                        return `${method}: No NFTs found`;
                    }
                }

                // Handle Moralis swap history
                if (method === 'getMoralisSwapHistory' && result && Array.isArray(result)) {
                    if (result.length > 0) {
                        const swapSummary = result.slice(0, 5).map((swap: any, index: number) => {
                            const fromToken = swap.fromTokenSymbol || 'Unknown';
                            const toToken = swap.toTokenSymbol || 'Unknown';
                            const fromAmount = swap.fromTokenAmount || '0';
                            const toAmount = swap.toTokenAmount || '0';
                            const date = swap.blockTime ? new Date(swap.blockTime * 1000).toLocaleDateString() : 'Unknown';
                            return `    ${index + 1}. ${fromAmount} ${fromToken} → ${toAmount} ${toToken} (${date})`;
                        }).join('\n');

                        return `${method}: Found ${result.length} swap transactions:\n${swapSummary}${result.length > 5 ? `\n    ... and ${result.length - 5} more swaps` : ''}`;
                    } else {
                        return `${method}: No swap transactions found`;
                    }
                }

                // Handle Moralis transaction history
                if (method === 'getMoralisTransactionHistory' && result && Array.isArray(result)) {
                    if (result.length > 0) {
                        const txSummary = result.slice(0, 5).map((tx: any, index: number) => {
                            const signature = tx.signature || 'Unknown';
                            const type = tx.type || 'Unknown';
                            const status = tx.status || 'Unknown';
                            const date = tx.blockTime ? new Date(tx.blockTime * 1000).toLocaleDateString() : 'Unknown';
                            const fee = tx.fee ? `${(tx.fee / 1e9).toFixed(6)} SOL` : 'Unknown';
                            return `    ${index + 1}. ${signature} - ${type} (${status}) - Fee: ${fee} (${date})`;
                        }).join('\n');

                        return `${method}: Found ${result.length} transactions:\n${txSummary}${result.length > 5 ? `\n    ... and ${result.length - 5} more transactions` : ''}`;
                    } else {
                        return `${method}: No transactions found`;
                    }
                }

                // Handle token accounts data  
                if (method === 'getParsedTokenAccountsByOwner' && result && result.value) {
                    const tokenAccounts = result.value;
                    if (tokenAccounts.length > 0) {
                        const tokenList = tokenAccounts.slice(0, 10).map((token: any, index: number) => {
                            const mint = token.account.data.parsed.info.mint;
                            const amount = token.account.data.parsed.info.tokenAmount.uiAmount || 0;
                            const decimals = token.account.data.parsed.info.tokenAmount.decimals;
                            return `  ${index + 1}. Mint: ${mint}, Amount: ${amount} (${decimals} decimals)`;
                        }).join('\n');

                        return `${method}: Found ${tokenAccounts.length} SPL token accounts:
${tokenList}
${tokenAccounts.length > 10 ? `... and ${tokenAccounts.length - 10} more tokens` : ''}`;
                    } else {
                        return `${method}: No SPL token accounts found`;
                    }
                }

                // Handle detailed transaction analysis
                if (method === 'getRecentTransactionsDetails' && Array.isArray(result)) {
                    const validTxs = result.filter(tx => tx.transaction && !tx.error);
                    if (validTxs.length > 0) {
                        const txSummary = validTxs.map((tx: any, index: number) => {
                            const txData = tx.transaction;
                            const fee = txData.meta?.fee || 0;
                            const success = !txData.meta?.err;
                            const accounts = txData.transaction?.message?.accountKeys?.length || 0;
                            const instructions = txData.transaction?.message?.instructions?.length || 0;
                            const blockTime = txData.blockTime ? new Date(txData.blockTime * 1000).toLocaleString() : 'Unknown';

                            return `  ${index + 1}. ${tx.signature.signature} - ${success ? 'Success' : 'Failed'}, Fee: ${(fee / 1e9).toFixed(6)} SOL, ${accounts} accounts, ${instructions} instructions, Time: ${blockTime}`;
                        }).join('\n');

                        return `${method}: Analyzed ${validTxs.length} detailed transactions:
${txSummary}`;
                    } else {
                        return `${method}: No valid transaction details found`;
                    }
                }

                // Handle transaction signatures list
                if (method === 'getConfirmedSignaturesForAddress2' && Array.isArray(result)) {
                    const sampleSize = Math.min(5, result.length);
                    const sample = result.slice(0, sampleSize);
                    return `${method}: Found ${result.length} recent transactions. Sample signatures:
${sample.map(tx => `  ${tx.signature} (Slot: ${tx.slot}, ${tx.err ? 'Failed' : 'Success'})`).join('\n')}
${result.length > sampleSize ? `  ... and ${result.length - sampleSize} more transactions` : ''}`;
                }

                // Handle detailed transaction data
                if (method === 'getTransaction' && result) {
                    const tx = result;
                    const fee = tx.meta?.fee || 0;
                    const success = !tx.meta?.err;
                    const accounts = tx.transaction?.message?.accountKeys?.length || 0;
                    return `${method}: Transaction ${success ? 'succeeded' : 'failed'} - Fee: ${fee} lamports, Accounts involved: ${accounts}, Block time: ${tx.blockTime || 'unknown'}`;
                }

                // Handle vote accounts data with requested count
                if (method === 'getVoteAccounts' && result && (result.current || result.delinquent)) {
                    const current = result.current || [];
                    const delinquent = result.delinquent || [];
                    const allValidators = [...current, ...delinquent];

                    // Sort by activated stake (descending)
                    const sortedValidators = allValidators.sort((a, b) => (b.activatedStake || 0) - (a.activatedStake || 0));

                    const sampleSize = Math.min(requestedCount, sortedValidators.length);
                    const topValidators = sortedValidators.slice(0, sampleSize);

                    const validatorList = topValidators.map((validator, index) => {
                        const stake = validator.activatedStake || 0;
                        const commission = validator.commission || 0;
                        const votePubkey = validator.votePubkey || 'unknown';
                        const nodePubkey = validator.nodePubkey || 'unknown';
                        return `  ${index + 1}. ${stake} lamports - vote: ${votePubkey}, node: ${nodePubkey} (${commission}% commission)`;
                    }).join('\n');

                    console.log(`[DEBUG] Generated validator list has ${validatorList.length} characters and ${sampleSize} validators`);

                    return `${method}: Top ${sampleSize} validators by stake:
${validatorList}
${sortedValidators.length > sampleSize ? `... and ${sortedValidators.length - sampleSize} more validators` : ''}
Total: ${current.length} active, ${delinquent.length} delinquent`;
                }

                // Handle DeFi protocol analysis
                if (method === 'analyzeDeFiProtocols' && result && result.protocols) {
                    const activeProtocols = result.protocols.filter((p: any) => p.status === 'Active');
                    const summary = `DeFi Protocol Analysis: ${result.activeProtocols}/${result.totalAccounts} protocols active`;
                    const protocolDetails = activeProtocols.slice(0, 5).map((p: any) =>
                        `  ${p.name}: ${(p.balance / 1e9).toFixed(4)} SOL, ${p.executable ? 'Program' : 'Account'}`
                    ).join('\n');
                    return `${method}: ${summary}\n${protocolDetails}${activeProtocols.length > 5 ? '\n  ... and more' : ''}`;
                }

                // Handle DeFi token analysis
                if (method === 'analyzeDeFiTokens' && result && result.tokens) {
                    const tokenSummary = result.tokens.map((t: any) =>
                        `  ${t.name}: ${(t.balance / 1e9).toFixed(4)} SOL (${t.accountType})`
                    ).join('\n');
                    return `${method}: Major DeFi Token Analysis:\n${tokenSummary}`;
                }

                // Handle DeFi activity analysis
                if (method === 'analyzeDeFiActivity' && result) {
                    let activitySummary = `${method}: DeFi Activity Analysis:\n`;

                    if (result.networkMetrics && result.networkMetrics.avgTps) {
                        activitySummary += `  Network: ${result.networkMetrics.avgTps} avg TPS (${result.networkMetrics.minTps}-${result.networkMetrics.maxTps} range)\n`;
                    }

                    if (result.defiInferences && result.defiInferences.length > 0) {
                        activitySummary += `  Insights: ${result.defiInferences.slice(0, 3).join('; ')}\n`;
                    }

                    if (result.liquidityIndicators && result.liquidityIndicators.length > 0) {
                        activitySummary += `  Liquidity: ${result.liquidityIndicators[0]}\n`;
                    }

                    return activitySummary;
                }

                // Handle other large datasets by limiting size
                let jsonString = JSON.stringify(result, null, 2);
                if (jsonString.length > 10000) {
                    // Truncate very large responses
                    jsonString = jsonString.substring(0, 10000) + '... [truncated]';
                }

                return `${method}: ${jsonString}`;
            } else {
                return `${method}: ERROR - ${result?.error || 'Failed to retrieve data'}`;
            }
        })
        .join('\n\n');

    console.log(`[DEBUG] Data context being sent to LLM (${dataContext.length} characters):`, dataContext.substring(0, 1000) + '...');

    const together = new Together({
        apiKey: process.env.TOGETHER_API_KEY,
    });

    const synthesisPrompt = `You are a Solana blockchain analyst. Your task is to format the retrieved data into a clear response using ONLY the actual data provided. Do not add specifics that aren't in the raw data.

Question: ${question}

Data Retrieved:
${dataContext}

Instructions:
- Use ONLY the exact data provided - do not add specific validator addresses, slot counts, or other details not explicitly shown
- EXCEPTION: When the user requests a specific number of validators (like "top 50 validators") and the raw data contains that full list, show ALL requested validators in a CONCISE format to fit within response limits
- If the data shows "921 validators" then say "921 validators" - don't make up which specific validators or their exact slot counts
- For leader schedules, summarize the overall structure rather than citing specific validator performance
- CRITICAL: Always show FULL addresses, transaction signatures, and mint addresses - NEVER truncate them with "..." or abbreviations
- All Solana addresses are 32-44 characters long and must be shown in their entirety for usability
- Transaction signatures are 64-88 characters and must be displayed completely
- Token mint addresses must be shown in full for verification purposes
- For balances, use the exact amounts provided
- For transaction data, use only the signatures and details actually returned
- Keep the response factual and based strictly on the retrieved data
- For validator lists with many entries, use a compact format like: "Rank. Stake lamports (Commission%)"
- Format clearly with headers and structure, but avoid speculation or creative analysis
- If data is missing or incomplete, state that clearly
- When showing validator lists, include all details provided: stake amounts, addresses, commission rates
- VISUAL CHARTS: When appropriate (especially for validator rankings, leader schedules, or time-based data), create ASCII charts or graphs to visually represent the data. Use characters like |, -, *, #, █, ░, ▓ to create bar charts, timelines, or distribution visualizations that help explain patterns in the data
- For leader schedules over time periods, consider creating ASCII timelines showing when validators lead
- For validator rankings, consider ASCII bar charts showing relative stake sizes
- For time-based analysis, create ASCII graphs showing trends or distributions
- Be creative with ASCII visualization while staying strictly factual to the data

Answer based strictly on the provided data:`;

    try {
        // Add timeout to LLM synthesis
        const llmTimeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('LLM synthesis timed out after 25 seconds')), 25000);
        });

        const llmCallPromise = together.chat.completions.create({
            model: "openai/gpt-oss-120b",
            messages: [
                {
                    role: "system",
                    content: synthesisPrompt
                }
            ],
            stream: false,
            max_tokens: 120000, // Reduced from 81920 to prevent timeouts
        });

        const answer = await Promise.race([llmCallPromise, llmTimeoutPromise]) as any;

        const response = answer.choices?.[0]?.message?.content || "Failed to synthesize results";
        console.log('LLM synthesized response:', response);
        return response;

    } catch (error) {
        console.error('Error synthesizing results with LLM:', error);

        // Fallback: provide a simple data summary if LLM fails
        let fallback = `Based on the executed plan, here's what was found:\n\n`;

        for (const [method, result] of Object.entries(results)) {
            if (result && !result.error) {
                switch (method) {
                    case 'getSlot':
                        fallback += `Current slot: ${result}\n`;
                        break;
                    case 'getBlockHeight':
                        fallback += `Current block height: ${result}\n`;
                        break;
                    case 'getEpochInfo':
                        const progress = ((result.slotIndex / result.slotsInEpoch) * 100).toFixed(2);
                        fallback += `Epoch ${result.epoch}: slot ${result.slotIndex}/${result.slotsInEpoch} (${progress}% complete)\n`;
                        break;
                    case 'getVoteAccounts':
                        const active = result.current?.length || 0;
                        const delinquent = result.delinquent?.length || 0;
                        fallback += `Validators: ${active + delinquent} total (${active} active, ${delinquent} delinquent)\n`;

                        // If user asked for top validators, show them sorted by stake
                        if (context.qLower.includes('top') || context.qLower.includes('best') || context.qLower.includes('first')) {
                            if (result.current && Array.isArray(result.current) && result.current.length > 0) {
                                // Extract number from user's question (e.g., "top 10", "best 5", "first 20")
                                const extractNumber = (text: string): number => {
                                    const matches = text.match(/(?:top|best|first|show)\s+(\d+)/i);
                                    if (matches && matches[1]) {
                                        const num = parseInt(matches[1]);
                                        return num > 0 && num <= 100 ? num : 10; // Default to 10, max 100
                                    }
                                    return 10; // Default fallback
                                };

                                const requestedCount = extractNumber(context.question);

                                // Sort validators by activated stake (descending)
                                const sortedValidators = result.current
                                    .filter((v: any) => v && typeof v.activatedStake === 'string')
                                    .sort((a: any, b: any) => parseInt(b.activatedStake) - parseInt(a.activatedStake))
                                    .slice(0, requestedCount);

                                if (sortedValidators.length > 0) {
                                    fallback += `\nTop ${sortedValidators.length} Validators by Stake:\n`;
                                    sortedValidators.forEach((validator: any, index: number) => {
                                        const stakeSOL = (parseInt(validator.activatedStake) / 1e9).toFixed(0);
                                        const commission = validator.commission || 0;
                                        const identity = validator.nodePubkey || 'Unknown';
                                        const shortIdentity = identity.substring(0, 8) + '...' + identity.substring(identity.length - 4);
                                        fallback += `${index + 1}. ${shortIdentity} - ${parseInt(stakeSOL).toLocaleString()} SOL (${commission}% commission)\n`;
                                    });
                                }
                            }
                        }
                        break;
                    case 'getRecentPerformanceSamples':
                        if (Array.isArray(result) && result.length > 0) {
                            const valid = result.filter(s => s && typeof s.numTransactions === "number" && s.samplePeriodSecs > 0);
                            if (valid.length > 0) {
                                const avgTps = Math.round(
                                    valid.reduce((acc, s) => acc + (s.numTransactions / s.samplePeriodSecs), 0) / valid.length
                                );
                                fallback += `Network performance: ~${avgTps} TPS average\n`;
                            }
                        }
                        break;
                    case 'getLeaderSchedule':
                        if (result && typeof result === 'object') {
                            const scheduleEntries = Object.entries(result);
                            const sampleSize = Math.min(5, scheduleEntries.length);
                            const sample = scheduleEntries.slice(0, sampleSize);
                            fallback += `Leader schedule: ${scheduleEntries.length} slots assigned\n`;
                            fallback += `Sample assignments:\n`;
                            sample.forEach(([slot, pubkey]) => {
                                fallback += `  Slot ${slot}: ${pubkey}\n`;
                            });
                            if (scheduleEntries.length > sampleSize) {
                                fallback += `  ... and ${scheduleEntries.length - sampleSize} more\n`;
                            }
                        }
                        break;
                    case 'getAccountInfo':
                        if (result && result.value) {
                            const account = result.value;
                            fallback += `Account Info: ${(account.lamports / 1e9).toFixed(4)} SOL, Owner: ${account.owner}\n`;
                        } else {
                            fallback += `Account: Not found or empty\n`;
                        }
                        break;
                    case 'getBalance':
                        if (typeof result === 'number') {
                            fallback += `Balance: ${(result / 1e9).toFixed(4)} SOL\n`;
                        }
                        break;
                    case 'getConfirmedSignaturesForAddress2':
                        if (Array.isArray(result)) {
                            const successful = result.filter(tx => !tx.err).length;
                            const failed = result.length - successful;
                            fallback += `Transaction History: ${result.length} transactions (${successful} successful, ${failed} failed)\n`;
                        }
                        break;
                    case 'getTransaction':
                        if (result) {
                            const success = !result.meta?.err;
                            const fee = result.meta?.fee || 0;
                            fallback += `Transaction: ${success ? 'Success' : 'Failed'}, Fee: ${fee} lamports\n`;
                        }
                        break;
                    default:
                        fallback += `${method}: Data retrieved successfully\n`;
                }
            } else {
                fallback += `${method}: ${result?.error || 'Failed'}\n`;
            }
        }

        return fallback.trim() || 'No data could be retrieved';
    }
}
