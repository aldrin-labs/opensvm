'use client';

import React from 'react';

interface TransactionGraphProps {
    initialSignature?: string;
    initialAccount?: string;
    onTransactionSelect?: (signature: string) => void;
    width?: string | number;
    height?: string | number;
    maxDepth?: number;
}

export default function TransactionGraphStub({
    initialSignature,
    width = '100%',
    height = '400px'
}: TransactionGraphProps) {
    return (
        <div
            style={{ width, height }}
            className="border border-border rounded-lg bg-background p-6 flex flex-col items-center justify-center text-center"
        >
            <div className="mb-4">
                <h3 className="text-lg font-semibold text-foreground mb-2">Transaction Graph</h3>
                <p className="text-sm text-muted-foreground">
                    Graph visualization temporarily disabled while fixing client reference issues.
                </p>
            </div>

            {initialSignature && (
                <div className="bg-muted/30 p-3 rounded-md">
                    <p className="text-xs text-muted-foreground mb-1">Transaction:</p>
                    <code className="text-xs font-mono text-foreground">
                        {initialSignature.slice(0, 20)}...
                    </code>
                </div>
            )}

            <div className="mt-4 text-xs text-muted-foreground">
                Full graph functionality will be restored soon.
            </div>
        </div>
    );
} 