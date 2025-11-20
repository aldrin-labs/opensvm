/**
 * Health check endpoint with activity logging
 */

import { NextRequest, NextResponse } from 'next/server';
import { tieredRateLimiter } from '@/lib/api/rate-limiter-tiers';
import { validateApiKey, logApiKeyActivity } from '@/lib/api-auth/service';

// Route segment config: Set timeout to 120 seconds
export const maxDuration = 120;


export async function GET(req: NextRequest) {
  const startTime = Date.now();
  
  // Check for API key (optional for health endpoint)
  const apiKey = req.headers.get('X-API-Key') || 
                 req.headers.get('Authorization')?.replace('Bearer ', '');
  
  let apiKeyId: string | undefined;
  
  if (apiKey) {
    try {
      const validationResult = await validateApiKey(apiKey);
      if (validationResult && validationResult.valid) {
        apiKeyId = validationResult.apiKey.id;
      }
    } catch (error) {
      console.error('API key validation error:', error);
    }
  }
  
  // Health check uses special tier with higher limits
  const rateLimitResult = await tieredRateLimiter.checkLimit(req, 'health');
  
  // Even if rate limited, return health status
  const headers: Record<string, string> = {};
  if (!rateLimitResult.allowed) {
    headers['X-RateLimit-Exceeded'] = 'true';
  }
  
  const response = NextResponse.json({
    status: 'healthy',
    timestamp: Date.now(),
    uptime: process.uptime(),
    memory: {
      used: process.memoryUsage().heapUsed / 1024 / 1024,
      total: process.memoryUsage().heapTotal / 1024 / 1024
    },
    environment: process.env.NODE_ENV || 'production',
    version: '1.0.0'
  }, {
    status: 200,
    headers
  });
  
  // Log activity if API key was provided
  if (apiKeyId) {
    const responseTime = Date.now() - startTime;
    await logApiKeyActivity({
      apiKeyId,
      endpoint: '/api/health',
      method: 'GET',
      statusCode: 200,
      responseTime,
      metadata: {
        rateLimited: !rateLimitResult.allowed,
        ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
      }
    }).catch(error => {
      console.error('Failed to log activity:', error);
    });
  }
  
  return response;
}
