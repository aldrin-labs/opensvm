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
        const body = await request.json();
        const endpoints = getRpcEndpoints();
        if (!endpoints || endpoints.length === 0) {
            return new Response(JSON.stringify({ error: 'No RPC endpoints configured' }), {
                status: 500,
                headers: defaultHeaders
            });
        }

        // Pick a random endpoint
        const randomIndex = Math.floor(Math.random() * endpoints.length);
        const rpcUrl = endpoints[randomIndex];
        console.log(`Proxying RPC request to random endpoint ${rpcUrl}`);

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
