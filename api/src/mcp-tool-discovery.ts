#!/usr/bin/env bun
/**
 * MCP Tool Discovery System
 *
 * Automatically discovers, registers, and aggregates MCP tools from modules.
 * Supports hot-reload for development and dynamic tool registration.
 *
 * Architecture:
 * 1. Scanner - Finds MCP modules in the source directory
 * 2. Parser - Extracts tool definitions from modules
 * 3. Registry - Maintains aggregated tool catalog with namespaces
 * 4. Router - Routes tool calls to appropriate handlers
 * 5. Watcher - Detects file changes for hot-reload
 */

import { watch, existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join, basename, dirname } from 'path';
import { EventEmitter } from 'events';

// ============================================================================
// Types
// ============================================================================

export interface DiscoveredTool {
  name: string;
  originalName: string;
  namespace: string;
  description: string;
  inputSchema: Record<string, unknown>;
  sourceModule: string;
  handler?: ToolHandler;
}

export interface DiscoveredModule {
  id: string;
  name: string;
  version: string;
  namespace: string;
  path: string;
  tools: DiscoveredTool[];
  prompts: DiscoveredPrompt[];
  resources: DiscoveredResource[];
  status: 'discovered' | 'loaded' | 'error' | 'disabled';
  error?: string;
  lastModified: number;
}

export interface DiscoveredPrompt {
  name: string;
  description: string;
  arguments?: Array<{ name: string; description: string; required?: boolean }>;
  sourceModule: string;
}

export interface DiscoveredResource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
  sourceModule: string;
}

export type ToolHandler = (args: Record<string, unknown>) => Promise<unknown>;

export interface ToolRegistryEvents {
  'module:discovered': (module: DiscoveredModule) => void;
  'module:loaded': (module: DiscoveredModule) => void;
  'module:error': (module: DiscoveredModule, error: Error) => void;
  'module:removed': (moduleId: string) => void;
  'tool:registered': (tool: DiscoveredTool) => void;
  'tool:unregistered': (toolName: string) => void;
  'registry:updated': (stats: RegistryStats) => void;
}

export interface RegistryStats {
  totalModules: number;
  loadedModules: number;
  errorModules: number;
  totalTools: number;
  totalPrompts: number;
  totalResources: number;
  byNamespace: Record<string, number>;
}

export interface DiscoveryConfig {
  sourceDirs: string[];
  watchEnabled: boolean;
  autoReload: boolean;
  namespaceFromFilename: boolean;
  includePatterns: RegExp[];
  excludePatterns: RegExp[];
  debounceMs: number;
}

// ============================================================================
// Module Scanner
// ============================================================================

const DEFAULT_CONFIG: DiscoveryConfig = {
  sourceDirs: ['./src'],
  watchEnabled: true,
  autoReload: true,
  namespaceFromFilename: true,
  includePatterns: [/^mcp-.*\.ts$/, /opensvm-mcp.*\.ts$/],
  excludePatterns: [/\.test\.ts$/, /\.spec\.ts$/, /node_modules/],
  debounceMs: 500,
};

/**
 * Scan directories for MCP modules
 */
export function scanForModules(config: Partial<DiscoveryConfig> = {}): string[] {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const modules: string[] = [];

  for (const dir of cfg.sourceDirs) {
    if (!existsSync(dir)) continue;

    const files = readdirSync(dir, { recursive: false });
    for (const file of files) {
      const filename = typeof file === 'string' ? file : file.toString();
      const fullPath = join(dir, filename);

      // Check if directory
      if (statSync(fullPath).isDirectory()) continue;

      // Check include patterns
      const matchesInclude = cfg.includePatterns.some(p => p.test(filename));
      if (!matchesInclude) continue;

      // Check exclude patterns
      const matchesExclude = cfg.excludePatterns.some(p => p.test(filename));
      if (matchesExclude) continue;

      modules.push(fullPath);
    }
  }

  return modules;
}

/**
 * Extract namespace from module path/content
 */
