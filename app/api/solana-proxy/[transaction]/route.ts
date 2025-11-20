import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ transaction: string }> }
) {
  try {
    const params = await context.params;
    const { transaction } = await params;
    
    console.log('Solana proxy request:', {
      method: 'getTransaction',
      params: [transaction, 'jsonParsed']
    });
    
    // Try multiple RPC endpoints with rate limits
    const endpoints = [
      'https://api.mainnet-beta.solana.com',
      'https://solana-api.projectserum.com',
      'https://solana.public-rpc.com',
      'https://rpc.ankr.com/solana',
      'https://ssc-dao.genesysgo.net'
    ];

    // Add delay between retries
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    let lastError;
    for (const endpoint of endpoints) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'getTransaction',
            params: [transaction, {
              encoding: 'jsonParsed',
              maxSupportedTransactionVersion: 0,
              commitment: 'confirmed'
            }]
          }),
          signal: controller.signal,
          cache: 'no-store'
        });

        clearTimeout(timeout);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
        }

        const responseText = await response.text();
        console.log('Solana proxy response:', {
          endpoint,
          status: response.status,
          method: 'getTransaction'
        });

        const data = JSON.parse(responseText);
        if (!data.error) {
          return NextResponse.json(data, {
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0',
            }
          });
        }

        // If rate limited, add delay before next attempt
        if (response.status === 429 || data.error.code === -32005) {
          await delay(2000);
        }

        lastError = new Error(data.error.message || 'Unknown RPC error');
      } catch (error) {
        console.error(`Error with endpoint ${endpoint}:`, error);
        lastError = error;
        
        // Add delay before trying next endpoint
        await delay(1000);
        continue;
      }
    }

    throw lastError || new Error('All RPC endpoints failed');
  } catch (error) {
    console.error('Solana proxy error:', error);
    
    let status = 500;
    let message = error instanceof Error ? error.message : 'Failed to proxy Solana RPC request';
    
    if (message.toLowerCase().includes('not found')) {
      status = 404;
    } else if (message.toLowerCase().includes('invalid')) {
      status = 400;
    } else if (message.toLowerCase().includes('rate limit')) {
      status = 429;
    }
    
    return NextResponse.json(
      { 
        error: message,
        details: error instanceof Error ? {
          name: error.name,
          message: error.message,
          stack: error.stack
        } : error
      },
      { 
        status,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        }
      }
    );
  }
}