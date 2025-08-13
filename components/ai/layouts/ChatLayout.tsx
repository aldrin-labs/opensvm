import { useState, useRef, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { Maximize2, RotateCcw, Plus, MoreHorizontal, X, Settings, HelpCircle, Download, Share2 } from 'lucide-react';
import dynamic from 'next/dynamic';

// Dynamically import SettingsModal to avoid SSR issues
const SettingsModal = dynamic(() => import('../modals/SettingsModal').then(mod => ({ default: mod.SettingsModal })), {
  ssr: false
});

export interface ChatLayoutProps {
  children: ReactNode;
  variant: 'inline' | 'sidebar' | 'dialog';
  isOpen: boolean;
  className?: string;
  onWidthChange?: (width: number) => void;
  onResizeStart?: () => void;
  onResizeEnd?: () => void;
  onClose?: () => void;
  initialWidth?: number;
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
  initialWidth,
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
  const [width, setWidth] = useState(() => {
    if (typeof window === 'undefined') return initialWidth ?? 480;
    const base = typeof initialWidth === 'number' ? initialWidth : (window.innerWidth < 640 ? window.innerWidth : 480);
    return Math.min(800, Math.max(300, base));
  });
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
      const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1920;
      const maxWidth = Math.max(320, viewportWidth); // allow up to full viewport width
      const baseWidth = (sidebarRef.current?.offsetWidth || 0) + deltaX;
      const newWidth = Math.min(maxWidth, Math.max(300, baseWidth));
      setWidth(newWidth);
      onWidthChange?.(newWidth);
    });
  }, [onWidthChange]);

  const handleMouseUp = useCallback(() => {
    if (isResizing.current && typeof document !== 'undefined') {
      isResizing.current = false;
      document.body.style.cursor = 'default';
      document.body.classList.remove('select-none');
      onResizeEnd?.();
    }
  }, [onResizeEnd]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (typeof document === 'undefined') return;

    e.preventDefault();
    isResizing.current = true;
    lastX.current = e.clientX;
    document.body.style.cursor = 'ew-resize';
    document.body.classList.add('select-none');
    onResizeStart?.();
  }, [onResizeStart]);

  // Close menu when clicking outside
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // Sync width when initialWidth changes (and broadcast to listeners)
  useEffect(() => {
    if (typeof initialWidth !== 'number') return;
    const clamped = Math.min(800, Math.max(300, initialWidth));
    setWidth(clamped);
    onWidthChange?.(clamped);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialWidth]);

  // When opening or width/expanded changes, inform container to shift content
  useEffect(() => {
    if (!isOpen) return;
    if (isExpanded) {
      const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1920;
      onWidthChange?.(viewportWidth);
    } else {
      onWidthChange?.(width);
    }
  }, [isOpen, width, isExpanded, onWidthChange]);

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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
          role="dialog"
          aria-modal="true"
          aria-label="AI Chat Dialog"
        >
          {/* Add a skip link for keyboard navigation */}
          <a href="#chat-input" className="skip-link sr-only focus:not-sr-only">
            Skip to chat input
          </a>

          <div className="w-full max-w-2xl h-[80vh] max-h-[600px] flex flex-col overflow-hidden">
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
            minWidth: '320px',
            boxSizing: 'border-box',
            transform: `translateX(${isOpen ? '0' : '100%'})`
          }}
          className={`fixed top-0 right-0 h-screen h-[-webkit-fill-available] h-[100dvh] bg-black z-[200] shadow-xl ${className} ${!isResizing.current && 'transition-all duration-300 ease-in-out'}`}
          role="complementary"
          aria-label="AI Chat Sidebar"
          data-ai-sidebar
        >
          {/* Skip link for keyboard navigation */}
          <a href="#chat-input" className="skip-link sr-only focus:not-sr-only">
            Skip to chat input
          </a>

          <div
            className={`absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-white/10 active:bg-white/20 ${isExpanded ? 'hidden' : ''}`}
            onMouseDown={handleMouseDown}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize sidebar"
          />
          {/* Main content container with proper flex layout */}
          <div className="h-full w-full flex flex-col" style={{ boxSizing: 'border-box' }}>
            {/* Header with tabs and buttons */}
            <div className="flex h-[40px] border-b border-white/20 flex-shrink-0 relative" role="navigation">
              <div className="flex items-center" role="tablist">
                <button
                  onClick={() => onTabChange?.('agent')}
                  className={`px-4 h-[40px] text-sm font-medium ${activeTab === 'agent' ? 'bg-white text-black' : 'text-white hover:bg-white/10'} focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2`}
                  role="tab"
                  aria-selected={activeTab === 'agent'}
                  aria-controls="agent-tab"
                  id="agent-tab-button"
                >
                  AGENT
                </button>
                <button
                  onClick={() => onTabChange?.('assistant')}
                  className={`px-4 h-[40px] text-sm font-medium ${activeTab === 'assistant' ? 'bg-white text-black' : 'text-white hover:bg-white/10'} focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2`}
                  role="tab"
                  aria-selected={activeTab === 'assistant'}
                  aria-controls="assistant-tab"
                  id="assistant-tab-button"
                >
                  ASSISTANT
                </button>
                <button
                  onClick={() => onTabChange?.('notes')}
                  className={`hidden sm:block px-4 h-[40px] text-sm font-medium ${activeTab === 'notes' ? 'bg-white text-black' : 'text-white hover:bg-white/10'} focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2`}
                  role="tab"
                  aria-selected={activeTab === 'notes'}
                  aria-controls="notes-tab"
                  id="notes-tab-button"
                >
                  KNOWLEDGE
                </button>
              </div>
              <div className="flex items-center ml-auto pl-2 pr-4 gap-1">
                <button
                  onClick={handleExpand}
                  className="hidden sm:block p-2 text-white hover:bg-white/10 rounded-sm transition-colors focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
                  title={isExpanded ? "Collapse" : "Expand"}
                  aria-label={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
                  aria-expanded={isExpanded}
                >
                  <Maximize2 size={16} className={isExpanded ? "rotate-45" : ""} />
                </button>
                <button
                  className="hidden sm:block p-2 text-white hover:bg-white/10 rounded-sm transition-colors focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
                  title="Reset"
                  onClick={onReset}
                  aria-label="Reset chat"
                >
                  <RotateCcw size={16} />
                </button>
                <button
                  className="hidden sm:block p-2 text-white hover:bg-white/10 rounded-sm transition-colors focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
                  title="New Chat"
                  onClick={onNewChat}
                  aria-label="Start new chat"
                >
                  <Plus size={16} />
                </button>
                <div className="relative">
                  <button
                    className="p-2 text-white hover:bg-white/10 rounded-sm transition-colors focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
                    title="More"
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    aria-label="More options"
                    aria-expanded={isMenuOpen}
                    aria-haspopup="menu"
                  >
                    <MoreHorizontal size={16} />
                  </button>
                  {/* Dropdown menu positioned properly to avoid clipping */}
                  <div
                    ref={menuRef}
                    className={`absolute right-0 top-full mt-1 w-48 bg-black border border-white/20 rounded-lg shadow-lg overflow-hidden transition-all duration-200 z-[300] ${isMenuOpen ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'
                      }`}
                    style={{
                      maxWidth: 'calc(100vw - 20px)',
                      transform: isMenuOpen ? 'translateX(calc(-100% + 40px))' : 'translateX(calc(-100% + 40px)) translateY(-8px)'
                    }}
                    role="menu"
                    aria-label="More options menu"
                    aria-hidden={!isMenuOpen}
                  >
                    <div className="py-1">
                      <button
                        onClick={onReset}
                        className="block sm:hidden w-full px-4 py-2 text-sm text-white hover:bg-white/10 flex items-center gap-2 transition-colors focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
                        role="menuitem"
                      >
                        <RotateCcw size={16} />
                        Reset
                      </button>
                      <button
                        onClick={onNewChat}
                        className="block sm:hidden w-full px-4 py-2 text-sm text-white hover:bg-white/10 flex items-center gap-2 transition-colors focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
                        role="menuitem"
                      >
                        <Plus size={16} />
                        New Chat
                      </button>
                      <button
                        onClick={handleOpenSettings}
                        className="w-full px-4 py-2 text-sm text-white hover:bg-white/10 flex items-center gap-2 transition-colors focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
                        role="menuitem"
                        data-ai-token-panel
                        title="Manage SVMAI Tokens"
                      >
                        <Settings size={16} />
                        💰 Tokens
                      </button>
                      <button
                        onClick={handleHelp}
                        className="w-full px-4 py-2 text-sm text-white hover:bg-white/10 flex items-center gap-2 transition-colors focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
                        role="menuitem"
                      >
                        <HelpCircle size={16} />
                        Help
                      </button>
                      <button
                        onClick={handleExport}
                        className="w-full px-4 py-2 text-sm text-white hover:bg-white/10 flex items-center gap-2 transition-colors focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
                        role="menuitem"
                      >
                        <Download size={16} />
                        Export Chat
                      </button>
                      <button
                        onClick={handleShare}
                        className="w-full px-4 py-2 text-sm text-white hover:bg-white/10 flex items-center gap-2 transition-colors focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
                        role="menuitem"
                      >
                        <Share2 size={16} />
                        Share
                      </button>
                    </div>
                  </div>
                </div>
                <button
                  className="p-2 text-white hover:bg-white/10 rounded-sm transition-colors focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
                  onClick={onClose}
                  title="Close"
                  aria-label="Close sidebar"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            {/* Main content area with proper flex and overflow handling */}
            <div className="flex-1 min-h-0 bg-black">
              {children}
            </div>
          </div>
          <SettingsModal isOpen={isSettingsOpen} onClose={handleCloseSettings} />
        </div>
      );

    case 'inline':
    default:
      return (
        <div
          className={`h-full max-h-screen flex flex-col overflow-hidden ${className}`}
          role="region"
          aria-label="AI Chat Interface"
        >
          {/* Skip link for keyboard navigation */}
          <a href="#chat-input" className="skip-link sr-only focus:not-sr-only">
            Skip to chat input
          </a>

          {children}
        </div>
      );
  }
}
