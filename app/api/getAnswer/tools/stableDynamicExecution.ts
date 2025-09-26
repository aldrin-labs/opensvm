import { Tool, ToolContext, ToolResult } from "./types";

interface ExecutionStep {
    tool: string;
    reason: string;
    input?: string | any;
    timeout?: number;
}

interface ExecutionMetrics {
    startTime: number;
    stepTimes: Record<string, number>;
    errors: string[];
    timeouts: string[];
}

// Well-known protocol addresses for analysis
const DEFI_PROTOCOLS = {
    RAYDIUM: 'RVKd61ztZW9GUwhRbbLoYVRE5Xf1B2tVscKqwZqXgEr',
    SERUM: '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin',
    ORCA: 'DjVE6JNiYqPL2QXyCUUh8rNjHrbz9hXHNYt99MQ59qw1',
    JUPITER: 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',
    SOLEND: 'So1endDq2YkqhipRh3WViPa8hdiSpxWy6z3Z6tMCpAo',
    MANGO: 'mv3ekLzLbnVPNxjSKvqBpU3ZeZXPQdEC3bp5MDEBG68',
    USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    SOL: 'So11111111111111111111111111111111111111112'
};

function getKnownProtocolByAddress(address: string): keyof typeof DEFI_PROTOCOLS | null {
    const addr = address.trim();
    for (const [name, value] of Object.entries(DEFI_PROTOCOLS)) {
        if (value === addr) return name as keyof typeof DEFI_PROTOCOLS;
    }
    return null;
}

// Circuit breaker to prevent cascading failures
class CircuitBreaker {
    private failures: number = 0;
    private lastFailure: number = 0;
    private readonly threshold: number = 3;
    private readonly resetTime: number = 30000; // 30 seconds

    canExecute(): boolean {
        if (this.failures < this.threshold) return true;
        if (Date.now() - this.lastFailure > this.resetTime) {
            this.failures = 0;
            return true;
        }
        return false;
    }

    recordSuccess(): void {
        this.failures = 0;
    }

    recordFailure(): void {
        this.failures++;
        this.lastFailure = Date.now();
    }
}

const circuitBreaker = new CircuitBreaker();

export const stableDynamicExecutionTool: Tool = {
    name: "stableDynamicExecution",
    description: "Stable, reliable dynamic plan execution with proper error handling and timeouts",

    canHandle: (context: ToolContext): boolean => {
        const { qLower, question } = context;

        // Address queries should be handled even if the circuit breaker is open
        const containsAddressEarly = /[1-9A-HJ-NP-Za-km-z]{32,44}/.test(question);
        if (!containsAddressEarly && !circuitBreaker.canExecute()) {
            console.log('🔴 Circuit breaker OPEN - skipping dynamic execution');
            return false;
        }

        // Skip simple greetings or meta queries
        if (/^(hi|hello|hey|yo|gm|hi there|ok|yes|no|thanks|thank you)$/i.test(question.trim())) {
            return false;
        }

        // Skip example/tutorial requests
        if (qLower.includes("example") || qLower.includes("how to") || qLower.includes("curl") ||
            qLower.includes("tutorial") || qLower.includes("explain how") || qLower.includes("show me how")) {
            return false;
        }

        // Handle analytical queries
        const hasAnalyticalKeywords = qLower.includes("validator") || qLower.includes("network") ||
            qLower.includes("epoch") || qLower.includes("performance") || qLower.includes("tps") ||
            qLower.includes("account") || qLower.includes("balance") || qLower.includes("transaction") ||
            qLower.includes("analyze") || qLower.includes("defi") || qLower.includes("protocol") ||
            qLower.includes("everything") || qLower.includes("comprehensive");

        // Handle RPC method calls
        const hasRPCMethods = qLower.includes("get") && (
            qLower.includes("cluster") || qLower.includes("supply") || qLower.includes("stake") ||
            qLower.includes("signatures") || qLower.includes("confirmed")
        );

        // Check for potential Solana addresses (anywhere in the string)
        const base58Anywhere = /[1-9A-HJ-NP-Za-km-z]{32,44}/;
        const containsAddress = base58Anywhere.test(question);

        return hasAnalyticalKeywords || hasRPCMethods || containsAddress;
    },

    execute: async (context: ToolContext): Promise<ToolResult> => {
        const { question } = context;
        const metrics: ExecutionMetrics = {
            startTime: Date.now(),
            stepTimes: {},
            errors: [],
            timeouts: []
        };

        // Overall request timeout of 25 seconds
        const requestTimeout = new Promise<never>((_, reject) => {
            setTimeout(() => {
                reject(new Error('Request timeout after 25 seconds'));
            }, 25000);
        });

        try {
            const executionPromise = executeStablePlan(context, metrics);
            const result = await Promise.race([executionPromise, requestTimeout]);

            circuitBreaker.recordSuccess();
            return result;

        } catch (error) {
            console.error('🔥 Stable dynamic execution error:', error);
            metrics.errors.push((error as Error).message);
            circuitBreaker.recordFailure();

            // Return graceful fallback
            return {
                handled: true,
                response: new Response(
                    generateFallbackResponse(question, metrics),
                    {
                        status: 200,
                        headers: {
                            "Content-Type": "text/plain; charset=utf-8",
                            "Cache-Control": "no-cache",
                        }
                    }
                )
            };
        }
    }
};

