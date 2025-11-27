/**
 * Bulk Annotations API
 *
 * POST /api/annotations/bulk - Bulk import annotations
 * GET /api/annotations/bulk - Export all annotations
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  bulkImportAnnotations,
  exportAnnotations,
  AnnotationInput,
} from '@/lib/annotations/database';

/**
 * POST /api/annotations/bulk
 * Bulk import annotations
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!Array.isArray(body.annotations)) {
      return NextResponse.json(
        { error: 'annotations array is required' },
        { status: 400 }
      );
    }

    const result = await bulkImportAnnotations(body.annotations as AnnotationInput[]);

    return NextResponse.json({
      ...result,
      total: body.annotations.length,
    });
  } catch (error) {
    console.error('Error bulk importing annotations:', error);
    return NextResponse.json(
      { error: 'Failed to bulk import annotations' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/annotations/bulk
 * Export all annotations
 */
export async function GET() {
  try {
    const annotations = await exportAnnotations();

    return NextResponse.json({
      count: annotations.length,
      annotations,
      exportedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error exporting annotations:', error);
    return NextResponse.json(
      { error: 'Failed to export annotations' },
      { status: 500 }
    );
  }
}
