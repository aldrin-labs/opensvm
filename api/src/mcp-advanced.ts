/**
 * Advanced MCP Features
 *
 * Implements:
 * - Context Compression (summarize large results)
 * - Tool Chaining DSL (YAML pipelines)
 * - Authentication Delegation (user tokens)
 * - Investigation Checkpoints (save/resume)
 * - Batch Tool Execution (parallel calls)
 * - Schema Versioning (version tools)
 * - Investigation Templates (quick/deep/forensic)
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';

// ============================================================================
// CONTEXT COMPRESSION
// ============================================================================

interface CompressionConfig {
  maxTokens: number;
  preserveStructure: boolean;
  includeMetrics: boolean;
}

const DEFAULT_COMPRESSION: CompressionConfig = {
  maxTokens: 2000,
  preserveStructure: true,
  includeMetrics: true,
};

/**
 * Compress large results into AI-friendly summaries
 */
export function compressResult(data: any, config: CompressionConfig = DEFAULT_COMPRESSION): {
  compressed: any;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
} {
  const originalJson = JSON.stringify(data);
  const originalSize = originalJson.length;

  let compressed: any;

  if (Array.isArray(data)) {
    compressed = compressArray(data, config);
  } else if (typeof data === 'object' && data !== null) {
    compressed = compressObject(data, config);
  } else {
    compressed = data;
  }

  const compressedJson = JSON.stringify(compressed);
  const compressedSize = compressedJson.length;

  return {
    compressed,
    originalSize,
    compressedSize,
    compressionRatio: originalSize / compressedSize,
  };
}

function compressArray(arr: any[], config: CompressionConfig): any {
  if (arr.length === 0) return { _type: 'empty_array', count: 0 };

  // For transactions, extract key insights
  if (arr[0]?.signature || arr[0]?.hash) {
    return compressTransactions(arr);
  }

  // For tokens, summarize holdings
  if (arr[0]?.mint || arr[0]?.symbol) {
    return compressTokens(arr);
  }

  // Generic array compression
  if (arr.length > 10) {
    return {
      _type: 'array_summary',
      count: arr.length,
      sample: arr.slice(0, 3),
      lastItems: arr.slice(-2),
    };
  }

  return arr;
}

function compressTransactions(txs: any[]): any {
  const successCount = txs.filter(tx => tx.success !== false).length;
  const failedCount = txs.length - successCount;

  // Group by type
  const typeCount: Record<string, number> = {};
  const programs = new Set<string>();
  let totalSolMoved = 0;
  let timestamps: number[] = [];

  for (const tx of txs) {
    const type = tx.type || 'unknown';
    typeCount[type] = (typeCount[type] || 0) + 1;

    if (tx.programIds) {
      tx.programIds.forEach((p: string) => programs.add(p));
    }
    if (tx.solTransferred) {
      totalSolMoved += Math.abs(tx.solTransferred);
    }
    if (tx.timestamp || tx.blockTime) {
      timestamps.push(tx.timestamp || tx.blockTime);
    }
  }

  timestamps.sort();
  const timeRange = timestamps.length >= 2
    ? { from: timestamps[0], to: timestamps[timestamps.length - 1] }
    : null;

  return {
    _type: 'transaction_summary',
    count: txs.length,
    success: successCount,
    failed: failedCount,
    failureRate: (failedCount / txs.length * 100).toFixed(1) + '%',
    types: typeCount,
    uniquePrograms: programs.size,
    totalSolMoved: totalSolMoved.toFixed(2),
    timeRange,
    // Include notable transactions
    notable: txs
      .filter(tx => !tx.success || Math.abs(tx.solTransferred || 0) > 10)
      .slice(0, 5)
      .map(tx => ({
        sig: tx.signature?.slice(0, 8) + '...',
        type: tx.type,
        sol: tx.solTransferred,
        success: tx.success,
      })),
  };
}

