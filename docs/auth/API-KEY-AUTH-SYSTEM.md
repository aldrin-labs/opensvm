# API Key Authentication System

**Date:** November 10, 2025  
**Feature:** Wallet-bound API keys for CLI tools and bots  
**Status:** ✅ Implemented

---

## Overview

The API Key Authentication System allows you to generate API keys and bind them to Solana wallets via a secure auth link flow. This enables:

- **CLI Tools:** Use API keys in command-line scripts
- **Telegram Bots:** Authenticate bot requests with user wallets
- **Third-party Integrations:** Secure API access with wallet verification
- **Automated Scripts:** Run automated tasks with proper authentication

---

## Architecture

### Flow Diagram

```
1. Generate API Key
   ↓
2. Create Auth Link
   ↓
3. User Opens Link → Connects Wallet → Signs Message
   ↓
4. Wallet Bound to API Key
   ↓
5. Use API Key in CLI/Bot
```

### Components

1. **API Key Service** (`lib/api-auth/service.ts`)
   - Generates secure API keys
   - Creates one-time auth links
   - Verifies wallet signatures
   - Manages key lifecycle

2. **API Endpoints**
   - `POST /api/auth/api-keys/create` - Create new API key
   - `POST /api/auth/auth-link/create` - Generate auth link
   - `POST /api/auth/bind-wallet` - Bind wallet to key

3. **Wallet Binding UI** (`app/auth/bind/page.tsx`)
   - User-friendly wallet connection interface
   - Signature verification
   - Success/error feedback

4. **CLI Script** (`scripts/create-api-key.js`)
   - Command-line API key generation
   - Automatic auth link creation
   - Usage examples

---

## Quick Start

### 1. Create an API Key

```bash
# Using the CLI script
node scripts/create-api-key.js --name "My Bot"

# Or via API
curl -X POST http://localhost:3000/api/auth/api-keys/create \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Bot",
    "generateAuthLink": true
  }'
```

**Response:**
```json
{
  "success": true,
  "apiKey": {
    "id": "abc123...",
    "name": "My Bot",
    "status": "pending",
    "createdAt": "2025-11-10T12:00:00Z",
    "permissions": ["read:*"]
  },
  "rawKey": "osvm_1234567890abcdef...",
  "authLink": "http://localhost:3000/auth/bind?token=xyz789...",
  "authLinkExpiresAt": "2025-11-10T12:15:00Z"
}
```

⚠️ **Important:** Save the `rawKey` - it will not be shown again!

### 2. Bind Wallet to API Key

1. Open the `authLink` in your browser
2. Connect your Solana wallet (Phantom, Solflare, etc.)
3. Click "Authorize API Key"
4. Sign the message in your wallet
5. ✅ Wallet is now bound to the API key

### 3. Use the API Key

```bash
# Set as environment variable
export OPENSVM_API_KEY="osvm_1234567890abcdef..."

# Use in requests
curl -H "Authorization: Bearer $OPENSVM_API_KEY" \
  http://localhost:3000/api/transactions/...
```

---

## API Reference

### Create API Key

**Endpoint:** `POST /api/auth/api-keys/create`

**Request Body:**
```typescript
{
  name: string;                    // Required: Name for the API key
  permissions?: string[];          // Optional: Default ["read:*"]
  expiresInDays?: number;          // Optional: Expiration in days
  metadata?: Record<string, any>;  // Optional: Custom metadata
  generateAuthLink?: boolean;      // Optional: Auto-generate auth link
}
```

**Response:**
```typescript
{
  success: boolean;
  apiKey: {
    id: string;
    name: string;
    status: 'pending' | 'active' | 'revoked';
    createdAt: Date;
    expiresAt?: Date;
    permissions: string[];
  };
  rawKey: string;                  // Only returned once!
  authLink?: string;               // If generateAuthLink: true
  authLinkExpiresAt?: Date;
  message: string;
}
```

### Create Auth Link

**Endpoint:** `POST /api/auth/auth-link/create`

