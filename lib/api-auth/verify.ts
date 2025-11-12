/**
 * Simple auth verification for API routes
 * Verifies session-based authentication via cookies
 */

import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';

export async function verifyAuth(request: NextRequest) {
  try {
    // Get wallet address from cookie-based session
    const cookieStore = await cookies();
    const walletCookie = cookieStore.get('wallet_address');
    
    if (!walletCookie?.value) {
      return {
        success: false,
        walletAddress: null,
        error: 'No active session'
      };
    }

    // In production, you would verify this against a session store
    // For now, we trust the cookie value
    return {
      success: true,
      walletAddress: walletCookie.value,
      user: {
        walletAddress: walletCookie.value
      }
    };
  } catch (error) {
    console.error('Auth verification error:', error);
    return {
      success: false,
      walletAddress: null,
      error: 'Authentication failed'
    };
  }
}

// Alternative for API key authentication (future enhancement)
export async function verifyApiKeyAuth(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key');
  
  if (!apiKey) {
    return {
      success: false,
      error: 'API key required'
    };
  }

  // Import validateApiKey from service
  const { validateApiKey } = await import('./service');
  const validatedKey = await validateApiKey(apiKey);
  
  if (!validatedKey) {
    return {
      success: false,
      error: 'Invalid API key'
    };
  }

  return {
    success: true,
    apiKey: validatedKey,
    userId: validatedKey.userId
  };
}