export function extractNamespace(modulePath: string, content: string): string {
  // Try to extract from server name in content
  const serverNameMatch = content.match(/name:\s*['"]([^'"]+)['"]/);
  if (serverNameMatch) {
    const serverName = serverNameMatch[1];
    // Convert "liquidity-mining-mcp" -> "lp"
    // Convert "governance-timelock-mcp" -> "governance"
    // Convert "opensvm-mcp" -> "solana"
    const nameMap: Record<string, string> = {
      'liquidity-mining-mcp': 'lp',
      'governance-timelock-mcp': 'governance',
      'opensvm-mcp': 'solana',
      'opensvm-unified-mcp': 'unified',
      'kalshi-mcp': 'kalshi',
      'dflow-mcp': 'dflow',
      'prediction-market-metadata': 'dflow',
    };

    for (const [pattern, ns] of Object.entries(nameMap)) {
      if (serverName.includes(pattern)) return ns;
    }

    // Default: use first word of server name
    return serverName.split('-')[0].toLowerCase();
  }

  // Fallback: extract from filename
  const filename = basename(modulePath, '.ts');
  if (filename.startsWith('mcp-')) {
    return filename.replace('mcp-', '').split('-')[0];
  }
  if (filename.includes('opensvm')) return 'solana';
  if (filename.includes('kalshi')) return 'kalshi';
  if (filename.includes('dflow')) return 'dflow';

  return filename.replace(/-mcp$/, '').replace(/^mcp-/, '');
}

/**
 * Parse tool definitions from module content
 */
export function parseToolsFromContent(content: string, namespace: string, modulePath: string): DiscoveredTool[] {
  const tools: DiscoveredTool[] = [];

  // Find TOOLS array or similar patterns
  const toolsArrayMatch = content.match(/(?:const\s+)?TOOLS\s*(?::\s*Tool\[\])?\s*=\s*\[([\s\S]*?)\];/);
  if (!toolsArrayMatch) return tools;

  const toolsContent = toolsArrayMatch[1];

  // Extract individual tool objects
  const toolRegex = /{\s*name:\s*['"]([^'"]+)['"]\s*,\s*(?:title:\s*['"][^'"]*['"]\s*,\s*)?description:\s*['"]([^'"]+)['"]\s*,\s*inputSchema:\s*({[\s\S]*?})\s*(?:,\s*annotations:\s*{[\s\S]*?})?\s*}/g;

  let match;
  while ((match = toolRegex.exec(toolsContent)) !== null) {
    const [, name, description, schemaStr] = match;

    // Skip if already namespaced
    if (name.includes(':')) {
      tools.push({
        name,
        originalName: name.split(':')[1],
        namespace: name.split(':')[0],
        description,
        inputSchema: parseJsonLike(schemaStr),
        sourceModule: modulePath,
      });
    } else {
      tools.push({
        name: `${namespace}:${name}`,
        originalName: name,
        namespace,
        description,
        inputSchema: parseJsonLike(schemaStr),
        sourceModule: modulePath,
      });
    }
  }

  return tools;
}

/**
 * Parse JSON-like object from source code
 */
function parseJsonLike(str: string): Record<string, unknown> {
  try {
    // Clean up the string for JSON parsing
    let cleaned = str
      .replace(/(\w+):/g, '"$1":')  // Quote keys
      .replace(/'/g, '"')            // Single to double quotes
      .replace(/,\s*}/g, '}')        // Remove trailing commas
      .replace(/,\s*]/g, ']')        // Remove trailing commas in arrays
      .replace(/\n/g, ' ')           // Remove newlines
      .replace(/\s+/g, ' ');         // Normalize whitespace

    return JSON.parse(cleaned);
  } catch {
    // Return minimal valid schema on parse error
    return { type: 'object', properties: {} };
  }
}

/**
 * Parse prompts from module content
 */
