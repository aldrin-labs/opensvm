#!/usr/bin/env bun
/**
 * MCP Server Template Generator CLI
 *
 * Creates a new MCP server project with the official registry schema.
 *
 * Usage:
 *   npx create-mcp-server my-server
 *   bun run bin/create-mcp-server.ts my-server
 *   bun run bin/create-mcp-server.ts my-server --template basic
 *
 * Options:
 *   --template <type>  Template type: basic, advanced, streaming (default: basic)
 *   --transport <type> Transport: stdio, http, sse, websocket (default: stdio)
 *   --registry <type>  Package registry: npm, pypi (default: npm)
 *   --author <name>    Author name
 *   --description <d>  Server description
 *   --force            Overwrite existing directory
 *   --dry-run          Show what would be created without creating files
 */

import * as fs from 'fs';
import * as path from 'path';

const MCP_SCHEMA_VERSION = 'https://modelcontextprotocol.io/schemas/server-v1.2025-10-17.json';

interface ServerConfig {
  name: string;
  template: 'basic' | 'advanced' | 'streaming';
  transport: 'stdio' | 'http' | 'sse' | 'websocket';
  registry: 'npm' | 'pypi';
  author?: string;
  description?: string;
  force?: boolean;
  dryRun?: boolean;
}

// Parse command line arguments
function parseArgs(args: string[]): ServerConfig {
  const config: ServerConfig = {
    name: '',
    template: 'basic',
    transport: 'stdio',
    registry: 'npm',
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      switch (key) {
        case 'template':
          config.template = args[++i] as any;
          break;
        case 'transport':
          config.transport = args[++i] as any;
          break;
        case 'registry':
          config.registry = args[++i] as any;
          break;
        case 'author':
          config.author = args[++i];
          break;
        case 'description':
          config.description = args[++i];
          break;
        case 'force':
          config.force = true;
          break;
        case 'dry-run':
          config.dryRun = true;
          break;
        case 'help':
          printHelp();
          process.exit(0);
      }
    } else if (!config.name) {
      config.name = arg;
    }
  }

  return config;
}

function printHelp() {
  console.log(`
MCP Server Template Generator

Usage: create-mcp-server <name> [options]

Options:
  --template <type>   Template type: basic, advanced, streaming (default: basic)
  --transport <type>  Transport: stdio, http, sse, websocket (default: stdio)
  --registry <type>   Package registry: npm, pypi (default: npm)
  --author <name>     Author name
  --description <d>   Server description
  --force             Overwrite existing directory
  --dry-run           Show what would be created
  --help              Show this help message

Examples:
  create-mcp-server my-api-server
  create-mcp-server my-server --template advanced --transport http
  create-mcp-server weather-mcp --description "Weather data API"
`);
}

// Generate package.json
function generatePackageJson(config: ServerConfig): string {
  const pkg = {
    name: `@mcp/${config.name}`,
    version: '1.0.0',
    description: config.description || `${config.name} MCP Server`,
    type: 'module',
    main: 'src/index.ts',
    scripts: {
      start: 'bun run src/index.ts',
      dev: 'bun run --watch src/index.ts',
      test: 'bun test',
      build: 'bun build src/index.ts --outdir dist',
    },
    dependencies: {
      '@modelcontextprotocol/sdk': '^0.5.0',
      zod: '^3.22.4',
    },
    devDependencies: {
      'bun-types': 'latest',
      typescript: '^5.0.0',
    },
    author: config.author || '',
    license: 'MIT',
    keywords: ['mcp', 'model-context-protocol', config.name],
  };

  return JSON.stringify(pkg, null, 2);
}

// Generate server.json
function generateServerJson(config: ServerConfig): string {
  const serverJson = {
    $schema: MCP_SCHEMA_VERSION,
    name: `ai.custom/${config.name}`,
    title: `${config.name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')} MCP Server`,
    description: config.description || `${config.name} MCP Server`,
    version: '1.0.0',
    repository: {
      url: `https://github.com/username/${config.name}`,
      source: 'github',
    },
    packages: [
      {
        registryType: config.registry,
        identifier: `@mcp/${config.name}`,
        version: '1.0.0',
        runtimeHint: 'bun',
        transport: { type: config.transport },
      },
    ],
    ...(config.transport !== 'stdio' && {
      remotes: [
        { type: config.transport, url: `https://your-domain.com/api/${config.name}` },
      ],
    }),
    _meta: {
      category: 'custom',
      tags: [config.name],
      capabilities: { tools: 0, prompts: 0, resources: 0 },
    },
  };

  return JSON.stringify(serverJson, null, 2);
}

