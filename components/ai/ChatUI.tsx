"use client";

// Added explicit client directive since this file makes extensive use of React hooks.
// Without it, Next.js may treat the module as a server component when imported, causing
// runtime hook errors or a silent hydration failure leading to an empty (black) chat area.
const __AI_DEBUG__ = typeof window !== 'undefined' && (window.location.search.includes('ai=1') || window.location.search.includes('aimock=1'));
if (__AI_DEBUG__) {
  // Lightweight guarded debug log (was unconditional)
  console.log('🔍 ChatUI module loaded');
}

import { Loader, Mic, Send } from 'lucide-react';
import type { Message, Note, AgentAction } from './types';
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { VantaBackground } from './VantaBackground';
import { NewMessageBadge } from './NewMessageBadge';
import { useAIChatSidebar } from '../../contexts/AIChatSidebarContext';
import { track } from '../../lib/ai/telemetry';
import { MessageActions, type MessageActionType } from './components/MessageActions';
import { EnhancedMessageRenderer } from './components/EnhancedMessageRenderer';
import { ReasoningBlock } from './components/ReasoningBlock';
import { MessageRenderer } from './components/MessageRenderer';
import { ChatErrorBoundary } from './components/ChatErrorBoundary';
import { parseAssistantMessage } from '../../lib/ai/parseAssistantMessage';
import { KnowledgePanel } from './components/KnowledgePanel';
import { HistoryPanel } from './components/HistoryPanel';
import { ModeSelector } from './components/ModeSelector';
import { estimateTokens } from './utils/tokenCounter';
import { SLASH_COMMANDS, completeSlashCommand, trackSlashUsage, getContextualSuggestions, getContextBadge } from './utils/slashCommands';
import { useDebounce } from './hooks/useDebounce';
import { useMemoryManagement, trackMemoryUsage } from './utils/memoryManager';
import { useUIPreferences } from './hooks/useUIPreferences';
import { useAutosizeTextarea } from '../../hooks/useAutosizeTextarea';
import { useChatState } from './hooks/useChatState';
import { VirtualizedMessageList, usePerformanceMonitoring, setupGlobalPerfSnapshot } from './components/VirtualizedMessageList';

interface ChatUIProps {
  messages: Message[];
  input: string;
  isProcessing: boolean;
  onInputChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose?: () => void;
  onNewChat?: () => void;
  onForkThread?: (messageIndex: number, message: Message) => void;
  className?: string;
  activeTab?: string;
  mode?: 'agent' | 'assistant';
  onModeChange?: (mode: 'agent' | 'assistant') => void;
  notes?: Note[];
  onClearNotes?: () => void;
  onAddNote?: (note: Note) => void;
  onRemoveNote?: (id: string) => void;
  agentActions?: AgentAction[];
  onRetryAction?: (id: string) => void;
  showTabs?: boolean;
  onVoiceRecord?: () => void;
  isRecording?: boolean;
  variant?: 'inline' | 'sidebar' | 'dialog';
  enableVirtualization?: boolean;
  onCancel?: () => void;
  onDirectResponse?: (message: Message) => void; // Direct RPC / fast path response handler
  // History panel props
  tabs?: any[]; // Using any[] to avoid circular dependency with ChatTab
  onTabClick?: (tabId: string) => void;
  onTabDelete?: (tabId: string) => void;
  historyActive?: boolean;
  activeTabId?: string | null;
  // Chat persistence props
  userId?: string;
  enablePersistence?: boolean;
  onHistoryReload?: () => void;
}

// Lightweight dynamic height wrapper replacing fixed 400px container.
interface DynamicHeightProps {
  messages: Message[];
  renderMessage: (m: Message, i: number) => React.ReactNode;
  onScroll?: (scrollTop: number, scrollHeight: number, clientHeight: number) => void;
  autoScrollToBottom: boolean;
  density: string;
}

