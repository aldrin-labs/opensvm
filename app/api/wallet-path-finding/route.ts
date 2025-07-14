import { NextRequest } from 'next/server';
import { createWalletPathFindingMachine } from '@/app/wallet-path-finding/WalletPathFindingMachine';
import { WalletPathCache } from '@/lib/wallet-path-cache';
import { isValidSolanaAddress } from '@/lib/utils';
import { interpret } from 'xstate';

// CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

/**
 * Handle the wallet path finding request
 * This implements a streaming response to provide real-time updates
 */
export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  
  try {
    // Parse the request
    const body = await request.json();
    const { sourceWallet, targetWallet, maxDepth = 42 } = body;
    
    // Validate wallet addresses
    if (!sourceWallet || !targetWallet) {
      return new Response(
        JSON.stringify({ error: 'Source and target wallets are required' }),
        { status: 400, headers: corsHeaders }
      );
    }
    
    if (!isValidSolanaAddress(sourceWallet) || !isValidSolanaAddress(targetWallet)) {
      return new Response(
        JSON.stringify({ error: 'Invalid wallet address format' }),
        { status: 400, headers: corsHeaders }
      );
    }
    
    // Check cache first
    const cachedResult = WalletPathCache.getPathResult(sourceWallet, targetWallet);
    if (cachedResult) {
      console.log(`Using cached path result for ${sourceWallet} to ${targetWallet}`);
      return new Response(
        JSON.stringify({
          sourceWallet,
          targetWallet,
          path: cachedResult.path,
          transferIds: cachedResult.transferIds,
          found: cachedResult.found,
          visitedCount: cachedResult.visitedCount,
          depth: cachedResult.depth,
          timestamp: cachedResult.timestamp,
          cached: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Use ReadableStream for streaming response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send initial message
          controller.enqueue(encoder.encode(JSON.stringify({
            type: 'info',
            message: `Starting path search from ${sourceWallet} to ${targetWallet}...`,
            step: 0
          })));
          
          // Create the state machine
          const pathFindingMachine = createWalletPathFindingMachine();
          
          // Run the state machine
          const service = interpret(pathFindingMachine, { input: { wallet: sourceWallet } });
          
          // Setup state change handler
          service.subscribe((state) => {
            // Stream state updates
            controller.enqueue(encoder.encode(JSON.stringify({
              type: 'progress',
              state: state.value,
              visitedCount: state.context.visitedWallets?.size || 0,
              queueSize: state.context.walletQueue?.length || 0,
              currentWallet: state.context.currentWallet?.address || null,
              found: state.context.found
            }) + '\n'));
          });
          
          // Start the machine
          service.start();
          
          // Send the search event
          service.send({
            type: 'start',
            walletA: sourceWallet,
            walletB: targetWallet,
            maxDepth
          });
          
          // Wait for the machine to reach a final state
          await new Promise<void>((resolve) => {
            const checkState = () => {
              const snapshot = service.getSnapshot();
              const stateValue = snapshot.value;
              
              // Check if we've reached a final state
              if (stateValue === 'success' || stateValue === 'failure') {
                resolve();
                return;
              }
              setTimeout(checkState, 100);
            };
            checkState();
          });
          
          // Get the final state
          const finalState = service.getSnapshot();
          const result = finalState.context.result;
          
          // Cache the result if one was found or if we exhausted the search
          if (result.found || (finalState.value === 'failure')) {
            WalletPathCache.savePathResult({
              sourceWallet,
              targetWallet,
              path: result.path,
              transferIds: result.transferIds,
              found: result.found,
              timestamp: Date.now(),
              depth: result.depth,
              visitedCount: result.visitedCount
            });
          }
          
          // Send final result
          controller.enqueue(encoder.encode(JSON.stringify({
            type: 'result',
            sourceWallet,
            targetWallet,
            path: result.path,
            transferIds: result.transferIds,
            found: result.found,
            visitedCount: result.visitedCount,
            depth: result.depth,
            error: finalState.context.error
          }) + '\n'));
          
          // Close the stream
          controller.close();
        } catch (error) {
          console.error('Error in wallet path finding:', error);
          controller.enqueue(encoder.encode(JSON.stringify({
            type: 'error',
            message: `Error: ${error instanceof Error ? error.message : String(error)}`
          }) + '\n'));
          controller.close();
        }
      }
    });
    
    // Return the streaming response
    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });
  } catch (error) {
    console.error('Error processing request:', error);
    return new Response(
      JSON.stringify({ error: `Error: ${error instanceof Error ? error.message : String(error)}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}
