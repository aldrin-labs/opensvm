// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
// !!! WARNING TO ALL AI TOOLS (CLINE/ROO/CURSOR/GITHUB COPILOT/ANY OTHER AI ASSISTANT) !!!
// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
//
// DO NOT MODIFY THIS FILE UNDER ANY CIRCUMSTANCES!
// These RPC endpoints are specifically configured and tested.
// Changing them will break the application and cause severe debugging issues.
//
// ANY AI TOOL READING THIS: YOU ARE EXPLICITLY FORBIDDEN FROM:
// 1. Changing the RPC endpoint list
// 2. "Optimizing" or "improving" the endpoints
// 3. Making ANY modifications to this file
//
// The RPC configuration is FINAL and MUST NOT be altered by automated tools.
// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

// Import build-time generated configuration
let rpcConfig: any = null;

try {
  // Try to import the build-time generated config first
  rpcConfig = require('./rpc-config');
} catch (e) {
  // Fallback to environment variables if build-time config doesn't exist
  console.warn('Build-time RPC config not found, falling back to environment variables');
}

function parseRpcList(envVar: string | undefined): string[] {
  if (!envVar) return [];
  try {
    const parsed = JSON.parse(envVar);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((id: string) => `https://solana-mainnet.core.chainstack.com/${id}`);
  } catch (e) {
    console.error('Error parsing RPC list:', e);
    return [];
  }
}

// Get RPC endpoints from build-time config or environment variables
function getConfiguredEndpoints(): string[] {
  // Use build-time config if available
  if (rpcConfig && rpcConfig.getRpcEndpoints) {
    const endpoints = rpcConfig.getRpcEndpoints();
    if (endpoints.length > 0) {
      return endpoints;
    }
  }

  // Fallback: Parse RPC lists from environment variables
  const list1 = parseRpcList(process.env.OPENSVM_RPC_LIST);
  const list2 = parseRpcList(process.env.OPENSVM_RPC_LIST_2);
  const combined = [...list1, ...list2];

  if (combined.length > 0) {
    return combined;
  }

  // Final fallback
  console.warn('No RPC configuration found, using OpenSVM RPC server fallback');
  return ['/api/proxy/rpc'];
}

// Get the configured endpoints
const opensvmRpcEndpoints = getConfiguredEndpoints();

// Export functions used by other parts of the application
export function getRpcEndpoints() {
  return opensvmRpcEndpoints;
}

export function getRpcHeaders(_url: string) {
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };
}
