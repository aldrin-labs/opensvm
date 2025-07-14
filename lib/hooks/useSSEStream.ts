/**
 * React Hook for SSE-based blockchain event streaming
 * 
 * Provides real-time blockchain events via Server-Sent Events (SSE)
 * Uses EventSource for push-based event streaming from the server
 */

export { 
  useSSEStream as default, 
  useSSEStream, 
  useWebSocketStream, 
  BlockchainEvent,
  type UseSSEStreamOptions,
  type UseSSEStreamReturn
} from './useWebSocketStream';