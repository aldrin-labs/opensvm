// Binance-compatible Server Time endpoint
// GET /api/v3/time - Check server time

import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET() {
  return NextResponse.json({
    serverTime: Date.now(),
  });
}
