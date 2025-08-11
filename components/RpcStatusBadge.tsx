"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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
    if (!cluster || cluster === "opensvm") return "OpenSVM (pooled)";
    if (cluster === "devnet" || cluster === "testnet" || cluster === "mainnet" || cluster === "mainnet-beta") return cluster;
    return cluster; // custom URL or host
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

    // A small event hook: count successful fetches to our proxy as RPC requests
    // We patch window.fetch minimally once per mount; counts per active rpcKey
    const fetchPatchedRef = useRef(false);

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

    // Patch fetch once to count calls to our proxy that reach network successfully
    useEffect(() => {
        if (typeof window === "undefined" || fetchPatchedRef.current) return;
        fetchPatchedRef.current = true;

        const originalFetch = window.fetch.bind(window);
        window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
            try {
                const response = await originalFetch(input, init);
                try {
                    const url = typeof input === "string" ? input : (input as URL).toString();
                    // Count only POST calls to our proxy or full URLs to RPC (in case of custom)
                    const isRpcCall = /\/api\/proxy\/rpc$/.test(url) || /https?:\/\//i.test(url) && init?.method === "POST";
                    if (isRpcCall) {
                        const currentKey = getActiveRpcKey();
                        // Update totals
                        const totals = loadJson<Record<string, number>>(STORAGE_KEY_TOTALS, {});
                        const newTotal = (totals[currentKey] || 0) + 1;
                        totals[currentKey] = newTotal;
                        saveJson(STORAGE_KEY_TOTALS, totals);

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

                        // If the active key matches current state, reflect to UI
                        if (currentKey === rpcKey) {
                            setTotalRequests(newTotal);
                            const info = minute[currentKey];
                            setRequestsPerMinute(info ? info.count : 0);
                        }
                    }
                } catch { }
                return response;
            } catch (e) {
                throw e;
            }
        };

        return () => {
            window.fetch = originalFetch;
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
        setRpcLabel("OpenSVM (pooled)");
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

    if (typeof window === "undefined") return null;

    return (
        <div className="ml-2 flex flex-col items-center gap-0.5 text-xs px-1.5 py-1 rounded-md border border-border/40 bg-muted/40 w-16">
            <div className="flex items-center gap-1">
                <span className={`inline-block w-1.5 h-1.5 rounded-full ${isOverride ? "bg-amber-500" : "bg-emerald-500"}`} />
                <span className="text-[10px] font-medium truncate" title={rpcLabel}>RPC</span>
            </div>
            <div className="flex flex-col items-center gap-0" title="Requests per minute / Total requests">
                <div className="text-[9px] text-muted-foreground">
                    <span className="font-mono">{requestsPerMinute}</span>
                </div>
                <div className="text-[9px] text-muted-foreground">
                    <span className="font-mono">{totalRequests}</span>
                </div>
            </div>
            {(isOverride || totalRequests > 0) && (
                <div className="flex gap-0.5 mt-0.5">
                    {isOverride && (
                        <button
                            onClick={clearOverride}
                            className="px-1 py-0.5 text-[8px] rounded bg-amber-500/20 text-amber-700 hover:bg-amber-500/30"
                            title="Clear override"
                        >
                            C
                        </button>
                    )}
                    <button
                        onClick={resetTotalsForCurrent}
                        className="px-1 py-0.5 text-[8px] rounded bg-muted text-foreground hover:bg-muted/70"
                        title="Reset total counter"
                    >
                        R
                    </button>
                </div>
            )}
        </div>
    );
}


