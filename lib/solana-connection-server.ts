// Server-side Solana connection with full RPC endpoint list
// This file should ONLY be imported by server-side code (API routes, etc.)

import { Connection, ConnectionConfig } from '@solana/web3.js';
import { getRpcEndpoints, getRpcHeaders } from './opensvm-rpc';
import { rateLimit, RateLimitError } from './rate-limit';
import { logger } from './logger';

class ProxyConnection extends Connection {
    private requestQueue: Array<{
        resolve: (value: any) => void;
        reject: (error: any) => void;
        method: string;
        args: any[];
        retryCount: number;
    }> = [];
    private isProcessingQueue = false;
    private lastRequestTime = 0;
    private readonly minRequestInterval = 10;
    private readonly maxConcurrentRequests = 12;
    private readonly maxRetries = 12;
    private activeRequests = 0;

    constructor(endpoint: string, config?: ConnectionConfig) {
        // Proxy for opensvm.com endpoints is disabled; use the provided endpoint directly
        let finalEndpoint = endpoint;
        // Ensure endpoint is absolute with http or https
        if (!/^https?:\/\//i.test(finalEndpoint)) {
            if (typeof window !== 'undefined' && window.location.origin) {
                finalEndpoint = window.location.origin + finalEndpoint;
            } else if (process.env.NEXT_PUBLIC_BASE_URL) {
                finalEndpoint = process.env.NEXT_PUBLIC_BASE_URL + finalEndpoint;
            } else {
                // During build/static generation, use a placeholder URL for relative paths
                // This will be resolved at runtime when the actual request is made
                finalEndpoint = `https://opensvm.com${finalEndpoint}`;
                logger.rpc.warn(`Using fallback base URL for build-time endpoint: ${finalEndpoint}`);
            }
        }

        super(finalEndpoint, {
            commitment: 'confirmed',
            confirmTransactionInitialTimeout: 30000,
            disableRetryOnRateLimit: false,
            httpHeaders: getRpcHeaders(endpoint),
            ...config,
        });
    }

    // Rate-limited request processing for server-side
    private async processRequestQueue() {
        if (this.isProcessingQueue || this.requestQueue.length === 0) {
            return;
        }

        this.isProcessingQueue = true;

        while (this.requestQueue.length > 0 && this.activeRequests < this.maxConcurrentRequests) {
            const request = this.requestQueue.shift();
            if (!request) break;

            // Rate limiting
            const timeSinceLastRequest = Date.now() - this.lastRequestTime;
            if (timeSinceLastRequest < this.minRequestInterval) {
                await new Promise(resolve => setTimeout(resolve, this.minRequestInterval - timeSinceLastRequest));
            }

            this.lastRequestTime = Date.now();
            this.activeRequests++;

            // Execute the request
            this.executeRequest(request);
        }

        this.isProcessingQueue = false;

        // Continue processing if there are more requests
        if (this.requestQueue.length > 0) {
            setTimeout(() => this.processRequestQueue(), this.minRequestInterval);
        }
    }

    private async executeRequest(request: {
        resolve: (value: any) => void;
        reject: (error: any) => void;
        method: string;
        args: any[];
        retryCount: number;
    }) {
        try {
            await rateLimit(`${this.rpcEndpoint}:${request.method}`, { limit: 50, windowMs: 1000 });

            // Use reflection to call the parent method
            const method = (Connection.prototype as any)[request.method];
            if (!method) {
                throw new Error(`Method ${request.method} not found`);
            }

            const result = await method.apply(this, request.args);
            request.resolve(result);
        } catch (error: any) {
            if (error instanceof RateLimitError && request.retryCount < this.maxRetries) {
                const backoffDelay = Math.min(1000 * Math.pow(2, request.retryCount), 30000);
                setTimeout(() => {
                    request.retryCount++;
                    this.requestQueue.unshift(request);
                    this.processRequestQueue();
                }, backoffDelay);
            } else {
                request.reject(error);
            }
        } finally {
            this.activeRequests--;
        }
    }
}

// Connection pool for load balancing across RPC endpoints
class ConnectionPool {
    private connections: Map<string, ProxyConnection> = new Map();
    private endpoints: string[] = [];

