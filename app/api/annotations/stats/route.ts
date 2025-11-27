/**
 * Annotation Stats API
 *
 * GET /api/annotations/stats - Get annotation statistics
 */

import { NextResponse } from 'next/server';
import { getAnnotationStats } from '@/lib/annotations/database';

/**
 * GET /api/annotations/stats
 * Get statistics about stored annotations
 */
export async function GET() {
  try {
    const stats = await getAnnotationStats();

    return NextResponse.json({
      ...stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error getting annotation stats:', error);
    return NextResponse.json(
      { error: 'Failed to get annotation stats' },
      { status: 500 }
    );
  }
}
