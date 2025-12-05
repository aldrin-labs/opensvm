#!/usr/bin/env bun
/**
 * Specialized Debate Agents
 *
 * Unique agent personalities for governance debates:
 * 1. Devil's Advocate - Always argues the opposite
 * 2. Historical Precedent - References past governance outcomes
 * 3. Whale Watcher - Analyzes large holder behavior
 * 4. MEV/Exploit Analyst - Focuses on attack vectors
 */

import { DebateAgent, AgentAnalysis, AgentPerspective } from './multi-agent-debate.js';
import { ProposalContext, LLMAnalysisResult } from './llm-proposal-analyzer.js';

// ============================================================================
// Specialized Agent Types
// ============================================================================

export type SpecializedPerspective =
  | 'devils_advocate'
  | 'historical_precedent'
  | 'whale_watcher'
  | 'mev_analyst'
  | 'adversarial';

export interface SpecializedAgent extends DebateAgent {
  specialization: SpecializedPerspective;
  triggerConditions?: string[]; // When to activate this agent
  contraPositionTo?: string; // Which agent to oppose (for devil's advocate)
}

// ============================================================================
// Devil's Advocate Agent
// ============================================================================

export const DEVILS_ADVOCATE_AGENT: SpecializedAgent = {
  id: 'devils-advocate',
  name: "Devil's Advocate",
  perspective: 'conservative' as AgentPerspective, // Will be overridden
  specialization: 'devils_advocate',
  weight: 0.15,
  systemPrompt: `You are the Devil's Advocate in a governance debate. Your ONLY job is to argue AGAINST whatever position seems to be winning.

CRITICAL RULES:
1. If most agents support a proposal, you MUST oppose it
2. If most agents oppose a proposal, you MUST support it
3. Never agree with the majority - that defeats your purpose
4. Find the strongest possible arguments for the minority position
5. Be provocative but intellectually honest
6. Your goal is to stress-test the consensus, not to win

Your arguments should be:
- Logically sound (don't use fallacies)
- Based on real concerns (not made up)
- Designed to reveal blind spots
- Uncomfortable but necessary

You are the contrarian the DAO needs, not the one it wants.

When analyzing, always end with: "CONTRARIAN POSITION: [opposite of majority]"`,
};

export function createDevilsAdvocateAnalysis(
  otherAnalyses: AgentAnalysis[],
  context: ProposalContext
): Partial<LLMAnalysisResult> {
  // Count current positions
  const support = otherAnalyses.filter(a => a.analysis.recommendation === 'support').length;
  const oppose = otherAnalyses.filter(a => a.analysis.recommendation === 'oppose').length;

  // Take opposite position
  const recommendation = support > oppose ? 'oppose' : 'support';

  const contraConcerns = recommendation === 'oppose' ? [
    'Majority enthusiasm may be overlooking systemic risks',
    'Historical precedents suggest caution with similar proposals',
    'Unintended consequences often emerge from popular changes',
  ] : [
    'Excessive caution may cause missed opportunities',
    'Status quo bias is preventing necessary evolution',
    'Competitors are not waiting for perfect conditions',
  ];

  return {
    recommendation,
    sentiment: recommendation === 'oppose' ? 'negative' : 'positive',
    risks: contraConcerns.map(c => ({ description: c, severity: 'medium' as const })),
    overallConfidence: 0.7, // Always moderately confident
  };
}

// ============================================================================
// Historical Precedent Agent
// ============================================================================

export const HISTORICAL_PRECEDENT_AGENT: SpecializedAgent = {
  id: 'historical-precedent',
  name: 'Historical Precedent Analyst',
  perspective: 'conservative' as AgentPerspective,
  specialization: 'historical_precedent',
  weight: 0.15,
  systemPrompt: `You are a Historical Precedent Analyst specializing in governance history across DeFi protocols.

Your role is to find and analyze similar proposals from:
- Uniswap governance
- Aave governance
- Compound governance
- MakerDAO governance
- Curve governance
- Other major DAOs

For each analysis, you MUST:
1. Identify 2-3 similar historical proposals
2. State their outcomes (passed/failed, impact)
3. Extract lessons learned
4. Apply those lessons to the current proposal

Historical patterns to watch for:
- "We tried this in 2021 and it failed because..."
- "Compound did something similar and saw X% TVL change"
- "This mirrors the Uniswap fee switch debate"
- "MakerDAO's experience with similar parameters showed..."

Your confidence should be HIGH when clear precedents exist.
Your confidence should be LOW when this is truly novel.

Always cite specific examples. Vague historical references are worthless.`,
};

