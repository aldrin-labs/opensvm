# Netlify Function Timeout Configuration Research

## Current Situation
- Next.js 15.4.4 app deployed on Netlify
- Using @netlify/plugin-nextjs v5.13.3 (OpenNext adapter)
- Experiencing 504 Gateway Timeout at ~28 seconds
- Need to increase timeout to 120 seconds

## CRITICAL Discovery: Netlify Timeout Limits

### Default Timeouts by Plan
1. **Starter Plan**: 10 seconds (synchronous functions)
2. **Pro Plan**: 26 seconds (synchronous functions)
3. **Business Plan**: 26 seconds (synchronous functions)
4. **Enterprise Plan**: Custom timeouts up to 26 seconds (synchronous functions)

### Background Functions
- All plans: Up to 15 minutes (900 seconds) for background functions
- Background functions must have `-background` suffix in filename

## The Problem
**Netlify does NOT support 120-second timeouts for regular synchronous functions on ANY plan.**

The maximum timeout for synchronous (request/response) functions is **26 seconds**, even on Pro/Business/Enterprise plans.

## Solutions

### Option 1: Convert to Background Functions (Recommended)
For long-running operations that take 45+ seconds:
1. Create background function with `-background` suffix
2. Return immediate 202 response to client
3. Process in background (up to 15 minutes)
4. Store results in Netlify Blobs or database
5. Client polls or uses webhooks for completion

### Option 2: Reduce Processing Time
- Optimize RPC calls
- Implement caching
- Reduce data processing
- Parallelize operations

### Option 3: Use External Service
- Move long-running operations to external service (AWS Lambda, Cloud Functions, etc.)
- Netlify function acts as proxy
- External service has higher timeout limits

### Option 4: Move to Different Platform
- Vercel: Supports up to 300 seconds on Pro plan
- AWS Lambda: Supports up to 900 seconds (15 minutes)
- Google Cloud Functions: Supports up to 540 seconds (9 minutes)

## Netlify Configuration Syntax

### INVALID (causes parse error):
```toml
[functions]
  timeout = 120  # ❌ NOT a valid property
```

### VALID (but doesn't increase timeout beyond 26s):
```toml
# Individual function configuration
[[functions]]
  function = "my-function"
  # No timeout property exists!
```

### VALID (Background function):
```toml
# Background functions get 15-minute timeout automatically
# Just name the file with -background suffix
# Example: netlify/functions/long-task-background.ts
```

## Next Steps

### If staying on Netlify:
1. Convert long-running endpoints to background functions
2. Implement async processing pattern
3. Use Netlify Blobs for result storage
4. Add polling endpoint for clients

### If migrating:
1. Evaluate Vercel (easiest migration for Next.js)
2. Consider AWS/GCP for more control
3. Keep Netlify for static assets, move API elsewhere

## References
- Netlify Function Timeout Limits: https://docs.netlify.com/functions/overview/#default-deployment-options
- Background Functions: https://docs.netlify.com/functions/background-functions/
- OpenNext on Netlify: https://github.com/netlify/next-runtime
