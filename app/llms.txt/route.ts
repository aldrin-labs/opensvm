import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logging/logger';

export async function GET(request: NextRequest) {
  const startTime = performance.now();
  
  try {
    logger.info('LLMs.txt documentation requested', {
      component: 'LLMsDocsRoute',
      metadata: {
        userAgent: request.headers.get('user-agent'),
        referer: request.headers.get('referer')
      }
    });

    // Generate llms.txt documentation
    const llmsDocs = generateLLMsDocs();
    
    const endTime = performance.now();
    const duration = endTime - startTime;

    logger.info('LLMs.txt documentation generated', {
      component: 'LLMsDocsRoute',
      metadata: {
        generationTime: duration,
        contentLength: llmsDocs.length
      }
    });

    // Return plain text with proper headers
    return new NextResponse(llmsDocs, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Generation-Time': duration.toString(),
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      }
    });

  } catch (error) {
    const endTime = performance.now();
    const duration = endTime - startTime;

    logger.error('Failed to generate LLMs.txt documentation', {
      component: 'LLMsDocsRoute',
      metadata: {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        duration
      }
    });

    return new NextResponse(
      'Error generating LLMs.txt documentation',
      { status: 500 }
    );
  }
}

function generateLLMsDocs(): string {
  return `# OpenSVM API Documentation for AI Agents

> OpenSVM is a comprehensive Solana blockchain explorer with AI-powered analytics,
> transaction visualization, and real-time blockchain data access.

## Overview

OpenSVM provides a powerful REST API for accessing Solana blockchain data,
including transactions, accounts, blocks, tokens, programs, and AI-powered analysis.
All endpoints return JSON unless otherwise specified.

Base URL: https://opensvm.com/api
Documentation: https://opensvm.com/docs
Interactive API: https://opensvm.com/swagger

## Navigation

### Main Pages
- Dashboard: /
- Search: /search
- Transactions: /tx/{signature}
- Blocks: /block/{slot}
- Accounts: /account/{address}
- Tokens: /token/{mint}
- Programs: /program/{address}
- Validators: /validator/{address}
- DeFi: /defi
- NFTs: /nfts
- Analytics: /analytics

### Documentation
- User Docs: /docs
- API Reference: /swagger
- OpenAPI Spec: /api/docs/openapi
- This File: /llms.txt

### Settings
- Access via Settings icon in top-right navigation
- Configure theme, RPC endpoint, display preferences
- Keyboard shortcut: Available in settings menu

## Authentication

Most endpoints are publicly accessible. For rate-limited or premium features:

### API Key Authentication
\`\`\`
Authorization: Bearer YOUR_API_KEY
\`\`\`

To obtain an API key:
1. Connect wallet at /
2. Navigate to Settings
3. Generate API key (if feature is enabled)

## Core API Endpoints

### Transaction Analysis
**GET /api/transaction/{signature}**
- Get complete transaction data with decoded instructions
- Returns: Transaction details, accounts, logs, status

**POST /api/analyze-transaction**
- AI-powered transaction analysis
- Body: { signature: string }
- Returns: Natural language explanation, risk analysis, patterns

**GET /api/transaction-metrics**
- Aggregate transaction metrics
- Query params: timeframe, network
- Returns: TPS, success rate, average fees

### Account Data
**GET /api/account-stats**
- Account statistics and history
- Query params: address
- Returns: Balance, token holdings, transaction history

**GET /api/account-transactions**
- List account transactions
- Query params: address, limit, before, after
- Returns: Paginated transaction list

**GET /api/account-portfolio**
- Token portfolio analysis
- Query params: address
- Returns: Token balances, valuations, changes

### Block Data
**GET /api/block/{slot}**
- Block information by slot number
- Returns: Block data, transactions, validators

**GET /api/blocks**
- Recent blocks list
- Query params: limit, before
- Returns: Paginated block list

### Search
**GET /api/search**
- Universal search across all blockchain entities
- Query params: q (query string)
- Returns: Matched transactions, accounts, blocks, tokens, programs

**GET /api/search-suggestions**
- Get search suggestions as user types
- Query params: q, limit
- Returns: Ranked suggestions with types

### Token Data
**GET /api/token/{mint}**
- Token information and metadata
- Returns: Symbol, name, supply, holders, price

**GET /api/token-stats**
- Token statistics and analytics
- Query params: mint
- Returns: Volume, transactions, holder distribution

**GET /api/token-metadata**
- Token metadata from on-chain and external sources
- Query params: mint
- Returns: Complete token metadata

### Program Analysis
**GET /api/program/{address}**
- Program information and analysis
- Returns: Program accounts, IDL, deployment info

**GET /api/program-accounts**
- List program accounts
- Query params: programId, filters
- Returns: Program data accounts

**GET /api/program-metadata**
- Program metadata and verification status
- Query params: address
- Returns: Name, description, verified status

**GET /api/program-registry**
- Known program registry
- Returns: List of verified programs with metadata

### Validator Data
**GET /api/validator/{address}**
- Validator information and performance
- Returns: Commission, stake, performance metrics

### AI Features
**POST /api/ai-response**
- AI-powered blockchain analysis
- Body: { query: string, context?: object }
- Returns: Streaming or complete AI response

**POST /api/chat**
- Conversational AI interface
- Body: { messages: array, context?: object }
- Returns: AI chat response with citations

**GET /api/getSimilarQuestions**
- Get similar questions for context
- Query params: question
- Returns: Related questions array

### DeFi Analytics
**GET /api/dex**
- DEX aggregated data
- Returns: Trading volumes, popular pairs

### Monitoring
**GET /api/health**
- API health check
- Returns: Status, uptime, version

**GET /api/monitoring**
- System monitoring metrics
- Returns: Performance stats, error rates

## Rate Limits

### Public Endpoints
- 100 requests per minute per IP
- 1000 requests per hour per IP

### Authenticated Endpoints
- 1000 requests per minute
- 10000 requests per hour

### AI Endpoints
- 20 requests per minute
- 200 requests per hour

## Response Format

### Success Response
\`\`\`json
{
  "success": true,
  "data": { ... },
  "metadata": {
    "timestamp": "2024-01-01T00:00:00Z",
    "processingTime": 123
  }
}
\`\`\`

### Error Response
\`\`\`json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": { ... }
}
\`\`\`

## Common Error Codes

- \`INVALID_REQUEST\` - Malformed request
- \`NOT_FOUND\` - Resource not found
- \`RATE_LIMIT_EXCEEDED\` - Too many requests
- \`AUTHENTICATION_REQUIRED\` - API key required
- \`INTERNAL_ERROR\` - Server error

## WebSocket Support

Real-time updates available via WebSocket:
- \`wss://opensvm.com/ws\`

### Subscriptions
- Transaction updates
- Block updates
- Token price updates
- Account balance changes

## Data Freshness

- Transaction data: Real-time (< 1s delay)
- Account data: Real-time to 30s cache
- Token prices: 30s to 5min cache
- Analytics: 5min to 1hr cache

## Best Practices

1. **Use pagination** for large result sets
2. **Cache responses** when appropriate
3. **Handle rate limits** with exponential backoff
4. **Use WebSocket** for real-time data
5. **Include User-Agent** header identifying your application
6. **Respect cache headers** for optimal performance

## Integration Example

\`\`\`javascript
// Fetch transaction with AI analysis
const response = await fetch('https://opensvm.com/api/transaction/SIGNATURE');
const transaction = await response.json();

// Get AI explanation
const aiResponse = await fetch('https://opensvm.com/api/analyze-transaction', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ signature: 'SIGNATURE' })
});
const analysis = await aiResponse.json();
\`\`\`

## Support

- Documentation: https://opensvm.com/docs
- GitHub: https://github.com/aldrin-labs/opensvm
- Community: Available through GitHub discussions
- Email: support@opensvm.com

## Changelog

Current Version: 1.0.0
- Full REST API
- AI-powered analysis
- Real-time WebSocket support
- Comprehensive blockchain data access

Last Updated: 2024-10-16

---

This documentation is optimized for Large Language Models and AI agents.
For human-readable documentation, visit https://opensvm.com/docs
`;
}
