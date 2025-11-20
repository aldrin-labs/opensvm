import { NextRequest, NextResponse } from 'next/server';

/**
 * Test endpoint to verify 120 second timeout is working
 * This endpoint deliberately takes 45 seconds to respond
 * If timeout is NOT configured, this will fail at ~28 seconds with 504
 * If timeout IS configured to 120s, this will succeed
 */
export async function GET(req: NextRequest) {
  const delaySeconds = parseInt(req.nextUrl.searchParams.get('delay') || '45');
  const maxDelay = 110; // Stay under 120s limit
  const actualDelay = Math.min(delaySeconds, maxDelay);
  
  console.log(`[TEST-TIMEOUT] Starting ${actualDelay}s delay test at ${new Date().toISOString()}`);
  
  const startTime = Date.now();
  
  // Wait for the specified delay
  await new Promise(resolve => setTimeout(resolve, actualDelay * 1000));
  
  const endTime = Date.now();
  const actualDuration = (endTime - startTime) / 1000;
  
  console.log(`[TEST-TIMEOUT] Completed after ${actualDuration.toFixed(2)}s`);
  
  return NextResponse.json({
    success: true,
    message: `Timeout test passed! Endpoint ran for ${actualDuration.toFixed(2)} seconds`,
    requestedDelay: actualDelay,
    actualDuration: actualDuration.toFixed(2),
    timestamp: new Date().toISOString(),
    config: {
      netlifyTimeout: '120s',
      testedAt: actualDuration.toFixed(2) + 's'
    }
  }, {
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-Test-Duration': actualDuration.toFixed(2),
      'X-Netlify-Timeout': '120'
    }
  });
}
