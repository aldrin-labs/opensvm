import { NextRequest, NextResponse } from 'next/server';
import { APIKeyManager } from '../../../../lib/anthropic-proxy/core/APIKeyManager';
import { getAnthropicClient } from '../../../../lib/anthropic-proxy/core/AnthropicClientSingleton';

// Route segment config: Set timeout to 120 seconds
export const maxDuration = 120;


const apiKeyManager = new APIKeyManager();

// Simple in-memory cache for models
interface CacheEntry {
    data: any;
    timestamp: number;
    expiresAt: number;
}

class ModelsCache {
    private cache: Map<string, CacheEntry> = new Map();
    private readonly TTL = 5 * 60 * 1000; // 5 minutes TTL

    get(key: string): any | null {
        const entry = this.cache.get(key);
        if (!entry) return null;

        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            return null;
        }

        return entry.data;
    }

    set(key: string, data: any): void {
        const now = Date.now();
        this.cache.set(key, {
            data,
            timestamp: now,
            expiresAt: now + this.TTL
        });
    }

    clear(): void {
        this.cache.clear();
    }

    size(): number {
        return this.cache.size;
    }
}

const modelsCache = new ModelsCache();

export async function GET(request: NextRequest) {
    try {
        // Extract API key from Authorization header
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json(
                {
                    error: {
                        type: 'authentication_error',
                        message: 'Missing or invalid Authorization header'
                    }
                },
                { status: 401 }
            );
        }

        const apiKey = authHeader.substring(7); // Remove 'Bearer '

        // Validate API key
        const keyValidation = await apiKeyManager.validateKey(apiKey);
        if (!keyValidation.isValid) {
            return NextResponse.json(
                {
                    error: {
                        type: 'authentication_error',
                        message: 'Invalid API key'
                    }
                },
                { status: 401 }
            );
        }

        // Check cache first
        const cacheKey = 'models';
        let models = modelsCache.get(cacheKey);

        if (!models) {
            // Cache miss - fetch from Anthropic client
            console.log('Models cache miss - fetching from API');
            const anthropicClient = await getAnthropicClient();
            models = await anthropicClient.getModels();

            // Cache the response
            modelsCache.set(cacheKey, models);
        } else {
            console.log('Models cache hit - serving from cache');
        }

        return NextResponse.json(models, {
            headers: {
                'Cache-Control': 'public, max-age=300', // 5 minutes browser cache
                'X-Cache-Status': models === modelsCache.get(cacheKey) ? 'HIT' : 'MISS'
            }
        });

    } catch (error) {
        console.error('Error fetching models:', error);
        return NextResponse.json(
            {
                error: {
                    type: 'api_error',
                    message: 'Failed to fetch models'
                }
            },
            { status: 500 }
        );
    }
}

export async function OPTIONS(_request: NextRequest) {
    return new NextResponse(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, anthropic-version',
            'Access-Control-Max-Age': '86400'
        }
    });
} 