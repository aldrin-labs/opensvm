/**
 * API endpoint to create a new API key
 * POST /api/auth/api-keys/create
 */

import { NextRequest, NextResponse } from 'next/server';
import { createApiKey, createAuthLink } from '@/lib/api-auth/service';
import type { ApiKeyCreateRequest } from '@/lib/api-auth/types';

export async function POST(request: NextRequest) {
  try {
    const body: ApiKeyCreateRequest & { generateAuthLink?: boolean } = await request.json();

    // Validate request
    if (!body.name || body.name.trim().length === 0) {
      return NextResponse.json(
        { error: 'API key name is required' },
        { status: 400 }
      );
    }

    // Create API key
    const result = await createApiKey({
      name: body.name,
      permissions: body.permissions,
      expiresInDays: body.expiresInDays,
      metadata: body.metadata,
    });

    // Optionally generate auth link
    let authLinkData;
    if (body.generateAuthLink) {
      authLinkData = await createAuthLink({
        apiKeyId: result.apiKey.id,
        expiresInMinutes: 15,
      });
    }

    return NextResponse.json({
      success: true,
      apiKey: {
        id: result.apiKey.id,
        name: result.apiKey.name,
        status: result.apiKey.status,
        createdAt: result.apiKey.createdAt,
        expiresAt: result.apiKey.expiresAt,
        permissions: result.apiKey.permissions,
      },
      rawKey: result.rawKey,
      authLink: authLinkData?.authLink,
      authLinkExpiresAt: authLinkData?.expiresAt,
      message: 'API key created successfully. Save the raw key - it will not be shown again!',
    });
  } catch (error) {
    console.error('Error creating API key:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create API key' },
      { status: 500 }
    );
  }
}
