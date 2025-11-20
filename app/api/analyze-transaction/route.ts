import { NextRequest, NextResponse } from 'next/server';
import Together from 'together-ai';

// Route segment config: Set timeout to 120 seconds
export const maxDuration = 120;


export const runtime = 'edge';

// Rate limiting map (in production, use Redis or similar)
const rateLimitMap = new Map<string, { count: number; lastRequest: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 30; // 30 requests per minute
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

// GET method for MCP tool compatibility
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const signature = searchParams.get('signature');

    if (!signature) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Transaction signature is required' 
        },
        { status: 400 }
      );
    }

    // Rate limiting
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Rate limit exceeded. Please try again later.' 
        },
        { status: 429 }
      );
    }

    // Fetch transaction from Solana RPC
    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
    const rpcResponse = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getTransaction',
        params: [
          signature,
          {
            encoding: 'json',
            maxSupportedTransactionVersion: 0
          }
        ]
      })
    });

    if (!rpcResponse.ok) {
      throw new Error('Failed to fetch transaction from RPC');
    }

    const rpcData = await rpcResponse.json();
    
    if (rpcData.error || !rpcData.result) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Transaction not found' 
        },
        { status: 404 }
      );
    }

    const tx = rpcData.result;
    const logs = tx.meta?.logMessages || [];
    const err = tx.meta?.err;
    const fee = tx.meta?.fee || 0;

    // Generate analysis
    const analysis = await analyzeTransactionData({
      signature,
      logs,
      status: err ? 'failed' : 'success',
      fee,
      slot: tx.slot,
      blockTime: tx.blockTime
    });

    return NextResponse.json({
      success: true,
      data: {
        signature,
        analysis,
        metadata: {
          slot: tx.slot,
          blockTime: tx.blockTime,
          fee,
          status: err ? 'failed' : 'success'
        }
      }
    });

  } catch (error) {
    serverLog('error', 'Error in GET analyze-transaction', {
      error: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to analyze transaction' 
      },
      { status: 500 }
    );
  }
}

async function analyzeTransactionData(data: {
  signature?: string;
  logs: string[];
  type?: string;
  status: string;
  amount?: number;
  from?: string;
  to?: string;
  fee?: number;
  slot?: number;
  blockTime?: number;
}): Promise<string> {
  const { logs, type, status, amount, from, to, fee, signature } = data;

  // Sanitize logs
  const sanitizedLogs = logs.slice(0, MAX_LOG_ENTRIES).map((log: any) => {
    if (typeof log === 'string') {
      if (log.length > MAX_LOG_LENGTH) {
        return log.substring(0, MAX_LOG_LENGTH) + '... [truncated]';
      }
      return sanitizeString(log);
    }
    return '[non-string log entry]';
  });

  const sanitizedType = type ? sanitizeString(String(type)) : undefined;
  const sanitizedStatus = sanitizeString(String(status));
  const sanitizedFrom = from ? sanitizeString(String(from)) : undefined;
  const sanitizedTo = to ? sanitizeString(String(to)) : undefined;

  // Generate a default fallback response in case API key is missing
  const fallbackAnalysis = `
This ${signature ? `transaction (${signature.slice(0, 8)}...)` : 'transaction'} ${sanitizedStatus === 'success' ? 'completed successfully' : 'failed'}.
${sanitizedType ? `Type: ${sanitizedType}` : ''}
${amount ? `Amount: ${amount} SOL` : ''}
${fee ? `Fee: ${fee / 1e9} SOL` : ''}
${sanitizedFrom && sanitizedTo ? `Transfer from ${sanitizedFrom.slice(0, 8)}... to ${sanitizedTo.slice(0, 8)}...` : ''}

The transaction involved ${sanitizedLogs.length} log entries. ${sanitizedStatus === 'success' ? 'All operations completed without errors.' : 'The transaction encountered an error during execution.'}
`.trim();

  // Check if API key is available
  const apiKey = process.env.TOGETHER_API_KEY;
  if (!apiKey) {
    serverLog('warn', 'TOGETHER_API_KEY is not set, using fallback response');
    return fallbackAnalysis;
  }

  try {
    // Initialize Together AI client
    const together = new Together({ apiKey });

    // Create analysis prompt
    const prompt = `Analyze this Solana transaction and provide a clear, concise explanation:

Signature: ${signature || 'Unknown'}
Status: ${sanitizedStatus}
${sanitizedType ? `Type: ${sanitizedType}` : ''}
${amount ? `Amount: ${amount} SOL` : ''}
${fee ? `Fee: ${fee / 1e9} SOL` : ''}
${sanitizedFrom ? `From: ${sanitizedFrom}` : ''}
${sanitizedTo ? `To: ${sanitizedTo}` : ''}

Transaction Logs (${sanitizedLogs.length} entries):
${sanitizedLogs.slice(0, 20).join('\n')}

Please explain:
1. What operation was performed
2. Whether it succeeded or failed and why
3. Any notable programs or protocols involved
4. The purpose and significance of this transaction

Keep the explanation concise and accessible.`;

    const completion = await together.chat.completions.create({
      model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
      messages: [
        {
          role: 'system',
          content: 'You are a Solana blockchain expert who explains transactions clearly and concisely. Focus on the key actions and their implications.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 500,
      temperature: 0.7,
      top_p: 0.9,
    });

    const analysis = completion.choices[0]?.message?.content || fallbackAnalysis;
    return analysis.trim();

  } catch (error) {
    serverLog('error', 'AI API request failed', {
      error: error instanceof Error ? error.message : String(error)
    });
    return fallbackAnalysis;
  }
}

export async function POST(request: Request) {
  try {
    // Check request size
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > MAX_REQUEST_SIZE) {
      return NextResponse.json(
        { success: false, error: 'Request body too large' },
        { status: 413 }
      );
    }

    // Rate limiting
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { logs, type, status, amount, from, to, signature } = body;

    // Validate required parameters
    if (!logs || !Array.isArray(logs)) {
      return NextResponse.json(
        { success: false, error: 'Transaction logs are required and must be an array' },
        { status: 400 }
      );
    }

    // Validate log array size
    if (logs.length > MAX_LOG_ENTRIES) {
      return NextResponse.json(
        { success: false, error: `Too many log entries. Maximum allowed: ${MAX_LOG_ENTRIES}` },
        { status: 400 }
      );
    }

    // Generate analysis
    const analysis = await analyzeTransactionData({
      signature,
      logs,
      type,
      status: status || 'unknown',
      amount,
      from,
      to
    });

    return NextResponse.json({ 
      success: true,
      data: { analysis }
    });

  } catch (error) {
    serverLog('error', 'Error analyzing transaction', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return NextResponse.json(
      { success: false, error: 'Failed to analyze transaction' },
      { status: 500 }
    );
  }
}
