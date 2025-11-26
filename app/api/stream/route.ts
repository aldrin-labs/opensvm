import { NextRequest } from 'next/server';
import { EventStreamManager } from '@/lib/api/event-stream-manager';
import {
  createSuccessResponse,
  createErrorResponse,
  CommonErrors,
  ErrorCodes
} from '@/lib/api/api-response';
import { generateSecureClientId } from '@/lib/api-auth/crypto-utils';
import { createLogger } from '@/lib/logging/debug-logger';
import { validateStreamRequest } from '@/lib/validation/stream-schemas';

// Enhanced logger for stream API
const logger = createLogger('STREAM_API');

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get('action');
  const clientId = searchParams.get('clientId') || generateSecureClientId();

  // Handle status request
  if (action === 'status') {
    const manager = EventStreamManager.getInstance();
    return Response.json(createSuccessResponse(manager.getStatus()));
  }

  // Check for WebSocket upgrade request - provide clear error message
  const upgrade = request.headers.get('upgrade');
  const connection = request.headers.get('connection');

  if (upgrade?.toLowerCase() === 'websocket' && connection?.toLowerCase().includes('upgrade')) {
    // WebSocket is not supported - be honest about it
    const { response, status } = createErrorResponse(
      'WEBSOCKET_NOT_SUPPORTED',
      'WebSocket connections are not supported by this endpoint',
      {
        message: 'This API uses Server-Sent Events (SSE), not WebSocket. WebSocket upgrade requests are not implemented.',
        clientId,
        alternatives: {
          sseEndpoint: '/api/sse-alerts',
          pollingEndpoint: '/api/stream (POST)',
          documentation: '/docs/api/streaming'
        },
        supportedFeatures: [
          'Server-Sent Events (SSE) for real-time streaming',
          'HTTP polling for request-response patterns',
          'Authentication and rate limiting'
        ],
        deploymentInfo: {
          environment: process.env.NODE_ENV || 'development',
          platform: process.env.VERCEL ? 'vercel' : 'custom',
          webSocketSupport: false,
          reason: 'Next.js API routes do not support WebSocket natively. Use SSE instead.'
        }
      },
      426 // Upgrade Required
    );

    return new Response(JSON.stringify(response), {
      status,
      headers: {
        'Content-Type': 'application/json',
        'X-Streaming-Method': 'SSE',
        'X-WebSocket-Support': 'false'
      },
    });
  }

  // Return API information for regular GET requests
  return new Response(JSON.stringify(createSuccessResponse({
    message: 'Blockchain Event Streaming API',
    clientId,
    streamingMethod: 'SSE',
    supportedMethods: ['POST for polling', 'SSE for real-time streaming'],
    supportedEvents: ['transaction', 'block', 'account_change'],
    endpoints: {
      polling: '/api/stream (POST)',
      realtime: '/api/sse-alerts',
      documentation: '/docs/api/streaming'
    },
    note: 'This API uses Server-Sent Events (SSE), not WebSocket'
  })), {
    headers: {
      'Content-Type': 'application/json',
      'X-Streaming-Method': 'SSE',
      'X-WebSocket-Support': 'false'
    },
  });
}

// For now, we'll also provide a simple polling endpoint
export async function POST(request: NextRequest) {
  try {
    // Safe JSON parsing
    let requestBody;
    try {
      requestBody = await request.json();
    } catch (jsonError) {
      logger.error('Invalid JSON in request:', jsonError);
      const { response, status } = CommonErrors.invalidJson(jsonError);
      return Response.json(response, { status });
    }

    // Validate request structure
    const validationResult = validateStreamRequest(requestBody);
    if (!validationResult.success) {
      const { response, status } = createErrorResponse(
        ErrorCodes.INVALID_REQUEST,
        'Invalid request format',
        validationResult.errors,
        400
      );
      return Response.json(response, { status });
    }

    const { action, clientId, eventTypes, authToken } = validationResult.data;
    const manager = EventStreamManager.getInstance();

    switch (action) {
      case 'subscribe':
        const success = await manager.subscribeToEvents(clientId, eventTypes || [], authToken);
        if (success) {
          return Response.json(createSuccessResponse({
            message: 'Successfully subscribed',
            clientId,
            subscriptions: eventTypes
          }));
        } else {
          const { response, status } = createErrorResponse(
            ErrorCodes.UNAUTHORIZED,
            'Subscription failed',
            { reason: 'Authentication failed or rate limit exceeded' },
            403
          );
          return Response.json(response, { status });
        }

      case 'unsubscribe':
        manager.removeClient(clientId);
        return Response.json(createSuccessResponse({
          message: 'Successfully unsubscribed',
          clientId
        }));

      default:
        const { response, status } = createErrorResponse(
          ErrorCodes.INVALID_REQUEST,
          'Invalid action',
          { validActions: ['subscribe', 'unsubscribe'] },
          400
        );
        return Response.json(response, { status });
    }
  } catch (error) {
    logger.error('Stream API error:', error);
    const { response, status } = CommonErrors.internalError(error);
    return Response.json(response, { status });
  }
}
