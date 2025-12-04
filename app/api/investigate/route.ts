/**
 * Investigation Agent API Endpoint
 *
 * Invokes the autonomous blockchain investigation agent.
 *
 * POST /api/investigate
 * Body: {
 *   target: string,           // Address or signature to investigate
 *   type?: InvestigationType, // Type of investigation
 *   config?: Partial<InvestigationConfig>
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  createInvestigationAgent,
  formatReportAsMarkdown,
  formatReportAsJSON,
  DEFAULT_CONFIG,
  type InvestigationType,
  type InvestigationConfig,
} from '@/lib/ai/investigation-agent';

// Valid investigation types
const VALID_TYPES: InvestigationType[] = [
  'wallet_forensics',
  'transaction_tracing',
  'token_flow_analysis',
  'anomaly_detection',
  'connection_mapping',
  'full_investigation',
];

// Detect target type from format
function detectTargetType(target: string): 'wallet' | 'transaction' | 'token' | 'program' {
  // Transaction signatures are typically 87-88 characters
  if (target.length >= 80 && target.length <= 90) {
    return 'transaction';
  }
  // Default to wallet for shorter addresses
  return 'wallet';
}

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { target, type = 'wallet_forensics', config = {}, format = 'json' } = body;

    // Validate target
    if (!target || typeof target !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid target address/signature' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate target format (base58)
    const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
    if (!base58Regex.test(target) || target.length < 32 || target.length > 100) {
      return NextResponse.json(
        { error: 'Invalid target format. Must be a valid Solana address or signature.' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate investigation type
    if (!VALID_TYPES.includes(type)) {
      return NextResponse.json(
        {
          error: `Invalid investigation type. Valid types: ${VALID_TYPES.join(', ')}`,
        },
        { status: 400, headers: corsHeaders }
      );
    }

    // Merge config with defaults
    const fullConfig: InvestigationConfig = {
      ...DEFAULT_CONFIG,
      ...config,
      // Cap values for safety
      maxDepth: Math.min(config.maxDepth || DEFAULT_CONFIG.maxDepth, 5),
      maxTransactions: Math.min(config.maxTransactions || DEFAULT_CONFIG.maxTransactions, 100),
      timeRangeHours: Math.min(config.timeRangeHours || DEFAULT_CONFIG.timeRangeHours, 720),
    };

    // Detect target type
    const targetType = detectTargetType(target);

    console.log(`[Investigation] Starting ${type} investigation of ${targetType}: ${target.slice(0, 12)}...`);

    // Create and run investigation
    const agent = createInvestigationAgent();

    await agent.startInvestigation(
      type as InvestigationType,
      {
        type: targetType,
        address: target,
      },
      fullConfig
    );

    // Execute the investigation
    const state = await agent.execute();

    // Generate report
    const report = agent.generateReport();

    if (!report) {
      return NextResponse.json(
        { error: 'Failed to generate investigation report' },
        { status: 500, headers: corsHeaders }
      );
    }

    console.log(
      `[Investigation] Completed in ${Date.now() - startTime}ms. ` +
      `Risk: ${state.riskLevel} (${state.riskScore}/100). ` +
      `Anomalies: ${state.anomalies.length}`
    );

    // Return appropriate format
    if (format === 'markdown') {
      return new Response(formatReportAsMarkdown(report), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/markdown',
        },
      });
    }

    // Default JSON response
    return NextResponse.json(
      {
        success: true,
        report,
        summary: {
          target: target,
          type: type,
          riskScore: state.riskScore,
          riskLevel: state.riskLevel,
          anomalyCount: state.anomalies.length,
          transactionsAnalyzed: state.transactions.length,
          walletsExamined: state.walletProfiles.size,
          duration: state.duration,
          toolCalls: state.toolCallCount,
        },
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('[Investigation] Error:', error);

    return NextResponse.json(
      {
        error: 'Investigation failed',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500, headers: corsHeaders }
    );
  }
}
