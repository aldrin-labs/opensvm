// Server-side Solana connection with full RPC endpoint list
// This file should ONLY be imported by server-side code (API routes, etc.)

import { Connection, ConnectionConfig } from '@solana/web3.js';
import { getRpcEndpoints, getRpcHeaders } from './rpc/opensvm-rpc';
import { rateLimit, RateLimitError } from '../api/rate-limit';
import { logger } from '../logging/logger';

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

// Endpoint health metrics
interface EndpointHealth {
    successCount: number;
    failureCount: number;
    lastSuccess: number;
    lastFailure: number;
    consecutiveFailures: number;
    avgLatency: number;
    totalRequests: number;
}

// Connection pool for load balancing across RPC endpoints
class ConnectionPool {
    private connections: Map<string, ProxyConnection> = new Map();
    private endpoints: string[] = [];
    private endpointHealth: Map<string, EndpointHealth> = new Map();
    private readonly HEALTH_FAILURE_THRESHOLD = 5; // Mark endpoint as unhealthy after 5 consecutive failures
    private readonly HEALTH_RECOVERY_TIME = 60000; // Try unhealthy endpoints again after 1 minute

    constructor() {
        this.endpoints = getRpcEndpoints();
        logger.rpc.info(`Initialized with ${this.endpoints.length} OpenSVM endpoints`);
        
        // Initialize health tracking for all endpoints
        for (const endpoint of this.endpoints) {
            this.endpointHealth.set(endpoint, {
                successCount: 0,
                failureCount: 0,
                lastSuccess: Date.now(),
                lastFailure: 0,
                consecutiveFailures: 0,
                avgLatency: 0,
                totalRequests: 0
            });
        }
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
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://osvm.ai';
            const fallbackEndpoint = typeof window === 'undefined' && process.env.NODE_ENV !== 'development'
                ? `${baseUrl}/api/proxy/rpc`
                : '/api/proxy/rpc';
            if (!this.connections.has(fallbackEndpoint)) {
                this.connections.set(fallbackEndpoint, new ProxyConnection(fallbackEndpoint));
            }
            return this.connections.get(fallbackEndpoint)!;
        }

        // Filter out unhealthy endpoints (too many consecutive failures)
        const now = Date.now();
        const healthyEndpoints = this.endpoints.filter(ep => {
            const health = this.endpointHealth.get(ep);
            if (!health) return true; // If no health data, consider it healthy
            
            // If endpoint has too many consecutive failures, only retry after recovery time
            if (health.consecutiveFailures >= this.HEALTH_FAILURE_THRESHOLD) {
                const timeSinceLastFailure = now - health.lastFailure;
                if (timeSinceLastFailure < this.HEALTH_RECOVERY_TIME) {
                    return false; // Still in recovery period
                }
            }
            return true;
        });

        // If all endpoints are unhealthy, use all endpoints (give them another chance)
        const candidateEndpoints = healthyEndpoints.length > 0 ? healthyEndpoints : this.endpoints;

        // Weighted random selection: prefer endpoints with better success rates
        const endpointScores = candidateEndpoints.map(ep => {
            const health = this.endpointHealth.get(ep);
            if (!health || health.totalRequests === 0) return { endpoint: ep, score: 1.0 };
            
            const successRate = health.successCount / health.totalRequests;
            const latencyPenalty = Math.min(health.avgLatency / 5000, 1); // Penalize high latency (>5s)
            const score = successRate * (1 - latencyPenalty * 0.5);
            
            return { endpoint: ep, score: Math.max(score, 0.1) }; // Min score 0.1
        });

        // Select endpoint using weighted random
        const totalScore = endpointScores.reduce((sum, e) => sum + e.score, 0);
        let randomValue = Math.random() * totalScore;
        let selectedEndpoint = endpointScores[0].endpoint;

        for (const { endpoint, score } of endpointScores) {
            randomValue -= score;
            if (randomValue <= 0) {
                selectedEndpoint = endpoint;
                break;
            }
        }

        const selectedIndex = this.endpoints.indexOf(selectedEndpoint);
        logger.rpc.debug(`Selected OpenSVM endpoint ${selectedIndex + 1}/${this.endpoints.length}: ${selectedEndpoint.substring(0, 50)}...`);

        if (!this.connections.has(selectedEndpoint)) {
            this.connections.set(selectedEndpoint, new ProxyConnection(selectedEndpoint));
        }

        return this.connections.get(selectedEndpoint)!;
    }

    updateEndpoints(newEndpoints: string[]) {
        this.endpoints = newEndpoints;
        // Clear existing connections to force new ones with new endpoints
        this.connections.clear();
        
        // Initialize health tracking for new endpoints
        for (const endpoint of newEndpoints) {
            if (!this.endpointHealth.has(endpoint)) {
                this.endpointHealth.set(endpoint, {
                    successCount: 0,
                    failureCount: 0,
                    lastSuccess: Date.now(),
                    lastFailure: 0,
                    consecutiveFailures: 0,
                    avgLatency: 0,
                    totalRequests: 0
                });
            }
        }
    }

    // Track successful request for endpoint health
    recordSuccess(endpoint: string, latencyMs: number) {
        const health = this.endpointHealth.get(endpoint);
        if (!health) return;
        
        health.successCount++;
        health.lastSuccess = Date.now();
        health.consecutiveFailures = 0; // Reset consecutive failures
        health.totalRequests++;
        
        // Update rolling average latency
        health.avgLatency = (health.avgLatency * (health.totalRequests - 1) + latencyMs) / health.totalRequests;
    }

    // Track failed request for endpoint health
    recordFailure(endpoint: string) {
        const health = this.endpointHealth.get(endpoint);
        if (!health) return;
        
        health.failureCount++;
        health.lastFailure = Date.now();
        health.consecutiveFailures++;
        health.totalRequests++;
        
        if (health.consecutiveFailures >= this.HEALTH_FAILURE_THRESHOLD) {
            logger.rpc.warn(`Endpoint ${endpoint.substring(0, 50)}... marked unhealthy (${health.consecutiveFailures} consecutive failures)`);
        }
    }

    // Get health stats for all endpoints
    getHealthStats() {
        const stats: Record<string, any> = {};
        for (const [endpoint, health] of this.endpointHealth.entries()) {
            const successRate = health.totalRequests > 0 ? (health.successCount / health.totalRequests * 100).toFixed(1) : 'N/A';
            stats[endpoint] = {
                successRate: `${successRate}%`,
                avgLatency: `${health.avgLatency.toFixed(0)}ms`,
                consecutiveFailures: health.consecutiveFailures,
                totalRequests: health.totalRequests
            };
        }
        return stats;
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

function resolveClusterToEndpoint(cluster: string): string | null {
    const value = cluster.trim().toLowerCase();
    if (value === 'mainnet' || value === 'mainnet-beta' || value === 'opensvm' || value === 'osvm' || value === 'gsvm') {
        // Return null to use the default connection pool
        return null;
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
    const resolved = endpoint ? resolveClusterToEndpoint(endpoint) : undefined;
    return connectionPool.getConnection(resolved || undefined);
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
