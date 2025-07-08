'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { Maximize2, RotateCcw, Plus, MoreHorizontal, X, Settings, HelpCircle, Download, Share2 } from 'lucide-react';
import { SettingsModal } from '../modals/SettingsModal';

export interface ChatLayoutProps {
  children: ReactNode;
  variant: 'inline' | 'sidebar' | 'dialog';
  isOpen: boolean;
  className?: string;
  onWidthChange?: (width: number) => void;
  onResizeStart?: () => void;
  onResizeEnd?: () => void;
  onClose?: () => void;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  onReset?: () => void;
  onNewChat?: () => void;
  onExport?: () => void;
  onShare?: () => void;
  onSettings?: () => void;
  onHelp?: () => void;
  onExpand?: () => void;
}

export function ChatLayout({ 
  children, 
  variant, 
  isOpen, 
  className = '', 
  onWidthChange,
  onResizeStart,
  onResizeEnd,
  onClose,
  activeTab = 'agent',
  onTabChange,
  onReset,
  onNewChat,
  onExport,
  onShare,
  onSettings,
  onHelp,
  onExpand,
}: ChatLayoutProps) {
  const [width, setWidth] = useState(() => 
    typeof window !== 'undefined' ? (window.innerWidth < 640 ? window.innerWidth : 480) : 480
  );
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const isResizing = useRef(false);
  const lastX = useRef(0);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing.current) return;
    
    const deltaX = lastX.current - e.clientX;
    lastX.current = e.clientX;
    
    requestAnimationFrame(() => {
      const newWidth = Math.min(800, Math.max(300, (sidebarRef.current?.offsetWidth || 0) + deltaX));
      setWidth(newWidth);
      onWidthChange?.(newWidth);
    });
  }, [onWidthChange]);

  const handleMouseUp = useCallback(() => {
    if (isResizing.current) {
      isResizing.current = false;
      document.body.style.cursor = 'default';
      document.body.classList.remove('select-none');
      onResizeEnd?.();
    }
  }, [onResizeEnd]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    lastX.current = e.clientX;
    document.body.style.cursor = 'ew-resize';
    document.body.classList.add('select-none');
    onResizeStart?.();
  }, [onResizeStart]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const handleOpenSettings = () => {
    setIsSettingsOpen(true);
    setIsMenuOpen(false);
    onSettings?.();
  };

  const handleCloseSettings = () => {
    setIsSettingsOpen(false);
  };

  const handleExport = () => {
    setIsMenuOpen(false);
    onExport?.();
  };

  const handleShare = async () => {
    setIsMenuOpen(false);
    onShare?.();
  };

  const handleHelp = () => {
    setIsMenuOpen(false);
    onHelp?.();
  };

  const handleExpand = () => {
    setIsMenuOpen(false);
    setIsExpanded(!isExpanded);
    onExpand?.();
  };

  if (!isOpen) return null;

  switch (variant) {
    case 'dialog':
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-2xl">
            {children}
          </div>
        </div>
      );

    case 'sidebar':
      return (
        <div 
          ref={sidebarRef}
          style={{ 
            width: isExpanded ? '100%' : `${width}px`,
            transform: `translateX(${isOpen ? '0' : '100%'})`
          }}
          className={`fixed top-0 right-0 h-screen bg-black z-[200] shadow-xl ${className} ${!isResizing.current && 'transition-all duration-300 ease-in-out'}`}
        >
          <div
            className={`absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-white/10 active:bg-white/20 ${isExpanded ? 'hidden' : ''}`}
            onMouseDown={handleMouseDown}
          />
          <div className="h-full w-full overflow-hidden flex flex-col">
            <div className="flex h-[40px] border-b border-white/20">
              <div className="flex items-center">
                <button 
                  onClick={() => onTabChange?.('agent')}
                  className={`px-4 h-[40px] text-sm font-medium ${activeTab === 'agent' ? 'bg-white text-black' : 'text-white hover:bg-white/10'}`}
                >
                  AGENT
                </button>
                <button 
                  onClick={() => onTabChange?.('assistant')}
                  className={`px-4 h-[40px] text-sm font-medium ${activeTab === 'assistant' ? 'bg-white text-black' : 'text-white hover:bg-white/10'}`}
                >
                  ASSISTANT
                </button>
                <button 
                  onClick={() => onTabChange?.('notes')}
                  className={`hidden sm:block px-4 h-[40px] text-sm font-medium ${activeTab === 'notes' ? 'bg-white text-black' : 'text-white hover:bg-white/10'}`}
                >
                  KNOWLEDGE
                </button>
              </div>
              <div className="flex items-center ml-auto px-2 gap-1">
                <button 
                  onClick={handleExpand}
                  className="hidden sm:block p-2 text-white hover:bg-white/10 rounded-sm transition-colors" 
                  title={isExpanded ? "Collapse" : "Expand"}
                >
                  <Maximize2 size={16} className={isExpanded ? "rotate-45" : ""} />
                </button>
                <button 
                  className="hidden sm:block p-2 text-white hover:bg-white/10 rounded-sm transition-colors" 
                  title="Reset"
                  onClick={onReset}
                >
                  <RotateCcw size={16} />
                </button>
                <button 
                  className="hidden sm:block p-2 text-white hover:bg-white/10 rounded-sm transition-colors" 
                  title="New Chat"
                  onClick={onNewChat}
                >
                  <Plus size={16} />
                </button>
                <button 
                  className="p-2 text-white hover:bg-white/10 rounded-sm relative transition-colors" 
                  title="More"
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                >
                  <MoreHorizontal size={16} />
                </button>
                <button 
                  className="p-2 text-white hover:bg-white/10 rounded-sm transition-colors" 
                  onClick={onClose} 
                  title="Close"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            <div 
              ref={menuRef}
              className={`absolute right-2 top-[40px] w-48 bg-black border border-white/20 rounded-lg shadow-lg overflow-hidden transition-all duration-200 ${
                isMenuOpen ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'
              }`}
            >
              <div className="py-1">
                <button 
                  onClick={onReset}
                  className="block sm:hidden w-full px-4 py-2 text-sm text-white hover:bg-white/10 flex items-center gap-2 transition-colors"
                >
                  <RotateCcw size={16} />
                  Reset
                </button>
                <button 
                  onClick={onReset}
                  className="block sm:hidden w-full px-4 py-2 text-sm text-white hover:bg-white/10 flex items-center gap-2 transition-colors"
                >
                  <Plus size={16} />
                  New Chat
                </button>
                <button
                  onClick={handleOpenSettings}
                  className="w-full px-4 py-2 text-sm text-white hover:bg-white/10 flex items-center gap-2 transition-colors"
                >
                  <Settings size={16} />
                  Settings
                </button>
                <button 
                  onClick={handleHelp}
                  className="w-full px-4 py-2 text-sm text-white hover:bg-white/10 flex items-center gap-2 transition-colors"
                >
                  <HelpCircle size={16} />
                  Help
                </button>
                <button 
                  onClick={handleExport}
                  className="w-full px-4 py-2 text-sm text-white hover:bg-white/10 flex items-center gap-2 transition-colors"
                >
                  <Download size={16} />
                  Export Chat
                </button>
                <button 
                  onClick={handleShare}
                  className="w-full px-4 py-2 text-sm text-white hover:bg-white/10 flex items-center gap-2 transition-colors"
                >
                  <Share2 size={16} />
                  Share
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden bg-black">
              {children}
            </div>
          </div>
          <SettingsModal isOpen={isSettingsOpen} onClose={handleCloseSettings} />
        </div>
      );

    case 'inline':
    default:
      return (
        <div className={className}>
          {children}
        </div>
      );
  }
}
