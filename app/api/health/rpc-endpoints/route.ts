// API endpoint to monitor RPC endpoint health
import { NextResponse } from 'next/server';
import { connectionPool } from '@/lib/solana/solana-connection-server';

// Route segment config: Set timeout to 120 seconds
export const maxDuration = 120;


export async function GET() {
  try {
    const healthStats = connectionPool.getHealthStats();
    const endpoints = connectionPool.getAllEndpoints();

    return NextResponse.json({
      totalEndpoints: endpoints.length,
      endpoints: healthStats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching RPC health stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch RPC health stats' },
      { status: 500 }
    );
  }
}
