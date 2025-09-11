# User-Expandable Information Patterns

This document explains how users can teach the OpenSVM agent new information retrieval patterns using the existing Solana RPC and OpenSVM APIs.

## Overview

The agent uses "Information Patterns" - predefined sequences of API calls that retrieve specific types of information. Users can create custom patterns to teach the agent how to get specialized information.

## Pattern Structure

Each information pattern consists of:

```typescript
interface InformationPattern {
  name: string;                    // Unique identifier
  description: string;             // What this pattern does
  apiSequence: APICall[];          // Sequence of API calls
  dependencies: string[];          // Prerequisites
  useCase: string;                // When to use this pattern
  examples: string[];             // Example queries that match
}

interface APICall {
  method: string;                 // Exact API method name
  reason: string;                // Why this step is needed
  input?: string;               // Optional parameters
  parameters?: Record<string, any>; // Specific parameters
}
```

## Example: Creating a New Pattern

### Pattern: DeFi Protocol Analysis

```typescript
const defiProtocolAnalysis: InformationPattern = {
  name: 'defi-protocol-analysis',
  description: 'Comprehensive analysis of a DeFi protocol including liquidity, volume, and user activity',
  apiSequence: [
    {
      method: 'getProgramAccounts',
      reason: 'Get all accounts owned by the protocol program',
      input: 'programId from user query'
    },
    {
      method: 'getTokenLargestAccounts', 
      reason: 'Find major liquidity pools and holders',
      input: 'token addresses found in step 1'
    },
    {
      method: 'dexAnalytics',
      reason: 'Get trading volume and liquidity metrics',
      input: 'protocol identifier'
    },
    {
      method: 'getRecentPerformanceSamples',
      reason: 'Check network impact and transaction frequency',
      input: 'limit=100'
    },
    {
      method: 'anomalyDetection',
      reason: 'Check for unusual activity or security issues',
      input: 'protocol addresses'
    }
  ],
  dependencies: [],
  useCase: 'When user asks about DeFi protocol analysis, liquidity analysis, or protocol metrics',
  examples: [
    'Analyze this DeFi protocol',
    'How is the liquidity for this protocol?',
    'Give me a complete analysis of this AMM',
    'Protocol deep dive analysis'
  ]
};
```

## How to Add New Patterns

### Method 1: Code Addition

Add your pattern to `lib/ai/core/api-knowledge.ts` in the `INFORMATION_PATTERNS` array:

```typescript
export const INFORMATION_PATTERNS: InformationPattern[] = [
  // ... existing patterns
  
  // Your new pattern here
  {
    name: 'your-pattern-name',
    description: 'What your pattern does',
    apiSequence: [
      {
        method: 'firstAPICall',
        reason: 'Why this call is needed'
      },
      {
        method: 'secondAPICall', 
        reason: 'Why this follows the first',
        input: 'specific parameters'
      }
    ],
    dependencies: [],
    useCase: 'When to use this pattern',
    examples: [
      'User query example 1',
      'User query example 2'
    ]
  }
];
```

### Method 2: Runtime Teaching (Future Enhancement)

The system is designed to support runtime pattern addition. This would allow users to teach patterns through conversation:

```
User: "I want to teach you how to analyze NFT collections"
Agent: "I can learn a new pattern. What API calls should I use?"
User: "First get collection metadata with nftCollections, then get top holders with getTokenLargestAccounts, then check floor price trends"
Agent: "Pattern learned! I'll use this when users ask about NFT collection analysis."
```

## Available API Methods

### Solana RPC Methods
- **Account**: getAccountInfo, getBalance, getMultipleAccounts, getProgramAccounts
- **Transaction**: getTransaction, getSignaturesForAddress, simulateTransaction, getSignatureStatuses
- **Network**: getEpochInfo, getSlot, getBlockHeight, getRecentPerformanceSamples, getVoteAccounts
- **Block**: getBlock, getBlocks, getBlockTime
- **Token**: getTokenAccountBalance, getTokenAccountsByOwner, getTokenLargestAccounts, getTokenSupply

### OpenSVM Enhanced APIs
- **Analytics**: walletPathFinding, analyzeTransaction, accountStats, tokenStats, anomalyDetection
- **Specialized**: programRegistry, nftCollections, dexAnalytics

