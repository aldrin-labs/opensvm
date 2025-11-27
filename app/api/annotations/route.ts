/**
 * Annotations API
 *
 * GET /api/annotations - List/search annotations
 * POST /api/annotations - Create a new annotation
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  createAnnotation,
  searchAnnotations,
  AnnotationInput,
} from '@/lib/annotations/database';

/**
 * GET /api/annotations
 * Search and list annotations
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const query = {
      q: searchParams.get('q') || undefined,
      type: searchParams.get('type') as AnnotationInput['type'] | undefined,
      risk: searchParams.get('risk') as 'safe' | 'suspicious' | 'malicious' | 'unknown' | undefined,
      tags: searchParams.get('tags')?.split(',').filter(Boolean) || undefined,
      category: searchParams.get('category') || undefined,
      address: searchParams.get('address') || undefined,
      limit: parseInt(searchParams.get('limit') || '50', 10),
      offset: parseInt(searchParams.get('offset') || '0', 10),
    };

    const result = await searchAnnotations(query);

    // Don't reflect query params back to prevent XSS
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error searching annotations:', error);
    return NextResponse.json(
      { error: 'Failed to search annotations' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/annotations
 * Create a new annotation
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const input: AnnotationInput = {
      address: body.address,
      type: body.type,
      label: body.label,
      description: body.description,
      tags: body.tags,
      category: body.category,
      risk: body.risk,
      metadata: body.metadata,
      createdBy: body.createdBy,
    };

    const annotation = await createAnnotation(input);

    return NextResponse.json(annotation, { status: 201 });
  } catch (error) {
    console.error('Error creating annotation:', error);

    if (error instanceof Error) {
      // Return validation errors with 400 status
      const validationKeywords = ['Invalid', 'required', 'must be', 'Must be', 'Maximum', 'characters'];
      if (validationKeywords.some(kw => error.message.includes(kw))) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to create annotation' },
      { status: 500 }
    );
  }
}