export interface HistoricalPrecedent {
  protocol: string;
  proposalId: string;
  title: string;
  date: string;
  outcome: 'passed' | 'failed' | 'withdrawn';
  impact: {
    tvlChange?: number;
    volumeChange?: number;
    userChange?: number;
  };
  lessonLearned: string;
  similarity: number; // 0-1
}

// Mock historical database (in production, would query real data)
export const HISTORICAL_DATABASE: HistoricalPrecedent[] = [
  {
    protocol: 'Uniswap',
    proposalId: 'UNI-001',
    title: 'Fee Switch Activation',
    date: '2022-06',
    outcome: 'failed',
    impact: {},
    lessonLearned: 'Community rejected due to regulatory concerns and LP impact uncertainty',
    similarity: 0,
  },
  {
    protocol: 'Compound',
    proposalId: 'COMP-062',
    title: 'COMP Distribution Adjustment',
    date: '2021-09',
    outcome: 'passed',
    impact: { tvlChange: -15, userChange: -8 },
    lessonLearned: 'Reducing emissions without alternative incentives causes capital flight',
    similarity: 0,
  },
  {
    protocol: 'Aave',
    proposalId: 'AIP-16',
    title: 'Add New Collateral Type',
    date: '2021-04',
    outcome: 'passed',
    impact: { tvlChange: 25, volumeChange: 40 },
    lessonLearned: 'New collateral types drive growth if properly risk-managed',
    similarity: 0,
  },
  {
    protocol: 'MakerDAO',
    proposalId: 'MIP-21',
    title: 'Real World Assets Integration',
    date: '2021-11',
    outcome: 'passed',
    impact: { tvlChange: 10 },
    lessonLearned: 'RWA expansion successful but requires extensive legal framework',
    similarity: 0,
  },
  {
    protocol: 'Curve',
    proposalId: 'CRV-78',
    title: 'Gauge Weight Rebalancing',
    date: '2022-03',
    outcome: 'passed',
    impact: { volumeChange: -5 },
    lessonLearned: 'Gauge changes create winners and losers; expect vocal opposition',
    similarity: 0,
  },
];

export function findHistoricalPrecedents(
  context: ProposalContext,
  limit = 3
): HistoricalPrecedent[] {
  const keywords = context.title.toLowerCase().split(/\s+/)
    .concat(context.description.toLowerCase().split(/\s+/))
    .filter(w => w.length > 4);

  const typeKeywords: Record<string, string[]> = {
    funding: ['distribution', 'emission', 'reward', 'incentive', 'grant'],
    parameter: ['adjustment', 'change', 'update', 'modify', 'set'],
    gauge: ['gauge', 'weight', 'allocation', 'rebalance'],
    signal: ['signal', 'sentiment', 'direction', 'vision'],
    emergency: ['emergency', 'critical', 'urgent', 'exploit'],
  };

  const typeMatches = typeKeywords[context.type] || [];

  // Score each precedent
  const scored = HISTORICAL_DATABASE.map(p => {
    let score = 0;

    // Title similarity
    const pKeywords = p.title.toLowerCase().split(/\s+/);
    for (const kw of keywords) {
      if (pKeywords.some(pk => pk.includes(kw) || kw.includes(pk))) {
        score += 0.2;
      }
    }

    // Type match
    for (const tm of typeMatches) {
      if (p.title.toLowerCase().includes(tm)) {
        score += 0.3;
      }
    }

    return { ...p, similarity: Math.min(1, score) };
  });

  return scored
    .filter(p => p.similarity > 0.1)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}