## Pattern Design Best Practices

### 1. Logical Sequencing
Order API calls from general to specific:
```typescript
apiSequence: [
  { method: 'getAccountInfo', reason: 'Check if account exists' },
  { method: 'getBalance', reason: 'Get SOL balance' },
  { method: 'getTokenAccountsByOwner', reason: 'Get token holdings' },
  { method: 'accountStats', reason: 'Get behavioral analytics' }
]
```

### 2. Parameter Passing
Use the `input` field to pass data between steps:
```typescript
apiSequence: [
  { method: 'getTransaction', reason: 'Get transaction details' },
  { 
    method: 'analyzeTransaction', 
    reason: 'AI analysis of transaction',
    input: 'logs from previous step'
  }
]
```

### 3. Error Handling
Include fallback methods for robustness:
```typescript
apiSequence: [
  { method: 'tokenStats', reason: 'Try enhanced analytics first' },
  { method: 'getTokenSupply', reason: 'Fallback to basic token data' }
]
```

### 4. Comprehensive Coverage
Include all relevant information types:
```typescript
informationTypes: [
  'token-analytics',
  'market-data', 
  'holder-statistics',
  'trading-volume'
]
```

## Example Use Cases

### 1. Whale Watching Pattern
```typescript
{
  name: 'whale-watching',
  description: 'Track large token holders and their recent activity',
  apiSequence: [
    { method: 'getTokenLargestAccounts', reason: 'Find biggest holders' },
    { method: 'getSignaturesForAddress', reason: 'Check recent activity for each whale', input: 'limit=20' },
    { method: 'accountStats', reason: 'Get behavioral analysis of whales' },
    { method: 'anomalyDetection', reason: 'Check for suspicious whale activity' }
  ],
  examples: ['Track whales for this token', 'Who are the biggest holders?']
}
```

### 2. Protocol Health Check Pattern
```typescript
{
  name: 'protocol-health-check',
  description: 'Comprehensive health analysis of a DeFi protocol',
  apiSequence: [
    { method: 'getProgramAccounts', reason: 'Get all protocol accounts' },
    { method: 'dexAnalytics', reason: 'Check trading metrics' },
    { method: 'getRecentPerformanceSamples', reason: 'Network impact assessment' },
    { method: 'anomalyDetection', reason: 'Security and anomaly screening' }
  ],
  examples: ['Is this protocol healthy?', 'Protocol security check']
}
```

### 3. Token Launch Analysis Pattern
```typescript
{
  name: 'token-launch-analysis',
  description: 'Analyze new token launches for legitimacy and potential',
  apiSequence: [
    { method: 'getTokenSupply', reason: 'Check total supply and distribution' },
    { method: 'getTokenLargestAccounts', reason: 'Analyze initial distribution' },
    { method: 'programRegistry', reason: 'Verify associated programs' },
    { method: 'anomalyDetection', reason: 'Check for suspicious patterns' },
    { method: 'dexAnalytics', reason: 'Check early trading activity' }
  ],
  examples: ['Analyze this new token launch', 'Is this token legitimate?']
}
```

## Testing Your Patterns

After adding a pattern, test it by asking questions that match your examples:

1. **Direct Match**: Use exact phrases from your `examples` array
2. **Semantic Match**: Use similar but different wording  
3. **Edge Cases**: Test with incomplete information or edge cases

## Pattern Matching Algorithm

The system matches patterns using:

1. **Exact Phrase Matching**: Direct substring matching with examples
2. **Keyword Matching**: Pattern name and description keywords
3. **Semantic Similarity**: Understanding intent behind queries

## Future Enhancements

The system is designed to support:

1. **Machine Learning Pattern Discovery**: Automatically discover new patterns from user interactions
2. **Community Pattern Sharing**: Share successful patterns with other users
3. **Dynamic Pattern Updates**: Modify patterns based on API changes
4. **Pattern Performance Metrics**: Track which patterns are most effective

## Contributing

To contribute new patterns to the OpenSVM project:

1. Create patterns following the structure above
2. Test thoroughly with various queries
3. Document the use case and expected outcomes
4. Submit via pull request with examples

This extensible system allows the OpenSVM agent to continuously learn new ways to retrieve and analyze blockchain data, making it more powerful and useful over time.