async function executeStablePlan(context: ToolContext, metrics: ExecutionMetrics): Promise<ToolResult> {
    const { conn, question } = context;

    console.log('🎯 Starting stable execution plan...');

    // Generate execution plan via AI (with fallback)
    const plan = await generatePlanWithAI(question);
    console.log(`📋 Plan generated: ${plan.length} steps`);

    // Execute plan with proper error handling
    const results = await executePlanSteps(plan, conn, metrics);

    // Intelligent synthesis using LLM for meaningful analysis
    const response = await synthesizeWithAI(question, results, metrics);

    return {
        handled: true,
        response: new Response(response, {
            status: 200,
            headers: {
                "Content-Type": "text/plain; charset=utf-8",
                "Cache-Control": "no-cache",
            }
        })
    };
}

function generateSimplePlan(question: string): ExecutionStep[] {
    const qLower = question.toLowerCase();
    const plan: ExecutionStep[] = [];

    // Check for potential Solana address
    const addressPattern = /[1-9A-HJ-NP-Za-km-z]{32,44}/;
    const potentialAddress = question.match(addressPattern);

    if (potentialAddress) {
        const address = potentialAddress[0];
        plan.push(
            {
                tool: 'getAccountInfo',
                reason: 'Get basic account information',
                input: address,
                timeout: 5000
            },
            {
                tool: 'getBalance',
                reason: 'Get SOL balance',
                input: address,
                timeout: 5000
            }
        );

        // Always include recent transaction history for address analytics
        plan.push({
            tool: 'getSignaturesForAddress',
            reason: 'Get transaction history',
            input: address,
            timeout: 8000
        });

        if (process.env.MORALIS_API_KEY && (qLower.includes("token") || qLower.includes("portfolio"))) {
            plan.push({
                tool: 'getMoralisPortfolio',
                reason: 'Get portfolio data',
                input: address,
                timeout: 6000
            });
        }
    }
    // Validator queries
    else if (qLower.includes('validator')) {
        plan.push({
            tool: 'getVoteAccounts',
            reason: 'Get validator information',
            timeout: 10000
        });
    }
    // Network performance
    else if (qLower.includes('performance') || qLower.includes('tps')) {
        plan.push({
            tool: 'getRecentPerformanceSamples',
            reason: 'Get network performance metrics',
            timeout: 5000
        });
    }
    // Epoch/network status
    else if (qLower.includes('epoch') || qLower.includes('network')) {
        plan.push({
            tool: 'getEpochInfo',
            reason: 'Get current epoch information',
            timeout: 5000
        });
    }
    // Leader schedule
    else if (qLower.includes('leader') || qLower.includes('schedule')) {
        plan.push(
            {
                tool: 'getSlot',
                reason: 'Get current slot',
                timeout: 5000
            },
            {
                tool: 'getLeaderSchedule',
                reason: 'Get leader schedule',
                timeout: 8000
            }
        );
    }
    // Default: basic network info
    else {
        plan.push({
            tool: 'getEpochInfo',
            reason: 'Get basic network status',
            timeout: 5000
        });
    }

    return plan;
}

