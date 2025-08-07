import { NextRequest, NextResponse } from 'next/server';
import { openApiGenerator } from '@/lib/api/openapi-generator';
import logger from '@/lib/logging/logger';
import path from 'path';

export async function GET(request: NextRequest) {
  const startTime = performance.now();
  
  try {
    logger.info('OpenAPI specification requested', {
      component: 'OpenAPIRoute',
      metadata: {
        userAgent: request.headers.get('user-agent'),
        referer: request.headers.get('referer')
      }
    });

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'json';
    const download = searchParams.get('download') === 'true';

    // Scan API routes if requested (development only)
    if (process.env.NODE_ENV === 'development' && searchParams.get('scan') === 'true') {
      const apiDir = path.join(process.cwd(), 'app', 'api');
      await openApiGenerator.scanApiRoutes(apiDir);
      logger.info('API routes scanned and added to OpenAPI spec', {
        component: 'OpenAPIRoute'
      });
    }

    // Generate specification
    const spec = openApiGenerator.generateSpec();
    
    const endTime = performance.now();
    const duration = endTime - startTime;

    logger.info('OpenAPI specification generated', {
      component: 'OpenAPIRoute',
      metadata: {
        format,
        download,
        generationTime: duration,
        endpointCount: Object.keys(spec.paths).length,
        schemaCount: Object.keys(spec.components.schemas).length
      }
    });

    // Set response headers
    const headers: HeadersInit = {
      'Content-Type': format === 'yaml' ? 'text/yaml' : 'application/json',
      'X-Generation-Time': duration.toString(),
      'X-Endpoint-Count': Object.keys(spec.paths).length.toString(),
      'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
    };

    if (download) {
      headers['Content-Disposition'] = `attachment; filename="openapi-spec.${format}"`;
    }

    // Return specification
    const content = format === 'yaml' 
      ? JSON.stringify(spec, null, 2) // Would use YAML library in real implementation
      : JSON.stringify(spec, null, 2);

    return new NextResponse(content, {
      status: 200,
      headers
    });

  } catch (error) {
    const endTime = performance.now();
    const duration = endTime - startTime;

    logger.error('Failed to generate OpenAPI specification', {
      component: 'OpenAPIRoute',
      metadata: {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        duration
      }
    });

    return NextResponse.json(
      {
        error: 'Failed to generate OpenAPI specification',
        code: 'OPENAPI_GENERATION_ERROR',
        details: process.env.NODE_ENV === 'development' ? {
          message: error instanceof Error ? error.message : 'Unknown error'
        } : undefined
      },
      { status: 500 }
    );
  }
}

// Health check endpoint for the documentation
export async function HEAD(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=60'
    }
  });
}