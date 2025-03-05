import { NextRequest } from 'next/server';
import { type NextFetchEvent } from 'next/server';

const defaultHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
} as const;

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: new Headers({
      ...defaultHeaders,
      'Access-Control-Max-Age': '86400',
    })
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Record<string, string | string[]> }
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

  try {
    // Extract the ID from the URL path directly
    const url = request.url;
    const pathParts = url.split('/');
    const endpointId = pathParts[pathParts.length - 1];

    // Forward the request body to the OpenSVM API
    const body = await request.json();
    
    console.log(`Proxying RPC request to OpenSVM API, ID: ${endpointId}`);
    
    // Try the OpenSVM RPC endpoint first
    let response = await fetch(`https://opensvm.com/api/${endpointId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      // If OpenSVM API returns 404, fallback to Solana mainnet API
      if (response.status === 404) {
        console.log(`OpenSVM API returned 404, falling back to Solana mainnet API`);
        
        response = await fetch(`https://api.mainnet-beta.solana.com`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
      }
      
      if (!response.ok) {
      console.error(`Error from OpenSVM API: ${response.status} ${response.statusText}`);
      return new Response(
        JSON.stringify({ 
          error: `RPC request failed with status ${response.status}`,
          code: response.status
        }),
        { 
          status: response.status,
          headers: new Headers(defaultHeaders)
        }
      );
      }
    }

    // Forward the response from the OpenSVM API back to the client
    const data = await response.json();
    
    return new Response(
      JSON.stringify(data),
      {
        status: 200,
        headers: new Headers(defaultHeaders)
      }
    );
  } catch (error) {
    clearTimeout(timeoutId);
    console.error('RPC proxy error:', error);
    
    let status = 500;
    let message = 'Failed to proxy RPC request';

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
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
        details: error instanceof Error ? { message: error.message } : error
      }),
      { 
        status,
        headers: new Headers(defaultHeaders)
      }
    );
  }
}