// Generate tsconfig.json
function generateTsConfig(): string {
  const config = {
    compilerOptions: {
      target: 'ES2023',
      module: 'ESNext',
      moduleResolution: 'bundler',
      lib: ['ESNext'],
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      outDir: 'dist',
      declaration: true,
      types: ['bun-types'],
    },
    include: ['src/**/*'],
    exclude: ['node_modules', 'dist'],
  };

  return JSON.stringify(config, null, 2);
}

// Generate basic template
function generateBasicTemplate(config: ServerConfig): string {
  return `#!/usr/bin/env bun
/**
 * ${config.name} MCP Server
 * ${config.description || 'A custom MCP server'}
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// Define your tools
const TOOLS = [
  {
    name: 'hello_world',
    description: 'A simple hello world tool',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Name to greet',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'get_data',
    description: 'Get data from your service',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'ID of the data to fetch',
        },
      },
      required: ['id'],
    },
  },
];

// Create server instance
const server = new Server(
  {
    name: '${config.name}',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

// Call tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'hello_world': {
        const greeting = \`Hello, \${args?.name || 'World'}!\`;
        return {
          content: [{ type: 'text', text: greeting }],
        };
      }

      case 'get_data': {
        // Replace with your actual data fetching logic
        const data = {
          id: args?.id,
          timestamp: new Date().toISOString(),
          message: 'Sample data',
        };
        return {
          content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
        };
      }

      default:
        throw new Error(\`Unknown tool: \${name}\`);
    }
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: \`Error: \${error instanceof Error ? error.message : 'Unknown error'}\`,
      }],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('${config.name} MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
`;
}

// Generate advanced template
function generateAdvancedTemplate(config: ServerConfig): string {
  return `#!/usr/bin/env bun
/**
 * ${config.name} MCP Server (Advanced)
 * ${config.description || 'An advanced MCP server with prompts and resources'}
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// API Client for your service
class APIClient {
  private baseUrl: string;
  private timeout: number;

  constructor(baseUrl: string = 'https://api.example.com', timeout: number = 30000) {
    this.baseUrl = baseUrl.replace(/\\/$/, '');
    this.timeout = timeout;
  }

  async get(path: string, params?: Record<string, any>): Promise<any> {
    const url = new URL(\`\${this.baseUrl}\${path}\`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) url.searchParams.set(key, String(value));
      });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url.toString(), {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' },
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(\`HTTP \${response.status}: \${await response.text()}\`);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  async post(path: string, body: any): Promise<any> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(\`\${this.baseUrl}\${path}\`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(\`HTTP \${response.status}: \${await response.text()}\`);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }
}

const apiClient = new APIClient();

// Define tools
const TOOLS = [
  {
    name: 'search',
    description: 'Search for items',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        limit: { type: 'number', description: 'Max results', default: 10 },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_item',
    description: 'Get item by ID',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Item ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'create_item',
    description: 'Create a new item',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Item name' },
        data: { type: 'object', description: 'Item data' },
      },
      required: ['name'],
    },
  },
];

// Define prompts
const PROMPTS = [
  {
    name: 'analyze',
    description: 'Analyze data and provide insights',
    arguments: [
      { name: 'topic', description: 'Topic to analyze', required: true },
    ],
  },
  {
    name: 'summarize',
    description: 'Summarize content',
    arguments: [
      { name: 'content', description: 'Content to summarize', required: true },
      { name: 'length', description: 'Summary length (short/medium/long)', required: false },
    ],
  },
];

// Define resources
const RESOURCES = [
  {
    uri: '${config.name}://docs/api',
    name: 'API Documentation',
    description: 'API reference documentation',
    mimeType: 'text/markdown',
  },
  {
    uri: '${config.name}://config/settings',
    name: 'Settings',
    description: 'Server configuration settings',
    mimeType: 'application/json',
  },
];

// Create server
const server = new Server(
  {
    name: '${config.name}',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      prompts: {},
      resources: {},
    },
  }
);

// Tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'search':
        // Replace with actual API call
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ query: args?.query, results: [] }, null, 2),
          }],
        };

      case 'get_item':
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ id: args?.id, name: 'Sample Item' }, null, 2),
          }],
        };

      case 'create_item':
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ success: true, id: 'new-id', name: args?.name }, null, 2),
          }],
        };

      default:
        throw new Error(\`Unknown tool: \${name}\`);
    }
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: \`Error: \${error instanceof Error ? error.message : 'Unknown error'}\`,
      }],
      isError: true,
    };
  }
});

// Prompt handlers
server.setRequestHandler(ListPromptsRequestSchema, async () => ({ prompts: PROMPTS }));

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'analyze':
      return {
        messages: [{
          role: 'user',
          content: {
            type: 'text',
            text: \`Analyze the following topic and provide detailed insights: \${args?.topic}\`,
          },
        }],
      };

    case 'summarize':
      const length = args?.length || 'medium';
      return {
        messages: [{
          role: 'user',
          content: {
            type: 'text',
            text: \`Summarize the following content in a \${length} format:\\n\\n\${args?.content}\`,
          },
        }],
      };

    default:
      throw new Error(\`Unknown prompt: \${name}\`);
  }
});

// Resource handlers
server.setRequestHandler(ListResourcesRequestSchema, async () => ({ resources: RESOURCES }));

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  switch (uri) {
    case '${config.name}://docs/api':
      return {
        contents: [{
          uri,
          mimeType: 'text/markdown',
          text: '# API Documentation\\n\\n## Tools\\n\\n- search: Search for items\\n- get_item: Get item by ID\\n- create_item: Create new item',
        }],
      };

    case '${config.name}://config/settings':
      return {
        contents: [{
          uri,
          mimeType: 'application/json',
          text: JSON.stringify({ version: '1.0.0', environment: 'production' }, null, 2),
        }],
      };

    default:
      throw new Error(\`Unknown resource: \${uri}\`);
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('${config.name} MCP server (advanced) running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
`;
}

