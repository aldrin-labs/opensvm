import { Tool, ToolContext, ToolResult } from "./types";
import { transactionInstructionAnalysisTool } from "./transactionInstructionAnalysis";
import { transactionAnalysisTool } from "./transactionAnalysis";
import { networkAnalysisTool } from "./networkAnalysis";
import { accountAnalysisTool } from "./accountAnalysis";
import { dynamicPlanExecutionTool } from "./dynamicPlanExecution";
import { stableDynamicExecutionTool } from "./stableDynamicExecution";
import { aiPlanExecutionTool } from "./aiPlanExecution";

export class ToolRegistry {
    private tools: Tool[] = [
        // Order matters - more specific tools should come first
        aiPlanExecutionTool, // PRIMARY: AI-powered tool selection and execution
        transactionInstructionAnalysisTool,
        transactionAnalysisTool,
        dynamicPlanExecutionTool, // FALLBACK: Hardcoded planning logic
        stableDynamicExecutionTool, // FALLBACK: Stable version with hardcoded fallbacks if dynamic fails
        accountAnalysisTool, // Fallback for simpler account queries
        networkAnalysisTool, // Re-enabled as safety net
    ];

    async executeTools(context: ToolContext): Promise<ToolResult & { partialData?: any }> {
        const toolExecutionStart = Date.now();
        let partialData: any = {};
        let hasPartialData = false;

        // Separate primary tools from fallback tools
        const primaryTools = this.tools.filter(tool =>
            tool.name === 'aiPlanExecution' ||
            tool.name === 'transactionInstructionAnalysis' ||
            tool.name === 'transactionAnalysis'
        );

        const fallbackTools = this.tools.filter(tool =>
            !primaryTools.includes(tool)
        );

        console.log(`🔧 Attempting ${primaryTools.length} primary tools first, then ${fallbackTools.length} fallback tools in parallel`);

        // Phase 1: Try primary tools sequentially (they're more specific/powerful)
        for (const tool of primaryTools) {
            if (tool.canHandle(context)) {
                console.log(`🎯 Executing primary tool: ${tool.name}`);
                const toolStart = Date.now();

                try {
                    const toolTimeout = new Promise<never>((_, reject) => {
                        setTimeout(() => {
                            reject(new Error(`Tool ${tool.name} execution timeout`));
                        }, 90000); // 90 second per-tool timeout
                    });

                    const toolPromise = tool.execute(context);
                    const result = await Promise.race([toolPromise, toolTimeout]);

                    const toolTime = Date.now() - toolStart;
                    console.log(`✅ Primary tool ${tool.name} completed in ${toolTime}ms`);

                    if (result.handled) {
                        console.log(`🎯 Total tool selection time: ${Date.now() - toolExecutionStart}ms`);
                        return result;
                    }
                } catch (error) {
                    const toolTime = Date.now() - toolStart;
                    console.error(`❌ Primary tool ${tool.name} failed after ${toolTime}ms:`, error);

                    // Try to extract any partial data from the error or tool
                    try {
                        if ((error as any).partialData) {
                            partialData[tool.name] = (error as any).partialData;
                            hasPartialData = true;
                            console.log(`📦 Collected partial data from ${tool.name}`);
                        }
                    } catch (extractError) {
                        // Ignore errors when extracting partial data
                    }

                    continue; // Try next primary tool
                }
            }
        }

        console.log(`⚡ Primary tools completed, trying ${fallbackTools.length} fallback tools in parallel`);

        // Phase 2: Try fallback tools in parallel
        const applicableTools = fallbackTools.filter(tool => tool.canHandle(context));

        if (applicableTools.length === 0) {
            console.warn(`⚠️ No tools can handle request: "${context.question}"`);
            return hasPartialData ? { handled: false, partialData } : { handled: false };
        }

        console.log(`🚀 Running ${applicableTools.length} fallback tools in parallel: ${applicableTools.map(t => t.name).join(', ')}`);

        // Execute all applicable tools in parallel
        const toolPromises = applicableTools.map(async (tool) => {
            const toolStart = Date.now();
            console.log(`🔧 Starting parallel execution: ${tool.name}`);

            try {
                const toolTimeout = new Promise<never>((_, reject) => {
                    setTimeout(() => {
                        reject(new Error(`Tool ${tool.name} execution timeout`));
                    }, 60000); // Reduced timeout for parallel execution
                });

                const toolPromise = tool.execute(context);
                const result = await Promise.race([toolPromise, toolTimeout]);

                const toolTime = Date.now() - toolStart;
                console.log(`✅ Parallel tool ${tool.name} completed in ${toolTime}ms`);

                return { tool: tool.name, result, success: true, time: toolTime };
            } catch (error) {
                const toolTime = Date.now() - toolStart;
                console.error(`❌ Parallel tool ${tool.name} failed after ${toolTime}ms:`, error);

                // Try to extract partial data
                let extractedData = null;
                try {
                    if ((error as any).partialData) {
                        extractedData = (error as any).partialData;
                    }
                } catch (extractError) {
                    // Ignore errors when extracting partial data
                }

                return { tool: tool.name, error: error as Error, success: false, time: toolTime, partialData: extractedData };
            }
        });

        // Wait for all tools to complete (or timeout)
        const results = await Promise.allSettled(toolPromises);

        // Process results
        for (const promiseResult of results) {
            if (promiseResult.status === 'fulfilled') {
                const toolResult = promiseResult.value;

                if (toolResult.success && toolResult.result && toolResult.result.handled) {
                    console.log(`🎯 Parallel tool ${toolResult.tool} succeeded! Total time: ${Date.now() - toolExecutionStart}ms`);
                    return toolResult.result;
                }

                // Collect partial data from successful but non-handled results
                if (toolResult.partialData) {
                    partialData[toolResult.tool] = toolResult.partialData;
                    hasPartialData = true;
                }
            } else {
                console.error(`Promise failed:`, promiseResult.reason);
            }
        }        // If we get here, no tool could handle the request completely
        console.warn(`⚠️ No tool could handle request completely: "${context.question}"`);

        // Return partial data if we have any
        if (hasPartialData) {
            console.log(`📊 Returning partial data from ${Object.keys(partialData).length} tools`);
            return { handled: false, partialData };
        }

        return { handled: false };
    } getAvailableTools(): Tool[] {
        return [...this.tools];
    }

    addTool(tool: Tool): void {
        this.tools.push(tool);
    }

    removeTool(toolName: string): boolean {
        const index = this.tools.findIndex(tool => tool.name === toolName);
        if (index > -1) {
            this.tools.splice(index, 1);
            return true;
        }
        return false;
    }
}
