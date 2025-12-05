# OpenSVM MCP Server

AI-powered Solana blockchain explorer exposed as an MCP (Model Context Protocol) server. This allows AI agents like Claude to explore blockchain data, analyze transactions, and query market information.

## Features

- **25 specialized tools** for Solana blockchain exploration
- **Autonomous investigation agent** for forensics and anomaly detection
- **Real-time streaming** via WebSocket and SSE transports
- **Authentication support** with API keys and wallet sessions
- **4 pre-built prompts** for common analysis workflows
- **3 live resources** for network data
- Works with Claude Desktop, Cursor, and other MCP clients

## Unified MCP Server (NEW)

The **OpenSVM Unified MCP Server** consolidates all 8 MCP servers into a single server with **87 namespaced tools**:

| Namespace | Description | Tools |
|-----------|-------------|-------|
| `solana:*` | Blockchain exploration | 14 |
| `dflow:*` | DFlow prediction markets | 21 |
| `kalshi:*` | Kalshi prediction markets | 22 |
| `lp:*` | Liquidity mining | 15 |
| `governance:*` | Governance timelock | 15 |
| `bank:*` | OpenSVM Bank | 3 |

### Quick Start (Unified)

```json
{
  "mcpServers": {
    "opensvm-unified": {
      "command": "bun",
      "args": ["run", "/path/to/opensvm/api/src/opensvm-mcp-unified.ts"]
    }
  }
}
```

### Available Prompts

- `investigate_wallet` - Comprehensive wallet investigation
- `analyze_market` - Prediction market analysis
- `optimize_liquidity` - LP position optimization
- `governance_review` - Governance action review
- `portfolio_overview` - Combined portfolio summary

### Available Resources

- `opensvm://namespaces` - List all namespaces
- `opensvm://tools/summary` - Tool summary by namespace
- `opensvm://solana/network-status` - Solana network status
- `opensvm://kalshi/exchange-status` - Kalshi exchange status

## Quick Start

### Manual Installation

