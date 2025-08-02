import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getTransactionDetails } from '@/lib/solana';
import { analyzeTransactionWithAI } from '@/lib/ai-transaction-analyzer';

// Request validation schema
const ExplainRequestSchema = z.object({
  level: z.enum(['basic', 'intermediate', 'advanced']).optional().default('intermediate'),
  focus: z.enum(['overview', 'technical', 'financial', 'security']).optional().default('overview'),
  includeRisks: z.boolean().optional().default(true),
  includeRecommendations: z.boolean().optional().default(true),
  regenerate: z.boolean().optional().default(false),
  language: z.string().optional().default('en')
});

// Response interface
interface ExplainTransactionResponse {
  success: boolean;
  data?: {
    signature: string;
    explanation: {
      summary: string;
      mainAction: string;
      secondaryEffects: string[];
      technicalDetails?: {
        programsUsed: Array<{
          program: string;
          purpose: string;
          instructions: number;
        }>;
        accountsAffected: Array<{
          account: string;
          role: string;
          changes: string;
        }>;
        computeUsage: {
          unitsUsed: number;
          efficiency: string;
        };
      };
      financialImpact?: {
        fees: {
          total: number;
          breakdown: string;
        };
        balanceChanges: Array<{
          account: string;
          change: number;
          token?: string;
        }>;
        estimatedValue?: number;
      };
      riskAssessment?: {
        level: 'low' | 'medium' | 'high';
        factors: string[];
        warnings: string[];
      };
      recommendations?: string[];
      relatedConcepts?: Array<{
        concept: string;
        explanation: string;
        learnMoreUrl?: string;
      }>;
    };
    metadata: {
      level: string;
      focus: string;
      generatedAt: number;
      processingTime: number;
      cached: boolean;
    };
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
): Promise<NextResponse<ExplainTransactionResponse>> {
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
      level: (searchParams.get('level') || 'intermediate') as 'basic' | 'intermediate' | 'advanced',
      focus: (searchParams.get('focus') || 'overview') as 'overview' | 'technical' | 'financial' | 'security',
      includeRisks: searchParams.get('includeRisks') !== 'false',
      includeRecommendations: searchParams.get('includeRecommendations') !== 'false',
      regenerate: searchParams.get('regenerate') === 'true',
      language: searchParams.get('language') || 'en'
    };

    const validatedParams = ExplainRequestSchema.parse(queryParams);

    // Check cache first (unless regeneration is requested)
    if (!validatedParams.regenerate) {
      // Note: Cache functionality not implemented yet
      // const cached = cacheHelpers.getAIExplanation(signature, validatedParams);
      // if (cached) {
      //   return NextResponse.json({
      //     success: true,
      //     data: {
      //       signature,
      //       explanation: cached.explanation,
      //       metadata: {
      //         ...cached.metadata,
      //         cached: true
      //       }
      //     },
      //     timestamp: Date.now()
      //   });
      // }
    }

    // Fetch transaction details
    const transaction = await getTransactionDetails(signature);

    if (!transaction) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'TRANSACTION_NOT_FOUND',
          message: 'Transaction not found'
        },
        timestamp: Date.now()
      }, { status: 404 });
    }

    // Generate AI explanation
    const aiAnalysis = await analyzeTransactionWithAI(transaction, {
      level: validatedParams.level,
      focus: validatedParams.focus,
      includeRisks: validatedParams.includeRisks,
      includeRecommendations: validatedParams.includeRecommendations,
      language: validatedParams.language
    });

    // Format the explanation based on the requested level and focus
    const explanation = formatExplanation(aiAnalysis, validatedParams, transaction);

    const processingTime = Date.now() - startTime;

    const result = {
      signature,
      explanation,
      metadata: {
        level: validatedParams.level,
        focus: validatedParams.focus,
        generatedAt: Date.now(),
        processingTime,
        cached: false
      }
    };

    // Cache the result (commented out until cache methods are implemented)
    // cacheHelpers.setAIExplanation(
    //   signature,
    //   result,
    //   validatedParams,
    //   60 * 60 * 1000 // 1 hour
    // );

    return NextResponse.json({
      success: true,
      data: result,
      timestamp: Date.now()
    }, {
      headers: {
        'X-Processing-Time': processingTime.toString(),
        'Cache-Control': 'public, max-age=3600' // 1 hour
      }
    });

  } catch (error) {
    console.error('Transaction explanation error:', error);

    // Handle specific AI service errors
    if (error instanceof Error && error.message.includes('rate limit')) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'AI service rate limit exceeded. Please try again later.'
        },
        timestamp: Date.now()
      }, { status: 429 });
    }

    if (error instanceof Error && error.message.includes('context too large')) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'TRANSACTION_TOO_COMPLEX',
          message: 'Transaction is too complex for AI analysis. Try with a simpler focus.'
        },
        timestamp: Date.now()
      }, { status: 413 });
    }

    return NextResponse.json({
      success: false,
      error: {
        code: 'EXPLANATION_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      },
      timestamp: Date.now()
    }, { status: 500 });
  }
}

