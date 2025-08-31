'use client';

import React, { useEffect, useState } from 'react';
import { AIChatSidebar } from './AIChatSidebar';
import { useAIChatSidebar } from '../../contexts/AIChatSidebarContext';

export const AIChatSidebarWrapper: React.FC = () => {
  const {
    isOpen,
    close,
    sidebarWidth,
    setSidebarWidth,
    onResizeStart,
    onResizeEnd
  } = useAIChatSidebar();
  
  // Always render to avoid hydration mismatch, but ensure proper initialization
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Always render the component to ensure DOM elements exist for tests
  // Don't gate isOpen by mounted since the Chat component handles visibility properly
  // The Chat > ChatLayout component will render the root element regardless of isOpen
  return (
    <AIChatSidebar
      isOpen={isOpen}
      onClose={close}
      onWidthChange={setSidebarWidth}
      onResizeStart={onResizeStart}
      onResizeEnd={onResizeEnd}
      initialWidth={sidebarWidth}
    />
  );
};
