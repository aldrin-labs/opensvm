import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getTransactionDetails } from '@/lib/solana';
import { findRelatedTransactions } from '@/lib/related-transaction-finder';
import { scoreRelationshipStrength } from '@/lib/relationship-strength-scorer';
import { cacheHelpers } from '@/lib/transaction-cache';

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
  { params }: { params: { signature: string } }
): Promise<NextResponse<RelatedTransactionsResponse>> {
  const startTime = Date.now();
  
  try {
    const { signature } = params;
    const { searchParams } = new URL(request.url);
    
    // Validate signature format
    if (!signature || signature.length !== 88) {
      return NextResponse.json({
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

    // Check cache first
    const cacheKey = JSON.stringify({ signature, ...validatedParams });
    const cached = cacheHelpers.getRelatedTransactions(signature, validatedParams);
    
    if (cached) {
      return NextResponse.json({
        success: true,
        data: {
          ...cached,
          cached: true
        },
        timestamp: Date.now()
      });
    }

    // Fetch the base transaction
    const baseTransaction = await getTransactionDetails(signature);
    
    if (!baseTransaction) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'TRANSACTION_NOT_FOUND',
          message: 'Base transaction not found'
        },
        timestamp: Date.now()
      }, { status: 404 });
    }

    // Find related transactions
    const relatedResults = await findRelatedTransactions(baseTransaction, {
      maxResults: validatedParams.maxResults * 2, // Get more to filter later
      timeWindow: validatedParams.timeWindow,
      relationshipTypes: validatedParams.relationshipTypes
    });

    // Score and filter relationships
    const scoredRelations = await Promise.all(
      relatedResults.map(async (related) => {
        const score = await scoreRelationshipStrength(
          baseTransaction,
          related.transaction,
          related.relationshipType
        );
        
        return {
          ...related,
          score: score.score,
          explanation: score.explanation,
          details: score.details
        };
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
          (b.transaction.blockTime || 0) - (a.transaction.blockTime || 0));
        break;
      case 'relevance':
        // Custom relevance scoring combining score and recency
        filteredRelations.sort((a, b) => {
          const aRelevance = a.score * 0.7 + 
            (a.transaction.blockTime ? (Date.now() / 1000 - a.transaction.blockTime) / 86400 * 0.3 : 0);
          const bRelevance = b.score * 0.7 + 
            (b.transaction.blockTime ? (Date.now() / 1000 - b.transaction.blockTime) / 86400 * 0.3 : 0);
          return bRelevance - aRelevance;
        });
        break;
    }

    // Format response data
    const relatedTransactions = filteredRelations.map(rel => ({
      signature: rel.transaction.signature,
      relationship: {
        type: rel.relationshipType,
        score: rel.score,
        explanation: rel.explanation,
        sharedAccounts: rel.details?.sharedAccounts,
        sharedPrograms: rel.details?.sharedPrograms,
        timeDifference: rel.details?.timeDifference
      },
      transaction: validatedParams.includeMetadata ? {
        slot: rel.transaction.slot,
        blockTime: rel.transaction.blockTime || 0,
        fee: rel.transaction.meta?.fee || 0,
        status: rel.transaction.meta?.err ? 'failed' : 'success',
        summary: rel.details?.summary
      } : undefined
    }));

    // Calculate summary statistics
    const relationshipTypes: Record<string, number> = {};
    let totalScore = 0;
    let earliestTime = Infinity;
    let latestTime = 0;

    filteredRelations.forEach(rel => {
      relationshipTypes[rel.relationshipType] = 
        (relationshipTypes[rel.relationshipType] || 0) + 1;
      totalScore += rel.score;
      
      if (rel.transaction.blockTime) {
        earliestTime = Math.min(earliestTime, rel.transaction.blockTime);
        latestTime = Math.max(latestTime, rel.transaction.blockTime);
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

    const result = {
      signature,
      relatedTransactions,
      summary,
      cached: false
    };

    // Cache the result
    cacheHelpers.setRelatedTransactions(
      signature, 
      result, 
      validatedParams,
      15 * 60 * 1000 // 15 minutes
    );

    const processingTime = Date.now() - startTime;
    
    return NextResponse.json({
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
    
    return NextResponse.json({
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
  { params }: { params: { signature: string } }
): Promise<NextResponse<RelatedTransactionsResponse>> {
  try {
    const { signature } = params;
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
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request parameters',
          details: error.errors
        },
        timestamp: Date.now()
      }, { status: 400 });
    }
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'REQUEST_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      timestamp: Date.now()
    }, { status: 500 });
  }
}