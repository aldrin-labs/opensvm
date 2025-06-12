# Routing Architecture Documentation

## Overview

OpenSVM uses Next.js 15 App Router with dynamic routing for blockchain explorer functionality. This document outlines the routing conventions, validation strategies, and error handling patterns.

## Route Structure

### Static Routes
- `/` - Homepage
- `/tokens` - Token listing page
- `/programs` - Program listing page
- `/blocks` - Block listing page
- `/nfts` - NFT listing page

### Dynamic Routes
- `/tx/[signature]` - Transaction details page
- `/account/[address]` - Account details page
- `/block/[slot]` - Block details page
- `/token/[mint]` - Token details page
- `/program/[address]` - Program details page

## Parameter Validation

### Transaction Signatures
- **Format**: Base58 encoded, exactly 88 characters
- **Validation**: `isValidTransactionSignature(signature)`
- **Example**: `3Eq21vXNB5s86c62bVuUfTeaMif1N2kUqRPBmGRJhyTA5E233pZy4kEz3Z7c9E8UwGRZpBPZ`

### Solana Addresses
- **Format**: Base58 encoded, 32-44 characters
- **Validation**: `isValidSolanaAddress(address)`
- **Examples**: 
  - System Program: `11111111111111111111111111111111`
  - Token Program: `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA`

### Block Slots
- **Format**: Positive integers
- **Validation**: Non-negative integer check
- **Example**: `123456789`

## Implementation Pattern

### Server-Side Validation
```typescript
export default async function SomePage({ params }: Props) {
  const { paramName } = await params;
  
  // Validate parameter format
  if (!paramName || !isValidFormat(paramName)) {
    notFound();
  }
  
  // Render component
  return <Component param={paramName} />;
}
```

### Client-Side Navigation Safety
```typescript
const handleClick = (e: React.MouseEvent) => {
  e.preventDefault();
  if (isValidFormat(parameter)) {
    router.push(`/route/${parameter}`);
  }
};
```

## Middleware Integration

The middleware layer provides additional validation:

1. **Legacy URL Redirects**: Converts query-based URLs to path-based
2. **Parameter Validation**: Pre-validates dynamic route parameters
3. **Security Headers**: Adds appropriate security headers
4. **Rate Limiting**: Protects API endpoints

## Best Practices

1. **Always validate parameters** at the page level before rendering
2. **Use `notFound()`** for invalid parameters to trigger 404 responses
3. **Validate client-side** before navigation to prevent unnecessary requests
4. **Provide helpful error messages** in validation utilities
5. **Use TypeScript interfaces** for consistent parameter typing

## Static Generation

Dynamic routes can be optimized using `generateStaticParams`:

```typescript
export async function generateStaticParams() {
  // Return array of common/popular parameters for pre-generation
  return [
    { signature: 'popular-tx-1' },
    { signature: 'popular-tx-2' },
  ];
}
```

## Security Considerations

- All user inputs are validated using base58 format checks
- SQL injection and XSS patterns are rejected by validation
- Path traversal attempts are blocked
- Invalid characters are filtered out

## URL Encoding Handling

Parameters are automatically URL decoded and trimmed:

```typescript
let address = rawAddress;
try {
  address = decodeURIComponent(rawAddress);
} catch (e) {
  // Already decoded
}
address = address.trim();
```

## Testing

Route validation is thoroughly tested with:
- Valid parameter formats
- Invalid character injection attempts
- Edge cases (empty, null, undefined)
- URL encoding/decoding scenarios

See `__tests__/routing-validation.test.ts` for comprehensive test coverage.