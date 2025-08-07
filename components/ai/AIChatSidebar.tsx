'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Connection } from '@solana/web3.js';
import { createSolanaAgent } from '@/components/ai/core/factory';
import { useAIChatTabs } from '@/components/ai/hooks/useAIChatTabs';
import { Chat } from './Chat';

const connection = new Connection(
  process.env.NEXT_PUBLIC_RPC_URL || 'https://api.mainnet-beta.solana.com'
);

interface AIChatSidebarProps {
  isOpen: boolean;
  onClose?: () => void;
  onWidthChange?: (width: number) => void;
  onResizeStart?: () => void;
  onResizeEnd?: () => void;
  initialWidth?: number;
}

export const AIChatSidebar: React.FC<AIChatSidebarProps> = ({
  isOpen,
  onClose,
  onWidthChange,
  onResizeStart,
  onResizeEnd,
  initialWidth = 480
}: AIChatSidebarProps) => {
  const [agent] = useState(() => createSolanaAgent(connection));
  const {
    activeTab,
    setActiveTab,
    messages,
    input,
    isProcessing,
    setInput,
    handleSubmit,
    handleNewChat,
    notes,
    agentActions,
    clearNotes,
    resetEverything,
    retryAction,
    startRecording,
    isRecording
  } = useAIChatTabs({ agent });

  const [width, setWidth] = useState(initialWidth);
  const isResizing = useRef(false);
  const lastX = useRef(0);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing.current) return;

    const deltaX = lastX.current - e.clientX;
    lastX.current = e.clientX;

    const newWidth = Math.min(800, Math.max(300, width + deltaX));
    setWidth(newWidth);
    onWidthChange?.(newWidth);
  }, [width, onWidthChange]);

  const handleMouseUp = useCallback(() => {
    if (isResizing.current && typeof document !== 'undefined') {
      isResizing.current = false;
      document.body.style.cursor = 'default';
      document.body.classList.remove('select-none');
      onResizeEnd?.();
    }
  }, [onResizeEnd]);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [width, handleMouseMove, handleMouseUp]);

  return (
    <Chat
      variant="sidebar"
      isOpen={isOpen}
      onClose={onClose}
      onWidthChange={onWidthChange}
      onResizeStart={onResizeStart}
      onResizeEnd={onResizeEnd}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onReset={resetEverything}
      onNewChat={handleNewChat}
      messages={messages}
      input={input}
      isProcessing={isProcessing}
      onInputChange={setInput}
      onSubmit={handleSubmit}
      notes={notes}
      onClearNotes={clearNotes}
      agentActions={agentActions}
      onRetryAction={retryAction}
      onVoiceRecord={startRecording}
      isRecording={isRecording}
    />
  );
};
