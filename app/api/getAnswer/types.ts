import { z } from 'zod';

export interface ToolDefinition {
    name: string;
    description: string;
    inputSchema: z.ZodSchema<any>;
    execute: (input: any) => Promise<{ tool: string; input: any }>;
}

export interface AnalyticsContext {
    address: string;
    timeframe?: string;
    includeAdvanced?: boolean;
}

export interface AnalyticsResult {
    tool: string;
    input: any;
    metadata?: {
        timestamp: number;
        requestId?: string;
        processingTime?: number;
    };
}
