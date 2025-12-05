/**
 * MCP Federation API - Report Endpoint
 *
 * POST /api/mcp/federation/report - Report a server for abuse
 * GET /api/mcp/federation/report - Get reports for a server
 *
 * @module app/api/mcp/federation/report
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// In-memory report storage
const reports = new Map<string, Report[]>();
const servers = new Map<string, any>();
const trustMetrics = new Map<string, any>();

interface Report {
  id: string;
  serverId: string;
  reporterWallet?: string;
  reason: string;
  category: ReportCategory;
  severity: 'low' | 'medium' | 'high' | 'critical';
  evidence?: string;
  timestamp: number;
  status: 'pending' | 'reviewed' | 'confirmed' | 'dismissed';
  reviewedAt?: number;
  reviewedBy?: string;
  notes?: string;
}

type ReportCategory =
  | 'spam'           // Sending spam responses
  | 'malicious'      // Malicious behavior
  | 'impersonation'  // Impersonating another server
  | 'low_quality'    // Consistently low quality responses
  | 'unavailable'    // Frequently unavailable
  | 'tos_violation'  // Terms of service violation
  | 'other';

/**
 * POST /api/mcp/federation/report
 *
 * Submit a report against a federated server
 *
 * Body:
 * - serverId: ID of the server being reported
 * - reason: Description of the issue
 * - category: Type of report
 * - severity: Report severity
 * - evidence: Optional evidence (URLs, screenshots, etc.)
 * - reporterWallet: Optional wallet address of reporter
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      serverId,
      reason,
      category = 'other',
      severity = 'medium',
      evidence,
      reporterWallet,
    } = body;

    // Validate required fields
    if (!serverId || !reason) {
      return NextResponse.json(
        { error: 'Missing required fields: serverId, reason' },
        { status: 400 }
      );
    }

    // Validate category
    const validCategories: ReportCategory[] = [
      'spam', 'malicious', 'impersonation', 'low_quality',
      'unavailable', 'tos_violation', 'other',
    ];
    if (!validCategories.includes(category)) {
      return NextResponse.json(
        { error: `Invalid category. Must be one of: ${validCategories.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate severity
    const validSeverities = ['low', 'medium', 'high', 'critical'];
    if (!validSeverities.includes(severity)) {
      return NextResponse.json(
        { error: `Invalid severity. Must be one of: ${validSeverities.join(', ')}` },
        { status: 400 }
      );
    }

    // Check if server exists
    const server = servers.get(serverId);
    const serverExists = !!server;

    // Create report
    const report: Report = {
      id: `rpt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      serverId,
      reporterWallet,
      reason,
      category,
      severity,
      evidence,
      timestamp: Date.now(),
      status: 'pending',
    };

    // Store report
    const serverReports = reports.get(serverId) || [];
    serverReports.push(report);
    reports.set(serverId, serverReports);

    // Update trust metrics if server exists
    if (serverExists) {
      const metrics = trustMetrics.get(serverId);
      if (metrics) {
        metrics.reportCount++;
        updateTrustScore(serverId, metrics);
      }
    }

    // Calculate impact on trust score
    let trustImpact = 0;
    if (serverExists && server) {
      const oldTrust = server.trustScore;
      const newTrust = server.trustScore;
      trustImpact = oldTrust - newTrust;
    }

    return NextResponse.json({
      success: true,
      reportId: report.id,
      serverId,
      serverFound: serverExists,
      timestamp: report.timestamp,
      trustImpact,
      message: serverExists
        ? `Report submitted. Server trust may be affected.`
        : `Report submitted for unknown server.`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/mcp/federation/report
 *
 * Get reports for a server or list all reports
 *
 * Query params:
 * - serverId: Filter by server ID
 * - status: Filter by status
 * - category: Filter by category
 * - limit: Max results
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const serverId = searchParams.get('serverId');
    const status = searchParams.get('status');
    const category = searchParams.get('category');
    const limit = parseInt(searchParams.get('limit') || '50');

    let allReports: Report[] = [];

    if (serverId) {
      // Get reports for specific server
      allReports = reports.get(serverId) || [];
    } else {
      // Get all reports
      for (const serverReports of reports.values()) {
        allReports.push(...serverReports);
      }
    }

    // Apply filters
    if (status) {
      allReports = allReports.filter(r => r.status === status);
    }
    if (category) {
      allReports = allReports.filter(r => r.category === category);
    }

    // Sort by timestamp descending
    allReports.sort((a, b) => b.timestamp - a.timestamp);

    // Limit results
    allReports = allReports.slice(0, limit);

    // Calculate summary
    const summary = {
      total: allReports.length,
      byStatus: {
        pending: allReports.filter(r => r.status === 'pending').length,
        reviewed: allReports.filter(r => r.status === 'reviewed').length,
        confirmed: allReports.filter(r => r.status === 'confirmed').length,
        dismissed: allReports.filter(r => r.status === 'dismissed').length,
      },
      byCategory: {} as Record<string, number>,
      bySeverity: {
        low: allReports.filter(r => r.severity === 'low').length,
        medium: allReports.filter(r => r.severity === 'medium').length,
        high: allReports.filter(r => r.severity === 'high').length,
        critical: allReports.filter(r => r.severity === 'critical').length,
      },
    };

    for (const report of allReports) {
      summary.byCategory[report.category] = (summary.byCategory[report.category] || 0) + 1;
    }

    return NextResponse.json({
      reports: allReports.map(r => ({
        id: r.id,
        serverId: r.serverId,
        category: r.category,
        severity: r.severity,
        reason: r.reason,
        status: r.status,
        timestamp: r.timestamp,
        hasEvidence: !!r.evidence,
      })),
      summary,
      timestamp: Date.now(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/mcp/federation/report
 *
 * Update a report's status (admin only in production)
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { reportId, status, notes, reviewedBy } = body;

    if (!reportId || !status) {
      return NextResponse.json(
        { error: 'Missing required fields: reportId, status' },
        { status: 400 }
      );
    }

    // Find the report
    let foundReport: Report | null = null;
    let foundServerId: string | null = null;

    for (const [serverId, serverReports] of reports.entries()) {
      const report = serverReports.find(r => r.id === reportId);
      if (report) {
        foundReport = report;
        foundServerId = serverId;
        break;
      }
    }

    if (!foundReport) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      );
    }

    // Update report
    foundReport.status = status;
    foundReport.reviewedAt = Date.now();
    if (reviewedBy) foundReport.reviewedBy = reviewedBy;
    if (notes) foundReport.notes = notes;

    // If confirmed, apply additional trust penalty
    if (status === 'confirmed' && foundServerId) {
      const server = servers.get(foundServerId);
      if (server) {
        const severityPenalty: Record<string, number> = {
          low: 5,
          medium: 10,
          high: 20,
          critical: 40,
        };
        server.trustScore = Math.max(0, server.trustScore - (severityPenalty[foundReport.severity] || 10));
      }
    }

    return NextResponse.json({
      success: true,
      reportId,
      newStatus: status,
      reviewedAt: foundReport.reviewedAt,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Helper function to update trust score
function updateTrustScore(serverId: string, metrics: any): void {
  const server = servers.get(serverId);
  if (!server) return;

  // Simple trust calculation based on metrics
  let score = 50; // Base score

  // Uptime factor
  score += metrics.uptime * 0.2;

  // Success rate factor
  score += metrics.successRate * 0.25;

  // Quality factor
  score += metrics.qualityScore * 0.15;

  // Penalty for reports
  score -= metrics.reportCount * 10;

  // Verification bonuses
  if (metrics.verifiedOwner) score += 15;
  if (metrics.auditedCode) score += 15;

  server.trustScore = Math.max(0, Math.min(100, Math.round(score)));
}
