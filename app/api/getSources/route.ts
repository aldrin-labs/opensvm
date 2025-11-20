import { NextResponse } from 'next/server';

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
