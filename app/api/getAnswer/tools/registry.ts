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

    async executeTools(context: ToolContext): Promise<ToolResult> {
        const toolExecutionStart = Date.now();
        let lastError: Error | null = null;

        for (const tool of this.tools) {
            if (tool.canHandle(context)) {
                console.log(`🔧 Executing tool: ${tool.name}`);
                const toolStart = Date.now();
                
                try {
                    // Add per-tool timeout protection (3x increase)
                    const toolTimeout = new Promise<never>((_, reject) => {
                        setTimeout(() => {
                            reject(new Error(`Tool ${tool.name} execution timeout`));
                        }, 90000); // 90 second per-tool timeout
                    });

                    const toolPromise = tool.execute(context);
                    const result = await Promise.race([toolPromise, toolTimeout]);
                    
                    const toolTime = Date.now() - toolStart;
                    console.log(`✅ Tool ${tool.name} completed in ${toolTime}ms`);
                    
                    if (result.handled) {
                        console.log(`🎯 Total tool selection time: ${Date.now() - toolExecutionStart}ms`);
                        return result;
                    }
                } catch (error) {
                    const toolTime = Date.now() - toolStart;
                    console.error(`❌ Tool ${tool.name} failed after ${toolTime}ms:`, error);
                    lastError = error as Error;
                    
                    // For stability issues, continue to next tool
                    // This ensures fallback chain works properly
                    continue;
                }
            }
        }

        // If we get here, no tool could handle the request
        console.warn(`⚠️ No tool could handle request: "${context.question}"`);
        if (lastError) {
            console.error(`Last error encountered:`, lastError);
        }

        return { handled: false };
    }

    getAvailableTools(): Tool[] {
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