const DynamicHeightMessageArea: React.FC<DynamicHeightProps> = ({
  messages,
  renderMessage,
  onScroll,
  autoScrollToBottom,
  density
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Simple auto-scroll on new messages
  useEffect(() => {
    if (autoScrollToBottom && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages.length, autoScrollToBottom]);

  return (
    <div
      ref={containerRef}
      className={`overflow-y-auto overflow-x-hidden w-full h-full ${density === 'compact' ? 'p-3 space-y-2' : 'p-4 space-y-4'}`}
      onScroll={(e) => {
        const t = e.currentTarget;
        onScroll?.(t.scrollTop, t.scrollHeight, t.clientHeight);
      }}
      data-dynamic-height
    >
      {messages.map((m, i) => (
        <div key={i} data-ai-msg-index={i}>{renderMessage(m, i)}</div>
      ))}
    </div>
  );
};

export function ChatUI({
  messages,
  input,
  isProcessing,
  onInputChange,
  onSubmit,
  onNewChat,
  onForkThread,
  className = '',
  activeTab = 'agent',
  mode = 'agent',
  onModeChange,
  notes = [],
  onClearNotes,
  onAddNote,
  onRemoveNote,
  agentActions = [],
  onRetryAction,
  showTabs = false,
  onVoiceRecord,
  isRecording = false,
  variant = 'sidebar',
  enableVirtualization = false,
  onCancel,
  onDirectResponse,
  tabs = [],
  onTabClick,
  onTabDelete,
  historyActive = false,
  activeTabId = null,
  userId,
  enablePersistence = false,
  onHistoryReload,
}: ChatUIProps) {
  if (__AI_DEBUG__) {
    console.log('🔍 ChatUI component called', { variant, activeTab, messagesCount: messages.length });
  }
  if (typeof window !== 'undefined') {
    (window as any).__SVMAI_CHATUI_CALLED__ = true;
  }
  const isE2E = typeof window !== 'undefined' && (window.location.search.includes('aimock=1') || window.location.search.includes('ai=1'));
  const isTxPage = typeof window !== 'undefined' && window.location.pathname.startsWith('/tx/');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerMeasureRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [viewportHeight, setViewportHeight] = useState(400);
  const shouldVirtualize = enableVirtualization && messages.length >= 150;
  const perfMonitor = usePerformanceMonitoring(true);
  useEffect(() => {
    setupGlobalPerfSnapshot(() => messages.length, () => shouldVirtualize, perfMonitor);
  }, [messages.length, shouldVirtualize, perfMonitor]);

  useEffect(() => {
    if (!containerMeasureRef.current) return;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        setViewportHeight(e.contentRect.height);
      }
    });
    ro.observe(containerMeasureRef.current);
    return () => ro.disconnect();
  }, []);

  const lastMessageCountRef = useRef(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Try to get the context safely - call hook at top level to avoid infinite rerenders
  let registerInputController, openWithPrompt;
  try {
    const context = useAIChatSidebar();
    registerInputController = context.registerInputController;
    openWithPrompt = context.openWithPrompt;
    if (__AI_DEBUG__) {
      console.log('🔍 ChatUI: AIChatSidebar context loaded successfully');
    }
  } catch (error) {
    console.error('�� ChatUI: Failed to load AIChatSidebar context:', error);
    registerInputController = () => { };
    openWithPrompt = () => { };
  }

  // Consolidated chat state management
  const [chatState, chatActions] = useChatState();
  const {
    optimisticProcessing,
    showProcessingUI,
    newMessageCount,
    isScrolledUp,
    shouldAutoScroll,
    showSlashHelp,
    copyNotice,
    actionNotice,
    inputHistory,
    historyIndex,
    draftBeforeHistory,
    slashIndex,
    showReferenceAutocomplete,
    referenceIndex,
  } = chatState;

  const {
    setOptimisticProcessing,
    setShowProcessingUI,
    setNewMessageCount,
    setIsScrolledUp,
    setShouldAutoScroll,
    setShowSlashHelp,
    setCopyNotice,
    setActionNotice,
    setInputHistory,
    setHistoryIndex,
    setDraftBeforeHistory,
    setSlashIndex,
    setShowReferenceAutocomplete,
    setReferenceIndex,
  } = chatActions;

  // Track if we're in a mock/test environment where isProcessing might not change
  const isMockMode = typeof window !== 'undefined' && (window.location.search.includes('aimock=1') || window.location.search.includes('ai=1'));

  // UI Preferences
  const { prefs } = useUIPreferences();
  const { textareaRef } = useAutosizeTextarea(input, { maxRows: 6, minRows: 1 });

  // Memory Management
  const { stats: memoryStats, shouldCleanup: needsCleanup, cleanup: performMemoryCleanup } = useMemoryManagement(
    messages,
    {
      maxMessages: 500,
      maxTokens: 25000,
      retentionRatio: 0.7,
      preserveRecent: 30
    },
    true
  );

  // Debounced input
  const debouncedInput = useDebounce(input, 180, {
    cancel: messages.length,
  });

  // Debounced slash suggestion context
  const getSlashContext = useCallback(() => {
    if (!debouncedInput.startsWith('/') || debouncedInput.startsWith('/ref ')) {
      return { raw: debouncedInput, trimmed: debouncedInput.trim(), afterSlash: debouncedInput.trim(), firstToken: '', suggestions: [] as any[] };
    }
    const query = debouncedInput.slice(1);
    const suggestions = getContextualSuggestions(query);
    return {
      raw: debouncedInput,
      trimmed: debouncedInput.trim(),
      afterSlash: query,
      firstToken: query.split(' ')[0] || '',
      suggestions
    };
  }, [debouncedInput]);

  // Reference autocomplete logic
  const getReferenceContext = useCallback(() => {
    if (!debouncedInput.startsWith('/ref ')) {
      return { isActive: false, query: '', filteredNotes: [] };
    }
    const query = debouncedInput.slice(5);
    const filteredNotes = query.trim() === ''
      ? notes
      : notes.filter(note =>
        note.content.toLowerCase().includes(query.toLowerCase()) ||
        note.author.toLowerCase().includes(query.toLowerCase())
      );
    return { isActive: true, query, filteredNotes };
  }, [debouncedInput, notes]);

  // Register input controller (memoized to prevent unnecessary re-registrations)
  const inputController = useMemo(() => ({
    setInput: onInputChange,
    focusInput: () => inputRef.current?.focus(),
    submit: () => {
      try {
        setShowProcessingUI(true);
        setOptimisticProcessing(true);
        const form = inputRef.current?.closest('form');
        if (form) {
          const event = new Event('submit', { bubbles: true, cancelable: true });
          form.dispatchEvent(event);
        } else {
          onSubmit({ preventDefault: () => { } } as unknown as React.FormEvent);
        }
      } catch (err) {
        console.error('Programmatic submit failed:', err);
      }
    }
  }), [onInputChange, onSubmit, setShowProcessingUI, setOptimisticProcessing]);

  useEffect(() => {
    registerInputController(inputController);
  }, [registerInputController, inputController]);

  // Clear optimistic flag & processing display gating
  useEffect(() => {
    if (isProcessing) {
      setOptimisticProcessing(true);
      setShowProcessingUI(true); // Ensure UI shows when processing starts
    } else if (optimisticProcessing) {
      const t = setTimeout(() => setOptimisticProcessing(false), 25000);
      return () => clearTimeout(t);
    }
    if (!isProcessing && !optimisticProcessing && showProcessingUI) {
      // Reset display flag after cycle completes so subsequent slash
      // completions (without new submit) don't show stale bar.
      setShowProcessingUI(false);
    }
  }, [isProcessing, optimisticProcessing, showProcessingUI, setOptimisticProcessing, setShowProcessingUI]);

  // Auto-enable processing UI when processing starts via programmatic prompts (window.SVMAI.prompt)
  // which bypass the local form submit path that normally sets showProcessingUI.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    console.log('🔍 ChatUI: Setting up svmai-show-processing-ui event listener');
    const handleShowProcessingUI = (event: any) => {
      if (__AI_DEBUG__) console.log('🔍 ChatUI: Received svmai-show-processing-ui event', event?.detail);
      if (event?.detail?.source === 'mock-prompt') {
        if (!optimisticProcessing) {
          if (__AI_DEBUG__) console.log('🔍 ChatUI: Setting processing UI for mock mode');
          setShowProcessingUI(true);
          setOptimisticProcessing(true);
        }
      }
    };
    window.addEventListener('svmai-show-processing-ui', handleShowProcessingUI, { once: true });
    return () => {
      if (__AI_DEBUG__) console.log('🔍 ChatUI: Removing svmai-show-processing-ui event listener');
      window.removeEventListener('svmai-show-processing-ui', handleShowProcessingUI);
    };
  }, []);

  // Global pending fallback - coordinates with SVMAI.prompt pending state
  const pendingStartRef = useRef<number>(0);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (event?: any) => {
      const pending = !!(window as any).__SVMAI_PENDING__;

      // Use a ref to get current optimisticProcessing state to avoid dependency cycle
      const currentOptimisticProcessing = optimisticProcessing;
      if (__AI_DEBUG__) {
        console.log('🔍 Pending change event:', { pending, optimisticProcessing: currentOptimisticProcessing, phase: event?.detail?.phase });
      }

      if (pending) {
        if (!currentOptimisticProcessing) {
          pendingStartRef.current = performance.now();
          setOptimisticProcessing(true);
          setShowProcessingUI(true);
          if (__AI_DEBUG__) {
            console.log('🔍 Pending started, showing processing UI');
          }
        }
      } else if (currentOptimisticProcessing) {
        // When pending clears, check minimum visibility time
        const elapsed = performance.now() - pendingStartRef.current;
        const MIN_VISIBLE = 400;
        if (__AI_DEBUG__) {
          console.log('🔍 Pending cleared, elapsed:', elapsed, 'ms');
        }

        if (pendingStartRef.current === 0 || elapsed >= MIN_VISIBLE) {
          // Sufficient time has passed, clear immediately
          setOptimisticProcessing(false);
          setShowProcessingUI(false);
          if (__AI_DEBUG__) {
            console.log('🔍 Clearing processing UI immediately');
          }
        } else {
          // Wait for remaining time to meet minimum
          const remaining = MIN_VISIBLE - elapsed;
          if (__AI_DEBUG__) {
            console.log('🔍 Waiting', remaining, 'ms before clearing processing UI');
          }
          setTimeout(() => {
            setOptimisticProcessing(false);
            setShowProcessingUI(false);
            if (__AI_DEBUG__) {
              console.log('🔍 Cleared processing UI after minimum time');
            }
          }, remaining);
        }
      }
    };
    window.addEventListener('svmai-pending-change', handler);
    handler(); // Check initial state
    return () => window.removeEventListener('svmai-pending-change', handler);
  }, [optimisticProcessing, setOptimisticProcessing, setShowProcessingUI]);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }, []);

  // Message action handler
  const handleMessageAction = useCallback(async (action: MessageActionType, message: Message) => {
    try {
      switch (action) {
        case 'copy':
          await navigator.clipboard.writeText(message.content);
          setActionNotice('Message copied to clipboard');
          track('message_action', { action, messageLength: message.content.length });
          break;
        case 'save':
          if (message && message.role === 'assistant' && onAddNote) {
            onAddNote({ id: `note-${Date.now()}`, content: message.content, author: 'assistant', timestamp: Date.now() });
            setActionNotice('Message saved to knowledge');
          } else {
            setActionNotice('Cannot save this message');
          }
          break;
        case 'share': {
          try {
            await navigator.share({ text: message.content });
            setActionNotice('Message shared');
          } catch (err) {
            // Fallback to clipboard
            await navigator.clipboard.writeText(message.content);
            setActionNotice('Message copied to clipboard');
          }
          break;
        }
        case 'fork': {
          if (!message) {
            setActionNotice('Cannot fork this message');
            return;
          }
          const messageIndex = messages.findIndex(
            (msg) => msg.content === message.content && msg.role === message.role
          );
          if (messageIndex === -1) {
            setActionNotice('Message not found');
            return;
          }
          if (onForkThread) {
            onForkThread(messageIndex, message);
            setActionNotice('Thread forked');
          } else if (onNewChat) {
            onNewChat();
            setActionNotice('New chat started');
          } else {
            setActionNotice('Fork not supported');
          }
          break;
        }
        case 'site-search':
          {
            const searchQuery = encodeURIComponent(message.content.slice(0, 100));
            window.open(`/search?q=${searchQuery}`, '_blank');
            track('message_action', { action, feature: 'site_search' });
          }
          break;
        case 'web-search':
          {
            const webQuery = encodeURIComponent(message.content.slice(0, 100));
            window.open(`https://www.google.com/search?q=${webQuery}`, '_blank');
            track('message_action', { action, feature: 'web_search' });
          }
          break;
      }
    } catch (error) {
      console.error('Message action failed:', error);
      setActionNotice('Action failed');
    }
    setTimeout(() => setActionNotice(''), 3000);
  }, [onAddNote, onForkThread, onNewChat, messages, setActionNotice]);

  // Clear action notice timer cleanup
  useEffect(() => {
    if (actionNotice) {
      const timer = setTimeout(() => setActionNotice(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [actionNotice, setActionNotice]);

  // Scroll handling
  const handleScroll = useCallback((scrollTop: number, scrollHeight: number, clientHeight: number) => {
    const threshold = 50;
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - threshold;
    setIsScrolledUp(!isAtBottom);
    setShouldAutoScroll(isAtBottom);
    if (isAtBottom && newMessageCount > 0) {
      setNewMessageCount(0);
    }
  }, [newMessageCount, setIsScrolledUp, setShouldAutoScroll, setNewMessageCount]);

  const handleNewMessageBadgeClick = useCallback(() => {
    scrollToBottom();
    setNewMessageCount(0);
    setShouldAutoScroll(true);
  }, [scrollToBottom, setNewMessageCount, setShouldAutoScroll]);

  // Track new messages when scrolled up (optimized)
  useEffect(() => {
    const currentMessageCount = messages.length;
    const previousCount = lastMessageCountRef.current;
    if (currentMessageCount > previousCount && isScrolledUp) {
      setNewMessageCount(prev => prev + (currentMessageCount - previousCount));
    }
    lastMessageCountRef.current = currentMessageCount;
  }, [messages.length, isScrolledUp, setNewMessageCount, shouldAutoScroll]);

  // Auto-scroll to bottom (optimized with message length instead of full messages array)
  useEffect(() => {
    if (shouldAutoScroll) {
      scrollToBottom();
    }
  }, [messages.length, shouldAutoScroll, scrollToBottom]);

  // Memory management high usage cleanup (optimized with throttling)
  const memoryCleanupCallback = useCallback(() => {
    trackMemoryUsage(memoryStats);
    if (needsCleanup && memoryStats.percentUsed > 90) {
      console.warn('Memory usage high, triggering cleanup:', memoryStats);
      const result = performMemoryCleanup();
      if (result.removedCount > 0) {
        console.log(`Cleaned up ${result.removedCount} messages, preserved ${result.preservedImportant} important ones`);
      }
    }
  }, [memoryStats, needsCleanup, performMemoryCleanup]);

  useEffect(() => {
    memoryCleanupCallback();
  }, [memoryCleanupCallback]);

  // Scroll to bottom effects (optimized to prevent unnecessary calls)
  const autoScrollToBottom = useCallback(() => {
    if (shouldAutoScroll) {
      scrollToBottom();
    }
  }, [shouldAutoScroll, scrollToBottom]);

  useEffect(() => {
    autoScrollToBottom();
  }, [agentActions.length, autoScrollToBottom]);

  useEffect(() => {
    scrollToBottom();
    setNewMessageCount(0);
    setShouldAutoScroll(true);
  }, [activeTab, scrollToBottom, setNewMessageCount, setShouldAutoScroll]);

  // Virtualization readiness attribute
  useEffect(() => {
    function handleVirt(e: any) {
      try {
        if (rootRef.current) {
          rootRef.current.setAttribute('data-ai-virtualized-ready', '1');
          if (e?.detail?.count != null) {
            rootRef.current.setAttribute('data-ai-virtualized-count', String(e.detail.count));
          }
        }
      } catch { /* noop */ }
    }
    window.addEventListener('svmai-virtualized-ready', handleVirt);
    return () => window.removeEventListener('svmai-virtualized-ready', handleVirt);
  }, []);

  // Knowledge hydration/count attributes (inner root mirror for test stability)
  useEffect(() => {
    try {
      if (rootRef.current) {
        rootRef.current.setAttribute('data-ai-knowledge-count', String(notes.length));
        if (!rootRef.current.getAttribute('data-ai-knowledge-hydrated')) {
          // Mark hydrated on first pass (even if zero notes) for deterministic E2E
          rootRef.current.setAttribute('data-ai-knowledge-hydrated', '1');
        }
        // Propagate to authoritative sidebar root for E2E selectors that target [data-ai-sidebar-root]
        const outerRoot = rootRef.current.closest('[data-ai-sidebar-root]') as HTMLElement | null;
        if (outerRoot) {
          outerRoot.setAttribute('data-ai-knowledge-count', String(notes.length));
          if (!outerRoot.getAttribute('data-ai-knowledge-hydrated')) {
            outerRoot.setAttribute('data-ai-knowledge-hydrated', '1');
          }
        }
      }
    } catch { /* noop */ }
  }, [notes.length]);

  // Messages persistence readiness stamping (mitigates reload flake in persistence spec)
  // Adds deterministic attributes immediately when message count changes so tests can rely
  // on a stable indicator that persisted messages have hydrated.
  useEffect(() => {
    try {
      if (rootRef.current) {
        rootRef.current.setAttribute('data-ai-total-messages', String(messages.length));
        if (messages.length > 0 && !rootRef.current.getAttribute('data-ai-messages-hydrated')) {
          rootRef.current.setAttribute('data-ai-messages-hydrated', '1');
          // Fire a custom event to allow future tests to wait explicitly if needed
          window.dispatchEvent(new CustomEvent('svmai-messages-hydrated', {
            detail: { count: messages.length, ts: Date.now() }
          }));
        }
        // Propagate to authoritative sidebar root
        const outerRoot = rootRef.current.closest('[data-ai-sidebar-root]') as HTMLElement | null;
        if (outerRoot) {
          outerRoot.setAttribute('data-ai-total-messages', String(messages.length));
          if (messages.length > 0 && !outerRoot.getAttribute('data-ai-messages-hydrated')) {
            outerRoot.setAttribute('data-ai-messages-hydrated', '1');
          }
        }
      }
    } catch { /* noop */ }
  }, [messages.length]);

  // Message renderer
  const renderMessage = useCallback((message: Message, index: number) => {
    // Avoid rendering empty placeholder responses
    if (message.role === 'assistant' && (!message.content || message.content.trim() === '')) {
      return (
        <div className="text-white/50 italic px-2" data-ai-placeholder>
          ⚠️ No response generated. Please try again.
        </div>
      );
    }
    return (
      <MessageRenderer
        message={message}
        index={index}
        showRoleLabels={prefs.showRoleLabels}
        density={prefs.density}
        fontSize={prefs.fontSize}
        showReasoningDefault={prefs.showReasoningDefault}
        onAction={handleMessageAction}
      />
    );
  }, [prefs, handleMessageAction]);

  // Promote note to context handler
  const getPromoteToContextHandler = useCallback(() => {
    return (noteId: string, content: string) => {
      const contextText = `[Reference]: ${content}\n\n`;
      onInputChange(contextText);
      track('knowledge_action', {
        action: 'promote_to_context',
        noteId,
        noteTokens: estimateTokens(content)
      });
    };
  }, [onInputChange]);

  // Announce new messages (accessibility)
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      const announcement = `${lastMessage.role === 'user' ? 'You' : 'AI Assistant'} said: ${lastMessage.content.substring(0, 100)}`;
      if (typeof document !== 'undefined') {
        const liveRegion = document.createElement('div');
        liveRegion.setAttribute('role', 'status');
        liveRegion.setAttribute('aria-live', 'polite');
        liveRegion.className = 'sr-only';
        liveRegion.textContent = announcement;
        document.body.appendChild(liveRegion);
        setTimeout(() => {
          if (document.body.contains(liveRegion)) {
            document.body.removeChild(liveRegion);
          }
        }, 1000);
      }
    }
  }, [messages]);

  // Key handling
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'P' || e.key === 'p')) {
      if (isTxPage) {
        e.preventDefault();
        try {
          const sig = window.location.pathname.split('/')[2] || '';
          onInputChange(`Explain this transaction: ${sig}`);
        } catch { }
        return;
      }
    }
    if (e.ctrlKey && e.shiftKey && e.key === 'K') {
      e.preventDefault();
      onInputChange('');
      try {
        const announcement = document.createElement('div');
        announcement.setAttribute('aria-live', 'polite');
        announcement.setAttribute('aria-atomic', 'true');
        announcement.className = 'sr-only';
        announcement.textContent = 'Input cleared';
        document.body.appendChild(announcement);
        setTimeout(() => document.body.removeChild(announcement), 1000);
      } catch { }
      return;
    }
    if (e.key === 'Escape' && isProcessing) {
      e.preventDefault();
      onCancel?.();
      return;
    }

    if (showReferenceAutocomplete) {
      const { filteredNotes } = getReferenceContext();
      if (e.key === 'ArrowDown' && filteredNotes.length > 0) {
        e.preventDefault();
        setReferenceIndex(prev => (prev + 1) % filteredNotes.length);
        return;
      }
      if (e.key === 'ArrowUp' && filteredNotes.length > 0) {
        e.preventDefault();
        setReferenceIndex(prev => (prev - 1 + filteredNotes.length) % filteredNotes.length);
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey && filteredNotes.length > 0) {
        e.preventDefault();
        const selectedNote = filteredNotes[referenceIndex];
        if (selectedNote) {
          const notePreview = selectedNote.content.length > 100
            ? selectedNote.content.substring(0, 100) + '...'
            : selectedNote.content;
          onInputChange(`Referenced note: "${notePreview}" `);
          setShowReferenceAutocomplete(false);
          setReferenceIndex(0);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowReferenceAutocomplete(false);
        setReferenceIndex(0);
        return;
      }
    }

    // Immediate Tab completion safeguard for slash commands (handles debounce race before suggestions list mounts)
    if (e.key === 'Tab' && !e.shiftKey) {
      // IMPORTANT: Do NOT trim here. We need to preserve a trailing space after a completed
      // slash command ("/tps ") so that the next Enter submits instead of triggering the
      // fallback completion logic again. Trimming caused the trailing space to be lost,
      // resulting in the second Enter being intercepted and the Processing UI never showing.
      const currentValue = (inputRef.current?.value || input);

      // Idempotent guard: if we already have a completed command with trailing space, keep focus
      // and prevent default so the Tab key doesn't move focus out of the textarea.
      if (/^\/[a-zA-Z]+ $/.test(currentValue)) {
        e.preventDefault();
        // Ensure suggestions are hidden so next Enter submits.
        if (showSlashHelp) {
          setShowSlashHelp(false);
          setSlashIndex(0);
        }
        return;
      }

      // Standard completion path (works even before suggestions list fully mounts)
      if (currentValue.startsWith('/') && !currentValue.startsWith('/ref ')) {
        // Use a trimmed value ONLY for computing suggestions (not for deciding completion state)
        const trimmedForSuggestions = currentValue.trim();
        const partial = trimmedForSuggestions.slice(1);
        const suggestions = getContextualSuggestions(partial);
        if (suggestions.length > 0) {
          e.preventDefault();
          const result = completeSlashCommand(trimmedForSuggestions, 0, suggestions, 'tab');
          // Always ensure a trailing space after completion for reliable Enter submission
          const completedWithSpace = result.completed.endsWith(' ') ? result.completed : (result.completed + ' ');
          onInputChange(completedWithSpace);
          // Hide suggestions after auto-complete so next Enter submits
          setShowSlashHelp(false);
          setSlashIndex(0);
          trackSlashUsage(suggestions[0].cmd, 'tab');
          requestAnimationFrame(() => {
            const el = inputRef.current;
            if (el) el.selectionStart = el.selectionEnd = el.value.length;
          });
          return;
        }
      }
    }

    if (showSlashHelp) {
      const slashContext = getSlashContext();
      const { suggestions } = slashContext;
      if (e.key === 'Tab' && !e.shiftKey && suggestions.length > 0) {
        e.preventDefault();
        const selectedCommand = suggestions[Math.min(slashIndex, suggestions.length - 1)];
        const result = completeSlashCommand(input, Math.min(slashIndex, suggestions.length - 1), suggestions, 'tab');
        onInputChange(result.completed);
        // Hide suggestions so immediate Enter triggers submit
        setShowSlashHelp(false);
        setSlashIndex(0);
        trackSlashUsage(selectedCommand.cmd, 'tab');
        requestAnimationFrame(() => {
          const el = inputRef.current;
          if (el) el.selectionStart = el.selectionEnd = el.value.length;
        });
        return;
      }
      if (e.key === 'ArrowRight' && suggestions.length > 0) {
        const el = inputRef.current;
        if (el && el.selectionStart === el.value.length && el.selectionEnd === el.value.length) {
          e.preventDefault();
          const selectedCommand = suggestions[Math.min(slashIndex, suggestions.length - 1)];
          const result = completeSlashCommand(input, Math.min(slashIndex, suggestions.length - 1), suggestions, 'right');
          onInputChange(result.completed);
          // Hide suggestions after right-arrow completion
          setShowSlashHelp(false);
          setSlashIndex(0);
          trackSlashUsage(selectedCommand.cmd, 'right');
          requestAnimationFrame(() => {
            const el = inputRef.current;
            if (el) el.selectionStart = el.selectionEnd = el.value.length;
          });
          return;
        }
      }
      if (e.key === 'Enter' && !e.shiftKey && suggestions.length > 0) {
        const selectedCommand = suggestions[Math.min(slashIndex, suggestions.length - 1)];
        const result = completeSlashCommand(input, Math.min(slashIndex, suggestions.length - 1), suggestions, 'enter');
        if (!result.shouldSubmit) {
          e.preventDefault();
          onInputChange(result.completed);
          // Hide suggestions so this Enter only completes and next Enter submits
          setShowSlashHelp(false);
          setSlashIndex(0);
          trackSlashUsage(selectedCommand.cmd, 'enter');
          requestAnimationFrame(() => {
            const el = inputRef.current;
            if (el) el.selectionStart = el.selectionEnd = el.value.length;
          });
          return;
        }
      }
      if (e.key === 'Tab' && e.shiftKey && suggestions.length > 0) {
        e.preventDefault();
        setSlashIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === 'ArrowDown' && suggestions.length > 0) {
        e.preventDefault();
        setSlashIndex(prev => (prev + 1) % suggestions.length);
        return;
      }
      if (e.key === 'ArrowUp' && suggestions.length > 0) {
        e.preventDefault();
        setSlashIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      // Fallback slash autocomplete safeguard (bugfix):
      // Only perform inline completion when user has typed a partial or exact slash command token
      // WITHOUT a trailing space. Previously we also triggered when the input already ended
      // with a space (e.g. "/tps ") because we trimmed before testing. That caused the second
      // Enter (after auto-completion added the space) to be intercepted and prevented submit,
      // so the Processing UI never appeared in E2E tests.
      const rawValue = inputRef.current?.value || input;
      const trimmed = rawValue.trim();
      const hasTrailingSpace = rawValue.endsWith(' ');
      if (!hasTrailingSpace && /^\/[a-zA-Z]+$/.test(trimmed)) {
        const token = trimmed.slice(1).toLowerCase();
        const match = SLASH_COMMANDS.find(c => c.cmd.startsWith(token));
        if (match) {
          e.preventDefault();
          const completed = `/${match.cmd} `;
          onInputChange(completed);
          // After inline completion, hide suggestions so next Enter submits
          setShowSlashHelp(false);
          setSlashIndex(0);
          requestAnimationFrame(() => {
            const el = inputRef.current;
            if (el) el.selectionStart = el.selectionEnd = el.value.length;
          });
          trackSlashUsage(match.cmd, 'enter');
          return;
        }
      }
      e.preventDefault();
      if (!isProcessing) {
        try {
          // Immediate optimistic processing to ensure status bar appears before async submit resolves
          setShowProcessingUI(true);
          setOptimisticProcessing(true);
          const form = inputRef.current?.closest('form');
          if (form) {
            const event = new Event('submit', { bubbles: true, cancelable: true });
            form.dispatchEvent(event);
          } else {
            onSubmit({ preventDefault: () => { } } as unknown as React.FormEvent);
          }
        } catch (error) {
          console.error('Error in Enter key submission:', error);
        }
      }
    }

    // Input history navigation
    if (!showSlashHelp && !showReferenceAutocomplete) {
      const el = inputRef.current;
      if (el) {
        // ArrowUp: Navigate to previous input in history (when cursor is at start)
        if (e.key === 'ArrowUp' && el.selectionStart === 0 && el.selectionEnd === 0) {
          e.preventDefault();
          if (inputHistory.length > 0) {
            let newIndex: number;
            if (historyIndex === null) {
              // First time navigating - save current input as draft and go to last item
              setDraftBeforeHistory(input);
              newIndex = inputHistory.length - 1;
            } else if (historyIndex > 0) {
              // Go further back in history
              newIndex = historyIndex - 1;
            } else {
              // Already at the beginning of history
              return;
            }
            setHistoryIndex(newIndex);
            onInputChange(inputHistory[newIndex]);
          }
          return;
        }

        // ArrowDown: Navigate to next input in history (when cursor is at end)
        if (e.key === 'ArrowDown' && el.selectionStart === el.value.length && el.selectionEnd === el.value.length) {
          e.preventDefault();
          if (historyIndex !== null) {
            if (historyIndex < inputHistory.length - 1) {
              // Go forward in history
              const newIndex = historyIndex + 1;
              setHistoryIndex(newIndex);
              onInputChange(inputHistory[newIndex]);
            } else {
              // At the end of history - restore draft or clear
              setHistoryIndex(null);
              onInputChange(draftBeforeHistory);
              setDraftBeforeHistory('');
            }
          }
          return;
        }
      }
    }
  };

  // Build chat (messages) content
  const chatMessagesContent = (
    <div className="relative flex-1 min-h-0 flex flex-col" data-ai-tab="chat">
      <div data-ai-tab="agent" className="hidden" />
      <div className="flex-1 min-h-0" ref={containerMeasureRef}>
        {shouldVirtualize ? (
          <VirtualizedMessageList
            messages={messages}
            renderMessage={renderMessage}
            onScroll={handleScroll}
            autoScrollToBottom={shouldAutoScroll}
            containerHeight={viewportHeight}
            className={prefs.density === 'compact' ? 'p-3 pb-28' : 'p-4 pb-28'}
          />
        ) : (
          <DynamicHeightMessageArea
            messages={messages}
            renderMessage={renderMessage}
            onScroll={handleScroll}
            autoScrollToBottom={shouldAutoScroll}
            density={prefs.density}
          />
        )}
      </div>

      {agentActions.length > 0 && activeTab === 'agent' && (
        <div
          className="border border-white/20 rounded-lg p-4 space-y-2 m-4"
          role="region"
          aria-label="Agent actions"
          data-ai-actions-feed
        >
          <div className="text-[12px] text-white/50 flex items-center justify-between">
            <span>Actions:</span>
            <div className="flex gap-2">
              {agentActions.some(a => a.status === 'completed') && (
                <span className="text-green-500 flex items-center gap-1" role="status">
                  <div className="w-2 h-2 rounded-full bg-green-500" aria-hidden="true" />
                  {agentActions.filter(a => a.status === 'completed').length} completed
                </span>
              )}
              {agentActions.some(a => a.status === 'in_progress') && (
                <span className="text-yellow-500 flex items-center gap-1" role="status">
                  <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" aria-hidden="true" />
                  {agentActions.filter(a => a.status === 'in_progress').length} in progress
                </span>
              )}
              {agentActions.some(a => a.status === 'failed') && (
                <span className="text-red-500 flex items-center gap-1" role="status">
                  <div className="w-2 h-2 rounded-full bg-red-500" aria-hidden="true" />
                  {agentActions.filter(a => a.status === 'failed').length} failed
                </span>
              )}
            </div>
          </div>
          <div
            className="space-y-2 max-h-[200px] overflow-y-auto"
            role="list"
            aria-label="Action list"
          >
            {agentActions.map((action) => (
              <div
                key={action.id}
                className={`flex items-center gap-2 text-[12px] p-2 rounded transition-colors ${action.status === 'in_progress' ? 'bg-white/5' : 'hover:bg-white/5'
                  }`}
                role="listitem"
                aria-label={`Action: ${action.description}, Status: ${action.status}`}
                data-ai-action-item
              >
                <div
                  className={`w-2 h-2 rounded-full ${action.status === 'completed' ? 'bg-green-500' :
                    action.status === 'failed' ? 'bg-red-500' :
                      action.status === 'in_progress' ? 'bg-yellow-500 animate-pulse' :
                        'bg-yellow-500'
                    }`}
                  aria-hidden="true"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-white truncate">{action.description}</div>
                  {action.status === 'in_progress' && (
                    <div className="text-[11px] text-white/50 mt-0.5">
                      {typeof action.startTime === 'number' && (
                        <span>
                          {Math.max(0, Math.floor((Date.now() - action.startTime) / 1000))}s elapsed
                        </span>
                      )}
                      {typeof action.stepIndex === 'number' && typeof action.totalSteps === 'number' && (
                        <span className="ml-2">Step {action.stepIndex} of {action.totalSteps}</span>
                      )}
                    </div>
                  )}
                  {action.error && (
                    <div
                      className="text-red-500 text-[11px] mt-1 break-words"
                      role="alert"
                    >
                      {action.error}
                    </div>
                  )}
                </div>
                {action.status === 'failed' && (
                  <button
                    onClick={() => onRetryAction?.(action.id)}
                    className="shrink-0 px-2 py-1 text-[11px] text-white/70 hover:text-white hover:bg-white/10 rounded transition-colors focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
                    title="Retry this action"
                    aria-label="Retry this action"
                  >
                    Retry
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div ref={messagesEndRef} aria-hidden="true" />
      <NewMessageBadge
        messageCount={newMessageCount}
        isVisible={isScrolledUp && newMessageCount > 0}
        onClick={handleNewMessageBadgeClick}
      />
    </div>
  );

  // Knowledge panel content
  const knowledgePanelContent = (
    <div className="relative flex-1 min-h-0" data-ai-tab="knowledge">
      <KnowledgePanel
        notes={notes}
        onAddNote={(content) => {
          if (typeof content === 'string' && onAddNote) {
            const noteId = `note-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
            onAddNote({ id: noteId, content, author: 'user', timestamp: Date.now() });
          }
        }}
        onRemoveNote={onRemoveNote}
        onClearNotes={onClearNotes}
        onPromoteToContext={getPromoteToContextHandler()}
        className="h-full"
      />
    </div>
  );

  // History panel content
  const historyPanelContent = (
    <div className="relative flex-1 min-h-0" data-ai-tab="history">
      <HistoryPanel
        tabs={tabs}
        activeTabId={activeTabId}
        onTabClick={onTabClick || (() => { })}
        onTabDelete={onTabDelete}
        className="h-full"
        userId={userId}
        enablePersistence={enablePersistence}
        onReload={onHistoryReload}
      />
    </div>
  );

  const isNotesTab = activeTab === 'notes';
  const isHistoryTab = historyActive;
  const mainScrollableContent = isNotesTab ? knowledgePanelContent :
    isHistoryTab ? historyPanelContent :
      chatMessagesContent;

  return (
    <ChatErrorBoundary>
      <div
        ref={rootRef}
        data-ai-chat-ui
        data-ai-chat-ready
        data-ai-mode={mode}
        className={`chat-main-container relative ${variant === 'sidebar' ? 'h-full' : variant === 'dialog' ? 'max-h-[600px]' : 'h-screen'} flex flex-col ${variant === 'sidebar' ? '' : 'overflow-hidden'}`}
      >
        <a href="#chat-input" className="skip-link absolute top-0 left-0 bg-black text-white p-2 -translate-y-full focus:translate-y-0 transition-transform">
          Skip to chat input
        </a>

        {variant !== 'sidebar' && <VantaBackground />}



        <div
          className={`chat-flex-container flex flex-col flex-1 min-h-0 relative z-10 ${className}`}
          role="region"
          aria-label="AI Chat Interface"
        >
          <div className={`relative z-0 flex-1 min-h-0 overflow-y-auto ${variant === 'sidebar' ? 'bg-black' : 'bg-black/30 backdrop-blur-[2px]'}`}>
            {mainScrollableContent}
          </div>

          {((variant === 'sidebar' || isE2E) && activeTab === 'agent') && (
            <div className="px-4 pt-3 pb-1 border-t border-white/10 bg-black/60 flex flex-wrap gap-2 flex-shrink-0 relative z-10" role="toolbar" aria-label="Quick actions">
              <button
                type="button"
                className="text-[11px] px-2 py-1 rounded-full border border-white/20 text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
                onClick={() => openWithPrompt?.('What is the current Solana TPS?', { submit: true })}
                data-ai-quick="tps"
                title="Ask for current TPS"
              >
                TPS
              </button>
              {isTxPage && (
                <button
                  type="button"
                  className="text-[11px] px-2 py-1 rounded-full border border-white/20 text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
                  onClick={() => {
                    try {
                      const sig = window.location.pathname.split('/')[2] || '';
                      openWithPrompt?.(`Explain this transaction: ${sig}`, { submit: false });
                    } catch { }
                  }}
                  data-ai-quick="context"
                  title="Use current page context"
                >
                  Context
                </button>
              )}
            </div>
          )}

          {(showProcessingUI || (isMockMode && optimisticProcessing)) && (isProcessing || optimisticProcessing) && (
            <div
              role="status"
              aria-live="polite"
              className="px-4 py-1 text-[11px] text-white/70 bg-black/60 border-t border-white/10"
              data-ai-processing-status
              data-ai-processing-active="1"
              ref={(el) => {
                if (el && isMockMode) {
                  console.log('🔍 Processing status element rendered in mock mode');
                }
              }}
            >
              Processing…
            </div>
          )}
          {/* Debug info for mock mode */}
          {isMockMode && (
            <div
              className="px-4 py-1 text-[9px] text-yellow-300 bg-yellow-900/20 border-t border-yellow-500/20"
              data-ai-debug-info
            >
              Debug: showProcessingUI={String(showProcessingUI)}, optimisticProcessing={String(optimisticProcessing)}, isProcessing={String(isProcessing)}, isMockMode={String(isMockMode)}, url={typeof window !== 'undefined' ? window.location.search : 'no-window'}
            </div>
          )}

          {actionNotice && (
            <div
              role="status"
              aria-live="polite"
              className="px-4 py-2 text-[11px] text-green-300 bg-green-900/20 border-t border-green-500/20"
              data-ai-action-notice
            >
              {actionNotice}
            </div>
          )}

          {/* Input area */}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                const current = inputRef.current?.value ?? input;
                const trimmed = (current || '').trim();

                if (trimmed) {
                  setInputHistory(prev => (prev.length > 0 && prev[prev.length - 1] === trimmed) ? prev : [...prev, trimmed]);
                  setHistoryIndex(null);
                  setDraftBeforeHistory('');
                }

                setSlashIndex(0);
                setShowSlashHelp(false);

                // If the input is a direct query that should trigger a server-side RPC, bypass the agent
                // Only trigger for specific Solana/blockchain data queries, not general conversation
                if (
                  ['tps', 'transactions per second', 'network load', 'block height', 'epoch', 'balance', 'account info',
                    'current tps', 'current epoch', 'block height', 'network status', 'validator count',
                    'what is the current tps', 'what is current epoch', 'solana tps', 'network performance',
                    'getrecentblockhash', 'getblocks', 'getblock', 'gettransaction', 'getaccountinfo', 'getbalance',
                    'getslot', 'getversion', 'getepochinfo', 'gethealth', 'getidentity', 'getfirstavailableblock']
                    .some(key => trimmed.toLowerCase().includes(key))
                ) {
                  try {
                    // Show quick processing state for direct query
                    setShowProcessingUI(true);
                    setOptimisticProcessing(true);

                    const response = await fetch('/api/getAnswer', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ question: trimmed, sources: [] })
                    });

                    if (!response.ok) {
                      throw new Error(`Request failed (${response.status})`);
                    }

                    // Try JSON first, fallback to text
                    let dataText: string;
                    const ct = response.headers.get('content-type') || '';
                    if (ct.includes('application/json')) {
                      const json = await response.json();
                      dataText = typeof json === 'string'
                        ? json
                        : (json.answer || json.result || JSON.stringify(json));
                    } else {
                      dataText = await response.text();
                    }

                    const assistantMessage: Message = {
                      role: 'assistant',
                      content: dataText || 'No data returned.'
                    };

                    if (onDirectResponse) {
                      onDirectResponse(assistantMessage);
                    } else {
                      // Fallback logging if parent did not supply handler
                      console.log('Direct RPC response (no onDirectResponse handler):', assistantMessage);
                    }
                  } catch (error) {
                    console.error('Error submitting direct RPC query:', error);
                    if (onDirectResponse) {
                      onDirectResponse({
                        role: 'assistant',
                        content: '⚠️ Failed to retrieve direct answer. Please try again or rephrase.'
                      });
                    }
                  } finally {
                    // Clear optimistic state for direct path to avoid lingering "Processing…" bar
                    setOptimisticProcessing(false);
                    setShowProcessingUI(false);
                  }
                  return; // Prevent further processing by the agent
                }
              } catch (error) {
                console.error('Error in form submission:', error);
              }

              // Always set processing state immediately when form is submitted
              setShowProcessingUI(true);
              setOptimisticProcessing(true);

              if (isMockMode) {
                console.log('🔍 Mock mode: Processing UI started, will be controlled by pending state');
              }

              onSubmit(e);
            }}
            className={`chat-input-area mt-auto p-4 border-t border-white/20 flex-shrink-0 relative z-50 ${variant === 'sidebar' ? 'bg-black' : 'bg-black/50 backdrop-blur-sm'}`}
            role="form"
            aria-label="Send a message"
          >
            <div className="space-y-3">
              {onModeChange && (
                <ModeSelector
                  mode={mode}
                  onChange={onModeChange || (() => { })}
                  disabled={isProcessing}
                  className="w-full"
                />
              )}

              <label htmlFor="chat-input" className="sr-only">
                Type your message
              </label>

              {/* Unified input row: textarea + controls */}
              <div className="flex items-center gap-2 bg-black text-white rounded-lg border border-white/20 px-3 py-2">
                <textarea
                  id="chat-input"
                  ref={(el) => {
                    (inputRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
                    (textareaRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
                  }}
                  value={input}
                  onChange={(e) => {
                    const value = e.target.value;
                    try {
                      onInputChange(value);
                      const showSlash = value.trim().startsWith('/') && !value.startsWith('/ref ');
                      setShowSlashHelp(showSlash);
                      if (showSlash) setSlashIndex(0);
                      const showRef = value.startsWith('/ref ');
                      setShowReferenceAutocomplete(showRef);
                      if (showRef) setReferenceIndex(0);
                      if (!showSlash && !showRef && historyIndex !== null) {
                        setHistoryIndex(null);
                        setDraftBeforeHistory('');
                      }
                    } catch (error) {
                      console.error('Error in input change:', error);
                    }
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    isProcessing
                      ? "Processing..."
                      : activeTab === 'notes'
                        ? "Add knowledge..."
                        : showSlashHelp
                          ? "Continue typing or use ↑/↓ to select..."
                          : showReferenceAutocomplete
                            ? "Continue typing to filter notes..."
                            : "Ask a question, type / for commands, or /ref to reference notes..."
                  }
                  disabled={isProcessing}
                  aria-disabled={isProcessing}
                  aria-controls={showSlashHelp ? 'ai-slash-list' : undefined}
                  aria-activedescendant={(() => {
                    if (!showSlashHelp) return undefined;
                    const { suggestions } = getSlashContext();
                    const active = Math.min(slashIndex, suggestions.length - 1);
                    return suggestions.length > 0 ? `ai-slash-option-${suggestions[active]}` : undefined;
                  })()}
                  aria-describedby="input-help"
                  aria-label="Chat input"
                  className="flex-1 bg-transparent text-white placeholder-white/50 border-0 focus:outline-none disabled:opacity-50 resize-none leading-[1.4]"
                  data-ai-chat-input
                  data-testid="message-input"
                  style={{ minHeight: '44px', fontSize: `${prefs.fontSize}px` }}
                />

                <button
                  onClick={onVoiceRecord}
                  disabled={isRecording}
                  aria-label={isRecording ? "Stop recording" : "Start voice input"}
                  aria-pressed={isRecording}
                  className="text-white/90 disabled:opacity-50 p-1 hover:bg-white/10 rounded-sm focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
                  title={isRecording ? 'Recording...' : 'Start Voice Input'}
                  type="button"
                >
                  <span className="sr-only">Voice input</span>
                  {isRecording ? <Loader className="animate-spin" size={18} /> : <Mic size={18} />}
                </button>

                <button
                  type="button"
                  aria-label="Copy last response"
                  title="Copy last response"
                  onClick={() => {
                    try {
                      const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
                      if (lastAssistant?.content) navigator.clipboard?.writeText(lastAssistant.content);
                      setCopyNotice(true);
                      setTimeout(() => setCopyNotice(false), 1500);
                    } catch (err) {
                      console.error('Copy failed:', err);
                    }
                  }}
                  disabled={!messages.some(m => m.role === 'assistant')}
                  className="text-white/90 disabled:opacity-50 p-1 hover:bg-white/10 rounded-sm focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
                >
                  <span className="sr-only">Copy last response</span>
                  <Send size={16} className="rotate-[-90deg] opacity-80" />
                </button>

                {isProcessing ? (
                  <button
                    type="button"
                    aria-label="Cancel processing"
                    onClick={() => onCancel?.()}
                    className="text-white p-1 hover:bg-white/10 rounded-sm focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
                  >
                    <Loader className="animate-spin" size={16} />
                  </button>
                ) : (
                  <button
                    type="submit"
                    aria-label="Send message"
                    disabled={isProcessing || !input.trim()}
                    className="text-white disabled:opacity-50 p-1 hover:bg-white/10 rounded-sm focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
                  >
                    <Send size={16} />
                  </button>
                )}
              </div>

              {copyNotice && (
                <div
                  role="status"
                  aria-live="polite"
                  className="text-[11px] text-white/80"
                  data-ai-toast="copied"
                >
                  Copied to clipboard
                </div>
              )}

              {/* Slash suggestions */}
              {showSlashHelp && (() => {
                const { suggestions } = getSlashContext();
                const active = Math.min(slashIndex, suggestions.length - 1);
                return (
                  <div id="ai-slash-list" className="mt-2 text-[11px] text-white/80" role="listbox" aria-label="Slash command suggestions" data-ai-slash-list>
                    <div className="space-y-1">
                      {suggestions.map((cmd, i) => {
                        const isActive = i === active;
                        const badge = getContextBadge(cmd);
                        return (
                          <button
                            key={cmd.cmd}
                            type="button"
                            role="option"
                            aria-selected={isActive}
                            aria-describedby={`slash-desc-${cmd.cmd}`}
                            id={`ai-slash-option-${cmd.cmd}`}
                            className={`w-full text-left px-3 py-2 rounded-lg border ${isActive
                              ? 'border-white bg-white/10 text-white'
                              : 'border-white/20 text-white/80 hover:bg-white/5'
                              } focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2 transition-colors`}
                            data-ai-slash-option={cmd.cmd}
                            onClick={() => {
                              const result = completeSlashCommand(input, i, suggestions, 'tab');
                              onInputChange(result.completed);
                              setSlashIndex(0);
                              trackSlashUsage(cmd.cmd, 'tab', undefined);
                              requestAnimationFrame(() => inputRef.current?.focus());
                            }}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono">/{cmd.cmd}</span>
                              {badge && (
                                <span className="text-[10px] opacity-70" title={`For ${cmd.context} pages`}>
                                  {badge}
                                </span>
                              )}
                            </div>
                            <div id={`slash-desc-${cmd.cmd}`} className="text-[10px] text-white/60 mt-0.5">
                              {cmd.desc}
                            </div>
                            {cmd.example && (
                              <div className="text-[9px] text-white/40 mt-0.5 font-mono">
                                {cmd.example}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-2 text-white/50 text-[10px] flex justify-between">
                      <span>Tab/→ complete • ↑/↓ select • Enter submit</span>
                    </div>
                  </div>
                );
              })()}

              {/* Reference autocomplete */}
              {showReferenceAutocomplete && (() => {
                const { filteredNotes } = getReferenceContext();
                return (
                  <div
                    className="mt-2 text-[11px] text-white/80 max-h-48 overflow-y-auto"
                    data-testid="reference-autocomplete"
                    role="listbox"
                    aria-label="Knowledge note references"
                  >
                    {filteredNotes.length === 0 ? (
                      <div className="px-3 py-2 text-white/50">
                        No matching knowledge notes found
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {filteredNotes.map((note, i) => {
                          const isActive = i === referenceIndex;
                          const preview = note.content.length > 80
                            ? note.content.substring(0, 80) + '...'
                            : note.content;
                          return (
                            <button
                              key={note.id}
                              type="button"
                              role="option"
                              aria-selected={isActive}
                              className={`w-full text-left px-3 py-2 rounded-lg border ${isActive
                                ? 'border-white bg-white/10 text-white'
                                : 'border-white/20 text-white/80 hover:bg-white/5'
                                } focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2 transition-colors`}
                              data-testid="reference-option"
                              onClick={() => {
                                const notePreview = note.content.length > 100
                                  ? note.content.substring(0, 100) + '...'
                                  : note.content;
                                onInputChange(`Referenced note: "${notePreview}" `);
                                setShowReferenceAutocomplete(false);
                                setReferenceIndex(0);
                                requestAnimationFrame(() => inputRef.current?.focus());
                              }}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] opacity-70">
                                  {note.author}
                                </span>
                                <span className="text-[9px] opacity-50">
                                  {new Date(note.timestamp).toLocaleDateString()}
                                </span>
                              </div>
                              <div className="mt-0.5 text-white/90">
                                {preview}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                    <div className="mt-2 text-white/50 text-[10px]">
                      ↑/↓ navigate • Enter select • Esc cancel
                    </div>
                  </div>
                );
              })()}

              <div id="input-help" className="sr-only">
                Press Enter to send, Shift+Enter for new line
              </div>
            </div>
          </form>
        </div>
      </div>
    </ChatErrorBoundary >
  );
}