async function generatePlanWithAI(question: string): Promise<ExecutionStep[]> {
    // Allowed tools for this stable executor (must match handlers in this file)
    const ALLOWED_TOOLS = new Set<string>([
        'getAccountInfo',
        'getBalance',
        'getSignaturesForAddress',
        'getVoteAccounts',
        'getRecentPerformanceSamples',
        'getEpochInfo',
        'getSlot',
        'getLeaderSchedule',
        'getMoralisPortfolio',
        'getMoralisTokenBalances',
        'getTokenSupply',
        'getTokenLargestAccounts',
    ]);

    const DEFAULT_TIMEOUTS: Record<string, number> = {
        getAccountInfo: 5000,
        getBalance: 5000,
        getSignaturesForAddress: 8000,
        getVoteAccounts: 10000,
        getRecentPerformanceSamples: 5000,
        getEpochInfo: 5000,
        getSlot: 5000,
        getLeaderSchedule: 8000,
        getMoralisPortfolio: 6000,
        getMoralisTokenBalances: 6000,
        getTokenSupply: 5000,
        getTokenLargestAccounts: 8000,
    };

    // Detect a Solana address if present
    const addressMatch = question.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
    const detectedAddress = addressMatch ? addressMatch[0] : null;

    // If no Together AI key, fallback immediately
    if (!process.env.TOGETHER_API_KEY) {
        console.warn('⚠️ TOGETHER_API_KEY not configured - using simple plan fallback');
        return generateSimplePlan(question);
    }

    try {
        const systemPrompt = `You are a Solana analysis planner. Create a minimal, executable plan of RPC/API calls to answer the user's question.
Return ONLY a JSON array (no markdown, no prose). Each item must be:
{ "tool": string, "reason": string, "input"?: string, "timeout"?: number }

Rules:
- Tools must be from this exact allowed set: ["getAccountInfo","getBalance","getSignaturesForAddress","getVoteAccounts","getRecentPerformanceSamples","getEpochInfo","getSlot","getLeaderSchedule","getMoralisPortfolio","getMoralisTokenBalances"]
- If the user provides a Solana address, include getAccountInfo and getBalance first with that address as input. Add getSignaturesForAddress for history.
- Only include Moralis tools if portfolio/token analysis is implied. If no address provided, don't include Moralis tools.
- Keep the plan short (2-6 steps) and ordered logically.
- Provide timeouts in milliseconds when appropriate (use typical values: 5-10s).
- Do NOT invent tools outside the allowed list.`;

        const userPrompt = `User question: ${question}
Detected address: ${detectedAddress || 'none'}
Moralis available: ${!!process.env.MORALIS_API_KEY}

Return ONLY JSON array of steps.`;

        const Together = (await import("together-ai")).default;
        const together = new Together({
            apiKey: process.env.TOGETHER_API_KEY!,
        });

        const llmTimeout = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('AI planning timeout')), 8000)
        );

        const llmCall = together.chat.completions.create({
            model: "openai/gpt-oss-120b",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            stream: false,
            max_tokens: 800,
            temperature: 0.1,
        });

        const answer = await Promise.race([llmCall, llmTimeout]) as any;
        const content: string = answer?.choices?.[0]?.message?.content || '';

        // Extract JSON array from response (handle code fences or extra text)
        const jsonText = extractJsonArray(content);
        if (!jsonText) {
            console.warn('⚠️ AI planning returned no valid JSON - using fallback');
            return generateSimplePlan(question);
        }

        let rawPlan: any;
        try {
            rawPlan = JSON.parse(jsonText);
        } catch (e) {
            console.warn('⚠️ Failed to parse AI plan JSON - using fallback');
            return generateSimplePlan(question);
        }

        const sanitized = sanitizeAIPlan(rawPlan, {
            allowed: ALLOWED_TOOLS,
            defaultTimeouts: DEFAULT_TIMEOUTS,
            address: detectedAddress,
            moralisAvailable: !!process.env.MORALIS_API_KEY,
        });

        if (sanitized.length === 0) {
            console.warn('⚠️ AI plan empty after sanitization - using fallback');
            return generateSimplePlan(question);
        }

        return sanitized.slice(0, 8); // hard cap just in case

    } catch (error) {
        console.error('❌ AI planning failed:', error);
        return generateSimplePlan(question);
    }
}

function extractJsonArray(text: string): string | null {
    // Look for the first JSON array in the text
    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    const candidate = fenceMatch ? fenceMatch[1] : text;

    // Try to find a JSON array substring
    const start = candidate.indexOf('[');
    const end = candidate.lastIndexOf(']');
    if (start !== -1 && end !== -1 && end > start) {
        return candidate.slice(start, end + 1).trim();
    }
    return null;
}

function sanitizeAIPlan(raw: any, opts: {
    allowed: Set<string>;
    defaultTimeouts: Record<string, number>;
    address: string | null;
    moralisAvailable: boolean;
}): ExecutionStep[] {
    if (!Array.isArray(raw)) return [];

    const seen = new Set<string>();
    const steps: ExecutionStep[] = [];

    const ensureTimeout = (tool: string, timeout?: number) =>
        Math.min(Math.max(timeout ?? opts.defaultTimeouts[tool] ?? 5000, 1500), 20000);

    for (const item of raw) {
        if (!item || typeof item !== 'object') continue;
        const tool = String(item.tool || '').trim();

        if (!opts.allowed.has(tool)) {
            // skip unknown tools in stable executor
            continue;
        }

        // Skip Moralis tools if no API key
        if (!opts.moralisAvailable && tool.startsWith('getMoralis')) continue;

        // Deduplicate by tool+input to keep plan tight
        const key = `${tool}:${item.input ?? ''}`;
        if (seen.has(key)) continue;
        seen.add(key);

        // If tool requires address input ensure it's present
        let input = item.input;
        if (['getAccountInfo', 'getBalance', 'getSignaturesForAddress', 'getMoralisPortfolio', 'getMoralisTokenBalances'].includes(tool)) {
            input = (typeof input === 'string' && input.trim()) ? input.trim() : (opts.address || '');
            if (!input) {
                // cannot run these without an address
                continue;
            }
        }

        const reason = String(item.reason || '').trim() || defaultReason(tool);
        const timeout = ensureTimeout(tool, typeof item.timeout === 'number' ? item.timeout : undefined);

        steps.push({ tool, reason, input, timeout });
    }

    // Safety: if AI didn't add anything useful, craft minimal sensible defaults
    if (steps.length === 0) {
        return [];
    }

    // Heuristic: if address present, ensure we at least fetch basic info + balance first
    if (opts.address) {
        const hasAccount = steps.some(s => s.tool === 'getAccountInfo');
        const hasBalance = steps.some(s => s.tool === 'getBalance');
        if (!hasAccount) {
            steps.unshift({
                tool: 'getAccountInfo',
                reason: 'Get basic account information',
                input: opts.address,
                timeout: opts.defaultTimeouts.getAccountInfo
            });
        }
        if (!hasBalance) {
            steps.splice(1, 0, {
                tool: 'getBalance',
                reason: 'Get SOL balance',
                input: opts.address,
                timeout: opts.defaultTimeouts.getBalance
            });
        }
    }

    // Limit to 6 steps for stability
    return steps.slice(0, 6);
}

