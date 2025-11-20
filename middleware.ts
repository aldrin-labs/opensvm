import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { validateApiKey, logApiKeyActivity } from './lib/api-auth/service';

// Force Node.js runtime for crypto support
export const runtime = 'nodejs';

// Paths that should be completely excluded from middleware (no API key checking at all)
const EXCLUDED_PATHS = [
  '/api/auth',
  '/api/health',
  '/api/install',
  '/api/_next',
  '/api/static',
];

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const userAgent = request.headers.get('user-agent') || '';

  // Special handling for CLI installers hitting root (e.g. `curl https://osvm.ai | sh`)
  if (pathname === '/') {
    const ua = userAgent.toLowerCase();
    const isCliClient =
      ua.includes('curl') ||
      ua.includes('wget') ||
      ua.includes('httpie') ||
      ua.includes('powershell');

    if (isCliClient) {
      const url = request.nextUrl.clone();
      url.pathname = '/api/install';
      return NextResponse.rewrite(url);
    }
  }
  
  // Skip if not an API route
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }
  
  // Skip excluded paths completely
  if (EXCLUDED_PATHS.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }
  
  const startTime = Date.now();
  
  // Extract API key from headers (optional for all endpoints now)
  const apiKey = request.headers.get('X-API-Key') || 
                 request.headers.get('Authorization')?.replace('Bearer ', '');
  
  // If no API key provided, allow the request to proceed (API key is optional)
  if (!apiKey) {
    return NextResponse.next();
  }
  
  try {
    // Validate the API key if provided (returns ApiKey | null)
    const validatedApiKey = await validateApiKey(apiKey);
    
    if (!validatedApiKey) {
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
    requestHeaders.set('x-api-key-id', validatedApiKey.id);
    requestHeaders.set('x-api-key-name', validatedApiKey.name);
    
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
      apiKeyId: validatedApiKey.id,
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
      apiKeyId: apiKey?.substring(0, 20) || 'unknown',
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
