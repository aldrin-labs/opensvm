import { Tool, ToolContext, ToolResult } from "./types";
import Together from "together-ai";

interface PlanStep {
    tool: string;
    reason: string;
    input?: string;
}

export const dynamicPlanExecutionTool: Tool = {
    name: "dynamicPlanExecution",
    description: "Dynamically generates and executes plans to answer user questions",

    canHandle: (context: ToolContext): boolean => {
        // Handle questions that need dynamic analysis but aren't hardcoded
        const { qLower } = context;

        // Don't handle if asking for examples/tutorials
        if (qLower.includes("example") || qLower.includes("how to") || qLower.includes("curl") ||
            qLower.includes("tutorial") || qLower.includes("explain how") || qLower.includes("show me how")) {
            return false;
        }

        // Handle analytical questions that need data fetching
        return qLower.includes("validator") || qLower.includes("count") ||
            qLower.includes("network") || qLower.includes("current") ||
            qLower.includes("epoch") || qLower.includes("performance") ||
            qLower.includes("tps") || qLower.includes("slot") ||
            qLower.includes("leader") || qLower.includes("schedule") ||
            qLower.includes("producing") || qLower.includes("block") ||
            qLower.includes("account") || qLower.includes("balance") ||
            qLower.includes("address") || qLower.includes("transaction") ||
            qLower.includes("history") || qLower.includes("analytics");
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
            const finalAnswer = await synthesizeResults(question, plan, results);
            console.log('Final answer length:', finalAnswer.length);
            console.log('Final answer content:', JSON.stringify(finalAnswer));

            return {
                handled: true,
                response: new Response(finalAnswer, {
                    status: 200,
                    headers: {
                        "Content-Type": "text/plain; charset=utf-8",
                        "Content-Length": finalAnswer.length.toString()
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
    else if (qLower.includes('account') || qLower.includes('address') || qLower.includes('balance')) {
        // Check if it looks like a Solana address (base58, roughly 32-44 chars)
        const addressPattern = /[1-9A-HJ-NP-Za-km-z]{32,44}/;
        const potentialAddress = question.match(addressPattern);

        if (potentialAddress) {
            const address = potentialAddress[0];
            plan.push({
                tool: 'getAccountInfo',
                reason: 'Get account information and data',
                input: address
            });
            plan.push({
                tool: 'getBalance',
                reason: 'Get account SOL balance',
                input: address
            });

            // If asking about transaction history
            if (qLower.includes('transaction') || qLower.includes('history')) {
                plan.push({
                    tool: 'getConfirmedSignaturesForAddress2',
                    reason: 'Get recent transaction history for the account',
                    input: address
                });
            }
        } else {
            // General account info request without specific address
            plan.push({
                tool: 'getEpochInfo',
                reason: 'Get current network context for account analysis'
            });
        }
    }

    // Transaction analysis queries
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
    }    // If no specific plan generated, provide general network overview
    if (plan.length === 0) {
        plan.push({
            tool: 'getEpochInfo',
            reason: 'Get current network status as starting point for analysis'
        });
    }

    return plan;
} async function executePlan(plan: PlanStep[], conn: any): Promise<Record<string, any>> {
    const results: Record<string, any> = {};

    for (const step of plan) {
        try {
            let result;

            // Check if the method exists on the connection object
            if (typeof conn[step.tool] === 'function') {
                // Handle methods that need specific parameters
                if (step.tool === 'getRecentPerformanceSamples') {
                    result = await conn[step.tool](20);
                } else if (step.input) {
                    // If step has input parameter, pass it
                    result = await conn[step.tool](step.input);
                } else {
                    // Call method without parameters
                    result = await conn[step.tool]();
                }
            } else {
                console.warn(`Method ${step.tool} not found on connection object`);
                results[step.tool] = { error: `Method ${step.tool} not available` };
                continue;
            }

            results[step.tool] = result;

        } catch (error) {
            console.error(`Error executing ${step.tool}:`, error);
            results[step.tool] = { error: (error as Error).message };
        }
    }

    return results;
}

async function synthesizeResults(question: string, plan: PlanStep[], results: Record<string, any>): Promise<string> {
    console.log(`Synthesizing results for ${plan.length} plan steps:`, plan.map(p => p.tool).join(', '));

    if (!process.env.TOGETHER_API_KEY) {
        throw new Error("TOGETHER_API_KEY environment variable is not set");
    }

    // Prepare data context for LLM
    const dataContext = Object.entries(results)
        .map(([method, result]) => {
            if (result && !result.error) {
                // Handle large datasets like leader schedule
                if (method === 'getLeaderSchedule' && result && typeof result === 'object') {
                    // Summarize leader schedule instead of including full data
                    const scheduleEntries = Object.entries(result);
                    const sampleSize = Math.min(10, scheduleEntries.length);
                    const sample = scheduleEntries.slice(0, sampleSize);

                    return `${method}: Leader schedule retrieved with ${scheduleEntries.length} slots mapped to validators. Sample entries:
${sample.map(([slot, pubkey]) => `  Slot ${slot}: ${pubkey}`).join('\n')}
${scheduleEntries.length > sampleSize ? `  ... and ${scheduleEntries.length - sampleSize} more slot assignments` : ''}`;
                }

                // Handle account information
                if (method === 'getAccountInfo' && result && result.value) {
                    const account = result.value;
                    return `${method}: Account found - Owner: ${account.owner}, Lamports: ${account.lamports}, Data size: ${account.data?.length || 0} bytes, Executable: ${account.executable}`;
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

    const together = new Together({
        apiKey: process.env.TOGETHER_API_KEY,
    });

    const synthesisPrompt = `You are an expert Solana blockchain analyst with deep knowledge of account analytics, transaction patterns, and DeFi protocols. You have executed a plan to gather data and now need to synthesize the results into a clear, informative answer with AI-powered insights.

Original Question: ${question}

Plan Executed:
${plan.map((step, i) => `${i + 1}. ${step.tool}: ${step.reason}`).join('\n')}

Data Retrieved:
${dataContext}

Instructions:
- Provide a clear, direct answer to the user's question using the retrieved data
- Be specific with numbers, values, and technical details from the data
- For account analytics, provide insights about account type, purpose, activity patterns, and potential use cases
- For transaction analysis, explain the transaction flow, involved accounts, and any notable patterns
- If analyzing balances, provide context about the amounts in both lamports and SOL
- If any data is missing or errored, mention it briefly but focus on what was successfully retrieved
- Use AI-powered analysis to identify patterns, anomalies, or interesting insights from the data
- Keep the response concise but informative with actionable insights
- Do not mention the plan execution or tools - just provide the analysis
- Format the response in a clean, readable way with headers and bullet points where appropriate

Answer:`;

    try {
        const answer = await together.chat.completions.create({
            model: "moonshotai/Kimi-K2-Instruct-0905",
            messages: [
                {
                    role: "system",
                    content: synthesisPrompt
                }
            ],
            stream: false,
        });

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