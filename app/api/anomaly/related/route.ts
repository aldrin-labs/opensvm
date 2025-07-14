import { NextRequest } from 'next/server';
import { 
  createSuccessResponse, 
  CommonErrors, 
} from '@/lib/api-response';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const alertId = searchParams.get('alertId');
    const accounts = searchParams.get('accounts')?.split(',').filter(Boolean) || [];
    
    if (!alertId) {
      const { response, status } = CommonErrors.missingField('alertId');
      return Response.json(response, { status });
    }

    // Mock related events for now - in production this would query a database
    const relatedEvents = accounts.map((account, index) => ({
      signature: `mock_signature_${index}_${account.substring(0, 8)}`,
      timestamp: Date.now() - (index * 60000),
      type: 'transaction',
      account: account,
      fee: Math.random() * 0.01,
      success: Math.random() > 0.2
    }));

    return Response.json(createSuccessResponse({ events: relatedEvents }));
  } catch (error) {
    console.error('Related events API error:', error);
    const { response, status } = CommonErrors.internalError(error);
    return Response.json(response, { status });
  }
}
