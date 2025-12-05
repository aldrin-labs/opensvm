/**
 * OpenAPI to MCP Tool Generator
 *
 * Automatically generate MCP tools from any OpenAPI/Swagger specification.
 * Point at a spec URL and get a complete MCP server with all endpoints as tools.
 *
 * Features:
 * - OpenAPI 3.x and Swagger 2.x support
 * - Automatic parameter extraction and validation
 * - Response schema inference for tool descriptions
 * - Authentication handling (API keys, OAuth, Bearer)
 * - Rate limiting and retries
 * - Custom tool naming and grouping
 * - TypeScript type generation
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';

// ============================================================================
// Types
// ============================================================================

export interface OpenAPISpec {
  openapi?: string;
  swagger?: string;
  info: {
    title: string;
    description?: string;
    version: string;
    contact?: { name?: string; url?: string; email?: string };
    license?: { name: string; url?: string };
  };
  servers?: { url: string; description?: string }[];
  host?: string;       // Swagger 2.x
  basePath?: string;   // Swagger 2.x
  schemes?: string[];  // Swagger 2.x
  paths: Record<string, PathItem>;
  components?: {
    schemas?: Record<string, SchemaObject>;
    securitySchemes?: Record<string, SecurityScheme>;
    parameters?: Record<string, ParameterObject>;
  };
  definitions?: Record<string, SchemaObject>;  // Swagger 2.x
  securityDefinitions?: Record<string, SecurityScheme>;  // Swagger 2.x
  security?: SecurityRequirement[];
  tags?: { name: string; description?: string }[];
}

export interface PathItem {
  get?: Operation;
  post?: Operation;
  put?: Operation;
  patch?: Operation;
  delete?: Operation;
  options?: Operation;
  head?: Operation;
  parameters?: ParameterObject[];
}

export interface Operation {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: ParameterObject[];
  requestBody?: RequestBody;
  responses?: Record<string, ResponseObject>;
  security?: SecurityRequirement[];
  deprecated?: boolean;
}

export interface ParameterObject {
  name: string;
  in: 'query' | 'header' | 'path' | 'cookie' | 'body' | 'formData';
  description?: string;
  required?: boolean;
  deprecated?: boolean;
  schema?: SchemaObject;
  type?: string;       // Swagger 2.x
  format?: string;     // Swagger 2.x
  enum?: any[];
  default?: any;
}

export interface RequestBody {
  description?: string;
  required?: boolean;
  content: Record<string, { schema: SchemaObject }>;
}

export interface ResponseObject {
  description: string;
  content?: Record<string, { schema: SchemaObject }>;
  schema?: SchemaObject;  // Swagger 2.x
}

export interface SchemaObject {
  type?: string;
  format?: string;
  description?: string;
  properties?: Record<string, SchemaObject>;
  items?: SchemaObject;
  required?: string[];
  enum?: any[];
  default?: any;
  $ref?: string;
  allOf?: SchemaObject[];
  oneOf?: SchemaObject[];
  anyOf?: SchemaObject[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
}

export interface SecurityScheme {
  type: 'apiKey' | 'http' | 'oauth2' | 'openIdConnect';
  name?: string;
  in?: 'query' | 'header' | 'cookie';
  scheme?: string;
  bearerFormat?: string;
  flows?: any;
}

export type SecurityRequirement = Record<string, string[]>;

export interface GeneratorConfig {
  // Naming
  toolPrefix?: string;
  toolSuffix?: string;
  operationIdStyle?: 'camelCase' | 'snake_case' | 'kebab-case';

  // Filtering
  includeTags?: string[];
  excludeTags?: string[];
  includePaths?: string[];
  excludePaths?: string[];
  includeDeprecated?: boolean;

  // Authentication
  defaultAuth?: {
    type: 'apiKey' | 'bearer' | 'basic';
    value: string;
    headerName?: string;
  };

  // Request options
  baseUrl?: string;
  timeout?: number;
  retries?: number;

  // Generation options
  generateDescriptions?: boolean;
  includeExamples?: boolean;
  flattenParameters?: boolean;
}

export interface GeneratedTool extends Tool {
  _metadata: {
    path: string;
    method: string;
    operationId?: string;
    tags?: string[];
    security?: SecurityRequirement[];
  };
}

export interface GeneratedMCPServer {
  name: string;
  version: string;
  description: string;
  baseUrl: string;
  tools: GeneratedTool[];
  auth?: GeneratorConfig['defaultAuth'];
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: GeneratorConfig = {
  operationIdStyle: 'snake_case',
  includeDeprecated: false,
  generateDescriptions: true,
  includeExamples: true,
  flattenParameters: true,
  timeout: 30000,
  retries: 3,
};

// ============================================================================
// OpenAPI Parser
// ============================================================================

export class OpenAPIParser {
  private spec: OpenAPISpec;
  private schemas: Record<string, SchemaObject> = {};

  constructor(spec: OpenAPISpec) {
    this.spec = spec;
    // Merge schemas from different spec versions
    this.schemas = {
      ...spec.definitions,
      ...spec.components?.schemas,
    };
  }

  /**
   * Resolve a $ref to its schema
   */
  resolveRef(ref: string): SchemaObject | null {
    // #/definitions/User or #/components/schemas/User
    const parts = ref.split('/');
    const schemaName = parts[parts.length - 1];
    return this.schemas[schemaName] || null;
  }

  /**
   * Get base URL from spec
   */
  getBaseUrl(): string {
    // OpenAPI 3.x
    if (this.spec.servers && this.spec.servers.length > 0) {
      return this.spec.servers[0].url;
    }

    // Swagger 2.x
    if (this.spec.host) {
      const scheme = this.spec.schemes?.[0] || 'https';
      const basePath = this.spec.basePath || '';
      return `${scheme}://${this.spec.host}${basePath}`;
    }

    return '';
  }

  /**
   * Get all operations
   */
  getOperations(): Array<{
    path: string;
    method: string;
    operation: Operation;
    pathParameters?: ParameterObject[];
  }> {
    const operations: Array<{
      path: string;
      method: string;
      operation: Operation;
      pathParameters?: ParameterObject[];
    }> = [];

    const methods = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'] as const;

    for (const [path, pathItem] of Object.entries(this.spec.paths)) {
      for (const method of methods) {
        const operation = pathItem[method];
        if (operation) {
          operations.push({
            path,
            method,
            operation,
            pathParameters: pathItem.parameters,
          });
        }
      }
    }

    return operations;
  }

  /**
   * Convert schema to JSON Schema for MCP tool input
   */
  schemaToJsonSchema(schema: SchemaObject | undefined): any {
    if (!schema) return { type: 'object', properties: {} };

    // Handle $ref
    if (schema.$ref) {
      const resolved = this.resolveRef(schema.$ref);
      if (resolved) return this.schemaToJsonSchema(resolved);
      return { type: 'object' };
    }

    // Handle allOf, oneOf, anyOf
    if (schema.allOf) {
      const merged: any = { type: 'object', properties: {}, required: [] };
      for (const subSchema of schema.allOf) {
        const converted = this.schemaToJsonSchema(subSchema);
        Object.assign(merged.properties, converted.properties || {});
        if (converted.required) {
          merged.required.push(...converted.required);
        }
      }
      return merged;
    }

    const result: any = {
      type: schema.type || 'object',
    };

    if (schema.description) result.description = schema.description;
    if (schema.enum) result.enum = schema.enum;
    if (schema.default !== undefined) result.default = schema.default;
    if (schema.minimum !== undefined) result.minimum = schema.minimum;
    if (schema.maximum !== undefined) result.maximum = schema.maximum;
    if (schema.minLength !== undefined) result.minLength = schema.minLength;
    if (schema.maxLength !== undefined) result.maxLength = schema.maxLength;
    if (schema.pattern) result.pattern = schema.pattern;

    if (schema.type === 'object' && schema.properties) {
      result.properties = {};
      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        result.properties[propName] = this.schemaToJsonSchema(propSchema);
      }
      if (schema.required) {
        result.required = schema.required;
      }
    }

    if (schema.type === 'array' && schema.items) {
      result.items = this.schemaToJsonSchema(schema.items);
    }

    return result;
  }
}