**Request Body:**
```typescript
{
  apiKeyId: string;                // Required: API key ID
  expiresInMinutes?: number;       // Optional: Default 15 minutes
}
```

**Response:**
```typescript
{
  success: boolean;
  authLink: string;                // Full URL to binding page
  expiresAt: Date;
  token: string;
  message: string;
}
```

### Bind Wallet

**Endpoint:** `POST /api/auth/bind-wallet`

**Request Body:**
```typescript
{
  token: string;                   // Required: Auth link token
  walletAddress: string;           // Required: Solana wallet address
  signature: string;               // Required: Base64 signature
  message: string;                 // Required: Signed message
}
```

**Response:**
```typescript
{
  success: boolean;
  apiKeyId: string;
  walletAddress: string;
  message: string;
}
```

---

## CLI Script Usage

### Basic Usage

```bash
# Create API key with default settings
node scripts/create-api-key.js

# Create with custom name
node scripts/create-api-key.js --name "Telegram Bot"

# Create with expiration
node scripts/create-api-key.js --name "Test Key" --expires 7

# Create without auth link
node scripts/create-api-key.js --no-auth-link
```

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `--name <name>` | Name for the API key | "CLI Tool" |
| `--expires <days>` | Expiration in days | Never |
| `--no-auth-link` | Don't generate auth link | false |
| `--help, -h` | Show help message | - |

### Environment Variables

```bash
# Set API base URL (default: http://localhost:3000)
export API_BASE_URL="https://opensvm.com"

# Run script
node scripts/create-api-key.js
```

---

## Security Features

### 1. API Key Hashing
- API keys are hashed with SHA-256 before storage
- Raw keys are only shown once during creation
- Impossible to retrieve raw key after creation

### 2. Wallet Signature Verification
- Uses Solana's ed25519 signature verification
- Verifies wallet ownership before binding
- Prevents unauthorized key binding

### 3. One-Time Auth Links
- Auth tokens are single-use only
- Expire after 15 minutes (configurable)
- Cannot be reused after wallet binding

### 4. Key Status Management
- **pending:** Awaiting wallet binding
- **active:** Wallet bound, ready to use
- **revoked:** Permanently disabled

---

## Integration Examples

### Node.js CLI Tool

```javascript
const OPENSVM_API_KEY = process.env.OPENSVM_API_KEY;

async function getTransaction(signature) {
  const response = await fetch(
    `https://opensvm.com/api/transactions/${signature}`,
    {
      headers: {
        'Authorization': `Bearer ${OPENSVM_API_KEY}`
      }
    }
  );
  
  return response.json();
}
```

### Telegram Bot

```javascript
const TelegramBot = require('node-telegram-bot-api');

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
const OPENSVM_API_KEY = process.env.OPENSVM_API_KEY;

bot.onText(/\/tx (.+)/, async (msg, match) => {
  const signature = match[1];
  
  const response = await fetch(
    `https://opensvm.com/api/transactions/${signature}`,
    {
      headers: {
        'Authorization': `Bearer ${OPENSVM_API_KEY}`
      }
    }
  );
  
  const data = await response.json();
  bot.sendMessage(msg.chat.id, `Transaction: ${JSON.stringify(data)}`);
});
```

### Python Script

```python
import os
import requests

OPENSVM_API_KEY = os.getenv('OPENSVM_API_KEY')

def get_transaction(signature):
    headers = {
        'Authorization': f'Bearer {OPENSVM_API_KEY}'
    }
    
    response = requests.get(
        f'https://opensvm.com/api/transactions/{signature}',
        headers=headers
    )
    
    return response.json()
