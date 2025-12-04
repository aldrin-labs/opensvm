# OpenSVM MCP Servers

This directory contains two MCP (Model Context Protocol) servers built by [OpenSVM](https://osvm.ai):

## 1. OpenSVM MCP Server (NEW)

AI-powered Solana blockchain explorer with **17 tools** for:
- Transaction analysis and AI explanations
- Wallet portfolio and activity tracking
- Block exploration
- Token market data (OHLCV with technical indicators)
- Wallet path finding
- NFT collections
- And more!

**See:** [OPENSVM-MCP-README.md](./OPENSVM-MCP-README.md)

```bash
# Install via Smithery
npx @smithery/cli install opensvm-mcp-server --client claude

# Or run directly
bun run start:opensvm
```

---

## 2. DFlow MCP Server

[![smithery badge](https://smithery.ai/badge/@openSVM/dflow-mcp)](https://smithery.ai/server/@openSVM/dflow-mcp)

Access [Kalshi](https://kalshi.com) prediction market data - the first CFTC-regulated exchange for trading on real-world events. 23 tools for events, markets, trades, forecasts, candlesticks and live data.

**Demo:** [https://dflow.opensvm.com](https://dflow.opensvm.com)

## Features

This MCP server provides access to the complete Prediction Market Metadata API including:

- **Event Management**: Get events, search events, retrieve event metadata
- **Market Data**: Market information, batch queries, market lookups by mint
- **Trading Data**: Trade history, trades by market, pagination support
- **Forecast Analytics**: Forecast percentile history, time series data
- **Candlestick Data**: OHLC data for events and markets
- **Live Data**: Real-time data feeds, milestone information
- **Series Information**: Series templates, categories, and metadata
- **Utility Functions**: Outcome mint queries, filtering, and search capability

## Installation

### Method 1: Install via Smithery (Recommended)

The easiest way to install this MCP server is through [Smithery](https://smithery.ai):

```bash
npx @smithery/cli install dflow-mcp-server --client claude
```

This will automatically configure the server for use with Claude Desktop.

### Method 2: Manual Installation

#### Prerequisites
- [Bun](https://bun.sh/) (recommended) or Node.js 18+

#### Install Dependencies
```bash
bun install
```

## Usage

### Starting the Server

```bash
# Development mode (with hot reload)
bun run dev

# Production mode
bun start

# Or directly with Bun
bun run src/index.ts
```

The server uses stdio transport for MCP communication, which is the standard for MCP clients.

### Integration with MCP Clients

#### Claude Desktop

If you installed via Smithery, the configuration is automatic. For manual setup, add this to your Claude Desktop config:

```json
{
  "mcpServers": {
    "dflow-mcp": {
      "command": "bun",
      "args": ["run", "/path/to/dflow-mcp/src/index.ts"]
    }
  }
}
```

#### Other MCP Clients

This server is compatible with any MCP client (Cursor, Continue, etc.). Use the same configuration format as above.

## Available Tools

### Event Tools
- `get_event` - Get a single event by ticker
- `get_events` - Get paginated list of all events

### Market Tools
- `get_market` - Get market details by ticker
- `get_market_by_mint` - Get market by mint address
- `get_markets` - Get paginated list of markets
- `get_markets_batch` - Get multiple markets (up to 100)

### Trade Tools
- `get_trades` - Get trades across markets
- `get_trades_by_mint` - Get trades for specific market

### Analytics Tools
- `get_forecast_percentile_history` - Get forecast history
- `get_forecast_percentile_history_by_mint` - Forecast history by mint
- `get_event_candlesticks` - Event candlestick data
- `get_market_candlesticks` - Market candlestick data
- `get_market_candlesticks_by_mint` - Candlesticks by mint

### Live Data Tools
- `get_live_data` - Get live data for milestones
- `get_live_data_by_event` - Live data for event
- `get_live_data_by_mint` - Live data by mint

### Series Tools
- `get_series` - Get all series templates
- `get_series_by_ticker` - Get specific series

### Utility Tools
- `get_outcome_mints` - Get outcome mint addresses
- `filter_outcome_mints` - Filter addresses to outcome mints
- `get_tags_by_categories` - Get category-tag mapping
- `get_filters_by_sports` - Get sports filtering options
- `search_events` - Search events by title/ticker

## Example Tool Calls

### Get a specific event
```json
{
  "tool": "get_event",
  "arguments": {
    "event_id": "US-PRESIDENT-2024",
    "withNestedMarkets": true
  }
}
```

### Get market by mint address
```json
{
  "tool": "get_market_by_mint",
  "arguments": {
    "mint_address": "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM"
  }
}
```

### Get forecast history
```json
{
  "tool": "get_forecast_percentile_history",
  "arguments": {
    "series_ticker": "US-PRESIDENT",
    "event_id": "US-PRESIDENT-2024",
    "percentiles": "25,50,75",
    "startTs": 1704067200,
    "endTs": 1706745600,
    "periodInterval": 3600
  }
}
```

### Search events
```json
{
  "tool": "search_events",
  "arguments": {
    "q": "election",
    "limit": 10,
    "sort": "volume",
    "order": "desc"
  }
}
```

## Development

### Project Structure
```
dflow-mcp/
├── src/
│   └── index.ts          # Main server implementation
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
├── llms_dflow.json       # API specification
└── README.md             # This file
```

### Building
```bash
bun run build
```

### Testing
```bash
bun run test
```

## API Details

The server implements the complete REST API defined in `llms_dflow.json` with the following base URL:

```
https://prediction-markets-api.dflow.net
```

All tools include comprehensive parameter validation and type definitions. Error handling returns informative messages for debugging.

## Publishing to Smithery

This server is configured for publication on [Smithery](https://smithery.ai), the MCP server registry.

### Configuration Files

- `smithery.yaml` - Defines the runtime (TypeScript) and target (local)
- `package.json` - Includes module entry point and Smithery CLI scripts

### To Publish

1. Ensure your code is pushed to a public GitHub repository
2. Visit [smithery.ai/new](https://smithery.ai/new)
3. Connect your GitHub repository
4. Smithery will automatically detect the `smithery.yaml` configuration

Once published, users can install your server with:
```bash
npx @smithery/cli install dflow-mcp-server --client claude
```

## License

MIT License - See LICENSE file for details.

---

**OpenSVM × Kalshi × DFlow**