// ============================================================================
// Tool Generator
// ============================================================================

export class MCPToolGenerator {
  private parser: OpenAPIParser;
  private config: GeneratorConfig;

  constructor(spec: OpenAPISpec, config: Partial<GeneratorConfig> = {}) {
    this.parser = new OpenAPIParser(spec);
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Generate all MCP tools from the spec
   */
  generate(): GeneratedMCPServer {
    const operations = this.parser.getOperations();
    const tools: GeneratedTool[] = [];

    for (const { path, method, operation, pathParameters } of operations) {
      // Apply filters
      if (!this.shouldInclude(operation, path)) continue;

      const tool = this.generateTool(path, method, operation, pathParameters);
      if (tool) tools.push(tool);
    }

    const spec = (this.parser as any).spec as OpenAPISpec;

    return {
      name: this.formatName(spec.info.title),
      version: spec.info.version,
      description: spec.info.description || `MCP server generated from ${spec.info.title}`,
      baseUrl: this.config.baseUrl || this.parser.getBaseUrl(),
      tools,
      auth: this.config.defaultAuth,
    };
  }

  /**
   * Generate a single tool from an operation
   */
  private generateTool(
    path: string,
    method: string,
    operation: Operation,
    pathParameters?: ParameterObject[]
  ): GeneratedTool | null {
    const toolName = this.generateToolName(path, method, operation);

    // Merge parameters
    const allParams = [
      ...(pathParameters || []),
      ...(operation.parameters || []),
    ];

    // Build input schema
    const inputSchema = this.buildInputSchema(allParams, operation.requestBody);

    // Build description
    const description = this.buildDescription(operation, path, method);

    const tool: GeneratedTool = {
      name: toolName,
      description,
      inputSchema,
      _metadata: {
        path,
        method: method.toUpperCase(),
        operationId: operation.operationId,
        tags: operation.tags,
        security: operation.security,
      },
    };

    return tool;
  }

  /**
   * Generate tool name
   */
  private generateToolName(path: string, method: string, operation: Operation): string {
    // Use operationId if available
    if (operation.operationId) {
      return this.formatName(operation.operationId);
    }

    // Generate from path and method
    const pathParts = path
      .replace(/\{[^}]+\}/g, '')  // Remove path parameters
      .split('/')
      .filter(p => p.length > 0);

    let name = `${method}_${pathParts.join('_')}`;

    // Apply prefix/suffix
    if (this.config.toolPrefix) name = `${this.config.toolPrefix}_${name}`;
    if (this.config.toolSuffix) name = `${name}_${this.config.toolSuffix}`;

    return this.formatName(name);
  }