function defaultReason(tool: string): string {
    switch (tool) {
        case 'getAccountInfo': return 'Get basic account information';
        case 'getBalance': return 'Get SOL balance';
        case 'getSignaturesForAddress': return 'Get transaction history';
        case 'getVoteAccounts': return 'Get validator information';
        case 'getRecentPerformanceSamples': return 'Get network performance metrics';
        case 'getEpochInfo': return 'Get current epoch information';
        case 'getSlot': return 'Get current slot';
        case 'getLeaderSchedule': return 'Get leader schedule';
        case 'getMoralisPortfolio': return 'Get portfolio data';
        case 'getMoralisTokenBalances': return 'Get token balances';
        default: return 'Execute relevant query';
    }
}

async function executePlanSteps(
    plan: ExecutionStep[],
    conn: any,
    metrics: ExecutionMetrics
): Promise<Record<string, any>> {
    const results: Record<string, any> = {};
    const maxExecutionTime = 20000; // 20 seconds total for all steps

    for (const step of plan) {
        if (Date.now() - metrics.startTime > maxExecutionTime) {
            console.warn(`⏰ Execution stopped at ${Date.now() - metrics.startTime}ms`);
            break;
        }

        const stepStart = Date.now();
        console.log(`🔧 Executing: ${step.tool}`);

        try {
            const stepTimeout = step.timeout || 5000;
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error(`${step.tool} timeout`)), stepTimeout);
            });

            let result;

            // Handle Moralis API calls
            if (step.tool.startsWith('getMoralis')) {
                const moralisPromise = handleMoralisCall(step.tool, step.input);
                result = await Promise.race([moralisPromise, timeoutPromise]);
            }
            // Handle RPC calls
            else if (typeof conn[step.tool] === 'function') {
                const rpcPromise = handleRPCCall(conn, step.tool, step.input);
                result = await Promise.race([rpcPromise, timeoutPromise]);
            }
            else {
                result = { error: `Method ${step.tool} not available` };
            }

            results[step.tool] = result;
            metrics.stepTimes[step.tool] = Date.now() - stepStart;
            console.log(`✅ ${step.tool} completed in ${metrics.stepTimes[step.tool]}ms`);

        } catch (error) {
            const errorMsg = (error as Error).message;
            if (errorMsg.includes('timeout')) {
                metrics.timeouts.push(step.tool);
                console.log(`⏰ ${step.tool} timed out`);
            } else {
                metrics.errors.push(`${step.tool}: ${errorMsg}`);
                console.log(`❌ ${step.tool} failed: ${errorMsg}`);
            }

            results[step.tool] = { error: errorMsg };
            metrics.stepTimes[step.tool] = Date.now() - stepStart;
        }
    }

    return results;
}

async function handleRPCCall(conn: any, method: string, input?: any): Promise<any> {
    if (input) {
        if (method === 'getAccountInfo' || method === 'getBalance' || method === 'getSignaturesForAddress') {
            const { PublicKey } = await import('@solana/web3.js');
            try {
                // Ensure input is a string and not an object or other type
                const inputStr = typeof input === 'string' ? input : String(input);
                if (!inputStr || inputStr === 'undefined' || inputStr === 'null') {
                    return { error: 'Invalid address: empty or null input' };
                }
                const pubkey = new PublicKey(inputStr);
                if (method === 'getSignaturesForAddress') {
                    return await conn[method](pubkey, { limit: 50 });
                }
                return await conn[method](pubkey);
            } catch (error) {
                return { error: `Invalid address: ${(error as Error).message}` };
            }
        }
        return await conn[method](input);
    } else {
        if (method === 'getRecentPerformanceSamples') {
            return await conn[method](20);
        }
        return await conn[method]();
    }
}

async function handleMoralisCall(method: string, input: string): Promise<any> {
    if (!process.env.MORALIS_API_KEY || !input) {
        return { error: 'Moralis not configured or no input' };
    }

    try {
        const moralisApi = await import('../../../../lib/moralis-api');

        switch (method) {
            case 'getMoralisPortfolio':
                return await moralisApi.getPortfolio(input, false, 'mainnet'); // No NFT metadata for speed
            case 'getMoralisTokenBalances':
                return await moralisApi.getTokenBalances(input, 'mainnet');
            default:
                return { error: 'Unknown Moralis method' };
        }
    } catch (error) {
        return { error: `Moralis API error: ${(error as Error).message}` };
    }
}

