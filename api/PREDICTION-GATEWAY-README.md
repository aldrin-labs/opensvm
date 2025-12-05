# Prediction Markets Gateway MCP Server

A comprehensive Model Context Protocol (MCP) server that provides unified access to prediction markets across multiple platforms, with paper trading, AI analysis, and multi-agent debate capabilities.

## Features

### 1. Market Data & Aggregation
Real-time data from 4 platforms:
- **Kalshi** - CFTC-regulated, US-focused
- **Polymarket** - Crypto-native, global
- **Manifold Markets** - Play money, global
- **Drift** - On-chain Solana markets

### 2. Paper Trading
Simulated trading with full portfolio management:
- Create accounts with configurable starting balance
- Buy/sell YES and NO contracts
- Track positions and P&L
- View trade history

### 3. Automated Trading Strategies
Run AI-driven trading strategies:
- **Arbitrage** - Cross-platform price differences
- **Mean Reversion** - Trade extreme probabilities
- **Momentum** - Follow price trends
- **Contrarian** - Fade crowd consensus

### 4. Alert System
Monitor markets for:
- Price above/below thresholds
- Volume spikes
- Real-time checking

### 5. AI Market Intelligence
LLM-powered analysis (requires `TOGETHER_API_KEY`):
- Deep market analysis
- Platform comparisons
- Daily/arbitrage/trending reports

### 6. Multi-Agent Debate
Adversarial AI debate for probability estimation:
- Bull agent (optimistic case)
- Bear agent (pessimistic case)
- Synthesizer agent (final probability)

## Installation

### Prerequisites
- [Bun](https://bun.sh/) runtime
- Optional: `TOGETHER_API_KEY` for AI features

### Setup

```bash
cd api
bun install
```

### Running the Server

```bash
# Direct execution
bun run bin/prediction-gateway-mcp.ts

# With AI features
TOGETHER_API_KEY=your-key bun run bin/prediction-gateway-mcp.ts
```

## Configuration

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "prediction-markets": {
      "command": "bun",
      "args": ["run", "/path/to/opensvm/api/bin/prediction-gateway-mcp.ts"],
      "env": {
        "TOGETHER_API_KEY": "your-api-key"
      }
    }
  }
}
```

### Cursor

Add to MCP settings:

```json
{
  "mcpServers": {
    "prediction-markets": {
      "command": "bun",
      "args": ["run", "/path/to/opensvm/api/bin/prediction-gateway-mcp.ts"]
    }
  }
}
```

## Tools Reference

### Market Data Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `get_markets` | Fetch markets from all platforms | `limit`, `platform?` |
| `search_markets` | Search markets by keyword | `query`, `platform?` |
| `get_market` | Get specific market details | `platform`, `marketId` |
| `find_arbitrage` | Find cross-platform arbitrage | `minSpread?` |
| `get_trending` | Get trending topics | - |

### Paper Trading Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `create_trading_account` | Create paper account | `accountId`, `initialBalance?` |
| `get_portfolio` | View portfolio & positions | `accountId` |
| `place_trade` | Execute paper trade | `accountId`, `platform`, `marketId`, `side`, `action`, `quantity` |
| `get_trade_history` | View trade history | `accountId`, `limit?` |
| `run_strategy` | Run trading strategy | `accountId`, `strategy`, `maxPosition?`, `minSpread?` |

### Alert Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `create_alert` | Create price/volume alert | `platform`, `marketId`, `marketTitle`, `type`, `threshold` |
| `get_alerts` | List all alerts | - |
| `check_alerts` | Check for triggered alerts | - |
| `delete_alert` | Delete an alert | `alertId` |

### AI Intelligence Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `analyze_market` | AI market analysis | `platform`, `marketId` |
| `compare_platforms` | Platform comparison report | - |
| `generate_report` | Generate market report | `type: daily|arbitrage|trending` |

### Multi-Agent Debate Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `debate_market` | Debate a specific market | `platform`, `marketId` |
| `debate_question` | Debate any prediction | `question`, `context?` |

### DeFi / On-Chain Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `connect_wallet` | Connect wallet (read-only) | `address`, `chain` |
| `get_wallet_balance` | Get wallet balance | `address`, `chain` |
| `get_all_wallets` | List all connected wallets | - |
| `track_lp_position` | Track LP position in AMM | `protocol`, `chain`, `marketAddress`, `marketTitle`, `lpTokenBalance`, `yesTokensProvided`, `noTokensProvided`, `currentYesPrice`, `currentNoPrice` |
| `get_lp_positions` | View all LP positions | `chain?` |
| `get_lp_portfolio_stats` | Aggregate LP portfolio stats | - |
| `simulate_add_liquidity` | Simulate LP deposit | `amount`, `currentYesPrice`, `currentNoPrice`, `estimatedDailyVolume`, `totalLiquidityAfter` |
| `calculate_impermanent_loss` | Calculate IL for position | `entryYesPrice`, `entryNoPrice`, `currentYesPrice`, `currentNoPrice` |
| `find_cross_chain_arbitrage` | Cross-chain arb opportunities | `minProfit?` |
| `get_bridge_costs` | Estimate bridge costs | `fromChain`, `toChain` |
| `get_arbitrage_route` | Optimal cross-chain route | `buyChain`, `sellChain`, `amount` |
| `record_oracle_update` | Record oracle price update | `marketAddress`, `source`, `yesPrice`, `noPrice`, `confidence` |
| `get_oracle_price` | Get aggregated oracle price | `marketAddress` |

**Supported Chains:** `solana`, `polygon`, `ethereum`, `arbitrum`
**Supported Protocols:** `drift`, `polymarket`, `omen`, `augur`

### LP Strategy Advisor Tools (AI-Powered)

| Tool | Description | Parameters |
|------|-------------|------------|
| `analyze_lp_position` | Full AI analysis with bull/bear debate | `positionId` |
| `analyze_lp_portfolio` | Portfolio-wide analysis with health score | - |
| `analyze_lp_entry` | Analyze potential LP entry with AI debate | `market`, `chain`, `protocol`, `currentYesPrice`, `currentNoPrice`, `dailyVolume`, `totalLiquidity`, `proposedAmount` |
| `get_quick_lp_recommendation` | Fast quantitative recommendation | `positionId` |

### DeFi Streaming Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `start_defi_stream` | Start DeFi event stream | `lpPositionInterval?`, `arbScanInterval?`, `ilWarningThreshold?`, `arbMinProfit?` |
| `stop_defi_stream` | Stop DeFi event stream | - |
| `get_stream_stats` | Get stream statistics | - |

## SSE Streaming Endpoint

Real-time Server-Sent Events for DeFi monitoring:

```
GET /api/prediction-markets/defi-stream
GET /api/prediction-markets/defi-stream?filters=lp_position_update,arb_opportunity
GET /api/prediction-markets/defi-stream?chains=solana,polygon
```

**Event Types:**
- `lp_position_update` - Position value/IL changes
- `lp_il_warning` - IL threshold exceeded
- `lp_breakeven_reached` - Fees offset IL
- `arb_opportunity` - New cross-chain arbitrage
- `arb_expired` - Arbitrage window closed
- `oracle_update` - Price feed update
- `oracle_divergence` - Oracle price mismatch
- `heartbeat` - Connection keepalive

## Resources

The server exposes these MCP resources:

| URI | Description |
|-----|-------------|
| `prediction://markets/overview` | Market summary across platforms |
| `prediction://arbitrage/opportunities` | Current arbitrage opportunities |
| `prediction://reports/daily` | Daily market report |

