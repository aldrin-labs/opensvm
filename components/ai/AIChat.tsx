'use client';

import { Connection } from '@solana/web3.js';
import { createSolanaAgent } from '@/lib/ai/core/factory';
import { useAIChat } from '@/lib/ai/hooks/useAIChat';
import { ChatUI } from './ChatUI';

// Initialize Solana connection
const connection = new Connection(
  process.env.NEXT_PUBLIC_RPC_URL || 'https://api.mainnet-beta.solana.com'
);

interface AIChatProps {
  initialContext?: string;
  onClose?: () => void;
  className?: string;
  showTabs?: boolean;
  activeTab?: string;
  agent?: ReturnType<typeof createSolanaAgent>;
}

export function AIChat({
  initialContext,
  onClose,
  className = '',
  showTabs = false,
  activeTab,
  agent = createSolanaAgent(connection)
}: AIChatProps) {
  const {
    messages,
    input,
    isProcessing,
    setInput,
    handleSubmit,
    resetChat
  } = useAIChat({
    agent,
    initialMessage: initialContext
  });

  return (
    <ChatUI
      messages={messages}
      input={input}
      isProcessing={isProcessing}
      onInputChange={setInput}
      onSubmit={handleSubmit}
      onClose={onClose}
      onNewChat={() => resetChat()}
      className={className}
      showTabs={showTabs}
      activeTab={activeTab}
    />
  );
}
