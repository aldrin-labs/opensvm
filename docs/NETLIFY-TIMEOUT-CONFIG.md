# Netlify Timeout Configuration

## Summary

This document explains how to configure timeouts for Next.js API routes deployed on Netlify.

## The Problem

We were experiencing 504 Gateway Timeout errors at ~28 seconds on API endpoints that needed more time to complete (especially those calling external APIs or performing complex operations).

## The Solution

For **Netlify deployments**, timeout is controlled **ONLY** by the `netlify.toml` configuration file:

```toml
[functions]
  timeout = 120  # Maximum execution timeout in seconds (max: 120 for Pro plan)
```

## What DOESN'T Work on Netlify

### ❌ `maxDuration` Export (Vercel-Specific)

```typescript
// This is IGNORED by Netlify!
export const maxDuration = 120;
```

**Why it doesn't work:**
- `maxDuration` is a **Vercel-specific** Next.js Route Segment Config
- Netlify's Next.js runtime does NOT read or respect this export
- Adding it to route files has zero effect on Netlify deployments

## What Actually Works on Netlify

### ✅ netlify.toml [functions] Configuration

The **ONLY** way to control function timeout on Netlify:

```toml
[functions]
  timeout = 120  # Sets timeout for ALL serverless functions
```

**Timeout Limits by Plan:**
- Free: 10 seconds
- Pro: 26 seconds (synchronous), 120 seconds with explicit config
- Enterprise: Custom limits available

### ✅ Additional Timeout Configurations

While `netlify.toml` is the primary control, these are also useful:

1. **next.config.mjs** - Global timeout hint (not enforced but useful for CDN):
```javascript
async headers() {
  return [
    {
      source: '/api/:path*',
      headers: [
        { key: 'x-vercel-timeout', value: '120' }, // Hint for CDN
      ],
    },
  ];
}
```

2. **RPC/API Client Timeouts** - Control external request timeouts:
```typescript
// lib/solana/rpc/rpc-retry.ts
const defaultTimeoutMs = 120000; // 120 seconds
```

## Implementation History

### What We Did Wrong (November 2025)

1. ❌ Added `export const maxDuration = 120` to 195+ API route files
2. ❌ Assumed Netlify would read Vercel-specific Route Segment Config
3. ❌ Wasted time on configuration that had zero effect

### What We Fixed

1. ✅ Confirmed `netlify.toml` `[functions] timeout = 120` is the actual solution
2. ✅ Removed all useless `maxDuration` exports 
3. ✅ Documented the correct approach for future reference

## Testing

To verify timeout configuration is working:

1. Deploy to Netlify
2. Monitor function execution time in Netlify Functions logs
3. Test with endpoints that take 30-120 seconds
4. Confirm no 504 errors occur before 120 seconds

## References

- [Netlify Functions Documentation](https://docs.netlify.com/functions/get-started/)
- [Netlify Functions Configuration](https://docs.netlify.com/configure-builds/file-based-configuration/#functions)
- [Next.js on Netlify](https://docs.netlify.com/frameworks/next-js/overview/)

## Key Takeaway

**For Netlify:** Use `netlify.toml` `[functions] timeout` - everything else is ignored.

**For Vercel:** Use `export const maxDuration` in route files - that's where it actually works.
