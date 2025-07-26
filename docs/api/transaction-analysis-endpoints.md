# Transaction Analysis API Endpoints

## Overview

This document describes the API endpoints that power the enhanced transaction analysis features in the Transaction Explorer. These endpoints provide detailed transaction parsing, account change analysis, AI-powered explanations, and related transaction discovery.

## Base URL

All endpoints are relative to the application base URL:
```
https://your-domain.com/api
```

## Authentication

Most endpoints are publicly accessible. Rate limiting applies:
- Anonymous users: 100 requests/minute
- Authenticated users: 1000 requests/minute

## Common Response Format

All endpoints return responses in this format:

```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: number;
  cached?: boolean;
}
```

## Core Transaction Endpoints

### GET /api/transaction/[signature]

Retrieves basic transaction information with enhanced parsing.

#### Parameters

- `signature` (path): Transaction signature (88 characters, Base58 encoded)

#### Query Parameters

- `includeInstructions` (boolean, default: true): Include parsed instructions
- `includeAccountChanges` (boolean, default: true): Include account state changes
- `includeMetrics` (boolean, default: false): Include performance metrics

#### Response

```typescript
interface TransactionResponse {
  signature: string;
  slot: number;
  blockTime: number | null;
  confirmationStatus: 'processed' | 'confirmed' | 'finalized';
  fee: number;
  instructions: ParsedInstruction[];
  accountChanges: AccountChange[];
  metrics?: TransactionMetrics;
  meta: TransactionMeta;
}

interface ParsedInstruction {
  index: number;
  program: string;
  programId: string;
  instructionType: string;
  description: string;
  category: 'system' | 'token' | 'defi' | 'nft' | 'governance' | 'unknown';
  riskLevel: 'low' | 'medium' | 'high';
  accounts: InstructionAccount[];
  parameters: InstructionParameter[];
  innerInstructions: ParsedInstruction[];
  logs: string[];
  computeUnits?: number;
}

interface AccountChange {
  address: string;
  preBalance: number;
  postBalance: number;
  balanceChange: number;
  tokenChanges: TokenChange[];
  dataChange?: DataChange;
  ownerChange?: OwnerChange;
  rentExemptStatus?: RentExemptStatus;
}
```

#### Example Request

```bash
curl "https://your-domain.com/api/transaction/5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW?includeMetrics=true"
```

#### Example Response

```json
{
  "success": true,
  "data": {
    "signature": "5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW",
    "slot": 123456789,
    "blockTime": 1640995200,
    "confirmationStatus": "finalized",
    "fee": 5000,
    "instructions": [
      {
        "index": 0,
        "program": "System Program",
        "programId": "11111111111111111111111111111111",
        "instructionType": "transfer",
        "description": "Transfer 0.1 SOL from account A to account B",
        "category": "system",
        "riskLevel": "low",
        "accounts": [...],
        "parameters": [...],
        "innerInstructions": [],
        "logs": [],
        "computeUnits": 150
      }
    ],
    "accountChanges": [...],
    "metrics": {...}
  },
  "timestamp": 1640995200000,
  "cached": true
}
```

### GET /api/transaction/[signature]/analysis

Provides detailed analysis including AI explanations and risk assessment.

#### Parameters

- `signature` (path): Transaction signature

#### Query Parameters

- `includeAI` (boolean, default: true): Include AI-generated explanations
- `includeRisk` (boolean, default: true): Include risk assessment
- `includeDeFi` (boolean, default: true): Include DeFi-specific analysis

#### Response

```typescript
interface TransactionAnalysis {
  signature: string;
  aiExplanation?: AIExplanation;
  riskAssessment: RiskAssessment;
  defiAnalysis?: DeFiAnalysis;
  patterns: TransactionPattern[];
  complexity: ComplexityAnalysis;
}

interface AIExplanation {
  summary: string;
  mainAction: string;
  secondaryEffects: string[];
  financialImpact: string;
  confidence: number;
  technicalDetails: TechnicalDetail[];
}

interface RiskAssessment {
  level: 'low' | 'medium' | 'high';
  score: number; // 0-100
  factors: RiskFactor[];
  recommendations: string[];
}
```

#### Example Request

```bash
curl "https://your-domain.com/api/transaction/5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW/analysis"
```

### GET /api/transaction/[signature]/related

Finds transactions related to the specified transaction.

#### Parameters

- `signature` (path): Transaction signature

#### Query Parameters

- `limit` (number, default: 20, max: 100): Maximum number of related transactions
- `types` (string[]): Relationship types to include
  - `same_accounts`: Transactions with shared accounts
  - `same_programs`: Transactions using same programs
  - `token_flows`: Token transfer connections
  - `temporal_proximity`: Time-based relationships
  - `authority_chains`: Authority-based connections
