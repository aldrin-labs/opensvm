export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

// Route segment config: Set timeout to 120 seconds
export const maxDuration = 120;


/**
 * Legacy block API endpoint - redirects to new structure
 * This endpoint is deprecated. Use /api/blocks/[slot] instead.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const slot = searchParams.get('slot');

  if (!slot) {
    return NextResponse.json({
      success: false,
      error: {
        type: 'VALIDATION_ERROR',
        message: 'Slot parameter is required. Use /api/blocks/[slot] endpoint instead.',
        retryable: false
      },
      timestamp: Date.now()
    }, { status: 400 });
  }

  // Redirect to new endpoint structure
  const newUrl = new URL(`/api/blocks/${slot}`, request.url);
  
  // Preserve query parameters
  searchParams.forEach((value, key) => {
    if (key !== 'slot') {
      newUrl.searchParams.set(key, value);
    }
  });

  return NextResponse.redirect(newUrl, 301);
}