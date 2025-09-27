'use client';

import { useState, useEffect } from 'react';
import { createSolanaAgent } from '@/lib/ai/core/factory';
import { useAIChat } from '@/lib/ai/hooks/useAIChat';
import { useGlobalChat } from '@/lib/hooks/useGlobalChat';
import dynamic from 'next/dynamic';
import { RotateCcw, Plus, Settings, Globe, Users, Clock } from 'lucide-react';
import { getClientConnection as getConnection } from '@/lib/solana-connection';
import { useWallet } from '@solana/wallet-adapter-react';
import type { Message as UIMessage } from '@/components/ai/types';

// Dynamic import for ChatUI to ensure client-side only
const ChatUI = dynamic(() => import('@/components/ai/ChatUI').then(mod => ({ default: mod.ChatUI })), {
  ssr: false,
  loading: () => <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
  </div>
});

export default function ChatPage() {
  const [activeTab, setActiveTab] = useState('global');
  const [agent, setAgent] = useState<any>(null);
  const [globalInput, setGlobalInput] = useState('');
  const { connected, publicKey } = useWallet();

  // Initialize Solana connection and agent only on client side
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const connection = getConnection();
        const solanaAgent = createSolanaAgent(connection);
        setAgent(solanaAgent);
      } catch (error) {
        console.error('Failed to initialize Solana agent:', error);
      }
    }
  }, []);

  // Global chat functionality
  const {
    messages: globalMessages,
    isLoading: globalLoading,
    error: globalError,
    isPosting: globalPosting,
    totalMessages,
    maxMessages,
    rateLimitError,
    sendMessage: sendGlobalMessage,
    clearError: clearGlobalError,
    refreshMessages: refreshGlobalMessages,
  } = useGlobalChat(3000); // Poll every 3 seconds

  // AI chat functionality
  const {
    messages,
    input,
    isProcessing,
    setInput,
    handleSubmit,
    resetChat,
    addDirectResponse
  } = useAIChat({
    agent,
    initialMessage: undefined
  });

  // Handle direct responses from API calls
  const handleDirectResponse = (message: UIMessage) => {
    // Convert UIMessage to Message format for the hook, ensuring compatibility
    const convertedMessage = {
      role: message.role,
      content: message.content,
      metadata: message.metadata ? {
        type: message.metadata.type as any, // Cast to handle type difference between components and lib types
        data: message.metadata.data
      } : undefined
    } as any; // Cast the entire message to handle type incompatibility
    addDirectResponse(convertedMessage);
    console.log('Direct response added to chat:', convertedMessage);
  };

  // Handle global message submit
  const handleGlobalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!globalInput.trim() || globalPosting) return;

    const success = await sendGlobalMessage(globalInput);
    if (success) {
      setGlobalInput('');
    }
  };

  // Format timestamp for display
  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString();
  };

  // Format sender display
  const formatSender = (sender: string) => {
    if (sender === 'guest') return 'Guest';
    if (sender.length > 8) {
      return `${sender.slice(0, 4)}...${sender.slice(-4)}`;
    }
    return sender;
  };

  // Show loading if agent is not yet initialized
  if (!agent) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Adapt messages to UI type (map 'agent' -> 'assistant' role)
  const uiMessages: UIMessage[] = (messages as any[]).map(m => ({
    role: m.role === 'agent' ? 'assistant' : m.role,
    content: m.content,
    metadata: m.metadata
  }));

  const handleReset = () => {
    //resetChat();
  };

  const handleNewChat = () => {
    //resetChat();
  };

  const handleSettings = () => {
    console.log('Settings');
  };

  return (
    <div className="h-screen overflow-hidden bg-black flex flex-col">
      {/* Header with tabs and controls */}
      <div className="flex h-[50px] border-b border-white/20 flex-shrink-0 bg-black">
        <div className="flex items-center">
          <button
            onClick={() => setActiveTab('global')}
            className={`px-6 h-[50px] text-sm font-medium flex items-center gap-2 ${activeTab === 'global' ? 'bg-white text-black' : 'text-white hover:bg-white/10'} focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2`}
          >
            <Globe size={16} />
            GLOBAL
          </button>
          <button
            onClick={() => setActiveTab('agent')}
            className={`px-6 h-[50px] text-sm font-medium ${activeTab === 'agent' ? 'bg-white text-black' : 'text-white hover:bg-white/10'} focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2`}
          >
            AGENT
          </button>
          <button
            onClick={() => setActiveTab('assistant')}
            className={`px-6 h-[50px] text-sm font-medium ${activeTab === 'assistant' ? 'bg-white text-black' : 'text-white hover:bg-white/10'} focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2`}
          >
            ASSISTANT
          </button>
          <button
            onClick={() => setActiveTab('notes')}
            className={`px-6 h-[50px] text-sm font-medium ${activeTab === 'notes' ? 'bg-white text-black' : 'text-white hover:bg-white/10'} focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2`}
          >
            KNOWLEDGE
          </button>
        </div>
        <div className="flex items-center ml-auto px-4 gap-2">
          <button
            className="p-2 text-white hover:bg-white/10 rounded-sm transition-colors focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
            title="Reset"
            onClick={handleReset}
          >
            <RotateCcw size={18} />
          </button>
          <button
            className="p-2 text-white hover:bg-white/10 rounded-sm transition-colors focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
            title="New Chat"
            onClick={handleNewChat}
          >
            <Plus size={18} />
          </button>
          <button
            className="p-2 text-white hover:bg-white/10 rounded-sm transition-colors focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
            title="Settings"
            onClick={handleSettings}
          >
            <Settings size={18} />
          </button>
        </div>
      </div>

      {/* Chat content */}
      <div className="flex-1 min-h-0">
        {activeTab === 'global' ? (
          <div className="h-full flex flex-col bg-black">
            {/* Global Chat Header */}
            <div className="flex-shrink-0 px-4 py-3 border-b border-white/20 bg-black/60">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Users size={16} className="text-white/70" />
                    <span className="text-white/90 text-sm font-medium">Global Chat</span>
                  </div>
                  <div className="text-xs text-white/50">
                    {totalMessages}/{maxMessages} messages
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-xs text-white/50">
                    {connected ? (
                      <span className="text-green-400">Connected: {formatSender(publicKey?.toBase58() || '')}</span>
                    ) : (
                      <span className="text-yellow-400">Guest Mode</span>
                    )}
                  </div>
                  <button
                    onClick={refreshGlobalMessages}
                    disabled={globalLoading}
                    className="p-1 text-white/70 hover:text-white hover:bg-white/10 rounded transition-colors disabled:opacity-50"
                    title="Refresh messages"
                  >
                    <RotateCcw size={14} className={globalLoading ? 'animate-spin' : ''} />
                  </button>
                </div>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {globalLoading && globalMessages.length === 0 ? (
                <div className="flex items-center justify-center h-32">
                  <div className="w-6 h-6 border-2 border-white/20 border-t-white/70 rounded-full animate-spin"></div>
                </div>
              ) : globalMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-white/50">
                  <Globe size={32} className="mb-2" />
                  <p>No messages yet. Be the first to start the conversation!</p>
                </div>
              ) : (
                globalMessages.map((message) => (
                  <div key={message.id} className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 text-xs text-white/50">
                      <span className={`font-medium ${message.sender === 'guest' ? 'text-yellow-400' : 'text-blue-400'}`}>
                        {formatSender(message.sender)}
                      </span>
                      <Clock size={12} />
                      <span>{formatTimestamp(message.timestamp)}</span>
                    </div>
                    <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                      <p className="text-white text-sm leading-relaxed break-words">
                        {message.content}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Error Messages */}
            {(globalError || rateLimitError) && (
              <div className="flex-shrink-0 px-4 py-2">
                <div className="bg-red-900/20 border border-red-500/20 rounded-lg p-3 flex items-center justify-between">
                  <span className="text-red-400 text-sm">
                    {rateLimitError || globalError}
                  </span>
                  <button
                    onClick={clearGlobalError}
                    className="text-red-400 hover:text-red-300 text-xs"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}

            {/* Input Form */}
            <form onSubmit={handleGlobalSubmit} className="flex-shrink-0 p-4 border-t border-white/20 bg-black/60">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={globalInput}
                  onChange={(e) => setGlobalInput(e.target.value)}
                  placeholder={
                    connected
                      ? "Type your message... (30s cooldown)"
                      : "Type your message... (5min cooldown for guests)"
                  }
                  disabled={globalPosting}
                  className="flex-1 bg-white/10 text-white placeholder-white/50 border border-white/20 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-white/30 disabled:opacity-50"
                  maxLength={1000}
                />
                <button
                  type="submit"
                  disabled={globalPosting || !globalInput.trim()}
                  className="px-6 py-3 bg-white text-black rounded-lg font-medium hover:bg-white/90 focus:outline-none focus:ring-2 focus:ring-white/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {globalPosting ? 'Sending...' : 'Send'}
                </button>
              </div>
              <div className="flex items-center justify-between mt-2 text-xs text-white/50">
                <span>{globalInput.length}/1000 characters</span>
                <span>
                  Rate limit: {connected ? '30 seconds' : '5 minutes'} between messages
                </span>
              </div>
            </form>
          </div>
        ) : (
          <ChatUI
            messages={uiMessages}
            input={input}
            isProcessing={isProcessing}
            onInputChange={setInput}
            onSubmit={handleSubmit}
            onNewChat={handleNewChat}
            onDirectResponse={handleDirectResponse}
            className="h-full"
            activeTab={activeTab}
            variant="inline"
          />
        )}
      </div>
    </div>
  );
}
