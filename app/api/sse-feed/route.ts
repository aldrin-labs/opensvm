import { NextRequest } from 'next/server';
import { SSEManager, startSSECleanup } from '@/lib/api/sse-manager';
import { 

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
    const feedType = searchParams.get('feedType') || 'for-you';
    const walletAddress = searchParams.get('walletAddress');

    if (!clientId) {
      const { response, status } = CommonErrors.missingField('clientId');
      return Response.json(response, { status });
    }

    const sseManager = SSEManager.getInstance();

    switch (action) {
      case 'connect':
        if (!walletAddress) {
          const { response, status } = CommonErrors.missingField('walletAddress');
          return Response.json(response, { status });
        }

        // Create an SSE stream with headers for feed-specific events
        const stream = new ReadableStream({
          start: (controller) => {
            sseManager.addConnection(clientId, controller);
            
            // Send initial connection message
            const initialMessage = `data: ${JSON.stringify({
              type: 'feed_connected',
              data: { 
                clientId, 
                feedType, 
                walletAddress: walletAddress,
                connected: true
              },
              timestamp: Date.now()
            })}\n\n`;
            
            const encoder = new TextEncoder();
            controller.enqueue(encoder.encode(initialMessage));
          },
          cancel: () => {
            sseManager.removeConnection(clientId);
          }
        });

        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Cache-Control',
            'X-Accel-Buffering': 'no', // Disable proxy buffering
            'X-RateLimit-Limit': '100',
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
    console.error('SSE Feed API error:', error);
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
      message: 'Feed SSE client disconnected successfully' 
    }));
  } catch (error) {
    console.error('SSE Feed disconnect error:', error);
    const { response, status } = CommonErrors.internalError(error);
    return Response.json(response, { status });
  }
}