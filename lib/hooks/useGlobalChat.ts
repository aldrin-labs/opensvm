import { useState, useEffect, useCallback, useRef } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';

interface GlobalMessage {
  id: string;
  content: string;
  sender: string; // wallet address or "guest"
  timestamp: number;
  type: 'user' | 'system';
}

interface GlobalChatState {
  messages: GlobalMessage[];
  isLoading: boolean;
  error: string | null;
  isPosting: boolean;
  totalMessages: number;
  maxMessages: number;
  rateLimitError: string | null;
}

interface UseGlobalChatReturn extends GlobalChatState {
  sendMessage: (content: string) => Promise<boolean>;
  clearError: () => void;
  refreshMessages: () => Promise<void>;
}

export function useGlobalChat(pollInterval: number = 5000): UseGlobalChatReturn {
  const { publicKey, connected } = useWallet();
  const [state, setState] = useState<GlobalChatState>({
    messages: [],
    isLoading: true,
    error: null,
    isPosting: false,
    totalMessages: 0,
    maxMessages: 1000,
    rateLimitError: null,
  });

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastMessageCountRef = useRef(0);

  // Fetch messages from API
  const fetchMessages = useCallback(async () => {
    try {
      const response = await fetch('/api/chat/global');
      if (!response.ok) {
        throw new Error(`Failed to fetch messages: ${response.status}`);
      }

      const data = await response.json();
      setState(prev => ({
        ...prev,
        messages: data.messages || [],
        totalMessages: data.totalMessages || 0,
        maxMessages: data.maxMessages || 1000,
        isLoading: false,
        error: null,
      }));

      return data.messages || [];
    } catch (error) {
      console.error('Error fetching global messages:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch messages',
      }));
      return [];
    }
  }, []);

  // Send a new message
  const sendMessage = useCallback(async (content: string): Promise<boolean> => {
    if (!content.trim()) {
      return false;
    }

    setState(prev => ({ ...prev, isPosting: true, rateLimitError: null, error: null }));

    try {
      const wallet = connected && publicKey ? publicKey.toBase58() : undefined;
      
      const response = await fetch('/api/chat/global', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: content.trim(),
          wallet,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 429) {
          // Rate limit error
          setState(prev => ({
            ...prev,
            isPosting: false,
            rateLimitError: data.error || 'Rate limit exceeded',
          }));
          return false;
        }
        throw new Error(data.error || `Failed to send message: ${response.status}`);
      }

      // Refresh messages to get the latest state including the new message
      try {
        const messages = await fetchMessages();
        // Immediately update lastMessageCountRef to trigger UI update
        lastMessageCountRef.current = messages.length;
      } catch (fetchError) {
        console.error('Error refreshing messages after send:', fetchError);
        // Don't fail the send operation if refresh fails
      }
      
      setState(prev => ({ ...prev, isPosting: false }));
      return true;

    } catch (error) {
      console.error('Error sending message:', error);
      setState(prev => ({
        ...prev,
        isPosting: false,
        error: error instanceof Error ? error.message : 'Failed to send message',
      }));
      return false;
    }
  }, [connected, publicKey, fetchMessages]);

  // Clear errors
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null, rateLimitError: null }));
  }, []);

  // Refresh messages manually
  const refreshMessages = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true }));
    await fetchMessages();
  }, [fetchMessages]);

  // Set up polling for new messages
  useEffect(() => {
    // Initial fetch
    fetchMessages();

    // Set up polling
    pollIntervalRef.current = setInterval(async () => {
      const messages = await fetchMessages();
      
      // Check if there are new messages (simple check by count)
      if (messages.length > lastMessageCountRef.current) {
        lastMessageCountRef.current = messages.length;
        // Could add notification here if needed
      }
    }, pollInterval);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [fetchMessages, pollInterval]);

  // Update last message count when messages change
  useEffect(() => {
    lastMessageCountRef.current = state.messages.length;
  }, [state.messages.length]);

  // Clear rate limit error after some time
  useEffect(() => {
    if (state.rateLimitError) {
      const timer = setTimeout(() => {
        setState(prev => ({ ...prev, rateLimitError: null }));
      }, 10000); // Clear after 10 seconds

      return () => clearTimeout(timer);
    }
  }, [state.rateLimitError]);

  return {
    ...state,
    sendMessage,
    clearError,
    refreshMessages,
  };
}
