# API Key Activity Logging System

Complete activity tracking and monitoring system for API keys with metrics, logs, and a dashboard UI.

## Overview

The activity logging system tracks all API requests made with each API key, providing:
- **Real-time metrics**: Total requests, success/failure rates, average response times
- **Detailed activity logs**: Timestamp, endpoint, method, status code, response time for each request
- **Dashboard UI**: Visual interface to monitor all your API keys and their activity
- **Endpoint analytics**: See which endpoints are most frequently used
- **Time-based analytics**: Track usage patterns over time

## Architecture

### Components

1. **Qdrant Collection**: `api_key_activity` - Stores all activity logs
2. **Service Functions**: Core logging and retrieval functions in `lib/api-auth/service.ts`
3. **API Endpoints**: REST APIs for fetching metrics and activity logs
4. **Dashboard UI**: React page at `/profile/api-keys` for viewing activity
5. **Middleware**: Example middleware for easy integration into API routes

### Data Flow

```
API Request with Key
    ↓
Validate API Key
    ↓
Process Request
    ↓
Log Activity (async, non-blocking)
    ↓
Store in Qdrant
    ↓
Available in Dashboard
```

## Usage

### 1. Viewing Activity in the Dashboard

Navigate to `/profile/api-keys` and connect your wallet to see:

- **All your API keys** with their status (active/pending/revoked)
- **Metrics for each key**:
  - Total requests
  - Successful vs failed requests
  - Average response time
  - Last activity timestamp
- **Top endpoints** by request count
- **Recent activity log** with full details

### 2. Integrating Activity Logging into Your API Routes

#### Option A: Using the Middleware (Recommended)

```typescript
import { withApiKeyLogging } from '@/lib/api-auth/middleware-example';

export const GET = withApiKeyLogging(async (request, apiKey) => {
  // Your API logic here
  // The middleware handles validation and logging automatically
  
  const data = await yourBusinessLogic();
  
  return NextResponse.json({ data });
});
```

#### Option B: Manual Logging

```typescript
import { validateApiKey, logApiKeyActivity } from '@/lib/api-auth/service';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Extract and validate API key
    const authHeader = request.headers.get('authorization');
    const apiKey = await validateApiKey(authHeader?.substring(7) || '');
    
    if (!apiKey) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Your API logic
    const result = await yourBusinessLogic();
    
    // Log activity
    await logApiKeyActivity({
      apiKeyId: apiKey.id,
      timestamp: new Date(),
      endpoint: new URL(request.url).pathname,
      method: request.method,
      statusCode: 200,
      responseTime: Date.now() - startTime,
      userAgent: request.headers.get('user-agent') || undefined,
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
    });
    
    return NextResponse.json(result);
  } catch (error) {
    // Log failed request
    await logApiKeyActivity({
      apiKeyId: apiKey?.id || 'unknown',
      timestamp: new Date(),
      endpoint: new URL(request.url).pathname,
      method: request.method,
      statusCode: 500,
      responseTime: Date.now() - startTime,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });
    
    throw error;
  }
}
```

### 3. Fetching Metrics Programmatically

#### Get Metrics for an API Key

```bash
curl "http://localhost:3000/api/auth/api-keys/metrics?apiKeyId=YOUR_KEY_ID"
```

Response:
```json
{
  "apiKeyId": "abc123",
  "totalRequests": 1250,
  "successfulRequests": 1180,
  "failedRequests": 70,
  "averageResponseTime": 145.5,
  "lastActivity": "2025-01-10T14:30:00.000Z",
  "requestsByEndpoint": {
    "/api/data": 800,
    "/api/search": 300,
    "/api/analytics": 150
  },
  "requestsByDay": {
    "2025-01-10": 450,
    "2025-01-09": 380,
    "2025-01-08": 420
  }
}
```

#### Get Activity Logs

```bash
curl "http://localhost:3000/api/auth/api-keys/activity?apiKeyId=YOUR_KEY_ID&limit=50"
```

With date filtering:
```bash
curl "http://localhost:3000/api/auth/api-keys/activity?apiKeyId=YOUR_KEY_ID&startDate=2025-01-01&endDate=2025-01-10&limit=100"
```

Response:
```json
{
  "activities": [
    {
      "id": "log123",
      "apiKeyId": "abc123",
      "timestamp": "2025-01-10T14:30:00.000Z",
      "endpoint": "/api/data",
      "method": "GET",
      "statusCode": 200,
      "responseTime": 125,
      "userAgent": "MyApp/1.0",
      "ipAddress": "192.168.1.1"
    }
  ],
  "total": 1250,
  "hasMore": true
}
```

#### List All API Keys for a User

```bash
curl "http://localhost:3000/api/auth/api-keys/list?userId=WALLET_ADDRESS"
```

## API Reference

### Service Functions

#### `logApiKeyActivity(activity)`

Logs an API key activity event.

