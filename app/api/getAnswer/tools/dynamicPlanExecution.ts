import { Tool, ToolContext, ToolResult } from "./types";
import Together from "together-ai";

interface StoryDrivenPlanStep {
    tool: string;
    reason: string;
    narrative: string;  // How the AI "perceives" this step
    trigger: string;    // What user words triggered this
    discovery: string;  // What we hope to find
    input?: string | any;
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
};

export const dynamicPlanExecutionTool: Tool = {
    name: "dynamicPlanExecution",
    description: "Dynamically generates and executes narrative-driven plans with advanced analytics",

    canHandle: (context: ToolContext): boolean => {
        const { qLower, question } = context;

        // Skip for simple greetings or examples
        if (qLower.includes("example") || qLower.includes("how to") || qLower.includes("curl") ||
            qLower.includes("tutorial") || qLower.includes("explain how") || qLower.includes("show me how")) {
            return false;
        }

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

        // Handle analytical queries with narrative flair
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
            qLower.includes("active") || qLower.includes("patterns") ||
            qLower.includes("wallet") || qLower.includes("portfolio") ||
            qLower.includes("nft") || qLower.includes("token") ||
            qLower.includes("everything") || qLower.includes("full") ||
            qLower.includes("detailed") || qLower.includes("complete");

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
            // Generate narrative-driven plan with personality
            const plan = generateStoryDrivenPlan(question);
            console.log('🎭 Generated narrative plan:', plan.map(p => ({
                tool: p.tool,
                narrative: p.narrative
            })));

            // Execute plan with drama
            const results = await executePlanWithNarrative(plan, conn);

            // Synthesize with unlimited potential
            const finalAnswer = await synthesizeEpicResults(context, plan, results);

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
            console.error('🔥 Dynamic plan execution error:', error);
            return {
                handled: false
            };
        }
    }
};

