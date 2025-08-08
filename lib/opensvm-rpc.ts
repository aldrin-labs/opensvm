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

// Parse RPC lists from environment variables
const list1 = parseRpcList(process.env.OPENSVM_RPC_LIST);
const list2 = parseRpcList(process.env.OPENSVM_RPC_LIST_2);

// Combine all RPC endpoints
let opensvmRpcEndpoints = [...list1, ...list2];

// Fallback endpoints if no environment variables are set (enforce OpenSVM RPC servers)
if (opensvmRpcEndpoints.length === 0) {
  console.warn('No OPENSVM_RPC_LIST environment variables found, using OpenSVM RPC server fallback');
  opensvmRpcEndpoints = [
    '/api/proxy/rpc'
  ];
}

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
