/**
 * IDL Stats API
 *
 * GET /api/idl/stats - Get IDL database statistics
 */

import { NextResponse } from 'next/server';
import { getIDLStats } from '@/lib/idl/database';

/**
 * GET /api/idl/stats
 * Get statistics about stored IDLs
 */
export async function GET() {
  try {
    const stats = await getIDLStats();

    return NextResponse.json({
      ...stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error getting IDL stats:', error);
    return NextResponse.json(
      { error: 'Failed to get IDL stats' },
      { status: 500 }
    );
  }
}
