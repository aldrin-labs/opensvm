import { NextResponse } from 'next/server';
import zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);
const brotliCompress = promisify(zlib.brotliCompress);

export interface CompressionOptions {
  threshold?: number; // Minimum size in bytes to compress (default: 1024)
  level?: number; // Compression level 0-9 (default: 6)
  preferBrotli?: boolean; // Prefer Brotli over Gzip (default: true)
}

const defaultOptions: CompressionOptions = {
  threshold: 1024, // 1KB
  level: 6,
  preferBrotli: true,
};

export async function compressResponse(
  data: any,
  acceptEncoding: string | null,
  options: CompressionOptions = {}
): Promise<{ body: Buffer | string; encoding?: string }> {
  const opts = { ...defaultOptions, ...options };
  
  // Convert data to string if needed
  const content = typeof data === 'string' ? data : JSON.stringify(data);
  const contentLength = Buffer.byteLength(content);
  
  // Don't compress small payloads
  if (contentLength < opts.threshold!) {
    return { body: content };
  }
  
  // Check what encodings the client accepts
  const acceptedEncodings = acceptEncoding?.toLowerCase() || '';
  
  // Prefer Brotli if supported and preferred
  if (opts.preferBrotli && acceptedEncodings.includes('br')) {
    const compressed = await brotliCompress(content, {
      params: {
        [zlib.constants.BROTLI_PARAM_QUALITY]: opts.level!,
      },
    });
    
    // Only use if compression actually saves space
    if (compressed.length < contentLength) {
      return { body: compressed, encoding: 'br' };
    }
  }
  
  // Fall back to Gzip if supported
  if (acceptedEncodings.includes('gzip')) {
    const compressed = await gzip(content, { level: opts.level });
    
    // Only use if compression actually saves space
    if (compressed.length < contentLength) {
      return { body: compressed, encoding: 'gzip' };
    }
  }
  
  // No compression
  return { body: content };
}

export function createCompressedResponse(
  data: any,
  headers: Headers,
  options?: CompressionOptions
): Promise<NextResponse> {
  return new Promise(async (resolve) => {
    const acceptEncoding = headers.get('accept-encoding');
    
    try {
      const { body, encoding } = await compressResponse(data, acceptEncoding, options);
      
      const responseHeaders = new Headers({
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=10',
      });
      
      if (encoding) {
        responseHeaders.set('Content-Encoding', encoding);
        responseHeaders.set('Vary', 'Accept-Encoding');
      }
      
      // Convert Buffer to proper BodyInit type for NextResponse
      let responseBody: BodyInit;
      if (body instanceof Buffer) {
        responseBody = new Uint8Array(body);
      } else {
        responseBody = body as string;
      }
      
      resolve(new NextResponse(responseBody, {
        status: 200,
        headers: responseHeaders,
      }));
    } catch (error) {
      // Fallback to uncompressed response on error
      console.error('Compression error:', error);
      resolve(NextResponse.json(data));
    }
  });
}

// Middleware to automatically compress API responses
export function withCompression<T extends (...args: any[]) => Promise<any>>(
  handler: T,
  options?: CompressionOptions
): T {
  return (async (...args: any[]) => {
    const result = await handler(...args);
    
    // If it's already a Response, check if we can compress it
    if (result instanceof Response) {
      const contentType = result.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        try {
          const data = await result.json();
          const request = args[0] as Request;
          return createCompressedResponse(data, request.headers, options);
        } catch {
          // If can't parse JSON, return as-is
          return result;
        }
      }
    }
    
    return result;
  }) as T;
}
