import { Tool, ToolContext, ToolResult } from "./types.ts";

export const networkAnalysisTool: Tool = {
    name: "networkAnalysis",
    description: "Provides network performance metrics including TPS, slot, and block height information",

    canHandle: (context: ToolContext): boolean => {
        const { qLower } = context;
        return qLower.includes("tps") || qLower.includes("transactions per second") ||
            qLower.includes("network load") || qLower.includes("current slot") ||
            qLower.includes("what is the slot") || qLower.includes("block height") ||
            qLower.includes("epoch");
    },

    execute: async (context: ToolContext): Promise<ToolResult> => {
        const { conn, qLower } = context;

        try {
            // 1) Network TPS / load
            if (qLower.includes("tps") || qLower.includes("transactions per second") || qLower.includes("network load")) {
                const samples = await conn.getRecentPerformanceSamples(20);
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
