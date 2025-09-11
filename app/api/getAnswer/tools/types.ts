import { Connection } from "@solana/web3.js";

export interface ToolContext {
    conn: Connection;
    question: string;
    qLower: string;
}

export interface ToolResult {
    handled: boolean;
    response?: Response;
}

export interface Tool {
    name: string;
    description: string;
    canHandle: (context: ToolContext) => boolean;
    execute: (context: ToolContext) => Promise<ToolResult>;
}
