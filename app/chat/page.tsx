'use client';

import { useState, useEffect } from 'react';
import { createSolanaAgent } from '@/lib/ai/core/factory';
import { useAIChat } from '@/lib/ai/hooks/useAIChat';
import dynamic from 'next/dynamic';
import { RotateCcw, Plus, Settings } from 'lucide-react';
import { getClientConnection as getConnection } from '@/lib/solana-connection';
import type { Message as UIMessage } from '@/components/ai/types';

// Dynamic import for ChatUI to ensure client-side only
const ChatUI = dynamic(() => import('@/components/ai/ChatUI').then(mod => ({ default: mod.ChatUI })), {
  ssr: false,
  loading: () => <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
  </div>
});

export default function ChatPage() {
  const [activeTab, setActiveTab] = useState('agent');
  const [agent, setAgent] = useState<any>(null);

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

  const {
    messages,
    input,
    isProcessing,
    setInput,
    handleSubmit,
    resetChat
  } = useAIChat({
    agent,
    initialMessage: undefined
  });

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
    resetChat();
  };

  const handleNewChat = () => {
    resetChat();
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
        <ChatUI
          messages={uiMessages}
          input={input}
          isProcessing={isProcessing}
          onInputChange={setInput}
          onSubmit={handleSubmit}
          onNewChat={handleNewChat}
          className="h-full"
          activeTab={activeTab}
          variant="inline"
        />
      </div>
    </div>
  );
}
