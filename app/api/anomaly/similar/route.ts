import { NextRequest } from 'next/server';
import { 
  createSuccessResponse, 
  CommonErrors, 
} from '@/lib/api-response';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const alertId = searchParams.get('alertId');
    const type = searchParams.get('type');
    
    if (!alertId || !type) {
      const { response, status } = CommonErrors.missingField(alertId ? 'type' : 'alertId');
      return Response.json(response, { status });
    }

    // Mock similar alerts for now - in production this would query a database
    const similarAlerts = Array.from({ length: 3 }, (_, index) => ({
      id: `similar_${alertId}_${index}`,
      type: type,
      severity: ['low', 'medium', 'high'][index % 3],
      description: `Similar ${type.replace(/_/g, ' ')} detected ${index + 1} hours ago`,
      timestamp: Date.now() - ((index + 1) * 3600000)
    }));

    return Response.json(createSuccessResponse({ alerts: similarAlerts }));
  } catch (error) {
    console.error('Similar alerts API error:', error);
    const { response, status } = CommonErrors.internalError(error);
    return Response.json(response, { status });
  }
}
