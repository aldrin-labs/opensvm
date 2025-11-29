import { Tool, ToolContext, ToolResult } from "./types";

export const networkAnalysisTool: Tool = {
    name: "networkAnalysis",
    description: "Provides network performance metrics including TPS, slot, and block height information",

    canHandle: (context: ToolContext): boolean => {
        const { qLower } = context;

        // Don't handle if the user is asking for examples, tutorials, or how-to information
        if (qLower.includes("example") || qLower.includes("how to") || qLower.includes("curl") ||
            qLower.includes("tutorial") || qLower.includes("explain how") || qLower.includes("show me how")) {
            return false;
        }

        return qLower.includes("tps") || qLower.includes("transactions per second") ||
            qLower.includes("network load") || qLower.includes("current slot") ||
            qLower.includes("what is the slot") || qLower.includes("block height") ||
            (qLower.includes("epoch") && (qLower.includes("current") || qLower.includes("what"))) ||
            qLower.includes("validator count") || qLower.includes("validators") ||
            qLower.includes("how many validators");
    },

    execute: async (context: ToolContext): Promise<ToolResult> => {
        const { conn, qLower } = context;

        try {
            // 1) Network TPS / load
            if (qLower.includes("tps") || qLower.includes("transactions per second") || qLower.includes("network load")) {
                let samples;
                try {
                    samples = await conn.getRecentPerformanceSamples(20);
                } catch (rpcError: any) {
                    console.warn('[WARN] getRecentPerformanceSamples RPC error:', rpcError.message || rpcError);
                    // Fallback to estimation based on recent blocks
                    return {
                        handled: true,
                        response: new Response("Network performance data temporarily unavailable from RPC. Try checking recent blocks for TPS estimation.", {
                            status: 200,
                            headers: { "Content-Type": "text/plain" }
                        })
                    };
                }
                const valid = (samples || []).filter(s => s && typeof (s as any).numTransactions === "number" && (s as any).samplePeriodSecs > 0);

                if (valid.length === 0) {
                    return {
                        handled: true,
                        response: new Response("Unable to retrieve recent performance samples.", {
                            status: 200,
                            headers: { "Content-Type": "text/plain" }
                        })
                    };
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

                return {
                    handled: true,
                    response: new Response(reply, {
                        status: 200,
                        headers: { "Content-Type": "text/plain" }
                    })
                };
            }

            // 2) Current slot
            if (qLower.includes("current slot") || qLower.includes("what is the slot")) {
                const currentSlot = await conn.getSlot();
                const reply = `Current slot: ${currentSlot}`;

                return {
                    handled: true,
                    response: new Response(reply, {
                        status: 200,
                        headers: { "Content-Type": "text/plain" }
                    })
                };
            }

            // 3) Block height & epoch
            if (qLower.includes("block height") || qLower.includes("epoch")) {
                const epochInfo = await conn.getEpochInfo();
                const reply = `Current epoch info:
- Epoch: ${epochInfo.epoch}
- Block height: ${epochInfo.blockHeight}
- Slot in epoch: ${epochInfo.slotIndex}/${epochInfo.slotsInEpoch}
- Progress: ${((epochInfo.slotIndex / epochInfo.slotsInEpoch) * 100).toFixed(2)}%`;

                return {
                    handled: true,
                    response: new Response(reply, {
                        status: 200,
                        headers: { "Content-Type": "text/plain" }
                    })
                };
            }

            // 4) Top validators list
            if (qLower.includes("top") && qLower.includes("validator")) {
                const voteAccounts = await conn.getVoteAccounts();
                
                // Sort validators by activated stake (descending)
                const sortedValidators = voteAccounts.current
                    .sort((a, b) => Number(b.activatedStake) - Number(a.activatedStake))
                    .slice(0, 10); // Get top 10

                let reply = `**Top 10 Validators by Stake:**\n\n`;
                
                sortedValidators.forEach((validator, index) => {
                    const stakeInSol = (Number(validator.activatedStake) / 1_000_000_000).toFixed(0);
                    const commission = validator.commission;
                    
                    reply += `**${index + 1}.** ${validator.nodePubkey}\n`;
                    reply += `   - Stake: ${Number(stakeInSol).toLocaleString()} SOL\n`;
                    reply += `   - Commission: ${commission}%\n`;
                    reply += `   - Vote Account: ${validator.votePubkey}\n`;
                    if (validator.epochCredits && validator.epochCredits.length > 0) {
                        const latestCredits = validator.epochCredits[validator.epochCredits.length - 1];
                        reply += `   - Latest Epoch Credits: ${latestCredits[1]}\n`;
                    }
                    reply += `\n`;
                });

                const totalActiveStake = voteAccounts.current.reduce((sum, v) => sum + Number(v.activatedStake), 0);
                const topTenStake = sortedValidators.reduce((sum, v) => sum + Number(v.activatedStake), 0);
                const topTenPercentage = ((topTenStake / totalActiveStake) * 100).toFixed(2);

                reply += `**Summary:**\n`;
                reply += `- Total active validators: ${voteAccounts.current.length}\n`;
                reply += `- Top 10 control ${topTenPercentage}% of total stake\n`;
                reply += `- Total network stake: ${(totalActiveStake / 1_000_000_000).toFixed(0).toLocaleString()} SOL`;

                return {
                    handled: true,
                    response: new Response(reply, {
                        status: 200,
                        headers: { "Content-Type": "text/plain" }
                    })
                };
            }

            // 5) Validator count
            if (qLower.includes("validator count") || qLower.includes("how many validators")) {
                const voteAccounts = await conn.getVoteAccounts();
                const activeValidators = voteAccounts.current.length;
                const delinquentValidators = voteAccounts.delinquent.length;
                const totalValidators = activeValidators + delinquentValidators;

                const reply = `Current validator count:
- Active validators: ${activeValidators}
- Delinquent validators: ${delinquentValidators}
- Total validators: ${totalValidators}`;

                return {
                    handled: true,
                    response: new Response(reply, {
                        status: 200,
                        headers: { "Content-Type": "text/plain" }
                    })
                };
            }

            return { handled: false };

        } catch (error) {
            console.error('Network analysis error:', error);
            return {
                handled: true,
                response: new Response(
                    `Error retrieving network information: ${(error as Error).message}`,
                    { status: 500, headers: { "Content-Type": "text/plain" } }
                )
            };
        }
    }
};
