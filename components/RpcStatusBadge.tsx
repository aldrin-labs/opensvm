"use client";

import { useEffect, useMemo, useState } from "react";
import { rpcEventEmitter } from "@/lib/solana-connection-client";

// Keys for localStorage persistence
const STORAGE_KEY_TOTALS = "rpcRequestTotals"; // map of rpc -> total count
const STORAGE_KEY_MINUTE = "rpcRequestMinute"; // map of rpc -> { windowStartMs, count }

function readCookie(name: string): string | null {
    if (typeof document === "undefined") return null;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return decodeURIComponent(parts.pop()!.split(";").shift() || "");
    return null;
}

function writeCookie(name: string, value: string, maxAgeSec: number) {
    if (typeof document === "undefined") return;
    const secure = typeof window !== "undefined" && window.location.protocol === "https:";
    const attrs = `; path=/; max-age=${maxAgeSec}; SameSite=Lax${secure ? "; Secure" : ""}`;
    document.cookie = `${name}=${encodeURIComponent(value)}${attrs}`;
}

function getActiveRpcLabel(): string {
    // Priority: cluster cookie; otherwise default proxy
    const cluster = readCookie("cluster");
    if (!cluster || cluster === "opensvm") return "osvm rpc";
    if (cluster === "devnet" || cluster === "testnet" || cluster === "mainnet" || cluster === "mainnet-beta") return cluster;
    
    // Extract hostname from URL for custom RPC endpoints
    try {
        const url = new URL(cluster);
        return url.hostname; // Returns just the hostname without protocol
    } catch {
        // If not a valid URL, return a shortened version
        return cluster.length > 20 ? cluster.substring(0, 17) + "..." : cluster;
    }
}

function getActiveRpcKey(): string {
    const cluster = readCookie("cluster");
    if (!cluster || cluster === "opensvm") return "opensvm";
    return cluster.toLowerCase();
}

function loadJson<T>(key: string, fallback: T): T {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return fallback;
        return JSON.parse(raw) as T;
    } catch {
        return fallback;
    }
}

function saveJson<T>(key: string, value: T) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch { }
}

