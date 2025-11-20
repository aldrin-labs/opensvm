import { NextRequest, NextResponse } from 'next/server';

// Route segment config: Set timeout to 120 seconds
export const maxDuration = 120;


export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // Handle both single log entries and batched logs
        const logs = body.logs || [body];
        const batchSize = body.batchSize || 1;

        // In production, you would forward these to your actual logging service
        // (DataDog, Sentry, CloudWatch, etc.)

        if (process.env.NODE_ENV === 'development') {
            console.log(`📊 Received ${batchSize} log entries:`, {
                timestamp: body.timestamp || new Date().toISOString(),
                logCount: logs.length,
                levels: logs.reduce((acc: Record<string, number>, log: any) => {
                    acc[log.level] = (acc[log.level] || 0) + 1;
                    return acc;
                }, {}),
            });

            // Log each entry in development for debugging
            logs.forEach((log: any, index: number) => {
                console.log(`  [${index + 1}/${logs.length}] ${log.level.toUpperCase()}: ${log.message}`, {
                    component: log.context?.component,
                    timestamp: log.timestamp,
                });
            });
        } else {
            // In production, forward to your logging service
            // Example for DataDog, Sentry, or other services:

            // await forwardToLoggingService(logs);

            // For now, just acknowledge receipt
            console.log(`Received ${batchSize} log entries for processing`);
        }

        return NextResponse.json({
            success: true,
            processed: logs.length,
            message: `Successfully processed ${logs.length} log entries`
        });

    } catch (error) {
        console.error('Logging API error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to process logs' },
            { status: 500 }
        );
    }
}

// Optional: Handle GET requests for log retrieval/status
export async function GET() {
    return NextResponse.json({
        service: 'OpenSVM Logging API',
        status: 'active',
        batchingEnabled: true,
        batchInterval: '60 seconds',
        maxBatchSize: 100,
    });
}
