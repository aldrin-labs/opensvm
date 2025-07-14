import { Loader, Mic, Send, Trash2 } from 'lucide-react';
import type { Message, Note, AgentAction } from '@/lib/ai/types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useEffect, useRef, useState, useCallback } from 'react';
import { VantaBackground } from './VantaBackground';
import { CustomScrollbar } from './CustomScrollbar';
import { NewMessageBadge } from './NewMessageBadge';
import { VirtualizedMessageList } from './VirtualizedMessageList';

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
  notes?: Note[];
  onClearNotes?: () => void;
  agentActions?: AgentAction[];
  onRetryAction?: (id: string) => void;
  showTabs?: boolean;
  onVoiceRecord?: () => void;
  isRecording?: boolean;
  variant?: 'inline' | 'sidebar' | 'dialog';
  enableVirtualization?: boolean;
}

export function ChatUI({
  messages,
  input,
  isProcessing,
  onInputChange,
  onSubmit,
  className = '',
  activeTab = 'agent',
  notes = [],
  onClearNotes,
  agentActions = [],
  onRetryAction,
  onVoiceRecord,
  isRecording,
  variant = 'inline',
  enableVirtualization = true
}: ChatUIProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastMessageCountRef = useRef(0);
  
  // State for new message tracking
  const [newMessageCount, setNewMessageCount] = useState(0);
  const [isScrolledUp, setIsScrolledUp] = useState(false);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }, []);

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

  const renderContent = () => {
    switch (activeTab) {
      case 'notes':
        return (
          <div className="relative flex-1 min-h-0">
            <CustomScrollbar
              onScroll={handleScroll}
              autoScrollToBottom={shouldAutoScroll}
              ariaLabel="Knowledge entries"
            >
              <div className="p-4 space-y-4">
                {notes.length === 0 ? (
                  <div className="text-center text-white/50 mt-8" role="status">
                    No knowledge entries yet. Start typing to add knowledge.
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between items-center mb-4">
                      <div className="text-[12px] text-white/50" aria-live="polite">
                        {notes.length} knowledge entr{notes.length !== 1 ? 'ies' : 'y'}
                      </div>
                      <button
                        onClick={onClearNotes}
                        className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-sm focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
                        title="Clear all knowledge"
                        aria-label="Clear all knowledge entries"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    {notes.map((note, index) => (
                      <article
                        key={note.id}
                        className="bg-black text-white border border-white/20 rounded-lg p-4 text-[12px] focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
                        tabIndex={0}
                        aria-label={`Knowledge entry ${index + 1} of ${notes.length}`}
                      >
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          className="prose prose-invert max-w-none [&_p]:text-[12px] [&_li]:text-[12px] [&_h1]:text-[16px] [&_h2]:text-[15px] [&_h3]:text-[14px] [&_h4]:text-[13px] [&_h5]:text-[12px]"
                          components={{
                            pre: ({ node, ...props }) => (
                              <div className="overflow-auto my-2 bg-white/5 p-2 rounded">
                                <pre {...props} />
                              </div>
                            ),
                            code: ({ node, className, ...props }: any) => (
                              props.inline ?
                                <code className="bg-white/10 rounded px-1" {...props} /> :
                                <code {...props} />
                            ),
                            p: ({ node, ...props }) => (
                              <p className="my-1" {...props} />
                            )
                          }}
                        >
                          {note.content}
                        </ReactMarkdown>
                        <time
                          className="text-[12px] text-white/50 mt-2 block"
                          dateTime={new Date(note.timestamp).toISOString()}
                        >
                          {new Date(note.timestamp).toLocaleString()}
                        </time>
                      </article>
                    ))}
                  </>
                )}
                <div ref={messagesEndRef} aria-hidden="true" />
              </div>
            </CustomScrollbar>
            <NewMessageBadge
              messageCount={newMessageCount}
              isVisible={isScrolledUp && newMessageCount > 0}
              onClick={handleNewMessageBadgeClick}
            />
          </div>
        );

      case 'agent':
      case 'assistant':
      default:
        return (
          <div className="relative flex-1 min-h-0">
            {/* Use traditional scrolling - virtualization temporarily disabled for stability */}
            <div className="relative flex-1 min-h-0">
              <CustomScrollbar
                onScroll={handleScroll}
                autoScrollToBottom={shouldAutoScroll}
                ariaLabel={activeTab === 'agent' ? 'Agent chat messages' : 'Assistant chat messages'}
              >
                <div className="p-4 space-y-4 w-full">
                  {messages.map((message, index) => (
                    <article
                      key={index}
                      className={`flex w-full ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      role="article"
                      aria-label={`${message.role === 'user' ? 'Your message' : 'AI response'}`}
                      tabIndex={0}
                    >
                      <div className={`px-4 py-2 rounded-lg max-w-[80%] text-[12px] ${
                        message.role === 'user' ? 'bg-black text-white border border-white/20' : 'bg-black text-white border border-white/20'
                      }`}>
                        <div className="prose prose-invert max-w-none [&_p]:text-[12px] [&_li]:text-[12px] [&_h1]:text-[16px] [&_h2]:text-[15px] [&_h3]:text-[14px] [&_h4]:text-[13px] [&_h5]:text-[12px]">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              pre: ({ node, ...props }) => (
                                <div className="overflow-auto my-2 bg-white/5 p-2 rounded">
                                  <pre {...props} />
                                </div>
                              ),
                              code: ({ node, className, ...props }: any) => (
                                props.inline ?
                                  <code className="bg-white/10 rounded px-1" {...props} /> :
                                  <code {...props} />
                              ),
                              p: ({ node, ...props }) => (
                                <p className="my-1" {...props} />
                              ),
                              ul: ({ node, ...props }) => (
                                <ul className="list-disc pl-4 space-y-1" {...props} />
                              ),
                              li: ({ node, ...props }) => (
                                <li className="text-[12px]" {...props} />
                              )
                            }}
                          >
                            {message.content}
                          </ReactMarkdown>
                        </div>
                      </div>
                    </article>
                  ))}
                  
                  {/* Processing indicator */}
                  {isProcessing && (
                    <div
                      role="status"
                      aria-live="assertive"
                      className="flex justify-center"
                    >
                      <div className="bg-black text-white border border-white/20 px-4 py-2 rounded-lg">
                        <span className="animate-pulse">Processing...</span>
                      </div>
                    </div>
                  )}
                  
                  {/* Agent actions section */}
                  {agentActions.length > 0 && activeTab === 'agent' && (
                    <div
                      className="border border-white/20 rounded-lg p-4 space-y-2"
                      role="region"
                      aria-label="Agent actions"
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
                            className={`flex items-center gap-2 text-[12px] p-2 rounded transition-colors ${
                              action.status === 'in_progress' ? 'bg-white/5' : 'hover:bg-white/5'
                            }`}
                            role="listitem"
                            aria-label={`Action: ${action.description}, Status: ${action.status}`}
                          >
                            <div
                              className={`w-2 h-2 rounded-full ${
                                action.status === 'completed' ? 'bg-green-500' :
                                action.status === 'failed' ? 'bg-red-500' :
                                action.status === 'in_progress' ? 'bg-yellow-500 animate-pulse' :
                                'bg-yellow-500'
                              }`}
                              aria-hidden="true"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="text-white truncate">{action.description}</div>
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
                </div>
              </CustomScrollbar>
              <NewMessageBadge
                messageCount={newMessageCount}
                isVisible={isScrolledUp && newMessageCount > 0}
                onClick={handleNewMessageBadgeClick}
              />
            </div>
          </div>
        );
    }
  };

  // Announce new messages to screen readers
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      const announcement = `${lastMessage.role === 'user' ? 'You' : 'AI Assistant'} said: ${lastMessage.content.substring(0, 100)}`;
      
      // Create temporary live region for announcement
      const liveRegion = document.createElement('div');
      liveRegion.setAttribute('role', 'status');
      liveRegion.setAttribute('aria-live', 'polite');
      liveRegion.className = 'sr-only';
      liveRegion.textContent = announcement;
      
      document.body.appendChild(liveRegion);
      
      // Remove after announcement
      setTimeout(() => {
        document.body.removeChild(liveRegion);
      }, 1000);
    }
  }, [messages]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      console.log('Enter pressed, submitting form');
      try {
        onSubmit(e as any);
      } catch (error) {
        console.error('Error in Enter key submission:', error);
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
      }
    }
  };

  return (
    <div className={`chat-main-container relative h-full ${variant === 'dialog' ? 'max-h-[600px]' : 'h-screen'} flex flex-col overflow-hidden`}>
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
        <div className={`flex-1 min-h-0 ${
          variant === 'sidebar' ? 'bg-black' : 'bg-black/30 backdrop-blur-[2px]'
        }`}>
          {renderContent()}
        </div>
        
        {/* Input area with accessibility */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(e);
          }}
          className={`chat-input-area p-4 border-t border-white/20 flex-shrink-0 ${
            variant === 'sidebar' ? 'bg-black' : 'bg-black/50 backdrop-blur-sm'
          }`}
          role="form"
          aria-label="Send a message"
        >
          <div className="relative">
            <label htmlFor="chat-input" className="sr-only">
              Type your message
            </label>
            <textarea
              id="chat-input"
              value={input}
              onChange={(e) => {
                const value = e.target.value;
                console.log('Input changed:', value);
                try {
                  onInputChange(value);
                } catch (error) {
                  console.error('Error in input change:', error);
                }
              }}
              onKeyDown={handleKeyDown}
              placeholder={isProcessing ? "Processing..." : activeTab === 'notes' ? "Add knowledge..." : "Ask a question..."}
              disabled={isProcessing}
              aria-disabled={isProcessing}
              aria-describedby="input-help"
              className="w-full bg-black text-white text-[12px] px-4 py-3 pr-16 rounded-lg border border-white/20 focus:outline-none focus:border-white/40 focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2 placeholder-white/50 disabled:opacity-50 resize-none"
              data-ai-chat-input
              rows={1}
            />
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
            
            <button
              type="submit"
              aria-label="Send message"
              disabled={isProcessing || !input.trim()}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white disabled:opacity-50 p-1 hover:bg-white/10 rounded-sm focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
            >
              <Send size={16} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
