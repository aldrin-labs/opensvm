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
import { completeSlashCommand, trackSlashUsage, getContextualSuggestions, getContextBadge } from './utils/slashCommands';
import { useMemoryManagement, trackMemoryUsage } from './utils/memoryManager';
import { useUIPreferences } from './hooks/useUIPreferences';
import { useAutosizeTextarea } from '../../hooks/useAutosizeTextarea';

interface ChatUIProps {
  messages: Message[];
  input: string;
  isProcessing: boolean;
  onInputChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose?: () => void;
  onNewChat?: () => void;
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
  const [height, setHeight] = useState(400);

  useEffect(() => {
    const el = containerRef.current?.parentElement; // parent flex item
    if (!el) return;
    const obs = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      // Leave ~140px for input / actions area; clamp min 240
      setHeight(Math.max(240, rect.height - 140));
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Simple auto-scroll on new messages
  useEffect(() => {
    if (autoScrollToBottom && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages.length, autoScrollToBottom]);

  return (
    <div
      ref={containerRef}
      className={`overflow-y-auto w-full ${density === 'compact' ? 'p-3 space-y-2' : 'p-4 space-y-4'}`}
      style={{ height }}
      onScroll={(e) => {
        const t = e.currentTarget;
        onScroll?.(t.scrollTop, t.scrollHeight, t.clientHeight);
      }}
      data-dynamic-height
    >
      {messages.map((m, i) => (
        <div key={i}>{renderMessage(m, i)}</div>
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
  onVoiceRecord,
  isRecording,
  variant = 'inline',
  onCancel
}: ChatUIProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastMessageCountRef = useRef(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { registerInputController } = useAIChatSidebar();
  const { openWithPrompt } = useAIChatSidebar();
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
  // removed unused referenceQuery state (was previously for filtering)

  // Phase 1.1: UI Preferences for density mode
  const { prefs } = useUIPreferences();
  const { textareaRef } = useAutosizeTextarea(input, { maxRows: 6, minRows: 1 });

  // Phase 3.3: Memory Management
  const { stats: memoryStats, shouldCleanup: needsCleanup } = useMemoryManagement(
    messages,
    {
      maxMessages: 500,
      maxTokens: 25000,
      retentionRatio: 0.7,
      preserveRecent: 30
    },
    true // enabled
  );

  // Reintroduce helpers lost during merge (simplified)
  const getSlashContext = useCallback(() => {
    if (!input.startsWith('/') || input.startsWith('/ref ')) {
      return { raw: input, trimmed: input.trim(), afterSlash: input.trim(), firstToken: '', suggestions: [] as any[] };
    }

    const query = input.slice(1); // Remove the leading slash
    const suggestions = getContextualSuggestions(query);

    return {
      raw: input,
      trimmed: input.trim(),
      afterSlash: query,
      firstToken: query.split(' ')[0] || '',
      suggestions
    };
  }, [input]);

  // Reference autocomplete logic
  const getReferenceContext = useCallback(() => {
    if (!input.startsWith('/ref ')) {
      return { isActive: false, query: '', filteredNotes: [] };
    }

    const query = input.slice(5); // Remove '/ref '

    console.log('Filtering notes with query:', JSON.stringify(query), 'Notes available:', notes.length);

    const filteredNotes = query.trim() === ''
      ? notes // Show all notes when query is empty
      : notes.filter(note =>
        note.content.toLowerCase().includes(query.toLowerCase()) ||
        note.author.toLowerCase().includes(query.toLowerCase())
      );

    console.log('Filtered notes result:', filteredNotes.length);

    return { isActive: true, query, filteredNotes };
  }, [input, notes]);

  // referenceContext inline usage only; previously unused variable removed

  // Debug: Log when notes change in ChatUI
  useEffect(() => {
    // Notes received successfully
  }, [notes]);

  useEffect(() => {
    registerInputController({
      setInput: onInputChange,
      focusInput: () => inputRef.current?.focus(),
      submit: () => {
        try {
          // Set optimistic flag immediately; real tab state will clear it when done
          setOptimisticProcessing(true);
          // Create a synthetic submit event and call onSubmit
          const form = inputRef.current?.closest('form');
          if (form) {
            const event = new Event('submit', { bubbles: true, cancelable: true });
            form.dispatchEvent(event);
          } else {
            // Fallback invoke
            onSubmit({ preventDefault: () => { /* noop */ } } as unknown as React.FormEvent);
          }
        } catch (err) {
          console.error('Programmatic submit failed:', err);
        }
      }
    });
  }, [registerInputController, onInputChange]);

  // Clear optimistic flag once real processing flag appears or disappears
  useEffect(() => {
    if (isProcessing) {
      // Real processing started; keep flag true
      setOptimisticProcessing(true);
    } else if (optimisticProcessing) {
      // Allow a small delay to ensure status element removal after agent finishes
      const t = setTimeout(() => setOptimisticProcessing(false), 50);
      return () => clearTimeout(t);
    }
  }, [isProcessing, optimisticProcessing]);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }, []);

  // Phase 2.3: Message action handler for knowledge management
  const handleMessageAction = useCallback(async (action: MessageActionType, message: Message) => {
    try {
      switch (action) {
        case 'copy':
          await navigator.clipboard.writeText(message.content);
          setActionNotice('Message copied to clipboard');
          track('message_action', { action, messageLength: message.content.length });
          break;
        case 'save':
          // Save assistant message to knowledge base
          if (message && message.role === 'assistant' && onAddNote) {
            const noteContent = message.content.trim();
            const noteId = `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

            // Create knowledge entry from message
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
        case 'share':
          setActionNotice('Share feature coming soon');
          track('message_action', { action, feature: 'share' });
          break;
        case 'fork':
          // Phase 2.2.4: Implement Fork Thread
          if (message && onNewChat) {
            // Find the index of the current message
            const messageIndex = messages.findIndex((msg) =>
              msg.content === message.content && msg.role === message.role
            );

            if (messageIndex !== -1) {
              // Create a new conversation with messages up to and including the selected message
              const forkedMessages = messages.slice(0, messageIndex + 1);

              // For now, we'll create a new chat and show a notice
              // In Phase 3, this would create a proper thread
              onNewChat();

              // If there's a way to set initial messages, we could do:
              // onNewChat(forkedMessages);

              setActionNotice(`Forked thread with ${forkedMessages.length} messages`);
              track('message_action', {
                action,
                feature: 'fork_thread',
                messagesCount: forkedMessages.length,
                messageIndex
              });
            } else {
              setActionNotice('Unable to fork thread');
            }
          } else {
            setActionNotice('Fork thread feature requires new chat capability');
          }
          break;
        case 'site-search':
          const searchQuery = encodeURIComponent(message.content.slice(0, 100));
          window.open(`/search?q=${searchQuery}`, '_blank');
          track('message_action', { action, feature: 'site_search' });
          break;
        case 'web-search':
          const webQuery = encodeURIComponent(message.content.slice(0, 100));
          window.open(`https://www.google.com/search?q=${webQuery}`, '_blank');
          track('message_action', { action, feature: 'web_search' });
          break;
      }
    } catch (error) {
      console.error('Message action failed:', error);
      setActionNotice('Action failed');
    }

    // Clear notice after 3 seconds
    setTimeout(() => setActionNotice(''), 3000);
  }, [onAddNote]);

  // Clear action notice
  useEffect(() => {
    if (actionNotice) {
      const timer = setTimeout(() => setActionNotice(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [actionNotice]);

  // Handle scroll position changes
  const handleScroll = useCallback((scrollTop: number, scrollHeight: number, clientHeight: number) => {
    const threshold = 50;
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - threshold;

    setIsScrolledUp(!isAtBottom);
    setShouldAutoScroll(isAtBottom);

    // Clear new message count when scrolling to bottom
    if (isAtBottom && newMessageCount > 0) {
      setNewMessageCount(0);
    }
  }, [newMessageCount]);

  // Handle new message badge click
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

  // Auto-scroll to bottom when messages change (if enabled)
  useEffect(() => {
    if (shouldAutoScroll) {
      scrollToBottom();
    }
  }, [messages, shouldAutoScroll, scrollToBottom]);

  // Phase 3.3: Memory management tracking and automatic cleanup
  useEffect(() => {
    trackMemoryUsage(memoryStats);

    if (needsCleanup && memoryStats.percentUsed > 90) {
      console.warn('Memory usage high, triggering cleanup:', memoryStats);

      // Auto-cleanup when memory usage is very high
      const { cleanup } = useMemoryManagement(messages, {
        maxMessages: 500,
        maxTokens: 25000,
        retentionRatio: 0.7,
        preserveRecent: 30
      }, true);

      const result = cleanup();
      if (result.removedCount > 0) {
        console.log(`Cleaned up ${result.removedCount} messages, preserved ${result.preservedImportant} important ones`);
        // Note: In a real implementation, this would trigger a messages update through the parent component
        // For now, we just log the cleanup action since we don't have direct message mutation control
      }
    }
  }, [memoryStats, needsCleanup, messages]);


  // Scroll to bottom when agent actions change
  useEffect(() => {
    if (shouldAutoScroll) {
      scrollToBottom();
    }
  }, [agentActions, shouldAutoScroll, scrollToBottom]);

  // Scroll to bottom when switching tabs
  useEffect(() => {
    scrollToBottom();
    setNewMessageCount(0);
    setShouldAutoScroll(true);
  }, [activeTab, scrollToBottom]);

  // Phase 3.1: Message renderer for virtualization
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
          {/* Role Label */}
          {prefs.showRoleLabels && (
            <span
              className={`text-[10px] font-semibold uppercase tracking-wide mb-1 opacity-70 ${message.role === 'user' ? 'text-blue-300 text-right' : 'text-slate-400 text-left'
                }`}
              data-ai-role-label={message.role}
            >
              {message.role === 'user' ? 'You' : 'Assistant'}
            </span>
          )}

          <div className={`relative ${prefs.density === 'compact' ? 'px-3 py-1.5' : 'px-4 py-2'} rounded-lg ${message.role === 'user'
            ? 'bg-slate-800 text-white border border-blue-400/60 shadow-lg shadow-blue-500/10'
            : 'bg-slate-900 text-white border border-slate-600/40 bg-gradient-to-t from-slate-900 to-slate-800/90 shadow-lg'
            }`} data-role={message.role} style={{ fontSize: `${prefs.fontSize}px` }}>
            <div className="prose prose-invert max-w-none" style={{
              '--prose-body': `${prefs.fontSize}px`,
              '--prose-headings': `${Math.min(prefs.fontSize + 4, 20)}px`,
            } as React.CSSProperties}>
              {(() => {
                // Parse reasoning for assistant messages (Phase 2.1.4)
                if (message.role === 'assistant') {
                  const parsed = parseAssistantMessage(message.content);

                  return (
                    <>
                      <EnhancedMessageRenderer
                        content={parsed.visible}
                        messageId={`message-${index}`}
                        className="prose prose-invert max-w-none"
                        role={message.role}
                      />
                      {parsed.reasoning && (
                        <ReasoningBlock
                          reasoning={parsed.reasoning}
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

            {/* Enhanced Message Actions (Phase 2.2) */}
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

  // Phase 2.3: Promote to context handler
  const getPromoteToContextHandler = useCallback(() => {
    return (noteId: string, content: string) => {
      // Add the note content to the input field for user to review and send
      const contextText = `[Reference]: ${content}\n\n`;
      onInputChange(contextText);

      track('knowledge_action', {
        action: 'promote_to_context',
        noteId,
        noteTokens: estimateTokens(content)
      });
    };
  }, [onInputChange]);

  const renderContent = () => {
    switch (activeTab) {
      case 'notes':
        return (
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

      case 'agent':
      case 'assistant':
      default: {
        return (
          <div className="relative flex-1 min-h-0" data-ai-tab="chat">
            <DynamicHeightMessageArea
              messages={messages}
              renderMessage={renderMessage}
              onScroll={handleScroll}
              autoScrollToBottom={shouldAutoScroll}
              density={prefs.density}
            />
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
      }
    };

    // Announce new messages to screen readers
    useEffect(() => {
      if (messages.length > 0) {
        const lastMessage = messages[messages.length - 1];
        const announcement = `${lastMessage.role === 'user' ? 'You' : 'AI Assistant'} said: ${lastMessage.content.substring(0, 100)}`;

        // Create temporary live region for announcement (only on client side)
        if (typeof document !== 'undefined') {
          const liveRegion = document.createElement('div');
          liveRegion.setAttribute('role', 'status');
          liveRegion.setAttribute('aria-live', 'polite');
          liveRegion.className = 'sr-only';
          liveRegion.textContent = announcement;

          document.body.appendChild(liveRegion);

          // Remove after announcement
          setTimeout(() => {
            if (document.body.contains(liveRegion)) {
              document.body.removeChild(liveRegion);
            }
          }, 1000);
        }
      }
    }, [messages]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Ctrl+Shift+K: Clear input (Phase 1.3.3)
      if (e.ctrlKey && e.shiftKey && e.key === 'K') {
        e.preventDefault();
        onInputChange('');
        // Announce for screen readers
        try {
          const announcement = document.createElement('div');
          announcement.setAttribute('aria-live', 'polite');
          announcement.setAttribute('aria-atomic', 'true');
          announcement.className = 'sr-only';
          announcement.textContent = 'Input cleared';
          document.body.appendChild(announcement);
          setTimeout(() => document.body.removeChild(announcement), 1000);
        } catch (error) {
          // Ignore announcement errors
        }
        return;
      }

      // Esc cancels current processing
      if (e.key === 'Escape' && isProcessing) {
        e.preventDefault();
        onCancel?.();
        return;
      }

      // Handle reference autocomplete navigation
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
            // Replace input with note content or reference
            const notePreview = selectedNote.content.length > 100
              ? selectedNote.content.substring(0, 100) + '...'
              : selectedNote.content;
            onInputChange(`Referenced note: "${notePreview}" `);
            setShowReferenceAutocomplete(false);
            setReferenceIndex(0);
            // referenceQuery removed
          }
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          setShowReferenceAutocomplete(false);
          setReferenceIndex(0);
          // referenceQuery removed
          return;
        }
      }

      // Phase 2.4: Enhanced slash completion navigation
      if (showSlashHelp) {
        const slashContext = getSlashContext();
        const { suggestions } = slashContext;

        // Phase 2.4.2: Tab completion
        if (e.key === 'Tab' && !e.shiftKey && suggestions.length > 0) {
          e.preventDefault();
          const selectedCommand = suggestions[Math.min(slashIndex, suggestions.length - 1)];
          const result = completeSlashCommand(input, Math.min(slashIndex, suggestions.length - 1), suggestions, 'tab');

          onInputChange(result.completed);
          setSlashIndex(0);

          // Phase 2.4.4: Track usage
          trackSlashUsage(selectedCommand.cmd, 'tab');

          requestAnimationFrame(() => {
            const el = inputRef.current;
            if (el) el.selectionStart = el.selectionEnd = el.value.length;
          });
          return;
        }

        // Phase 2.4.2: Right arrow completion  
        if (e.key === 'ArrowRight' && suggestions.length > 0) {
          const el = inputRef.current;
          if (el && el.selectionStart === el.value.length && el.selectionEnd === el.value.length) {
            e.preventDefault();
            const selectedCommand = suggestions[Math.min(slashIndex, suggestions.length - 1)];
            const result = completeSlashCommand(input, Math.min(slashIndex, suggestions.length - 1), suggestions, 'right');

            onInputChange(result.completed);
            setSlashIndex(0);

            // Phase 2.4.4: Track usage
            trackSlashUsage(selectedCommand.cmd, 'right');

            requestAnimationFrame(() => {
              if (el) el.selectionStart = el.selectionEnd = el.value.length;
            });
            return;
          }
        }

        // Enhanced Enter handling
        if (e.key === 'Enter' && !e.shiftKey && suggestions.length > 0) {
          const selectedCommand = suggestions[Math.min(slashIndex, suggestions.length - 1)];
          const result = completeSlashCommand(input, Math.min(slashIndex, suggestions.length - 1), suggestions, 'enter');

          if (!result.shouldSubmit) {
            e.preventDefault();
            onInputChange(result.completed);
            setSlashIndex(0);

            // Phase 2.4.4: Track usage
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
        e.preventDefault();
        if (!isProcessing) {
          console.log('Enter pressed, submitting form');
          try {
            // Prefer dispatching a real submit event so form onSubmit handles history/resets
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

      // Additional keyboard shortcuts
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'k':
            // Clear input
            e.preventDefault();
            onInputChange('');
            break;
          case 'P':
          case 'p': {
            // Context prompt disabled (no pageContext)
            break;
          }
        }
      }

      // History navigation when caret at boundaries and not in slash mode
      if (!showSlashHelp && (e.key === 'ArrowUp' || e.key === 'ArrowDown') && !e.shiftKey) {
        const el = inputRef.current;
        if (!el) return;
        const atStart = el.selectionStart === 0 && el.selectionEnd === 0;
        const atEnd = el.selectionStart === el.value.length && el.selectionEnd === el.value.length;

        const allowAnywhere = e.ctrlKey || e.metaKey; // power users: Ctrl/Cmd+Arrow to navigate history from anywhere

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

    return (
      <div className={`chat-main-container relative ${variant === 'sidebar' ? 'h-full' : variant === 'dialog' ? 'max-h-[600px]' : 'h-screen'} flex flex-col ${variant === 'sidebar' ? '' : 'overflow-hidden'}`}>
        {/* Skip navigation link */}
        <a href="#chat-input" className="skip-link absolute top-0 left-0 bg-black text-white p-2 -translate-y-full focus:translate-y-0 transition-transform">
          Skip to chat input
        </a>

        {variant !== 'sidebar' && <VantaBackground />}

        <div
          className={`chat-flex-container flex flex-col flex-1 min-h-0 relative z-10 ${className}`}
          role="region"
          aria-label="AI Chat Interface"
        >
          <div className={`flex-1 min-h-0 ${variant === 'sidebar' ? 'bg-black' : 'bg-black/30 backdrop-blur-[2px]'
            }`}>
            {renderContent()}
          </div>

          {/* Quick actions for common prompts (sidebar/agent tab only) */}
          {variant === 'sidebar' && activeTab === 'agent' && (
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
              {/* Context-dependent quick actions temporarily disabled */}
            </div>
          )}

          {/* Processing status for screen readers and tests */}
          {(isProcessing || optimisticProcessing) && (
            <div role="status" aria-live="polite" className="px-4 py-1 text-[11px] text-white/70 bg-black/60 border-t border-white/10" data-ai-processing-status>
              Processing…
            </div>
          )}

          {/* Phase 2.3: Action notice display */}
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

          {/* Input area with accessibility */}
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
              } catch { /* noop */ }
              onSubmit(e);
            }}
            className={`chat-input-area p-4 border-t border-white/20 flex-shrink-0 ${variant === 'sidebar' ? 'bg-black' : 'bg-black/50 backdrop-blur-sm'
              }`}
            role="form"
            aria-label="Send a message"
          >
            <div className="relative">
              {/* Mode Selector - show if onModeChange is provided */}
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
                  // Set both refs to the same element
                  (inputRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
                  (textareaRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
                }}
                value={input}
                onChange={(e) => {
                  const value = e.target.value;
                  console.log('Input changed:', value);
                  try {
                    onInputChange(value);

                    // Handle regular slash commands
                    const showSlash = value.trim().startsWith('/') && !value.startsWith('/ref ');
                    setShowSlashHelp(showSlash);
                    if (showSlash) setSlashIndex(0);

                    // Handle reference autocomplete
                    const showRef = value.startsWith('/ref ');
                    setShowReferenceAutocomplete(showRef);
                    if (showRef) {
                      setReferenceIndex(0);
                      // referenceQuery removed (value.slice(5))
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
                  const active = Math.min(slashIndex, Math.max(0, suggestions.length - 1));
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
                    {/* Phase 2.4.1: Enhanced display with descriptions */}
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

                              // Phase 2.4.4: Track click usage
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
                      {/* Context indicator disabled */}
                    </div>
                  </div>
                );
              })()}

              {/* Reference autocomplete panel */}
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
                                // referenceQuery removed
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
                className={`absolute right-10 top-1/2 -translate-y-1/2 text-white disabled:opacity-50 p-1 hover:bg-white/10 rounded-sm focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2`}
                title={isRecording ? 'Recording...' : 'Start Voice Input'}
                type="button"
              >
                {isRecording ? <Loader className="animate-spin" size={20} /> : <Mic size={20} />}
              </button>

              {/* Copy last assistant response for convenience */}
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
                {/* Use Send icon rotated as a simple clipboard placeholder to avoid new deps */}
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
}
