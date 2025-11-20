'use client';

import { Connection, ConnectionConfig } from '@solana/web3.js';

// Event emitter for RPC request tracking
class RpcEventEmitter {
    private listeners: ((data: any) => void)[] = [];

    emit(data: any) {
        this.listeners.forEach(listener => listener(data));
    }

    subscribe(callback: (data: any) => void) {
        this.listeners.push(callback);
        return () => {
            const index = this.listeners.indexOf(callback);
            if (index > -1) {
                this.listeners.splice(index, 1);
            }
        };
    }
}

export const rpcEventEmitter = new RpcEventEmitter();

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
            // Override fetch to ensure proper JSON-RPC formatting and emit events
            fetch: async (input: RequestInfo | URL, options?: RequestInit) => {
                const startTime = Date.now();
                try {
                    const response = await fetch(input, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json',
                            ...(options?.headers || {})
                        },
                        body: options?.body,
                        signal: options?.signal
                    });

                    // Emit RPC request event
                    rpcEventEmitter.emit({
                        timestamp: Date.now(),
                        url: typeof input === 'string' ? input : input.toString(),
                        method: 'POST',
                        status: response.status,
                        duration: Date.now() - startTime,
                        body: options?.body ? JSON.parse(options.body as string) : null
                    });

                    return response;
                } catch (error) {
                    // Emit error event
                    rpcEventEmitter.emit({
                        timestamp: Date.now(),
                        url: typeof input === 'string' ? input : input.toString(),
                        method: 'POST',
                        error: error,
                        duration: Date.now() - startTime
                    });
                    throw error;
                }
            }
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
    if (endpoint && (endpoint.startsWith('/api/') || endpoint === 'opensvm' || endpoint === 'osvm' || endpoint === 'gsvm')) {
        const proxyEndpoint = endpoint === 'opensvm' || endpoint === 'osvm' || endpoint === 'gsvm' ? '/api/proxy/rpc' : endpoint;
        clientConnection = new ClientConnection(proxyEndpoint);
    } else {
        console.warn('Client-side only supports proxy endpoints for security reasons');
    }
}

// Client-side helper to get available RPC endpoints (only proxy endpoints)
export function getAvailableRpcEndpoints() {
    return [
        {
            name: 'osvm rpc',
            url: '/api/proxy/rpc',
            network: 'mainnet' as const
        }
    ];
}

export default getConnection;
