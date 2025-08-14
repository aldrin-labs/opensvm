'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createSolanaAgent } from '@/components/ai/core/factory';
import { useAIChatTabs } from '@/components/ai/hooks/useAIChatTabs';
import { Chat } from './Chat';
import { getClientConnection as getConnection } from '@/lib/solana-connection';
import { useAIChatSidebar } from '@/contexts/AIChatSidebarContext';
import { TokenManagementPanel } from './monetization/TokenManagementPanel';

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
  // Use the client-side connection that respects user settings/proxy
  const [agent] = useState(() => createSolanaAgent(getConnection()));
  const { setSidebarWidth, openWithPrompt } = useAIChatSidebar();
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
    isRecording,
    cancel
  } = useAIChatTabs({ agent });

  const [shareNotice, setShareNotice] = useState(false);
  const [tokenPanelOpen, setTokenPanelOpen] = useState(false);
  const isResizing = useRef(false);
  const lastX = useRef(0);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing.current) return;
    const deltaX = lastX.current - e.clientX;
    lastX.current = e.clientX;
    const viewport = typeof window !== 'undefined' ? window.innerWidth : 1920;
    const next = Math.min(viewport, Math.max(300, (initialWidth ?? 480) + deltaX));
    onWidthChange?.(next);
  }, [onWidthChange, initialWidth]);

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
  }, [handleMouseMove, handleMouseUp]);

  // Intercept width changes to persist in context/localStorage
  const handleWidthChangeWrapper = useCallback((newWidth: number) => {
    try { setSidebarWidth(newWidth); } catch { }
    onWidthChange?.(newWidth);
  }, [onWidthChange, setSidebarWidth]);

  // Share current chat context by copying a URL that opens sidebar with current input or last prompt
  const handleShare = useCallback(() => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('ai', '1');
      const prefill = input?.trim() || (messages?.slice().reverse().find(m => m.role === 'user')?.content ?? '');
      if (prefill) url.searchParams.set('aitext', prefill);
      navigator.clipboard?.writeText(url.toString());
      // Optional: could show a toast; keeping silent to avoid deps
      setShareNotice(true);
      setTimeout(() => setShareNotice(false), 1500);
    } catch (e) {
      console.error('Share failed:', e);
    }
  }, [input, messages]);

  // Fetch balance lazily when opening token panel
  useEffect(() => { /* lazy fetch handled inside panel */ }, [tokenPanelOpen]);

  // Export messages of current tab to a markdown file and trigger download
  const handleExport = useCallback(() => {
    try {
      const lines: string[] = [];
      lines.push(`# OpenSVM AI Chat Export - ${new Date().toISOString()}`);
      lines.push('');
      for (const m of messages || []) {
        if (m.role === 'user') {
          lines.push('## User');
          lines.push(m.content);
        } else {
          lines.push('## Assistant');
          lines.push(m.content);
        }
        lines.push('');
      }
      const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ai-chat-${activeTab}-${Date.now()}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Export failed:', e);
    }
  }, [messages, activeTab]);

  // Help: insert slash help prompt and submit
  const handleHelp = useCallback(() => {
    try {
      openWithPrompt('/help', { submit: true });
    } catch (e) {
      console.error('Help failed:', e);
    }
  }, [openWithPrompt]);

  return (
    <>
      {shareNotice && (
        <div
          role="status"
          aria-live="polite"
          className="fixed right-[520px] top-2 text-[11px] bg-white text-black px-2 py-1 rounded shadow z-[201]"
          data-ai-toast="shared"
        >
          Link copied
        </div>
      )}
      <Chat
        variant="sidebar"
        isOpen={isOpen}
        onClose={onClose}
        initialWidth={initialWidth}
        onWidthChange={handleWidthChangeWrapper}
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
        onCancel={cancel}
        onHelp={handleHelp}
        onShare={handleShare}
        onExport={handleExport}
        onSettings={() => setTokenPanelOpen(true)}
      />
      {/* Quick Tokens panel - opened from header via Settings handler repurposed */}
      <TokenManagementPanel isOpen={tokenPanelOpen} onClose={() => setTokenPanelOpen(false)} />
    </>
  );
};