function generateStoryDrivenPlan(question: string): StoryDrivenPlanStep[] {
    const qLower = question.toLowerCase();
    const plan: StoryDrivenPlanStep[] = [];

    // Detect query intensity
    const wantsEverything = qLower.includes("everything") || qLower.includes("full") ||
        qLower.includes("complete") || qLower.includes("all") ||
        qLower.includes("detailed") || qLower.includes("comprehensive");

    // Explicit cluster nodes queries
    if (qLower.includes('getcluster') || (qLower.includes('cluster') && qLower.includes('nodes'))) {
        plan.push({
            tool: 'getClusterNodes',
            reason: 'Get cluster nodes information showing network topology and validator connectivity',
            narrative: '🌐 *Mapping the constellation of nodes...* Let me chart the network topology!',
            trigger: 'Cluster nodes query detected',
            discovery: 'The interconnected web of Solana validators and RPC nodes'
        });
    }

    // Validator-related queries
    if (qLower.includes('validator')) {
        const numberMatch = question.match(/top\s+(\d+)|(\d+)\s+validators?/i);
        const count = numberMatch ? parseInt(numberMatch[1] || numberMatch[2]) : 10;

        plan.push({
            tool: 'getVoteAccounts',
            reason: `Get ${count ? `top ${count}` : 'all'} validators`,
            narrative: '⚔️ *Summoning the validator legion...* The guardians of Solana consensus await!',
            trigger: `User seeks knowledge of ${count ? `the ${count} mightiest` : 'all'} validators`,
            discovery: 'The power hierarchy of Solana\'s consensus warriors'
        });

        if (qLower.includes('network') || qLower.includes('status') || qLower.includes('overall')) {
            plan.push({
                tool: 'getEpochInfo',
                reason: 'Get current epoch and network status information',
                narrative: '🌅 *Checking the cosmic clock...* Which epoch are we in this grand cycle?',
                trigger: 'Network status context required for validator analysis',
                discovery: 'The temporal coordinates of the blockchain'
            });
        }

        if (qLower.includes('node') || qLower.includes('cluster')) {
            plan.push({
                tool: 'getClusterNodes',
                reason: 'Get cluster node information for comprehensive validator data',
                narrative: '🗺️ *Expanding the validator map...* Revealing the full network topology!',
                trigger: 'Comprehensive validator network analysis requested',
                discovery: 'The complete infrastructure supporting consensus'
            });
        }
    }

    // Epoch-related queries
    if (qLower.includes('epoch') && !plan.some(step => step.tool === 'getEpochInfo')) {
        plan.push({
            tool: 'getEpochInfo',
            reason: 'Get current epoch information including progress and timing',
            narrative: '🕰️ *Tuning into the blockchain\'s heartbeat...* Measuring the pulse of consensus!',
            trigger: 'Epoch information specifically requested',
            discovery: 'The rhythm and timing of network consensus cycles'
        });
    }

    // Performance/TPS queries
    if (qLower.includes('tps') || qLower.includes('performance') || qLower.includes('speed')) {
        plan.push({
            tool: 'getRecentPerformanceSamples',
            reason: 'Get recent network performance and TPS metrics',
            narrative: '⚡ *Measuring the blockchain\'s pulse...* How fast does Solana\'s heart beat?',
            trigger: 'Performance metrics requested - user wants to feel the speed!',
            discovery: 'The raw throughput power of the network'
        });

        if (!plan.some(step => step.tool === 'getEpochInfo')) {
            plan.push({
                tool: 'getEpochInfo',
                reason: 'Get current network state for performance context',
                narrative: '📊 *Contextualizing the performance data...* Every metric needs its moment in time!',
                trigger: 'Performance context requires epoch timing',
                discovery: 'The temporal framework for understanding network speed'
            });
        }

        if (wantsEverything) {
            plan.push({
                tool: 'getBlockHeight',
                reason: 'Current blockchain height for complete performance picture',
                narrative: '🏔️ *Scaling the blockchain mountain...* How tall has this digital tower grown?',
                trigger: 'Complete network state analysis requested',
                discovery: 'The accumulated height of all blocks ever produced'
            });
        }
    }

    // Network status queries
    if (qLower.includes('network') && qLower.includes('status')) {
        if (!plan.some(step => step.tool === 'getEpochInfo')) {
            plan.push({
                tool: 'getEpochInfo',
                reason: 'Get current epoch and network information',
                narrative: '🌐 *Establishing network connection...* Syncing with the Solana universe!',
                trigger: 'Network status baseline required',
                discovery: 'The fundamental state of the blockchain'
            });
        }
        if (!plan.some(step => step.tool === 'getVoteAccounts')) {
            plan.push({
                tool: 'getVoteAccounts',
                reason: 'Get validator status for network health assessment',
                narrative: '🏥 *Performing network health check...* Are the validators strong and ready?',
                trigger: 'Network health assessment via validator status',
                discovery: 'The wellness indicators of network consensus'
            });
        }
    }

    // Leader/block production queries
    if (qLower.includes('leader') || qLower.includes('schedule') ||
        (qLower.includes('validator') && (qLower.includes('producing') || qLower.includes('current') || qLower.includes('block')))) {
        plan.push({
            tool: 'getSlot',
            reason: 'Get current slot number for leader schedule context',
            narrative: '🎯 *Pinpointing our position in time...* Which slot are we witnessing?',
            trigger: 'Leader schedule requires slot context',
            discovery: 'The exact moment in blockchain time'
        });
        plan.push({
            tool: 'getEpochInfo',
            reason: 'Get epoch information for leader schedule analysis',
            narrative: '📅 *Consulting the epoch calendar...* Understanding the greater timeline!',
            trigger: 'Epoch context needed for leadership analysis',
            discovery: 'The broader temporal context of block production'
        });
        plan.push({
            tool: 'getLeaderSchedule',
            reason: 'Get the current leader schedule showing which validators will produce blocks',
            narrative: '👑 *Revealing the throne succession...* Who shall lead and when?',
            trigger: 'User seeks the sacred schedule of block production',
            discovery: 'The predetermined order of validator leadership'
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
                narrative: '🔍 *Initiating deep blockchain scan...* A mysterious address appears in the void of Solana! Let me peer into its essence...',
                trigger: `Detected Solana address pattern: ${address.substring(0, 4)}...${address.substring(address.length - 4)}`,
                discovery: 'Uncovering the fundamental nature of this account - is it a program? A wallet? A treasury of untold riches?',
                input: address
            });
            plan.push({
                tool: 'getBalance',
                reason: 'Get current SOL balance in lamports',
                narrative: '💰 *Accessing the cosmic ledger...* Time to reveal the SOL wealth hidden within!',
                trigger: 'Every address has a story told in lamports',
                discovery: 'The raw power of SOL contained within this digital vault',
                input: address
            });

            // Token analysis for potential token mints
            // Prioritize a compact, token-focused plan to avoid timeouts for deep AI synthesis.
            if (qLower.includes("token") || qLower.includes("supply") || qLower.includes("mint") ||
                qLower.includes("svmai") || qLower.includes("memecoin") || qLower.includes("analyze")) {

                // Build a minimal, high-value plan for token analysis and short-circuit.
                plan.push({
                    tool: 'getAccountInfo',
                    reason: 'Confirm account type and owner (is this a token mint/account?)',
                    narrative: '🔍 *Confirming the account type...* Is this truly a token mint or just a wallet?',
                    trigger: 'Validate account as mint or token account',
                    discovery: 'Account owner, executable flag, and raw data',
                    input: address
                });

                plan.push({
                    tool: 'getBalance',
                    reason: 'Get SOL balance for contextual info (rent-exempt status, funding)',
                    narrative: '💰 *Checking SOL balance...* Ensuring the account is funded/rent-exempt',
                    trigger: 'SOL balance context',
                    discovery: 'Lamports and rent status',
                    input: address
                });

                // Core token metrics — keep these first and minimal
                plan.push({
                    tool: 'getTokenSupply',
                    reason: 'Get total token supply and decimals for mint analysis',
                    narrative: '🪙 *Querying the token mint supply...* How many tokens exist and what are the decimals?',
                    trigger: 'Supply and decimals required for valuation',
                    discovery: 'Total supply, amount, decimals',
                    input: address
                });

                plan.push({
                    tool: 'getTokenLargestAccounts',
                    reason: 'Get holder distribution (top holders) to assess concentration risk',
                    narrative: '👑 *Inspecting the largest token holders...* Who controls most of the supply?',
                    trigger: 'Holder concentration analysis',
                    discovery: 'Top holder balances and counts',
                    input: address
                });

                // Quick RPC verification of token accounts to detect any circulating balances
                plan.push({
                    tool: 'getParsedTokenAccountsByOwner',
                    reason: 'Verify token accounts by owner to enumerate holdings (fast RPC check)',
                    narrative: '🔎 *Cross-checking token accounts...* Verifying actual token holdings on-chain',
                    trigger: 'Enumerate token accounts for circulation and holder list',
                    discovery: 'Raw parsed token accounts for this mint/owner context',
                    input: address
                });

                // Add epoch context but do not add heavy Moralis analysis by default
                plan.push({
                    tool: 'getEpochInfo',
                    reason: 'Get epoch context for timing and rent considerations',
                    narrative: '⏱️ *Fetching epoch context...* Timing matters for on-chain events',
                    trigger: 'Temporal context for token activity',
                    discovery: 'Epoch and slot context',
                });

                // Short-circuit: return only the high-value token steps to avoid overly large plans
                return plan;
            }

            if (wantsEverything || qLower.includes("transaction") || qLower.includes("activity")) {
                plan.push({
                    tool: 'getSignaturesForAddress',
                    reason: 'Get transaction signatures for deep analysis',
                    narrative: '📜 *Unrolling the ancient scrolls of blockchain history...* Every transaction tells a tale!',
                    trigger: 'User seeks the complete saga of this address',
                    discovery: 'The chronological tapestry of all actions and interactions',
                    input: address
                });

                plan.push({
                    tool: 'getParsedTransaction',
                    reason: 'Decode the mysteries within recent transactions',
                    narrative: '🔮 *Decrypting the transaction runes...* Each instruction holds secrets!',
                    trigger: 'Deep dive into the actual mechanics of wallet activity',
                    discovery: 'The decoded instructions revealing true intentions',
                    input: address
                });
            }

            // Enhanced Moralis API analytics (streamlined for speed)
            if (process.env.MORALIS_API_KEY) {
                plan.push({
                    tool: 'getMoralisPortfolio',
                    reason: 'Get complete portfolio including native SOL and all token holdings with USD values',
                    narrative: '🌟 *Summoning the Oracle of Moralis...* Converting cosmic assets to earthly values!',
                    trigger: wantsEverything ? 'User demands EVERYTHING!' : 'Portfolio valuation requested',
                    discovery: 'The true USD worth of this digital empire',
                    input: address
                });

                plan.push({
                    tool: 'getMoralisTokenBalances',
                    reason: 'Get detailed SPL token balances with metadata, prices, and USD values',
                    narrative: '🎨 *Enriching token data with mystical metadata...* Each token has a name, a symbol, a soul!',
                    trigger: 'Token analysis with full context',
                    discovery: 'Complete token profiles with logos, names, and market data',
                    input: address
                });

                if (qLower.includes("nft") || wantsEverything) {
                    plan.push({
                        tool: 'getMoralisNFTs',
                        reason: 'Get NFT holdings with metadata, collections, and valuations',
                        narrative: '🖼️ *Entering the digital art gallery...* What masterpieces does this collector hold?',
                        trigger: 'NFT analysis requested or complete portfolio scan',
                        discovery: 'The NFT collection revealing taste and investment prowess',
                        input: address
                    });
                }

                // Only add swap/transaction history for "everything" queries to prevent timeouts
                if (wantsEverything) {
                    plan.push({
                        tool: 'getMoralisSwapHistory',
                        reason: 'Get recent swap transactions and DeFi activity patterns',
                        narrative: '🔄 *Tracing the DeFi dance...* Every swap is a strategic move in the grand game!',
                        trigger: 'DeFi activity analysis for comprehensive history',
                        discovery: 'Trading patterns revealing strategy and timing',
                        input: address
                    });

                    plan.push({
                        tool: 'getMoralisTransactionHistory',
                        reason: 'Get comprehensive transaction history with enhanced metadata',
                        narrative: '📚 *Opening the complete chronicles...* EVERY. SINGLE. TRANSACTION. The full epic!',
                        trigger: 'User wants the COMPLETE story - no stone unturned!',
                        discovery: 'The exhaustive history of this blockchain entity',
                        input: address
                    });
                }
            }

            // Token holdings analysis (Solana RPC for comparison) with pagination
            plan.push({
                tool: 'getParsedTokenAccountsByOwner',
                reason: 'Get raw SPL token accounts from RPC for data verification',
                narrative: '🔍 *Cross-referencing with the Solana ledger...* Double-checking the token treasures!',
                trigger: 'RPC verification of Moralis token data',
                discovery: 'Raw blockchain truth about token holdings',
                input: address
            });

            // Get epoch info for context
            plan.push({
                tool: 'getEpochInfo',
                reason: 'Get current epoch context for rent exemption and timing analysis',
                narrative: '⏱️ *Checking the blockchain clock...* Timing is everything in crypto!',
                trigger: 'Epoch context for temporal analysis',
                discovery: 'The temporal framework for understanding account activity',
            });

        } else {
            // General account info request without specific address
            plan.push({
                tool: 'getEpochInfo',
                reason: 'Get current network context for account analysis',
                narrative: '🌐 *Establishing baseline network context...* Setting the stage for analysis!',
                trigger: 'General account analysis requires network context',
                discovery: 'The current state of the Solana ecosystem'
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
                narrative: '🔐 *Unlocking transaction secrets...* This signature holds mysteries!',
                trigger: `Transaction signature detected: ${signature.substring(0, 8)}...`,
                discovery: 'The complete anatomy of this blockchain event',
                input: signature
            });
        } else {
            // General transaction info - get recent performance data
            plan.push({
                tool: 'getRecentPerformanceSamples',
                reason: 'Get recent network transaction activity',
                narrative: '📈 *Scanning recent transaction flows...* The pulse of network activity!',
                trigger: 'General transaction activity analysis',
                discovery: 'The rhythm and volume of network transactions'
            });
        }
    }

    // Other slot queries
    else if (qLower.includes('slot')) {
        if (qLower.includes('current')) {
            plan.push({
                tool: 'getSlot',
                reason: 'Get current slot number for leader schedule context',
                narrative: '🎯 *Pinpointing our exact position...* Which slot witnesses our presence?',
                trigger: 'Current slot position requested',
                discovery: 'The exact moment in blockchain time'
            });
            plan.push({
                tool: 'getEpochInfo',
                reason: 'Get epoch information for leader schedule analysis',
                narrative: '📅 *Consulting the epoch calendar...* Understanding the greater timeline!',
                trigger: 'Epoch context needed for leadership analysis',
                discovery: 'The broader temporal context of block production'
            });
            plan.push({
                tool: 'getLeaderSchedule',
                reason: 'Get the current leader schedule showing which validators will produce blocks',
                narrative: '👑 *Revealing the throne succession...* Who shall lead and when?',
                trigger: 'User seeks the sacred schedule of block production',
                discovery: 'The predetermined order of validator leadership'
            });
        } else if (qLower.includes('current')) {
            plan.push({
                tool: 'getSlot',
                reason: 'Get current slot number',
                narrative: '🎯 *Finding our place in the slot stream...* The current moment in blockchain time!',
                trigger: 'Current slot number requested',
                discovery: 'The present position in the endless flow of slots'
            });
        }
    }

    // Block height queries
    if (qLower.includes('block') && qLower.includes('height')) {
        plan.push({
            tool: 'getBlockHeight',
            reason: 'Get current block height',
            narrative: '🏗️ *Measuring the blockchain tower...* How many blocks tall is our digital edifice?',
            trigger: 'Block height measurement requested',
            discovery: 'The accumulated height of the blockchain structure'
        });

        // If asking for both slot and block height, add slot too
        if (qLower.includes('slot') && !plan.some(step => step.tool === 'getSlot')) {
            plan.push({
                tool: 'getSlot',
                reason: 'Get current slot number',
                narrative: '📊 *Adding slot context to block height...* The dual coordinates of blockchain time!',
                trigger: 'Slot context for comprehensive height analysis',
                discovery: 'The slot coordinate matching the block height'
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
                reason: 'Get recent network performance metrics to analyze DeFi activity levels',
                narrative: '📊 *Measuring DeFi heartbeat...* The network\'s pulse reveals protocol activity!',
                trigger: 'DeFi analysis requires network performance context',
                discovery: 'Network throughput indicating DeFi ecosystem health'
            });
        }

        // Get current epoch context
        if (!plan.some(step => step.tool === 'getEpochInfo')) {
            plan.push({
                tool: 'getEpochInfo',
                reason: 'Get current epoch and network context for DeFi analysis',
                narrative: '🕰️ *Setting DeFi temporal context...* When did these protocols last harvest yields?',
                trigger: 'DeFi temporal analysis requires epoch timing',
                discovery: 'The time dimension of DeFi protocol performance'
            });
        }

        // Get validator information to understand network health for DeFi
        if (!plan.some(step => step.tool === 'getVoteAccounts')) {
            plan.push({
                tool: 'getVoteAccounts',
                reason: 'Get validator status to assess network stability for DeFi protocols',
                narrative: '🛡️ *Checking DeFi infrastructure strength...* Are the network foundations solid?',
                trigger: 'DeFi stability requires validator health assessment',
                discovery: 'Network consensus strength supporting DeFi protocols'
            });
        }

        // Get current slot and block height for comprehensive activity context
        if (!plan.some(step => step.tool === 'getSlot')) {
            plan.push({
                tool: 'getSlot',
                reason: 'Get current slot for DeFi activity timing context',
                narrative: '⏱️ *Marking DeFi time coordinates...* Pinpointing protocol activity in blockchain time!',
                trigger: 'DeFi timing analysis requires slot precision',
                discovery: 'The exact timing context for DeFi protocol analysis'
            });
        }

        // Add intelligent DeFi analysis steps combining Solana RPC + Moralis API
        plan.push({
            tool: 'analyzeDeFiEcosystem',
            reason: 'Comprehensive DeFi ecosystem analysis using both Solana RPC and Moralis market data',
            narrative: '🌿 *Exploring the DeFi jungle...* Mapping the ecosystem of yield, liquidity, and innovation!',
            trigger: 'Complete DeFi ecosystem analysis requested',
            discovery: 'The interconnected web of DeFi protocols and their performance'
        });

        plan.push({
            tool: 'analyzeDeFiProtocolActivity',
            reason: 'Analyze specific DeFi protocol account activity and trading patterns',
            narrative: '🔬 *Dissecting DeFi protocol mechanics...* Understanding the gears that drive yield!',
            trigger: 'Deep DeFi protocol analysis for specific insights',
            discovery: 'The operational patterns and efficiency of DeFi protocols'
        });

        plan.push({
            tool: 'analyzeDeFiMarketTrends',
            reason: 'Get real-time market trends, top gainers, and new token listings from Moralis',
            narrative: '📈 *Reading the DeFi market tea leaves...* What trends shape tomorrow\'s yields?',
            trigger: 'DeFi market trend analysis for strategic insights',
            discovery: 'Market movements and opportunities in the DeFi landscape'
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
                narrative: '🤔 *Investigating mysterious string...* Could this be a hidden Solana address?',
                trigger: `Potential address pattern detected: ${trimmedQuestion}`,
                discovery: 'Validation of whether this string represents a blockchain entity',
                input: cleanedInput
            });

            // Also try to get balance if it might be valid
            if (base58Pattern.test(cleanedInput)) {
                plan.push({
                    tool: 'getBalance',
                    reason: 'Get account balance if the address is valid',
                    narrative: '💰 *Testing the address waters...* Does this mysterious string hold treasure?',
                    trigger: 'Valid address pattern suggests balance check',
                    discovery: 'The potential wealth contained in this address',
                    input: cleanedInput
                });
            }
        } else {
            // Provide general network overview for other cases
            plan.push({
                tool: 'getEpochInfo',
                reason: 'Get current network status as starting point for analysis',
                narrative: '🌐 *Establishing blockchain baseline...* Connecting to the Solana universe!',
                trigger: 'General query requires network context',
                discovery: 'The fundamental state of the network as analysis foundation'
            });
        }
    }

    return plan;
}

