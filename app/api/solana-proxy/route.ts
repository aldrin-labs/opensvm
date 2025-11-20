export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const transaction = searchParams.get('transaction');
    
    if (!transaction) {
      throw new Error('Transaction signature is required');
    }

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
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'getTransaction',
            params: [transaction, 'jsonParsed']
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const responseText = await response.text();
        console.log('Solana proxy response:', {
          endpoint,
          status: response.status,
          method: 'getTransaction'
        });

        const data = JSON.parse(responseText);
        if (!data.error) {
          return NextResponse.json(data);
        }

        // If rate limited, add delay before next attempt
        if (response.status === 429 || data.error.code === -32005) {
          await delay(1000);
        }

        lastError = new Error(data.error.message || 'Unknown RPC error');
      } catch (error) {
        console.error(`Error with endpoint ${endpoint}:`, error);
        lastError = error;
        continue;
      }
    }

    throw lastError || new Error('All RPC endpoints failed');
  } catch (error) {
    console.error('Solana proxy error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to proxy Solana RPC request',
        details: error instanceof Error ? {
          name: error.name,
          message: error.message,
          stack: error.stack
        } : error
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('Solana proxy request:', {
      method: body.method,
      params: body.params
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
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: body.method,
            params: body.params
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const responseText = await response.text();
        console.log('Solana proxy response:', {
          endpoint,
          status: response.status,
          method: body.method
        });

        const data = JSON.parse(responseText);
        if (!data.error) {
          return NextResponse.json(data);
        }

        // If rate limited, add delay before next attempt
        if (response.status === 429 || data.error.code === -32005) {
          await delay(1000);
        }

        lastError = new Error(data.error.message || 'Unknown RPC error');
      } catch (error) {
        console.error(`Error with endpoint ${endpoint}:`, error);
        lastError = error;
        continue;
      }
    }

    throw lastError || new Error('All RPC endpoints failed');
  } catch (error) {
    console.error('Solana proxy error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to proxy Solana RPC request',
        details: error instanceof Error ? {
          name: error.name,
          message: error.message,
          stack: error.stack
        } : error
      },
      { status: 500 }
    );
  }
}