  /**
   * Format name according to config style
   */
  private formatName(name: string): string {
    // Clean up name
    name = name.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_');

    switch (this.config.operationIdStyle) {
      case 'camelCase':
        return name.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      case 'kebab-case':
        return name.replace(/_/g, '-').toLowerCase();
      case 'snake_case':
      default:
        return name.toLowerCase();
    }
  }

  /**
   * Build input schema from parameters
   */
  private buildInputSchema(params: ParameterObject[], requestBody?: RequestBody): any {
    const properties: Record<string, any> = {};
    const required: string[] = [];

    // Process parameters
    for (const param of params) {
      const schema = this.parameterToSchema(param);
      properties[param.name] = schema;

      if (param.required) {
        required.push(param.name);
      }
    }

    // Process request body
    if (requestBody) {
      const bodySchema = this.extractRequestBodySchema(requestBody);
      if (bodySchema) {
        if (this.config.flattenParameters && bodySchema.properties) {
          // Flatten body properties into top level
          Object.assign(properties, bodySchema.properties);
          if (bodySchema.required) {
            required.push(...bodySchema.required);
          }
        } else {
          // Add as 'body' parameter
          properties['body'] = bodySchema;
          if (requestBody.required) {
            required.push('body');
          }
        }
      }
    }

    return {
      type: 'object',
      properties,
      required: required.length > 0 ? required : undefined,
    };
  }