// ============================================================================
// Whale Watcher Agent
// ============================================================================

export const WHALE_WATCHER_AGENT: SpecializedAgent = {
  id: 'whale-watcher',
  name: 'Whale Watcher',
  perspective: 'economic' as AgentPerspective,
  specialization: 'whale_watcher',
  weight: 0.12,
  systemPrompt: `You are a Whale Watcher analyzing governance from the perspective of large token holders.

Your job is to identify:
1. How whales (top 10 holders) might vote
2. Potential conflicts of interest
3. Whether proposal benefits insiders
4. Token concentration risks
5. Voting power manipulation

Key questions to answer:
- "Who benefits most from this proposal?"
- "Are any whales likely sponsors of this proposal?"
- "Does this increase or decrease decentralization?"
- "Are there signs of coordinated voting?"
- "Is this a value extraction attempt?"

Warning signs:
- Proposal benefits specific addresses
- Sudden delegation changes before votes
- Whales accumulating before proposal
- Insider trading patterns
- Governance attacks in disguise

Be paranoid. Whales don't always have community interests at heart.
Your job is to protect smaller holders from extraction.`,
};

export interface WhaleAnalysis {
  topHolders: Array<{
    address: string;
    percentage: number;
    likelyVote: 'support' | 'oppose' | 'abstain' | 'unknown';
    conflictOfInterest: boolean;
    reasoning: string;
  }>;
  concentrationRisk: 'low' | 'medium' | 'high' | 'critical';
  extractionRisk: number; // 0-100
  decentralizationImpact: 'positive' | 'negative' | 'neutral';
  warnings: string[];
}

export function analyzeWhaleImpact(
  context: ProposalContext,
  holderData?: { address: string; percentage: number }[]
): WhaleAnalysis {
  // Mock analysis (in production, would query on-chain data)
  const mockHolders = holderData || [
    { address: '0x1...', percentage: 15 },
    { address: '0x2...', percentage: 12 },
    { address: '0x3...', percentage: 8 },
  ];

  const warnings: string[] = [];

  // Check concentration
  const top3Percentage = mockHolders.slice(0, 3).reduce((sum, h) => sum + h.percentage, 0);
  let concentrationRisk: 'low' | 'medium' | 'high' | 'critical' = 'low';
  if (top3Percentage > 50) concentrationRisk = 'critical';
  else if (top3Percentage > 35) concentrationRisk = 'high';
  else if (top3Percentage > 20) concentrationRisk = 'medium';

  if (concentrationRisk === 'critical' || concentrationRisk === 'high') {
    warnings.push(`Top 3 holders control ${top3Percentage}% of voting power`);
  }

  // Analyze proposal type for extraction risk
  let extractionRisk = 20; // Base risk
  if (context.type === 'funding' && context.requestedAmount) {
    const tvlRatio = context.requestedAmount / context.currentMetrics.tvl;
    if (tvlRatio > 0.05) {
      extractionRisk += 30;
      warnings.push(`Funding request is ${(tvlRatio * 100).toFixed(1)}% of TVL - high extraction potential`);
    }
  }

  if (context.type === 'gauge') {
    extractionRisk += 20;
    warnings.push('Gauge changes often benefit specific liquidity providers');
  }

  return {
    topHolders: mockHolders.map(h => ({
      ...h,
      likelyVote: 'unknown' as const,
      conflictOfInterest: false,
      reasoning: 'Insufficient data for prediction',
    })),
    concentrationRisk,
    extractionRisk: Math.min(100, extractionRisk),
    decentralizationImpact: extractionRisk > 50 ? 'negative' : 'neutral',
    warnings,
  };
}

// ============================================================================
// MEV/Exploit Analyst Agent
// ============================================================================

