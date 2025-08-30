"use client";
import React, { useEffect, useState } from 'react';

export function TokenManagementPanel({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const [balance, setBalance] = useState<number>(0);
    const [tier, setTier] = useState<string>('free');
    const [usage, setUsage] = useState<number>(0);
    const [sessionId, setSessionId] = useState<string>('');

    useEffect(() => {
        if (!isOpen) return;
        (async () => {
            try {
                const res = await fetch('/app/api/monetization/balance'.replace('/app', ''));
                const json = await res.json();
                setBalance(json.balance ?? 0);
                setTier(json.tier ?? 'free');
                setUsage(json.usageThisMonth ?? 0);
                setSessionId(json.sessionId ?? '');
            } catch { }
        })();
    }, [isOpen]);

    const addTestCredit = async () => {
        try {
            const res = await fetch('/app/api/monetization/earn'.replace('/app', ''), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId, action: 'test_credit' }) });
            const json = await res.json();
            setBalance(json.balance ?? balance);
        } catch { }
    };

    return (
        <div
            className={`fixed inset-0 z-[500] ${isOpen ? '' : 'pointer-events-none opacity-0'} transition-opacity`}
            data-ai-token-panel
            data-open={isOpen ? '1' : '0'}
            role="dialog"
            aria-modal="true"
            aria-label="Token management panel"
        >
            <div className="absolute inset-0 bg-black/70" onClick={onClose} />
            <div
                className="absolute right-4 top-4 w-[360px] bg-black border border-white/20 rounded-lg shadow-lg p-4 text-white"
                data-ai-token-panel-inner
            >
                <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-semibold">SVMAI Tokens</div>
                    <button onClick={onClose} className="text-white/70 hover:text-white">✕</button>
                </div>
                <div className="text-[12px] space-y-2">
                    <div>Balance: <span className="font-mono">{balance}</span> tokens</div>
                    <div>Tier: {tier}</div>
                    <div>Usage (month): {usage}</div>
                </div>
                <div className="mt-3 border-t border-white/10 pt-3">
                    <div className="text-[12px] text-white/70 mb-2">Get more tokens</div>
                    <div className="flex gap-2">
                        <button onClick={addTestCredit} className="px-2 py-1 text-[12px] border border-white/30 rounded hover:bg-white/10">Add Test Credit (+50)</button>
                        <button disabled className="px-2 py-1 text-[12px] border border-white/20 rounded opacity-60" title="Coming soon">Packages</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
