import { NextRequest, NextResponse } from 'next/server';
import { AnthropicClient } from '@/lib/anthropic-proxy/core/AnthropicClient';
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

        // Check if user has admin privileges (you may want to implement this check)
        // For now, we'll allow any authenticated user to see stats
        // In production, you should restrict this to admin users only

        // Get the client instance and retrieve stats
        const client = new AnthropicClient();
        const stats = client.getKeyUsageStats();

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