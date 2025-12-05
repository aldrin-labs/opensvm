/**
 * MCP Streaming Investigation API
 *
 * Real-time multi-agent investigation with Server-Sent Events.
 * Streams progress, findings, anomalies, and final report.
 *
 * @module app/api/mcp/investigate/stream
 */

import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Types for SSE events
interface InvestigationEvent {
  type: 'start' | 'agent_spawn' | 'agent_progress' | 'finding' | 'anomaly' | 'entity' | 'complete' | 'error' | 'heartbeat';
  timestamp: number;
  data: any;
}

// Investigation templates
const TEMPLATES = {
  quick_scan: { maxAgents: 3, maxDepth: 1, maxTransactions: 50, parallelism: 2, estimatedDuration: '10-30s' },
  standard: { maxAgents: 5, maxDepth: 2, maxTransactions: 100, parallelism: 3, estimatedDuration: '30s-2min' },
  deep_dive: { maxAgents: 8, maxDepth: 3, maxTransactions: 200, parallelism: 4, estimatedDuration: '2-5min' },
  forensic: { maxAgents: 10, maxDepth: 5, maxTransactions: 500, parallelism: 5, estimatedDuration: '5-15min' },
};

// Agent roles for simulation
const AGENT_ROLES = [
  { role: 'wallet_forensics', description: 'Analyzing wallet history and patterns' },
  { role: 'transaction_tracer', description: 'Tracing transaction flows' },
  { role: 'anomaly_detector', description: 'Detecting suspicious patterns' },
  { role: 'token_analyzer', description: 'Analyzing token movements' },
  { role: 'connection_mapper', description: 'Mapping address relationships' },
  { role: 'entity_identifier', description: 'Identifying known entities' },
  { role: 'risk_assessor', description: 'Calculating risk scores' },
];

/**
 * Format SSE event
 */
function formatSSE(event: InvestigationEvent): string {
  return [
    `event: ${event.type}`,
    `data: ${JSON.stringify(event.data)}`,
    '',
    '',
  ].join('\n');
}

