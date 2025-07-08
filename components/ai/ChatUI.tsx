'use client';

import { Loader, Mic, Send, Trash2 } from 'lucide-react';
import type { Message, Note, AgentAction } from '@/lib/ai/types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useEffect, useRef } from 'react';
import { VantaBackground } from './VantaBackground';

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
  isRecording
}: ChatUIProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, agentActions]);

  // Auto-scroll when content changes
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    const observer = new MutationObserver(() => {
      scrollToBottom();
    });

    observer.observe(scrollContainer, {
      childList: true,
      subtree: true,
      characterData: true
    });

    return () => observer.disconnect();
  }, []);

  const renderContent = () => {
    switch (activeTab) {
      case 'notes':
        return (
          <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollContainerRef}>
            {notes.length === 0 ? (
              <div className="text-center text-white/50 mt-8">
                No knowledge entries yet. Start typing to add knowledge.
              </div>
            ) : (
              <>
                <div className="flex justify-between items-center mb-4">
                  <div className="text-[12px] text-white/50">
                    {notes.length} knowledge entr{notes.length !== 1 ? 'ies' : 'y'}
                  </div>
                  <button
                    onClick={onClearNotes}
                    className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-sm"
                    title="Clear all knowledge"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                {notes.map((note) => (
                  <div
                    key={note.id}
                    className="bg-black text-white border border-white/20 rounded-lg p-4 text-[12px]"
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
                    <div className="text-[12px] text-white/50 mt-2">
                      {new Date(note.timestamp).toLocaleString()}
                    </div>
                  </div>
                ))}
              </>
            )}
            <div ref={messagesEndRef} />
          </div>
        );

      case 'agent':
      case 'assistant':
      default:
        return (
          <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollContainerRef}>
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`px-4 py-2 rounded-lg max-w-[80%] text-[12px] ${
                  message.role === 'user' ? 'bg-white text-black' : 'bg-black text-white border border-white/20'
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
              </div>
            ))}
            {agentActions.length > 0 && activeTab === 'agent' && (
              <div className="border border-white/20 rounded-lg p-4 space-y-2">
                <div className="text-[12px] text-white/50 flex items-center justify-between">
                  <span>Actions:</span>
                  <div className="flex gap-2">
                    {agentActions.some(a => a.status === 'completed') && (
                      <span className="text-green-500 flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        {agentActions.filter(a => a.status === 'completed').length} completed
                      </span>
                    )}
                    {agentActions.some(a => a.status === 'in_progress') && (
                      <span className="text-yellow-500 flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                        {agentActions.filter(a => a.status === 'in_progress').length} in progress
                      </span>
                    )}
                    {agentActions.some(a => a.status === 'failed') && (
                      <span className="text-red-500 flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-red-500" />
                        {agentActions.filter(a => a.status === 'failed').length} failed
                      </span>
                    )}
                  </div>
                </div>
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {agentActions.map((action) => (
                    <div
                      key={action.id}
                      className={`flex items-center gap-2 text-[12px] p-2 rounded transition-colors ${
                        action.status === 'in_progress' ? 'bg-white/5' : 'hover:bg-white/5'
                      }`}
                    >
                      <div className={`w-2 h-2 rounded-full ${
                        action.status === 'completed' ? 'bg-green-500' :
                        action.status === 'failed' ? 'bg-red-500' :
                        action.status === 'in_progress' ? 'bg-yellow-500 animate-pulse' :
                        'bg-yellow-500'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-white truncate">{action.description}</div>
                        {action.error && (
                          <div className="text-red-500 text-[11px] mt-1 break-words">
                            {action.error}
                          </div>
                        )}
                      </div>
                      {action.status === 'failed' && (
                        <button 
                          onClick={() => onRetryAction?.(action.id)}
                          className="shrink-0 px-2 py-1 text-[11px] text-white/70 hover:text-white hover:bg-white/10 rounded transition-colors"
                          title="Retry this action"
                        >
                          Retry
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        );
    }
  };

  return (
    <div className="relative h-full">
      <VantaBackground />
      <div className={`flex flex-col h-full relative z-10 ${className}`}>
        <div className="flex-1 overflow-hidden bg-black/30 backdrop-blur-[2px]">
          {renderContent()}
        </div>
        <div className="p-4 border-t border-white/20 bg-black/50 backdrop-blur-sm">
          <div className="relative">
            <div className="relative">
              <textarea
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
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    console.log('Enter pressed, submitting form');
                    try {
                      onSubmit(e);
                    } catch (error) {
                      console.error('Error in Enter key submission:', error);
                    }
                  }
                }}
                placeholder={isProcessing ? "Processing..." : activeTab === 'notes' ? "Add knowledge..." : "Ask a question..."}
                disabled={isProcessing}
                className="w-full bg-black text-white text-[12px] px-4 py-3 pr-16 rounded-lg border border-white/20 focus:outline-none focus:border-white/40 placeholder-white/50 disabled:opacity-50"
              />
            </div>
            <button
              onClick={onVoiceRecord}
              disabled={isRecording}
              className={`absolute right-10 top-1/2 -translate-y-1/2 text-white disabled:opacity-50 p-1 hover:bg-white/10 rounded-smz`}
              title={isRecording ? 'Recording...' : 'Start Voice Input'}
              type="button"
            >
              {isRecording ? <Loader className="animate-spin" size={20} /> : <Mic size={20} />}
            </button>
            <button
              onClick={(e) => {
                e.preventDefault();
                console.log('Send button clicked with input:', input);
                try {
                  onSubmit(e);
                } catch (error) {
                  console.error('Error in send button click:', error);
                }
              }}
              disabled={isProcessing}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white disabled:opacity-50 p-1 hover:bg-white/10 rounded-sm"
              type="button"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