export function parsePromptsFromContent(content: string, modulePath: string): DiscoveredPrompt[] {
  const prompts: DiscoveredPrompt[] = [];

  const promptsMatch = content.match(/(?:const\s+)?PROMPTS\s*=\s*\[([\s\S]*?)\];/);
  if (!promptsMatch) return prompts;

  const promptsContent = promptsMatch[1];
  const promptRegex = /{\s*name:\s*['"]([^'"]+)['"]\s*,\s*description:\s*['"]([^'"]+)['"][\s\S]*?}/g;

  let match;
  while ((match = promptRegex.exec(promptsContent)) !== null) {
    const [, name, description] = match;
    prompts.push({
      name,
      description,
      sourceModule: modulePath,
    });
  }

  return prompts;
}

/**
 * Parse resources from module content
 */
export function parseResourcesFromContent(content: string, modulePath: string): DiscoveredResource[] {
  const resources: DiscoveredResource[] = [];

  const resourcesMatch = content.match(/(?:const\s+)?RESOURCES\s*=\s*\[([\s\S]*?)\];/);
  if (!resourcesMatch) return resources;

  const resourcesContent = resourcesMatch[1];
  const resourceRegex = /{\s*uri:\s*['"]([^'"]+)['"]\s*,\s*name:\s*['"]([^'"]+)['"]\s*,\s*description:\s*['"]([^'"]+)['"]\s*,\s*mimeType:\s*['"]([^'"]+)['"][\s\S]*?}/g;

  let match;
  while ((match = resourceRegex.exec(resourcesContent)) !== null) {
    const [, uri, name, description, mimeType] = match;
    resources.push({
      uri,
      name,
      description,
      mimeType,
      sourceModule: modulePath,
    });
  }

  return resources;
}

// ============================================================================
// Tool Registry
// ============================================================================

