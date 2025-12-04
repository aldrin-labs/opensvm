# AGENTS.md

This document helps agents work effectively with the DFlow MCP Server repository.

## Project Overview

This is a Model Context Protocol (MCP) server that provides access to the Prediction Market Metadata API defined in `llms_dflow.json`. The server implements a complete JSON-RPC interface with 23 tools covering events, markets, trades, forecasts, live data, and analytics.

## Essential Commands

### Development
```bash
# Install dependencies
bun install

# Development mode with hot reload
bun run dev

# Start production server
bun start

# TypeScript compilation check
bun run tsc --noEmit

# Build for distribution
bun run build
```

### Testing
```bash
# Run comprehensive server test
./test-server.sh

# Run TypeScript tests
bun run test
```

## Project Structure

```
dflow-mcp/
├── src/
│   └── index.ts              # Main MCP server implementation
├── tests/
│   └── server.test.ts        # TypeScript test suite
├── .github/workflows/
│   └── test.yml              # CI/CD pipeline
├── package.json              # Dependencies and scripts
├── tsconfig.json             # TypeScript configuration
├── README.md                 # User documentation
├── llms_dflow.json           # API specification (source of truth)
├── AGENTS.md                 # This file (agent documentation)
└── test-server.sh            # Quick server validation script
```

## Code Organization

### Main Server (`src/index.ts`)

- **DFlowAPIClient**: HTTP client for API communication with timeout handling
- **Server Setup**: MCP server configuration and initialization
- **Tool Definitions**: 23 MCP tools mapped from OpenAPI specification
- **Request Handling**: JSON-RPC request routing and response formatting

### Key Components

1. **API Client**: Handles HTTP requests to `https://api.llm.dflow.org`
2. **Tool Registry**: Maps OpenAPI endpoints to MCP tools
3. **Type Safety**: TypeScript interfaces for all request/response types
4. **Error Handling**: Comprehensive error catching and MCP-formatted responses

## Tool Categories

### Event Management (4 tools)
- `get_event` - Single event by ticker
- `get_events` - Paginated event list with filtering
- `search_events` - Search by title/ticker
- `get_live_data_by_event` - Live data for event

### Market Operations (6 tools)
- `get_market` - Market by ticker
- `get_market_by_mint` - Market by mint address
- `get_markets` - Paginated markets with filters
- `get_markets_batch` - Batch market lookup (up to 100)
- `get_market_candlesticks` - OHLC data for market
- `get_market_candlesticks_by_mint` - Candlesticks by mint

### Trade & Analytics (4 tools)
- `get_trades` - Trades across markets
- `get_trades_by_mint` - Trades for specific market
- `get_forecast_percentile_history` - Forecast analytics
- `get_forecast_percentile_history_by_mint` - Forecast by mint

### Live Data & Series (5 tools)
- `get_live_data` - Live data for milestones
- `get_live_data_by_mint` - Live data by mint
- `get_series` - All series templates
- `get_series_by_ticker` - Series by ticker
- `get_event_candlesticks` - Event candlesticks

### Utilities (4 tools)
- `get_outcome_mints` - Outcome mint addresses
- `filter_outcome_mints` - Filter addresses to outcome mints
- `get_tags_by_categories` - Category-tag mapping
- `get_filters_by_sports` - Sports filtering options

## API Reference

### Base Configuration
- **API URL**: `https://api.llm.dflow.org`
- **Timeout**: 30 seconds (configurable)
- **Transport**: MCP stdio (JSON-RPC 2.0)

### Request/Response Pattern
- All tools accept JSON-RPC requests with validated input schemas
- Responses are formatted as MCP text content with JSON strings
- Errors return formatted error messages with context

### Authentication
- Current API implementation does not require authentication
- If auth is added later, configure in DFlowAPIClient headers

## Development Patterns

### Adding New Tools

1. **Define Tool Schema**: Add to TOOLS array in server setup
2. **Implement Handler**: Add case in main switch statement
3. **Map API Endpoint**: Use DFlowAPIClient methods
4. **Validate Parameters**: MCP handles schema validation

Example pattern:
```typescript
{
  name: 'new_endpoint',
  description: 'Description of the tool',
  inputSchema: {
    type: 'object',
    properties: {
      param1: { type: 'string', description: 'Param description' }
    },
    required: ['param1']
  }
}
```

### Error Handling

- Use try-catch blocks for API calls
- Format errors as MCP text content with `isError: true`
- Include context about which tool failed
- Preserve original error messages for debugging

### Type Safety

- All tool parameters should be typed in inputSchema
- Use type guards for complex parameter validation
- Maintain consistent naming between API and tools

## Code Style Conventions

### TypeScript
- Use strict TypeScript settings (configured in tsconfig.json)
- Import statements at top, grouped by type
- Explicit return types for public functions
- Use `const` by default, `let` only when necessary

### Naming
- **Tool names**: snake_case with descriptive names
- **Parameters**: snake_case matching API specification
- **Variables**: camelCase for local variables
- **Functions**: camelCase with descriptive verbs

### Documentation
- Tool descriptions should explain purpose and expected response
- Parameter descriptions should include units and constraints
- Include examples for complex tools in README

## Testing Approach

### Manual Testing
```bash
# Quick validation
./test-server.sh

# Direct tool testing
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_events","arguments":{}}}' | bun run src/index.ts
```

### Integration Testing
- Test MCP protocol compliance
- Validate JSON schemas
- Test error handling scenarios
- Verify API endpoint mapping

## Common Issues & Solutions

### Server Not Responding
- Check TypeScript compilation with `bun run tsc --noEmit`
- Ensure all dependencies installed with `bun install`
- Verify stdio transport is working (common in CI environments)

### Tool Parameter Validation
- MCP handles schema validation automatically
- Missing required parameters return validation errors
- Invalid types are caught before API calls

### API Rate Limits
- Current API doesn't have documented rate limits
- Monitor response headers for rate limit information
- Implement exponential backoff if needed

## Deployment Considerations

### Development
- Use `bun run dev` for hot reloading during development
- Server communicates via stdio, not HTTP server
- Test with actual MCP client (Claude Desktop, Cursor)

### Production
- Build with `bun run build` for optimized bundle
- Use `bun start` for production execution
- Monitor server startup and connection handling

### CI/CD
- GitHub Actions workflow in `.github/workflows/test.yml`
- Tests compilation and basic server functionality
- Can add integration tests with mock API responses

## API Specification Source

The API specification in `llms_dflow.json` is the single source of truth:
- OpenAPI 3.0 format
- Complete with schemas, parameters, and responses
- All tools derived from this specification
- Update tools when API specification changes

## Future Enhancements

### Potential Additions
- WebSocket support for real-time data
- Caching layer for frequently accessed data
- Pagination helpers for large datasets
- Rate limiting and retry logic
- Authentication token management

### Scaling Considerations
- Connection pooling for high-volume usage
- Response compression for large payloads
- Request deduplication for concurrent calls
- Health check endpoints for monitoring

## Agent-Specific Tips

When working with this repository:

1. **Always test after changes**: Run `./test-server.sh` to validate
2. **Check API specification**: Reference `llms_dflow.json` for endpoint details
3. **Maintain type safety**: Use TypeScript strict mode
4. **Follow MCP patterns**: Standard JSON-RPC 2.0 with stdio transport
5. **Document new tools**: Update README.md and AGENTS.md when adding tools

The server is designed to be a direct, type-safe wrapper around the Prediction Market API with comprehensive MCP protocol support.