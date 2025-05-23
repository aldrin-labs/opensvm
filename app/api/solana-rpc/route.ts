import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from '@/lib/solana-connection';

// Simple in-memory cache
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 30000; // 30 seconds

function getCacheKey(method: string, params: any[]): string {
  return `${method}:${JSON.stringify(params)}`;
}

function getFromCache(key: string): any | null {
  const cached = cache.get(key);
  if (!cached) return null;

  const now = Date.now();
  if (now - cached.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }

  return cached.data;
}

function setCache(key: string, data: any): void {
  cache.set(key, { data, timestamp: Date.now() });
}

async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 5,
  initialDelay: number = 2000
): Promise<T> {
  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase();
        if (errorMessage.includes('invalid') || errorMessage.includes('unsupported')) {
          throw error;
        }
      }
      
      if (attempt === maxRetries - 1) {
        throw lastError;
      }
      
      const delay = initialDelay * Math.pow(1.5, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Try to get from cache first
    const cacheKey = getCacheKey(body.method, body.params);
    const cachedResult = getFromCache(cacheKey);
    if (cachedResult) {
      return NextResponse.json({
        jsonrpc: '2.0',
        result: cachedResult,
        id: body.id
      });
    }

    // Get connection from pool
    const connection = await getConnection();

    let result;
    try {
      // For getTransaction method, try direct connection first
      if (body.method === 'getTransaction') {
        try {
          const [signature] = body.params;
          result = await connection.getParsedTransaction(signature, {
            maxSupportedTransactionVersion: 0,
            commitment: 'confirmed'
          });

          if (result) {
            setCache(cacheKey, result);
            return NextResponse.json({
              jsonrpc: '2.0',
              result,
              id: body.id
            });
          }
        } catch (error) {
          console.error('Direct connection error:', error);
        }
      }

      // Fallback to RPC request
      result = await retryOperation(async () => {
        const response = await fetch(connection.rpcEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: body.id,
            method: body.method,
            params: body.params
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`RPC request failed: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        if (data.error) {
          throw new Error(data.error.message || 'Unknown RPC error');
        }

        return data.result;
      });

      // Cache successful results
      setCache(cacheKey, result);

      return NextResponse.json({
        jsonrpc: '2.0',
        result,
        id: body.id
      });
    } catch (error) {
      if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase();
        if (errorMessage.includes('not found')) {
          return NextResponse.json({
            jsonrpc: '2.0',
            error: {
              code: -32000,
              message: 'Transaction not found'
            },
            id: body.id
          }, { status: 404 });
        }
        if (errorMessage.includes('rate limit')) {
          return NextResponse.json({
            jsonrpc: '2.0',
            error: {
              code: -32000,
              message: 'Rate limit exceeded. Please try again later.'
            },
            id: body.id
          }, { status: 429 });
        }
      }
      throw error;
    }
  } catch (error) {
    console.error('RPC error:', error);
    
    let status = 500;
    let message = error instanceof Error ? error.message : 'Unknown error';
    
    if (message.toLowerCase().includes('invalid')) {
      status = 400;
    } else if (message.toLowerCase().includes('not found')) {
      status = 404;
    } else if (message.toLowerCase().includes('rate limit')) {
      status = 429;
    }
    
    return NextResponse.json({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message
      },
      id: body.id
    }, { status });
  }
}

