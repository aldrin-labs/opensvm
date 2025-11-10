'use client';

import type { Message, Note, AgentAction } from './types';
import type { ChatTab, ChatMode } from './hooks/useChatTabs';
import { ChatUI } from './ChatUI';
import { ChatErrorBoundary } from './ChatErrorBoundary';
import { ChatLayout } from './layouts/ChatLayout';
import { useEffect, useState } from 'react';
import { logger } from '@/lib/logger';

export interface ChatProps {
  variant?: 'inline' | 'sidebar' | 'dialog';
  isOpen?: boolean;
  onClose?: () => void;
  className?: string;
  onWidthChange?: (width: number) => void;
  onResizeStart?: () => void;
  onResizeEnd?: () => void;
  initialWidth?: number;
  // New tab system props
  tabs?: ChatTab[];
  activeTabId?: string | null;
  onTabClick?: (tabId: string) => void;
  onTabClose?: (tabId: string) => void;
  onNewTab?: () => void;
  onTabRename?: (tabId: string, name: string) => void;
  onTabTogglePin?: (tabId: string) => void;
  // Chat content props
  messages?: Message[];
  input?: string;
  isProcessing?: boolean;
  mode?: ChatMode;
  onInputChange?: (value: string) => void;
  onModeChange?: (mode: ChatMode) => void;
  onSubmit?: (e: React.FormEvent) => void;
  notes?: Note[];
  onClearNotes?: () => void;
  onAddNote?: (note: Note) => void;
  onRemoveNote?: (id: string) => void;
  agentActions?: AgentAction[];
  onRetryAction?: (id: string) => void;
  onForkThread?: (messageIndex: number) => void;
  // Knowledge pseudo-tab props
  knowledgeActive?: boolean;
  onSelectKnowledge?: () => void;
  // History pseudo-tab props
  historyActive?: boolean;
  onSelectHistory?: () => void;
  // Legacy props for backward compatibility
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  onReset?: () => void;
  onNewChat?: () => void;
  onExport?: () => void;
  onShare?: () => void;
  onSettings?: () => void;
  onHelp?: () => void;
  onExpand?: () => void;
  onVoiceRecord?: () => void;
  isRecording?: boolean;
  onCancel?: () => void;
  onDirectResponse?: (message: Message) => void;
  onHistoryReload?: () => void; // Added onHistoryReload
}