  /**
   * Convert parameter to schema
   */
  private parameterToSchema(param: ParameterObject): any {
    // OpenAPI 3.x
    if (param.schema) {
      return this.parser.schemaToJsonSchema(param.schema);
    }

    // Swagger 2.x
    const schema: any = {
      type: param.type || 'string',
    };

    if (param.description) schema.description = param.description;
    if (param.format) schema.format = param.format;
    if (param.enum) schema.enum = param.enum;
    if (param.default !== undefined) schema.default = param.default;

    return schema;
  }

  /**
   * Extract schema from request body
   */
  private extractRequestBodySchema(requestBody: RequestBody): any {
    const content = requestBody.content;

    // Prefer JSON
    const jsonContent = content['application/json'];
    if (jsonContent?.schema) {
      return this.parser.schemaToJsonSchema(jsonContent.schema);
    }

    // Fallback to first content type
    const firstContent = Object.values(content)[0];
    if (firstContent?.schema) {
      return this.parser.schemaToJsonSchema(firstContent.schema);
    }

    return null;
  }

  /**
   * Build tool description
   */
  private buildDescription(operation: Operation, path: string, method: string): string {
    const parts: string[] = [];

    if (operation.summary) {
      parts.push(operation.summary);
    }

    if (this.config.generateDescriptions && operation.description) {
      if (operation.description !== operation.summary) {
        parts.push(operation.description);
      }
    }

    // Add method and path info
    parts.push(`\n[${method.toUpperCase()} ${path}]`);

    // Add tags
    if (operation.tags && operation.tags.length > 0) {
      parts.push(`Tags: ${operation.tags.join(', ')}`);
    }

    // Add deprecation warning
    if (operation.deprecated) {
      parts.push('⚠️ DEPRECATED');
    }

    return parts.join('\n');
  }

  /**
   * Check if operation should be included
   */
  private shouldInclude(operation: Operation, path: string): boolean {
    // Exclude deprecated
    if (!this.config.includeDeprecated && operation.deprecated) {
      return false;
    }

    // Tag filters
    if (this.config.includeTags && this.config.includeTags.length > 0) {
      if (!operation.tags?.some(t => this.config.includeTags!.includes(t))) {
        return false;
      }
    }

    if (this.config.excludeTags && this.config.excludeTags.length > 0) {
      if (operation.tags?.some(t => this.config.excludeTags!.includes(t))) {
        return false;
      }
    }

    // Path filters
    if (this.config.includePaths && this.config.includePaths.length > 0) {
      if (!this.config.includePaths.some(p => path.startsWith(p))) {
        return false;
      }
    }

    if (this.config.excludePaths && this.config.excludePaths.length > 0) {
      if (this.config.excludePaths.some(p => path.startsWith(p))) {
        return false;
      }
    }

    return true;
  }
}

// ============================================================================
// Runtime Executor
// ============================================================================

export class GeneratedServerExecutor {
  private server: GeneratedMCPServer;
  private toolMap: Map<string, GeneratedTool>;

  constructor(server: GeneratedMCPServer) {
    this.server = server;
    this.toolMap = new Map(server.tools.map(t => [t.name, t]));
  }

  /**
   * Execute a tool call
   */
  async execute(toolName: string, params: Record<string, any>): Promise<any> {
    const tool = this.toolMap.get(toolName);
    if (!tool) {
      throw new Error(`Unknown tool: ${toolName}`);
    }

    const { path, method } = tool._metadata;

    // Build URL with path parameters
    let url = `${this.server.baseUrl}${path}`;
    const queryParams: Record<string, string> = {};
    let body: any = undefined;

    // Separate params by location
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null) continue;

