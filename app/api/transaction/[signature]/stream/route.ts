import { NextRequest } from 'next/server';
import type { DetailedTransactionInfo } from '@/lib/solana';
import { getConnection } from '@/lib/solana-connection';
import type { ParsedTransactionWithMeta } from '@solana/web3.js';
import { PublicKey } from '@solana/web3.js';
import { transformTransactionData } from '../route'; // Reuse the transformation function

const DEBUG = true;

// Default headers for SSE
const sseHeaders = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache, no-transform',
  'Connection': 'keep-alive',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'X-Accel-Buffering': 'no' // Disable buffering for Nginx
} as const;

// Default headers for JSON responses
const jsonHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
} as const;

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: new Headers({
      ...jsonHeaders,
      'Access-Control-Max-Age': '86400',
    })
  });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ signature: string }> }
) {
  // Create a controller for the stream
  const controller = new AbortController();
  const { signal } = controller;
  
  // Set a timeout for the entire operation
  const timeoutId = setTimeout(() => {
    if (DEBUG) {
      console.log('[API] Stream request timed out after 30 seconds');
    }
    controller.abort();
  }, 30000); // 30 second timeout
  
  // Create an encoder for the stream
  const encoder = new TextEncoder();
  
  try {
    // Get signature from params
    const params = await context.params;
    const { signature } = await params;
    
    if (DEBUG) {
      console.log(`[API] Processing streaming transaction request for signature: ${signature}`);
    }
    
    // Check if client supports streaming
    const acceptsStream = request.headers.get('accept')?.includes('text/event-stream');
    
    if (!acceptsStream) {
      // Fall back to regular JSON response
      if (DEBUG) {
        console.log(`[API] Client doesn't support SSE, falling back to JSON response`);
      }
      
      clearTimeout(timeoutId);
      
      // Redirect to the regular endpoint
      return Response.redirect(`/api/transaction/${signature}`, 307);
    }
    
    if (!signature) {
      clearTimeout(timeoutId);
      return new Response(
        JSON.stringify({ error: 'Transaction signature is required' }),
        { 
          status: 400,
          headers: new Headers(jsonHeaders)
        }
      );
    }
    
    // Create a stream for the response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Helper function to send events
          const sendEvent = (event: string, data: any) => {
            controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
          };
          
          // Send initial message
          sendEvent('init', { 
            message: 'Starting transaction fetch',
            timestamp: Date.now()
          });
          
          // Get connection from pool
          const connection = await getConnection();
          if (DEBUG) {
            console.log(`[API] Using OpenSVM RPC connection to fetch transaction data`);
            sendEvent('progress', { 
              message: 'Connecting to Solana network',
              progress: 0.1,
              timestamp: Date.now()
            });
          }
          
          // Fetch transaction
          sendEvent('progress', { 
            message: 'Fetching transaction data',
            progress: 0.2,
            timestamp: Date.now()
          });
          
          const tx = await connection.getParsedTransaction(signature, {
            maxSupportedTransactionVersion: 0,
            commitment: 'confirmed'
          });
          
          if (DEBUG) {
            console.log(`[API] Transaction data received: ${tx ? 'YES' : 'NO'}`);
          }
          
          if (!tx) {
            sendEvent('error', { 
              message: 'Transaction not found',
              timestamp: Date.now()
            });
            controller.close();
            return;
          }
          
          // Send progress update
          sendEvent('progress', { 
            message: 'Processing transaction data',
            progress: 0.5,
            timestamp: Date.now()
          });
          
          // Transform transaction data
          const transactionInfo = transformTransactionData(signature, tx);
          
          // Send transaction data
          sendEvent('transaction', { 
            data: transactionInfo,
            timestamp: Date.now()
          });
          
          // If there are accounts in the transaction, fetch additional data for each
          if (transactionInfo.details?.accounts?.length) {
            sendEvent('progress', { 
              message: 'Fetching account data',
              progress: 0.6,
              timestamp: Date.now()
            });
            
            const accounts = transactionInfo.details.accounts;
            const accountData = [];
            
            for (let i = 0; i < accounts.length; i++) {
              // Skip if aborted
              if (signal.aborted) break;
              
              const account = accounts[i];
              
              // Update progress
              sendEvent('progress', { 
                message: `Fetching data for account ${i+1} of ${accounts.length}`,
                progress: 0.6 + (0.3 * (i / accounts.length)),
                timestamp: Date.now()
              });
              
              try {
                // Fetch account info
                const accountInfo = await connection.getAccountInfo(
                  new PublicKey(account.pubkey),
                  'confirmed'
                );
                
                // Add to account data
                accountData.push({
                  pubkey: account.pubkey,
                  lamports: accountInfo?.lamports || 0,
                  owner: accountInfo?.owner?.toString() || '',
                  executable: accountInfo?.executable || false,
                  rentEpoch: accountInfo?.rentEpoch || 0
                });
                
                // Send account data
                sendEvent('account', { 
                  data: {
                    pubkey: account.pubkey,
                    lamports: accountInfo?.lamports || 0,
                    owner: accountInfo?.owner?.toString() || '',
                    executable: accountInfo?.executable || false,
                    rentEpoch: accountInfo?.rentEpoch || 0
                  },
                  index: i,
                  total: accounts.length,
                  timestamp: Date.now()
                });
                
                // Small delay to prevent overwhelming the client
                await new Promise(resolve => setTimeout(resolve, 50));
              } catch (error) {
                if (DEBUG) {
                  console.error(`[API] Error fetching account data for ${account.pubkey}:`, error);
                }
                
                // Send error for this account but continue with others
                sendEvent('accountError', { 
                  pubkey: account.pubkey,
                  error: error instanceof Error ? error.message : 'Unknown error',
                  index: i,
                  total: accounts.length,
                  timestamp: Date.now()
                });
              }
            }
          }
          
          // Send completion message
          sendEvent('complete', { 
            message: 'Data fetch complete',
            timestamp: Date.now()
          });
          
          if (DEBUG) {
            console.log(`[API] Successfully streamed transaction data to client`);
          }
          
          // Close the stream
          controller.close();
        } catch (error) {
          if (DEBUG) {
            console.error('[API] Error in stream processing:', error);
          }
          
          // Send error message
          controller.enqueue(encoder.encode(
            `event: error\ndata: ${JSON.stringify({
              message: error instanceof Error ? error.message : 'Unknown error',
              timestamp: Date.now()
            })}\n\n`
          ));
          
          // Close the stream
          controller.close();
        }
      },
      
      cancel() {
        // Clean up when the stream is cancelled
        clearTimeout(timeoutId);
        controller.abort();
        if (DEBUG) {
          console.log('[API] Stream cancelled by client');
        }
      }
    });
    
    // Return the stream response
    return new Response(stream, {
      headers: new Headers(sseHeaders)
    });
    
  } catch (error) {
    clearTimeout(timeoutId);
    if (DEBUG) {
      console.error('[API] Stream setup error:', error);
    }
    
    let status = 500;
    let message = 'Failed to set up streaming response';
    
    if (error instanceof Error) {
      if (error.name === 'AbortError' || error.message.includes('timed out')) {
        status = 504;
        message = 'Request timed out. Please try again.';
      } else if (error.message.includes('429') || error.message.includes('Too many requests')) {
        status = 429;
        message = 'Rate limit exceeded. Please try again in a few moments.';
      }
    }
    
    return new Response(
      JSON.stringify({ 
        error: message,
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status,
        headers: new Headers(jsonHeaders)
      }
    );
  }
}