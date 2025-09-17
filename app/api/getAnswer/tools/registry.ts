import { Tool, ToolContext, ToolResult } from "./types";
import { transactionInstructionAnalysisTool } from "./transactionInstructionAnalysis";
import { transactionAnalysisTool } from "./transactionAnalysis";
import { networkAnalysisTool } from "./networkAnalysis";
import { accountAnalysisTool } from "./accountAnalysis";
import { dynamicPlanExecutionTool } from "./dynamicPlanExecution";

export class ToolRegistry {
    private tools: Tool[] = [
        // Order matters - more specific tools should come first
        transactionInstructionAnalysisTool,
        transactionAnalysisTool,
        dynamicPlanExecutionTool, // Dynamic tool handles most analytical queries with narrative
        accountAnalysisTool, // Fallback for simpler account queries
        // networkAnalysisTool, // Disabled - dynamicPlanExecutionTool handles all network queries better
    ];

    async executeTools(context: ToolContext): Promise<ToolResult> {
        for (const tool of this.tools) {
            if (tool.canHandle(context)) {
                console.log(`Executing tool: ${tool.name}`);
                try {
                    const result = await tool.execute(context);
                    if (result.handled) {
                        return result;
                    }
                } catch (error) {
                    console.error(`Error in tool ${tool.name}:`, error);
                    // Continue to next tool if this one fails
                    continue;
                }
            }
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
