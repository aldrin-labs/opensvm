import logger from '@/lib/logging/logger';

export interface RequestLogEntry {
  id: string;
  timestamp: number;
  method: string;
  url: string;
  path: string;
  queryParams: Record<string, any>;
  headers: Record<string, any>;
  body?: any;
  userAgent?: string;
  ip?: string;
  userId?: string;
  sessionId?: string;
}

export interface ResponseLogEntry {
  requestId: string;
  timestamp: number;
  status: number;
  statusText: string;
  headers: Record<string, any>;
  body?: any;
  duration: number;
  cached: boolean;
  size?: number;
  error?: string;
}

export interface RequestResponseLog {
  id: string;
  request: RequestLogEntry;
  response?: ResponseLogEntry;
  completed: boolean;
  startTime: number;
  endTime?: number;
  totalDuration?: number;
}

class RequestResponseLogger {
  private static instance: RequestResponseLogger;
  private logs = new Map<string, RequestResponseLog>();
  private maxLogs = 1000; // Keep last 1000 request/response pairs
  private retentionTime = 24 * 60 * 60 * 1000; // 24 hours

  static getInstance(): RequestResponseLogger {
    if (!RequestResponseLogger.instance) {
      RequestResponseLogger.instance = new RequestResponseLogger();
    }
    return RequestResponseLogger.instance;
  }

