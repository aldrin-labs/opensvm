/**
 * API endpoint to create an auth link for an existing API key
 * POST /api/auth/auth-link/create
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAuthLink } from '@/lib/api-auth/service';
import type { AuthLinkCreateRequest } from '@/lib/api-auth/types';

// Route segment config: Set timeout to 120 seconds
export const maxDuration = 120;


export async function POST(request: NextRequest) {
  try {
    const body: AuthLinkCreateRequest = await request.json();

    // Validate request
    if (!body.apiKeyId) {
      return NextResponse.json(
        { error: 'API key ID is required' },
        { status: 400 }
      );
    }

    // Create auth link
    const result = await createAuthLink({
      apiKeyId: body.apiKeyId,
      expiresInMinutes: body.expiresInMinutes || 15,
    });

    return NextResponse.json({
      success: true,
      authLink: result.authLink,
      expiresAt: result.expiresAt,
      token: result.token,
      message: `Auth link created. Valid for ${body.expiresInMinutes || 15} minutes.`,
    });
  } catch (error) {
    console.error('Error creating auth link:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create auth link' },
      { status: 500 }
    );
  }
}