async function synthesizeWithAI(question: string, results: Record<string, any>, metrics: ExecutionMetrics): Promise<string> {
    const totalTime = Date.now() - metrics.startTime;


    // If we don't have TOGETHER_API_KEY, fall back to basic synthesis
    if (!process.env.TOGETHER_API_KEY) {
        return synthesizeBasic(question, results, metrics);
    }

    try {
        // Prepare comprehensive data context for AI analysis
        const dataContext = prepareAnalysisContext(results);

        // Create synthesis prompt with reasoning requirement
        const synthesisPrompt = `You are an expert Solana blockchain analyst. Analyze the collected data and provide a comprehensive response that includes your reasoning process.

**User Query**: "${question}"

**Collected Data**:
${dataContext}

**Response Requirements**:
1. Start with <reasoning> tags showing your thought process as you analyze the data
2. Provide meaningful insights about what the data reveals
3. If analyzing an account/address, identify what type of account it is (token mint, wallet, program, etc.)
4. Include specific details from the data (don't just say "data processed")
5. Make the response conversational and insightful
6. End with actionable follow-up suggestions

**Example Format**:
<reasoning>
Looking at this data, I can see that... The account shows... This indicates... 
</reasoning>

# [Meaningful Title Based on Analysis]

[Your detailed analysis here...]

**Key Findings:**
- [Specific insight 1]
- [Specific insight 2]

**What This Means:**
[Explain the significance]

**Next Steps:**
[Helpful suggestions]

---
*Analysis completed in ${totalTime}ms*

Now provide your analysis:`;

        const Together = (await import("together-ai")).default;
        const together = new Together({
            apiKey: process.env.TOGETHER_API_KEY,
        });

        // Add timeout for synthesis
        const synthesisTimeout = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('AI synthesis timeout')), 15000);
        });

        const synthesisPromise = together.chat.completions.create({
            model: "openai/gpt-oss-120b",
            messages: [
                {
                    role: "user",
                    content: synthesisPrompt
                }
            ],
            stream: false,
            max_tokens: 4000,
            temperature: 0.3,
        });

        const answer = await Promise.race([synthesisPromise, synthesisTimeout]);
        const response = answer.choices?.[0]?.message?.content;

        if (response && response.length > 100) {
            console.log(`🤖 AI synthesis completed in ${Date.now() - metrics.startTime - totalTime}ms`);
            return response;
        } else {
            console.warn('⚠️ AI synthesis returned insufficient content, using fallback');
            return synthesizeBasic(question, results, metrics);
        }

    } catch (error) {
        console.error('❌ AI synthesis failed:', error);
        return synthesizeBasic(question, results, metrics);
    }
}

function synthesizeBasic(question: string, results: Record<string, any>, metrics: ExecutionMetrics): string {
    const totalTime = Date.now() - metrics.startTime;

    // Create reasoning section even for basic synthesis
    let response = `<reasoning>\n`;
    response += `The user asked: "${question}"\n`;
    response += `I collected ${Object.keys(results).length} pieces of data through blockchain queries.\n`;

    // Analyze what we found
    if (results.getAccountInfo || results.getBalance) {
        response += `This appears to be an account analysis request. `;
    }
    if (results.getVoteAccounts) {
        response += `This is a validator analysis request. `;
    }
    if (results.getEpochInfo) {
        response += `This involves network status information. `;
    }

    response += `Let me analyze the specific data I retrieved...\n`;
    response += `</reasoning>\n\n`;

    // Enhanced analysis based on data type
    if (results.getAccountInfo && results.getBalance) {
        response += analyzeAccountData(question, results, totalTime);
    } else if (results.getVoteAccounts) {
        response += analyzeValidatorData(question, results, totalTime);
    } else if (results.getEpochInfo) {
        response += analyzeNetworkData(question, results, totalTime);
    } else {
        response += `# Analysis Results\n\n**Query**: ${question}\n\n`;

        // Add results with better formatting
        for (const [method, result] of Object.entries(results)) {
            if (result && !result.error) {
                response += `## ${method}\n`;
                response += formatResultEnhanced(method, result);
                response += `\n`;
            } else {
                response += `## ${method}\n❌ ${result?.error || 'Failed'}\n\n`;
            }
        }
    }

    // Add execution summary
    response += `\n---\n*Analysis completed in ${totalTime}ms*\n`;

    return response;
}

function prepareAnalysisContext(results: Record<string, any>): string {
    return Object.entries(results)
        .map(([method, result]) => {
            if (result && !result.error) {
                let formattedResult = typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result);

                // Limit size but keep important data
                if (formattedResult.length > 3000) {
                    formattedResult = formattedResult.substring(0, 3000) + '... [truncated]';
                }

                return `**${method}**:\n${formattedResult}`;
            } else {
                return `**${method}**: ERROR - ${result?.error || 'Failed to retrieve data'}`;
            }
        })
        .join('\n\n');
}

