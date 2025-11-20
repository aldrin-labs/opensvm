import { NextRequest } from 'next/server';
import { SSEManager, startSSECleanup } from '@/lib/api/sse-manager';
import {

// Route segment config: Set timeout to 120 seconds
export const maxDuration = 120;

  createSuccessResponse,
  createErrorResponse,
  CommonErrors,
  ErrorCodes
} from '@/lib/api/api-response';

// Start SSE cleanup on module load
startSSECleanup();

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const clientId = searchParams.get('clientId');
    const action = searchParams.get('action') || 'connect';

    if (!clientId) {
      const { response, status } = CommonErrors.missingField('clientId');
      return Response.json(response, { status });
    }

    const sseManager = SSEManager.getInstance();

    switch (action) {
      case 'connect':
        // Get event types from query params, no default - require explicit specification
        const eventTypesParam = searchParams.get('eventTypes');

        if (!eventTypesParam) {
          const { response, status } = createErrorResponse(
            ErrorCodes.INVALID_REQUEST,
            'eventTypes parameter is required. Specify which event types to subscribe to.',
            {
              message: 'No event types specified - connection refused',
              validEventTypes: ['block', 'transaction', 'account_change'],
              example: '?eventTypes=block&clientId=your-client-id'
            },
            400
          );
          return Response.json(response, { status });
        }

        const eventTypes = eventTypesParam.split(',');
        const eventTypesSet = new Set(eventTypes);

        // Start monitoring when first client connects
        try {
          // Import EventStreamManager dynamically
          const { EventStreamManager } = await import('@/app/api/stream/route');
          const streamManager = EventStreamManager.getInstance();

          // Create a mock client for the stream manager to trigger monitoring
          const mockClient = {
            id: clientId,
            send: (data: any) => {
              // Send blockchain events to SSE clients (filtering now happens in SSE manager)
              try {
                const eventData = JSON.parse(data);
                sseManager.broadcastBlockchainEvent(eventData);
              } catch (error) {
                console.error('Failed to parse blockchain event for SSE:', error);
              }
            },
            close: () => { },
            subscriptions: eventTypesSet,
            authenticated: true,
            connectionTime: Date.now(),
            lastActivity: Date.now()
          };

          // This will start monitoring if not already started
          await streamManager.addClient(mockClient);
        } catch (error) {
          console.warn('Failed to start blockchain monitoring:', error);
        }

        // Return SSE stream with event type filtering
        const stream = sseManager.addClient(clientId, eventTypesSet);
        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Cache-Control',
            'X-Accel-Buffering': 'no', // Disable proxy buffering
            'X-RateLimit-Limit': '100', // Add rate limit headers
            'X-RateLimit-Remaining': '99',
            'X-RateLimit-Reset': new Date(Date.now() + 60000).toISOString(),
          },
        });

      case 'stats':
        // Return SSE statistics
        return Response.json(createSuccessResponse(sseManager.getStats()));

      default:
        const { response, status } = createErrorResponse(
          ErrorCodes.INVALID_REQUEST,
          'Invalid action. Use action=connect or action=stats',
          { validActions: ['connect', 'stats'] },
          400
        );
        return Response.json(response, { status });
    }
  } catch (error) {
    console.error('SSE API error:', error);
    const { response, status } = CommonErrors.internalError(error);
    return Response.json(response, { status });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const clientId = searchParams.get('clientId');

    if (!clientId) {
      const { response, status } = CommonErrors.missingField('clientId');
      return Response.json(response, { status });
    }

    const sseManager = SSEManager.getInstance();
    sseManager.removeClient(clientId);

    return Response.json(createSuccessResponse({
      message: 'Client disconnected successfully'
    }));
  } catch (error) {
    console.error('SSE disconnect error:', error);
    const { response, status } = CommonErrors.internalError(error);
    return Response.json(response, { status });
  }
}