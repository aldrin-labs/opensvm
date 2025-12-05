/**
 * MCP Memory API
 *
 * REST API for memory operations:
 * - Store memories
 * - Search memories semantically
 * - Get investigation context
 *
 * @module app/api/mcp/memory
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// In-memory store for demo (use Redis/Qdrant in production)
const memories = new Map<string, any>();
const userMemories = new Map<string, Set<string>>();

/**
 * POST /api/mcp/memory - Store a memory
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, content, type, metadata, importance } = body;

    if (!userId || !content) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, content' },
        { status: 400 }
      );
    }

    const id = `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const memory = {
      id,
      userId,
      type: type || 'knowledge',
      content,
      metadata: metadata || {},
      importance: importance || 50,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      accessCount: 0,
    };

    memories.set(id, memory);

    // Index by user
    if (!userMemories.has(userId)) {
      userMemories.set(userId, new Set());
    }
    userMemories.get(userId)!.add(id);

    return NextResponse.json({
      success: true,
      memory: {
        id: memory.id,
        type: memory.type,
        importance: memory.importance,
        createdAt: memory.createdAt,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/mcp/memory - Search memories
 *
 * Query params:
 * - userId: Required
 * - query: Search query (optional)
 * - types: Comma-separated types (optional)
 * - target: Filter by target address (optional)
 * - limit: Max results (default: 10)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const query = searchParams.get('query');
    const types = searchParams.get('types')?.split(',').filter(Boolean);
    const target = searchParams.get('target');
    const limit = parseInt(searchParams.get('limit') || '10');

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing required parameter: userId' },
        { status: 400 }
      );
    }

    // Get user's memories
    const userMemoryIds = userMemories.get(userId) || new Set();
    let results: any[] = [];

    for (const id of userMemoryIds) {
      const memory = memories.get(id);
      if (!memory) continue;

      // Type filter
      if (types && types.length > 0 && !types.includes(memory.type)) {
        continue;
      }

      // Target filter
      if (target && memory.metadata?.target !== target) {
        continue;
      }

      // Simple text matching for query
      let score = memory.importance / 100;
      if (query) {
        const queryLower = query.toLowerCase();
        const contentLower = memory.content.toLowerCase();

        if (contentLower.includes(queryLower)) {
          score += 0.5;
        }

        // Word overlap
        const queryWords = queryLower.split(/\s+/);
        const contentWords = contentLower.split(/\s+/);
        const overlap = queryWords.filter(w => contentWords.includes(w)).length;
        score += overlap * 0.1;
      }

      results.push({
        memory,
        score,
        matchedOn: query ? ['text_match'] : ['importance'],
      });
    }

    // Sort by score
    results.sort((a, b) => b.score - a.score);
    results = results.slice(0, limit);

    return NextResponse.json({
      count: results.length,
      memories: results.map(r => ({
        id: r.memory.id,
        type: r.memory.type,
        content: r.memory.content,
        metadata: r.memory.metadata,
        importance: r.memory.importance,
        score: r.score,
        matchedOn: r.matchedOn,
        createdAt: r.memory.createdAt,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/mcp/memory - Delete a memory
 */
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');
    const userId = searchParams.get('userId');

    if (!id || !userId) {
      return NextResponse.json(
        { error: 'Missing required parameters: id, userId' },
        { status: 400 }
      );
    }

    const memory = memories.get(id);
    if (!memory || memory.userId !== userId) {
      return NextResponse.json(
        { error: 'Memory not found or access denied' },
        { status: 404 }
      );
    }

    memories.delete(id);
    userMemories.get(userId)?.delete(id);

    return NextResponse.json({ success: true, deletedId: id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
