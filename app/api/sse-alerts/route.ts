import { NextRequest } from 'next/server';
import { SSEManager, startSSECleanup } from '@/lib/sse-manager';
import { 
  createSuccessResponse, 
  createErrorResponse, 
  CommonErrors, 
  ErrorCodes 
} from '@/lib/api-response';

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
        // Return SSE stream
        return sseManager.addClient(clientId);

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