import { NextRequest } from 'next/server';

const defaultHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
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

export async function GET(
  _request: NextRequest,
) {
  // Return a Gone (410) status to indicate this endpoint is deprecated
  // and should not be used anymore
  return new Response(
    JSON.stringify({
      error: 'This endpoint has been deprecated. Please use the real OpenSVM RPC integration instead.',
      message: 'Mock data is no longer available in production environments. Use /api/transaction/:signature for actual data.'
    }),
    { 
      status: 410, // Gone status code
      headers: new Headers(defaultHeaders)
    }
  );
}
