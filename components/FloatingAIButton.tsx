'use client';

import { useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AIChatSidebar } from './ai/AIChatSidebar';

export function FloatingAIButton() {
  const [isAIChatOpen, setIsAIChatOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(400);
  const [isResizing, setIsResizing] = useState(false);

  const handleWidthChange = (newWidth: number) => {
    setSidebarWidth(newWidth);
  };

  const handleResizeStart = () => {
    setIsResizing(true);
    document.body.style.cursor = 'col-resize';
  };

  const handleResizeEnd = () => {
    setIsResizing(false);
    document.body.style.cursor = 'default';
  };

  return (
    <>
      <Button
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-[#00DC82] hover:bg-[#00DC82]/90 text-black shadow-lg z-50 transition-all hover:scale-110"
        onClick={() => setIsAIChatOpen(true)}
        aria-label="Open AI Assistant"
      >
        <MessageSquare className="h-6 w-6" />
      </Button>

      {/* AI Chat Sidebar */}
      <AIChatSidebar
        isOpen={isAIChatOpen}
        onClose={() => setIsAIChatOpen(false)}
        onWidthChange={handleWidthChange}
        onResizeStart={handleResizeStart}
        onResizeEnd={handleResizeEnd}
        initialWidth={sidebarWidth}
      />
    </>
  );
}
