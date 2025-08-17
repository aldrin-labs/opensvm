"use client";

// Added explicit client directive because this component uses React hooks and was likely
// being treated as a server component by Next.js, preventing it (and its children)
// from rendering properly inside the AI sidebar (blank panel issue).
import { useState, useRef, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { Maximize2, RotateCcw, Plus, MoreHorizontal, X, Settings, HelpCircle, Download, Share2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import { track } from '../../../lib/ai/telemetry';
import { TabBar } from '../components/TabBar';
import type { ChatTab } from '../hooks/useChatTabs';

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
  // New tab system props
  tabs?: ChatTab[];
  activeTabId?: string | null;
  onTabClick?: (tabId: string) => void;
  onTabClose?: (tabId: string) => void;
  onNewTab?: () => void;
  onTabRename?: (tabId: string, name: string) => void;
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
  // New tab system props
  tabs = [],
  activeTabId = null,
  onTabClick,
  onTabClose,
  onNewTab,
  onTabRename,
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
}: ChatLayoutProps) {
  const [width, setWidth] = useState(() => {
    const viewport = typeof window !== 'undefined' ? window.innerWidth : 1920;
    const base = typeof initialWidth === 'number' ? initialWidth : (viewport < 640 ? viewport : 480);
    return Math.min(viewport, Math.max(300, base));
  });
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  // Remember last non-expanded width so collapse returns to previous size
  const lastCollapsedWidthRef = useRef<number>(480);
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
      // Use current logical width as base to avoid layout reads while dragging
      const baseWidth = width + deltaX;
      const newWidth = Math.min(maxWidth, Math.max(300, baseWidth));
      setWidth(newWidth);
      onWidthChange?.(newWidth);
    });
  }, [onWidthChange, width]);

  const handleMouseUp = useCallback(() => {
    if (isResizing.current && typeof document !== 'undefined') {
      isResizing.current = false;
      document.body.style.cursor = 'default';
      document.body.classList.remove('select-none');
      onResizeEnd?.();

      // Fire width_change event for agents on drag end (Phase 1.4.2)
      try {
        const finalWidth = width;
        window.dispatchEvent(new CustomEvent('svmai:event', {
          detail: {
            type: 'width_change',
            ts: Date.now(),
            payload: {
              width: finalWidth,
              bucket: finalWidth <= 420 ? '<=420' : finalWidth <= 520 ? '421-520' : finalWidth <= 640 ? '521-640' : '>640',
              method: 'drag'
            }
          }
        }));
      } catch (error) {
        // Ignore custom event errors
      }
    }
  }, [onResizeEnd, width]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (typeof document === 'undefined') return;

    e.preventDefault();
    // If currently expanded, switch to resizable mode and remember viewport width
    if (isExpanded) {
      const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1920;
      setIsExpanded(false);
      setWidth(viewportWidth);
    }
    isResizing.current = true;
    lastX.current = e.clientX;
    document.body.style.cursor = 'ew-resize';
    document.body.classList.add('select-none');
    onResizeStart?.();
  }, [onResizeStart, isExpanded]);

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
    const viewport = typeof window !== 'undefined' ? window.innerWidth : 1920;
    const clamped = Math.min(viewport, Math.max(300, initialWidth));
    setWidth(prev => (prev !== clamped ? clamped : prev));
    // Do not echo back via onWidthChange here to avoid feedback loops
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

  // Debounced width telemetry (Phase 1.4.3)
  const widthRef = useRef(width);
  widthRef.current = width;
  useEffect(() => {
    if (!isOpen) return;
    const id = setTimeout(() => {
      const w = widthRef.current;
      const bucket = w <= 420 ? '<=420' : w <= 520 ? '421-520' : w <= 640 ? '521-640' : '>640';
      try { track('width_change', { width: w, bucket }); } catch { }
    }, 500);
    return () => clearTimeout(id);
  }, [width, isOpen]);

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
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1920;
    if (!isExpanded) {
      // Save current width before expanding to full
      lastCollapsedWidthRef.current = width;
      setWidth(viewportWidth);
      setIsExpanded(true);
    } else {
      // Restore previous collapsed width
      const restored = Math.min(viewportWidth, Math.max(300, lastCollapsedWidthRef.current || 480));
      setWidth(restored);
      setIsExpanded(false);
    }
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
            position: 'fixed',
            top: '0px',
            left: isExpanded ? '0px' : undefined,
            right: isExpanded ? undefined : '0px',
            bottom: '0px',
            width: isExpanded ? '100vw' : `${width}px`,
            minWidth: isExpanded ? '100vw' : 'min(560px, 100vw)',
            height: '100vh',
            boxSizing: 'border-box',
            transform: `translateX(${isOpen ? '0' : '100%'})`,
            zIndex: 99999
          }}
          className={`bg-black shadow-xl ${className} ${!isResizing.current && 'transition-all duration-300 ease-in-out'}`}
          role="complementary"
          aria-label="AI Chat Sidebar"
          data-ai-sidebar
          data-ai-sidebar-width={isExpanded ? '100vw' : undefined}
        >
          {/* Skip link for keyboard navigation */}
          <a href="#chat-input" className="skip-link sr-only focus:not-sr-only">
            Skip to chat input
          </a>

          <div
            className="absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize bg-white/10 hover:bg-white/20 active:bg-white/30 flex items-center justify-center z-[500] pointer-events-auto"
            onMouseDown={handleMouseDown}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize sidebar. Use left and right arrow keys to adjust width in 24 pixel increments."
            aria-valuenow={Math.round((width / (typeof window !== 'undefined' ? window.innerWidth : 1920)) * 100)}
            aria-valuemin={30}
            aria-valuemax={100}
            tabIndex={0}
            data-ai-resize-handle
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                e.preventDefault();
                const delta = e.key === 'ArrowLeft' ? -24 : 24;
                const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1920;
                const oldWidth = isExpanded ? viewportWidth : width;
                const newWidth = Math.min(viewportWidth, Math.max(300, oldWidth + delta));
                setWidth(newWidth);
                onWidthChange?.(newWidth);

                // Fire width_change event for agents (Phase 1.4.2)
                try {
                  window.dispatchEvent(new CustomEvent('svmai:event', {
                    detail: {
                      type: 'width_change',
                      ts: Date.now(),
                      payload: {
                        width: newWidth,
                        bucket: newWidth <= 420 ? '<=420' : newWidth <= 520 ? '421-520' : newWidth <= 640 ? '521-640' : '>640',
                        method: 'keyboard'
                      }
                    }
                  }));
                } catch (error) {
                  // Ignore custom event errors
                }
              }
            }}
            style={{
              // Extend invisible hit area beyond visual element (Phase 1.4.1)
              marginLeft: '-2px',
              width: '16px', // 12px visual + 4px extended hit area
              paddingLeft: '2px'
            }}
          >
            <div className="w-px h-10 bg-white/50 rounded" aria-hidden="true" />
          </div>
          {/* Main content container with proper flex layout; left padding to avoid overlapping the absolute handle */}
          <div
            className="h-full w-full flex flex-col"
            style={{ boxSizing: 'border-box', paddingLeft: isExpanded ? 0 : '0.75rem' }}
            data-ai-chat-container
          >
            {/* New tab system header */}
            {tabs.length > 0 ? (
              <div className="flex flex-col">
                <TabBar
                  tabs={tabs}
                  activeTabId={activeTabId}
                  onTabClick={onTabClick || (() => { })}
                  onTabClose={onTabClose || (() => { })}
                  onNewTab={onNewTab || (() => { })}
                  onTabRename={onTabRename}
                />
                {/* Action buttons row */}
                <div className="flex items-center justify-end h-10 px-4 border-b border-white/20 bg-black/20">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={handleExpand}
                      className="hidden sm:block p-2 text-white hover:bg-white/10 rounded-sm transition-colors focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
                      title={isExpanded ? "Collapse" : "Expand"}
                      aria-label={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
                      aria-expanded={isExpanded}
                    >
                      <Maximize2 size={14} className={isExpanded ? "rotate-45" : ""} />
                    </button>
                    <button
                      className="hidden sm:block p-2 text-white hover:bg-white/10 rounded-sm transition-colors focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
                      title="Reset"
                      onClick={onReset}
                      aria-label="Reset chat"
                    >
                      <RotateCcw size={14} />
                    </button>
                    <div className="relative">
                      <button
                        className="p-2 text-white hover:bg-white/10 rounded-sm transition-colors focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
                        title="More"
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        aria-label="More options"
                        aria-expanded={isMenuOpen}
                        aria-haspopup="menu"
                        data-testid="ai-chat-more-button"
                      >
                        <MoreHorizontal size={14} />
                      </button>
                      {/* Dropdown menu */}
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
                        hidden={!isMenuOpen}
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
                      <X size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              // Fallback to legacy tab system for backward compatibility
              <div className="flex h-[40px] border-b border-white/20 flex-shrink-0 relative z-[201]" role="navigation">
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
            )}
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