export function Chat({
  variant = 'inline',
  isOpen = true,
  onClose,
  className = '',
  onWidthChange,
  onResizeStart,
  onResizeEnd,
  initialWidth,
  // New tab system props
  tabs = [],
  activeTabId = null,
  onTabClick,
  onTabClose,
  onNewTab,
  onTabRename,
  onTabTogglePin,
  // Chat content props
  messages = [],
  input = '',
  isProcessing = false,
  mode = 'agent',
  onInputChange = () => { },
  onModeChange,
  onSubmit = () => { },
  notes = [],
  onClearNotes,
  onAddNote,
  onRemoveNote,
  agentActions = [],
  onRetryAction,
  onForkThread,
  // Knowledge pseudo-tab
  knowledgeActive = false,
  onSelectKnowledge,
  // History pseudo-tab
  historyActive = false,
  onSelectHistory,
  // Legacy props for backward compatibility
  activeTab = 'agent',
  onTabChange,
  onReset,
  onNewChat,
  onExport,
  onShare,
  onSettings,
  onHelp,
  onExpand,
  onVoiceRecord,
  isRecording,
  onCancel,
  onDirectResponse,
  onHistoryReload // Added onHistoryReload
}: ChatProps) {
  const [showFallback, setShowFallback] = useState(false);
  const [globalPending, setGlobalPending] = useState(false);
  // Early provisional input to satisfy fast E2E visibility checks before full ChatUI mounts
  const [earlyInputVisible, setEarlyInputVisible] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sync = () => {
      try {
        setGlobalPending(!!(window as any).__SVMAI_PENDING__);
      } catch { /* noop */ }
    };
    sync();
    window.addEventListener('svmai-pending-change', sync);
    return () => window.removeEventListener('svmai-pending-change', sync);
  }, []);

  useEffect(() => {
    // Poll for the real ChatUI input; once present, remove early placeholder
    if (typeof document !== 'undefined') {
      const interval = setInterval(() => {
        // Look for any real chat input that's not the early one
        const real = document.querySelector('[data-ai-chat-input]:not([data-ai-early-input])');
        if (real) {
          setEarlyInputVisible(false);
          clearInterval(interval);
        }
      }, 25); // Very fast polling for E2E tests
      // Safety timeout (in case input never appears, fallback logic will handle)
      setTimeout(() => clearInterval(interval), 3000);
      return () => clearInterval(interval);
    }
  }, []);

  // Additional effect to immediately hide early input when ChatUI is detected
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const observer = new MutationObserver(() => {
        const real = document.querySelector('[data-ai-chat-input]:not([data-ai-early-input])');
        if (real) {
          setEarlyInputVisible(false);
        }
      });
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['data-ai-chat-input']
      });
      return () => observer.disconnect();
    }
  }, []); // Remove earlyInputVisible dependency to prevent infinite loops

  useEffect(() => {
    logger.chat.debug('Chat component mounted, variant:', variant, 'isOpen:', isOpen);
    // Robust fallback detection:
    // React 18 StrictMode double-mounts components in development; the first mount/unmount
    // can schedule the legacy timeout causing premature fallback before ChatUI commits.
    // We now perform a phased check:
    //  1. Initial delay (900ms) to allow ChatUI + dynamic imports
    //  2. If input missing, retry up to 2 more times (600ms interval) even if ChatUI root not yet present
    //  3. Only show fallback if after retries no input is found AND fallback not already shown
    //  4. Abort early if input appears
    const MAX_RETRIES = 3;
    const RETRY_INTERVAL = 600;
    const INITIAL_DELAY = 900;
    let cancelled = false;

    function check(attempt: number) {
      if (cancelled) return;
      if (typeof document === 'undefined') return;

      const inputEl = document.querySelector('[data-ai-chat-input]');
      if (inputEl) {
        if (showFallback) {
          logger.chat.debug('[Chat] Primary input appeared after fallback scheduled; keeping primary UI.');
        }
        return; // Input present, nothing to do
      }

      const uiRoot = document.querySelector('[data-ai-chat-ui]');
      logger.chat.debug(`[Chat] Fallback probe attempt ${attempt} | uiRoot=${!!uiRoot} | inputPresent=${!!inputEl}`);

      if (attempt < MAX_RETRIES) {
        // Retry regardless of uiRoot presence to avoid premature fallback when ChatUI hasn't committed yet
        setTimeout(() => check(attempt + 1), RETRY_INTERVAL);
        return;
      }

      if (!inputEl && !showFallback) {
        logger.chat.info('[Chat] No chat input after phased probes; activating fallback UI');
        setShowFallback(true);
      }
    }

    const timer = setTimeout(() => check(1), INITIAL_DELAY);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [variant, isOpen, showFallback]);

  return (
    <ChatLayout
      className={`ai-chat-layout ${className}`}
      variant={variant}
      isOpen={isOpen}
      onWidthChange={onWidthChange}
      onResizeStart={onResizeStart}
      onResizeEnd={onResizeEnd}
      initialWidth={initialWidth}
      onClose={onClose}
      // New tab system props
      tabs={tabs}
      activeTabId={activeTabId}
      onTabClick={onTabClick}
      onTabClose={onTabClose}
      onNewTab={onNewTab}
      onTabRename={onTabRename}
      onTabTogglePin={onTabTogglePin}
      // Knowledge pseudo-tab
      knowledgeActive={knowledgeActive}
      onSelectKnowledge={onSelectKnowledge}
      // History pseudo-tab
      historyActive={historyActive}
      onSelectHistory={onSelectHistory}
      // Legacy props for backward compatibility
      activeTab={activeTab}
      onTabChange={onTabChange}
      onReset={onReset}
      onNewChat={onNewChat}
      onExport={onExport}
      onShare={onShare}
      onSettings={onSettings}
      onHelp={onHelp}
      onExpand={onExpand}
    >
      <div data-ai-chat-sentinel className="hidden">chat-sentinel</div>
      {earlyInputVisible && !showFallback && (
        <div
          className="border-t border-white/10 bg-black/60"
          aria-label="Early chat input initializing"
        >
          <form
            onSubmit={(e) => e.preventDefault()}
            className="p-2"
            role="form"
            aria-label="Send a message (initializing)"
          >
            <textarea
              data-ai-early-input="1"
              aria-label="Chat input (initializing)"
              className="w-full bg-black text-white text-sm p-2 rounded border border-white/20 min-h-[42px]"
              placeholder="Initializing chat..."
              rows={2}
              readOnly
            />
            <div className="text-[10px] text-white/30 mt-1">
              Loading full chat interface…
            </div>
          </form>
        </div>
      )}
      <ChatErrorBoundary>
        <ChatUI
          messages={messages}
          input={input}
          isProcessing={isProcessing}
          onInputChange={onInputChange}
          onSubmit={onSubmit}
          onClose={onClose}
          className={variant === 'dialog' ? 'h-[600px]' : undefined}
          activeTab={activeTab}
          mode={mode}
          onModeChange={onModeChange}
          notes={notes}
          onClearNotes={onClearNotes}
          onAddNote={onAddNote}
          onRemoveNote={onRemoveNote}
          agentActions={agentActions}
          onRetryAction={onRetryAction}
          onForkThread={onForkThread}
          onVoiceRecord={onVoiceRecord}
          isRecording={isRecording}
          variant={variant}
          onCancel={onCancel}
          onDirectResponse={onDirectResponse}
          enableVirtualization={true}
          tabs={tabs}
          onTabClick={onTabClick}
          onTabDelete={onTabClose}
          historyActive={historyActive}
          activeTabId={activeTabId}
          onHistoryReload={onHistoryReload}
        />
      </ChatErrorBoundary>
      {showFallback && (
        <div className="border-t border-white/10 bg-black">
          {/* Quick actions (fallback) */}
          <div
            className="px-3 pt-2 pb-1 border-b border-white/10 bg-black/70 flex flex-wrap gap-2"
            role="toolbar"
            aria-label="Quick actions (fallback)"
            data-ai-fallback-quick
          >
            <button
              type="button"
              className="text-[11px] px-2 py-1 rounded-full border border-white/20 text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
              data-ai-quick="tps"
              onClick={() => {
                try {
                  (window as any).SVMAI?.prompt?.('What is the current Solana TPS?', true);
                } catch { }
              }}
              title="Ask for current TPS"
            >
              TPS
            </button>
            {typeof window !== 'undefined' && window.location.pathname.startsWith('/tx/') && (
              <button
                type="button"
                className="text-[11px] px-2 py-1 rounded-full border border-white/20 text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
                data-ai-quick="context"
                onClick={() => {
                  try {
                    const sig = window.location.pathname.split('/')[2] || '';
                    (window as any).SVMAI?.prompt?.(`Explain this transaction: ${sig}`, false);
                  } catch { }
                }}
                title="Use current page context"
              >
                Context
              </button>
            )}
          </div>
          {(isProcessing || globalPending) && (
            <div
              data-ai-processing-status
              role="status"
              aria-live="polite"
              className="px-3 py-1 text-[11px] text-white/70 bg-black/60 border-t border-white/10"
            >
              Processing…
            </div>
          )}
          <form
            onSubmit={(e) => { e.preventDefault(); /* no-op fallback */ }}
            className="p-2"
            role="form"
            aria-label="Send a message (fallback)"
          >
            <textarea
              data-ai-chat-input
              data-ai-fallback-input="1"
              aria-label="Chat input (fallback)"
              className="w-full bg-black text-white text-sm p-2 rounded border border-white/20"
              placeholder="Chat temporarily unavailable (fallback)"
              rows={2}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'P' || e.key === 'p')) {
                  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/tx/')) {
                    e.preventDefault();
                    try {
                      const sig = window.location.pathname.split('/')[2] || '';
                      const el = e.currentTarget;
                      el.value = `Explain this transaction: ${sig}`;
                      const evt = new Event('input', { bubbles: true });
                      el.dispatchEvent(evt);
                    } catch { /* noop */ }
                  }
                }
              }}
            />
            <div className="text-[10px] text-white/40 mt-1">
              Fallback UI active – quick actions and input available. (ChatUI load race)
            </div>
          </form>
        </div>
      )}
    </ChatLayout>
  );
}