  private constructor() {
    // Clean up old logs periodically
    setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  private cleanup(): void {
    const now = Date.now();
    const cutoff = now - this.retentionTime;
    
    // Remove old logs
    for (const [id, log] of this.logs.entries()) {
      if (log.startTime < cutoff) {
        this.logs.delete(id);
      }
    }

    // Keep only the most recent logs if we exceed max
    if (this.logs.size > this.maxLogs) {
      const entries = Array.from(this.logs.entries())
        .sort(([, a], [, b]) => b.startTime - a.startTime)
        .slice(0, this.maxLogs);
      
      this.logs.clear();
      for (const [id, log] of entries) {
        this.logs.set(id, log);
      }
    }
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private sanitizeHeaders(headers: Headers | Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};
    
    // Sensitive headers to redact
    const sensitiveHeaders = [
      'authorization', 'cookie', 'x-api-key', 'x-auth-token',
      'x-session-token', 'x-csrf-token', 'x-access-token'
    ];

    if (headers instanceof Headers) {
      for (const [key, value] of headers.entries()) {
        const lowerKey = key.toLowerCase();
        if (sensitiveHeaders.includes(lowerKey)) {
          sanitized[key] = '[REDACTED]';
        } else {
          sanitized[key] = value;
        }
      }
    } else {
      for (const [key, value] of Object.entries(headers)) {
        const lowerKey = key.toLowerCase();
        if (sensitiveHeaders.includes(lowerKey)) {
          sanitized[key] = '[REDACTED]';
        } else {
          sanitized[key] = value;
        }
      }
    }

    return sanitized;
  }

  private sanitizeBody(body: any, contentType?: string): any {
    if (!body) return undefined;

    try {
      // Don't log large bodies (> 10KB)
      const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
      if (bodyStr.length > 10240) {
        return { 
          _truncated: true, 
          _originalSize: bodyStr.length,
          _message: 'Body too large to log'
        };
      }

      // Redact sensitive fields from JSON bodies
      if (contentType?.includes('application/json') && typeof body === 'object') {
        return this.redactSensitiveFields(body);
      }

      return body;
    } catch (error) {
      return { 
        _error: 'Failed to serialize body',
        _message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private redactSensitiveFields(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;

    const sensitiveFields = [
      'password', 'token', 'secret', 'key', 'apiKey', 'accessToken',
      'refreshToken', 'sessionToken', 'privateKey', 'credentials'
    ];

    const redacted = Array.isArray(obj) ? [] : {};

    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      
      if (sensitiveFields.some(field => lowerKey.includes(field.toLowerCase()))) {
        (redacted as any)[key] = '[REDACTED]';
      } else if (value && typeof value === 'object') {
        (redacted as any)[key] = this.redactSensitiveFields(value);
      } else {
        (redacted as any)[key] = value;
      }
    }

    return redacted;
  }

  private getClientIP(request: Request): string {
    // Try various headers for client IP
    const headers = request.headers;
    return (
      headers.get('cf-connecting-ip') ||
      headers.get('x-real-ip') ||
      headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      headers.get('x-client-ip') ||
      'unknown'
    );
  }

  public async logRequest(request: Request, options?: {
    userId?: string;
    sessionId?: string;
    includeBody?: boolean;
  }): Promise<string> {
    const requestId = this.generateRequestId();
    const timestamp = Date.now();
    const url = new URL(request.url);

    // Extract query parameters
    const queryParams: Record<string, any> = {};
    for (const [key, value] of url.searchParams.entries()) {
      queryParams[key] = value;
    }

    // Get request body if specified and method allows it
    let body: any;
    if (options?.includeBody && ['POST', 'PUT', 'PATCH'].includes(request.method)) {
      try {
        // Clone the request to read body without consuming it
        const clonedRequest = request.clone();
        const contentType = clonedRequest.headers.get('content-type') || '';
        
        if (contentType.includes('application/json')) {
          body = await clonedRequest.json();
        } else if (contentType.includes('text/')) {
          body = await clonedRequest.text();
        } else if (contentType.includes('application/x-www-form-urlencoded')) {
          const formData = await clonedRequest.formData();
          body = Object.fromEntries(formData.entries());
        }
        // Note: For other content types (like multipart/form-data), we skip logging the body
      } catch (error) {
        body = { 
          _error: 'Failed to parse request body',
          _contentType: request.headers.get('content-type')
        };
      }
    }

    const requestLog: RequestLogEntry = {
      id: requestId,
      timestamp,
      method: request.method,
      url: request.url,
      path: url.pathname,
      queryParams,
      headers: this.sanitizeHeaders(request.headers),
      body: this.sanitizeBody(body, request.headers.get('content-type') || undefined),
      userAgent: request.headers.get('user-agent') || undefined,
      ip: this.getClientIP(request),
      userId: options?.userId,
      sessionId: options?.sessionId || this.extractSessionId(request)
    };

    const log: RequestResponseLog = {
      id: requestId,
      request: requestLog,
      completed: false,
      startTime: timestamp
    };

    this.logs.set(requestId, log);

    // Log to structured logger
    logger.info('API Request', {
      component: 'RequestResponseLogger',
      requestId,
      metadata: {
        method: request.method,
        path: url.pathname,
        ip: requestLog.ip,
        userAgent: requestLog.userAgent,
        queryParamsCount: Object.keys(queryParams).length,
        hasBody: !!body,
        userId: options?.userId,
        sessionId: options?.sessionId
      }
    });

    return requestId;
  }

  public logResponse(
    requestId: string, 
    response: Response, 
    options?: {
      includeBody?: boolean;
      cached?: boolean;
      duration?: number;
    }
  ): void {
    const log = this.logs.get(requestId);
    if (!log) {
      logger.warn('Response logged for unknown request', {
        component: 'RequestResponseLogger',
        metadata: { requestId, status: response.status }
      });
      return;
    }

    const timestamp = Date.now();
    const duration = options?.duration ?? (timestamp - log.startTime);

    // Get response body if specified
    let body: any;
    if (options?.includeBody && response.status < 400) {
      try {
        // Clone response to avoid consuming the stream
        const clonedResponse = response.clone();
        const contentType = clonedResponse.headers.get('content-type') || '';
        
        // We can't await here, so we'll handle this asynchronously
        this.extractResponseBody(clonedResponse, contentType).then(extractedBody => {
          if (log.response) {
            log.response.body = this.sanitizeBody(extractedBody, contentType);
          }
        });
      } catch (error) {
        body = { 
          _error: 'Failed to parse response body',
          _contentType: response.headers.get('content-type')
        };
      }
    }

    const responseLog: ResponseLogEntry = {
      requestId,
      timestamp,
      status: response.status,
      statusText: response.statusText,
      headers: this.sanitizeHeaders(response.headers),
      body: this.sanitizeBody(body, response.headers.get('content-type') || undefined),
      duration,
      cached: options?.cached || false,
      size: this.getResponseSize(response),
      error: response.status >= 400 ? `HTTP ${response.status}: ${response.statusText}` : undefined
    };

    // Update the log entry
    log.response = responseLog;
    log.completed = true;
    log.endTime = timestamp;
    log.totalDuration = duration;

    // Log to structured logger
    logger.info('API Response', {
      component: 'RequestResponseLogger',
      requestId,
      metadata: {
        status: response.status,
        duration,
        cached: options?.cached || false,
        size: responseLog.size,
        path: log.request.path,
        method: log.request.method,
        success: response.status < 400
      }
    });

    // Log errors separately
    if (response.status >= 400) {
      logger.warn('API Error Response', {
        component: 'RequestResponseLogger',
        requestId,
        metadata: {
          status: response.status,
          statusText: response.statusText,
          path: log.request.path,
          method: log.request.method,
          ip: log.request.ip,
          userAgent: log.request.userAgent
        }
      });
    }
  }

  private async extractResponseBody(response: Response, contentType: string): Promise<any> {
    try {
      if (contentType.includes('application/json')) {
        return await response.json();
      } else if (contentType.includes('text/')) {
        return await response.text();
      }
    } catch (error) {
      return { 
        _error: 'Failed to extract response body',
        _message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
    return undefined;
  }

  private getResponseSize(response: Response): number | undefined {
    const contentLength = response.headers.get('content-length');
    return contentLength ? parseInt(contentLength, 10) : undefined;
  }

  private extractSessionId(request: Request): string | undefined {
    // Try to extract session ID from cookies or headers
    const cookies = request.headers.get('cookie');
    if (cookies) {
      const sessionMatch = cookies.match(/session[_-]?id=([^;]+)/i);
      if (sessionMatch) {
        return sessionMatch[1];
      }
    }

    return request.headers.get('x-session-id') || undefined;
  }

  public getLogs(options?: {
    limit?: number;
    since?: number;
    method?: string;
    status?: number;
    path?: string;
    userId?: string;
    sessionId?: string;
    completedOnly?: boolean;
  }): RequestResponseLog[] {
    let logs = Array.from(this.logs.values());

    // Apply filters
    if (options?.since) {
      logs = logs.filter(log => log.startTime >= options.since!);
    }

    if (options?.method) {
      logs = logs.filter(log => log.request.method === options.method);
    }

    if (options?.status && options?.completedOnly !== false) {
      logs = logs.filter(log => log.response?.status === options.status);
    }

    if (options?.path) {
      logs = logs.filter(log => log.request.path.includes(options.path!));
    }

    if (options?.userId) {
      logs = logs.filter(log => log.request.userId === options.userId);
    }

    if (options?.sessionId) {
      logs = logs.filter(log => log.request.sessionId === options.sessionId);
    }

    if (options?.completedOnly) {
      logs = logs.filter(log => log.completed);
    }

    // Sort by timestamp (newest first)
    logs.sort((a, b) => b.startTime - a.startTime);

    // Apply limit
    if (options?.limit) {
      logs = logs.slice(0, options.limit);
    }

    return logs;
  }

  public getLogById(requestId: string): RequestResponseLog | undefined {
    return this.logs.get(requestId);
  }

  public getStats(timeframe: number = 3600000): {
    totalRequests: number;
    completedRequests: number;
    averageResponseTime: number;
    errorRate: number;
    methodDistribution: Record<string, number>;
    statusDistribution: Record<number, number>;
    slowestRequests: Array<{ id: string; path: string; duration: number }>;
  } {
    const since = Date.now() - timeframe;
    const logs = this.getLogs({ since, completedOnly: true });

    const total = logs.length;
    const completed = logs.filter(log => log.completed).length;
    
    let totalDuration = 0;
    const methodCounts: Record<string, number> = {};
    const statusCounts: Record<number, number> = {};
    const errors = logs.filter(log => log.response && log.response.status >= 400).length;

    for (const log of logs) {
      if (log.response) {
        totalDuration += log.response.duration;
        methodCounts[log.request.method] = (methodCounts[log.request.method] || 0) + 1;
        statusCounts[log.response.status] = (statusCounts[log.response.status] || 0) + 1;
      }
    }

    const averageResponseTime = completed > 0 ? totalDuration / completed : 0;
    const errorRate = total > 0 ? (errors / total) * 100 : 0;

    // Get slowest requests
    const slowestRequests = logs
      .filter(log => log.response)
      .sort((a, b) => (b.response?.duration || 0) - (a.response?.duration || 0))
      .slice(0, 10)
      .map(log => ({
        id: log.id,
        path: log.request.path,
        duration: log.response!.duration
      }));

    return {
      totalRequests: total,
      completedRequests: completed,
      averageResponseTime,
      errorRate,
      methodDistribution: methodCounts,
      statusDistribution: statusCounts,
      slowestRequests
    };
  }

  public clearLogs(): void {
    this.logs.clear();
    logger.info('Request/Response logs cleared', {
      component: 'RequestResponseLogger'
    });
  }
}

// Helper function to wrap API handlers with request/response logging
export function withRequestLogging<T extends (...args: any[]) => Promise<Response>>(
  handler: T,
  options?: {
    includeRequestBody?: boolean;
    includeResponseBody?: boolean;
    userId?: (request: Request) => string | undefined;
    sessionId?: (request: Request) => string | undefined;
  }
): T {
  return (async (request: Request, ...args: any[]) => {
    const logger = RequestResponseLogger.getInstance();
    
    // Log the request
    const requestId = await logger.logRequest(request, {
      includeBody: options?.includeRequestBody,
      userId: options?.userId?.(request),
      sessionId: options?.sessionId?.(request)
    });

    const startTime = performance.now();

    try {
      // Execute the handler
      const response = await handler(request, ...args);
      
      const endTime = performance.now();
      const duration = endTime - startTime;

      // Log the response
      logger.logResponse(requestId, response, {
        includeBody: options?.includeResponseBody,
        duration
      });

      // Add request ID header for debugging
      response.headers.set('X-Request-ID', requestId);

      return response;
    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;

      // Create error response for logging
      const errorResponse = new Response(
        JSON.stringify({ 
          error: 'Internal Server Error',
          requestId 
        }), 
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );

      logger.logResponse(requestId, errorResponse, {
        duration
      });

      throw error;
    }
  }) as T;
}

export { RequestResponseLogger };
export default RequestResponseLogger;