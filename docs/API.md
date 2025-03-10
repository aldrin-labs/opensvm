# OpenSVM API Reference

This document provides detailed information about the API endpoints available in the OpenSVM explorer.

## API Overview

OpenSVM provides a set of RESTful API endpoints that allow developers to access blockchain data programmatically. These endpoints are organized by resource type and follow consistent patterns for request and response formats.

## Base URL

All API endpoints are relative to the base URL of your OpenSVM deployment:

```
https://your-opensvm-instance.com/api
```

## Authentication

Most API endpoints are publicly accessible without authentication. Rate limiting may apply to prevent abuse.

## Common Response Formats

All API responses follow a consistent JSON format:

```json
{
  "success": true,
  "data": { ... },
  "error": null
}
```

Or in case of an error:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "ERROR_CODE",
    "message": "Error description"
  }
}
```

## API Endpoints

### Block Data

#### Get Block Details

```
GET /block?slot={slot}
```

Retrieves detailed information about a specific block.

**Parameters:**
- `slot` (required): The slot number of the block

**Response:**
```json
{
  "success": true,
  "data": {
    "slot": 123456789,
    "blockhash": "hash123...",
    "parentSlot": 123456788,
    "blockTime": 1632150000,
    "previousBlockhash": "hash122...",
    "transactions": [
      {
        "signature": "sig123...",
        "type": "Success",
        "timestamp": 1632150000
      }
    ],
    "transactionCount": 100,
    "successCount": 95,
    "failureCount": 5,
    "totalSolVolume": 1000.5,
    "totalFees": 0.01,
    "rewards": [
      {
        "pubkey": "val123...",
        "lamports": 1000000,
        "postBalance": 100000000,
        "rewardType": "Fee"
      }
    ],
    "programs": [
      {
        "address": "prog123...",
        "count": 50,
        "name": "Token Program"
      }
    ]
  },
  "error": null
}
```

#### Get Recent Blocks

```
GET /blocks?limit={limit}&before={slot}
```

Retrieves a list of recent blocks.

**Parameters:**
- `limit` (optional): Number of blocks to return (default: 10, max: 100)
- `before` (optional): Return blocks before this slot

**Response:**
```json
{
  "success": true,
  "data": {
    "blocks": [
      {
        "slot": 123456789,
        "blockhash": "hash123...",
        "blockTime": 1632150000,
        "transactionCount": 100
      }
    ]
  },
  "error": null
}
```

### Transaction Data

#### Get Transaction Details

```
GET /transaction?signature={signature}
```

Retrieves detailed information about a specific transaction.

**Parameters:**
- `signature` (required): The transaction signature

**Response:**
```json
{
  "success": true,
  "data": {
    "signature": "sig123...",
    "timestamp": 1632150000,
    "slot": 123456789,
    "success": true,
    "type": "sol",
    "details": {
      "instructions": [
        {
          "program": "System Program",
          "programId": "11111111111111111111111111111111",
          "parsed": {
            "type": "transfer",
            "info": {
              "source": "src123...",
              "destination": "dst123...",
              "lamports": 1000000000
            }
          }
        }
      ],
      "accounts": [
        {
          "pubkey": "acc123...",
          "signer": true,
          "writable": true
        }
      ],
      "preBalances": [10000000000],
      "postBalances": [9000000000],
      "logs": ["Program 11111111111111111111111111111111 invoke [1]", "..."]
    }
  },
  "error": null
}
```

#### Analyze Transaction

```
POST /analyze-transaction
```

Provides an AI-generated analysis of a transaction.

**Request Body:**
```json
{
  "logs": ["Program 11111111111111111111111111111111 invoke [1]", "..."],
  "type": "sol",
  "status": "success",
  "amount": 1.0,
  "from": "src123...",
  "to": "dst123..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "analysis": "This transaction represents a transfer of 1 SOL from wallet src123... to wallet dst123... The transaction was successful and executed through the System Program."
  },
  "error": null
}
```

### Account Data

#### Get Account Information

```
GET /account-stats?address={address}
```

Retrieves information about a specific account.

**Parameters:**
- `address` (required): The account address

**Response:**
```json
{
  "success": true,
  "data": {
    "address": "acc123...",
    "lamports": 1000000000,
    "owner": "11111111111111111111111111111111",
    "executable": false,
    "rentEpoch": 123,
    "txCount": 50,
    "solTransfers": 10,
    "tokenTransfers": 40
  },
  "error": null
}
```

#### Get Account Transactions

```
GET /account-transactions?address={address}&limit={limit}&before={signature}
```

Retrieves transactions associated with an account.

**Parameters:**
- `address` (required): The account address
- `limit` (optional): Number of transactions to return (default: 10, max: 100)
- `before` (optional): Return transactions before this signature (for pagination)

**Response:**
```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "signature": "sig123...",
        "timestamp": 1632150000,
        "slot": 123456789,
        "success": true,
        "type": "sol"
      }
    ]
  },
  "error": null
}
```

### Token Data

#### Get Token Information

```
GET /token?address={address}
```

Retrieves information about a specific token.

**Parameters:**
- `address` (required): The token mint address

**Response:**
```json
{
  "success": true,
  "data": {
    "address": "mint123...",
    "symbol": "TOKEN",
    "name": "Example Token",
    "decimals": 9,
    "totalSupply": 1000000000,
    "owner": "auth123...",
    "frozen": false
  },
  "error": null
}
```

#### Get Token Statistics

```
GET /token-stats?address={address}
```

Retrieves statistics about a specific token.

**Parameters:**
- `address` (required): The token mint address

**Response:**
```json
{
  "success": true,
  "data": {
    "address": "mint123...",
    "holders": 1000,
    "transactions": 5000,
    "volume24h": 100000,
    "priceUsd": 1.23
  },
  "error": null
}
```

### Program Data

#### Get Program Information

```
GET /program?address={address}
```

Retrieves information about a specific program.

**Parameters:**
- `address` (required): The program address

**Response:**
```json
{
  "success": true,
  "data": {
    "address": "prog123...",
    "name": "Example Program",
    "version": "1.0.0",
    "executable": true,
    "owner": "BPFLoaderUpgradeab1e11111111111111111111111",
    "invocations": 10000,
    "accounts": 500
  },
  "error": null
}
```

### Search

#### Search Blockchain Data

```
GET /search?q={query}
```

Searches for blockchain data matching the query.

**Parameters:**
- `q` (required): The search query (transaction signature, account address, etc.)

**Response:**
```json
{
  "success": true,
  "data": {
    "type": "transaction",
    "result": {
      "signature": "sig123...",
      "timestamp": 1632150000,
      "slot": 123456789,
      "success": true
    }
  },
  "error": null
}
```

### Wallet Path Finding

#### Find Path Between Wallets

```
POST /wallet-path-finding
```

Finds a path between two wallet addresses through token transfers.

**Request Body:**
```json
{
  "sourceWallet": "src123...",
  "targetWallet": "dst123...",
  "maxDepth": 42
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "found": true,
    "path": ["src123...", "intermediate123...", "dst123..."],
    "transferIds": ["tx1...", "tx2..."],
    "visitedCount": 42,
    "depth": 2
  },
  "error": null
}
```

### AI Assistant

#### Chat with AI

```
POST /chat
```

Sends a message to the AI assistant and receives a response.

**Request Body:**
```json
{
  "message": "Explain how Solana transactions work",
  "history": [
    {"role": "user", "content": "Hello"},
    {"role": "assistant", "content": "Hi! How can I help you with Solana today?"}
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "response": "Solana transactions work by...",
    "actions": [
      {
        "type": "link",
        "text": "View Transaction Structure",
        "url": "/docs/transactions"
      }
    ]
  },
  "error": null
}
```

## Error Codes

| Code | Description |
|------|-------------|
| `INVALID_PARAMETER` | One or more parameters are invalid |
| `RESOURCE_NOT_FOUND` | The requested resource was not found |
| `RATE_LIMIT_EXCEEDED` | Too many requests, please try again later |
| `INTERNAL_ERROR` | An internal server error occurred |
| `RPC_ERROR` | Error communicating with Solana RPC |

## Rate Limiting

API requests are rate-limited to prevent abuse. The current limits are:

- 100 requests per minute per IP address
- 1000 requests per hour per IP address

When rate limits are exceeded, the API will return a 429 Too Many Requests status code.

## Streaming Responses

Some endpoints support streaming responses for long-running operations:

- `/wallet-path-finding` - Streams progress updates during path finding
- `/chat` - Streams AI assistant responses as they are generated

Streaming responses use newline-delimited JSON objects.

## Websocket API

In addition to REST endpoints, OpenSVM provides a WebSocket API for real-time updates:

```
wss://your-opensvm-instance.com/api/ws
```

Available channels:
- `blocks` - Real-time block updates
- `transactions` - Real-time transaction updates
- `network` - Real-time network statistics