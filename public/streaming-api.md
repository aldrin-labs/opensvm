# Blockchain Event Streaming API

This API provides real-time blockchain event streaming using **Server-Sent Events (SSE)**, not WebSocket.

## Architecture

The streaming system uses SSE (EventSource) for real-time, one-way communication from server to client:

- **SSE Endpoint**: `/api/sse-alerts` - Real-time event streaming
- **Polling Endpoint**: `/api/stream` - HTTP request/response for authentication and control
- **Status Endpoint**: `/api/stream?action=status` - System status information

## Important Notes

### WebSocket vs SSE

❌ **WebSocket is NOT supported** - Despite legacy naming in some hooks, this system uses SSE only.

✅ **SSE is used** - Server-Sent Events provide real-time streaming without WebSocket complexity.

### Why SSE instead of WebSocket?

1. **Simpler implementation** - No need for custom server or upgrade handling
2. **Works with serverless** - Compatible with Vercel, Netlify, and other platforms
3. **Built-in reconnection** - EventSource handles reconnection automatically
4. **HTTP-based** - Works through proxies and firewalls more easily
5. **One-way streaming** - Perfect for blockchain event broadcasting

## API Endpoints

### Real-time Streaming (SSE)

```javascript
const eventSource = new EventSource('/api/sse-alerts?clientId=your_client_id&action=connect');

eventSource.addEventListener('blockchain_event', (event) => {
  const blockchainEvent = JSON.parse(event.data);
  console.log('Received event:', blockchainEvent);
});

eventSource.addEventListener('transaction', (event) => {
  const transaction = JSON.parse(event.data);
  console.log('New transaction:', transaction);
});

eventSource.addEventListener('block', (event) => {
  const block = JSON.parse(event.data);
  console.log('New block:', block);
});
```

### Authentication (HTTP)

```javascript
const response = await fetch('/api/stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'authenticate',
    clientId: 'your_client_id'
  })
});

const { data } = await response.json();
const authToken = data.authToken;
```

### Using the React Hook

```javascript
import { useSSEStream } from '@/lib/hooks/useSSEStream';

function MyComponent() {
  const { events, isConnected, connect, disconnect } = useSSEStream({
    autoConnect: true,
    maxEvents: 1000,
    eventTypes: ['transaction', 'block'],
    onEvent: (event) => console.log('Received:', event)
  });

  return (
    <div>
      <p>Status: {isConnected ? 'Connected' : 'Disconnected'}</p>
      <p>Events: {events.length}</p>
    </div>
  );
}
```

## Event Types

- `transaction` - New Solana transactions
- `block` - New blocks/slots
- `account_change` - Account state changes
- `blockchain_event` - Generic blockchain events

## Rate Limits

- Authentication: 5 requests per minute
- API requests: 100 requests per minute
- SSE connections: 10 concurrent connections per client

## Error Handling

The system automatically handles:
- Connection failures with exponential backoff
- Authentication token expiration
- Rate limit enforcement
- Memory management and cleanup

## Migration from WebSocket

If you're migrating from WebSocket:

1. Replace `new WebSocket()` with `new EventSource()`
2. Use `addEventListener()` instead of `onmessage`
3. Remove `send()` calls (SSE is one-way)
4. Update error handling for SSE events

## Deployment Notes

- Works on Vercel, Netlify, and traditional servers
- No custom server configuration required
- Scales horizontally with serverless functions
- Built-in monitoring and observability