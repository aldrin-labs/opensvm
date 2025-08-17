'use client';

import type { Message, Note, AgentAction } from './types';
import type { ChatTab, ChatMode } from './hooks/useChatTabs';
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
  initialWidth?: number;
  // New tab system props
  tabs?: ChatTab[];
  activeTabId?: string | null;
  onTabClick?: (tabId: string) => void;
  onTabClose?: (tabId: string) => void;
  onNewTab?: () => void;
  onTabRename?: (tabId: string, name: string) => void;
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
  onCancel
}: ChatProps) {
  return (
    <ChatLayout
      variant={variant}
      isOpen={isOpen}
      className={className}
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
        onVoiceRecord={onVoiceRecord}
        isRecording={isRecording}
        variant={variant}
        onCancel={onCancel}
      />
    </ChatLayout>
  );
}
