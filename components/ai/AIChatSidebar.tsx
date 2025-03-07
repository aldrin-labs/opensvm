'use client';

import { useEffect, useState, useCallback, memo, useRef, Suspense } from 'react';
import { Chat } from './Chat';
import { useAIChatTabs } from '@/lib/ai/hooks/useAIChatTabs';
import { createSolanaAgent } from '@/lib/ai/core/factory';
import type { Message } from '@/lib/ai/types';
import { SolanaAgent } from '@/lib/ai/core/agent';
import { generateAndShareScreenshot } from '@/lib/ai/utils/screenshot'; 
import { connectionPool } from '@/lib/solana-connection';

export interface AIChatSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onWidthChange: (width: number) => void;
  onResizeStart: () => void;
  onResizeEnd: () => void;
  initialWidth: number;
}

export const AIChatSidebar = memo(function AIChatSidebar({ 
  isOpen, 
  onClose, 
  onWidthChange,
  onResizeStart,
  onResizeEnd,
  initialWidth = 400 
}: AIChatSidebarProps) {
  const [isResizing, setIsResizing] = useState(false);
  const isResizingRef = useRef(false); // Add the missing ref
  const [width, setWidth] = useState(initialWidth);
  const [agent, setAgent] = useState<SolanaAgent | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // Update the ref when state changes
  useEffect(() => {
    isResizingRef.current = isResizing;
  }, [isResizing]);

  useEffect(() => {
    const init = async () => {
      try {
        const connection = await connectionPool.getConnection();
        const newAgent = createSolanaAgent(connection, {
          enableSonicKit: true,
          enableSolanaAgentKit: true
        });
        setAgent(newAgent);
      } catch (error) {
        console.error('Failed to initialize agent:', error);
      } finally {
        setIsInitializing(false);
      }
    };
    init();
  }, []);

  const {
    activeTab,
    setActiveTab,
    messages,
    input,
    isProcessing,
    setInput,
    handleSubmit: originalHandleSubmit,
    handleNewChat,
    notes,
    agentActions,
    clearNotes,
    resetEverything,
    retryAction,
    setAgentMessages,
    startRecording,
    isRecording
  } = useAIChatTabs({ 
    agent: agent || createSolanaAgent({} as any, {
      enableSonicKit: true,
      enableSolanaAgentKit: true
    }) });

  const handleSubmit = async (e: React.FormEvent) => {
    try {
      console.log('Submitting message:', input);
      await originalHandleSubmit(e);
    } catch (error) {
      console.error('Error in handleSubmit:', error);
    }
  };

  const handleWidthChange = useCallback((newWidth: number) => {
    setWidth(newWidth);
    onWidthChange(newWidth);
  }, [onWidthChange]);

  const handleReset = useCallback(() => {
    resetEverything();
  }, [resetEverything]);

  const handleRetryAction = useCallback((id: string) => {
    retryAction(id);
  }, [retryAction]);

  const handleExport = useCallback(() => {
    try {
      // Get all messages from the chat
      const messages = Array.from(document.querySelectorAll('.px-4.py-2.rounded-lg'))
        .map(div => {
          const isUser = div.parentElement?.classList.contains('justify-end');
          const content = div.textContent || '';
          return content ? `${isUser ? 'You' : 'Assistant'}: ${content}\n\n` : '';
        })
        .filter(Boolean)
        .join('');

      if (!messages) {
        console.error('No messages found to export');
        return;
      }

      // Add header and timestamp
      const textContent = `OpenSVM Chat Export\n` +
        `Generated on: ${new Date().toLocaleString()}\n\n` +
        `${messages}`;

      // Create and download text file
      const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `opensvm-chat-${new Date().toISOString().split('T')[0]}.txt`;
      
      // Trigger download
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);

      console.log('Chat exported successfully');
    } catch (error) {
      console.error('Error exporting chat:', error);
    }
  }, []);

  const handleShare = useCallback(async () => {
    try {
      // Create a temporary container for the screenshot
      const screenshotContainer = document.createElement('div');
      screenshotContainer.style.position = 'absolute';
      screenshotContainer.style.left = '-9999px';
      screenshotContainer.style.width = '800px'; // Fixed width for consistent screenshots
      screenshotContainer.style.backgroundColor = '#000';
      document.body.appendChild(screenshotContainer);

      // Clone the chat content
      const chatContent = document.querySelector('.overflow-y-auto');
      if (!chatContent) return;

      const clone = chatContent.cloneNode(true) as HTMLElement;
      // Remove any unnecessary elements from the clone
      clone.querySelectorAll('button').forEach(btn => btn.remove());
      
      // Style the clone for screenshot
      clone.style.padding = '20px';
      clone.style.width = '100%';
      clone.style.height = 'auto';
      clone.style.overflow = 'visible';
      clone.style.backgroundColor = '#000';
      clone.style.color = '#fff';

      screenshotContainer.appendChild(clone);

      // Generate and share screenshot
      await generateAndShareScreenshot(
        screenshotContainer,
        "checkout new explorer: opensvm.com $SVMAI"
      );

      // Cleanup
      document.body.removeChild(screenshotContainer);
    } catch (error) {
      console.error('Error sharing:', error);
    }
  }, []);

  const handleSettings = useCallback(() => {
    // Open settings modal/panel
    console.log('Open settings');
  }, []);

  const handleHelp = useCallback(() => {
    // Add help message to chat
    const helpMessage: Message = {
      role: 'assistant',
      content: `### Solana Blockchain Assistant Help

Here are some things I can help you with:

1. **Transaction Analysis**
   - Get transaction details
   - Track token transfers
   - Monitor program interactions

2. **Account Information**
   - Check wallet balances
   - View token holdings
   - Track account activity

3. **Program Monitoring**
   - Track program usage
   - Monitor smart contract interactions
   - Analyze program statistics

4. **PumpFun Integration**
   - Monitor token prices
   - Track bonding curves
   - Execute trades
   - Listen for price updates

5. **Sonic Protocol Integration**
   - Interact with Sonic pools
   - Query Sonic protocol data
   - Explore Sonic protocol features

6. **Advanced Solana Operations**
   - Trade tokens
   - Launch new tokens
   - Lend assets
   - Send compressed airdrops
   - Execute blinks

To get started, just ask me anything about Solana blockchain data, Sonic protocols, or PumpFun trading!`
    };
    setAgentMessages(prev => [...prev, helpMessage]);
  }, [setAgentMessages]);

  // Optimize resize event handling
  useEffect(() => {
    if (!isOpen) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return;
      
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth > 300 && newWidth < 800) {
        setWidth(newWidth);
        onWidthChange(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      onResizeEnd();
    };

    // Only add listeners when resizing
    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove, { passive: true });
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, onWidthChange, onResizeEnd, isOpen]);

  if (!isOpen) return null;
  
  if (isInitializing) {
    return (
      <div style={{ width: `${width}px` }} className="bg-black text-white p-4">
        Initializing AI Assistant...
      </div>
    );
  }

  if (!agent) {
    return (
      <div style={{ width: `${width}px` }} className="bg-black text-white p-4">
        Failed to initialize AI Assistant. Please try again.
      </div>
    );
  }

  return (
    <div style={{ width: `${width}px` }}>
      <Suspense fallback={<div className="bg-black text-white p-4">Loading chat interface...</div>}>
        <Chat 
          variant="sidebar" 
          isOpen={isOpen}
          onClose={onClose}
          onWidthChange={handleWidthChange}
          onResizeStart={onResizeStart}
          onResizeEnd={onResizeEnd}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onReset={handleReset}
          onNewChat={handleNewChat}
          messages={messages}
          input={input}
          isProcessing={isProcessing}
          onInputChange={setInput}
          onSubmit={handleSubmit}
          notes={notes}
          onClearNotes={clearNotes}
          agentActions={agentActions}
          onRetryAction={handleRetryAction}
          onExport={handleExport}
          onShare={handleShare}
          onSettings={handleSettings}
          onHelp={handleHelp}
          onVoiceRecord={startRecording}
          isRecording={isRecording}
          className="transition-transform duration-200"
        />
      </Suspense>
    </div>
  );
});