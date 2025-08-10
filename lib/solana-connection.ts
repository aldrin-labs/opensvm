// Universal Solana connection that works on both client and server
// For server-side usage, import from solana-connection-server directly
// For client-side usage, import from solana-connection-client directly

// This file exists for compatibility but direct imports are preferred
export { getConnection } from './solana-connection-server';

// Client-side exports (for compatibility)
export {
    getConnection as getClientConnection,
    updateRpcEndpoint as updateClientRpcEndpoint,
    getAvailableRpcEndpoints
} from './solana-connection-client';