/**
 * Annotation by ID API
 *
 * GET /api/annotations/[id] - Get annotation by ID
 * PUT /api/annotations/[id] - Update annotation
 * DELETE /api/annotations/[id] - Delete annotation
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getAnnotation,
  updateAnnotation,
  deleteAnnotation,
} from '@/lib/annotations/database';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/annotations/[id]
 * Get a specific annotation
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const annotation = await getAnnotation(id);

    if (!annotation) {
      return NextResponse.json(
        { error: 'Annotation not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(annotation);
  } catch (error) {
    console.error('Error getting annotation:', error);
    return NextResponse.json(
      { error: 'Failed to get annotation' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/annotations/[id]
 * Update an annotation
 */
export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await req.json();

    const updated = await updateAnnotation(id, {
      label: body.label,
      description: body.description,
      type: body.type,
      tags: body.tags,
      category: body.category,
      risk: body.risk,
      metadata: body.metadata,
    });

    if (!updated) {
      return NextResponse.json(
        { error: 'Annotation not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating annotation:', error);

    if (error instanceof Error) {
      const validationKeywords = ['Invalid', 'required', 'must be', 'Must be', 'Maximum', 'characters'];
      if (validationKeywords.some(kw => error.message.includes(kw))) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to update annotation' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/annotations/[id]
 * Delete an annotation
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const deleted = await deleteAnnotation(id);

    if (!deleted) {
      return NextResponse.json(
        { error: 'Annotation not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error('Error deleting annotation:', error);
    return NextResponse.json(
      { error: 'Failed to delete annotation' },
      { status: 500 }
    );
  }
}