function compressTokens(tokens: any[]): any {
  const totalValue = tokens.reduce((sum, t) => sum + (t.valueUsd || 0), 0);

  // Top holdings
  const sorted = [...tokens].sort((a, b) => (b.valueUsd || 0) - (a.valueUsd || 0));
  const top5 = sorted.slice(0, 5).map(t => ({
    symbol: t.symbol || 'UNKNOWN',
    balance: t.balance,
    valueUsd: t.valueUsd,
    pctOfPortfolio: totalValue > 0 ? ((t.valueUsd || 0) / totalValue * 100).toFixed(1) + '%' : 'N/A',
  }));

  // Categorize
  const stablecoins = tokens.filter(t =>
    ['USDC', 'USDT', 'PYUSD', 'DAI', 'BUSD'].includes(t.symbol?.toUpperCase())
  );
  const memecoins = tokens.filter(t =>
    ['BONK', 'WIF', 'POPCAT', 'MEW', 'BOME', 'SLERF'].includes(t.symbol?.toUpperCase())
  );

  return {
    _type: 'token_summary',
    count: tokens.length,
    totalValueUsd: totalValue.toFixed(2),
    top5Holdings: top5,
    categories: {
      stablecoins: {
        count: stablecoins.length,
        value: stablecoins.reduce((s, t) => s + (t.valueUsd || 0), 0).toFixed(2),
      },
      memecoins: {
        count: memecoins.length,
        value: memecoins.reduce((s, t) => s + (t.valueUsd || 0), 0).toFixed(2),
      },
      other: {
        count: tokens.length - stablecoins.length - memecoins.length,
      },
    },
  };
}

function compressObject(obj: any, config: CompressionConfig): any {
  // Handle portfolio response
  if (obj.data?.tokens && obj.data?.native) {
    return {
      _type: 'portfolio_summary',
      solBalance: obj.data.native?.balance,
      totalValueUsd: obj.data.totalValue,
      tokenCount: obj.data.totalTokens || obj.data.tokens?.length,
      tokens: compressTokens(obj.data.tokens || []),
    };
  }

  // Handle investigation report
  if (obj.riskAssessment && obj.findings) {
    return {
      _type: 'investigation_summary',
      riskLevel: obj.riskAssessment.level,
      riskScore: obj.riskAssessment.overallScore,
      anomalyCount: obj.findings.anomalies?.length || 0,
      topFindings: obj.findings.anomalies?.slice(0, 5).map((a: any) => ({
        type: a.type,
        severity: a.severity,
        description: a.description,
      })),
      recommendations: obj.recommendations?.slice(0, 3),
    };
  }

  // Generic object - preserve structure but limit depth
  return truncateObject(obj, 3);
}

function truncateObject(obj: any, maxDepth: number, currentDepth = 0): any {
  if (currentDepth >= maxDepth) {
    if (Array.isArray(obj)) return `[Array(${obj.length})]`;
    if (typeof obj === 'object' && obj !== null) return `{Object(${Object.keys(obj).length} keys)}`;
    return obj;
  }

  if (Array.isArray(obj)) {
    if (obj.length > 5) {
      return [...obj.slice(0, 3).map(item => truncateObject(item, maxDepth, currentDepth + 1)), `... +${obj.length - 3} more`];
    }
    return obj.map(item => truncateObject(item, maxDepth, currentDepth + 1));
  }

  if (typeof obj === 'object' && obj !== null) {
    const result: any = {};
    const keys = Object.keys(obj);
    for (const key of keys.slice(0, 10)) {
      result[key] = truncateObject(obj[key], maxDepth, currentDepth + 1);
    }
    if (keys.length > 10) {
      result._truncated = `+${keys.length - 10} more keys`;
    }
    return result;
  }

  return obj;
}

// ============================================================================
// TOOL CHAINING DSL
// ============================================================================

