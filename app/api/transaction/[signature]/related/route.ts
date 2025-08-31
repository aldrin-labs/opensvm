import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Lazy loader to ensure Jest module mocks are applied (avoids eager ESM binding)
async function loadDeps() {
  const [
    { getTransactionDetails },
    { findRelatedTransactions },
    { scoreRelationshipStrength }
  ] = await Promise.all([
    import('@/lib/solana'),
    import('@/lib/related-transaction-finder'),
    import('@/lib/relationship-strength-scorer')
  ]);
  return { getTransactionDetails, findRelatedTransactions, scoreRelationshipStrength };
}

 // Request validation schema
const RelatedTransactionsRequestSchema = z.object({
  maxResults: z.number().min(1).max(100).optional().default(20),
  minScore: z.number().min(0).max(1).optional().default(0.1),
  relationshipTypes: z.array(z.enum([
    'account_overlap',
    'program_usage',
    'temporal_proximity',
    'token_transfer',
    'authority_relationship'
  ])).optional(),
  timeWindow: z.number().min(1).max(86400).optional().default(3600), // seconds
  includeMetadata: z.boolean().optional().default(true),
  sortBy: z.enum(['score', 'timestamp', 'relevance']).optional().default('score')
});

// Test-safe JSON response helper (consistent with batch & analysis endpoints)
function jsonResponse(
  body: any,
  init?: { status?: number; headers?: Record<string, string> }
): any {
  if (process.env.NODE_ENV === 'test') {
    return new Response(JSON.stringify(body), {
      status: init?.status || 200,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers || {})
      }
    }) as any;
  }
  return NextResponse.json(body, init as any);
}

