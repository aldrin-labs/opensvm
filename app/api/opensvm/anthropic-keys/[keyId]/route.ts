import { NextRequest, NextResponse } from 'next/server';
import { APIKeyManager } from '../../../../../lib/anthropic-proxy/core/APIKeyManager';
import { UsageReporter } from '../../../../../lib/anthropic-proxy/reporting/UsageReporter';

// Initialize components
const apiKeyManager = new APIKeyManager();
const usageReporter = new UsageReporter();

// Initialize on first request
let initialized = false;
async function ensureInitialized() {
    if (!initialized) {
        await Promise.all([
            apiKeyManager.initialize(),
            usageReporter.initialize(),
        ]);
        initialized = true;
    }
}

/**
 * Extract user ID from request (same as parent endpoint)
 */
function extractUserId(request: NextRequest): string | null {
    const userIdHeader = request.headers.get('x-user-id');
    const authHeader = request.headers.get('authorization');

    if (userIdHeader) {
        return userIdHeader;
    }

    if (authHeader && authHeader.startsWith('Bearer ')) {
        // TODO: Implement proper JWT validation
        return 'user-from-jwt-token';
    }

    return null;
}

/**
 * GET - Get details for a specific API key
 */
export async function GET(
    request: NextRequest,
    { params }: { params: { keyId: string } }
) {
    try {
        await ensureInitialized();

        const userId = extractUserId(request);
        if (!userId) {
            return NextResponse.json(
                { error: 'Authentication required' },
                { status: 401 }
            );
        }

        const { keyId } = params;
        if (!keyId) {
            return NextResponse.json(
                { error: 'Key ID is required' },
                { status: 400 }
            );
        }

        // Get the API key and verify ownership
        const apiKey = await apiKeyManager.getKeyById(keyId);
        if (!apiKey) {
            return NextResponse.json(
                { error: 'API key not found' },
                { status: 404 }
            );
        }

        if (apiKey.userId !== userId) {
            return NextResponse.json(
                { error: 'Access denied' },
                { status: 403 }
            );
        }

        // Get detailed usage statistics
        const usageStats = await usageReporter.getKeyUsageStats(keyId);
        const usageReport = await usageReporter.getUserUsageReport(userId, 'month');

        return NextResponse.json({
            success: true,
            data: {
                keyId: apiKey.id,
                name: apiKey.name,
                keyPrefix: apiKey.keyPrefix,
                createdAt: apiKey.createdAt.toISOString(),
                lastUsedAt: apiKey.lastUsedAt?.toISOString() || null,
                isActive: apiKey.isActive,
                usageStats: {
                    totalRequests: usageStats.totalRequests,
                    totalTokensConsumed: usageStats.totalTokensConsumed,
                    totalSVMAISpent: usageStats.totalSVMAISpent,
                    lastRequestAt: usageStats.lastRequestAt?.toISOString() || null,
                    averageTokensPerRequest: usageStats.averageTokensPerRequest
                },
                monthlyUsage: {
                    requests: usageReport.totalRequests,
                    tokens: usageReport.totalTokensConsumed,
                    svmaiSpent: usageReport.totalSVMAISpent,
                    errorRate: usageReport.errorRate
                }
            }
        });

    } catch (error) {
        console.error('Error getting API key details:', error);
        return NextResponse.json(
            { error: 'Failed to get API key details' },
            { status: 500 }
        );
    }
}

/**
 * DELETE - Revoke/delete a specific API key
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: { keyId: string } }
) {
    try {
        await ensureInitialized();

        const userId = extractUserId(request);
        if (!userId) {
            return NextResponse.json(
                { error: 'Authentication required' },
                { status: 401 }
            );
        }

        const { keyId } = params;
        if (!keyId) {
            return NextResponse.json(
                { error: 'Key ID is required' },
                { status: 400 }
            );
        }

        // Get the API key and verify ownership
        const apiKey = await apiKeyManager.getKeyById(keyId);
        if (!apiKey) {
            return NextResponse.json(
                { error: 'API key not found' },
                { status: 404 }
            );
        }

        if (apiKey.userId !== userId) {
            return NextResponse.json(
                { error: 'Access denied' },
                { status: 403 }
            );
        }

        // Revoke the API key
        await apiKeyManager.revokeKey(keyId, userId);

        return NextResponse.json({
            success: true,
            message: 'API key revoked successfully',
            data: {
                keyId,
                name: apiKey.name,
                revokedAt: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Error revoking API key:', error);
        return NextResponse.json(
            { error: 'Failed to revoke API key' },
            { status: 500 }
        );
    }
}

export async function OPTIONS(_request: NextRequest) {
    return new NextResponse(null, {
        status: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-user-id',
        },
    });
} 