'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { formatLargeNumber } from '@/utils/format';

interface SimpleBlockData {
  slot: number;
  timestamp: number;
  transactionCount: number;
}

export default function BlocksPageSimple() {
  const router = useRouter();
  const [blocks, setBlocks] = useState<SimpleBlockData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');

  // Simple SSE connection
  useEffect(() => {
    let eventSource: EventSource | null = null;

    const connectSSE = () => {
      try {
        setConnectionStatus('connecting');
        const clientId = `blocks_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        // Add event types filter to only get block events
        eventSource = new EventSource(`/api/sse-alerts?clientId=${encodeURIComponent(clientId)}&action=connect&eventTypes=block`);

        eventSource.onopen = () => {
          console.log('SSE connection opened for blocks page');
          setIsConnected(true);
          setConnectionStatus('connected');
          setError(null);
        };

        eventSource.onerror = (event) => {
          console.error('SSE connection error:', event);
          setIsConnected(false);
          setConnectionStatus('error');
          setError('Connection error');
        };

        // Listen for all messages (SSE sends data as messages, not as typed events)
        eventSource.onmessage = (event) => {
          try {
            const eventData = JSON.parse(event.data);
            console.log('Received SSE message:', eventData);

            // Handle block events (server-filtered to only block events)
            if (eventData.type === 'block') {
              const blockData = eventData.data;
              if (blockData && typeof blockData.slot === 'number') {
                const newBlock: SimpleBlockData = {
                  slot: blockData.slot,
                  timestamp: blockData.blockTime || Math.floor(Date.now() / 1000),
                  transactionCount: blockData.transactionCount || 0
                };

                setBlocks(prev => {
                  // Avoid duplicates and keep most recent blocks
                  const filtered = prev.filter(b => b.slot !== newBlock.slot);
                  return [newBlock, ...filtered].slice(0, 50); // Keep max 50 blocks
                });

                setIsLoading(false); // Stop loading spinner once we receive first block
              }
            }
          } catch (parseError) {
            console.error('Failed to parse SSE message:', parseError);
          }
        };

      } catch (error) {
        console.error('Failed to create SSE connection:', error);
        setError('Failed to create connection');
        setConnectionStatus('error');
      }
    };

    // Load initial data and connect SSE
    const loadInitialData = async () => {
      try {
        setIsLoading(true);
        // Try to fetch some initial blocks from API
        const response = await fetch('/api/blocks?limit=10');
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data.blocks) {
            const initialBlocks = data.data.blocks.map((block: any) => ({
              slot: block.slot,
              timestamp: block.timestamp || block.blockTime,
              transactionCount: block.transactionCount || 0
            }));
            setBlocks(initialBlocks);
          }
        }
      } catch (err) {
        console.warn('Failed to load initial blocks:', err);
      } finally {
        setIsLoading(false);
        // Connect to SSE after initial load
        connectSSE();
      }
    };

    loadInitialData();

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, []);

  const handleBlockClick = (slot: number) => {
    router.push(`/block/${slot}`);
  };

  return (
    <div className="ai-blocks-page-wrapper"> {/* Added ai-blocks-page-wrapper */}
      <div className="container mx-auto py-8 px-4">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Recent Blocks</h1>
          <p className="text-muted-foreground">
            View latest blocks with real-time streaming updates.
          </p>
        </div>

        {/* Connection Status */}
        <div className="mb-6 p-4 border rounded-lg">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${isConnected
              ? 'bg-green-500 animate-pulse'
              : connectionStatus === 'connecting'
                ? 'bg-yellow-500 animate-pulse'
                : 'bg-red-500'
              }`}></div>
            <span className="font-medium">
              {isConnected ? 'Live Connection Active' : connectionStatus === 'connecting' ? 'Connecting...' : 'Offline'}
            </span>
            {error && (
              <span className="text-red-500 ml-2">({error})</span>
            )}
          </div>
        </div>

        {error && !isConnected && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
            <p className="text-destructive">{error}</p>
          </div>
        )}

        {/* Blocks Table */}
        <div className="border rounded-lg">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold">Latest Blocks</h2>
          </div>

          {isLoading && blocks.length === 0 ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading blocks...</p>
            </div>
          ) : (
            <div className="divide-y">
              {blocks.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-muted-foreground">No blocks received yet. Waiting for real-time updates...</p>
                </div>
              ) : (
                blocks.map((block) => (
                  <div
                    key={block.slot}
                    className="p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => handleBlockClick(block.slot)}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-mono font-bold">
                          #{formatLargeNumber(block.slot)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {block.transactionCount} transactions
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-muted-foreground">
                          {new Date(block.timestamp * 1000).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <div className="mt-8 text-sm text-muted-foreground">
          <p>
            Block data is streamed in real-time from the Solana RPC via Server-Sent Events (SSE).
            New blocks appear automatically as they are confirmed on the network.
          </p>
        </div>
      </div>
    </div>
  );
}
