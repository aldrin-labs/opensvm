import { NextResponse } from 'next/server';

// Rate limiting map (in production, use Redis or similar)
const rateLimitMap = new Map<string, { count: number; lastRequest: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10; // 10 requests per minute
const MAX_REQUEST_SIZE = 1024 * 1024; // 1MB max request size
const MAX_LOG_ENTRIES = 100; // Maximum number of log entries
const MAX_LOG_LENGTH = 10000; // Maximum length per log entry

// Simple server-side logging (in production, use proper logging service)
function serverLog(level: 'error' | 'warn' | 'info', message: string, context?: Record<string, any>) {
  if (process.env.NODE_ENV !== 'production') {
    const logMethod = level === 'error' ? console.error : 
                     level === 'warn' ? console.warn : console.log;
    logMethod(`[API] ${message}`, context || {});
  }
  // In production, send to external logging service
}

function sanitizeString(str: string): string {
  // Remove potential log injection characters and limit length
  return str
    .replace(/[\r\n\t]/g, ' ') // Replace newlines and tabs with spaces
    .replace(/[^\x20-\x7E]/g, '') // Remove non-printable characters
    .substring(0, 1000); // Limit to 1000 characters
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  
  if (!record) {
    rateLimitMap.set(ip, { count: 1, lastRequest: now });
    return true;
  }
  
  // Reset count if window has passed
  if (now - record.lastRequest > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(ip, { count: 1, lastRequest: now });
    return true;
  }
  
  // Check if within limit
  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }
  
  // Increment count
  record.count++;
  record.lastRequest = now;
  return true;
}

export async function POST(request: Request) {
  try {
    // Check request size
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > MAX_REQUEST_SIZE) {
      return NextResponse.json(
        { error: 'Request body too large' },
        { status: 413 }
      );
    }

    // Rate limiting
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      );
    }

    const { logs, type, status, amount, from, to } = await request.json();

    // Validate and sanitize required parameters
    if (!logs || !Array.isArray(logs)) {
      return NextResponse.json(
        { error: 'Transaction logs are required and must be an array' },
        { status: 400 }
      );
    }

    // Validate log array size and sanitize content
    if (logs.length > MAX_LOG_ENTRIES) {
      return NextResponse.json(
        { error: `Too many log entries. Maximum allowed: ${MAX_LOG_ENTRIES}` },
        { status: 400 }
      );
    }

    // Sanitize logs to prevent injection attacks
    const sanitizedLogs = logs.map((log: any) => {
      if (typeof log === 'string') {
        if (log.length > MAX_LOG_LENGTH) {
          return log.substring(0, MAX_LOG_LENGTH) + '... [truncated]';
        }
        return sanitizeString(log);
      }
      return '[non-string log entry]';
    });

    // Sanitize other parameters
    const sanitizedType = type ? sanitizeString(String(type)) : undefined;
    const sanitizedStatus = status ? sanitizeString(String(status)) : undefined;
    const sanitizedFrom = from ? sanitizeString(String(from)) : undefined;
    const sanitizedTo = to ? sanitizeString(String(to)) : undefined;

    // Generate a default fallback response in case API key is missing
    let fallbackAnalysis = `
This appears to be a ${sanitizedType || 'unknown'} transaction that ${sanitizedStatus || 'executed'}.
${amount ? `The transaction involved ${amount} SOL.` : ''}
${sanitizedFrom && sanitizedTo ? `Funds moved from ${sanitizedFrom.slice(0, 8)}... to ${sanitizedTo.slice(0, 8)}...` : ''}

Without more context or API access, I cannot provide a detailed analysis of the logs.
`;

    // Check if API key is available
    if (!process.env.TOGETHER_API_KEY) {
      serverLog('warn', 'TOGETHER_API_KEY is not set, using fallback response');
      return NextResponse.json({ analysis: fallbackAnalysis.trim() });
    }

    // Create analysis prompt with sanitized data
    const prompt = `Analyze this Solana transaction:
Type: ${sanitizedType || 'Unknown'}
Status: ${sanitizedStatus || 'Unknown'}
Amount: ${amount ? `${amount} SOL` : 'Unknown'}
From: ${sanitizedFrom || 'Unknown'}
To: ${sanitizedTo || 'Unknown'}

Transaction Logs:
${sanitizedLogs.join('\n')}

Please explain in simple terms what happened in this transaction, including:
1. What type of operation was performed
2. Whether it was successful
3. Any notable details from the logs
4. Potential purpose of the transaction`;

    // Make API request
    const response = await fetch('https://api.together.xyz/inference', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.TOGETHER_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
        prompt,
        max_tokens: 500,
        temperature: 0.7,
        top_p: 0.7,
        top_k: 50,
        repetition_penalty: 1,
        stop: ['<human>', '<assistant>'],
      }),
    });

    if (!response.ok) {
      serverLog('error', 'GPT API response not OK', { 
        status: response.status, 
        statusText: response.statusText 
      });
      throw new Error('GPT API request failed');
    }

    const data = await response.json();
    
    if (!data?.output?.choices?.[0]?.text) {
      serverLog('error', 'Unexpected API response format', { responseData: data });
      throw new Error('Invalid API response format');
    }
    
    return NextResponse.json({ analysis: data.output.choices[0].text.trim() });
  } catch (error) {
    serverLog('error', 'Error analyzing transaction', { 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return NextResponse.json(
      { error: 'Failed to analyze transaction' },
      { status: 500 }
    );
  }
}