function analyzeAccountData(question: string, results: Record<string, any>, totalTime: number): string {
    const accountInfo = results.getAccountInfo;
    const balance = results.getBalance;
    const signatures = results.getSignaturesForAddress;

    // Extract address from question
    const addressMatch = question.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
    const address = addressMatch ? addressMatch[0] : 'Unknown Address';
    const protocolName = address !== 'Unknown Address' ? getKnownProtocolByAddress(address) : null;

    let response = `# Account Analysis: ${address}\n\n`;

    // Debug: Log what we actually received (remove after fixing)
    console.log('🔍 Debug - accountInfo:', JSON.stringify(accountInfo, null, 2));
    console.log('🔍 Debug - balance:', JSON.stringify(balance, null, 2));

    // Show actual account data or error
    // Handle both RPC response formats: direct object or wrapped in 'value'
    const account = accountInfo?.value || accountInfo;
    if (account && account.lamports !== undefined) {
        const solBalance = typeof balance === 'number' ? balance : (balance?.value || account.lamports || 0);
        const solAmount = (solBalance / 1e9).toFixed(4);

        // Identify well-known accounts FIRST
        if (protocolName === 'USDC') {
            response += `## 🪙 USDC Token Mint Account\n\n`;
            response += `This is the **official USD Coin (USDC) token mint** on Solana - one of the most important and widely used stablecoins in the ecosystem.\n\n`;
        } else if (protocolName) {
            response += `## 🏷️ Known Protocol Address: ${protocolName}\n\n`;
            response += `This address matches a well-known protocol in the Solana ecosystem.\n\n`;
        } else if (account.executable) {
            response += `## 📋 Program Account (Smart Contract)\n\n`;
            response += `This account contains **executable code** and can process transactions as a smart contract.\n\n`;
        } else if (account.owner === 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') {
            response += `## 🎯 SPL Token Account\n\n`;
            response += `This account holds **SPL tokens** for a specific token mint.\n\n`;
        } else if (account.owner === '11111111111111111111111111111112') {
            response += `## 👤 User Wallet Account\n\n`;
            response += `This appears to be a **user wallet** that can hold SOL and interact with programs.\n\n`;
        } else {
            response += `## 🔍 Data Account\n\n`;
            response += `This is a **data account** owned by a specific program.\n\n`;
        }

        response += `**Account Details:**\n`;
        response += `- **SOL Balance:** ${solAmount} SOL (${solBalance.toLocaleString()} lamports)\n`;
        response += `- **Owner Program:** \`${account.owner}\`\n`;
        response += `- **Executable:** ${account.executable ? '✅ Yes (Program)' : '❌ No (Data)'}\n`;
        response += `- **Data Size:** ${(account.data?.length || 0).toLocaleString()} bytes\n`;
        response += `- **Rent Status:** ${solBalance > 890880 ? '✅ Rent Exempt' : '⚠️ Rent Required'}\n\n`;

        // Additional context for specific account types
        if (protocolName === 'USDC') {
            response += `**USDC Token Info:**\n`;
            response += `- This mint account controls the creation and destruction of USDC tokens\n`;
            response += `- USDC is pegged 1:1 to the US Dollar\n`;
            response += `- Widely used for trading, DeFi, and payments on Solana\n\n`;
        }

    } else if (accountInfo?.error) {
        response += `❌ **Account Error:** ${accountInfo.error}\n\n`;
    } else {
        response += `❌ **Account Not Found:** This address may not exist or may not be funded yet.\n\n`;
    }

    // Transaction history analysis
    if (signatures && Array.isArray(signatures) && signatures.length > 0) {
        response += `**Transaction Activity:**\n`;
        response += `- **Total Transactions:** ${signatures.length.toLocaleString()}\n`;
        response += `- **Latest Transaction:** \`${signatures[0].signature}\`\n`;

        // Analyze activity level
        let activityLevel = 'Low';
        if (signatures.length > 100) activityLevel = 'Very High';
        else if (signatures.length > 50) activityLevel = 'High';
        else if (signatures.length > 10) activityLevel = 'Medium';

        response += `- **Activity Level:** ${activityLevel}\n\n`;

        // Show recent transaction signatures
        if (signatures.length > 0) {
            response += `**Recent Transactions:**\n`;
            signatures.slice(0, 3).forEach((sig: any, i: number) => {
                response += `${i + 1}. \`${sig.signature}\`\n`;
            });
            response += `\n`;
        }
    } else if (signatures?.error) {
        response += `**Transaction History:** ❌ ${signatures.error}\n\n`;
    }

    // Actionable insights
    response += `**Key Insights:**\n`;
    if (protocolName === 'USDC') {
        response += `- This is a critical DeFi infrastructure account\n`;
        response += `- Monitor for USDC supply changes and major transfers\n`;
        response += `- Track for regulatory or compliance updates\n`;
    } else if (accountInfo?.value?.executable) {
        response += `- Program accounts can be called by other accounts\n`;
        response += `- Check program usage and transaction volume\n`;
        response += `- Monitor for upgrades or administrative changes\n`;
    } else {
        response += `- Regular account that can send/receive SOL and tokens\n`;
        response += `- Check token holdings for complete portfolio view\n`;
        response += `- Monitor activity patterns for security\n`;
    }

    response += `\n_Section computed in ${totalTime}ms_\n`;
    return response;
}

