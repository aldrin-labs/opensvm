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
            <div className="font-semibold mb-2 text-foreground">{accountAddress.slice(0, 6)}...{accountAddress.slice(-6)}</div>
            {isLoading ? (
                <div className="opacity-70">Loading…</div>
            ) : (
                <div className="space-y-1.5">
                    <div className="text-muted-foreground">
                        <span className="font-medium text-foreground">Balance:</span> {data?.solBalance?.toLocaleString(undefined, { maximumFractionDigits: 4 }) ?? '—'} SOL
                    </div>
                    {data?.tokenBalances && data.tokenBalances.length > 0 && (
                        <div className="border-t border-border pt-1.5">
                            <div className="font-medium text-foreground mb-1">Top Tokens:</div>
                            {data.tokenBalances.slice(0, 3).map((t) => (
                                <div key={`${t.mint}`} className="text-muted-foreground pl-2">
                                    {t.symbol || t.mint.slice(0, 4)}…: {t.balance?.toLocaleString()}
                                </div>
                            ))}
                        </div>
                    )}
                    {(data?.transactionCounts || data?.totalTransactions) && (
                        <div className="border-t border-border pt-1.5">
                            <div className="font-medium text-foreground mb-1">Activity:</div>
                            {data?.totalTransactions && (
                                <div className="text-muted-foreground pl-2">
                                    Total TXs: {typeof data.totalTransactions === 'string' ? data.totalTransactions : data.totalTransactions.toLocaleString()}
                                </div>
                            )}
                            {data?.tokenTransfers !== undefined && (
                                <div className="text-muted-foreground pl-2">
                                    Token Transfers (24h): {data.tokenTransfers.toLocaleString()}
                                </div>
                            )}
                            {data?.transactionCounts && (
                                <div className="text-muted-foreground pl-2">
                                    In/Out: {data.transactionCounts.totalIn}/{data.transactionCounts.totalOut}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AccountHoverTooltip;
