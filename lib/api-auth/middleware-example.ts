/**
 * Example middleware for logging API key activity
 * 
 * This file demonstrates how to integrate activity logging into your API routes.
 * You can adapt this pattern to your specific needs.
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey, logApiKeyActivity } from './service';

/**
 * Middleware to validate API key and log activity
 * 
 * Usage in an API route:
 * 
 * ```typescript
 * import { withApiKeyLogging } from '@/lib/api-auth/middleware-example';
 * 
 * export const GET = withApiKeyLogging(async (request, apiKey) => {
 *   // Your API logic here
 *   // apiKey contains the validated API key object
 *   return NextResponse.json({ data: 'your response' });
 * });
 * ```
 */
export function withApiKeyLogging(
  handler: (request: NextRequest, apiKey: any) => Promise<NextResponse>
) {
  return async (request: NextRequest) => {
    const startTime = Date.now();
    let statusCode = 200;
    let errorMessage: string | undefined;

    try {
      // Extract API key from Authorization header
      const authHeader = request.headers.get('authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        statusCode = 401;
        return NextResponse.json(
          { error: 'Missing or invalid Authorization header' },
          { status: 401 }
        );
      }

      const apiKeyValue = authHeader.substring(7); // Remove 'Bearer ' prefix

      // Validate API key
      const apiKey = await validateApiKey(apiKeyValue);
      if (!apiKey) {
        statusCode = 401;
        errorMessage = 'Invalid API key';
        return NextResponse.json(
          { error: 'Invalid or expired API key' },
          { status: 401 }
        );
      }

      // Call the actual handler
      const response = await handler(request, apiKey);
      statusCode = response.status;

      return response;
    } catch (error) {
      statusCode = 500;
      errorMessage = error instanceof Error ? error.message : 'Internal server error';
      throw error;
    } finally {
      // Log activity (only if we have a valid API key)
      const authHeader = request.headers.get('authorization');
      if (authHeader?.startsWith('Bearer ')) {
        const apiKeyValue = authHeader.substring(7);
        const apiKey = await validateApiKey(apiKeyValue);
        
        if (apiKey) {
          const responseTime = Date.now() - startTime;
          const url = new URL(request.url);

          // Log asynchronously without waiting
          logApiKeyActivity({
            apiKeyId: apiKey.id,
            timestamp: new Date(),
            endpoint: url.pathname,
            method: request.method,
            statusCode,
            responseTime,
            userAgent: request.headers.get('user-agent') || undefined,
            ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
            errorMessage,
          }).catch((err) => {
            console.error('Failed to log API activity:', err);
          });
        }
      }
    }
  };
}

/**
 * Alternative: Manual logging in your API route
 * 
 * If you prefer more control, you can manually log activity in your routes:
 * 
 * ```typescript
 * import { validateApiKey, logApiKeyActivity } from '@/lib/api-auth/service';
 * 
 * export async function GET(request: NextRequest) {
 *   const startTime = Date.now();
 *   
 *   try {
 *     // Validate API key
 *     const authHeader = request.headers.get('authorization');
 *     const apiKey = await validateApiKey(authHeader?.substring(7) || '');
 *     
 *     if (!apiKey) {
 *       return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 *     }
 *     
 *     // Your API logic here
 *     const result = await yourApiLogic();
 *     
 *     // Log successful request
 *     await logApiKeyActivity({
 *       apiKeyId: apiKey.id,
 *       timestamp: new Date(),
 *       endpoint: new URL(request.url).pathname,
 *       method: request.method,
 *       statusCode: 200,
 *       responseTime: Date.now() - startTime,
 *     });
 *     
 *     return NextResponse.json(result);
 *   } catch (error) {
 *     // Log failed request
 *     await logApiKeyActivity({
 *       apiKeyId: apiKey?.id || 'unknown',
 *       timestamp: new Date(),
 *       endpoint: new URL(request.url).pathname,
 *       method: request.method,
 *       statusCode: 500,
 *       responseTime: Date.now() - startTime,
 *       errorMessage: error instanceof Error ? error.message : 'Unknown error',
 *     });
 *     
 *     throw error;
 *   }
 * }
 * ```
 */