function analyzeValidatorData(question: string, results: Record<string, any>, totalTime: number): string {
    const voteAccounts = results.getVoteAccounts;

    let response = `# Validator Network Analysis\n\n`;

    if (voteAccounts) {
        const active = voteAccounts.current?.length || 0;
        const delinquent = voteAccounts.delinquent?.length || 0;
        const total = active + delinquent;

        response += `**Network Health:**\n`;
        response += `- Active Validators: **${active}** (${((active / total) * 100).toFixed(1)}%)\n`;
        response += `- Delinquent Validators: **${delinquent}** (${((delinquent / total) * 100).toFixed(1)}%)\n`;
        response += `- Total Validators: **${total}**\n\n`;

        response += `**Network Status:** ${active / total > 0.95 ? '🟢 Excellent' : active / total > 0.90 ? '🟡 Good' : '🔴 Concerning'}\n\n`;

        // Analyze validator performance if detailed data available
        if (voteAccounts.current && voteAccounts.current.length > 0 && voteAccounts.current[0].activatedStake) {
            response += `**Stake Distribution Analysis Available**\n`;
            response += `The network has detailed validator stake information that can be analyzed for decentralization metrics.\n\n`;
        }
    }

    // Tailor analysis to the user's question focus
    const qLower = question.toLowerCase();
    const focus: string[] = [];
    if (qLower.includes("delinquent")) focus.push("Delinquent validators");
    if (qLower.includes("stake")) focus.push("Stake distribution");
    if (qLower.includes("uptime") || qLower.includes("liveness")) focus.push("Validator uptime");
    if (qLower.includes("performance") || qLower.includes("tps")) focus.push("Network performance");
    if (qLower.includes("commission")) focus.push("Commission rates");
    if (focus.length > 0) {
        response += `**Query Focus:** ${focus.join(", ")}\n\n`;
    }

    response += `**Key Insights:**\n`;
    response += `- Solana network health depends on validator participation\n`;
    response += `- ${(voteAccounts?.current?.length || 0) > 900 ? 'Strong' : 'Moderate'} validator count indicates ${(voteAccounts?.current?.length || 0) > 900 ? 'robust' : 'developing'} network security\n\n`;

    response += `\n_Section computed in ${totalTime}ms_\n`;
    return response;
}

function analyzeNetworkData(question: string, results: Record<string, any>, totalTime: number): string {
    const epochInfo = results.getEpochInfo;
    const performance = results.getRecentPerformanceSamples;

    let response = `# Network Status Analysis\n\n`;

    if (epochInfo) {
        const progress = epochInfo.slotIndex && epochInfo.slotsInEpoch ?
            ((epochInfo.slotIndex / epochInfo.slotsInEpoch) * 100).toFixed(2) : '0';

        response += `**Current Epoch: ${epochInfo.epoch}**\n`;
        response += `- Progress: ${progress}% complete\n`;
        response += `- Current Slot: ${epochInfo.absoluteSlot?.toLocaleString() || epochInfo.slotIndex}\n`;
        response += `- Slots Remaining: ${epochInfo.slotsInEpoch - epochInfo.slotIndex || 'Unknown'}\n\n`;

        // Calculate estimated time remaining
        if (epochInfo.slotIndex && epochInfo.slotsInEpoch) {
            const slotsRemaining = epochInfo.slotsInEpoch - epochInfo.slotIndex;
            const hoursRemaining = (slotsRemaining * 0.4) / 3600; // ~0.4s per slot
            response += `**Estimated Time to Next Epoch:** ~${hoursRemaining.toFixed(1)} hours\n\n`;
        }
    }

    if (performance && Array.isArray(performance)) {
        const valid = performance.filter(s => s && typeof s.numTransactions === "number" && s.samplePeriodSecs > 0);
        if (valid.length > 0) {
            const avgTps = Math.round(
                valid.reduce((acc, s) => acc + (s.numTransactions / s.samplePeriodSecs), 0) / valid.length
            );
            response += `**Network Performance:**\n`;
            response += `- Current TPS: ~${avgTps}\n`;
            response += `- Performance Level: ${avgTps > 2000 ? '🟢 High' : avgTps > 1000 ? '🟡 Medium' : '🔴 Low'}\n\n`;
        }
    }

    // Tailor analysis to the user's question focus
    const qLower = question.toLowerCase();
    const focus: string[] = [];
    if (qLower.includes("tps") || qLower.includes("performance")) focus.push("Network performance (TPS)");
    if (qLower.includes("epoch") || qLower.includes("progress")) focus.push("Epoch progress");
    if (qLower.includes("slot")) focus.push("Current slot");
    if (qLower.includes("time") || qLower.includes("next epoch")) focus.push("Time to next epoch");
    if (focus.length > 0) {
        response += `**Query Focus:** ${focus.join(", ")}\n`;
        // Extra insights based on focus
        if ((qLower.includes("tps") || qLower.includes("performance")) && performance && Array.isArray(performance)) {
            const validPerf = performance.filter(s => s && typeof s.numTransactions === "number" && s.samplePeriodSecs > 0);
            if (validPerf.length > 0) {
                const tpsValues = validPerf.map(s => Math.round(s.numTransactions / s.samplePeriodSecs));
                const minTps = Math.min(...tpsValues);
                const maxTps = Math.max(...tpsValues);
                response += `- TPS Range (last ${validPerf.length} samples): ${minTps} - ${maxTps}\n`;
            }
        }
        if ((qLower.includes("epoch") || qLower.includes("progress")) && epochInfo) {
            const progressPct = epochInfo.slotIndex && epochInfo.slotsInEpoch ? ((epochInfo.slotIndex / epochInfo.slotsInEpoch) * 100).toFixed(2) : '0';
            response += `- Epoch Progress Emphasis: ${progressPct}% complete\n`;
        }
        if (qLower.includes("slot") && epochInfo?.absoluteSlot) {
            response += `- Current Absolute Slot: ${epochInfo.absoluteSlot.toLocaleString()}\n`;
        }
    }

    response += `\n_Section computed in ${totalTime}ms_\n`;
    return response;
}