// Generate streaming template
function generateStreamingTemplate(config: ServerConfig): string {
  return `#!/usr/bin/env bun
/**
 * ${config.name} MCP Server (Streaming)
 * ${config.description || 'An MCP server with HTTP/SSE transport'}
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// Define tools
const TOOLS = [
  {
    name: 'stream_data',
    description: 'Stream data in real-time',
    inputSchema: {
      type: 'object',
      properties: {
        topic: { type: 'string', description: 'Topic to stream' },
        duration: { type: 'number', description: 'Stream duration in seconds', default: 10 },
      },
      required: ['topic'],
    },
  },
];

// Create server
const server = new Server(
  {
    name: '${config.name}',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'stream_data':
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            topic: args?.topic,
            message: 'Streaming started',
            timestamp: new Date().toISOString(),
          }, null, 2),
        }],
      };

    default:
      throw new Error(\`Unknown tool: \${name}\`);
  }
});

// HTTP Server for SSE/HTTP transport
const PORT = process.env.PORT || 3001;

Bun.serve({
  port: PORT,
  async fetch(req: Request) {
    const url = new URL(req.url);

    // Health check
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'healthy' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // MCP endpoint
    if (url.pathname === '/mcp' && req.method === 'POST') {
      try {
        const body = await req.json();
        // Route to appropriate handler based on method
        let result: any;

        if (body.method === 'tools/list') {
          result = { tools: TOOLS };
        } else if (body.method === 'tools/call') {
          const { name, arguments: args } = body.params;
          // Handle tool call
          result = {
            content: [{
              type: 'text',
              text: JSON.stringify({ name, args, timestamp: new Date().toISOString() }),
            }],
          };
        } else {
          throw new Error(\`Unknown method: \${body.method}\`);
        }

        return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result }), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error) {
        return new Response(JSON.stringify({
          jsonrpc: '2.0',
          error: { code: -32603, message: error instanceof Error ? error.message : 'Unknown error' },
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // SSE endpoint for streaming
    if (url.pathname === '/mcp/stream') {
      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          let count = 0;

          const interval = setInterval(() => {
            const event = {
              type: 'heartbeat',
              timestamp: new Date().toISOString(),
              count: ++count,
            };
            controller.enqueue(encoder.encode(\`data: \${JSON.stringify(event)}\\n\\n\`));

            if (count >= 100) {
              clearInterval(interval);
              controller.close();
            }
          }, 1000);
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    return new Response('Not Found', { status: 404 });
  },
});

console.error(\`${config.name} MCP server (streaming) running on port \${PORT}\`);
console.error(\`  HTTP endpoint: http://localhost:\${PORT}/mcp\`);
console.error(\`  SSE endpoint: http://localhost:\${PORT}/mcp/stream\`);
`;
}

