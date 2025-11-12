# Frequently Asked Questions (FAQ)

## General Questions

### What is OpenSVM?

OpenSVM is a comprehensive Solana blockchain explorer with AI-powered analytics. It provides real-time transaction monitoring, account analysis, DeFi analytics, and advanced visualization tools for the Solana ecosystem.

### Is OpenSVM free to use?

Yes, OpenSVM is free to use for basic features. Advanced features and higher API rate limits may require authentication or token gating.

### What makes OpenSVM different from other Solana explorers?

OpenSVM offers:
- **AI-Powered Analysis**: Natural language queries and intelligent transaction analysis
- **Advanced Visualizations**: Interactive graphs, network diagrams, and data visualizations
- **Comprehensive API**: 193+ endpoints covering transactions, accounts, DeFi, NFTs, and more
- **Real-time Updates**: WebSocket support for live data streaming
- **Developer-Friendly**: Complete OpenAPI documentation and TypeScript SDK

## Technical Questions

### What API endpoints are available?

OpenSVM provides 193+ API endpoints organized into categories:
- Transaction APIs (search, analysis, batch operations)
- Account APIs (stats, portfolio, token holdings)
- Block APIs (block data, recent blocks, statistics)
- DeFi APIs (DEX analytics, liquidity pools, market data)
- NFT APIs (collections, metadata, trending)
- Program APIs (registry, program info)
- Search APIs (universal search, filters)

See the [API Reference](/docs/API) for complete documentation.

### How do I authenticate with the API?

OpenSVM supports multiple authentication methods:
1. **API Keys**: Generate keys in your account settings
2. **Wallet Signatures**: Sign messages with your Solana wallet
3. **JWT Tokens**: OAuth-style authentication for web apps

See the [Authentication Guide](/docs/AUTHENTICATION) for details.

### What are the API rate limits?

Rate limits vary by authentication level:
- **Anonymous**: 10 requests/minute
- **Authenticated**: 100 requests/minute
- **Premium**: 1000 requests/minute

### How do I get real-time updates?

OpenSVM supports WebSocket connections for real-time data:

```javascript
const ws = new WebSocket('wss://opensvm.com/api/ws');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Real-time update:', data);
};

// Subscribe to account updates
ws.send(JSON.stringify({
  type: 'subscribe',
  channel: 'account',
  address: 'YOUR_ACCOUNT_ADDRESS'
}));
```

## Feature Questions

### Can I analyze transactions with natural language?

Yes! Use the AI-powered `/api/getAnswer` endpoint:

```bash
curl -X POST https://opensvm.com/api/getAnswer \
  -H "Content-Type: application/json" \
  -d '{"question": "What is the current price of SOL?"}'
```

### How do I search for transactions?

Use the universal search endpoint:

```bash
curl "https://opensvm.com/api/search?query=YOUR_SIGNATURE"
```

Or use the transaction-specific search:

```bash
curl "https://opensvm.com/api/transactions/search?signature=YOUR_SIGNATURE"
```

### Can I get historical market data?

Yes, use the market data endpoints:

```bash
# Get OHLCV data
curl "https://opensvm.com/api/market-data/ohlcv?pair=SOL/USDC&interval=1h&limit=100"

# Get current price
curl "https://opensvm.com/api/market-data/price?symbol=SOL"
```

### How do I analyze DeFi protocols?

Use the DeFi analytics endpoints:

```bash
# Get DeFi overview
curl "https://opensvm.com/api/defi/overview"

# Get DEX analytics
curl "https://opensvm.com/api/defi/dex-analytics?dex=raydium"

# Get liquidity pools
curl "https://opensvm.com/api/defi/pools?protocol=orca"
```

## Development Questions

### Is there a TypeScript SDK?

Yes! Install the OpenSVM SDK:

```bash
npm install @opensvm/sdk
```

Usage:

```typescript
import { OpenSVM } from '@opensvm/sdk';

const client = new OpenSVM({
  apiKey: 'YOUR_API_KEY'
});

const transaction = await client.getTransaction('SIGNATURE');
```

### How do I contribute to OpenSVM?

1. Fork the repository on GitHub
2. Create a feature branch
3. Make your changes with tests
4. Submit a pull request

See the [Development Guide](/docs/DEVELOPMENT) for details.

### Where can I report bugs?

Report bugs through:
- GitHub Issues: https://github.com/opensvm/opensvm/issues
- Email: support@opensvm.com
- Discord: Join our community server

### How do I run OpenSVM locally?

```bash
# Clone the repository
git clone https://github.com/opensvm/opensvm.git
cd opensvm

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Run development server
npm run dev
```

Visit http://localhost:3000 to see the app.

## Performance Questions

### Why is my query slow?

Common causes:
- Large date ranges (reduce the time window)
- Complex filters (simplify your query)
- High traffic periods (try again later)
- Missing indexes (contact support)

### Can I cache API responses?

Yes! API responses include cache headers:

```
Cache-Control: public, max-age=60
ETag: "abc123"
```

Use ETags for conditional requests:

```bash
curl "https://opensvm.com/api/account-stats/ADDRESS" \
  -H "If-None-Match: abc123"
```

### What's the maximum batch size?

Batch endpoints support:
- Transactions: 20 per request
- Accounts: 50 per request
- Token metadata: 100 per request

## Security Questions

### Is my data secure?

Yes! OpenSVM implements:
- HTTPS encryption for all traffic
- API key encryption at rest
- Rate limiting to prevent abuse
- Input validation and sanitization
- Regular security audits

### How are API keys stored?

API keys are:
- Hashed using bcrypt before storage
- Never logged or exposed in responses
- Rotatable at any time
- Scoped to specific permissions

### Can I restrict API key permissions?

Yes! When creating an API key, you can specify:
- Allowed endpoints
- Rate limits
- IP whitelist
- Expiration date

## Troubleshooting

### I'm getting 401 Unauthorized errors

Check:
1. API key is valid and not expired
2. API key is included in the `Authorization` header
3. API key has permission for the endpoint
4. Account is in good standing

### I'm getting 429 Too Many Requests errors

You've exceeded your rate limit. Solutions:
1. Reduce request frequency
2. Implement exponential backoff
3. Upgrade to a higher tier
4. Use batch endpoints to combine requests

### The data seems outdated

OpenSVM caches some data for performance. Cache durations:
- Account balances: 30 seconds
- Transaction data: 5 minutes
- Market data: 1 minute
- Block data: 10 seconds

Use the `cache=false` parameter to bypass cache:

```bash
curl "https://opensvm.com/api/account-stats/ADDRESS?cache=false"
```

### I found incorrect data

Please report data issues:
1. Note the endpoint and parameters
2. Include the timestamp
3. Describe the expected vs actual data
4. Email support@opensvm.com

## Additional Resources

- [API Reference](/docs/API) - Complete API documentation
- [Authentication Guide](/docs/AUTHENTICATION) - Authentication methods
- [Development Guide](/docs/DEVELOPMENT) - Setup and development
- [Architecture](/docs/ARCHITECTURE) - System architecture
- [Keyboard Shortcuts](/docs/keyboard-shortcuts) - Power user shortcuts

## Still Have Questions?

- **Email**: support@opensvm.com
- **Discord**: Join our community
- **GitHub**: Open an issue
- **Twitter**: @opensvm

We're here to help! 🚀
