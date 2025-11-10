import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { validateApiKey, logApiKeyActivity } from './lib/api-auth/service';

// Paths that require API key authentication
const PROTECTED_API_PATHS = [
  '/api/getAnswer',
  '/api/opensvm',
  '/api/analyze',
  '/api/transaction',
  '/api/account',
  '/api/block',
  '/api/program',
  '/api/token',
  '/api/defi',
  '/api/analytics',
  '/api/monitor',
];

// Paths that should be excluded from API key checks
const EXCLUDED_PATHS = [
  '/api/auth',
  '/api/health',
  '/api/_next',
  '/api/static',
];

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  
  // Skip if not an API route
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }
  
  // Skip excluded paths
  if (EXCLUDED_PATHS.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }
  
  // Check if this path requires API key authentication
  const requiresApiKey = PROTECTED_API_PATHS.some(path => pathname.startsWith(path));
  
  if (!requiresApiKey) {
    return NextResponse.next();
  }
  
  const startTime = Date.now();
  
  // Extract API key from headers
  const apiKey = request.headers.get('X-API-Key') || 
                 request.headers.get('Authorization')?.replace('Bearer ', '');
  
  if (!apiKey) {
    // No API key provided for protected route
    return NextResponse.json(
      { error: 'API key required' },
      { status: 401 }
    );
  }
  
  try {
    // Validate the API key
    const validationResult = await validateApiKey(apiKey);
    
    if (!validationResult || !validationResult.valid) {
      // Log failed authentication attempt
      await logApiKeyActivity({
        apiKeyId: apiKey.substring(0, 20), // Use partial key as ID for invalid keys
        endpoint: pathname,
        method: request.method,
        statusCode: 401,
        responseTime: Date.now() - startTime,
        metadata: {
          error: 'Invalid API key',
          ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
        }
      }).catch(console.error);
      
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      );
    }
    
    // Clone the request headers to add validated API key info
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-api-key-id', validationResult.apiKey.id);
    requestHeaders.set('x-api-key-name', validationResult.apiKey.name);
    
    // Continue with the request
    const response = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
    
    // Log successful API activity (async, don't wait)
    const responseTime = Date.now() - startTime;
    const statusCode = response.status;
    
    logApiKeyActivity({
      apiKeyId: validationResult.apiKey.id,
      endpoint: pathname,
      method: request.method,
      statusCode,
      responseTime,
      metadata: {
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown'
      }
    }).catch(console.error);
    
    return response;
    
  } catch (error) {
    console.error('Middleware error:', error);
    
    // Log error
    await logApiKeyActivity({
      apiKeyId: apiKey.substring(0, 20),
      endpoint: pathname,
      method: request.method,
      statusCode: 500,
      responseTime: Date.now() - startTime,
      metadata: {
        error: error instanceof Error ? error.message : 'Internal error'
      }
    }).catch(console.error);
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Configure which paths the middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
};
