'use client';

import { FC, ReactNode, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Connection } from '@solana/web3.js';
import { createSolanaAgent } from '@/lib/ai/core/factory';
import { AIChat } from './AIChat';

// Initialize Solana connection
const connection = new Connection(
  process.env.NEXT_PUBLIC_RPC_URL || 'https://api.mainnet-beta.solana.com'
);

// Create Solana agent with AI agent enabled
const agent = createSolanaAgent(connection, {
  enableSolanaAIAgent: true
});

interface AIChatSidebarProps {
  isOpen: boolean;
  onClose?: () => void;
  onWidthChange?: (width: number) => void;
  onResizeStart?: () => void;
  onResizeEnd?: () => void;
  initialWidth?: number;
}

export const AIChatSidebar: FC<AIChatSidebarProps> = ({
  isOpen,
  onClose,
  onWidthChange,
  onResizeStart,
  onResizeEnd,
  initialWidth = 400
}): ReactNode => {
  const [activeTab, setActiveTab] = useState<'chat' | 'solana'>('chat');
  return (
    <div 
      data-testid="ai-chat-sidebar" 
      className={isOpen ? 'visible' : 'hidden'}
      style={{ 
        position: 'fixed',
        top: 0,
        right: 0,
        height: '100%',
        width: `${initialWidth}px`,
        zIndex: 50,
        background: 'var(--background)',
        borderLeft: '1px solid var(--border)',
        boxShadow: 'var(--shadow-lg)',
        display: 'flex',
        flexDirection: 'column'
      }}
      aria-hidden={!isOpen}
    >
      <div style={{ 
        padding: '1rem', 
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h2 style={{ fontWeight: 'bold' }}>AI Assistant</h2>
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close AI chat"
          >
            <X className="h-5 w-5" />
          </Button>
        )}
      </div>
      
      <div style={{ 
        display: 'flex', 
        borderBottom: '1px solid var(--border)'
      }}>
        <button
          onClick={() => setActiveTab('chat')}
          style={{
            flex: 1,
            padding: '0.75rem',
            background: activeTab === 'chat' ? 'var(--primary-foreground)' : 'transparent',
            borderBottom: activeTab === 'chat' ? '2px solid var(--primary)' : 'none',
            fontWeight: activeTab === 'chat' ? 'bold' : 'normal'
          }}
        >
          General Chat
        </button>
        <button
          onClick={() => setActiveTab('solana')}
          style={{
            flex: 1,
            padding: '0.75rem',
            background: activeTab === 'solana' ? 'var(--primary-foreground)' : 'transparent',
            borderBottom: activeTab === 'solana' ? '2px solid var(--primary)' : 'none',
            fontWeight: activeTab === 'solana' ? 'bold' : 'normal'
          }}
        >
          Solana Agent
        </button>
      </div>
      
      <div style={{ flex: 1, overflow: 'auto' }}>
        {activeTab === 'chat' && (
          <AIChat 
            showTabs={false}
            className="h-full"
          />
        )}
        
        {activeTab === 'solana' && (
          <AIChat 
            initialContext="I'm the Solana AI Agent. I can help you with Solana blockchain operations like checking wallet balances, getting token prices, trading tokens, and more. What would you like to know about Solana?"
            showTabs={false}
            className="h-full"
            agent={agent}
          />
        )}
      </div>
    </div>
  );
};