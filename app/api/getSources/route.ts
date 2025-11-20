import { NextResponse } from 'next/server';

// Route segment config: Set timeout to 120 seconds
export const maxDuration = 120;


export async function GET() {
  return NextResponse.json({
    sources: [
      {
        name: 'RPC Node',
        status: 'operational',
        latency: '45ms'
      }
    ]
  });
}