- `minStrength` (number, default: 0.1): Minimum relationship strength (0-1)
- `timeWindow` (number, default: 3600): Time window in seconds

#### Response

```typescript
interface RelatedTransactionsResponse {
  signature: string;
  relatedTransactions: RelatedTransaction[];
  totalFound: number;
  searchCriteria: SearchCriteria;
}

interface RelatedTransaction {
  signature: string;
  relationship: RelationshipType;
  strength: number; // 0-1
  description: string;
  timestamp: number;
  sharedAccounts: string[];
  sharedPrograms: string[];
  metadata: RelationshipMetadata;
}
```

#### Example Request

```bash
curl "https://your-domain.com/api/transaction/5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW/related?limit=10&types=same_accounts,token_flows&minStrength=0.5"
```

### POST /api/transaction/[signature]/explain

Generates or regenerates AI explanation for a transaction.

#### Parameters

- `signature` (path): Transaction signature

#### Request Body

```typescript
interface ExplainRequest {
  focus?: 'general' | 'defi' | 'security' | 'technical';
  includeRisk?: boolean;
  includeRecommendations?: boolean;
  regenerate?: boolean; // Force regeneration even if cached
}
```

#### Response

Same as the `aiExplanation` field from the analysis endpoint.

#### Example Request

```bash
curl -X POST "https://your-domain.com/api/transaction/5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW/explain" \
  -H "Content-Type: application/json" \
  -d '{"focus": "defi", "includeRisk": true}'
```

## Account Analysis Endpoints

### GET /api/account/[address]/changes

Analyzes account changes across multiple transactions.

#### Parameters

- `address` (path): Account address

#### Query Parameters

- `limit` (number, default: 50): Number of transactions to analyze
- `before` (string): Transaction signature to start before
- `includeTokens` (boolean, default: true): Include token balance changes
- `includeData` (boolean, default: false): Include data changes

#### Response

```typescript
interface AccountChangesResponse {
  address: string;
  changes: AccountChangeHistory[];
  summary: AccountChangeSummary;
  patterns: ChangePattern[];
}

interface AccountChangeHistory {
  signature: string;
  slot: number;
  timestamp: number;
  balanceChange: number;
  tokenChanges: TokenChange[];
  dataChange?: DataChange;
  context: TransactionContext;
}
```

## Program Analysis Endpoints

### GET /api/program/[address]/instructions

Analyzes instruction usage patterns for a program.

#### Parameters

- `address` (path): Program address

#### Query Parameters

- `timeframe` (string, default: '24h'): Analysis timeframe ('1h', '24h', '7d', '30d')
- `limit` (number, default: 100): Number of recent instructions to analyze

#### Response

```typescript
interface ProgramInstructionsResponse {
  programId: string;
  programName?: string;
  instructionStats: InstructionStats[];
  usagePatterns: UsagePattern[];
  riskProfile: ProgramRiskProfile;
}

interface InstructionStats {
  instructionType: string;
  count: number;
  averageComputeUnits: number;
  successRate: number;
  commonAccounts: string[];
}
```

## Metrics and Analytics Endpoints

### GET /api/transaction/[signature]/metrics

Provides detailed performance metrics for a transaction.

#### Parameters

- `signature` (path): Transaction signature

#### Response

```typescript
interface TransactionMetrics {
  totalFee: number;
  baseFee: number;
  priorityFee: number;
  computeUnitsUsed: number;
  computeUnitsRequested: number;
  efficiency: number; // 0-100
  size: number; // bytes
  accountsModified: number;
  instructionCount: number;
  innerInstructionCount: number;
  feePerComputeUnit: number;
  comparison: MetricsComparison;
}

interface MetricsComparison {
  networkAverage: NetworkAverageMetrics;
  similarTransactions: SimilarTransactionMetrics[];
  percentile: number; // Where this transaction ranks (0-100)
}
```

### GET /api/analytics/transaction-patterns

Analyzes transaction patterns across the network.

#### Query Parameters

- `timeframe` (string, default: '24h'): Analysis timeframe
- `programId` (string, optional): Filter by specific program
- `minVolume` (number, optional): Minimum transaction volume

#### Response

```typescript
interface TransactionPatternsResponse {
  timeframe: string;
  patterns: TransactionPattern[];
  anomalies: TransactionAnomaly[];
  trends: TrendAnalysis[];
}
```

## Error Handling

### Common Error Codes