export class ToolRegistry extends EventEmitter {
  private modules: Map<string, DiscoveredModule> = new Map();
  private tools: Map<string, DiscoveredTool> = new Map();
  private prompts: Map<string, DiscoveredPrompt> = new Map();
  private resources: Map<string, DiscoveredResource> = new Map();
  private config: DiscoveryConfig;
  private watchers: Map<string, ReturnType<typeof watch>> = new Map();
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(config: Partial<DiscoveryConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Discover and register all modules
   */
  async discover(): Promise<DiscoveredModule[]> {
    const modulePaths = scanForModules(this.config);
    const discovered: DiscoveredModule[] = [];

    for (const modulePath of modulePaths) {
      try {
        const module = await this.loadModule(modulePath);
        if (module) {
          discovered.push(module);
        }
      } catch (error) {
        console.error(`Failed to load module ${modulePath}:`, error);
      }
    }

    if (this.config.watchEnabled) {
      this.startWatching();
    }

    this.emitStats();
    return discovered;
  }

  /**
   * Load a single module
   */
  async loadModule(modulePath: string): Promise<DiscoveredModule | null> {
    if (!existsSync(modulePath)) return null;

    const content = readFileSync(modulePath, 'utf-8');
    const stat = statSync(modulePath);
    const moduleId = basename(modulePath, '.ts');

    // Check if it's actually an MCP module
    if (!content.includes('@modelcontextprotocol/sdk') && !content.includes('TOOLS')) {
      return null;
    }

    const namespace = extractNamespace(modulePath, content);
    const tools = parseToolsFromContent(content, namespace, modulePath);
    const prompts = parsePromptsFromContent(content, modulePath);
    const resources = parseResourcesFromContent(content, modulePath);

    // Extract version from content or default
    const versionMatch = content.match(/version:\s*['"]([^'"]+)['"]/);
    const version = versionMatch ? versionMatch[1] : '1.0.0';

    const module: DiscoveredModule = {
      id: moduleId,
      name: moduleId.replace(/-/g, ' ').replace(/mcp/gi, 'MCP'),
      version,
      namespace,
      path: modulePath,
      tools,
      prompts,
      resources,
      status: tools.length > 0 ? 'loaded' : 'discovered',
      lastModified: stat.mtimeMs,
    };

    // Register module
    const existingModule = this.modules.get(moduleId);
    if (existingModule) {
      // Unregister old tools
      for (const tool of existingModule.tools) {
        this.tools.delete(tool.name);
        this.emit('tool:unregistered', tool.name);
      }
    }

    this.modules.set(moduleId, module);

    // Register tools
    for (const tool of tools) {
      this.tools.set(tool.name, tool);
      this.emit('tool:registered', tool);
    }

    // Register prompts
    for (const prompt of prompts) {
      this.prompts.set(prompt.name, prompt);
    }

    // Register resources
    for (const resource of resources) {
      this.resources.set(resource.uri, resource);
    }

    this.emit('module:loaded', module);
    return module;
  }

  /**
   * Unload a module
   */
  unloadModule(moduleId: string): void {
    const module = this.modules.get(moduleId);
    if (!module) return;

    // Unregister tools
    for (const tool of module.tools) {
      this.tools.delete(tool.name);
      this.emit('tool:unregistered', tool.name);
    }

    // Unregister prompts
    for (const prompt of module.prompts) {
      this.prompts.delete(prompt.name);
    }

    // Unregister resources
    for (const resource of module.resources) {
      this.resources.delete(resource.uri);
    }

    this.modules.delete(moduleId);
    this.emit('module:removed', moduleId);
    this.emitStats();
  }

  /**
   * Start watching for file changes
   */
  private startWatching(): void {
    for (const dir of this.config.sourceDirs) {
      if (!existsSync(dir)) continue;

      const watcher = watch(dir, { recursive: false }, (eventType, filename) => {
        if (!filename) return;

        const fullPath = join(dir, filename);

        // Check patterns
        const matchesInclude = this.config.includePatterns.some(p => p.test(filename));
        const matchesExclude = this.config.excludePatterns.some(p => p.test(filename));
        if (!matchesInclude || matchesExclude) return;

        // Debounce
        const existing = this.debounceTimers.get(fullPath);
        if (existing) clearTimeout(existing);

        this.debounceTimers.set(fullPath, setTimeout(() => {
          if (eventType === 'rename') {
            if (existsSync(fullPath)) {
              this.loadModule(fullPath).then(() => this.emitStats());
            } else {
              const moduleId = basename(fullPath, '.ts');
              this.unloadModule(moduleId);
            }
          } else if (eventType === 'change') {
            if (this.config.autoReload) {
              this.loadModule(fullPath).then(() => this.emitStats());
            }
          }
        }, this.config.debounceMs));
      });

      this.watchers.set(dir, watcher);
    }
  }

  /**
   * Stop watching
   */
  stopWatching(): void {
    for (const [, watcher] of this.watchers) {
      watcher.close();
    }
    this.watchers.clear();
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
  }

  /**
   * Get all tools
   */
  getAllTools(): DiscoveredTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tools by namespace
   */
  getToolsByNamespace(namespace: string): DiscoveredTool[] {
    return this.getAllTools().filter(t => t.namespace === namespace);
  }

  /**
   * Get a specific tool
   */
  getTool(name: string): DiscoveredTool | undefined {
    return this.tools.get(name);
  }

  /**
   * Get all prompts
   */
  getAllPrompts(): DiscoveredPrompt[] {
    return Array.from(this.prompts.values());
  }

  /**
   * Get all resources
   */
  getAllResources(): DiscoveredResource[] {
    return Array.from(this.resources.values());
  }

  /**
   * Get all modules
   */
  getAllModules(): DiscoveredModule[] {
    return Array.from(this.modules.values());
  }

  /**
   * Get registry stats
   */
  getStats(): RegistryStats {
    const byNamespace: Record<string, number> = {};
    for (const tool of this.tools.values()) {
      byNamespace[tool.namespace] = (byNamespace[tool.namespace] || 0) + 1;
    }

    const modules = Array.from(this.modules.values());
    return {
      totalModules: modules.length,
      loadedModules: modules.filter(m => m.status === 'loaded').length,
      errorModules: modules.filter(m => m.status === 'error').length,
      totalTools: this.tools.size,
      totalPrompts: this.prompts.size,
      totalResources: this.resources.size,
      byNamespace,
    };
  }

  /**
   * Emit stats event
   */
  private emitStats(): void {
    this.emit('registry:updated', this.getStats());
  }

  /**
   * Get namespaces
   */
  getNamespaces(): string[] {
    const namespaces = new Set<string>();
    for (const tool of this.tools.values()) {
      namespaces.add(tool.namespace);
    }
    return Array.from(namespaces).sort();
  }

  /**
   * Register a custom handler for a tool
   */
  registerHandler(toolName: string, handler: ToolHandler): void {
    const tool = this.tools.get(toolName);
    if (tool) {
      tool.handler = handler;
    }
  }

  /**
   * Format tools for MCP response
   */
  getToolsForMCP(): Array<{
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
  }> {
    return this.getAllTools().map(t => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    }));
  }
}

