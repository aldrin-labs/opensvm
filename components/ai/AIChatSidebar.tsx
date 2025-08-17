'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useChatTabs } from '@/components/ai/hooks/useChatTabs';
import { Chat } from './Chat';
import { useAIChatSidebar } from '@/contexts/AIChatSidebarContext';
import { TokenManagementPanel } from './monetization/TokenManagementPanel';
// Use the centralized factory (lib) that wires full capability set instead of bare SolanaAgent
import { createSolanaAgent } from '@/lib/ai/core/factory';
import { getClientConnection as getConnection } from '@/lib/solana-connection';
import type { Message, Note } from './types';
import { loadKnowledgeNotes, addKnowledgeNote, removeKnowledgeNote, clearKnowledgeNotes } from './utils/knowledgeManager';
import { mergeKnowledgeNotes } from './utils/mergeKnowledgeNotes'; // type:merge

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
  initialWidth = 560
}: AIChatSidebarProps) => {
  // Use the client-side connection that respects user settings/proxy
  const { setSidebarWidth, openWithPrompt } = useAIChatSidebar();

  // New tab system
  const {
    tabs,
    activeTabId,
    activeTab,
    createTab,
    closeTab,
    switchToTab,
    updateTab,
    updateActiveTabMode,
    renameTab
  } = useChatTabs();

  const [shareNotice, setShareNotice] = useState(false);
  const [tokenPanelOpen, setTokenPanelOpen] = useState(false);
  // Map of tabId -> agent instance (with full capabilities)
  const [agents, setAgents] = useState<Map<string, ReturnType<typeof createSolanaAgent>>>(new Map());
  const [isRecording, setIsRecording] = useState(false);
  const [knowledgeNotes, setKnowledgeNotes] = useState<Note[]>([]);
  const isResizing = useRef(false);
  const lastX = useRef(0);

  // Initialize with a default tab if none exist
  useEffect(() => {
    if (tabs.length === 0) {
      createTab();
    }
  }, [tabs.length, createTab]);

  // Load knowledge notes from persistence on mount (merge with any optimistic additions)
  useEffect(() => {
    // First check for test notes (for e2e testing)
    if (typeof window !== 'undefined' && (window as any).testNotes) {
      setKnowledgeNotes((window as any).testNotes);
      return;
    }

    // Otherwise load from persistence
    loadKnowledgeNotes()
      .then(loaded => setKnowledgeNotes(prev => mergeKnowledgeNotes(prev, loaded)))
      .catch(err => console.warn('Load knowledge notes failed', err));
  }, []);

  // Initialize agent for new tabs (now with real capabilities)
  useEffect(() => {
    const connection = getConnection();
    const nextAgents = new Map(agents);
    let changed = false;
    for (const tab of tabs) {
      if (!nextAgents.has(tab.id)) {
        try {
          // Optionally adjust options based on mode
          const agent = createSolanaAgent(connection, {
            systemPrompt: tab.mode === 'assistant'
              ? 'You are a helpful assistant that can answer questions and help with various tasks.'
              : undefined
          });
          nextAgents.set(tab.id, agent);
          changed = true;
        } catch (e) {
          console.warn('Failed to create Solana agent for tab', tab.id, e);
        }
      }
    }
    if (changed) setAgents(nextAgents);
  }, [tabs, agents]);

  // Chat processing function for individual tabs
  const processTabMessage = useCallback(async (tabId: string, message: string) => {
    const agent = agents.get(tabId);
    if (!agent) return;

    const userMessage: Message = {
      role: 'user',
      content: message.trim()
    };

    // Build base messages including the new user message (avoid stale closure overwrite later)
    const existing = tabs.find(t => t.id === tabId)?.messages || [];
    const baseMessages = [...existing, userMessage];

    // Optimistically add user message and mark processing
    updateTab(tabId, {
      messages: baseMessages,
      isProcessing: true,
      status: 'processing',
      lastActivity: Date.now()
    });

    try {
      const rawResponse: any = await agent.processMessage(userMessage as any);
      // Normalize lib agent message to UI Message shape (map role 'agent' -> 'assistant')
      const normalized: Message = {
        role: rawResponse.role === 'agent' ? 'assistant' : rawResponse.role,
        content: rawResponse.content,
        metadata: rawResponse.metadata
      };
      // Append assistant response to the preserved baseMessages so the user message isn't lost by stale state
      updateTab(tabId, {
        messages: [...baseMessages, normalized],
        isProcessing: false,
        status: 'idle',
        lastActivity: Date.now()
      });
    } catch (error) {
      console.error('Error processing message for tab:', tabId, error);
      const errorMessage: Message = {
        role: 'assistant',
        content: 'I encountered an error while processing your request. Please try again.'
      };
      updateTab(tabId, {
        messages: [...baseMessages, errorMessage],
        isProcessing: false,
        status: 'error',
        lastActivity: Date.now()
      });
    }
  }, [agents, tabs, updateTab]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing.current) return;
    const deltaX = lastX.current - e.clientX;
    lastX.current = e.clientX;
    const viewport = typeof window !== 'undefined' ? window.innerWidth : 1920;
    const next = Math.min(viewport, Math.max(560, (initialWidth ?? 560) + deltaX));
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
      const prefill = activeTab?.input?.trim() || (activeTab?.messages?.slice().reverse().find(m => m.role === 'user')?.content ?? '');
      if (prefill) url.searchParams.set('aitext', prefill);
      navigator.clipboard?.writeText(url.toString());
      // Optional: could show a toast; keeping silent to avoid deps
      setShareNotice(true);
      setTimeout(() => setShareNotice(false), 1500);
    } catch (e) {
      console.error('Share failed:', e);
    }
  }, [activeTab?.input, activeTab?.messages]);

  // Fetch balance lazily when opening token panel
  useEffect(() => { /* lazy fetch handled inside panel */ }, [tokenPanelOpen]);

  // Export messages of current tab to a markdown file and trigger download
  const handleExport = useCallback(() => {
    try {
      const lines: string[] = [];
      lines.push(`# OpenSVM AI Chat Export - ${new Date().toISOString()}`);
      lines.push('');
      for (const m of activeTab?.messages || []) {
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
  }, [activeTab?.messages, activeTab]);

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
        // New tab system props
        tabs={tabs}
        activeTabId={activeTabId}
        onTabClick={switchToTab}
        onTabClose={closeTab}
        onNewTab={createTab}
        onTabRename={renameTab}
        // Active tab data
        messages={activeTab?.messages || []}
        input={activeTab?.input || ''}
        isProcessing={activeTab?.isProcessing || false}
        mode={activeTab?.mode || 'agent'}
        onInputChange={(value) => {
          if (activeTabId) {
            updateTab(activeTabId, { input: value });
          }
        }}
        onModeChange={updateActiveTabMode}
        onSubmit={(e) => {
          e.preventDefault();
          if (activeTabId && activeTab?.input.trim()) {
            processTabMessage(activeTabId, activeTab.input);
            updateTab(activeTabId, { input: '' });
          }
        }}
        notes={knowledgeNotes}
        onClearNotes={async () => {
          try {
            await clearKnowledgeNotes();
            setKnowledgeNotes([]);
          } catch (e) { console.warn('Clear knowledge failed', e); }
        }}
        onAddNote={async (note) => {
          try {
            await addKnowledgeNote(note);
            setKnowledgeNotes(prev => [...prev, note]);
          } catch (e) { console.warn('Add knowledge failed', e); }
        }}
        onRemoveNote={async (noteId) => {
          try {
            await removeKnowledgeNote(noteId);
            setKnowledgeNotes(prev => prev.filter(n => n.id !== noteId));
          } catch (e) { console.warn('Remove knowledge failed', e); }
        }}
        agentActions={activeTab?.agentActions || []}
        onRetryAction={(actionId) => {
          if (activeTabId && activeTab) {
            // Find the action and its associated message, then retry
            const actions = activeTab.agentActions || [];
            const action = actions.find(a => a.id === actionId);
            if (action) {
              // Update action status to in_progress
              const updatedActions = actions.map(a =>
                a.id === actionId ? { ...a, status: 'in_progress' as const } : a
              );
              updateTab(activeTabId, { agentActions: updatedActions });

              // Find the last user message and reprocess it
              const userMessages = activeTab.messages.filter(m => m.role === 'user');
              if (userMessages.length > 0) {
                const lastUserMessage = userMessages[userMessages.length - 1];
                processTabMessage(activeTabId, lastUserMessage.content);
              }
            }
          }
        }}
        onVoiceRecord={() => {
          setIsRecording(!isRecording);
          // TODO: Implement speech recognition
          console.log('Voice recording toggled:', !isRecording);
        }}
        isRecording={isRecording}
        onCancel={() => {
          if (activeTabId && activeTab?.isProcessing) {
            updateTab(activeTabId, {
              isProcessing: false,
              status: 'idle'
            });
          }
        }}
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
