'use client';

import type { Message, Note, AgentAction } from '@/lib/ai/types';
import { ChatUI } from './ChatUI';
import { ChatLayout } from './layouts/ChatLayout';

export interface ChatProps {
  variant?: 'inline' | 'sidebar' | 'dialog';
  isOpen?: boolean;
  onClose?: () => void;
  className?: string;
  onWidthChange?: (width: number) => void;
  onResizeStart?: () => void;
  onResizeEnd?: () => void;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  onReset?: () => void;
  onNewChat?: () => void;
  messages?: Message[];
  input?: string;
  isProcessing?: boolean;
  onInputChange?: (value: string) => void;
  onSubmit?: (e: React.FormEvent) => void;
  notes?: Note[];
  onClearNotes?: () => void;
  agentActions?: AgentAction[];
  onRetryAction?: (id: string) => void;
  onExport?: () => void;
  onShare?: () => void;
  onSettings?: () => void;
  onHelp?: () => void;
  onExpand?: () => void;
  onVoiceRecord?: () => void;
  isRecording?: boolean;
}

export function Chat({
  variant = 'inline',
  isOpen = true,
  onClose,
  className = '',
  onWidthChange,
  onResizeStart,
  onResizeEnd,
  activeTab = 'agent',
  onTabChange,
  onReset,
  onNewChat,
  messages = [],
  input = '',
  isProcessing = false,
  onInputChange = () => {},
  onSubmit = () => {},
  notes = [],
  onClearNotes,
  agentActions = [],
  onRetryAction,
  onExport,
  onShare,
  onSettings,
  onHelp,
  onExpand,
  onVoiceRecord,
  isRecording
}: ChatProps) {
  return (
    <ChatLayout 
      variant={variant} 
      isOpen={isOpen} 
      className={className}
      onWidthChange={onWidthChange}
      onResizeStart={onResizeStart}
      onResizeEnd={onResizeEnd}
      onClose={onClose}
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
      <ChatUI
        messages={messages}
        input={input}
        isProcessing={isProcessing}
        onInputChange={onInputChange}
        onSubmit={onSubmit}
        onClose={onClose}
        className={variant === 'dialog' ? 'h-[600px]' : undefined}
        activeTab={activeTab}
        notes={notes}
        onClearNotes={onClearNotes}
        agentActions={agentActions}
        onRetryAction={onRetryAction}
        onVoiceRecord={onVoiceRecord}
        isRecording={isRecording}
        variant={variant}
      />
    </ChatLayout>
  );
}
