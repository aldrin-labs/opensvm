// Binance-compatible Ping endpoint
// GET /api/v3/ping - Test connectivity

import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET() {
  return NextResponse.json({});
}