// ============================================================================
// Gateway Server
// ============================================================================

export class MCPGateway {
  private registry: ToolRegistry;
  private handlers: Map<string, ToolHandler> = new Map();

  constructor(config: Partial<DiscoveryConfig> = {}) {
    this.registry = new ToolRegistry(config);
    this.setupDefaultHandlers();
  }

  /**
   * Setup default HTTP handlers for common tools
   */
  private setupDefaultHandlers(): void {
    // Solana namespace handlers
    this.handlers.set('solana', async (args) => {
      const baseUrl = 'https://osvm.ai';
      const tool = args._tool as string;
      const toolArgs = { ...args };
      delete toolArgs._tool;

      const endpoints: Record<string, { method: string; path: string | ((a: Record<string, unknown>) => string) }> = {
        'get_transaction': { method: 'GET', path: (a) => `/api/transaction/${a.signature}` },
        'get_account_portfolio': { method: 'GET', path: (a) => `/api/account/${a.address}/portfolio` },
        'get_account_transactions': { method: 'GET', path: (a) => `/api/account/${a.address}/transactions` },
        'get_blocks': { method: 'GET', path: '/api/blocks' },
        'search': { method: 'GET', path: '/api/search' },
      };

      const endpoint = endpoints[tool];
      if (!endpoint) return { error: `Unknown solana tool: ${tool}` };

      const path = typeof endpoint.path === 'function' ? endpoint.path(toolArgs) : endpoint.path;
      const url = new URL(path, baseUrl);

      if (endpoint.method === 'GET') {
        for (const [key, value] of Object.entries(toolArgs)) {
          if (value !== undefined && !path.includes(String(value))) {
            url.searchParams.append(key, String(value));
          }
        }
      }

      const response = await fetch(url.toString());
      return response.json();
    });

    // DFlow namespace handlers
    this.handlers.set('dflow', async (args) => {
      const baseUrl = 'https://prediction-markets-api.dflow.net';
      const tool = args._tool as string;
      const toolArgs = { ...args };
      delete toolArgs._tool;

      const endpoints: Record<string, { method: string; path: string | ((a: Record<string, unknown>) => string) }> = {
        'get_event': { method: 'GET', path: (a) => `/api/v1/event/${a.event_id}` },
        'get_events': { method: 'GET', path: '/api/v1/events' },
        'get_market': { method: 'GET', path: (a) => `/api/v1/market/${a.market_id}` },
        'get_markets': { method: 'GET', path: '/api/v1/markets' },
      };

      const endpoint = endpoints[tool];
      if (!endpoint) return { error: `Unknown dflow tool: ${tool}` };

      const path = typeof endpoint.path === 'function' ? endpoint.path(toolArgs) : endpoint.path;
      const url = new URL(path, baseUrl);

      if (endpoint.method === 'GET') {
        for (const [key, value] of Object.entries(toolArgs)) {
          if (value !== undefined && !path.includes(String(value))) {
            url.searchParams.append(key, String(value));
          }
        }
      }

      const response = await fetch(url.toString());
      return response.json();
    });

    // Kalshi namespace handlers
    this.handlers.set('kalshi', async (args) => {
      const baseUrl = 'https://api.elections.kalshi.com/trade-api/v2';
      const tool = args._tool as string;
      const toolArgs = { ...args };
      delete toolArgs._tool;

      const endpoints: Record<string, { method: string; path: string | ((a: Record<string, unknown>) => string) }> = {
        'get_exchange_status': { method: 'GET', path: '/exchange/status' },
        'list_markets': { method: 'GET', path: '/markets' },
        'get_market': { method: 'GET', path: (a) => `/markets/${a.ticker}` },
        'list_events': { method: 'GET', path: '/events' },
      };

      const endpoint = endpoints[tool];
      if (!endpoint) return { error: `Unknown kalshi tool: ${tool}` };

      const path = typeof endpoint.path === 'function' ? endpoint.path(toolArgs) : endpoint.path;
      const url = new URL(path, baseUrl);

      if (endpoint.method === 'GET') {
        for (const [key, value] of Object.entries(toolArgs)) {
          if (value !== undefined && !path.includes(String(value))) {
            url.searchParams.append(key, String(value));
          }
        }
      }

      const response = await fetch(url.toString());
      return response.json();
    });
  }

