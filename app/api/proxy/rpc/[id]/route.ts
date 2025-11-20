import { NextRequest } from 'next/server';
import { getRpcEndpoints } from '@/lib/solana/rpc/opensvm-rpc';
import { getConnection } from '@/lib/solana/solana-connection-server';

// Route segment config: Set timeout to 120 seconds
export const maxDuration = 120;


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

// Next.js 15.1.7 App Router route handler with correct type signature
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

  try {
    // Get the endpoint ID from route params - properly awaited
    const params = await context.params;
    const { id: endpointId } = await params;

    // Parse the request body
    const body = await request.json();

    // Resolve RPC endpoint from configured OpenSVM RPC list
    const rpcEndpoints = getRpcEndpoints();
    const rpcUrl = rpcEndpoints[endpointId as keyof typeof rpcEndpoints];
    if (!rpcUrl || typeof rpcUrl !== 'string') {
      return Response.json(
        { error: `Unknown RPC endpoint ${endpointId}` },
        { status: 404, headers: defaultHeaders }
      );
    }
    console.log(`Proxying RPC request to RPC endpoint ${rpcUrl}`);
    let response = await fetch(rpcUrl, {
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
        return Response.json(
          {
            error: `RPC request failed with status ${response.status}`,
            code: response.status
          },
          {
            status: response.status,
            headers: defaultHeaders
          }
        );
      }
    }

    // Forward the response from the OpenSVM API back to the client
    const data = await response.json();

    return Response.json(data, {
      status: 200,
      headers: defaultHeaders
    });
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

    return Response.json(
      {
        error: message,
        details: error instanceof Error ? { message: error.message } : error
      },
      {
        status,
        headers: defaultHeaders
      }
    );
  }
}