function formatResultEnhanced(method: string, result: any): string {
    // Use the existing formatResult function but with enhanced context
    return formatResult(method, result);
}

function formatResult(method: string, result: any): string {
    switch (method) {
        case 'getAccountInfo':
            if (result && result.value) {
                const account = result.value;
                const solBalance = (account.lamports / 1e9).toFixed(4);
                return `- Balance: ${solBalance} SOL\n- Owner: ${account.owner}\n- Executable: ${account.executable ? 'Yes' : 'No'}\n`;
            }
            break;

        case 'getBalance':
            const balance = typeof result === 'number' ? result : result?.value || 0;
            const solAmount = (balance / 1e9).toFixed(4);
            return `SOL Balance: ${solAmount} SOL (${balance} lamports)\n`;

        case 'getVoteAccounts':
            const active = result.current?.length || 0;
            const delinquent = result.delinquent?.length || 0;
            return `- Active validators: ${active}\n- Delinquent validators: ${delinquent}\n- Total: ${active + delinquent}\n`;

        case 'getEpochInfo':
            const progress = result.slotIndex && result.slotsInEpoch ?
                ((result.slotIndex / result.slotsInEpoch) * 100).toFixed(2) : '0';
            return `- Epoch: ${result.epoch}\n- Progress: ${progress}%\n- Current slot: ${result.absoluteSlot}\n`;

        case 'getRecentPerformanceSamples':
            if (Array.isArray(result) && result.length > 0) {
                const valid = result.filter(s => s && typeof s.numTransactions === "number" && s.samplePeriodSecs > 0);
                if (valid.length > 0) {
                    const avgTps = Math.round(
                        valid.reduce((acc, s) => acc + (s.numTransactions / s.samplePeriodSecs), 0) / valid.length
                    );
                    return `Average TPS: ${avgTps} (${valid.length} samples)\n`;
                }
            }
            return 'Performance data not available\n';

        case 'getSignaturesForAddress':
            if (Array.isArray(result)) {
                const recent = result.slice(0, 3).map(sig => `  - ${sig.signature}`).join('\n');
                return `Transaction count: ${result.length}\n\nRecent signatures:\n${recent}\n`;
            }
            break;

        case 'getMoralisPortfolio':
            if (result && result.tokens) {
                const tokenCount = result.tokens.length;
                const totalValue = result.total_value_usd || 'N/A';
                return `- Tokens: ${tokenCount}\n- Total value: $${totalValue}\n`;
            }
            break;

        default:
            return `Data retrieved successfully\n`;
    }

    return 'Data processed\n';
}

function generateFallbackResponse(question: string, metrics: ExecutionMetrics): string {
    const totalTime = Date.now() - metrics.startTime;

    return `# System Status Report

**Query**: ${question}

⚠️ **Execution Issues Detected**

The system encountered stability issues while processing your request:

- **Execution time**: ${totalTime}ms
- **Errors**: ${metrics.errors.length}
- **Timeouts**: ${metrics.timeouts.length}

**Possible Causes**:
- Network connectivity issues
- RPC node overload
- API rate limits
- Complex query timeout

**Recommended Actions**:
1. Try a simpler, more specific query
2. Check if you're asking about a valid Solana address
3. Retry in a few moments if network is busy

**System Health**: Circuit breaker activated to prevent cascading failures.

For immediate assistance, try asking about:
- Current network status: "What's the current epoch?"
- Simple account lookup: "Check balance of [address]"
- Network performance: "What's the current TPS?"

*This response was generated by the fallback system to ensure reliability.*`;
}