## Example Usage

### With Claude

```
Human: What are the current arbitrage opportunities in prediction markets?

Claude: I'll check for cross-platform arbitrage opportunities.
[Uses find_arbitrage tool]

Based on the results, I found 3 opportunities with >5% spreads...
```

```
Human: Create a paper trading account and buy some YES shares on this market.

Claude: I'll set up your paper trading account.
[Uses create_trading_account with accountId="demo", initialBalance=10000]
[Uses place_trade with action="buy", side="yes", quantity=100]

Your account is set up with $10,000 and I've purchased 100 YES contracts...
```

```
Human: What does the AI think about this election market?

Claude: Let me run a multi-agent debate on this market.
[Uses debate_market tool]

Bull Case: ...
Bear Case: ...
Synthesis: The final probability estimate is 62% YES with moderate confidence...
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   MCP Gateway Server                         │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐│
│  │   Market    │ │   Paper     │ │      Alert              ││
│  │ Aggregator  │ │  Trading    │ │     Manager             ││
│  │             │ │   Engine    │ │                         ││
│  └──────┬──────┘ └──────┬──────┘ └────────────┬────────────┘│
│         │               │                      │             │
│  ┌──────┴──────┐ ┌──────┴──────┐ ┌────────────┴────────────┐│
│  │  Platform   │ │  Portfolio  │ │    Market               ││
│  │   Clients   │ │  Manager    │ │   Intelligence          ││
│  │ ┌─────────┐ │ │             │ │   (Together AI)         ││
│  │ │ Kalshi  │ │ │             │ │                         ││
│  │ │Polymarket││ │             │ ├─────────────────────────┤│
│  │ │Manifold │ │ │             │ │   Multi-Agent           ││
│  │ │  Drift  │ │ │             │ │      Debate             ││
│  │ └─────────┘ │ │             │ │  (Bull/Bear/Synth)      ││
│  └─────────────┘ └─────────────┘ └─────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

## License

MIT
