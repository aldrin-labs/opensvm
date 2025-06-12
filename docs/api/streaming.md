# Streaming API Documentation

## Overview

The OpenSVM Streaming API provides real-time blockchain event monitoring with AI-driven anomaly detection. The API supports both WebSocket connections and HTTP polling with comprehensive rate limiting and authentication.

## Authentication

### Token Lifecycle

1. **Request Authentication**
   ```http
   POST /api/stream
   Content-Type: application/json
   
   {
     "action": "authenticate",
     "clientId": "your-client-id"
   }
   ```

2. **Response**
   ```json
   {
     "success": true,
     "authToken": "abc123...",
     "message": "Client authenticated",
     "expiresIn": 3600,
     "rateLimits": {
       "api_requests": { "tokens": 100, "capacity": 100 },
       "websocket_connections": { "tokens": 10, "capacity": 10 }
     }
   }
   ```

3. **Token Expiration**: Tokens expire after 1 hour (3600 seconds)
4. **Token Usage**: Include the token in subsequent requests:
   ```json
   {
     "action": "subscribe",
     "clientId": "your-client-id",
     "authToken": "abc123...",
     "eventTypes": ["transaction", "block"]
   }
   ```

### Authentication Failures

- **Rate Limiting**: Max 5 authentication attempts per 10 minutes
- **Account Blocking**: After 5 failed attempts, client is blocked for 1 hour
- **Failure Logging**: All authentication failures are logged with reasons

## Rate Limiting

The API uses Token Bucket rate limiting with different limits for different operations:

### Rate Limit Types

| Type | Capacity | Refill Rate | Window |
|------|----------|-------------|--------|
| API Requests | 100 requests | 10/second | 1 minute |
| WebSocket Connections | 10 connections | 1/second | 1 minute |
| Authentication | 5 attempts | 1/10 seconds | 5 minutes |
| Anomaly Analysis | 50 requests | 5/second | 1 minute |

### Rate Limit Headers

API responses include rate limit information:

```http
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 2024-01-01T12:00:00Z
Retry-After: 60
```

### Rate Limit Errors

When rate limits are exceeded:

```json
{
  "error": "Rate limit exceeded",
  "remainingTokens": 0,
  "resetTime": "2024-01-01T12:00:00Z",
  "retryAfter": 60
}
```

## WebSocket Connections

### Connection Upgrade

```javascript
const ws = new WebSocket('ws://localhost:3000/api/stream?clientId=my-client');

ws.onopen = () => {
  console.log('WebSocket connected');
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received event:', data);
};
```

### WebSocket Limitations

- **Environment Support**: WebSocket upgrades require a WebSocket-capable server
- **Next.js Limitation**: API routes don't support WebSocket upgrades directly
- **Alternative**: Use HTTP polling or deploy with custom WebSocket server

## HTTP Polling API

### Subscribe to Events

```http
POST /api/stream
Content-Type: application/json

{
  "action": "subscribe",
  "clientId": "your-client-id",
  "authToken": "your-auth-token",
  "eventTypes": ["transaction", "block", "account_change"]
}
```

### Supported Event Types

- `transaction`: Real-time transaction events
- `block`: New block notifications
- `account_change`: Account state changes
- `all`: Subscribe to all event types

### Unsubscribe

```http
POST /api/stream
Content-Type: application/json

{
  "action": "unsubscribe",
  "clientId": "your-client-id"
}
```

## Event Filtering

Events are automatically filtered to focus on meaningful blockchain activity:

### Included Events
- Custom program calls
- SPL token transfers
- Known DEX interactions (Raydium, Meteora, Aldrin, Pumpswap)

### Excluded Events
- Vote transactions
- System program transactions
- Compute budget transactions

## Anomaly Detection Integration

The streaming API integrates with AI-driven anomaly detection:

### Anomaly Analysis

```http
POST /api/anomaly
Content-Type: application/json

{
  "action": "analyze",
  "event": {
    "type": "transaction",
    "timestamp": 1640995200000,
    "data": {
      "signature": "abc123...",
      "fee": 50000,
      "logs": ["Program log: success"]
    }
  }
}
```

### Bulk Analysis

```http
POST /api/anomaly
Content-Type: application/json

{
  "action": "bulk_analyze",
  "event": [
    { "type": "transaction", "timestamp": 1640995200000, "data": {...} },
    { "type": "transaction", "timestamp": 1640995201000, "data": {...} }
  ]
}
```

## Error Handling

### Common Error Codes

| Code | Description | Solution |
|------|-------------|----------|
| 400 | Bad Request | Check request format and required fields |
| 401 | Unauthorized | Authenticate or refresh token |
| 403 | Forbidden | Client blocked, contact support |
| 426 | Upgrade Required | WebSocket upgrade needed but not supported |
| 429 | Rate Limit Exceeded | Wait for rate limit reset |
| 500 | Internal Server Error | Server issue, try again later |

### Error Response Format

```json
{
  "error": "Error description",
  "details": "Additional error details",
  "code": "ERROR_CODE",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

## Client Libraries

### JavaScript/TypeScript

```typescript
class StreamingClient {
  private clientId: string;
  private authToken: string | null = null;
  
  constructor(clientId: string) {
    this.clientId = clientId;
  }
  
  async authenticate(): Promise<void> {
    const response = await fetch('/api/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'authenticate',
        clientId: this.clientId
      })
    });
    
    const data = await response.json();
    if (data.success) {
      this.authToken = data.authToken;
    } else {
      throw new Error(data.error);
    }
  }
  
  async subscribe(eventTypes: string[]): Promise<void> {
    if (!this.authToken) {
      await this.authenticate();
    }
    
    const response = await fetch('/api/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'subscribe',
        clientId: this.clientId,
        authToken: this.authToken,
        eventTypes
      })
    });
    
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error);
    }
  }
}
```

## Production Considerations

### Security
- Always use HTTPS in production
- Implement proper CORS policies
- Monitor authentication failures
- Use secure token generation

### Performance
- Monitor rate limit usage
- Implement client-side reconnection logic
- Use connection pooling for high-volume applications
- Consider caching for frequently accessed data

### Monitoring
- Track API usage metrics
- Monitor rate limit violations
- Log authentication failures
- Set up alerts for anomalous activity

## Support

For additional support:
- Check the troubleshooting guide
- Review error logs
- Contact technical support
- Join the community Discord