- `INVALID_SIGNATURE`: Malformed transaction signature
- `TRANSACTION_NOT_FOUND`: Transaction doesn't exist
- `ANALYSIS_FAILED`: Error during transaction analysis
- `AI_SERVICE_UNAVAILABLE`: AI analysis service is down
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `INTERNAL_ERROR`: Server-side error

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "TRANSACTION_NOT_FOUND",
    "message": "Transaction with signature 'abc123...' was not found",
    "details": {
      "signature": "abc123...",
      "searchedNetworks": ["mainnet-beta"]
    }
  },
  "timestamp": 1640995200000
}
```

## Rate Limiting

### Limits

- **Anonymous**: 100 requests per minute
- **Authenticated**: 1000 requests per minute
- **Premium**: 10000 requests per minute

### Headers

Rate limit information is included in response headers:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995260
```

### Handling Rate Limits

When rate limited, the API returns HTTP 429 with:

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Try again in 60 seconds.",
    "details": {
      "retryAfter": 60,
      "limit": 100,
      "window": 60
    }
  },
  "timestamp": 1640995200000
}
```

## Caching

### Cache Headers

Responses include caching information:

```
Cache-Control: public, max-age=300
ETag: "abc123def456"
Last-Modified: Wed, 21 Oct 2015 07:28:00 GMT
```

### Cache Behavior

- **Transaction data**: Cached for 5 minutes
- **AI explanations**: Cached for 1 hour
- **Related transactions**: Cached for 10 minutes
- **Metrics**: Cached for 30 seconds

## WebSocket Endpoints

### Real-time Transaction Updates

Connect to receive real-time updates for transactions:

```javascript
const ws = new WebSocket('wss://your-domain.com/api/ws/transaction/[signature]');

ws.onmessage = (event) => {
  const update = JSON.parse(event.data);
  // Handle transaction update
};
```

### Update Types

- `status_change`: Confirmation status updated
- `analysis_complete`: AI analysis finished
- `related_found`: New related transactions discovered

## SDK and Client Libraries

### JavaScript/TypeScript

```bash
npm install @your-org/transaction-analyzer-sdk
```

```typescript
import { TransactionAnalyzer } from '@your-org/transaction-analyzer-sdk';

const analyzer = new TransactionAnalyzer({
  apiKey: 'your-api-key',
  baseUrl: 'https://your-domain.com/api'
});

const analysis = await analyzer.analyzeTransaction(signature);
```

### Python

```bash
pip install transaction-analyzer-python
```

```python
from transaction_analyzer import TransactionAnalyzer

analyzer = TransactionAnalyzer(api_key='your-api-key')
analysis = analyzer.analyze_transaction(signature)
```

## Best Practices

### Performance Optimization

1. **Use appropriate query parameters** to limit data transfer
2. **Implement client-side caching** for frequently accessed data
3. **Batch requests** when analyzing multiple transactions
4. **Use WebSocket connections** for real-time updates

### Error Handling

1. **Implement exponential backoff** for retries
2. **Handle rate limits gracefully** with appropriate delays
3. **Provide fallback behavior** when AI services are unavailable
4. **Log errors appropriately** for debugging

### Security

1. **Validate all input parameters** before making requests
2. **Use HTTPS** for all API communications
3. **Store API keys securely** and rotate them regularly
4. **Implement proper authentication** for sensitive operations

## Examples

### Complete Transaction Analysis

```typescript
async function analyzeTransaction(signature: string) {
  try {
    // Get basic transaction data
    const transaction = await fetch(`/api/transaction/${signature}?includeMetrics=true`);
    const txData = await transaction.json();
    
    // Get detailed analysis
    const analysis = await fetch(`/api/transaction/${signature}/analysis`);
    const analysisData = await analysis.json();
    
    // Get related transactions
    const related = await fetch(`/api/transaction/${signature}/related?limit=10`);
    const relatedData = await related.json();
    
    return {
      transaction: txData.data,
      analysis: analysisData.data,
      related: relatedData.data
    };
  } catch (error) {
    console.error('Analysis failed:', error);
    throw error;
  }
}
```

### Batch Analysis

```typescript
async function analyzeBatch(signatures: string[]) {
  const analyses = await Promise.allSettled(
    signatures.map(sig => analyzeTransaction(sig))
  );
  
  return analyses.map((result, index) => ({
    signature: signatures[index],
    success: result.status === 'fulfilled',
    data: result.status === 'fulfilled' ? result.value : null,
    error: result.status === 'rejected' ? result.reason : null
  }));
}
```

## Changelog

### v1.2.0 (Latest)
- Added DeFi-specific analysis endpoints
- Improved AI explanation quality
- Enhanced related transaction discovery
- Added WebSocket support for real-time updates

### v1.1.0
- Added transaction metrics endpoints
- Improved error handling and response formats
- Added rate limiting headers
- Enhanced caching behavior

### v1.0.0
- Initial release with basic transaction analysis
- AI-powered explanations
- Account change tracking
- Related transaction discovery

---

For additional support or questions about the API, please refer to the main documentation or contact the development team.