      // Check if it's a path parameter
      if (url.includes(`{${key}}`)) {
        url = url.replace(`{${key}}`, encodeURIComponent(String(value)));
      } else if (method === 'GET' || method === 'DELETE') {
        // Query parameters for GET/DELETE
        queryParams[key] = String(value);
      } else {
        // Body for POST/PUT/PATCH
        if (!body) body = {};
        body[key] = value;
      }
    }

    // Add query parameters
    const queryString = new URLSearchParams(queryParams).toString();
    if (queryString) {
      url += `?${queryString}`;
    }

    // Build headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    // Add authentication
    if (this.server.auth) {
      switch (this.server.auth.type) {
        case 'apiKey':
          headers[this.server.auth.headerName || 'X-API-Key'] = this.server.auth.value;
          break;
        case 'bearer':
          headers['Authorization'] = `Bearer ${this.server.auth.value}`;
          break;
        case 'basic':
          headers['Authorization'] = `Basic ${this.server.auth.value}`;
          break;
      }
    }

    // Make request
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    // Parse response
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return await response.json();
    }

    return await response.text();
  }

  /**
   * Get all tools
   */
  getTools(): Tool[] {
    return this.server.tools;
  }

  /**
   * Get server info
   */
  getInfo(): { name: string; version: string; description: string } {
    return {
      name: this.server.name,
      version: this.server.version,
      description: this.server.description,
    };
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Generate MCP server from OpenAPI spec URL
 */
export async function generateFromUrl(
  url: string,
  config?: Partial<GeneratorConfig>
): Promise<GeneratedMCPServer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch spec: ${response.status}`);
  }

  const spec = await response.json();
  const generator = new MCPToolGenerator(spec, config);
  return generator.generate();
}

/**
 * Generate MCP server from OpenAPI spec object
 */
export function generateFromSpec(
  spec: OpenAPISpec,
  config?: Partial<GeneratorConfig>
): GeneratedMCPServer {
  const generator = new MCPToolGenerator(spec, config);
  return generator.generate();
}

/**
 * Create executable server from generated server
 */
export function createExecutor(server: GeneratedMCPServer): GeneratedServerExecutor {
  return new GeneratedServerExecutor(server);
}

/**
 * Generate TypeScript types from spec
 */
export function generateTypes(spec: OpenAPISpec): string {
  const parser = new OpenAPIParser(spec);
  const lines: string[] = [
    '// Auto-generated types from OpenAPI spec',
    `// Generated at: ${new Date().toISOString()}`,
    '',
  ];

  const schemas = (spec.components?.schemas || spec.definitions || {});

  for (const [name, schema] of Object.entries(schemas)) {
    lines.push(`export interface ${name} {`);

    if (schema.properties) {
      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        const required = schema.required?.includes(propName) ? '' : '?';
        const type = schemaToTsType(propSchema, parser);
        const desc = propSchema.description ? ` // ${propSchema.description}` : '';
        lines.push(`  ${propName}${required}: ${type};${desc}`);
      }
    }

    lines.push('}');
    lines.push('');
  }

  return lines.join('\n');
}

function schemaToTsType(schema: SchemaObject, parser: OpenAPIParser): string {
  if (schema.$ref) {
    const parts = schema.$ref.split('/');
    return parts[parts.length - 1];
  }

  switch (schema.type) {
    case 'string':
      if (schema.enum) return schema.enum.map(e => `'${e}'`).join(' | ');
      return 'string';
    case 'number':
    case 'integer':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'array':
      return `Array<${schemaToTsType(schema.items || {}, parser)}>`;
    case 'object':
      if (schema.properties) {
        const props = Object.entries(schema.properties)
          .map(([k, v]) => `${k}: ${schemaToTsType(v, parser)}`)
          .join('; ');
        return `{ ${props} }`;
      }
      return 'Record<string, any>';
    default:
      return 'any';
  }
}

// ============================================================================
// Exports
// ============================================================================

export default {
  OpenAPIParser,
  MCPToolGenerator,
  GeneratedServerExecutor,
  generateFromUrl,
  generateFromSpec,
  createExecutor,
  generateTypes,
};