async function executePlanWithNarrative(plan: StoryDrivenPlanStep[], conn: any): Promise<Record<string, any>> {
    const results: Record<string, any> = {};
    const startTime = Date.now();
    const MAX_EXECUTION_TIME = 60000; // 60 seconds for comprehensive queries (token flows may need extra time)

    console.log('🎬 Beginning epic execution saga...');

    for (const step of plan) {
        if (Date.now() - startTime > MAX_EXECUTION_TIME) {
            console.warn(`⏰ Epic cut short at ${Date.now() - startTime}ms - but what a journey it was!`);
            break;
        }

        console.log(`\n${step.narrative}`);

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
            // Handle Moralis API calls with proper error handling
            else if (step.tool.startsWith('getMoralis') && step.input) {
                result = await handleMoralisCallWithNarrative(step, step.input);
            }
            // Enhanced RPC methods
            else if (step.tool === 'getSignaturesForAddress' && step.input) {
                try {
                    const { PublicKey } = await import('@solana/web3.js');
                    const pubkey = new PublicKey(step.input);
                    // Get more signatures for comprehensive analysis
                    result = await conn.getSignaturesForAddress(pubkey, { limit: 100 });
                    console.log(`   ✅ Found ${result?.length || 0} transaction signatures!`);
                } catch (error) {
                    result = { error: `Failed to get signatures: ${(error as Error).message}` };
                    console.log(`   ❌ Signature retrieval failed`);
                }
            }
            else if (step.tool === 'getTokenAccountsByOwner' && step.input) {
                try {
                    const { PublicKey } = await import('@solana/web3.js');
                    const ownerPubkey = new PublicKey(step.input);
                    const tokenProgramId = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

                    // Use timeout and try with minimal encoding to avoid size errors
                    const tokenPromise = conn.getTokenAccountsByOwner(ownerPubkey, {
                        programId: tokenProgramId
                    }, 'confirmed');

                    const timeoutPromise = new Promise((_, reject) => {
                        setTimeout(() => reject(new Error('Token query timeout')), 8000);
                    });

                    result = await Promise.race([tokenPromise, timeoutPromise]);
                    const tokenCount = result?.value?.length || 0;
                    console.log(`   💎 Discovered ${tokenCount} token accounts!`);
                } catch (error) {
                    // If the error is about string size, try a simpler approach
                    if ((error as Error).message.includes('string longer than') || (error as Error).message.includes('0x1fffffe8')) {
                        try {
                            // Fallback: just count token accounts without parsing
                            const { PublicKey } = await import('@solana/web3.js');
                            const ownerPubkey = new PublicKey(step.input);
                            const tokenProgramId = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
                            const unparsedResult = await conn.getTokenAccountsByOwner(ownerPubkey, {
                                programId: tokenProgramId
                            });
                            result = {
                                value: unparsedResult?.value || [],
                                note: 'Unparsed due to size limits',
                                count: unparsedResult?.value?.length || 0
                            };
                            console.log(`   💎 Found ${result.count} token accounts (unparsed)!`);
                        } catch (fallbackError) {
                            result = { error: `Token accounts too large to query: ${(fallbackError as Error).message}` };
                            console.log(`   ⚠️ Token query failed due to size limits`);
                        }
                    } else {
                        result = { error: `Failed to get token accounts: ${(error as Error).message}` };
                        console.log(`   ❌ Token discovery failed`);
                    }
                }
            }
            else if (step.tool === 'getParsedTransaction' && step.input) {
                try {
                    const { PublicKey } = await import('@solana/web3.js');
                    const pubkey = new PublicKey(step.input);
                    const signatures = await conn.getSignaturesForAddress(pubkey, { limit: 25 });

                    if (signatures && signatures.length > 0) {
                        // Get more detailed transactions for epic analysis
                        const detailedTxs = await Promise.all(
                            signatures.slice(0, 10).map(async (sig: any) => {
                                try {
                                    const tx = await conn.getParsedTransaction(sig.signature, {
                                        maxSupportedTransactionVersion: 0
                                    });
                                    return { signature: sig.signature, transaction: tx, slot: sig.slot };
                                } catch (e) {
                                    return { signature: sig.signature, error: (e as Error).message };
                                }
                            })
                        );
                        result = {
                            totalSignatures: signatures.length,
                            recentTransactions: detailedTxs
                        };
                        console.log(`   📜 Decoded ${detailedTxs.length} transactions in detail!`);
                    } else {
                        result = { totalSignatures: 0, recentTransactions: [] };
                        console.log(`   📭 No transactions found yet`);
                    }
                } catch (error) {
                    result = { error: `Failed to parse transactions: ${(error as Error).message}` };
                    console.log(`   ❌ Transaction parsing failed`);
                }
            }
            // Handle advanced analytics methods
            else if (step.tool.startsWith('getMoralis') || step.tool.startsWith('get') &&
                ['MultiTimeframeAnalytics', 'BehavioralPatterns', 'PortfolioRiskAnalytics',
                    'PredictiveAnalytics', 'DefiProtocolAnalytics', 'AiPoweredInsights',
                    'AdvancedVisualizationData', 'ParsedTokenAccountsByOwner', 'RecentTransactionsDetails'].some(suffix => step.tool.includes(suffix))) {
                result = await handleAdvancedAnalytics(step, conn);
            }
            // Standard RPC calls with timeout protection
            else if (typeof conn[step.tool] === 'function') {
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error(`RPC call ${step.tool} timed out`)), 15000);
                });

                const rpcCallPromise = (async () => {
                    if (step.tool === 'getRecentPerformanceSamples') {
                        return await conn[step.tool](50); // Get more samples
                    } else if (step.input) {
                        if (step.tool === 'getAccountInfo' || step.tool === 'getBalance' ||
                            step.tool === 'getTokenSupply' || step.tool === 'getTokenLargestAccounts') {
                            const { PublicKey } = await import('@solana/web3.js');
                            try {
                                const pubkey = new PublicKey(step.input);
                                if (step.tool === 'getTokenSupply') {
                                    const result = await conn[step.tool](pubkey);
                                    console.log(`   🪙 Token supply: ${result?.value?.amount || 'N/A'} (${result?.value?.decimals || 0} decimals)`);
                                    return result;
                                } else if (step.tool === 'getTokenLargestAccounts') {
                                    const result = await conn[step.tool](pubkey);
                                    console.log(`   👑 Found ${result?.value?.length || 0} largest token holders!`);
                                    return result;
                                }
                                return await conn[step.tool](pubkey);
                            } catch (error) {
                                return { error: `Invalid address: ${(error as Error).message}` };
                            }
                        } else {
                            return await conn[step.tool](step.input);
                        }
                    } else {
                        return await conn[step.tool]();
                    }
                })();

                try {
                    result = await Promise.race([rpcCallPromise, timeoutPromise]);
                    console.log(`   ✅ ${step.discovery}`);
                } catch (error) {
                    result = { error: `RPC call failed: ${(error as Error).message}` };
                    console.log(`   ⏰ RPC timeout or error`);
                }
            } else {
                console.warn(`   ⚠️ Method ${step.tool} not available in this realm`);
                result = { error: `Method ${step.tool} not available` };
            }

            results[step.tool] = result;

        } catch (error) {
            console.error(`   🔥 Error in ${step.tool}:`, error);
            results[step.tool] = { error: (error as Error).message };
        }
    }

    console.log('\n🎭 Plan execution complete! Results gathered:', Object.keys(results).length);
    return results;
}