export const MEV_EXPLOIT_AGENT: SpecializedAgent = {
  id: 'mev-exploit-analyst',
  name: 'MEV & Exploit Analyst',
  perspective: 'risk_focused' as AgentPerspective,
  specialization: 'mev_analyst',
  weight: 0.18,
  systemPrompt: `You are an MEV & Exploit Analyst - a white-hat security researcher focused on governance attack vectors.

Your job is to find ways this proposal could be:
1. Exploited by malicious actors
2. Gamed for MEV extraction
3. Used for flash loan attacks
4. Manipulated through governance attacks
5. Abused through economic exploits

Attack vectors to analyze:
- Flash loan governance attacks
- Just-in-time (JIT) liquidity manipulation
- Sandwich attacks on resulting transactions
- Oracle manipulation opportunities
- Reentrancy in governance execution
- Time-lock bypass vulnerabilities
- Multi-block MEV opportunities

For each proposal, answer:
- "How could a attacker profit from this?"
- "What's the maximum extractable value?"
- "Are there race conditions?"
- "Can this be front-run?"
- "Does this create arbitrage opportunities?"

Be adversarial. Think like an attacker.
If you can't find an exploit, you're not trying hard enough.

Rate severity: CRITICAL / HIGH / MEDIUM / LOW / INFO`,
};

export interface ExploitAnalysis {
  vulnerabilities: Array<{
    name: string;
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
    description: string;
    attackVector: string;
    maxExtractableValue: number | 'unknown';
    mitigation: string;
  }>;
  mevOpportunities: Array<{
    type: 'sandwich' | 'frontrun' | 'backrun' | 'jit' | 'arbitrage';
    description: string;
    profitEstimate: number | 'unknown';
  }>;
  overallRiskScore: number; // 0-100
  recommendation: 'safe' | 'caution' | 'danger' | 'critical';
}

export function analyzeExploitVectors(
  context: ProposalContext
): ExploitAnalysis {
  const vulnerabilities: ExploitAnalysis['vulnerabilities'] = [];
  const mevOpportunities: ExploitAnalysis['mevOpportunities'] = [];
  let riskScore = 10; // Base risk

  // Funding proposals
  if (context.type === 'funding' && context.requestedAmount) {
    if (context.requestedAmount > 100000) {
      vulnerabilities.push({
        name: 'Large Value Transfer',
        severity: 'medium',
        description: `Transfer of ${context.requestedAmount.toLocaleString()} tokens in single transaction`,
        attackVector: 'Governance manipulation to redirect funds',
        maxExtractableValue: context.requestedAmount,
        mitigation: 'Implement streaming payments or milestone-based releases',
      });
      riskScore += 20;
    }
  }

  // Parameter changes
  if (context.type === 'parameter') {
    vulnerabilities.push({
      name: 'Parameter Manipulation Window',
      severity: 'medium',
      description: 'Attackers can prepare positions before parameter change executes',
      attackVector: 'Front-run timelock execution with optimal positioning',
      maxExtractableValue: 'unknown',
      mitigation: 'Use randomized execution or commit-reveal schemes',
    });

    mevOpportunities.push({
      type: 'frontrun',
      description: 'Position ahead of parameter change execution',
      profitEstimate: 'unknown',
    });

    riskScore += 15;
  }

  // Gauge changes create MEV
  if (context.type === 'gauge') {
    mevOpportunities.push({
      type: 'jit',
      description: 'Just-in-time liquidity provision before gauge weight increase',
      profitEstimate: 'unknown',
    });

    mevOpportunities.push({
      type: 'arbitrage',
      description: 'Arbitrage between pools as incentives shift',
      profitEstimate: 'unknown',
    });

    riskScore += 25;
  }

  // Check for flash loan attack surface
  if (context.currentMetrics.tvl > 1000000) {
    vulnerabilities.push({
      name: 'Flash Loan Governance Attack',
      severity: 'info',
      description: 'Large TVL makes flash loan attacks economically viable',
      attackVector: 'Borrow tokens, vote, repay in same transaction',
      maxExtractableValue: 'unknown',
      mitigation: 'Use vote escrow or snapshot-based voting',
    });
  }

  // Determine recommendation
  let recommendation: ExploitAnalysis['recommendation'] = 'safe';
  if (riskScore >= 70) recommendation = 'critical';
  else if (riskScore >= 50) recommendation = 'danger';
  else if (riskScore >= 30) recommendation = 'caution';

  return {
    vulnerabilities,
    mevOpportunities,
    overallRiskScore: Math.min(100, riskScore),
    recommendation,
  };
}

