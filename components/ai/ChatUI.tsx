"use client";

// Added explicit client directive since this file makes extensive use of React hooks.
// Without it, Next.js may treat the module as a server component when imported, causing
// runtime hook errors or a silent hydration failure leading to an empty (black) chat area.
console.log('🔍 ChatUI module loaded');
import { Loader, Mic, Send } from 'lucide-react';
import type { Message, Note, AgentAction } from './types';
import { useEffect, useRef, useState, useCallback } from 'react';
import { VantaBackground } from './VantaBackground';
import { NewMessageBadge } from './NewMessageBadge';
import { useAIChatSidebar } from '../../contexts/AIChatSidebarContext';
import { track } from '../../lib/ai/telemetry';
import { MessageActions, type MessageActionType } from './components/MessageActions';
import { EnhancedMessageRenderer } from './components/EnhancedMessageRenderer';
import { ReasoningBlock } from './components/ReasoningBlock';
import { parseAssistantMessage } from '../../lib/ai/parseAssistantMessage';
import { KnowledgePanel } from './components/KnowledgePanel';
import { ModeSelector } from './components/ModeSelector';
import { estimateTokens } from './utils/tokenCounter';
import { SLASH_COMMANDS, completeSlashCommand, trackSlashUsage, getContextualSuggestions, getContextBadge } from './utils/slashCommands';
import { useDebounce } from './hooks/useDebounce';
import { useMemoryManagement, trackMemoryUsage } from './utils/memoryManager';
import { useUIPreferences } from './hooks/useUIPreferences';
import { useAutosizeTextarea } from '../../hooks/useAutosizeTextarea';
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
      className={`overflow-y-auto w-full h-full ${density === 'compact' ? 'p-3 space-y-2' : 'p-4 space-y-4'}`}
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
}: ChatUIProps) {
  console.log('🔍 ChatUI component called', { variant, activeTab, messagesCount: messages.length });
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

  // Try to get the context safely
  let registerInputController, openWithPrompt;
  try {
    const context = useAIChatSidebar();
    registerInputController = context.registerInputController;
    openWithPrompt = context.openWithPrompt;
    console.log('🔍 ChatUI: AIChatSidebar context loaded successfully');
  } catch (error) {
    console.error('🔍 ChatUI: Failed to load AIChatSidebar context:', error);
    registerInputController = () => { };
    openWithPrompt = () => { };
  }

  const [optimisticProcessing, setOptimisticProcessing] = useState(false);
  const [newMessageCount, setNewMessageCount] = useState(0);
  const [isScrolledUp, setIsScrolledUp] = useState(false);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const [showSlashHelp, setShowSlashHelp] = useState(false);
  const [copyNotice, setCopyNotice] = useState(false);
  const [actionNotice, setActionNotice] = useState<string>('');
  const [inputHistory, setInputHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const [draftBeforeHistory, setDraftBeforeHistory] = useState<string>('');
  const [slashIndex, setSlashIndex] = useState(0);
  const [showReferenceAutocomplete, setShowReferenceAutocomplete] = useState(false);
  const [referenceIndex, setReferenceIndex] = useState(0);

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

  // Register input controller
  useEffect(() => {
    registerInputController({
      setInput: onInputChange,
      focusInput: () => inputRef.current?.focus(),
      submit: () => {
        try {
          setOptimisticProcessing(true);
          const form = inputRef.current?.closest('form');
            if (form) {
              const event = new Event('submit', { bubbles: true, cancelable: true });
              form.dispatchEvent(event);
            } else {
              onSubmit({ preventDefault: () => { /* noop */ } } as unknown as React.FormEvent);
            }
        } catch (err) {
          console.error('Programmatic submit failed:', err);
        }
      }
    });
  }, [registerInputController, onInputChange, onSubmit]);

  // Clear optimistic flag
  useEffect(() => {
    if (isProcessing) {
      setOptimisticProcessing(true);
    } else if (optimisticProcessing) {
      const t = setTimeout(() => setOptimisticProcessing(false), 50);
      return () => clearTimeout(t);
    }
  }, [isProcessing, optimisticProcessing]);

  // Global pending fallback
  const pendingStartRef = useRef<number>(0);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = () => {
      const pending = !!(window as any).__SVMAI_PENDING__;
      if (pending) {
        if (!optimisticProcessing) {
          pendingStartRef.current = performance.now();
          setOptimisticProcessing(true);
        }
      } else if (optimisticProcessing) {
        const elapsed = performance.now() - pendingStartRef.current;
        const MIN_VISIBLE = 400;
        if (pendingStartRef.current === 0) return;
        if (elapsed >= MIN_VISIBLE) {
          setOptimisticProcessing(false);
        } else {
          setTimeout(() => setOptimisticProcessing(false), Math.max(50, MIN_VISIBLE - elapsed));
        }
      }
    };
    window.addEventListener('svmai-pending-change', handler);
    handler();
    return () => window.removeEventListener('svmai-pending-change', handler);
  }, [optimisticProcessing]);

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
            const noteContent = message.content.trim();
            const noteId = `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const knowledgeNote: Note = {
              id: noteId,
              content: noteContent,
              author: 'assistant',
              timestamp: Date.now()
            };
            onAddNote(knowledgeNote);
            setActionNotice('Message saved to knowledge base');
            track('message_action', {
              action,
              feature: 'save_knowledge',
              contentLength: noteContent.length,
              tokens: estimateTokens(noteContent)
            });
          } else {
            setActionNotice('Unable to save message to knowledge');
          }
          break;
        case 'share': {
          try {
            const slice = messages.slice(-50).map(m => ({ role: m.role, content: m.content }));
            const payload = {
              v: 1,
              mode,
              ts: Date.now(),
              messages: slice
            };
            const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
            const url = `${window.location.origin}/?ai=1&aichat=${encoded}`;
            window.open(url, '_blank', 'noopener');
            setActionNotice('Share link opened');
            track('message_action', { action, feature: 'share', messagesShared: slice.length });
          } catch (err) {
            console.error('Share failed', err);
            setActionNotice('Share failed');
          }
          break;
        }
        case 'fork': {
          if (!message) {
            setActionNotice('No message to fork');
            break;
          }
            const messageIndex = messages.findIndex(
              (msg) => msg.content === message.content && msg.role === message.role
            );
            if (messageIndex === -1) {
              setActionNotice('Unable to locate message to fork');
              break;
            }
            if (onForkThread) {
              onForkThread(messageIndex, message);
              setActionNotice(`Forked thread at message ${messageIndex + 1}`);
              track('message_action', {
                action,
                feature: 'fork_thread',
                messagesCount: messageIndex + 1,
                messageIndex,
                mode
              });
            } else if (onNewChat) {
              onNewChat();
              setActionNotice('Forked (legacy new chat)');
            } else {
              setActionNotice('Fork unavailable (no handler)');
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
  }, [onAddNote, onForkThread, onNewChat, messages, mode]);

  // Clear action notice timer cleanup
  useEffect(() => {
    if (actionNotice) {
      const timer = setTimeout(() => setActionNotice(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [actionNotice]);

  // Scroll handling
  const handleScroll = useCallback((scrollTop: number, scrollHeight: number, clientHeight: number) => {
    const threshold = 50;
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - threshold;
    setIsScrolledUp(!isAtBottom);
    setShouldAutoScroll(isAtBottom);
    if (isAtBottom && newMessageCount > 0) {
      setNewMessageCount(0);
    }
  }, [newMessageCount]);

  const handleNewMessageBadgeClick = useCallback(() => {
    scrollToBottom();
    setNewMessageCount(0);
    setShouldAutoScroll(true);
  }, [scrollToBottom]);

  // Track new messages when scrolled up
  useEffect(() => {
    const currentMessageCount = messages.length;
    const previousCount = lastMessageCountRef.current;
    if (currentMessageCount > previousCount && isScrolledUp) {
      setNewMessageCount(prev => prev + (currentMessageCount - previousCount));
    }
    lastMessageCountRef.current = currentMessageCount;
  }, [messages.length, isScrolledUp]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (shouldAutoScroll) {
      scrollToBottom();
    }
  }, [messages, shouldAutoScroll, scrollToBottom]);

  // Memory management high usage cleanup
  useEffect(() => {
    trackMemoryUsage(memoryStats);
    if (needsCleanup && memoryStats.percentUsed > 90) {
      console.warn('Memory usage high, triggering cleanup:', memoryStats);
      const result = performMemoryCleanup();
      if (result.removedCount > 0) {
        console.log(`Cleaned up ${result.removedCount} messages, preserved ${result.preservedImportant} important ones`);
      }
    }
  }, [memoryStats, needsCleanup, performMemoryCleanup]);

  // Scroll to bottom on agentActions or tab change
  useEffect(() => {
    if (shouldAutoScroll) {
      scrollToBottom();
    }
  }, [agentActions, shouldAutoScroll, scrollToBottom]);

  useEffect(() => {
    scrollToBottom();
    setNewMessageCount(0);
    setShouldAutoScroll(true);
  }, [activeTab, scrollToBottom]);

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

  // Message renderer
  const renderMessage = useCallback((message: Message, index: number) => {
    return (
      <article
        key={index}
        className={`group flex w-full ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
        role="article"
        aria-label={`${message.role === 'user' ? 'Your message' : 'AI response'}`}
        data-ai-message-role={message.role === 'user' ? 'user' : 'assistant'}
        tabIndex={0}
      >
        <div className="flex flex-col max-w-[80%]">
          {prefs.showRoleLabels && (
            <span
              className={`text-[10px] font-semibold uppercase tracking-wide mb-1 opacity-70 ${message.role === 'user' ? 'text-blue-300 text-right' : 'text-slate-400 text-left'
                }`}
              data-ai-role-label={message.role}
            >
              {message.role === 'user' ? 'You' : 'Assistant'}
            </span>
          )}
          <div
            className={`relative ${prefs.density === 'compact' ? 'px-3 py-1.5' : 'px-4 py-2'} rounded-lg ${message.role === 'user'
              ? 'bg-slate-800 text-white border border-blue-400/60 shadow-lg shadow-blue-500/10'
              : 'bg-slate-900 text-white border border-slate-600/40 bg-gradient-to-t from-slate-900 to-slate-800/90 shadow-lg'
              }`}
            data-role={message.role}
            style={{ fontSize: `${prefs.fontSize}px` }}
          >
            <div className="prose prose-invert max-w-none" style={{
              '--prose-body': `${prefs.fontSize}px`,
              '--prose-headings': `${Math.min(prefs.fontSize + 4, 20)}px`,
            } as React.CSSProperties}>
              {(() => {
                if (message.role === 'assistant') {
                  const parsed = parseAssistantMessage(message.content);
                  // Fallback: if parsing failed to produce a reasoning object but raw tag exists,
                  // extract first reasoning segment to ensure a visible toggle for E2E reliability.
                  let reasoning = parsed.reasoning;
                  if (!reasoning && typeof message.content === 'string' && message.content.includes('<REASONING>')) {
                    try {
                      const m = message.content.match(/<REASONING>([\s\S]*?)<\/REASONING>/);
                      if (m && m[1] && m[1].trim()) {
                        const text = m[1].trim();
                        reasoning = { text, tokensEst: Math.ceil(text.length / 4) };
                      }
                    } catch { /* noop */ }
                  }
                  return (
                    <>
                      <EnhancedMessageRenderer
                        content={parsed.visible}
                        messageId={`message-${index}`}
                        className="prose prose-invert max-w-none"
                        role={message.role}
                      />
                      {reasoning && (
                        <ReasoningBlock
                          reasoning={reasoning}
                          collapsed={!prefs.showReasoningDefault}
                        />
                      )}
                    </>
                  );
                }
                return (
                  <EnhancedMessageRenderer
                    content={message.content}
                    messageId={`message-${index}`}
                    className="prose prose-invert max-w-none"
                    role={message.role}
                  />
                );
              })()}
            </div>
            <MessageActions
              message={message}
              onAction={handleMessageAction}
              className="opacity-0 group-hover:opacity-100 absolute -top-2 -right-2 transition-opacity z-10"
            />
          </div>
        </div>
      </article>
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
        } catch {}
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
      } catch {}
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
      const rawVal = (inputRef.current?.value || input).trim();
      if (rawVal.startsWith('/') && !rawVal.startsWith('/ref ')) {
        const partial = rawVal.slice(1);
        const suggestions = getContextualSuggestions(partial);
        if (suggestions.length > 0) {
          e.preventDefault();
          const result = completeSlashCommand(rawVal, 0, suggestions, 'tab');
          onInputChange(result.completed);
          setShowSlashHelp(true);
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
            setSlashIndex(0);
            trackSlashUsage(selectedCommand.cmd, 'right');
            requestAnimationFrame(() => {
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
      // Fallback slash autocomplete safeguard:
      // If user typed only a partial or exact slash command (no args, no trailing space)
      // and suggestions UI may not have resolved (debounce race), perform inline completion instead of submitting.
      const rawValue = inputRef.current?.value || input;
      if (/^\/[a-zA-Z]+$/.test(rawValue.trim())) {
        const token = rawValue.trim().slice(1).toLowerCase();
        const match = SLASH_COMMANDS.find(c => c.cmd.startsWith(token));
        if (match) {
          e.preventDefault();
          const completed = `/${match.cmd} `;
          onInputChange(completed);
          setShowSlashHelp(true);
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
            const form = inputRef.current?.closest('form');
            if (form) {
              const evt = new Event('submit', { bubbles: true, cancelable: true });
              form.dispatchEvent(evt);
            } else {
              onSubmit(e as any);
            }
        } catch (error) {
          console.error('Error in Enter key submission:', error);
        }
      }
    }

    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case 'k':
          e.preventDefault();
          onInputChange('');
          break;
        case 'P':
        case 'p':
          // disabled custom context action
          break;
      }
    }

    if (!showSlashHelp && (e.key === 'ArrowUp' || e.key === 'ArrowDown') && !e.shiftKey) {
      const el = inputRef.current;
      if (!el) return;
      const atStart = el.selectionStart === 0 && el.selectionEnd === 0;
      const atEnd = el.selectionStart === el.value.length && el.selectionEnd === el.value.length;
      const allowAnywhere = e.ctrlKey || e.metaKey;
      if (e.key === 'ArrowUp' && (atStart || allowAnywhere)) {
        if (inputHistory.length === 0) return;
        e.preventDefault();
        if (historyIndex === null) {
          setDraftBeforeHistory(el.value);
          const idx = inputHistory.length - 1;
          setHistoryIndex(idx);
          onInputChange(inputHistory[idx]);
        } else if (historyIndex > 0) {
          const idx = historyIndex - 1;
          setHistoryIndex(idx);
          onInputChange(inputHistory[idx]);
        }
        requestAnimationFrame(() => {
          const node = inputRef.current;
          if (node) node.selectionStart = node.selectionEnd = node.value.length;
        });
      } else if (e.key === 'ArrowDown' && (atEnd || allowAnywhere)) {
        if (historyIndex === null) return;
        e.preventDefault();
        if (historyIndex < inputHistory.length - 1) {
          const idx = historyIndex + 1;
          setHistoryIndex(idx);
          onInputChange(inputHistory[idx]);
        } else {
          setHistoryIndex(null);
          onInputChange(draftBeforeHistory);
        }
        requestAnimationFrame(() => {
          const node = inputRef.current;
          if (node) node.selectionStart = node.selectionEnd = node.value.length;
        });
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
            className={prefs.density === 'compact' ? 'p-3' : 'p-4'}
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
    <div className="relative flex-1 min-h-0" data-ai-tab="knowledge" data-ai-knowledge-panel="1">
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

  const isNotesTab = activeTab === 'notes';
  const mainScrollableContent = isNotesTab ? knowledgePanelContent : chatMessagesContent;

  return (
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
        <div className={`flex-1 min-h-0 ${variant === 'sidebar' ? 'bg-black' : 'bg-black/30 backdrop-blur-[2px]'}`}>
          {mainScrollableContent}
        </div>

        {( (variant === 'sidebar' || isE2E) && activeTab === 'agent') && (
          <div className="px-4 pt-3 pb-1 border-t border-white/10 bg-black/60 flex flex-wrap gap-2" role="toolbar" aria-label="Quick actions">
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
                  } catch {}
                }}
                data-ai-quick="context"
                title="Use current page context"
              >
                Context
              </button>
            )}
          </div>
        )}

        <div
          role="status"
            aria-live="polite"
          className={`px-4 py-1 text-[11px] text-white/70 bg-black/60 border-t border-white/10 ${(isProcessing || optimisticProcessing) ? '' : 'opacity-0 h-0 overflow-hidden p-0 border-0'}`}
          data-ai-processing-status
          data-ai-processing-active={(isProcessing || optimisticProcessing) ? '1' : '0'}
        >
          {(isProcessing || optimisticProcessing) ? 'Processing…' : ''}
        </div>

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
          onSubmit={(e) => {
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
            } catch {}
            onSubmit(e);
          }}
          className={`chat-input-area p-4 border-t border-white/20 flex-shrink-0 ${variant === 'sidebar' ? 'bg-black' : 'bg-black/50 backdrop-blur-sm'
            }`}
          role="form"
          aria-label="Send a message"
        >
          <div className="relative">
            {onModeChange && (
              <div className="mb-3">
                <ModeSelector
                  mode={mode}
                  onChange={onModeChange || (() => { })}
                  disabled={isProcessing}
                  className="w-full"
                />
              </div>
            )}

            <label htmlFor="chat-input" className="sr-only">
              Type your message
            </label>
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
                  if (showRef) {
                    setReferenceIndex(0);
                  }
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
              className="w-full bg-black text-white px-4 py-3 pr-16 rounded-lg border border-white/20 focus:outline-none focus:border-white/40 focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2 placeholder-white/50 disabled:opacity-50 resize-none overflow-hidden"
              data-ai-chat-input
              data-testid="message-input"
              style={{ minHeight: '48px', fontSize: `${prefs.fontSize}px` }}
            />
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
                              <span
                                className="text-[10px] opacity-70"
                                title={`For ${cmd.context} pages`}
                              >
                                {badge}
                              </span>
                            )}
                          </div>
                          <div
                            id={`slash-desc-${cmd.cmd}`}
                            className="text-[10px] text-white/60 mt-0.5"
                          >
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

            <button
              onClick={onVoiceRecord}
              disabled={isRecording}
              aria-label={isRecording ? "Stop recording" : "Start voice input"}
              aria-pressed={isRecording}
              className="absolute right-10 top-1/2 -translate-y-1/2 text-white disabled:opacity-50 p-1 hover:bg-white/10 rounded-sm focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
              title={isRecording ? 'Recording...' : 'Start Voice Input'}
              type="button"
            >
              {isRecording ? <Loader className="animate-spin" size={20} /> : <Mic size={20} />}
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
              className="absolute right-20 top-1/2 -translate-y-1/2 text-white disabled:opacity-50 p-1 hover:bg-white/10 rounded-sm focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
            >
              <span className="sr-only">Copy last response</span>
              <Send size={18} className="rotate-[-90deg] opacity-80" />
            </button>

            {copyNotice && (
              <div
                role="status"
                aria-live="polite"
                className="absolute right-24 top-0 -translate-y-full text-[11px] bg-white text-black px-2 py-1 rounded shadow"
                data-ai-toast="copied"
              >
                Copied
              </div>
            )}

            {isProcessing ? (
              <button
                type="button"
                aria-label="Cancel processing"
                onClick={() => onCancel?.()}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white p-1 hover:bg-white/10 rounded-sm focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
              >
                <Loader className="animate-spin" size={16} />
              </button>
            ) : (
              <button
                type="submit"
                aria-label="Send message"
                disabled={isProcessing || !input.trim()}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white disabled:opacity-50 p-1 hover:bg-white/10 rounded-sm focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
              >
                <Send size={16} />
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