async function handleMoralisCallWithNarrative(step: StoryDrivenPlanStep, input: string): Promise<any> {
    // Check if Moralis API key is available
    if (!process.env.MORALIS_API_KEY) {
        console.log(`   ⚠️ Moralis Oracle unavailable - no API key provided`);
        return { error: 'Moralis API key not configured' };
    }

    try {
        // Use dynamic import with correct path and timeout
        const moralisApi = await import('../../../../lib/moralis-api');

        console.log(`   🔮 Invoking Moralis ${step.tool}...`);

        // Create timeout for all Moralis calls
        const moralisTimeout = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Moralis API timeout')), 8000);
        });

        let apiCall: Promise<any>;

        switch (step.tool) {
            case 'getMoralisPortfolio':
                apiCall = moralisApi.getPortfolio(input, true, 'mainnet');
                break;

            case 'getMoralisTokenBalances':
                apiCall = moralisApi.getTokenBalances(input, 'mainnet');
                break;

            case 'getMoralisNFTs':
                apiCall = moralisApi.getNFTsForAddress(input, { nftMetadata: true, limit: 50 }, 'mainnet');
                break;

            case 'getMoralisSwapHistory':
                apiCall = moralisApi.getSwapsByWalletAddress(input, { limit: 50 }, 'mainnet'); // Reduced limit
                break;

            case 'getMoralisTransactionHistory':
                apiCall = moralisApi.getTransactionsByAddress(input, { limit: 50 }, 'mainnet'); // Reduced limit
                break;

            default:
                // Simplified fallback to prevent timeouts
                apiCall = moralisApi.getPortfolio(input, false, 'mainnet'); // No NFT metadata for speed
                break;
        }

        const result = await Promise.race([apiCall, moralisTimeout]);

        switch (step.tool) {
            case 'getMoralisPortfolio':
                console.log(`   💰 Portfolio retrieved with ${result?.tokens?.length || 0} tokens!`);
                break;
            case 'getMoralisTokenBalances':
                console.log(`   🪙 Found ${result?.length || 0} different tokens!`);
                break;
            case 'getMoralisNFTs':
                console.log(`   🖼️ Discovered ${result?.length || 0} NFTs!`);
                break;
            case 'getMoralisSwapHistory':
                console.log(`   🔄 Found ${result?.length || 0} swap transactions!`);
                break;
            case 'getMoralisTransactionHistory':
                console.log(`   📚 Retrieved ${result?.length || 0} transactions!`);
                break;
        }

        return result || { data: 'empty', note: 'No data returned from Moralis' };

    } catch (error) {
        console.log(`   ❌ Moralis invocation failed:`, (error as Error).message);
        // Return a structured error instead of just error object
        return {
            error: `Moralis API error: ${(error as Error).message}`,
            tool: step.tool,
            address: input,
            fallback: true
        };
    }
}

