import { NextRequest } from 'next/server';
import { getConnection } from '@/lib/solana/solana-connection-server';

const defaultHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
} as const;

function safeDecode(value: string): string | undefined {
    try {
        return decodeURIComponent(value);
    } catch (e) {
        return undefined;
    }
}

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

        const url = new URL(request.url);
        const clusterParam = url.searchParams.get('cluster');
        const rawCookie = request.cookies.get('cluster')?.value;
        const clusterCookie = rawCookie ? safeDecode(rawCookie) : undefined;
        const cluster = clusterParam || clusterCookie;

        const conn = getConnection(cluster);
        let rpcUrl = conn.rpcEndpoint;

        // If override produced a relative URL, use default instead to avoid recursion
        if (rpcUrl && !/^https?:\/\//i.test(rpcUrl)) {
            rpcUrl = getConnection().rpcEndpoint;
        }

        console.log(`Proxying RPC request to endpoint: ${rpcUrl}`);

        const response = await fetch(rpcUrl, {
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
                const fallbackConn = getConnection();
                const response2 = await fetch(fallbackConn.rpcEndpoint, {
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
