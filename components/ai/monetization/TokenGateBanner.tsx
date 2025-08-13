"use client";
import React from 'react';

export function TokenGateBanner({ balance, required, onOpenPanel }: { balance: number; required: number; onOpenPanel: () => void }) {
    if (balance >= required) return null;
    return (
        <div className="m-2 p-2 border border-yellow-500/50 rounded bg-yellow-500/10 text-[12px] text-yellow-200 flex items-center justify-between" role="alert" data-ai-token-gate>
            <div>
                Not enough SVMAI tokens ({balance}/{required}). Add credits to continue.
            </div>
            <button onClick={onOpenPanel} className="px-2 py-1 text-[11px] border border-yellow-500/60 rounded hover:bg-yellow-500/20">Manage Tokens</button>
        </div>
    );
}