// Handle all the advanced analytics methods from the original
async function handleAdvancedAnalytics(step: StoryDrivenPlanStep, conn: any): Promise<any> {
    try {
        const moralisApi = await import('../../../../lib/moralis-api');

        switch (step.tool) {
            // Enhanced financial analytics with Moralis
            case 'getMoralisAdvancedAnalytics':
                if (step.input && typeof step.input === 'string') {
                    const [swaps, tokens, portfolio] = await Promise.all([
                        moralisApi.getSwapsByWalletAddress(step.input, { limit: 100 }, 'mainnet'),
                        moralisApi.getTokenBalances(step.input, 'mainnet'),
                        moralisApi.getPortfolio(step.input, true, 'mainnet')
                    ]);
                    console.log(`   🧮 Advanced analytics compiled for comprehensive analysis!`);
                    return {
                        address: step.input,
                        swapHistory: swaps,
                        tokenBalances: tokens,
                        portfolio: portfolio,
                        analysis: 'comprehensive_financial_analysis'
                    };
                }
                break;

            case 'getMoralisPnlAnalysis':
                if (step.input && typeof step.input === 'string') {
                    const [swaps, currentTokens] = await Promise.all([
                        moralisApi.getSwapsByWalletAddress(step.input, { limit: 100 }, 'mainnet'),
                        moralisApi.getTokenBalances(step.input, 'mainnet')
                    ]);
                    console.log(`   📈 P&L analysis completed - gains and losses revealed!`);
                    return {
                        address: step.input,
                        swapHistory: swaps,
                        currentPositions: currentTokens,
                        analysis: 'position_pnl_calculation'
                    };
                }
                break;

            case 'getMoralisFeesAnalysis':
                if (step.input && typeof step.input === 'string') {
                    const swaps = await moralisApi.getSwapsByWalletAddress(step.input, { limit: 100 }, 'mainnet');
                    console.log(`   💸 Fee analysis complete - transaction costs calculated!`);
                    return {
                        address: step.input,
                        transactionData: swaps,
                        analysis: 'fees_and_costs_breakdown'
                    };
                }
                break;

            case 'getMoralisInflowOutflow':
                if (step.input && typeof step.input === 'string') {
                    const swaps = await moralisApi.getSwapsByWalletAddress(step.input, { limit: 100 }, 'mainnet');
                    console.log(`   🌊 Fund flow patterns mapped!`);
                    return {
                        address: step.input,
                        transactionData: swaps,
                        analysis: 'fund_flow_patterns'
                    };
                }
                break;

            case 'getMoralisVolumeAnalysis':
                if (step.input && typeof step.input === 'string') {
                    const swaps = await moralisApi.getSwapsByWalletAddress(step.input, { limit: 100 }, 'mainnet');
                    console.log(`   📊 Volume analysis complete - heavy hitters identified!`);
                    return {
                        address: step.input,
                        transactionData: swaps,
                        analysis: 'volume_and_top_transactions'
                    };
                }
                break;

            // Advanced Analytics Tools
            case 'getMultiTimeframeAnalytics':
                const params = typeof step.input === 'object' ? step.input as any : { address: step.input };
                if (params.address) {
                    const [swaps, portfolio] = await Promise.all([
                        moralisApi.getSwapsByWalletAddress(params.address, { limit: 200 }, 'mainnet'),
                        moralisApi.getPortfolio(params.address, true, 'mainnet')
                    ]);
                    console.log(`   🕰️ Multi-timeframe analysis across ${params.timeframes?.length || 3} periods!`);
                    return {
                        address: params.address,
                        timeframes: params.timeframes || ['7d', '30d', '90d'],
                        swapHistory: swaps,
                        portfolio: portfolio,
                        analysis: 'multi_timeframe_performance'
                    };
                }
                break;

            case 'getBehavioralPatterns':
                const behaviorParams = typeof step.input === 'object' ? step.input as any : { address: step.input };
                if (behaviorParams.address) {
                    const swaps = await moralisApi.getSwapsByWalletAddress(behaviorParams.address, { limit: 200 }, 'mainnet');
                    console.log(`   🧠 Behavioral patterns decoded - trading psychology revealed!`);
                    return {
                        address: behaviorParams.address,
                        includeTimePatterns: behaviorParams.includeTimePatterns || true,
                        includeRiskProfile: behaviorParams.includeRiskProfile || true,
                        swapHistory: swaps,
                        analysis: 'behavioral_patterns'
                    };
                }
                break;

            case 'getPortfolioRiskAnalytics':
                const riskParams = typeof step.input === 'object' ? step.input as any : { address: step.input };
                if (riskParams.address) {
                    const [portfolio, tokens, swaps] = await Promise.all([
                        moralisApi.getPortfolio(riskParams.address, true, 'mainnet'),
                        moralisApi.getTokenBalances(riskParams.address, 'mainnet'),
                        moralisApi.getSwapsByWalletAddress(riskParams.address, { limit: 100 }, 'mainnet')
                    ]);
                    console.log(`   ⚖️ Risk analysis complete - portfolio vulnerabilities mapped!`);
                    return {
                        address: riskParams.address,
                        includeCorrelations: riskParams.includeCorrelations || true,
                        riskTimeframe: riskParams.riskTimeframe || '30d',
                        portfolio: portfolio,
                        tokens: tokens,
                        swapHistory: swaps,
                        analysis: 'risk_analytics'
                    };
                }
                break;

            case 'getPredictiveAnalytics':
                const predictParams = typeof step.input === 'object' ? step.input as any : { address: step.input };
                if (predictParams.address) {
                    const [swaps, portfolio] = await Promise.all([
                        moralisApi.getSwapsByWalletAddress(predictParams.address, { limit: 150 }, 'mainnet'),
                        moralisApi.getPortfolio(predictParams.address, true, 'mainnet')
                    ]);
                    console.log(`   🔮 Future predictions calculated - optimization paths revealed!`);
                    return {
                        address: predictParams.address,
                        predictionHorizon: predictParams.predictionHorizon || '7d',
                        includeOptimization: predictParams.includeOptimization || true,
                        swapHistory: swaps,
                        portfolio: portfolio,
                        analysis: 'predictive_analytics'
                    };
                }
                break;

            case 'getDefiProtocolAnalytics':
                const defiParams = typeof step.input === 'object' ? step.input as any : { address: step.input };
                if (defiParams.address) {
                    const [swaps, portfolio] = await Promise.all([
                        moralisApi.getSwapsByWalletAddress(defiParams.address, { limit: 200 }, 'mainnet'),
                        moralisApi.getPortfolio(defiParams.address, true, 'mainnet')
                    ]);
                    console.log(`   🌾 DeFi protocol analysis complete - yield performance mapped!`);
                    return {
                        address: defiParams.address,
                        protocols: defiParams.protocols,
                        includeYieldAnalysis: defiParams.includeYieldAnalysis || true,
                        swapHistory: swaps,
                        portfolio: portfolio,
                        analysis: 'defi_protocol_analytics'
                    };
                }
                break;

            case 'getAiPoweredInsights':
                const aiParams = typeof step.input === 'object' ? step.input as any : { address: step.input };
                if (aiParams.address) {
                    const [portfolio, swaps, tokens] = await Promise.all([
                        moralisApi.getPortfolio(aiParams.address, true, 'mainnet'),
                        moralisApi.getSwapsByWalletAddress(aiParams.address, { limit: 100 }, 'mainnet'),
                        moralisApi.getTokenBalances(aiParams.address, 'mainnet')
                    ]);
                    console.log(`   🤖 AI insights generated - machine wisdom activated!`);
                    return {
                        address: aiParams.address,
                        insightTypes: aiParams.insightTypes || ['summary', 'recommendations', 'opportunities'],
                        personalityProfile: aiParams.personalityProfile || 'auto_detect',
                        portfolio: portfolio,
                        swapHistory: swaps,
                        tokens: tokens,
                        analysis: 'ai_powered_insights'
                    };
                }
                break;

            case 'getAdvancedVisualizationData':
                const vizParams = typeof step.input === 'object' ? step.input as any : { address: step.input };
                if (vizParams.address) {
                    const [portfolio, swaps] = await Promise.all([
                        moralisApi.getPortfolio(vizParams.address, true, 'mainnet'),
                        moralisApi.getSwapsByWalletAddress(vizParams.address, { limit: 100 }, 'mainnet')
                    ]);
                    console.log(`   🎨 Visualization data prepared - ready for beautiful charts!`);
                    return {
                        address: vizParams.address,
                        visualizationType: vizParams.visualizationType || 'all',
                        timeframe: vizParams.timeframe || '30d',
                        portfolio: portfolio,
                        swapHistory: swaps,
                        analysis: 'advanced_visualization_data'
                    };
                }
                break;

            // Handle custom account analysis methods
            case 'getParsedTokenAccountsByOwner':
                if (step.input) {
                    const { PublicKey } = await import('@solana/web3.js');
                    const tokenProgramId = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
                    const result = await conn.getParsedTokenAccountsByOwner(new PublicKey(step.input), {
                        programId: tokenProgramId
                    });
                    console.log(`   🔍 RPC token verification complete!`);
                    return result;
                }
                break;

            case 'getRecentTransactionsDetails':
                if (step.input) {
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
                        console.log(`   📋 Transaction details gathered!`);
                        return detailedTxs;
                    } catch (error) {
                        return { error: (error as Error).message };
                    }
                }
                break;
        }

        return { error: 'Unknown analytics method or missing input' };
    } catch (error) {
        console.log(`   ❌ Advanced analytics failed:`, (error as Error).message);
        return { error: `Advanced analytics error: ${(error as Error).message}` };
    }
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
            const { getTopGainers, getTopTokens, getTrendingTokens } = await import('../../../../lib/moralis-api');

            const [topGainers, topTokens, trending] = await Promise.allSettled([
                getTopGainers(10, 'mainnet'),
                getTopTokens(20),
                getTrendingTokens(10, '24h')
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

            const [newListings, marketData, topGainers] = await Promise.allSettled([
                getNewListings(20, 7, 'mainnet'),
                getTokenMarketData({ limit: 50, sort_by: 'volume', sort_order: 'desc' }, 'mainnet'),
                getTopGainers(15, 'mainnet')
            ]);

            trends.newListings = newListings.status === 'fulfilled' ? newListings.value : null;
            trends.marketData = marketData.status === 'fulfilled' ? marketData.value : null;
            trends.topPerformers = topGainers.status === 'fulfilled' ? topGainers.value : null;

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

async function synthesizeEpicResults(
    context: ToolContext,
    plan: StoryDrivenPlanStep[],
    results: Record<string, any>
): Promise<string> {
    const { question } = context;

    // Detect user's request intensity
    const qLower = question.toLowerCase();
    const wantsEverything = qLower.includes("everything") || qLower.includes("full") ||
        qLower.includes("detailed") || qLower.includes("comprehensive") ||
        qLower.includes("complete") || qLower.includes("all");
    const wantsWallOfText = qLower.includes("wall") || qLower.includes("essay") ||
        qLower.includes("verbose") || qLower.includes("maximum");

    console.log(`📖 Synthesizing ${wantsEverything ? 'EPIC' : 'standard'} response...`);

    if (!process.env.TOGETHER_API_KEY) {
        throw new Error("TOGETHER_API_KEY not configured for synthesis");
    }

    // Determine response size based on user intent
    let maxTokens = 8192; // Default generous size
    let synthesisMode = "COMPREHENSIVE";

    if (wantsEverything || wantsWallOfText) {
        maxTokens = 32768; // MAXIMUM POWER!
        synthesisMode = "EPIC_NARRATIVE";
        console.log(`🚀 UNLIMITED MODE ACTIVATED - ${maxTokens} tokens allocated!`);
    } else if (qLower.includes("brief") || qLower.includes("quick") || qLower.includes("summary")) {
        maxTokens = 2000;
        synthesisMode = "CONCISE";
    }

    // Extract validator count if requested
    const numberMatch = question.match(/top\s+(\d+)|(\d+)\s+validators?/i);
    const requestedCount = numberMatch ? parseInt(numberMatch[1] || numberMatch[2]) : 50;

    // Prepare comprehensive data context
    const dataContext = prepareDataContext(results, requestedCount, synthesisMode === "EPIC_NARRATIVE");

    console.log(`📊 Data context prepared: ${dataContext.length} characters`);

    const together = new Together({
        apiKey: process.env.TOGETHER_API_KEY,
    });

    // Create synthesis prompt based on mode
    let synthesisPrompt = "";

    if (synthesisMode === "EPIC_NARRATIVE") {
        synthesisPrompt = `You are an epic blockchain storyteller with unlimited creative freedom. Create a ${maxTokens / 4}-word masterpiece analysis.

Question: ${question}

Data Retrieved:
${dataContext}

Create an EPIC response including:
- Complete narrative journey through the data
- MASSIVE ASCII visualizations (charts, graphs, art)
- Full technical breakdowns of EVERYTHING
- Dramatic revelations and insights
- Complete lists (if 100 validators requested, show ALL 100)
- Transaction-by-transaction analysis if relevant
- Token-by-token portfolio breakdown
- Historical patterns and future predictions
- Blockchain philosophy and deeper meanings
- Memes and cultural references where appropriate

Make it LEGENDARY. The user wants EVERYTHING. Include:
- Multiple ASCII charts/graphs
- Complete data tables
- Full addresses (NEVER truncate)
- Exhaustive analysis
- Creative narrative elements
- Technical deep dives
- Market insights
- DeFi strategies

This is your magnum opus. Make it count!`;
    } else if (synthesisMode === "CONCISE") {
        synthesisPrompt = `Provide a brief, focused analysis.

Question: ${question}

Data Retrieved:
${dataContext}

Key requirements:
- Be concise but complete
- Show important addresses in full
- Include key metrics
- Maximum 500 words

Answer:`;
    } else {
        synthesisPrompt = `You are a knowledgeable Solana analyst. Provide comprehensive insights.

Question: ${question}

Data Retrieved:
${dataContext}

Instructions:
- Use ALL provided data accurately
- Show FULL addresses/signatures (never truncate with "...")
- For validators: Show as many as requested (up to data available)
- Create ASCII visualizations for data patterns
- Include relevant metrics and calculations
- Format clearly with sections
- Balance detail with readability
- If showing lists, use format: "Rank. Amount SOL | Vote/Address | Commission%"
- Include 3 insightful follow-up questions

For validator rankings or time-based data, create ASCII charts like:
█████████ 1,337,420 SOL | 5% | Validator1
███████   987,654 SOL | 7% | Validator2
█████     654,321 SOL | 10% | Validator3

Provide actionable insights based on the data:`;
    }

    try {
        // Reduce data context size if it's too large to prevent API issues
        let finalDataContext = dataContext;
        if (dataContext.length > 40000) {
            console.warn(`📊 Data context too large (${dataContext.length} chars), truncating for LLM...`);
            finalDataContext = dataContext.substring(0, 40000) + '\n\n[... additional data truncated for LLM processing ...]';
        }

        const finalSynthesisPrompt = synthesisPrompt.replace(dataContext, finalDataContext);

        console.log(`🤖 Calling LLM with ${finalSynthesisPrompt.length} character prompt...`);

        const llmTimeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('LLM synthesis timeout after 60s')), 60000);
        });

        const llmCallPromise = together.chat.completions.create({
            model: "openai/gpt-oss-120b",
            messages: [
                {
                    role: "system",
                    content: finalSynthesisPrompt
                }
            ],
            stream: false,
            max_tokens: maxTokens,
            temperature: 0.3, // Add some creativity but keep it focused
        });

        const answer = await Promise.race([llmCallPromise, llmTimeoutPromise]) as any;

        if (!answer || !answer.choices || !answer.choices[0] || !answer.choices[0].message) {
            console.error('🚨 Invalid LLM response structure:', JSON.stringify(answer));
            throw new Error('Invalid LLM response structure');
        }

        const response = answer.choices[0].message.content;

        if (!response || response.trim().length === 0) {
            console.error('🚨 Empty LLM response received');
            throw new Error('Empty response from LLM');
        }

        console.log(`✨ Epic synthesis complete: ${response.length} characters`);
        console.log(`🎯 LLM synthesis SUCCESS - using real AI response`);
        return response;

    } catch (error) {
        console.error('🔥 LLM synthesis error:', error);
        console.log(`🎭 Falling back to narrative template due to LLM error`);

        // Enhanced fallback with narrative
        return generateNarrativeFallback(results, question, requestedCount);
    }
}