    constructor() {
        this.endpoints = getRpcEndpoints();
        logger.rpc.info(`Initialized with ${this.endpoints.length} OpenSVM endpoints`);
    }

    getConnection(endpoint?: string): ProxyConnection {
        // If specific endpoint is requested, use it
        if (endpoint) {
            logger.rpc.debug(`Using specific endpoint: ${endpoint}`);
            if (!this.connections.has(endpoint)) {
                this.connections.set(endpoint, new ProxyConnection(endpoint));
            }
            return this.connections.get(endpoint)!;
        }
        // Ensure we have endpoints available
        if (this.endpoints.length === 0) {
            logger.rpc.error('No RPC endpoints configured! Falling back to proxy');
            // Use full URL during build time, relative URL only during runtime
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
            const fallbackEndpoint = typeof window === 'undefined' && process.env.NODE_ENV !== 'development'
                ? `${baseUrl}/api/proxy/rpc`
                : '/api/proxy/rpc';
            if (!this.connections.has(fallbackEndpoint)) {
                this.connections.set(fallbackEndpoint, new ProxyConnection(fallbackEndpoint));
            }
            return this.connections.get(fallbackEndpoint)!;
        }

        // Random endpoint selection for load balancing
        const randomIndex = Math.floor(Math.random() * this.endpoints.length);
        const selectedEndpoint = this.endpoints[randomIndex];

        logger.rpc.debug(`Selected OpenSVM endpoint ${randomIndex + 1}/${this.endpoints.length}: ${selectedEndpoint.substring(0, 50)}...`);

        if (!this.connections.has(selectedEndpoint)) {
            this.connections.set(selectedEndpoint, new ProxyConnection(selectedEndpoint));
        }

        return this.connections.get(selectedEndpoint)!;
    }

    updateEndpoints(newEndpoints: string[]) {
        this.endpoints = newEndpoints;
        // Clear existing connections to force new ones with new endpoints
        this.connections.clear();
    }

    getAllEndpoints(): string[] {
        return [...this.endpoints];
    }
}

// Global connection pool
export const connectionPool = new ConnectionPool();

function normalizeUrl(url: string): string {
    // If the URL starts with http(s), return as-is
    if (/^https?:\/\//i.test(url)) return url;
    // If it looks like bare host (e.g., rpc.osvm.ai), prepend https://
    if (/^[\w.-]+(\:[0-9]+)?(\/|$)/.test(url)) return `https://${url}`;
    return url;
}

function resolveClusterToEndpoint(cluster: string): string | 'opensvm' | null {
    const value = cluster.trim().toLowerCase();
    if (value === 'mainnet' || value === 'mainnet-beta' || value === 'opensvm' || value === 'osvm' || value === 'gsvm') {
        return 'opensvm';
    }
    if (value === 'devnet') {
        return 'https://api.devnet.solana.com';
    }
    if (value === 'testnet') {
        return 'https://api.testnet.solana.com';
    }
    // Otherwise treat as custom endpoint or host
    if (cluster.startsWith('http://') || cluster.startsWith('https://')) {
        return cluster;
    }
    // Handle host form like rpc.osvm.ai or rpc.osvm.ai/sonic?token=abc
    return normalizeUrl(cluster);
}

// Primary connection getter
export function getConnection(endpoint?: string): ProxyConnection {
    // If an explicit endpoint is requested, honor it; otherwise use pool
    return connectionPool.getConnection(endpoint ? resolveClusterToEndpoint(endpoint) || undefined : undefined);
}

// Update RPC endpoint
export function updateRpcEndpoint(endpoint: string): void {
    if (endpoint === 'opensvm') {
        // Reset to default endpoints
        connectionPool.updateEndpoints(getRpcEndpoints());
    } else if (endpoint.startsWith('http')) {
        // Use specific external endpoint
        connectionPool.updateEndpoints([endpoint]);
    } else {
        logger.rpc.warn('Invalid RPC endpoint:', endpoint);
    }
}

// Get all available RPC endpoints
export function getServerRpcEndpoints() {
    return getRpcEndpoints();
}

export default getConnection;