```

---

## Workflow Examples

### For CLI Tools

1. **Developer creates API key:**
   ```bash
   node scripts/create-api-key.js --name "My CLI Tool"
   ```

2. **Developer saves the API key:**
   ```bash
   echo "OPENSVM_API_KEY=osvm_..." >> .env
   ```

3. **Developer shares auth link with user:**
   ```
   Send this link to bind your wallet:
   http://localhost:3000/auth/bind?token=xyz...
   ```

4. **User binds wallet:**
   - Opens link
   - Connects wallet
   - Signs message
   - ✅ Done!

5. **CLI tool now works with user's wallet:**
   ```bash
   ./my-cli-tool --action transfer
   ```

### For Telegram Bots

1. **Bot owner creates API key:**
   ```bash
   node scripts/create-api-key.js --name "Telegram Bot"
   ```

2. **Bot sends auth link to user:**
   ```
   /start command → Bot sends auth link
   ```

3. **User binds wallet via link**

4. **Bot can now make authenticated requests on behalf of user**

---

## Storage

### Current Implementation

- **Qdrant Vector Database:** API keys and auth links stored in Qdrant
- **Persistent Storage:** Data survives server restarts
- **Production-Ready:** Fully integrated with existing Qdrant infrastructure
- **Indexed Lookups:** Fast queries using payload indexes

### Qdrant Collections

**API Keys Collection (`api_keys`):**
- Stores hashed API keys with metadata
- Indexed fields: `key`, `userId`, `status`
- Vector size: 384 dimensions
- Distance metric: Cosine

**Auth Links Collection (`auth_links`):**
- Stores one-time auth tokens
- Indexed fields: `token`, `apiKeyId`, `status`
- Vector size: 384 dimensions
- Distance metric: Cosine

### Configuration

Ensure Qdrant is configured in your environment:

```bash
# .env or .env.local
QDRANT_SERVER=http://localhost:6333
```

The system automatically creates collections and indexes on first use.

---

## Best Practices

### 1. API Key Management

✅ **DO:**
- Store API keys in environment variables
- Use different keys for different environments
- Rotate keys periodically
- Revoke unused keys

❌ **DON'T:**
- Commit API keys to version control
- Share API keys in plain text
- Use the same key across multiple services
- Store keys in client-side code

### 2. Auth Link Sharing

✅ **DO:**
- Send auth links via secure channels
- Set appropriate expiration times
- Verify user identity before sharing
- Log auth link usage

❌ **DON'T:**
- Post auth links publicly
- Reuse auth links
- Share links without context
- Use long expiration times

### 3. Wallet Binding

✅ **DO:**
- Verify wallet ownership
- Show clear binding confirmation
- Allow users to unbind wallets
- Log binding events

❌ **DON'T:**
- Skip signature verification
- Bind without user consent
- Allow multiple bindings per key
- Store private keys

---

## Troubleshooting

### "Invalid auth token"

**Cause:** Token expired, already used, or invalid

**Solution:**
- Generate a new auth link
- Check token hasn't expired (15 min default)
- Ensure token is copied correctly

### "Invalid wallet signature"

**Cause:** Signature verification failed

**Solution:**
- Ensure wallet is connected
- Try signing again
- Check wallet is Solana-compatible
- Verify message matches exactly

### "API key not found"

**Cause:** API key doesn't exist or was revoked

**Solution:**
- Verify API key is correct
- Check key hasn't been revoked
- Generate a new API key if needed

### "Wallet signature and message are required"

**Cause:** Missing signature or message in request

**Solution:**
- Ensure wallet is connected
- Complete the signing process
- Check network connection

---

## Future Enhancements

### Planned Features

- [ ] Database persistence
- [ ] API key rotation
- [ ] Multiple wallet binding per key
- [ ] Webhook notifications
- [ ] Usage analytics
- [ ] Rate limiting per key
- [ ] Key scopes and permissions
- [ ] Admin dashboard for key management

### Potential Improvements

- OAuth2-style token refresh
- Key delegation/sub-keys
- Automatic key expiration warnings
- Audit log for key usage
- IP whitelisting
- Geographic restrictions

---

## Related Documentation

- **Authentication Context:** `contexts/AuthContext.tsx`
- **Wallet Provider:** `app/providers/WalletProvider.tsx`
- **API Types:** `lib/api-auth/types.ts`
- **Service Implementation:** `lib/api-auth/service.ts`

---

## Support

For issues or questions:
1. Check this documentation
2. Review error messages
3. Check browser console for details
4. Verify wallet connection
5. Try generating a new API key

---

**Document End**