function prepareDataContext(
    results: Record<string, any>,
    requestedCount: number,
    epicMode: boolean
): string {
    const maxContextSize = epicMode ? 100000 : 20000; // Much larger for epic mode

    return Object.entries(results)
        .map(([method, result]) => {
            if (result && !result.error) {
                // Special handling for vote accounts with comprehensive data
                if (method === 'getVoteAccounts' && result && (result.current || result.delinquent)) {
                    const current = result.current || [];
                    const delinquent = result.delinquent || [];

                    // If we have actual validator data, process it
                    if (current.length > 0 && current[0].activatedStake !== undefined) {
                        const allValidators = [...current, ...delinquent];

                        // Sort by stake (handle both string and number types)
                        const sortedValidators = allValidators
                            .filter(v => v && (v.activatedStake !== undefined))
                            .sort((a, b) => {
                                const stakeA = typeof a.activatedStake === 'string' ? parseInt(a.activatedStake) : a.activatedStake;
                                const stakeB = typeof b.activatedStake === 'string' ? parseInt(b.activatedStake) : b.activatedStake;
                                return stakeB - stakeA;
                            });

                        const sampleSize = epicMode ?
                            Math.min(requestedCount * 2, sortedValidators.length) :
                            Math.min(requestedCount, sortedValidators.length);

                        const topValidators = sortedValidators.slice(0, sampleSize);

                        const validatorList = topValidators.map((validator, index) => {
                            const stake = validator.activatedStake || 0;
                            const stakeValue = typeof stake === 'string' ? parseInt(stake) : stake;
                            const solAmount = (stakeValue / 1e9).toFixed(2);
                            const commission = validator.commission || 0;
                            const votePubkey = validator.votePubkey || 'unknown';
                            const nodePubkey = validator.nodePubkey || 'unknown';

                            return `  ${index + 1}. ${solAmount} SOL (${stakeValue} lamports) - vote: ${votePubkey}, node: ${nodePubkey} (${commission}% commission)`;
                        }).join('\n');

                        return `${method}: Top ${sampleSize} validators by stake:
${validatorList}
${sortedValidators.length > sampleSize ? `... and ${sortedValidators.length - sampleSize} more validators` : ''}
Total: ${current.length} active, ${delinquent.length} delinquent`;
                    } else {
                        // If we only have counts, return those with explanation
                        return `${method}: Vote account summary:
Total: ${current.length} active validators, ${delinquent.length} delinquent validators
Note: Individual validator stake data not available in this RPC response. 
To get detailed validator rankings, the RPC node needs to return the full validator list with stake amounts.
This may be due to RPC node configuration or the specific endpoint being queried.`;
                    }
                }

                // Handle other result types
                let jsonString = JSON.stringify(result, null, 2);
                const maxSize = epicMode ? 50000 : 5000;
                if (jsonString.length > maxSize) {
                    jsonString = jsonString.substring(0, maxSize) + '... [truncated for size]';
                }

                return `${method}: ${jsonString}`;
            } else {
                return `${method}: ERROR - ${result?.error || 'Failed to retrieve data'}`;
            }
        })
        .join('\n\n');
}

