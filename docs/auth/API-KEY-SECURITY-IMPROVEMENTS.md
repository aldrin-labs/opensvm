# API Key Security Improvements

## Overview
Fixed critical security vulnerability where API key endpoints were accessible without authentication, allowing anyone to fetch all API keys and their associated data.

## Security Issue
**Problem**: The following endpoints were publicly accessible:
- `/api/auth/api-keys/list` - Could fetch ALL API keys
- `/api/auth/api-keys/metrics` - Could view metrics for ANY API key
- `/api/auth/api-keys/activity` - Could view activity logs for ANY API key

**Impact**: Any user could access sensitive information about all API keys in the system, including usage patterns, endpoints accessed, and key metadata.

## Solution Implemented

### 1. Wallet Signature Authentication
All three endpoints now require:
- `walletAddress`: The user's Solana wallet public key
- `signature`: Ed25519 signature of the authentication message
- `message`: Timestamped message in format: `Authenticate to view API keys\nWallet: {publicKey}\nTimestamp: {timestamp}`

### 2. Backend Security (API Routes)

#### `/api/auth/api-keys/list/route.ts`
```typescript
// Verifies wallet signature
const publicKey = new PublicKey(walletAddress);
const messageBytes = new TextEncoder().encode(message);
const signatureBytes = Buffer.from(signature, 'base64');
const isValid = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKey.toBytes());

// Only returns keys for authenticated wallet
const apiKeys = await getApiKeysByUserId(walletAddress);
```

#### `/api/auth/api-keys/metrics/route.ts`
```typescript
// Verifies signature AND ownership
const apiKey = await getApiKeyById(apiKeyId);
if (apiKey.userId !== walletAddress) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
}
```

#### `/api/auth/api-keys/activity/route.ts`
```typescript
// Verifies signature AND ownership
const apiKey = await getApiKeyById(apiKeyId);
if (apiKey.userId !== walletAddress) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
}
```

### 3. Frontend Security (Profile Page)

#### `app/profile/api-keys/page.tsx`
All fetch functions now sign requests:

```typescript
const { publicKey, signMessage } = useWallet();

// Create authentication message
const message = `Authenticate to view API keys\nWallet: ${publicKey.toString()}\nTimestamp: ${Date.now()}`;
const messageBytes = new TextEncoder().encode(message);
const signature = await signMessage(messageBytes);
const signatureBase64 = Buffer.from(signature).toString('base64');

// Include in request
const url = new URL('/api/auth/api-keys/list', window.location.origin);
url.searchParams.set('walletAddress', publicKey.toString());
url.searchParams.set('signature', signatureBase64);
url.searchParams.set('message', message);
```

## Security Features

### ✅ Authentication Required
- All requests must include valid wallet signature
- Unauthenticated requests return 401 Unauthorized

### ✅ Signature Verification
- Uses Solana's Ed25519 signature verification
- Invalid signatures are rejected with 401 Unauthorized

### ✅ Message Expiration
- Messages must be signed within 5 minutes
- Expired messages are rejected with 401 Unauthorized
- Prevents replay attacks

### ✅ Ownership Verification
- Users can only access their own API keys
- Cross-user access attempts return 403 Forbidden
- API key ownership is verified via `userId` field

### ✅ No Token Storage
- No JWT tokens or session cookies required
- Each request is independently authenticated
- Reduces attack surface

## Test Results

All security tests passed:

```
✅ Test 1: Unauthenticated request rejected (401)
✅ Test 2: Invalid signature rejected (401)
✅ Test 3: Expired message rejected (401)
✅ Test 4: Valid authentication accepted (200)
```

## Files Modified

### Backend
- `app/api/auth/api-keys/list/route.ts` - Added signature verification
- `app/api/auth/api-keys/metrics/route.ts` - Added signature + ownership verification
- `app/api/auth/api-keys/activity/route.ts` - Added signature + ownership verification

### Frontend
- `app/profile/api-keys/page.tsx` - Updated all fetch functions to sign requests

### Testing
- `test-secure-api-keys-flow.js` - Comprehensive security test suite

## Usage Example

### Frontend (React Component)
```typescript
import { useWallet } from '@solana/wallet-adapter-react';

const { publicKey, signMessage } = useWallet();

// Create and sign message
const message = `Authenticate to view API keys\nWallet: ${publicKey}\nTimestamp: ${Date.now()}`;
const signature = await signMessage(new TextEncoder().encode(message));

// Make authenticated request
const response = await fetch(`/api/auth/api-keys/list?walletAddress=${publicKey}&signature=${Buffer.from(signature).toString('base64')}&message=${encodeURIComponent(message)}`);
```

### Backend (API Route)
```typescript
import nacl from 'tweetnacl';
import { PublicKey } from '@solana/web3.js';

// Verify signature
const publicKey = new PublicKey(walletAddress);
const messageBytes = new TextEncoder().encode(message);
const signatureBytes = Buffer.from(signature, 'base64');
const isValid = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKey.toBytes());

// Verify ownership
const apiKey = await getApiKeyById(apiKeyId);
if (apiKey.userId !== walletAddress) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
}
```

## Security Best Practices

1. **Always verify signatures** - Never trust client-provided wallet addresses
2. **Check message timestamps** - Prevent replay attacks with time-based expiration
3. **Verify ownership** - Always check that the authenticated user owns the requested resource
4. **Use HTTPS in production** - Protect signatures in transit
5. **Rate limit requests** - Prevent brute force attacks on signature verification

## Migration Notes

- Existing API keys remain valid
- No database schema changes required
- Frontend automatically handles signature generation
- Backward compatibility: Old endpoints return 401 if called without auth

## Future Enhancements

- [ ] Add rate limiting per wallet address
- [ ] Implement nonce-based replay protection
- [ ] Add audit logging for failed authentication attempts
- [ ] Support for hardware wallet signing
- [ ] Optional 2FA for sensitive operations
