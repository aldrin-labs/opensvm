/**
 * CORS utilities for API endpoints
 * Provides secure CORS headers based on environment
 */

/**
 * Get CORS headers for API responses
 * In production, restricts to opensvm.com domain only
 * In development, allows all origins for testing
 */
export function getCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': process.env.NODE_ENV === 'production' 
      ? 'https://opensvm.com' 
      : '*', // Allow all origins only in development
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400', // 24 hours
  };
}

/**
 * Get CORS headers for specific methods
 */
export function getCorsHeadersForMethods(methods: string[]) {
  const headers = getCorsHeaders();
  return {
    ...headers,
    'Access-Control-Allow-Methods': methods.join(', '),
  };
}

/**
 * Create an OPTIONS response with CORS headers
 */
export function createOptionsResponse(methods: string[] = ['GET', 'POST', 'OPTIONS']) {
  return new Response(null, {
    status: 200,
    headers: getCorsHeadersForMethods(methods),
  });
}