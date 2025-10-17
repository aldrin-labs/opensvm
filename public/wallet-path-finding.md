# Wallet Path Finding

The Wallet Path Finding feature allows you to find connections between any two Solana wallet addresses by tracking token transfers. This feature uses a breadth-first search algorithm to discover paths between wallets, which can be valuable for transaction tracing, fraud detection, and understanding token flows.

## Usage

### Direct API

To use the wallet path finding API directly:

```typescript
// Make a POST request to the API endpoint
const response = await fetch('/api/wallet-path-finding', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    sourceWallet: 'source_wallet_address',
    targetWallet: 'target_wallet_address',
    maxDepth: 42 // Optional, defaults to 42
  })
});

// Handle the response
const result = await response.json();
console.log(result);
```

The API supports streaming response format that provides real-time updates during the search process.

### AI Integration

You can use the AI sidebar to find paths between wallets with natural language:

1. Open the AI sidebar
2. Ask a question like: "Find a path between wallet X and wallet Y" (where X and Y are valid Solana addresses)
3. The AI will process your request and stream updates as it searches for a path

### Programmatic Usage

```typescript
import { findWalletPath } from '@/components/ai/actions/WalletPathFindingAction';

const result = await findWalletPath({
  walletA: 'source_wallet_address',
  walletB: 'target_wallet_address',
  maxDepth: 30, // Optional
  onProgress: (progress) => {
    console.log(`Searched ${progress.visitedCount} wallets`);
  },
  onResult: (result) => {
    console.log('Path found:', result);
  },
  onError: (error) => {
    console.error('Error:', error);
  }
});
```

## Technical Details

### Architecture

The wallet path finding feature consists of:

1. **State Machine**: A breadth-first search implementation using xstate
2. **API Route**: `/api/wallet-path-finding` endpoint with streaming responses
3. **Caching Layer**: To store path results for fast retrieval
4. **AI Integration**: Natural language interface via the AI sidebar

### Performance Considerations

- Searches are limited to a maximum depth (default: 42)
- Results are cached to improve performance for repeat queries
- The search uses a breadth-first approach to find the shortest path

### Response Format

A successful path finding operation returns:

```json
{
  "found": true,
  "path": ["walletA", "intermediateWallet1", "...", "walletB"],
  "transferIds": ["tx1", "tx2", "..."],
  "visitedCount": 42,
  "depth": 3
}
```

If no path is found:

```json
{
  "found": false,
  "visitedCount": 1000,
  "depth": 42
}
```

## Use Cases

- **Transaction Tracing**: Track how funds move between wallets
- **Fraud Investigation**: Find connections between suspicious wallets
- **Token Flow Analysis**: Understand how tokens circulate in the ecosystem
- **Relationship Discovery**: Identify connections between seemingly unrelated wallets