**Parameters:**
- `activity`: Object containing:
  - `apiKeyId` (string, required): ID of the API key
  - `timestamp` (Date, required): When the request occurred
  - `endpoint` (string, required): API endpoint path
  - `method` (string, required): HTTP method (GET, POST, etc.)
  - `statusCode` (number, required): HTTP status code
  - `responseTime` (number, required): Response time in milliseconds
  - `userAgent` (string, optional): User agent string
  - `ipAddress` (string, optional): Client IP address
  - `errorMessage` (string, optional): Error message if request failed
  - `requestSize` (number, optional): Request size in bytes
  - `responseSize` (number, optional): Response size in bytes

**Returns:** Promise<void>

#### `getApiKeyMetrics(apiKeyId)`

Retrieves aggregated metrics for an API key.

**Parameters:**
- `apiKeyId` (string): ID of the API key

**Returns:** Promise<ApiKeyMetrics>

#### `getApiKeyActivity(request)`

Retrieves activity logs for an API key.

**Parameters:**
- `request`: Object containing:
  - `apiKeyId` (string, required): ID of the API key
  - `limit` (number, optional): Max number of logs to return (default: 50)
  - `offset` (number, optional): Pagination offset (default: 0)
  - `startDate` (Date, optional): Filter logs after this date
  - `endDate` (Date, optional): Filter logs before this date

**Returns:** Promise<ApiKeyActivityListResponse>

### REST API Endpoints

#### GET /api/auth/api-keys/metrics

Get metrics for an API key.

**Query Parameters:**
- `apiKeyId` (required): API key ID

**Response:** ApiKeyMetrics object

#### GET /api/auth/api-keys/activity

Get activity logs for an API key.

**Query Parameters:**
- `apiKeyId` (required): API key ID
- `limit` (optional): Number of logs to return
- `offset` (optional): Pagination offset
- `startDate` (optional): ISO date string for filtering
- `endDate` (optional): ISO date string for filtering

**Response:** ApiKeyActivityListResponse object

#### GET /api/auth/api-keys/list

List all API keys for a user.

**Query Parameters:**
- `userId` (optional): Wallet address to filter by

**Response:** Array of ApiKey objects

## Data Types

### ApiKeyActivity

```typescript
interface ApiKeyActivity {
  id: string;
  apiKeyId: string;
  timestamp: Date;
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number;
  userAgent?: string;
  ipAddress?: string;
  errorMessage?: string;
  requestSize?: number;
  responseSize?: number;
}
```

### ApiKeyMetrics

```typescript
interface ApiKeyMetrics {
  apiKeyId: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  lastActivity?: Date;
  requestsByEndpoint: Record<string, number>;
  requestsByDay: Record<string, number>;
}
```

## Performance Considerations

1. **Async Logging**: Activity logging is non-blocking and won't slow down API responses
2. **Indexed Fields**: Qdrant indexes on `apiKeyId`, `endpoint`, and `statusCode` for fast queries
3. **Pagination**: Use `limit` and `offset` parameters to handle large activity logs
4. **Metrics Caching**: Consider caching metrics for frequently accessed keys

## Best Practices

1. **Always log activity** for API key requests to maintain accurate metrics
2. **Include error messages** when logging failed requests for debugging
3. **Use the middleware** for consistent logging across all API routes
4. **Monitor metrics regularly** to detect unusual patterns or abuse
5. **Set appropriate limits** on activity log queries to avoid performance issues

## Troubleshooting

### Activity not showing in dashboard

1. Verify the API key is active and bound to a wallet
2. Check that logging is implemented in your API routes
3. Ensure Qdrant is running and accessible
4. Check browser console for errors

### Metrics seem incorrect

1. Verify all API routes are logging activity
2. Check for duplicate logging calls
3. Ensure timestamps are correct
4. Review Qdrant collection for data integrity

### Performance issues

1. Add pagination to activity log queries
2. Implement caching for frequently accessed metrics
3. Consider archiving old activity logs
4. Monitor Qdrant resource usage

## Example: Complete Integration

Here's a complete example of an API route with activity logging:

```typescript
// app/api/my-endpoint/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { withApiKeyLogging } from '@/lib/api-auth/middleware-example';

export const GET = withApiKeyLogging(async (request, apiKey) => {
  // Your business logic
  const data = {
    message: 'Hello from protected API',
    keyName: apiKey.name,
    timestamp: new Date().toISOString(),
  };
  
  return NextResponse.json(data);
});

export const POST = withApiKeyLogging(async (request, apiKey) => {
  const body = await request.json();
  
  // Process the request
  const result = await processData(body);
  
  return NextResponse.json({ success: true, result });
});
```

## Related Documentation

- [API-KEY-AUTH-SYSTEM.md](./API-KEY-AUTH-SYSTEM.md) - Main API key authentication system
- [lib/api-auth/middleware-example.ts](./lib/api-auth/middleware-example.ts) - Middleware implementation
- [lib/api-auth/service.ts](./lib/api-auth/service.ts) - Core service functions