// Response interface
interface RelatedTransactionsResponse {
  success: boolean;
  data?: {
    signature: string;
    relatedTransactions: {
      signature: string;
      relationship: {
        type: string;
        score: number;
        explanation: string;
        sharedAccounts?: string[];
        sharedPrograms?: string[];
        timeDifference?: number;
      };
      transaction?: {
        slot: number;
        blockTime: number;
        fee: number;
        status: 'success' | 'failed';
        summary?: string;
      };
    }[];
    summary: {
      totalFound: number;
      relationshipTypes: Record<string, number>;
      averageScore: number;
      timeRange: {
        earliest: number;
        latest: number;
      };
    };
    cached: boolean;
  };
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: number;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ signature: string }> }
): Promise<NextResponse<RelatedTransactionsResponse>> {
  const startTime = Date.now();

  try {
    const { signature } = await params;
    const { searchParams } = new URL(request.url);

    // Validate signature format
    if (!signature || signature.length !== 88) {
      return jsonResponse({
        success: false,
        error: {
          code: 'INVALID_SIGNATURE',
          message: 'Invalid transaction signature format'
        },
        timestamp: Date.now()
      }, { status: 400 });
    }

    // Parse query parameters
    const queryParams = {
      maxResults: parseInt(searchParams.get('maxResults') || '20'),
      minScore: parseFloat(searchParams.get('minScore') || '0.1'),
      relationshipTypes: searchParams.get('relationshipTypes')?.split(',') as any,
      timeWindow: parseInt(searchParams.get('timeWindow') || '3600'),
      includeMetadata: searchParams.get('includeMetadata') !== 'false',
      sortBy: (searchParams.get('sortBy') || 'score') as 'score' | 'timestamp' | 'relevance'
    };

    const validatedParams = RelatedTransactionsRequestSchema.parse(queryParams);

    // Check cache first (commented out until cache methods are implemented)
    // const cacheKey = JSON.stringify({ signature, ...validatedParams });
    // const cached = cacheHelpers.getRelatedTransactions(signature, validatedParams);
    // 
    // if (cached) {
    //   return NextResponse.json({
    //     success: true,
    //     data: {
    //       ...cached,
    //       cached: true
    //     },
    //     timestamp: Date.now()
    //   });
    // }

    // Fetch the base transaction (lazy-loaded deps for Jest mocking)
    const { getTransactionDetails, findRelatedTransactions, scoreRelationshipStrength } = await loadDeps();
    const baseTransaction = await getTransactionDetails(signature);

    if (!baseTransaction) {
      return jsonResponse({
        success: false,
        error: {
          code: 'TRANSACTION_NOT_FOUND',
          message: 'Base transaction not found'
        },
        timestamp: Date.now()
      }, { status: 404 });
    }

    // Find related transactions (supports mock returning array OR object with relatedTransactions)
    const rawRelatedResults: any = await findRelatedTransactions({
      signature,
      maxResults: validatedParams.maxResults * 2, // Get more to filter later
      timeWindowHours: validatedParams.timeWindow,
      relationshipTypes: validatedParams.relationshipTypes,
      minRelevanceScore: validatedParams.minScore
    });

    const relatedArray: any[] = Array.isArray(rawRelatedResults)
      ? rawRelatedResults
      : Array.isArray(rawRelatedResults?.relatedTransactions)
        ? rawRelatedResults.relatedTransactions
        : Array.isArray(rawRelatedResults?.transactions)
          ? rawRelatedResults.transactions
          : [];

    if (!Array.isArray(relatedArray)) {
      return jsonResponse({
        success: false,
        error: {
          code: 'RELATED_TRANSACTIONS_ERROR',
          message: 'Unable to derive related transactions list from finder result'
        },
        timestamp: Date.now()
      }, { status: 500 });
    }

    // Normalize minimal mock shapes (array items may only have transaction + relationshipType)
    const normalizedRelated = relatedArray.map(r => {
      if (!r.relationship) {
        return {
          ...r,
          signature: r.signature || r.transaction?.signature,
          relationship: {
            type: r.relationshipType || 'unknown',
            sharedElements: {
              accounts: r.details?.sharedAccounts || r.sharedAccounts || [],
              programs: r.sharedPrograms || [],
              timeWindow: r.timeDifference
            }
          },
          slot: r.slot || r.transaction?.slot,
          blockTime: r.blockTime || r.transaction?.blockTime,
          summary: r.summary
        };
      }
      return r;
    });

    // Score and filter relationships
    const scoredRelations = await Promise.all(
      normalizedRelated.map(async (related) => {
        try {
          const score = await scoreRelationshipStrength(
            related.relationship,
            {
              sourceTransaction: baseTransaction,
              candidateTransaction: related as any, // Type assertion needed
              allRelatedTransactions: normalizedRelated
            }
          );

          return {
            ...related,
            score: score?.overallScore ?? score?.score ?? 0,
            explanation: Array.isArray(score?.factors)
              ? score.factors.map((f: any) => f?.description).filter(Boolean).join(', ')
              : (score?.explanation || ''),
            details: {
              sharedAccounts: related.relationship?.sharedElements?.accounts,
              sharedPrograms: related.relationship?.sharedElements?.programs,
              timeDifference: related.relationship?.sharedElements?.timeWindow
            }
          };
        } catch {
          return {
            ...related,
            score: 0,
            explanation: 'Scoring failed',
            details: {
              sharedAccounts: related.relationship?.sharedElements?.accounts,
              sharedPrograms: related.relationship?.sharedElements?.programs,
              timeDifference: related.relationship?.sharedElements?.timeWindow
            }
          };
        }
      })
    );

    // Filter by minimum score and sort
    let filteredRelations = scoredRelations
      .filter(rel => rel.score >= validatedParams.minScore)
      .slice(0, validatedParams.maxResults);

    // Sort by specified criteria
    switch (validatedParams.sortBy) {
      case 'score':
        filteredRelations.sort((a, b) => b.score - a.score);
        break;
      case 'timestamp':
        filteredRelations.sort((a, b) =>
          (b.blockTime || 0) - (a.blockTime || 0));
        break;
      case 'relevance':
        // Custom relevance scoring combining score and recency
        filteredRelations.sort((a, b) => {
          const aRelevance = a.score * 0.7 +
            (a.blockTime ? (Date.now() / 1000 - a.blockTime) / 86400 * 0.3 : 0);
          const bRelevance = b.score * 0.7 +
            (b.blockTime ? (Date.now() / 1000 - b.blockTime) / 86400 * 0.3 : 0);
          return bRelevance - aRelevance;
        });
        break;
    }

    // Format response data
    const relatedTransactions = filteredRelations.map(rel => ({
      signature: rel.signature,
      relationship: {
        type: rel.relationship.type,
        score: rel.score,
        explanation: rel.explanation,
        sharedAccounts: rel.details?.sharedAccounts,
        sharedPrograms: rel.details?.sharedPrograms,
        timeDifference: rel.details?.timeDifference
      },
      transaction: validatedParams.includeMetadata ? {
        slot: rel.slot,
        blockTime: rel.blockTime || 0,
        fee: 0, // Fee not available in RelatedTransaction type
        status: 'success', // Status not available in RelatedTransaction type
        summary: rel.summary
      } : undefined
    }));

    // Calculate summary statistics
    const relationshipTypes: Record<string, number> = {};
    let totalScore = 0;
    let earliestTime = Infinity;
    let latestTime = 0;

    filteredRelations.forEach(rel => {
      relationshipTypes[rel.relationship.type] =
        (relationshipTypes[rel.relationship.type] || 0) + 1;
      totalScore += rel.score;

      if (rel.blockTime) {
        earliestTime = Math.min(earliestTime, rel.blockTime);
        latestTime = Math.max(latestTime, rel.blockTime);
      }
    });

    const summary = {
      totalFound: filteredRelations.length,
      relationshipTypes,
      averageScore: filteredRelations.length > 0 ? totalScore / filteredRelations.length : 0,
      timeRange: {
        earliest: earliestTime === Infinity ? 0 : earliestTime,
        latest: latestTime
      }
    };

    const result: RelatedTransactionsResponse['data'] = {
      signature,
      relatedTransactions: relatedTransactions as any, // Type assertion for relationship compatibility
      summary,
      cached: false
    };

    // Cache the result (commented out until cache methods are implemented)
    // cacheHelpers.setRelatedTransactions(
    //   signature,
    //   result,
    //   validatedParams,
    //   15 * 60 * 1000 // 15 minutes
    // );

    const processingTime = Date.now() - startTime;

    return jsonResponse({
      success: true,
      data: result,
      timestamp: Date.now()
    }, {
      headers: {
        'X-Processing-Time': processingTime.toString(),
        'Cache-Control': 'public, max-age=900' // 15 minutes
      }
    });

  } catch (error) {
    console.error('Related transactions error:', error);

    return jsonResponse({
      success: false,
      error: {
        code: 'RELATED_TRANSACTIONS_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      },
      timestamp: Date.now()
    }, { status: 500 });
  }
}

// POST method for more complex related transaction queries
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ signature: string }> }
): Promise<NextResponse<RelatedTransactionsResponse>> {
  try {
    const { signature: _signature } = await params;
    const body = await request.json();

    // Validate request body
    const validatedParams = RelatedTransactionsRequestSchema.parse(body);

    // Create a new request with query parameters
    const url = new URL(request.url);
    Object.entries(validatedParams).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        url.searchParams.set(key, value.join(','));
      } else {
        url.searchParams.set(key, value.toString());
      }
    });

    const newRequest = new NextRequest(url, {
      method: 'GET',
      headers: request.headers
    });

    return GET(newRequest, { params });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonResponse({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request parameters',
          details: error.errors
        },
        timestamp: Date.now()
      }, { status: 400 });
    }

    return jsonResponse({
      success: false,
      error: {
        code: 'REQUEST_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      timestamp: Date.now()
    }, { status: 500 });
  }
}
