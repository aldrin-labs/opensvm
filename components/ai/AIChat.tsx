'use client';

import { createSolanaAgent } from '../../lib/ai/core/factory';
import { useAIChat } from '../../lib/ai/hooks/useAIChat';
import { ChatUI } from './ChatUI';
import { getClientConnection as getConnection } from '../../lib/solana-connection';
import type { Message as UIMessage } from './types';

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
  agent = createSolanaAgent(getConnection())
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

  // Adapt lib AI messages (which may include role 'agent') to UI message type
  const uiMessages: UIMessage[] = messages.map((m: any) => ({
    role: m.role === 'agent' ? 'assistant' : m.role,
    content: m.content,
    metadata: m.metadata
  }));

  return (
    <ChatUI
      messages={uiMessages}
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
