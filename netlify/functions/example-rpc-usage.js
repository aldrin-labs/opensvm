// Example: How to use RPC configuration in Netlify Functions
// This replaces the need for environment variables in your functions

// Method 1: Import the generated configuration from protected directory
const { getRpcEndpoints, getOpensvmRpcList, getOpensvmRpcList2, OPENSVM_RPC_LIST, OPENSVM_RPC_LIST_2 } = require('../../config/rpc-endpoints');

exports.handler = async (event, context) => {
    try {
        // Method 1: Get full RPC endpoint URLs
        const endpoints = getRpcEndpoints();
        console.log('Available RPC endpoints:', endpoints);

        // Method 2: Get original ID format (what used to be in environment variables)
        const rpcIds1 = getOpensvmRpcList();
        const rpcIds2 = getOpensvmRpcList2();
        console.log('RPC IDs list 1:', rpcIds1);
        console.log('RPC IDs list 2:', rpcIds2);

        // Method 3: Legacy compatibility - use exactly like environment variables
        const legacyList1 = OPENSVM_RPC_LIST;
        const legacyList2 = OPENSVM_RPC_LIST_2;
        console.log('Legacy format list 1:', legacyList1);
        console.log('Legacy format list 2:', legacyList2);

        // Your function logic here
        // Use the RPC endpoints for your Solana operations

        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                endpointCount: endpoints.length,
                availableEndpoints: endpoints
            })
        };

    } catch (error) {
        console.error('Function error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'Internal server error',
                message: error.message
            })
        };
    }
};
