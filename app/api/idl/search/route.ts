/**
 * IDL Search API
 *
 * GET /api/idl/search - Search IDLs by name, program ID, or instruction names
 */

import { NextRequest, NextResponse } from 'next/server';
import { searchIDLs } from '@/lib/idl/database';

/**
 * GET /api/idl/search
 * Search IDLs by query string
 *
 * Query params:
 * - q: Search query (required) - searches program ID, name, description, instruction names
 * - network: Filter by network (optional)
 * - verified: Filter by verified status (optional)
 * - limit: Max results (optional, default: 20)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const query = searchParams.get('q');
    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { error: 'Search query (q) is required' },
        { status: 400 }
      );
    }

    if (query.length < 2) {
      return NextResponse.json(
        { error: 'Search query must be at least 2 characters' },
        { status: 400 }
      );
    }

    const filters = {
      network: searchParams.get('network') || undefined,
      verified: searchParams.get('verified')
        ? searchParams.get('verified') === 'true'
        : undefined,
      limit: searchParams.get('limit')
        ? Math.min(parseInt(searchParams.get('limit')!, 10), 100)
        : 20,
    };

    const { items, total } = await searchIDLs(query.trim(), filters);

    return NextResponse.json({
      query,
      items,
      total,
      returned: items.length,
    });
  } catch (error) {
    console.error('Error searching IDLs:', error);
    return NextResponse.json(
      { error: 'Failed to search IDLs' },
      { status: 500 }
    );
  }
}