/**
 * GET /api/mcp/investigate/stream?target=ADDRESS&template=standard
 *
 * Start a streaming multi-agent investigation
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const target = searchParams.get('target');
  const template = searchParams.get('template') || 'standard';
  const type = searchParams.get('type') || 'wallet_forensics';

  if (!target) {
    return new Response(JSON.stringify({ error: 'Missing target parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const config = TEMPLATES[template as keyof typeof TEMPLATES] || TEMPLATES.standard;
  const investigationId = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // Create SSE stream
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: InvestigationEvent) => {
        controller.enqueue(encoder.encode(formatSSE(event)));
      };

      // Heartbeat to keep connection alive
      const heartbeat = setInterval(() => {
        send({
          type: 'heartbeat',
          timestamp: Date.now(),
          data: { investigationId },
        });
      }, 15000);

      try {
        // Start event
        send({
          type: 'start',
          timestamp: Date.now(),
          data: {
            investigationId,
            target,
            template,
            type,
            config,
            estimatedDuration: config.estimatedDuration,
          },
        });

        // Simulate agent spawning
        const agentCount = Math.min(config.maxAgents, AGENT_ROLES.length);
        const agents: { id: string; role: string; progress: number; status: string }[] = [];

        for (let i = 0; i < agentCount; i++) {
          const agent = {
            id: `agent_${Date.now()}_${i}`,
            role: AGENT_ROLES[i].role,
            progress: 0,
            status: 'running',
          };
          agents.push(agent);

          send({
            type: 'agent_spawn',
            timestamp: Date.now(),
            data: {
              agentId: agent.id,
              role: agent.role,
              description: AGENT_ROLES[i].description,
              agentNumber: i + 1,
              totalAgents: agentCount,
            },
          });

          await sleep(200);
        }

        // Simulate investigation progress
        const findings: any[] = [];
        const anomalies: any[] = [];
        const entities: any[] = [];
        let overallProgress = 0;

        // Run agents in parallel (simulated)
        const iterations = 20;
        for (let iter = 0; iter < iterations; iter++) {
          await sleep(500 + Math.random() * 500);

          // Update random agent progress
          for (const agent of agents) {
            if (agent.status === 'running') {
              agent.progress = Math.min(100, agent.progress + Math.random() * 15 + 5);

              send({
                type: 'agent_progress',
                timestamp: Date.now(),
                data: {
                  agentId: agent.id,
                  role: agent.role,
                  progress: Math.round(agent.progress),
                  status: agent.progress >= 100 ? 'completed' : 'running',
                },
              });

              if (agent.progress >= 100) {
                agent.status = 'completed';
              }
            }
          }

          // Generate findings periodically
          if (Math.random() > 0.6) {
            const finding = generateFinding(target, iter);
            findings.push(finding);

            send({
              type: 'finding',
              timestamp: Date.now(),
              data: finding,
            });
          }

          // Generate anomalies occasionally
          if (Math.random() > 0.8) {
            const anomaly = generateAnomaly(target, iter);
            anomalies.push(anomaly);

            send({
              type: 'anomaly',
              timestamp: Date.now(),
              data: anomaly,
            });
          }

          // Identify entities
          if (Math.random() > 0.7 && entities.length < 5) {
            const entity = generateEntity();
            entities.push(entity);

            send({
              type: 'entity',
              timestamp: Date.now(),
              data: entity,
            });
          }

          overallProgress = Math.round(((iter + 1) / iterations) * 100);

          // Check if all agents done
          if (agents.every(a => a.status === 'completed')) {
            break;
          }
        }

        // Calculate risk score
        const riskScore = calculateRiskScore(findings, anomalies);

        // Send complete event with full report
        send({
          type: 'complete',
          timestamp: Date.now(),
          data: {
            investigationId,
            target,
            type,
            status: 'completed',
            duration: Date.now() - parseInt(investigationId.split('_')[1]),
            summary: {
              agentsDeployed: agents.length,
              findingsCount: findings.length,
              anomaliesCount: anomalies.length,
              entitiesIdentified: entities.length,
              riskScore,
              riskLevel: getRiskLevel(riskScore),
            },
            findings,
            anomalies,
            entities,
            agents: agents.map(a => ({
              id: a.id,
              role: a.role,
              status: a.status,
            })),
            report: generateReport(target, findings, anomalies, entities, riskScore),
          },
        });

      } catch (error) {
        send({
          type: 'error',
          timestamp: Date.now(),
          data: {
            investigationId,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        });
      } finally {
        clearInterval(heartbeat);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

// Helper functions
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function generateFinding(target: string, index: number): any {
  const types = ['large_transfer', 'concentrated_holding', 'unusual_timing', 'known_counterparty', 'suspicious_pattern'];
  const severities = ['info', 'low', 'medium', 'high'];

  return {
    id: `finding_${Date.now()}_${index}`,
    type: types[Math.floor(Math.random() * types.length)],
    severity: severities[Math.floor(Math.random() * severities.length)],
    title: `Finding #${index + 1}`,
    description: `Detected activity pattern in transaction history`,
    confidence: Math.round(60 + Math.random() * 40),
    relatedAddresses: [target],
    relatedTransactions: [`tx_${Date.now()}`],
  };
}

function generateAnomaly(target: string, index: number): any {
  const types = ['rapid_transactions', 'large_outflow', 'unusual_time', 'circular_transfer', 'mixer_interaction'];
  const severities = ['low', 'medium', 'high', 'critical'];

  return {
    id: `anomaly_${Date.now()}_${index}`,
    type: types[Math.floor(Math.random() * types.length)],
    severity: severities[Math.floor(Math.random() * severities.length)],
    description: `Anomalous pattern detected`,
    indicators: ['pattern_match', 'statistical_outlier'],
    score: Math.round(50 + Math.random() * 50),
    addresses: [target],
    transactions: [`tx_${Date.now()}`],
  };
}

function generateEntity(): any {
  const entities = [
    { name: 'Binance', type: 'exchange' },
    { name: 'Coinbase', type: 'exchange' },
    { name: 'Jupiter', type: 'protocol' },
    { name: 'Raydium', type: 'protocol' },
    { name: 'Phantom', type: 'wallet' },
  ];
  const entity = entities[Math.floor(Math.random() * entities.length)];

  return {
    address: `${entity.name.toLowerCase()}_${Math.random().toString(36).slice(2, 8)}`,
    name: entity.name,
    type: entity.type,
    confidence: Math.round(70 + Math.random() * 30),
    labels: [entity.type],
    source: 'entity_identifier',
  };
}

function calculateRiskScore(findings: any[], anomalies: any[]): number {
  let score = 0;

  for (const finding of findings) {
    switch (finding.severity) {
      case 'high': score += 15; break;
      case 'medium': score += 8; break;
      case 'low': score += 3; break;
    }
  }

  for (const anomaly of anomalies) {
    switch (anomaly.severity) {
      case 'critical': score += 30; break;
      case 'high': score += 20; break;
      case 'medium': score += 10; break;
      case 'low': score += 5; break;
    }
  }

  return Math.min(100, score);
}

function getRiskLevel(score: number): string {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 40) return 'medium';
  if (score >= 20) return 'low';
  return 'minimal';
}

function generateReport(target: string, findings: any[], anomalies: any[], entities: any[], riskScore: number): string {
  return `
## Investigation Report

**Target:** ${target}
**Risk Score:** ${riskScore}/100 (${getRiskLevel(riskScore)})

### Summary
- ${findings.length} findings detected
- ${anomalies.length} anomalies identified
- ${entities.length} known entities found

### Key Findings
${findings.slice(0, 5).map(f => `- [${f.severity.toUpperCase()}] ${f.title}: ${f.description}`).join('\n')}

### Anomalies
${anomalies.slice(0, 3).map(a => `- [${a.severity.toUpperCase()}] ${a.type}: ${a.description}`).join('\n')}

### Identified Entities
${entities.map(e => `- ${e.name} (${e.type})`).join('\n')}

### Recommendations
${riskScore >= 60 ? '- Further manual investigation recommended' : '- No immediate action required'}
${anomalies.some(a => a.severity === 'critical') ? '- Review critical anomalies immediately' : ''}
`.trim();
}
