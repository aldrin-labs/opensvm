# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an MCP (Model Context Protocol) server that provides access to the Prediction Market Metadata API. The server wraps the REST API defined in `llms_dflow.json` and exposes it as MCP tools for use with Claude Desktop, Cursor, and other MCP clients.

**Base API URL**: `https://prediction-markets-api.dflow.net`

## Commands

### Development
```bash
# Start server in development mode with hot reload
bun run dev

# Start server in production mode
bun start

# Build the project
bun run build

# Run tests
bun run test
```

### Running the server directly
```bash
bun run src/index.ts
```

## Architecture

### Single-File MCP Server

The entire server implementation is contained in `src/index.ts`. This is intentional for simplicity - the server is a thin wrapper around the external API.

**Key components:**

1. **DFlowAPIClient** (lines 23-85): HTTP client that handles all API communication
   - Implements request timeout handling (30s default)
   - Constructs URLs with query parameters
   - Handles GET and POST requests
   - Returns parsed JSON responses

2. **TOOLS array** (lines 103-696): Complete tool definitions
   - Each tool maps to one API endpoint
   - Tool definitions include JSON schemas for parameter validation
   - Organized by endpoint category (events, markets, trades, forecasts, candlesticks, live data, series, utilities)

3. **Request handlers** (lines 698-849):
   - `ListToolsRequestSchema`: Returns all available tools
   - `CallToolRequestSchema`: Routes tool calls to appropriate API endpoints using a large switch statement
   - Error handling returns descriptive messages

### API Endpoint Categories

The server exposes 25 tools across 8 categories:

- **Events**: Get individual events, paginated event lists, search events
- **Markets**: Get markets by ticker or mint address, batch queries
- **Trades**: Query trade history with filtering and pagination
- **Forecasts**: Historical forecast percentile data
- **Candlesticks**: OHLC data for events and markets
- **Live Data**: Real-time milestone information
- **Series**: Series templates and metadata
- **Utilities**: Outcome mints, filtering, tags, and search

### MCP Transport

The server uses **stdio transport** (line 853), which is the standard for MCP servers. This means:
- Communication happens over stdin/stdout
- The server must be launched as a subprocess by the MCP client
- No HTTP server or network configuration needed

## Project Structure

```
api/
├── src/                    # Source code
│   ├── index.ts           # Main MCP server implementation
│   ├── server.ts          # Simple server wrapper
│   └── web-server.ts      # Web server for playground
├── public/                 # Static assets
│   ├── index.html         # API playground UI
│   ├── icon.png           # App icon
│   └── icon.svg           # SVG icon
├── docs/                   # Documentation
│   ├── AGENTS.md          # Agent documentation
│   ├── NETLIFY.md         # Netlify deployment guide
│   ├── llms.txt           # LLM-friendly API docs
│   └── llms_dflow.json    # OpenAPI specification
├── netlify/               # Netlify functions
│   └── functions/         # Serverless functions
├── tests/                 # Test files
│   ├── server.test.ts     # Unit tests
│   └── integration/       # Integration tests
├── .smithery/             # Smithery build artifacts
├── package.json           # Dependencies
├── smithery.yaml          # Smithery configuration
├── netlify.toml           # Netlify configuration
└── tsconfig.json          # TypeScript config
```

## Configuration Files

- **package.json**: Dependencies include `@modelcontextprotocol/sdk` for MCP protocol implementation
- **tsconfig.json**: Standard TypeScript config targeting ES2022 with ESNext modules and bundler resolution
- **docs/llms_dflow.json**: OpenAPI specification for the underlying REST API (documentation reference)
- **bun.lock**: Bun's lockfile (not bun.lockb, this is a text-based lock format)
- **.gitignore**: Standard Node.js gitignore that excludes node_modules, dist, logs, and environment files

## Tool Implementation Pattern

When adding or modifying tools, follow this pattern:

1. Add tool definition to `TOOLS` array with name, description, and `inputSchema`
2. Add corresponding case to the switch statement in the `CallToolRequestSchema` handler
3. Use `apiClient.get()` or `apiClient.post()` to make the API request
4. Extract path parameters from args and pass remaining args as query params or request body

Example:
```typescript
// Tool definition
{
  name: 'get_event',
  description: 'Get a single event by ticker',
  inputSchema: {
    type: 'object',
    properties: {
      event_id: { type: 'string', description: 'Event ticker' },
      withNestedMarkets: { type: 'boolean', description: 'Include nested markets' }
    },
    required: ['event_id']
  }
}

// Handler implementation
case 'get_event':
  result = await apiClient.get(`/api/v1/event/${args.event_id}`, {
    withNestedMarkets: args.withNestedMarkets,
  });
  break;
```

## Testing the Server

To test the server manually with MCP client configuration (e.g., Claude Desktop):

```json
{
  "mcpServers": {
    "dflow-mcp": {
      "command": "bun",
      "args": ["run", "/absolute/path/to/dflow-mcp/src/index.ts"]
    }
  }
}
```

## Key Technical Details

- **Runtime**: Designed for Bun but compatible with Node.js 18+
- **MCP SDK Version**: `@modelcontextprotocol/sdk` ^0.5.0
- **Request Timeout**: 30 seconds (configurable via `DEFAULT_TIMEOUT`)
- **Error Handling**: HTTP errors and timeouts are caught and returned as MCP error responses
- **JSON Serialization**: Handles BigInt values by converting to strings
