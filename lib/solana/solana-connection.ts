// Compatibility facade for client-side only. Do NOT export server bindings here.
// Server code MUST import from './solana-connection-server' directly to avoid
// leaking server-only code into client bundles.

export {
    getConnection as getClientConnection,
    updateRpcEndpoint as updateClientRpcEndpoint,
    getAvailableRpcEndpoints
} from './solana-connection-client';