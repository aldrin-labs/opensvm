import { Tool, ToolContext, ToolResult } from "./types.ts";
import { transactionInstructionAnalysisTool } from "./transactionInstructionAnalysis.ts";
import { transactionAnalysisTool } from "./transactionAnalysis.ts";
import { networkAnalysisTool } from "./networkAnalysis.ts";
import { accountAnalysisTool } from "./accountAnalysis.ts";

export class ToolRegistry {
    private tools: Tool[] = [
        // Order matters - more specific tools should come first
        transactionInstructionAnalysisTool,
        transactionAnalysisTool,
        accountAnalysisTool,
        networkAnalysisTool,
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