Add to your Claude Desktop config (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "opensvm": {
      "command": "bun",
      "args": ["run", "/path/to/opensvm/api/src/opensvm-mcp.ts"]
    }
  }
}
```

### With API Key Authentication

```json
{
  "mcpServers": {
    "opensvm": {
      "command": "bun",
      "args": ["run", "/path/to/opensvm/api/src/opensvm-mcp.ts"],
      "env": {
        "OPENSVM_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

### HTTP Endpoint

The server is also available as an HTTP endpoint:
- **URL**: `https://dflow.opensvm.com/api/opensvm-mcp`
- **Protocol**: JSON-RPC 2.0

## Authentication

### Getting an API Key (3-Step Process)

**Step 1: Create API Key** (no auth required)

```bash
# Via bash script
./scripts/create-api-key.sh "My MCP Bot"

# Or via curl
curl -X POST https://osvm.ai/api/auth/api-keys/create \
  -H "Content-Type: application/json" \
  -d '{"name": "My MCP Bot", "generateAuthLink": true}'
```

**Response:**
```json
{
  "success": true,
  "rawKey": "osvm_abc123...",        // SAVE THIS - shown once only!
  "authLink": "https://osvm.ai/auth/bind?token=xyz...",
  "apiKey": { "id": "...", "status": "pending" }
}
```

**Step 2: Bind Your Wallet** (browser required)
1. Open the `authLink` in your browser
2. Connect your Solana wallet (Phantom, Solflare, etc.)
3. Sign the message to authorize
4. Key status changes from "pending" → "active"

**Step 3: Configure MCP with API Key**

```json
{
  "mcpServers": {
    "opensvm": {
      "command": "bun",
      "args": ["run", "/path/to/api/src/opensvm-mcp.ts"],
      "env": {
        "OPENSVM_API_KEY": "osvm_abc123..."
      }
    }
  }
}
```

Or pass via config:
```yaml
apiUrl: "https://osvm.ai"
apiKey: "osvm_abc123..."
```

### Auth Methods Summary

| Method | Use Case | Duration | Requires Browser |
|--------|----------|----------|------------------|
| **API Key** | MCP, CLI, bots | Until revoked | Once (to bind wallet) |
| **Wallet Session** | Browser UI | 7 days | Yes |
| **Token Gating** | Premium features | Real-time | No |

### Token Gating ($SVMAI)

Premium features require **100,000 SVMAI tokens**:
- Profile history access
- Social features (follow, like)
- Enhanced rate limits

Check access with:
```bash
curl https://osvm.ai/api/check-token?address=YOUR_WALLET
```

## Available Tools

### Transaction Tools
| Tool | Description |
|------|-------------|
| `get_transaction` | Get full transaction details by signature |
| `explain_transaction` | Get AI-powered explanation of a transaction |
| `analyze_transaction` | Deep analysis of transaction patterns |

### Account Tools
| Tool | Description |
|------|-------------|
| `get_account_portfolio` | Get wallet holdings and USD values |
| `get_account_transactions` | Get recent account activity |
| `get_account_stats` | Get account statistics |

### Block Tools
| Tool | Description |
|------|-------------|
| `get_blocks` | Get list of recent blocks |
| `get_block` | Get specific block by slot number |

### Market Data Tools
| Tool | Description |
|------|-------------|
| `get_token_ohlcv` | Get candlestick data with MA7, MA25, MACD |
| `get_token_markets` | Get DEX pools for a token |
| `get_token_metadata` | Get token information |

### Program Tools
| Tool | Description |
|------|-------------|
| `get_program` | Get program info and IDL |

### Search & Discovery
| Tool | Description |
|------|-------------|
| `search` | Search for anything on Solana |
| `find_wallet_path` | Find connection path between wallets |

### Analytics
| Tool | Description |
|------|-------------|
| `get_network_status` | Get Solana network health |
| `get_nft_collections` | Get trending NFT collections |

### AI Analysis
| Tool | Description |
|------|-------------|
| `ask_ai` | Ask questions about Solana |
| `investigate` | Autonomous forensics investigation |

### Authentication & Account
| Tool | Description |
|------|-------------|
| `create_api_key` | Create new API key for authenticated access |
| `list_api_keys` | List your API keys |
| `get_api_key_metrics` | Get usage metrics for API keys |
| `check_session` | Check authentication status |
| `get_user_history` | Get wallet's page/tx history (requires auth) |
| `get_user_profile` | Get public wallet profile |
| `check_svmai_access` | Check if wallet has premium access |

## Pre-built Prompts

- **analyze_wallet** - Comprehensive wallet analysis
- **investigate_transaction** - Deep transaction investigation
- **token_analysis** - Token price and liquidity analysis
- **find_connection** - Find wallet connections

## Example Usage

### Get Transaction Details
```json
{
  "method": "tools/call",
  "params": {
    "name": "get_transaction",
    "arguments": {
      "signature": "5J7H..."
    }
  }
}
```

### Analyze a Wallet
```json
{
  "method": "tools/call",
  "params": {
    "name": "get_account_portfolio",
    "arguments": {
      "address": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
    }
  }
}
```

### Get Token Price Data
```json
{
  "method": "tools/call",
  "params": {
    "name": "get_token_ohlcv",
    "arguments": {
      "mint": "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
      "type": "1H"
    }
  }
}
```

## Streaming Server (WebSocket + SSE)

For real-time updates and long-running investigations, use the streaming server:

### Start Streaming Server

```bash
cd api
bun run start:streaming  # Default port 3001

# Or with hot reload
bun run dev:streaming
```

### Transports

| Transport | URL | Use Case |
|-----------|-----|----------|
| **WebSocket** | `ws://localhost:3001/ws` | Bidirectional MCP communication |
| **SSE** | `http://localhost:3001/stream/:id` | Subscribe to investigation events |
| **JSON-RPC** | `http://localhost:3001/` | Standard request/response |

### Streaming Investigation

Start an investigation with real-time event streaming:

```bash
# Using curl with SSE
curl -N -X POST http://localhost:3001/investigate/stream \
  -H "Content-Type: application/json" \
  -d '{"target": "EPjFWdd5...", "type": "wallet_forensics"}'
```

Events returned:
- `start` - Investigation started
- `progress` - Status updates
- `tool_call` - Tool being called
- `tool_result` - Tool results
- `anomaly` - Suspicious activity detected
- `finding` - Investigation finding
- `report` - Final report generated
- `complete` - Investigation finished
- `error` - Error occurred

### WebSocket Example

```javascript
const ws = new WebSocket('ws://localhost:3001/ws');

// List tools
ws.send(JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/list'
}));

// Subscribe to investigation
ws.send(JSON.stringify({
  jsonrpc: '2.0',
  id: 2,
  method: 'subscribe',
  params: { investigationId: 'inv_123' }
}));

// Receive events
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  console.log(msg);
};
```

### Client Examples

See `examples/` directory for complete client examples:
- `websocket-client.ts` - WebSocket client
- `sse-client.ts` - SSE streaming client
- `curl-examples.sh` - curl command examples

## Development

```bash
# Run the stdio MCP server locally
cd api
bun run start:opensvm

# Or with hot reload
bun run dev:opensvm

# Run streaming server (WebSocket + SSE)
bun run start:streaming
bun run dev:streaming
```

## API Base URL

The server connects to the OpenSVM API at:
- Production: `https://osvm.ai`
- Configurable via `apiUrl` parameter

## License

MIT - Built by OpenSVM
