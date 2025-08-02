import { NextRequest, NextResponse } from 'next/server';
import { APIKeyManager } from '../../../../lib/anthropic-proxy/core/APIKeyManager';
import { JWTAuth } from '../../../../lib/anthropic-proxy/auth/JWTAuth';
import { getSessionFromCookie } from '../../../../lib/auth-server';

const apiKeyManager = new APIKeyManager();
const jwtAuth = new JWTAuth();

// Enhanced user authentication with session and JWT support
async function authenticateUser(request: NextRequest): Promise<{ isValid: boolean; userId?: string; error?: string }> {
    // Try session-based authentication first (primary method)
    try {
        const session = await getSessionFromCookie();
        if (session && session.walletAddress && Date.now() <= session.expiresAt) {
            return {
                isValid: true,
                userId: session.walletAddress
            };
        }
    } catch (error) {
        console.error('Session authentication error:', error);
    }

    // Try JWT authentication as fallback
    const authHeader = request.headers.get('Authorization');
    const jwtResult = jwtAuth.requireAuth(authHeader);
    if (jwtResult.isValid) {
        return {
            isValid: true,
            userId: jwtResult.userId
        };
    }

    // Fallback to X-User-ID for testing/development
    const userIdHeader = request.headers.get('X-User-ID');
    if (userIdHeader && process.env.NODE_ENV !== 'production') {
        console.warn('Using fallback X-User-ID authentication in non-production environment');
        return {
            isValid: true,
            userId: userIdHeader
        };
    }

    return {
        isValid: false,
        error: jwtResult.error || 'Authentication required'
    };
}

export async function POST(request: NextRequest) {
    try {
        const authResult = await authenticateUser(request);
        if (!authResult.isValid) {
            return NextResponse.json(
                {
                    error: {
                        type: 'authentication_error',
                        message: authResult.error || 'Authentication required'
                    }
                },
                { status: 401 }
            );
        }

        // Parse request body
        let body;
        try {
            body = await request.json();
        } catch (error) {
            return NextResponse.json(
                {
                    error: {
                        type: 'invalid_request_error',
                        message: 'Invalid JSON in request body'
                    }
                },
                { status: 400 }
            );
        }

        const { name } = body;

        if (!name) {
            return NextResponse.json(
                {
                    error: {
                        type: 'invalid_request_error',
                        message: 'Key name is required'
                    }
                },
                { status: 400 }
            );
        }

        // Generate new API key
        const apiKeyData = await apiKeyManager.generateKey({
            userId: authResult.userId!,
            name
        });

        return NextResponse.json({
            key: apiKeyData.apiKey,
            keyId: apiKeyData.keyId,
            name,
            createdAt: apiKeyData.createdAt.toISOString()
        });

    } catch (error) {
        console.error('Error generating API key:', error);
        return NextResponse.json(
            {
                error: {
                    type: 'api_error',
                    message: 'Failed to generate API key'
                }
            },
            { status: 500 }
        );
    }
}

export async function GET(request: NextRequest) {
    try {
        const authResult = await authenticateUser(request);
        if (!authResult.isValid) {
            return NextResponse.json(
                {
                    error: {
                        type: 'authentication_error',
                        message: authResult.error || 'Authentication required'
                    }
                },
                { status: 401 }
            );
        }

        // List user's API keys
        const keys = await apiKeyManager.listUserKeys(authResult.userId!);

        // Handle case where keys might be undefined/null
        const keyList = keys || [];

        return NextResponse.json({
            keys: keyList.map(key => ({
                keyId: key.id,
                name: key.name,
                keyPreview: `${key.keyPrefix}...`,
                createdAt: key.createdAt.toISOString(),
                lastUsedAt: key.lastUsedAt?.toISOString() || null,
                isActive: key.isActive,
                usageStats: key.usageStats
            })),
            total: keyList.length
        });

    } catch (error) {
        console.error('Error listing API keys:', error);
        return NextResponse.json(
            {
                error: {
                    type: 'api_error',
                    message: 'Failed to list API keys'
                }
            },
            { status: 500 }
        );
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const authResult = await authenticateUser(request);
        if (!authResult.isValid) {
            return NextResponse.json(
                {
                    error: {
                        type: 'authentication_error',
                        message: authResult.error || 'Authentication required'
                    }
                },
                { status: 401 }
            );
        }

        const url = new URL(request.url);
        const keyId = url.searchParams.get('keyId');

        if (!keyId) {
            return NextResponse.json(
                {
                    error: {
                        type: 'invalid_request_error',
                        message: 'Key ID is required'
                    }
                },
                { status: 400 }
            );
        }

        await apiKeyManager.deactivateKey(keyId, authResult.userId!);

        return NextResponse.json({
            success: true,
            message: 'API key deactivated successfully'
        });

    } catch (error) {
        console.error('Error deactivating API key:', error);
        return NextResponse.json(
            {
                error: {
                    type: 'api_error',
                    message: 'Failed to deactivate API key'
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
            'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-ID',
            'Access-Control-Max-Age': '86400'
        }
    });
} 