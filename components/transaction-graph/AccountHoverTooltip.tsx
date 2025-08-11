'use client';

import React from 'react';
import type { AccountTooltipData } from './hooks/useAccountHover';

interface AccountHoverTooltipProps {
    accountAddress: string;
    position: { x: number; y: number } | null;
    visible: boolean;
    data: AccountTooltipData | null;
    isLoading: boolean;
}

export const AccountHoverTooltip: React.FC<AccountHoverTooltipProps> = ({
    accountAddress,
    position,
    visible,
    data,
    isLoading
}) => {
    if (!visible || !position) return null;

    return (
        <div
            className="pointer-events-none absolute z-50 border rounded-lg shadow-lg p-3 max-w-sm text-xs bg-background"
            style={{ left: position.x + 8, top: position.y + 8 }}
        >
            <div className="font-semibold mb-1">{accountAddress.slice(0, 6)}...{accountAddress.slice(-6)}</div>
            {isLoading ? (
                <div className="opacity-70">Loading…</div>
            ) : (
                <div className="space-y-1">
                    <div>SOL: {data?.solBalance?.toLocaleString(undefined, { maximumFractionDigits: 6 }) ?? '—'}</div>
                    {data?.tokenBalances && data.tokenBalances.length > 0 && (
                        <div>
                            <div className="font-medium">Top tokens</div>
                            {data.tokenBalances.slice(0, 3).map((t) => (
                                <div key={`${t.mint}`}>{t.symbol || t.mint.slice(0, 4)}…: {t.balance?.toLocaleString()}</div>
                            ))}
                        </div>
                    )}
                    {data?.transactionCounts && (
                        <div>In/Out: {data.transactionCounts.totalIn}/{data.transactionCounts.totalOut}</div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AccountHoverTooltip;


