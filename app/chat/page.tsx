'use client';

import { useState } from 'react';
import { Connection } from '@solana/web3.js';
import { createSolanaAgent } from '@/lib/ai/core/factory';
import { useAIChat } from '@/lib/ai/hooks/useAIChat';
import { ChatUI } from '@/components/ai/ChatUI';
import { Maximize2, RotateCcw, Plus, MoreHorizontal, Settings, HelpCircle, Download, Share2 } from 'lucide-react';

// Initialize Solana connection
const connection = new Connection(
  process.env.NEXT_PUBLIC_RPC_URL || 'https://api.mainnet-beta.solana.com'
);

export default function ChatPage() {
  const [activeTab, setActiveTab] = useState('agent');
  
  const agent = createSolanaAgent(connection);
  
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

  const handleReset = () => {
    resetChat();
  };

  const handleNewChat = () => {
    resetChat();
  };

  const handleExport = () => {
    console.log('Export chat');
  };

  const handleShare = () => {
    console.log('Share chat');
  };

  const handleSettings = () => {
    console.log('Settings');
  };

  const handleHelp = () => {
    console.log('Help');
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
          messages={messages}
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