export function RpcStatusBadge() {
    const [rpcLabel, setRpcLabel] = useState<string>(getActiveRpcLabel());
    const [rpcKey, setRpcKey] = useState<string>(getActiveRpcKey());
    const [requestsPerMinute, setRequestsPerMinute] = useState<number>(0);
    const [totalRequests, setTotalRequests] = useState<number>(0);

    // A small event hook: subscribe to RPC events from solana-connection-client
    // Counts per active rpcKey using event emitter pattern

    // Initialize counters from storage
    useEffect(() => {
        if (typeof window === "undefined") return;

        const totals = loadJson<Record<string, number>>(STORAGE_KEY_TOTALS, {});
        setTotalRequests(totals[rpcKey] || 0);

        const minute = loadJson<Record<string, { windowStartMs: number; count: number }>>(STORAGE_KEY_MINUTE, {});
        const windowInfo = minute[rpcKey];
        if (windowInfo) {
            const now = Date.now();
            const withinWindow = now - windowInfo.windowStartMs < 60_000;
            setRequestsPerMinute(withinWindow ? windowInfo.count : 0);
        } else {
            setRequestsPerMinute(0);
        }
    }, [rpcKey]);

    // Subscribe to RPC events from solana-connection-client
    useEffect(() => {
        console.log('🚀 RPC Badge: Subscribing to RPC events...');

        const unsubscribe = rpcEventEmitter.subscribe((eventData) => {
            console.log('📡 RPC Event received:', eventData);

            // Only count successful requests (status < 500) or if no status (for errors)
            if (eventData.status && eventData.status >= 500) {
                console.log('❌ Skipping server error:', eventData.status);
                return;
            }

            const currentKey = getActiveRpcKey();
            console.log('🔑 Current RPC key:', currentKey);

            // Update totals
            const totals = loadJson<Record<string, number>>(STORAGE_KEY_TOTALS, {});
            const newTotal = (totals[currentKey] || 0) + 1;
            totals[currentKey] = newTotal;
            saveJson(STORAGE_KEY_TOTALS, totals);
            console.log('📈 Updated totals:', totals);

            // Update minute window
            const minute = loadJson<Record<string, { windowStartMs: number; count: number }>>(STORAGE_KEY_MINUTE, {});
            const now = Date.now();
            const windowInfo = minute[currentKey];
            if (!windowInfo || now - windowInfo.windowStartMs >= 60_000) {
                minute[currentKey] = { windowStartMs: now, count: 1 };
            } else {
                minute[currentKey] = { windowStartMs: windowInfo.windowStartMs, count: windowInfo.count + 1 };
            }
            saveJson(STORAGE_KEY_MINUTE, minute);
            console.log('⏱️ Updated minute window:', minute);

            // Update UI if this matches current RPC key
            if (currentKey === rpcKey) {
                setTotalRequests(newTotal);
                const info = minute[currentKey];
                setRequestsPerMinute(info ? info.count : 0);
                console.log('🎯 UI updated:', { total: newTotal, rpm: info ? info.count : 0 });
            } else {
                console.log('⚠️ Key mismatch:', { currentKey, rpcKey });
            }
        });

        return () => {
            console.log('🛑 RPC Badge: Unsubscribing from RPC events');
            unsubscribe();
        };
    }, [rpcKey]);

    // Observe cookie changes on navigation to reflect new RPC label quickly
    useEffect(() => {
        const interval = setInterval(() => {
            const key = getActiveRpcKey();
            const label = getActiveRpcLabel();
            setRpcKey(prev => (prev !== key ? key : prev));
            setRpcLabel(prev => (prev !== label ? label : prev));
        }, 1500);
        return () => clearInterval(interval);
    }, []);

    const isOverride = useMemo(() => rpcKey !== "opensvm", [rpcKey]);

    const clearOverride = () => {
        // Set cookie to opensvm and reset local minute counter, keep totals per RPC (persist)
        writeCookie("cluster", "opensvm", 60 * 60 * 24 * 30);
        setRpcKey("opensvm");
        setRpcLabel("osvm rpc");
        // Reset in-memory minute counter for this rpcKey only
        const minute = loadJson<Record<string, { windowStartMs: number; count: number }>>(STORAGE_KEY_MINUTE, {});
        delete minute[rpcKey];
        saveJson(STORAGE_KEY_MINUTE, minute);
        setRequestsPerMinute(0);
    };

    const resetTotalsForCurrent = () => {
        const totals = loadJson<Record<string, number>>(STORAGE_KEY_TOTALS, {});
        delete totals[rpcKey];
        saveJson(STORAGE_KEY_TOTALS, totals);
        setTotalRequests(0);
    };

    // Manual test function to verify counting works
    const testRpcCounting = async () => {
        // Only run in browser environment, not during SSR/build
        if (typeof window === "undefined") {
            console.log('Test RPC call skipped during SSR/build');
            return;
        }

        try {
            // Make a test RPC call to our proxy with absolute URL
            const baseUrl = window.location.origin;
            const response = await fetch(`${baseUrl}/api/proxy/rpc`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 'test-' + Date.now(),
                    method: 'getHealth',
                    params: []
                })
            });
            console.log('Test RPC call completed:', response.status);
        } catch (error) {
            console.error('Test RPC call failed:', error);
        }
    };

    if (typeof window === "undefined") return null;

    return (
        <div
            className="ml-2 flex items-center gap-1 text-xs px-1.5 rounded-md border border-border/40 bg-muted/40 w-25 h-14"
            onDoubleClick={testRpcCounting}
            title="Double-click to test RPC counting"
        >
            <div className="flex flex-col items-center justify-center gap-0 flex-1">
                <div className="flex items-center gap-1">
                    <span className={`inline-block w-1 rounded-full ${isOverride ? "bg-amber-500" : "bg-emerald-500"}`} />
                    <span className="text-[8px] font-medium" title={rpcLabel}>{rpcLabel}</span>
                </div>
                <div className="text-[8px] text-muted-foreground font-mono" title="RPM / Total">
                    rpm:{requestsPerMinute} all:{totalRequests}
                </div>
            </div>
            {(isOverride || totalRequests > 0) && (
                <div className="flex flex-col justify-center gap-0.5">
                    {isOverride && (
                        <button
                            onClick={clearOverride}
                            className="w-3 h-3 text-[6px] rounded bg-amber-500/20 text-amber-700 hover:bg-amber-500/30 flex items-center justify-center"
                            title="Clear override"
                        >
                            C
                        </button>
                    )}
                    <button
                        onClick={resetTotalsForCurrent}
                        className="w-3 h-3 text-[6px] rounded bg-muted text-foreground hover:bg-muted/70 flex items-center justify-center"
                        title="Reset total counter"
                    >
                        R
                    </button>
                </div>
            )}
        </div>
    );
}
