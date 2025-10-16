# Token Gating Testing Guide

## Overview
The OpenSVM app implements token gating that requires users to hold at least **100,000 $SVMAI tokens** (mint: `Cpzvdx6pppc9TNArsGsqgShCsKC9NCCjA2gtzHvUpump`) to view profile history, statistics, and activity feeds.

## Testing Token Detection

### 1. Test API Endpoint
Use the test endpoint to verify token balance detection:
```bash
curl "http://localhost:3000/api/test-token-balance?wallet=YOUR_WALLET_ADDRESS"
```

### 2. Environment Configuration
Control token gating behavior via environment variables:

```env
# Enable bypass for development/testing
NEXT_PUBLIC_BYPASS_TOKEN_GATING=true

# Disable bypass to test real token detection
NEXT_PUBLIC_BYPASS_TOKEN_GATING=false
```

### 3. Token Balance Detection Methods
The system uses two fallback methods to detect $SVMAI balances:

1. **Primary Method**: `getParsedTokenAccountsByOwner()` - Gets parsed token account data
2. **Fallback Method**: `getTokenAccountsByOwner()` + `getParsedAccountInfo()` - Manual parsing if primary fails

### 4. Debug Logging
Enable detailed logging by checking the browser console and server logs when testing token detection.

## Token Requirements

- **Mint Address**: `Cpzvdx6pppc9TNArsGsqgShCsKC9NCCjA2gtzHvUpump`
- **Minimum Balance**: 100,000 $SVMAI
- **Restricted Features**:
  - Profile history viewing
  - Statistics and analytics
  - Activity feed
  - Applies to all users (including viewing your own profile)

## UI Color Theme
Token gating messages now use the app's theme colors:
- **Restricted Access**: Uses `destructive` theme colors (red variants)
- **Consistent Design**: Matches the app's overall design system
- **Responsive**: Adapts to light/dark mode

## Manual Testing Steps

1. **Set bypass to false** in `.env`:
   ```env
   NEXT_PUBLIC_BYPASS_TOKEN_GATING=false
   ```

2. **Test with a wallet that has $SVMAI**:
   - Visit `/user/WALLET_WITH_SVMAI_ADDRESS`
   - Should see full access to all tabs

3. **Test with a wallet without $SVMAI**:
   - Visit `/user/WALLET_WITHOUT_SVMAI_ADDRESS`
   - Should see token gating messages and restricted access

4. **Test the API directly**:
   ```bash
   curl "http://localhost:3000/api/test-token-balance?wallet=WALLET_ADDRESS"
   ```

5. **Check server logs** for detailed token detection information.

## Troubleshooting

### Balance Shows 0 But User Has Tokens
1. Verify the mint address: `Cpzvdx6pppc9TNArsGsqgShCsKC9NCCjA2gtzHvUpump`
2. Check server logs for token account detection details
3. Test with the `/api/test-token-balance` endpoint
4. Ensure the RPC connection is working properly

### UI Theme Issues
- Token gating messages should use red/destructive colors
- If seeing orange colors, check for cached CSS
- Verify the component is using theme variables: `text-destructive`, `border-destructive/50`, etc.

## Production Deployment

For production:
1. Set `NEXT_PUBLIC_BYPASS_TOKEN_GATING=false`
2. Test with real wallets and token balances
3. Monitor server logs for any detection issues
4. Ensure RPC endpoints are reliable and rate-limited appropriately
