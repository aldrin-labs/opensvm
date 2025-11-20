import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyActivity, getApiKey, validateApiKey } from '@/lib/api-auth/service';
import { PublicKey } from '@solana/web3.js';
import nacl from 'tweetnacl';

// Route segment config: Set timeout to 120 seconds
export const maxDuration = 120;


/**
 * GET /api/auth/api-keys/activity
 * Get activity logs for an API key
 * Supports two authentication methods:
 * 1. Wallet signature (walletAddress, signature, message)
 * 2. API key (X-API-Key header) - returns activity for that key
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    let apiKeyId = searchParams.get('apiKeyId');
    const walletAddress = searchParams.get('walletAddress');
    const signature = searchParams.get('signature');
    const message = searchParams.get('message');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Check for API key authentication
    const apiKeyHeader = request.headers.get('X-API-Key') || request.headers.get('Authorization')?.replace('Bearer ', '');
    
    let authenticatedUserId: string | null = null;

    // Method 1: API Key authentication
    if (apiKeyHeader) {
      const validatedKey = await validateApiKey(apiKeyHeader);
      if (!validatedKey || validatedKey.status !== 'active') {
        return NextResponse.json(
          { error: 'Invalid or inactive API key' },
          { status: 401 }
        );
      }
      authenticatedUserId = validatedKey.userId || null;
      // If no apiKeyId provided, use the authenticated key's ID
      if (!apiKeyId) {
        apiKeyId = validatedKey.id;
      }
    }
    // Method 2: Wallet signature authentication
    else if (walletAddress && signature && message) {
      // Verify the signature
      try {
        const publicKey = new PublicKey(walletAddress);
        const messageBytes = new TextEncoder().encode(message);
        const signatureBytes = Buffer.from(signature, 'base64');
        
        const isValid = nacl.sign.detached.verify(
          messageBytes,
          signatureBytes,
          publicKey.toBytes()
        );

        if (!isValid) {
          return NextResponse.json(
            { error: 'Invalid signature' },
            { status: 401 }
          );
        }

        // Verify message is recent (within 5 minutes)
        const messageMatch = message.match(/Timestamp: (\d+)/);
        if (messageMatch) {
          const timestamp = parseInt(messageMatch[1]);
          const now = Date.now();
          const fiveMinutes = 5 * 60 * 1000;
          
          if (now - timestamp > fiveMinutes) {
            return NextResponse.json(
              { error: 'Signature expired. Please sign a new message.' },
              { status: 401 }
            );
          }
        }
        
        authenticatedUserId = walletAddress;
      } catch (error) {
        return NextResponse.json(
          { error: 'Invalid wallet address or signature' },
          { status: 401 }
        );
      }
    } else {
      // No authentication method provided
      return NextResponse.json(
        { error: 'Authentication required. Provide either X-API-Key header or wallet signature.' },
        { status: 401 }
      );
    }

    if (!authenticatedUserId) {
      return NextResponse.json(
        { error: 'Authentication failed' },
        { status: 401 }
      );
    }

    if (!apiKeyId) {
      return NextResponse.json(
        { error: 'apiKeyId is required' },
        { status: 400 }
      );
    }

    // Verify the API key belongs to the authenticated user
    const apiKey = await getApiKey(apiKeyId);
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key not found' },
        { status: 404 }
      );
    }

    if (apiKey.userId !== authenticatedUserId) {
      return NextResponse.json(
        { error: 'Unauthorized. This API key does not belong to you.' },
        { status: 403 }
      );
    }

    const activityRequest = {
      apiKeyId,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    };

    const activity = await getApiKeyActivity(activityRequest);

    return NextResponse.json(activity);
  } catch (error) {
    console.error('Error fetching API key activity:', error);
    return NextResponse.json(
      { error: 'Failed to fetch activity logs' },
      { status: 500 }
    );
  }
}