  /**
   * Initialize the gateway
   */
  async initialize(): Promise<void> {
    await this.registry.discover();

    this.registry.on('module:loaded', (module) => {
      console.error(`[Gateway] Loaded module: ${module.name} (${module.tools.length} tools)`);
    });

    this.registry.on('registry:updated', (stats) => {
      console.error(`[Gateway] Registry updated: ${stats.totalTools} tools from ${stats.loadedModules} modules`);
    });
  }

  /**
   * Get registry
   */
  getRegistry(): ToolRegistry {
    return this.registry;
  }

  /**
   * Execute a tool
   */
  async executeTool(toolName: string, args: Record<string, unknown>): Promise<unknown> {
    const tool = this.registry.getTool(toolName);
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    // Check for registered handler
    if (tool.handler) {
      return tool.handler(args);
    }

    // Check for namespace handler
    const namespaceHandler = this.handlers.get(tool.namespace);
    if (namespaceHandler) {
      return namespaceHandler({ ...args, _tool: tool.originalName });
    }

    // Fallback: return stub response
    return {
      message: `Tool ${toolName} called`,
      args,
      note: 'No handler registered for this tool',
    };
  }

  /**
   * Register a namespace handler
   */
  registerNamespaceHandler(namespace: string, handler: ToolHandler): void {
    this.handlers.set(namespace, handler);
  }

  /**
   * Stop the gateway
   */
  stop(): void {
    this.registry.stopWatching();
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let gatewayInstance: MCPGateway | null = null;

export function getGateway(config?: Partial<DiscoveryConfig>): MCPGateway {
  if (!gatewayInstance) {
    gatewayInstance = new MCPGateway(config);
  }
  return gatewayInstance;
}

export async function initializeGateway(config?: Partial<DiscoveryConfig>): Promise<MCPGateway> {
  const gateway = getGateway(config);
  await gateway.initialize();
  return gateway;
}

// ============================================================================
// CLI Runner (for direct execution with bun)
// ============================================================================

/**
 * Run the discovery CLI
 * Usage: bun run src/mcp-tool-discovery.ts
 */
export async function runCLI(sourceDir: string): Promise<void> {
  console.log('MCP Tool Discovery System');
  console.log('========================');

  const gateway = new MCPGateway({
    sourceDirs: [sourceDir],
    watchEnabled: false,
  });

  await gateway.initialize();

  const stats = gateway.getRegistry().getStats();
  console.log(`\nDiscovered ${stats.totalModules} modules with ${stats.totalTools} tools:`);

  const namespaces = gateway.getRegistry().getNamespaces();
  for (const ns of namespaces) {
    const tools = gateway.getRegistry().getToolsByNamespace(ns);
    console.log(`  ${ns}: ${tools.length} tools`);
    for (const tool of tools.slice(0, 3)) {
      console.log(`    - ${tool.originalName}: ${tool.description.slice(0, 50)}...`);
    }
    if (tools.length > 3) {
      console.log(`    ... and ${tools.length - 3} more`);
    }
  }

  console.log('\nPrompts:', gateway.getRegistry().getAllPrompts().length);
  console.log('Resources:', gateway.getRegistry().getAllResources().length);
}