// Generate README
function generateReadme(config: ServerConfig): string {
  return `# ${config.name} MCP Server

${config.description || 'A custom MCP server.'}

## Installation

\`\`\`bash
bun install
\`\`\`

## Usage

### Stdio Transport (default)

\`\`\`bash
bun run start
\`\`\`

### With Claude Desktop

Add to your Claude Desktop config (\`~/.config/claude-desktop/config.json\`):

\`\`\`json
{
  "mcpServers": {
    "${config.name}": {
      "command": "bun",
      "args": ["run", "/path/to/${config.name}/src/index.ts"]
    }
  }
}
\`\`\`

## Development

\`\`\`bash
# Watch mode
bun run dev

# Run tests
bun test

# Build
bun run build
\`\`\`

## Tools

| Tool | Description |
|------|-------------|
| hello_world | A simple hello world tool |
| get_data | Get data from your service |

## Publishing to MCP Registry

1. Update \`server.json\` with your information
2. Run: \`mcp-publisher --file server.json\`

## License

MIT
`;
}

// Generate .gitignore
function generateGitignore(): string {
  return `node_modules/
dist/
*.log
.env
.env.local
.DS_Store
`;
}

// Main function
async function main() {
  const args = process.argv.slice(2);
  const config = parseArgs(args);

  if (!config.name) {
    console.error('Error: Server name is required');
    console.error('Usage: create-mcp-server <name> [options]');
    console.error('Run with --help for more information');
    process.exit(1);
  }

  // Validate name
  if (!/^[a-z0-9-]+$/.test(config.name)) {
    console.error('Error: Server name must be lowercase alphanumeric with dashes');
    process.exit(1);
  }

  const targetDir = path.resolve(process.cwd(), config.name);

  console.log('\nMCP Server Template Generator');
  console.log('============================\n');
  console.log(`Creating: ${config.name}`);
  console.log(`Template: ${config.template}`);
  console.log(`Transport: ${config.transport}`);
  console.log(`Directory: ${targetDir}\n`);

  // Check if directory exists
  if (fs.existsSync(targetDir) && !config.force) {
    console.error(`Error: Directory '${config.name}' already exists`);
    console.error('Use --force to overwrite');
    process.exit(1);
  }

  const files: { path: string; content: string }[] = [
    { path: 'package.json', content: generatePackageJson(config) },
    { path: 'server.json', content: generateServerJson(config) },
    { path: 'tsconfig.json', content: generateTsConfig() },
    { path: 'README.md', content: generateReadme(config) },
    { path: '.gitignore', content: generateGitignore() },
  ];

  // Add template-specific index.ts
  switch (config.template) {
    case 'advanced':
      files.push({ path: 'src/index.ts', content: generateAdvancedTemplate(config) });
      break;
    case 'streaming':
      files.push({ path: 'src/index.ts', content: generateStreamingTemplate(config) });
      break;
    default:
      files.push({ path: 'src/index.ts', content: generateBasicTemplate(config) });
  }

  if (config.dryRun) {
    console.log('Dry run - files that would be created:\n');
    for (const file of files) {
      console.log(`  ${file.path} (${file.content.length} bytes)`);
    }
    console.log('\nRun without --dry-run to create files');
    return;
  }

  // Create directory structure
  fs.mkdirSync(targetDir, { recursive: true });
  fs.mkdirSync(path.join(targetDir, 'src'), { recursive: true });

  // Write files
  for (const file of files) {
    const filePath = path.join(targetDir, file.path);
    fs.writeFileSync(filePath, file.content);
    console.log(`  Created: ${file.path}`);
  }

  console.log('\nDone! Next steps:\n');
  console.log(`  cd ${config.name}`);
  console.log('  bun install');
  console.log('  bun run dev');
  console.log('\nTo publish to MCP Registry:');
  console.log('  mcp-publisher --file server.json\n');
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});