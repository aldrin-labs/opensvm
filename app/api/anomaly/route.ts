import { NextRequest } from 'next/server';
import { getConnection } from '@/lib/solana-connection';
import { AnomalyDetectionCapability } from '@/lib/ai/capabilities/anomaly-detection';
import { validateAnomalyRequest, validateBlockchainEvent } from '@/lib/validation/stream-schemas';
import { 
  createSuccessResponse, 
  createErrorResponse, 
  CommonErrors, 
  ErrorCodes 
} from '@/lib/api-response';

// Global anomaly detector instance
let anomalyDetector: AnomalyDetectionCapability | null = null;

async function getAnomalyDetector(): Promise<AnomalyDetectionCapability> {
  if (!anomalyDetector) {
    const connection = await getConnection();
    anomalyDetector = new AnomalyDetectionCapability(connection);
  }
  return anomalyDetector;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action') || 'alerts';
    
    const detector = await getAnomalyDetector();
    
    switch (action) {
      case 'alerts':
        const alerts = await detector.getAnomalyAlerts();
        return Response.json(createSuccessResponse(alerts));
        
      case 'stats':
        const stats = await detector.getAnomalyStats();
        return Response.json(createSuccessResponse(stats));
        
      default:
        const { response, status } = createErrorResponse(
          ErrorCodes.INVALID_REQUEST,
          'Invalid action. Use action=alerts or action=stats',
          { validActions: ['alerts', 'stats'] },
          400
        );
        return Response.json(response, { status });
    }
  } catch (error) {
    console.error('Anomaly API error:', error);
    const { response, status } = CommonErrors.internalError(error);
    return Response.json(response, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    let requestBody;
    try {
      requestBody = await request.json();
    } catch (jsonError) {
      console.error('Invalid JSON in request:', jsonError);
      const { response, status } = CommonErrors.invalidJson(jsonError);
      return Response.json(response, { status });
    }

    // Validate request with Zod
    const validationResult = validateAnomalyRequest(requestBody);
    if (!validationResult.success) {
      const { response, status } = createErrorResponse(
        ErrorCodes.INVALID_REQUEST,
        'Invalid request format',
        validationResult.errors,
        400
      );
      return Response.json(response, { status });
    }

    const { event, action } = validationResult.data;
    const detector = await getAnomalyDetector();
    
    switch (action) {
      case 'analyze':
        if (!event) {
          const { response, status } = CommonErrors.missingField('event');
          return Response.json(response, { status });
        }
        
        // Additional validation for single event
        if (!Array.isArray(event)) {
          const eventValidation = validateBlockchainEvent(event);
          if (!eventValidation.success) {
            const { response, status } = createErrorResponse(
              ErrorCodes.INVALID_REQUEST,
              'Invalid event format',
              eventValidation.errors,
              400
            );
            return Response.json(response, { status });
          }
        }
        
        const alerts = await detector.processEvent(event);
        return Response.json(createSuccessResponse({
          event,
          alerts,
          anomalyCount: alerts.length
        }));
        
      case 'bulk_analyze':
        if (!Array.isArray(event)) {
          const { response, status } = createErrorResponse(
            ErrorCodes.INVALID_REQUEST,
            'Events array is required for bulk analysis',
            { expectedType: 'array' },
            400
          );
          return Response.json(response, { status });
        }
        
        // Validate each event
        for (let i = 0; i < event.length; i++) {
          const eventValidation = validateBlockchainEvent(event[i]);
          if (!eventValidation.success) {
            const { response, status } = createErrorResponse(
              ErrorCodes.INVALID_REQUEST,
              `Invalid event format at index ${i}`,
              { index: i, errors: eventValidation.errors },
              400
            );
            return Response.json(response, { status });
          }
        }
        
        const results = [];
        for (const evt of event) {
          const eventAlerts = await detector.processEvent(evt);
          results.push({
            event: evt,
            alerts: eventAlerts,
            anomalyCount: eventAlerts.length
          });
        }
        
        return Response.json(createSuccessResponse({
          processed: results.length,
          results
        }));
        
      default:
        const { response, status } = createErrorResponse(
          ErrorCodes.INVALID_REQUEST,
          'Invalid action. Use action=analyze or action=bulk_analyze',
          { validActions: ['analyze', 'bulk_analyze'] },
          400
        );
        return Response.json(response, { status });
    }
  } catch (error) {
    console.error('Anomaly API error:', error);
    const { response, status } = CommonErrors.internalError(error);
    return Response.json(response, { status });
  }
}
