import { NextRequest } from 'next/server';
import { getRpcEndpoints } from '@/lib/opensvm-rpc';

const defaultHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
} as const;

export async function OPTIONS() {
    return new Response(null, {
        status: 200,
        headers: new Headers({
            ...defaultHeaders,
            'Access-Control-Max-Age': '86400',
        })
    });
}

export async function POST(request: NextRequest) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
        // Handle empty or malformed request body
        let body;
        try {
            const text = await request.text();
            if (!text || text.trim() === '') {
                return new Response(JSON.stringify({ error: 'Empty request body' }), {
                    status: 400,
                    headers: defaultHeaders
                });
            }
            body = JSON.parse(text);
        } catch (parseError) {
            console.error('Failed to parse request JSON:', parseError);
            return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
                status: 400,
                headers: defaultHeaders
            });
        }

        // Resolve cluster override from query param or cookie
        const url = new URL(request.url);
        const clusterParam = url.searchParams.get('cluster');
        const rawCookie = request.cookies.get('cluster')?.value;
        const clusterCookie = rawCookie ? safeDecode(rawCookie) : undefined;

        let rpcUrl = resolveClusterToRpcUrl(clusterParam || clusterCookie);
        // If override produced a relative URL, ignore it to avoid recursion
        if (rpcUrl && !/^https?:\/\//i.test(rpcUrl)) {
            rpcUrl = null;
        }

        if (!rpcUrl) {
            const endpoints = getRpcEndpoints();
            // Use only absolute HTTP(S) endpoints to avoid proxy recursion
            const safeEndpoints = (endpoints || []).filter(u => /^https?:\/\//i.test(u));
            if (!safeEndpoints || safeEndpoints.length === 0) {
                return new Response(JSON.stringify({ error: 'No RPC endpoints configured' }), {
                    status: 500,
                    headers: defaultHeaders
                });
            }
            // Pick a random endpoint for load balancing
            const randomIndex = Math.floor(Math.random() * safeEndpoints.length);
            const fallbackUrl = safeEndpoints[randomIndex] || 'https://api.mainnet-beta.solana.com';
            console.log(`Proxying RPC request to random endpoint ${fallbackUrl}`);
            const response = await fetch(fallbackUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify(body),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                // Fallback to mainnet if 404
                if (response.status === 404) {
                    console.log('RPC endpoint returned 404, falling back to Solana mainnet');
                    const response2 = await fetch('https://api.mainnet-beta.solana.com', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json',
                        },
                        body: JSON.stringify(body),
                        signal: controller.signal,
                    });
                    const data2 = await response2.json();
                    return new Response(JSON.stringify(data2), {
                        status: response2.ok ? 200 : response2.status,
                        headers: defaultHeaders
                    });
                }

                console.error(`Error proxying RPC request: ${response.status} ${response.statusText}`);
                return new Response(JSON.stringify({ error: `RPC request failed` }), {
                    status: response.status,
                    headers: defaultHeaders
                });
            }

            const data = await response.json();
            return new Response(JSON.stringify(data), {
                status: 200,
                headers: defaultHeaders
            });
        }

        console.log(`Proxying RPC request to cluster override ${rpcUrl}`);

        let response = await fetch(rpcUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify(body),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            // Fallback to mainnet if 404
            if (response.status === 404) {
                console.log('RPC endpoint returned 404, falling back to Solana mainnet');
                response = await fetch('https://api.mainnet-beta.solana.com', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                    },
                    body: JSON.stringify(body),
                    signal: controller.signal,
                });
            }

            if (!response.ok) {
                console.error(`Error proxying RPC request: ${response.status} ${response.statusText}`);
                return new Response(JSON.stringify({ error: `RPC request failed` }), {
                    status: response.status,
                    headers: defaultHeaders
                });
            }
        }

        const data = await response.json();
        return new Response(JSON.stringify(data), {
            status: 200,
            headers: defaultHeaders
        });
    } catch (error: any) {
        clearTimeout(timeoutId);
        console.error('RPC proxy error:', error);

        let status = 500;
        let message = 'Failed to proxy RPC request';

        if (error.name === 'AbortError') {
            status = 504;
            message = 'Request timed out';
        } else if (error.message.includes('429') || error.message.includes('Too many requests')) {
            status = 429;
            message = 'Rate limit exceeded';
        }

        return new Response(JSON.stringify({ error: message }), {
            status,
            headers: defaultHeaders
        });
    }
}

function normalizeUrl(url: string): string {
    if (/^https?:\/\//i.test(url)) return url;
    if (/^[\w.-]+(\:[0-9]+)?(\/|$)/.test(url)) return `https://${url}`;
    return url;
}

function safeDecode(value: string): string {
    try { return decodeURIComponent(value); } catch { return value; }
}

function resolveClusterToRpcUrl(cluster?: string | null): string | null {
    if (!cluster) return null;
    const value = cluster.trim().toLowerCase();
    if (!value) return null;
    if (value === 'opensvm' || value === 'osvm' || value === 'gsvm' || value === 'mainnet' || value === 'mainnet-beta') {
        return null; // use default randomized endpoints
    }
    if (value === 'devnet') return 'https://api.devnet.solana.com';
    if (value === 'testnet') return 'https://api.testnet.solana.com';
    if (cluster.startsWith('http://') || cluster.startsWith('https://')) return cluster;
    return normalizeUrl(cluster);
}
