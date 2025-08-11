'use client';

import React from 'react';
import type { TransactionTooltipData } from './hooks/useEdgeHover';

interface Props {
    signature: string;
    position: { x: number; y: number } | null;
    visible: boolean;
    data: TransactionTooltipData | null;
    isLoading: boolean;
}

export const TransactionEdgeTooltip: React.FC<Props> = ({ signature, position, visible, data, isLoading }) => {
    if (!visible || !position) return null;
    return (
        <div
            className="pointer-events-none absolute z-50 border rounded-lg shadow-lg p-3 max-w-sm text-xs bg-background"
            style={{ left: position.x + 8, top: position.y + 8 }}
        >
            <div className="font-semibold mb-1">Tx {signature.slice(0, 6)}...{signature.slice(-6)}</div>
            {isLoading ? (
                <div className="opacity-70">Loading…</div>
            ) : (
                <div className="space-y-1">
                    <div>Type: {data?.type ?? '—'}</div>
                    {data?.tokenSymbol && (
                        <div>Amount: {data.amount?.toLocaleString()} {data.tokenSymbol}</div>
                    )}
                    {!data?.tokenSymbol && data?.amount != null && (
                        <div>Amount: {data.amount.toLocaleString()}</div>
                    )}
                    {data?.isFunding ? <div className="text-amber-600">Initial funding</div> : null}
                    {data?.fee != null ? <div>Fee: {data.fee}</div> : null}
                </div>
            )}
        </div>
    );
};

export default TransactionEdgeTooltip;


