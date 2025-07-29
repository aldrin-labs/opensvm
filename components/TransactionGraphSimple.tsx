'use client';

import React from 'react';

interface SimpleTransactionGraphProps {
    initialSignature?: string;
    initialAccount?: string;
    onTransactionSelect?: (signature: string) => void;
    width?: string | number;
    height?: string | number;
    maxDepth?: number;
}

export default function SimpleTransactionGraph({
    initialSignature,
    width = '100%',
    height = '100%'
}: SimpleTransactionGraphProps) {
    return (
        <div
            style={{ width, height, border: '1px solid #ccc', padding: '20px' }}
            className="bg-background rounded-lg"
        >
            <h3>Transaction Graph (Simple Version)</h3>
            <p>Signature: {initialSignature}</p>
            <p>Graph component temporarily simplified for debugging.</p>
        </div>
    );
} 