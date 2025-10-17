# Session-Based Authentication System

## Overview

The OpenSVM app now uses a **"sign once"** authentication system that eliminates the need for users to sign messages on every request. Users authenticate once and receive a persistent 7-day session.

## How It Works

### 1. **One-Time Authentication Flow**
```typescript
// User connects wallet
// User clicks "Sign In (One Time)" 
// App calls: POST /api/auth/session -> gets message to sign
// User signs message (ONLY TIME SIGNATURE IS REQUIRED)
// App calls: POST /api/auth/verify -> creates persistent session
// Session stored as HTTP-only cookie for 7 days
```

### 2. **Subsequent API Calls**
```typescript
// All social actions (follow, like, view) use session automatically
// No more signatures required!
// Session cookie sent with credentials: 'include'
```

## Key Components

### **Authentication Context** (`/contexts/AuthContext.tsx`)
- Provides app-wide authentication state
- Handles login/logout/session refresh
- Eliminates need for individual components to manage auth

### **Session Management** 
- `POST /api/auth/session` - Create session and get message to sign
- `POST /api/auth/verify` - Verify signature and establish session  
- `GET /api/auth/session` - Check current session status
- `POST /api/auth/logout` - Clear session

### **Token Gating Integration**
- Checks $SVMAI balance once during session creation
- Token access cached for session duration
- No repeated balance checks on every page view

## Usage Examples

### **In React Components**
```typescript
import { useCurrentUser } from '@/contexts/AuthContext';

function MyComponent() {
  const { isAuthenticated, walletAddress } = useCurrentUser();
  
  // Use authentication state without making API calls
  if (isAuthenticated) {
    // User is signed in for 7 days
  }
}
```

### **In API Routes**
```typescript
import { getSessionFromCookie } from '@/lib/auth-server';

export async function POST(request: Request) {
  const session = getSessionFromCookie();
  if (!session || Date.now() > session.expiresAt) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // Use session.walletAddress - no signature verification needed!
}
```

## Benefits

✅ **Better UX**: Sign once, use for 7 days  
✅ **No Signature Fatigue**: Eliminate repeated wallet prompts  
✅ **Secure**: HTTP-only cookies prevent XSS attacks  
✅ **Efficient**: Cached authentication state  
✅ **Token Gating**: Integrated $SVMAI balance checking  

## Development Mode

Set `NEXT_PUBLIC_BYPASS_TOKEN_GATING=true` in `.env` to:
- Bypass signature verification (development only)
- Simulate sufficient $SVMAI balance
- Enable easier testing

## Security Notes

- Sessions expire after 7 days
- HTTP-only cookies prevent client-side access
- Signature verification relaxed in development mode
- Production should implement proper cryptographic verification
