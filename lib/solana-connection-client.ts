'use client';

import { Connection, ConnectionConfig } from '@solana/web3.js';

// Simple client-side connection that only uses proxy endpoints
class ClientConnection extends Connection {
    constructor(endpoint: string, config?: ConnectionConfig) {
        // Ensure endpoint is absolute with http or https
        let finalEndpoint = endpoint;
        if (!/^https?:\/\//i.test(finalEndpoint)) {
            if (typeof window !== 'undefined' && window.location.origin) {
                finalEndpoint = window.location.origin + finalEndpoint;
            } else if (process.env.NEXT_PUBLIC_BASE_URL) {
                finalEndpoint = process.env.NEXT_PUBLIC_BASE_URL + finalEndpoint;
            } else {
                throw new Error(`Invalid endpoint '${endpoint}': URL must start with http:// or https://`);
            }
        }

        super(finalEndpoint, {
            commitment: 'confirmed',
            confirmTransactionInitialTimeout: 30000,
            disableRetryOnRateLimit: false,
            httpHeaders: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            ...config,
        });
    }
}

// Client-side connection that only uses the proxy endpoint
const CLIENT_RPC_ENDPOINT = '/api/proxy/rpc';

let clientConnection: ClientConnection;

export function getConnection(): ClientConnection {
    if (!clientConnection) {
        clientConnection = new ClientConnection(CLIENT_RPC_ENDPOINT);
    }
    return clientConnection;
}

// For client-side, we only allow updating to proxy endpoints
export function updateRpcEndpoint(endpoint: string): void {
    // On client-side, we only support proxy endpoints for security
    if (endpoint && (endpoint.startsWith('/api/') || endpoint === 'opensvm')) {
        const proxyEndpoint = endpoint === 'opensvm' ? '/api/proxy/rpc' : endpoint;
        clientConnection = new ClientConnection(proxyEndpoint);
    } else {
        console.warn('Client-side only supports proxy endpoints for security reasons');
    }
}

// Client-side helper to get available RPC endpoints (only proxy endpoints)
export function getAvailableRpcEndpoints() {
    return [
        {
            name: 'OpenSVM',
            url: 'opensvm',
            network: 'mainnet' as const
        },
        {
            name: 'OpenSVM Proxy',
            url: '/api/proxy/rpc',
            network: 'mainnet' as const
        }
    ];
}

export default getConnection;