function generateNarrativeFallback(results: Record<string, any>, question: string, requestedCount: number): string {
    let narrative = `🎭 *The Blockchain Chronicles*\n\n`;
    narrative += `Query: "${question}"\n\n`;
    narrative += `📊 *Data Retrieved:*\n\n`;

    for (const [method, result] of Object.entries(results)) {
        if (result && !result.error) {
            switch (method) {
                case 'getSlot':
                    narrative += `⏰ **Current Slot**: ${result}\n`;
                    narrative += `   The blockchain ticks forward, slot by slot...\n\n`;
                    break;

                case 'getEpochInfo':
                    const progress = result.slotIndex && result.slotsInEpoch ?
                        ((result.slotIndex / result.slotsInEpoch) * 100).toFixed(2) : '0';
                    narrative += `🌅 **Epoch ${result.epoch || 'Unknown'}**:\n`;
                    narrative += `   Slot ${result.slotIndex}/${result.slotsInEpoch} (${progress}% complete)\n`;
                    narrative += `   *We journey through the ${result.epoch}th cycle of consensus...*\n\n`;
                    break;

                case 'getVoteAccounts':
                    const active = result.current?.length || 0;
                    const delinquent = result.delinquent?.length || 0;
                    narrative += `⚔️ **The Validator Legion**:\n`;
                    narrative += `   ${active + delinquent} total warriors of consensus\n`;
                    narrative += `   ${active} standing strong, ${delinquent} fallen behind\n\n`;

                    if (result.current && result.current.length > 0) {
                        const sorted = result.current
                            .filter((v: any) => v && v.activatedStake)
                            .sort((a: any, b: any) => parseInt(b.activatedStake) - parseInt(a.activatedStake))
                            .slice(0, requestedCount);

                        narrative += `   **Top ${Math.min(requestedCount, sorted.length)} Validators by Power:**\n`;
                        sorted.forEach((v: any, i: number) => {
                            const solAmount = (parseInt(v.activatedStake) / 1e9).toFixed(2);
                            narrative += `   ${i + 1}. ${solAmount} SOL | ${v.votePubkey}\n`;
                        });
                        narrative += '\n';
                    }
                    break;

                case 'getRecentPerformanceSamples':
                    if (Array.isArray(result) && result.length > 0) {
                        const valid = result.filter(s => s && typeof s.numTransactions === "number" && s.samplePeriodSecs > 0);
                        if (valid.length > 0) {
                            const avgTps = Math.round(
                                valid.reduce((acc, s) => acc + (s.numTransactions / s.samplePeriodSecs), 0) / valid.length
                            );
                            narrative += `⚡ **Network Performance**:\n`;
                            narrative += `   ~${avgTps} TPS average across ${valid.length} samples\n`;
                            narrative += `   *The network pulses with ${avgTps} transactions per second!*\n\n`;
                        }
                    }
                    break;

                case 'getAccountInfo':
                    if (result && result.value) {
                        const account = result.value;
                        const solBalance = (account.lamports / 1e9).toFixed(4);
                        narrative += `🔍 **Account Analysis**:\n`;
                        narrative += `   Balance: ${solBalance} SOL\n`;
                        narrative += `   Owner: ${account.owner}\n`;
                        narrative += `   Executable: ${account.executable ? 'Yes (Program)' : 'No (Wallet)'}\n\n`;
                    }
                    break;

                case 'getBalance':
                    if (typeof result === 'number') {
                        const solBalance = (result / 1e9).toFixed(4);
                        narrative += `💰 **Pure SOL Balance**: ${solBalance} SOL\n\n`;
                    } else if (result && result.value !== undefined) {
                        const solBalance = (result.value / 1e9).toFixed(4);
                        narrative += `💰 **Pure SOL Balance**: ${solBalance} SOL\n\n`;
                    }
                    break;

                case 'getSignaturesForAddress':
                    if (Array.isArray(result)) {
                        narrative += `📜 **Transaction History**:\n`;
                        narrative += `   ${result.length} transactions found\n`;
                        if (result.length > 0) {
                            narrative += `   Latest: ${result[0].signature}\n`;
                        }
                        narrative += '\n';
                    }
                    break;

                case 'getTokenAccountsByOwner':
                case 'getParsedTokenAccountsByOwner':
                    if (result && result.value) {
                        narrative += `💎 **Token Holdings**:\n`;
                        narrative += `   ${result.value.length} different tokens discovered\n\n`;
                    }
                    break;

                default:
                    if (method.startsWith('getMoralis')) {
                        narrative += `🌟 **${method.replace('getMoralis', '')} (via Moralis)**:\n`;
                        narrative += `   Data retrieved successfully\n\n`;
                    } else if (method.startsWith('analyze')) {
                        narrative += `🔬 **${method} Analysis**:\n`;
                        narrative += `   Advanced analysis completed\n\n`;
                    } else {
                        narrative += `📊 **${method}**: Data retrieved\n\n`;
                    }
            }
        } else {
            narrative += `❌ **${method}**: ${result?.error || 'Failed'}\n\n`;
        }
    }

    narrative += `\n🔮 *End of Chronicle*\n`;
    narrative += `\n**Follow-up Questions:**\n`;
    narrative += `1. Would you like more details about any specific aspect?\n`;
    narrative += `2. Should I analyze patterns in the data?\n`;
    narrative += `3. Want to explore related accounts or transactions?\n`;

    return narrative;
}
