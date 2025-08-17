'use client';

import { createSolanaAgent } from '../../lib/ai/core/factory';
import { useAIChat } from '../../lib/ai/hooks/useAIChat';
import { ChatUI } from './ChatUI';
import { getClientConnection as getConnection } from '../../lib/solana-connection';
import type { Message as UIMessage, Note } from './types';
import { useState, useEffect } from 'react';
import { loadKnowledgeNotes } from './utils/knowledgeManager';

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
  const [notes, setNotes] = useState<Note[]>([]);

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

  // Load knowledge notes for /ref command
  useEffect(() => {
    const loadNotes = async () => {
      try {
        const knowledgeNotes = await loadKnowledgeNotes();
        setNotes(knowledgeNotes);
      } catch (error) {
        console.error('Failed to load knowledge notes:', error);
        setNotes([]);
      }
    };

    loadNotes();
  }, []); // Empty dependency array to run only once

  // Debug: Log when notes change
  useEffect(() => {
    console.log('Notes state changed in AIChat:', notes.length, notes);
  }, [notes]);

  // Adapt lib AI messages (which may include role 'agent') to UI message type
  const uiMessages: UIMessage[] = messages.map((m: any) => ({
    role: m.role === 'agent' ? 'assistant' : m.role,
    content: m.content,
    metadata: m.metadata
  }));

  console.log('AIChat passing notes to ChatUI:', notes.length);

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
      notes={notes}
    />
  );
}
