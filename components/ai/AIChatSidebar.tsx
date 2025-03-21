'use client';

import { FC, ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
        boxShadow: 'var(--shadow-lg)'
      }}
      aria-hidden={!isOpen}
    >
      <div style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
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
        <div>AI Chat Sidebar</div>
      </div>
    </div>
  );
};