export interface PipelineStep {
  tool: string;
  params?: Record<string, any>;
  filter?: string;  // JavaScript expression
  map?: string;     // JavaScript expression
  as?: string;      // Store result as variable
}

export interface Pipeline {
  name: string;
  description?: string;
  steps: PipelineStep[];
  output?: string;  // Final output expression
}

/**
 * Parse YAML-like pipeline definition
 */
export function parsePipeline(yaml: string): Pipeline {
  const lines = yaml.trim().split('\n');
  const pipeline: Pipeline = {
    name: 'custom_pipeline',
    steps: [],
  };

  let currentStep: Partial<PipelineStep> | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    if (trimmed.startsWith('name:')) {
      pipeline.name = trimmed.slice(5).trim();
    } else if (trimmed.startsWith('description:')) {
      pipeline.description = trimmed.slice(12).trim();
    } else if (trimmed.startsWith('output:')) {
      pipeline.output = trimmed.slice(7).trim();
    } else if (trimmed.startsWith('- tool:')) {
      if (currentStep?.tool) {
        pipeline.steps.push(currentStep as PipelineStep);
      }
      currentStep = { tool: trimmed.slice(7).trim() };
    } else if (currentStep) {
      if (trimmed.startsWith('params:')) {
        currentStep.params = {};
      } else if (trimmed.startsWith('filter:')) {
        currentStep.filter = trimmed.slice(7).trim();
      } else if (trimmed.startsWith('map:')) {
        currentStep.map = trimmed.slice(4).trim();
      } else if (trimmed.startsWith('as:')) {
        currentStep.as = trimmed.slice(3).trim();
      } else if (trimmed.includes(':') && currentStep.params !== undefined) {
        const [key, ...valueParts] = trimmed.split(':');
        const value = valueParts.join(':').trim();
        currentStep.params![key.trim()] = parseValue(value);
      }
    }
  }

  if (currentStep?.tool) {
    pipeline.steps.push(currentStep as PipelineStep);
  }

  return pipeline;
}

function parseValue(value: string): any {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value.startsWith('"') && value.endsWith('"')) return value.slice(1, -1);
  if (value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1);
  if (value.startsWith('$')) return { $ref: value.slice(1) };  // Variable reference
  const num = Number(value);
  if (!isNaN(num)) return num;
  return value;
}

/**
 * Execute a pipeline
 */