// POST method for streaming explanations
export async function POST(
  request: NextRequest,
  { params }: { params: { signature: string } }
): Promise<NextResponse> {
  try {
    const { signature } = params;
    const body = await request.json();

    // Validate request body
    const validatedParams = ExplainRequestSchema.parse(body);

    // Check if streaming is requested
    if (body.stream === true) {
      return handleStreamingExplanation(signature, validatedParams);
    }

    // Otherwise, use GET method
    const url = new URL(request.url);
    Object.entries(validatedParams).forEach(([key, value]) => {
      url.searchParams.set(key, value.toString());
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

// Helper function to format explanation based on parameters
function formatExplanation(aiAnalysis: any, params: any, transaction: any) {
  const explanation: any = {
    summary: aiAnalysis.summary,
    mainAction: aiAnalysis.mainAction,
    secondaryEffects: aiAnalysis.secondaryEffects || []
  };

  // Add technical details for intermediate/advanced levels
  if (params.level !== 'basic' && params.focus !== 'overview') {
    explanation.technicalDetails = {
      programsUsed: aiAnalysis.programsUsed || [],
      accountsAffected: aiAnalysis.accountsAffected || [],
      computeUsage: aiAnalysis.computeUsage || {
        unitsUsed: transaction.meta?.computeUnitsConsumed || 0,
        efficiency: 'unknown'
      }
    };
  }

  // Add financial impact for financial focus or advanced level
  if (params.focus === 'financial' || params.level === 'advanced') {
    explanation.financialImpact = {
      fees: {
        total: transaction.meta?.fee || 0,
        breakdown: aiAnalysis.feeBreakdown || 'Standard transaction fee'
      },
      balanceChanges: aiAnalysis.balanceChanges || [],
      estimatedValue: aiAnalysis.estimatedValue
    };
  }

  // Add risk assessment if requested
  if (params.includeRisks) {
    explanation.riskAssessment = {
      level: aiAnalysis.riskLevel || 'low',
      factors: aiAnalysis.riskFactors || [],
      warnings: aiAnalysis.warnings || []
    };
  }

  // Add recommendations if requested
  if (params.includeRecommendations) {
    explanation.recommendations = aiAnalysis.recommendations || [];
  }

  // Add educational content for basic level
  if (params.level === 'basic') {
    explanation.relatedConcepts = aiAnalysis.relatedConcepts || [];
  }

  return explanation;
}

// Helper function to handle streaming explanations
async function handleStreamingExplanation(signature: string, params: any): Promise<NextResponse> {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Send initial status
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'status',
          message: 'Fetching transaction details...'
        })}\n\n`));

        // Fetch transaction
        const transaction = await getTransactionDetails(signature);

        if (!transaction) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'error',
            error: 'Transaction not found'
          })}\n\n`));
          controller.close();
          return;
        }

        // Send transaction found status
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'status',
          message: 'Transaction found, generating explanation...'
        })}\n\n`));

        // Generate the explanation
        const explanation = await analyzeTransactionWithAI(transaction, {
          ...params
        });

        // Send the explanation as a single response
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'content',
          content: explanation.summary,
          explanation: explanation
        })}\n\n`));

        // Send completion signal
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'complete',
          message: 'Explanation generation complete'
        })}\n\n`));

        controller.close();

      } catch (error) {
        console.error('Streaming explanation error:', error);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'error',
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        })}\n\n`));
        controller.close();
      }
    }
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Streaming': 'true'
    }
  });
}