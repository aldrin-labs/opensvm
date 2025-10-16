# RPC Configuration Solution for Netlify Functions

## Problem
Netlify deployment was failing with error:
```
Your environment variables exceed the 4KB limit imposed by AWS Lambda
```

The `OPENSVM_RPC_LIST` and `OPENSVM_RPC_LIST_2` environment variables were too large to pass to Lambda functions.

## Solution
Instead of passing large environment variables to Lambda functions, we generate static configuration files at build time.

## How It Works

### 1. Build-Time Generation
The `scripts/build-rpc-config.js` script runs during deployment and:
- Reads `OPENSVM_RPC_LIST` and `OPENSVM_RPC_LIST_2` from environment variables
- Generates static configuration files that functions can import
- Creates both JSON and JavaScript module formats

### 2. Generated Files
- `lib/rpc-config.json` - JSON configuration file
- `lib/rpc-config.ts` - TypeScript module for Next.js components  
- `lib/rpc-endpoints.js` - CommonJS module for Netlify functions

### 3. Function Usage
Functions can now import RPC configuration instead of using environment variables:

```javascript
// Old way (causes 4KB limit error):
const rpcList1 = JSON.parse(process.env.OPENSVM_RPC_LIST);
const rpcList2 = JSON.parse(process.env.OPENSVM_RPC_LIST_2);

// New way (no environment variable size limits):
const { getOpensvmRpcList, getOpensvmRpcList2 } = require('../../lib/rpc-endpoints');
const rpcList1 = getOpensvmRpcList();
const rpcList2 = getOpensvmRpcList2();
```

## Configuration

### netlify.toml Changes
- Build command includes RPC config generation: `node scripts/build-rpc-config.js && next build`
- Functions include the generated config files: `included_files = ["lib/rpc-config.json", "lib/rpc-endpoints.js"]`
- Only essential environment variables are passed to functions (API keys, not large RPC lists)

### Environment Variables Still Needed
- `OPENSVM_RPC_LIST` - Used during build time only
- `OPENSVM_RPC_LIST_2` - Used during build time only  
- `ANTHROPIC_API_KEY` - Passed to functions (small size)
- `TOGETHER_API_KEY` - Passed to functions (small size)

## Usage Examples

### In Netlify Functions
```javascript
const { getRpcEndpoints, getOpensvmRpcList, OPENSVM_RPC_LIST } = require('../../lib/rpc-endpoints');

// Get full endpoint URLs
const endpoints = getRpcEndpoints();

// Get original ID format
const rpcIds = getOpensvmRpcList();

// Legacy compatibility
const legacyIds = OPENSVM_RPC_LIST;
```

### In Next.js Components
```typescript
import { getRpcEndpoints, getOpensvmRpcList } from '../lib/rpc-config';

const endpoints = getRpcEndpoints();
const rpcIds = getOpensvmRpcList();
```

## Benefits
1. ✅ No more 4KB environment variable limit errors
2. ✅ Faster function startup (no JSON parsing of large strings)
3. ✅ Better performance (static imports vs runtime parsing)
4. ✅ Backward compatibility maintained
5. ✅ Type safety with TypeScript modules

## Files Modified
- `netlify.toml` - Updated build process and function configuration
- `scripts/build-rpc-config.js` - New build script
- `lib/opensvm-rpc.ts` - Updated to use build-time config
- `.gitignore` - Added generated files

## Files Generated (at build time)
- `lib/rpc-config.json` - JSON configuration
- `lib/rpc-config.ts` - TypeScript module
- `lib/rpc-endpoints.js` - CommonJS module for functions