export async function executePipeline(
  pipeline: Pipeline,
  toolExecutor: (tool: string, params: Record<string, any>) => Promise<any>,
  initialContext: Record<string, any> = {}
): Promise<{
  result: any;
  steps: Array<{ tool: string; duration: number; success: boolean; error?: string }>;
  totalDuration: number;
}> {
  const context: Record<string, any> = { ...initialContext };
  const stepResults: Array<{ tool: string; duration: number; success: boolean; error?: string }> = [];
  const startTime = Date.now();

  let lastResult: any = null;

  for (const step of pipeline.steps) {
    const stepStart = Date.now();

    try {
      // Resolve parameter references
      const resolvedParams: Record<string, any> = {};
      for (const [key, value] of Object.entries(step.params || {})) {
        if (typeof value === 'object' && value?.$ref) {
          resolvedParams[key] = context[value.$ref];
        } else {
          resolvedParams[key] = value;
        }
      }

      // Execute tool
      let result = await toolExecutor(step.tool, resolvedParams);

      // Apply filter
      if (step.filter && Array.isArray(result)) {
        const filterFn = new Function('item', 'index', `return ${step.filter}`);
        result = result.filter((item: any, index: number) => filterFn(item, index));
      }

      // Apply map
      if (step.map && Array.isArray(result)) {
        const mapFn = new Function('item', 'index', `return ${step.map}`);
        result = result.map((item: any, index: number) => mapFn(item, index));
      }

      // Store in context
      if (step.as) {
        context[step.as] = result;
      }

      lastResult = result;
      stepResults.push({
        tool: step.tool,
        duration: Date.now() - stepStart,
        success: true,
      });
    } catch (error) {
      stepResults.push({
        tool: step.tool,
        duration: Date.now() - stepStart,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
      // Continue with other steps or break based on config
    }
  }

  // Apply output transformation
  let finalResult = lastResult;
  if (pipeline.output) {
    try {
      const outputFn = new Function('ctx', 'last', `return ${pipeline.output}`);
      finalResult = outputFn(context, lastResult);
    } catch {
      // Keep lastResult if output expression fails
    }
  }

  return {
    result: finalResult,
    steps: stepResults,
    totalDuration: Date.now() - startTime,
  };
}

// ============================================================================
// AUTHENTICATION DELEGATION
// ============================================================================

export interface AuthContext {
  apiKey?: string;
  userToken?: string;
  walletAddress?: string;
  tier: 'free' | 'premium' | 'enterprise';
  permissions: string[];
  rateLimit: {
    requestsPerMinute: number;
    requestsRemaining: number;
    resetAt: number;
  };
}

/**
 * Extract auth context from request headers
 */
export function extractAuthContext(headers: Record<string, string>): AuthContext {
  const apiKey = headers['x-api-key'] || headers['authorization']?.replace('Bearer ', '');
  const userToken = headers['x-user-token'];
  const walletAddress = headers['x-wallet-address'];

  // Determine tier based on API key prefix or lookup
  let tier: AuthContext['tier'] = 'free';
  let permissions: string[] = ['read:*'];
  let requestsPerMinute = 100;

  if (apiKey?.startsWith('sk_premium_')) {
    tier = 'premium';
    permissions = ['read:*', 'write:investigations', 'access:realtime'];
    requestsPerMinute = 1000;
  } else if (apiKey?.startsWith('sk_enterprise_')) {
    tier = 'enterprise';
    permissions = ['read:*', 'write:*', 'admin:*'];
    requestsPerMinute = 10000;
  }

  return {
    apiKey,
    userToken,
    walletAddress,
    tier,
    permissions,
    rateLimit: {
      requestsPerMinute,
      requestsRemaining: requestsPerMinute,
      resetAt: Date.now() + 60000,
    },
  };
}

/**
 * Check if auth context has permission
 */
export function hasPermission(auth: AuthContext, permission: string): boolean {
  return auth.permissions.some(p => {
    if (p === '*') return true;
    if (p.endsWith(':*')) {
      const prefix = p.slice(0, -1);
      return permission.startsWith(prefix);
    }
    return p === permission;
  });
}

// ============================================================================
// INVESTIGATION CHECKPOINTS
// ============================================================================

export interface InvestigationCheckpoint {
  id: string;
  investigationId: string;
  createdAt: number;
  state: any;  // Serialized investigation state
  metadata: {
    target: string;
    type: string;
    progress: number;
    stepCount: number;
    anomalyCount: number;
  };
}

// In-memory checkpoint store (would use Redis/DB in production)
const checkpointStore = new Map<string, InvestigationCheckpoint>();

/**
 * Save investigation checkpoint
 */
export function saveCheckpoint(
  investigationId: string,
  state: any,
  metadata: InvestigationCheckpoint['metadata']
): InvestigationCheckpoint {
  const checkpoint: InvestigationCheckpoint = {
    id: `chk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    investigationId,
    createdAt: Date.now(),
    state: JSON.parse(JSON.stringify(state)),  // Deep clone
    metadata,
  };

  checkpointStore.set(checkpoint.id, checkpoint);

  // Also store by investigation ID for easy lookup
  checkpointStore.set(`inv_${investigationId}`, checkpoint);

  return checkpoint;
}

/**
 * Load investigation checkpoint
 */
export function loadCheckpoint(checkpointIdOrInvestigationId: string): InvestigationCheckpoint | null {
  // Try direct lookup
  let checkpoint = checkpointStore.get(checkpointIdOrInvestigationId);

  // Try investigation ID lookup
  if (!checkpoint) {
    checkpoint = checkpointStore.get(`inv_${checkpointIdOrInvestigationId}`);
  }

  return checkpoint || null;
}

/**
 * List checkpoints for a user
 */
export function listCheckpoints(walletAddress?: string): InvestigationCheckpoint[] {
  const checkpoints: InvestigationCheckpoint[] = [];

  for (const [key, checkpoint] of checkpointStore) {
    if (!key.startsWith('inv_')) {  // Avoid duplicates
      checkpoints.push(checkpoint);
    }
  }

  return checkpoints.sort((a, b) => b.createdAt - a.createdAt);
}

// ============================================================================
// BATCH TOOL EXECUTION
// ============================================================================

export interface BatchRequest {
  id: string;
  tool: string;
  params: Record<string, any>;
}

export interface BatchResponse {
  id: string;
  success: boolean;
  result?: any;
  error?: string;
  duration: number;
}

/**
 * Execute multiple tool calls in parallel
 */
export async function executeBatch(
  requests: BatchRequest[],
  toolExecutor: (tool: string, params: Record<string, any>) => Promise<any>,
  maxConcurrency: number = 5
): Promise<{
  responses: BatchResponse[];
  totalDuration: number;
  successCount: number;
  errorCount: number;
}> {
  const startTime = Date.now();
  const responses: BatchResponse[] = [];

  // Process in chunks for concurrency control
  for (let i = 0; i < requests.length; i += maxConcurrency) {
    const chunk = requests.slice(i, i + maxConcurrency);

    const chunkResults = await Promise.all(
      chunk.map(async (req): Promise<BatchResponse> => {
        const reqStart = Date.now();
        try {
          const result = await toolExecutor(req.tool, req.params);
          return {
            id: req.id,
            success: true,
            result,
            duration: Date.now() - reqStart,
          };
        } catch (error) {
          return {
            id: req.id,
            success: false,
            error: error instanceof Error ? error.message : String(error),
            duration: Date.now() - reqStart,
          };
        }
      })
    );

    responses.push(...chunkResults);
  }

  return {
    responses,
    totalDuration: Date.now() - startTime,
    successCount: responses.filter(r => r.success).length,
    errorCount: responses.filter(r => !r.success).length,
  };
}

// ============================================================================
// SCHEMA VERSIONING
// ============================================================================

export interface VersionedTool extends Tool {
  version: string;
  deprecated?: boolean;
  deprecationMessage?: string;
  replacedBy?: string;
  changelog?: string[];
}

const TOOL_VERSIONS: Record<string, VersionedTool[]> = {
  'investigate': [
    {
      name: 'investigate',
      version: '2.0.0',
      description: 'Launch an autonomous investigation with enhanced insights, entity labels, and MEV detection',
      inputSchema: {
        type: 'object',
        properties: {
          target: { type: 'string', description: 'Address or signature to investigate' },
          type: { type: 'string', enum: ['wallet_forensics', 'transaction_tracing', 'token_flow_analysis', 'anomaly_detection', 'connection_mapping', 'full_investigation'] },
          template: { type: 'string', enum: ['quick_scan', 'deep_dive', 'forensic'], description: 'Investigation template (v2.0+)' },
          maxDepth: { type: 'integer', minimum: 1, maximum: 5 },
          maxTransactions: { type: 'integer', minimum: 10, maximum: 100 },
        },
        required: ['target'],
      },
      changelog: [
        '2.0.0: Added investigation templates, entity labels, MEV detection, AI synthesis',
        '1.1.0: Added connection mapping and graph visualization',
        '1.0.0: Initial release with basic wallet forensics',
      ],
    },
    {
      name: 'investigate',
      version: '1.1.0',
      deprecated: true,
      deprecationMessage: 'Use investigate v2.0.0 for enhanced features',
      description: 'Launch an autonomous investigation agent',
      inputSchema: {
        type: 'object',
        properties: {
          target: { type: 'string' },
          type: { type: 'string' },
          maxDepth: { type: 'integer' },
        },
        required: ['target'],
      },
    },
  ],
};

/**
 * Get tool by version
 */
export function getToolVersion(toolName: string, version?: string): VersionedTool | null {
  const versions = TOOL_VERSIONS[toolName];
  if (!versions || versions.length === 0) return null;

  if (!version) {
    // Return latest non-deprecated version
    return versions.find(v => !v.deprecated) || versions[0];
  }

  return versions.find(v => v.version === version) || null;
}

/**
 * Get all tool versions
 */
export function getToolVersions(toolName: string): VersionedTool[] {
  return TOOL_VERSIONS[toolName] || [];
}

// ============================================================================
// INVESTIGATION TEMPLATES
// ============================================================================

export interface InvestigationTemplate {
  id: string;
  name: string;
  description: string;
  config: {
    maxDepth: number;
    maxTransactions: number;
    timeRangeHours: number;
    enableAnomalyDetection: boolean;
    enableConnectionMapping: boolean;
    followTokenFlows: boolean;
    compressResults: boolean;
  };
  estimatedDuration: string;
  useCases: string[];
}

export const INVESTIGATION_TEMPLATES: Record<string, InvestigationTemplate> = {
  quick_scan: {
    id: 'quick_scan',
    name: 'Quick Scan',
    description: 'Fast overview of wallet activity and basic risk assessment',
    config: {
      maxDepth: 1,
      maxTransactions: 20,
      timeRangeHours: 24,
      enableAnomalyDetection: true,
      enableConnectionMapping: false,
      followTokenFlows: false,
      compressResults: true,
    },
    estimatedDuration: '10-30 seconds',
    useCases: [
      'Quick wallet check before transaction',
      'Basic due diligence',
      'Monitoring known addresses',
    ],
  },
  deep_dive: {
    id: 'deep_dive',
    name: 'Deep Dive',
    description: 'Comprehensive analysis with connection mapping and pattern detection',
    config: {
      maxDepth: 3,
      maxTransactions: 50,
      timeRangeHours: 168,  // 1 week
      enableAnomalyDetection: true,
      enableConnectionMapping: true,
      followTokenFlows: true,
      compressResults: false,
    },
    estimatedDuration: '2-5 minutes',
    useCases: [
      'Investigating suspicious activity',
      'Counter-party due diligence',
      'Fraud investigation',
    ],
  },
  forensic: {
    id: 'forensic',
    name: 'Forensic Analysis',
    description: 'Full forensic investigation with maximum depth and all features enabled',
    config: {
      maxDepth: 5,
      maxTransactions: 100,
      timeRangeHours: 720,  // 30 days
      enableAnomalyDetection: true,
      enableConnectionMapping: true,
      followTokenFlows: true,
      compressResults: false,
    },
    estimatedDuration: '5-15 minutes',
    useCases: [
      'Law enforcement investigations',
      'Major fraud cases',
      'Exchange compliance',
      'Recovering stolen funds',
    ],
  },
};

/**
 * Get investigation template by ID
 */
export function getTemplate(templateId: string): InvestigationTemplate | null {
  return INVESTIGATION_TEMPLATES[templateId] || null;
}

/**
 * List all available templates
 */
export function listTemplates(): InvestigationTemplate[] {
  return Object.values(INVESTIGATION_TEMPLATES);
}

// ============================================================================
// ADDITIONAL MCP TOOLS
// ============================================================================

export const ADVANCED_TOOLS: Tool[] = [
  // Batch execution
  {
    name: 'batch_execute',
    description: 'Execute multiple tool calls in parallel for faster results. Returns results in same order as requests.',
    inputSchema: {
      type: 'object',
      properties: {
        requests: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Unique ID for this request' },
              tool: { type: 'string', description: 'Tool name to execute' },
              params: { type: 'object', description: 'Tool parameters' },
            },
            required: ['id', 'tool'],
          },
          description: 'Array of tool calls to execute',
        },
        maxConcurrency: {
          type: 'integer',
          description: 'Maximum parallel requests (default: 5)',
          minimum: 1,
          maximum: 10,
        },
      },
      required: ['requests'],
    },
  },

  // Pipeline execution
  {
    name: 'execute_pipeline',
    description: 'Execute a tool pipeline defined in YAML DSL. Chain tools with filters, maps, and variable references.',
    inputSchema: {
      type: 'object',
      properties: {
        pipeline: {
          type: 'string',
          description: 'Pipeline definition in YAML format',
        },
        context: {
          type: 'object',
          description: 'Initial context variables',
        },
      },
      required: ['pipeline'],
    },
  },

  // Checkpoint management
  {
    name: 'save_checkpoint',
    description: 'Save current investigation state as a checkpoint for later resumption.',
    inputSchema: {
      type: 'object',
      properties: {
        investigationId: {
          type: 'string',
          description: 'The investigation ID to checkpoint',
        },
      },
      required: ['investigationId'],
    },
  },
  {
    name: 'load_checkpoint',
    description: 'Load a saved investigation checkpoint to resume analysis.',
    inputSchema: {
      type: 'object',
      properties: {
        checkpointId: {
          type: 'string',
          description: 'The checkpoint or investigation ID to load',
        },
      },
      required: ['checkpointId'],
    },
  },
  {
    name: 'list_checkpoints',
    description: 'List all saved investigation checkpoints.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },

  // Template-based investigation
  {
    name: 'investigate_with_template',
    description: 'Run an investigation using a pre-configured template (quick_scan, deep_dive, or forensic).',
    inputSchema: {
      type: 'object',
      properties: {
        target: {
          type: 'string',
          description: 'Address or signature to investigate',
        },
        template: {
          type: 'string',
          enum: ['quick_scan', 'deep_dive', 'forensic'],
          description: 'Investigation template to use',
        },
        type: {
          type: 'string',
          enum: ['wallet_forensics', 'transaction_tracing', 'token_flow_analysis', 'anomaly_detection', 'connection_mapping', 'full_investigation'],
          description: 'Type of investigation (default: wallet_forensics)',
        },
      },
      required: ['target', 'template'],
    },
  },

  // List templates
  {
    name: 'list_investigation_templates',
    description: 'List available investigation templates with their configurations and use cases.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },

  // Context compression
  {
    name: 'compress_result',
    description: 'Compress large API results into AI-friendly summaries that fit context windows.',
    inputSchema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          description: 'The data to compress',
        },
        maxTokens: {
          type: 'integer',
          description: 'Target max tokens for output (default: 2000)',
        },
      },
      required: ['data'],
    },
  },

  // Tool versioning
  {
    name: 'get_tool_versions',
    description: 'Get version history and changelog for a tool.',
    inputSchema: {
      type: 'object',
      properties: {
        toolName: {
          type: 'string',
          description: 'Name of the tool',
        },
      },
      required: ['toolName'],
    },
  },
];

/**
 * Export all advanced features
 */
export const advancedMCP = {
  // Context compression
  compressResult,

  // Tool chaining
  parsePipeline,
  executePipeline,

  // Auth delegation
  extractAuthContext,
  hasPermission,

  // Checkpoints
  saveCheckpoint,
  loadCheckpoint,
  listCheckpoints,

  // Batch execution
  executeBatch,

  // Versioning
  getToolVersion,
  getToolVersions,

  // Templates
  getTemplate,
  listTemplates,
  INVESTIGATION_TEMPLATES,

  // Tools
  ADVANCED_TOOLS,
};