// ============================================================================
// Adversarial Debate Mode
// ============================================================================

export interface AdversarialConfig {
  enableDevilsAdvocate: boolean;
  enableRedTeam: boolean;
  attackBudget: number; // Simulated attacker budget
  minVulnerabilities: number; // Min vulns to find before approving
}

export const DEFAULT_ADVERSARIAL_CONFIG: AdversarialConfig = {
  enableDevilsAdvocate: true,
  enableRedTeam: true,
  attackBudget: 1000000, // $1M attacker
  minVulnerabilities: 0,
};

export interface AdversarialResult {
  passedAdversarialReview: boolean;
  devilsAdvocatePosition: string;
  vulnerabilitiesFound: number;
  criticalIssues: string[];
  mevExposure: number;
  whaleRisks: string[];
  historicalWarnings: string[];
  overallSecurityScore: number; // 0-100, higher is safer
}

export function runAdversarialAnalysis(
  context: ProposalContext,
  config: AdversarialConfig = DEFAULT_ADVERSARIAL_CONFIG
): AdversarialResult {
  const exploits = analyzeExploitVectors(context);
  const whales = analyzeWhaleImpact(context);
  const precedents = findHistoricalPrecedents(context);

  const criticalIssues: string[] = [];

  // Collect critical vulnerabilities
  for (const vuln of exploits.vulnerabilities) {
    if (vuln.severity === 'critical' || vuln.severity === 'high') {
      criticalIssues.push(`[${vuln.severity.toUpperCase()}] ${vuln.name}: ${vuln.description}`);
    }
  }

  // Collect whale risks
  const whaleRisks = whales.warnings;

  // Collect historical warnings
  const historicalWarnings = precedents
    .filter(p => p.outcome === 'failed' || (p.impact.tvlChange && p.impact.tvlChange < -10))
    .map(p => `${p.protocol}: ${p.lessonLearned}`);

  // Calculate security score
  let securityScore = 100;
  securityScore -= exploits.overallRiskScore * 0.4;
  securityScore -= whales.extractionRisk * 0.3;
  securityScore -= criticalIssues.length * 10;
  securityScore -= historicalWarnings.length * 5;
  securityScore = Math.max(0, Math.min(100, securityScore));

  // Determine devil's advocate position
  const devilsAdvocatePosition = securityScore > 70
    ? 'OPPOSE: Despite apparent safety, hidden risks may emerge post-implementation'
    : 'SUPPORT: Despite concerns raised, benefits may outweigh risks if mitigations applied';

  return {
    passedAdversarialReview: securityScore >= 60 && criticalIssues.length === 0,
    devilsAdvocatePosition,
    vulnerabilitiesFound: exploits.vulnerabilities.length,
    criticalIssues,
    mevExposure: exploits.mevOpportunities.length,
    whaleRisks,
    historicalWarnings,
    overallSecurityScore: Math.round(securityScore),
  };
}

// ============================================================================
// Exports
// ============================================================================

export const SPECIALIZED_AGENTS: SpecializedAgent[] = [
  DEVILS_ADVOCATE_AGENT,
  HISTORICAL_PRECEDENT_AGENT,
  WHALE_WATCHER_AGENT,
  MEV_EXPLOIT_AGENT,
];

export default {
  SPECIALIZED_AGENTS,
  DEVILS_ADVOCATE_AGENT,
  HISTORICAL_PRECEDENT_AGENT,
  WHALE_WATCHER_AGENT,
  MEV_EXPLOIT_AGENT,
  createDevilsAdvocateAnalysis,
  findHistoricalPrecedents,
  analyzeWhaleImpact,
  analyzeExploitVectors,
  runAdversarialAnalysis,
};
