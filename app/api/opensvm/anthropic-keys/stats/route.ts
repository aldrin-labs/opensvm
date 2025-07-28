import { NextRequest, NextResponse } from 'next/server';
import { getAnthropicClient } from '@/lib/anthropic-proxy/core/AnthropicClientSingleton';
import { ProxyAuth } from '@/lib/anthropic-proxy/auth/ProxyAuth';

/**
 * GET /api/opensvm/anthropic-keys/stats
 * Returns OpenRouter API key usage statistics
 */
export async function GET(request: NextRequest) {
    try {
        // Verify authentication (admin only)
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json(
                { error: 'Missing or invalid authorization header' },
                { status: 401 }
            );
        }

        const apiKey = authHeader.substring(7);
        const authResult = await ProxyAuth.validateAPIKey(apiKey);

        if (!authResult.isValid || !authResult.userId) {
            return NextResponse.json(
                { error: 'Invalid API key' },
                { status: 401 }
            );
        }

        // Check if user has admin privileges
        // For now, check if the API key has a special admin flag or check userId against admin list
        const ADMIN_USER_IDS = process.env.ADMIN_USER_IDS?.split(',') || [];
        const isAdmin = ADMIN_USER_IDS.includes(authResult.userId) ||
            authResult.permissions?.includes('admin') ||
            false;

        if (!isAdmin) {
            return NextResponse.json(
                { error: 'Admin access required' },
                { status: 403 }
            );
        }

        // Get the client instance and retrieve stats
        const client = await getAnthropicClient();
        const stats = await client.getKeyUsageStats();

        // Add timestamp and format response
        const response = {
            timestamp: new Date().toISOString(),
            openRouterKeys: {
                total: stats.totalKeys,
                active: stats.activeKeys,
                failed: stats.failedKeys
            },
            usage: Object.entries(stats.usage).map(([keyId, keyStats]: [string, any]) => ({
                id: keyId,
                requests: keyStats.requests,
                lastUsed: keyStats.lastUsed ? new Date(keyStats.lastUsed).toISOString() : null,
                status: keyStats.isFailed ? 'failed' : 'active',
                preview: keyStats.keyPreview
            })),
            health: {
                allKeysOperational: stats.failedKeys === 0,
                healthScore: stats.totalKeys > 0
                    ? ((stats.activeKeys / stats.totalKeys) * 100).toFixed(1) + '%'
                    : '0%'
            }
        };

        return NextResponse.json(response, {
            status: 200,
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            }
        });

    } catch (error) {
        console.error('Error getting OpenRouter key stats:', error);

        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
} 