"use client";

// Added explicit client directive because this component uses React hooks and was likely
// being treated as a server component by Next.js, preventing it (and its children)
// from rendering properly inside the AI sidebar (blank panel issue).
import { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
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
  onTabTogglePin?: (tabId: string) => void;
  // Knowledge pseudo-tab state
  knowledgeActive?: boolean;
  onSelectKnowledge?: () => void;
  // History pseudo-tab state
  historyActive?: boolean;
  onSelectHistory?: () => void;
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
  onTabTogglePin,
  // Knowledge pseudo-tab
  knowledgeActive = false,
  onSelectKnowledge,
  // History pseudo-tab
  historyActive = false,
  onSelectHistory,
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
    // Revised initialization ordering to fix width persistence:
    // Priority: early script (__SVMAI_EARLY_WIDTH__) > localStorage > prop > DOM attr > fallback.
    // (Previously attr was considered before localStorage causing persisted 640px to be overwritten by 560 attr.)
    const viewport = typeof window !== 'undefined' ? window.innerWidth : 1920;
    const minLimit = Math.min(560, viewport);

    if (typeof window === 'undefined') {
      const baseSSR = typeof initialWidth === 'number' ? initialWidth : 560;
      return Math.min(viewport, Math.max(minLimit, baseSSR));
    }

    let early: number | undefined;
    try {
      const e = (window as any).__SVMAI_EARLY_WIDTH__;
      if (Number.isFinite(e)) early = Number(e);
    } catch (_e) { /* noop */ }

    let lsNum: number | undefined;
    try {
      const saved = window.localStorage.getItem('aiSidebarWidth');
      const parsed = saved ? parseInt(saved, 10) : NaN;
      if (Number.isFinite(parsed)) lsNum = parsed;
    } catch { /* noop */ }

    const propNum = (typeof initialWidth === 'number' && Number.isFinite(initialWidth)) ? initialWidth : undefined;

    let attrNum: number | undefined;
    try {
      const attrEl = document.querySelector('[data-ai-sidebar-root]') as HTMLElement | null;
      const attr = attrEl?.getAttribute('data-ai-sidebar-width');
      const parsed = attr ? parseInt(attr, 10) : NaN;
      if (Number.isFinite(parsed)) attrNum = parsed;
    } catch { /* noop */ }

    // Choose first valid in new priority order
    let candidate = early ?? lsNum ?? propNum ?? attrNum;

    if (candidate === undefined) {
      candidate = (viewport < 640 ? viewport : 560);
    }

    // Clamp and allow upward preference if both ls and attr exist
    if (lsNum && candidate && lsNum > candidate) {
      candidate = lsNum;
    }

    const clamped = Math.min(viewport, Math.max(minLimit, candidate));
    return clamped;
  });
  // Synchronous pre-paint width uplift & attribute stamping to eliminate race where tests
  // read 560px before post-mount reconciliation upgrades to persisted 640px.
  // Runs before first paint (layout effect) so inline style + data attribute reflect persisted width immediately.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const lsRaw = window.localStorage.getItem('aiSidebarWidth');
      const lsNum = lsRaw ? parseInt(lsRaw, 10) : NaN;
      if (Number.isFinite(lsNum) && lsNum > width) {
        // Upgrade state synchronously so initial render width style reflects persisted value
        setWidth(lsNum);
      }
      // Stamp attributes/styles on whichever root is currently present (hydrated ref or early placeholder)
      const root: HTMLElement | null =
        sidebarRef.current ||
        (document.querySelector('[data-ai-sidebar-root]') as HTMLElement | null) ||
        document.getElementById('svmai-early-root') as HTMLElement | null;

      if (root) {
        const applied = Number.isFinite(lsNum) ? lsNum : width;
        root.setAttribute('data-ai-sidebar-width', String(applied));
        try {
          root.style.width = applied + 'px';
        } catch { /* noop */ }
        // Fire an early synchronous event so any listeners/tests waiting on width can proceed
        try {
          window.dispatchEvent(
            new CustomEvent('svmai-width-set', {
              detail: { width: applied, phase: 'layout-sync', ts: Date.now() }
            })
          );
        } catch { /* noop */ }
      }
    } catch { /* noop */ }
  }, []); // run once before paint

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
      const minLimit = Math.min(560, viewportWidth);
      // Use current logical width as base to avoid layout reads while dragging
      const baseWidth = width + deltaX;
      const newWidth = Math.min(maxWidth, Math.max(minLimit, baseWidth));
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
    const minLimit = Math.min(560, viewport);
    const clamped = Math.min(viewport, Math.max(minLimit, initialWidth));
    setWidth(prev => (prev !== clamped ? clamped : prev));
    // Do not echo back via onWidthChange here to avoid feedback loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialWidth]);

  // Post-mount reconciliation & deferred upward correction:
  // Ensures we do not lock into a smaller fallback (560) if a larger persisted width (e.g. 640) becomes available slightly later.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const record = (event: any) => {
      try {
        const w: any = window;
        const arr = (w.__SVMAI_WIDTH_EVENTS__ = w.__SVMAI_WIDTH_EVENTS__ || []);
        arr.push({ ts: Date.now(), ...event });
      } catch { /* noop */ }
    };

    const applyBest = (phase: string) => {
      try {
        const viewport = window.innerWidth;
        const minLimit = Math.min(560, viewport);
        const early = (window as any).__SVMAI_EARLY_WIDTH__;
        const lsRaw = window.localStorage.getItem('aiSidebarWidth');
        const lsNum = lsRaw ? parseInt(lsRaw, 10) : NaN;
        const root = document.querySelector('[data-ai-sidebar-root]') as HTMLElement | null;
        const attr = root?.getAttribute('data-ai-sidebar-width');
        const attrNum = attr ? parseInt(attr, 10) : NaN;

        // Priority for reconciliation: early > localStorage > attr
        const candidates: number[] = [];
        if (Number.isFinite(early)) candidates.push(early);
        if (Number.isFinite(lsNum)) candidates.push(lsNum);
        if (Number.isFinite(attrNum)) candidates.push(attrNum);

        if (!candidates.length) return;

        // Prefer the largest valid candidate to avoid downward locking (user-chosen width usually larger)
        const best = candidates.reduce((a, b) => b > a ? b : a, candidates[0]);
        const clamped = Math.min(viewport, Math.max(minLimit, best));

        // Allow upward correction only
        setWidth(prev => {
          if (prev >= clamped) {
            record({ source: 'ChatLayout-reconcile-skip', phase, prev, candidate: clamped });
            return prev;
          }
          record({ source: 'ChatLayout-reconcile-apply', phase, prev, candidate: clamped });
          return clamped;
        });
      } catch { /* noop */ }
    };

    // Immediate reconciliation (mount)
    applyBest('immediate');

    // Deferred checks to catch late availability (e.g. storage, hydration ordering)
    const t1 = setTimeout(() => applyBest('deferred-50ms'), 50);
    const t2 = setTimeout(() => applyBest('deferred-150ms'), 150);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
    // run only once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Late reconciliation + event listener to capture user width set after initial timers (race with hydration)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const record = (payload: any) => {
      try {
        const w: any = window;
        const arr = (w.__SVMAI_WIDTH_EVENTS__ = w.__SVMAI_WIDTH_EVENTS__ || []);
        arr.push({ ts: Date.now(), ...payload });
      } catch { /* noop */ }
    };

    const lateApply = (phase: string) => {
      try {
        const viewport = window.innerWidth;
        const minLimit = Math.min(560, viewport);
        const early = (window as any).__SVMAI_EARLY_WIDTH__;
        const lsRaw = window.localStorage.getItem('aiSidebarWidth');
        const lsNum = lsRaw ? parseInt(lsRaw, 10) : NaN;
        const root = document.querySelector('[data-ai-sidebar-root]') as HTMLElement | null;
        const attr = root?.getAttribute('data-ai-sidebar-width');
        const attrNum = attr ? parseInt(attr, 10) : NaN;

        const candidates: number[] = [];
        if (Number.isFinite(early)) candidates.push(early);
        if (Number.isFinite(lsNum)) candidates.push(lsNum);
        if (Number.isFinite(attrNum)) candidates.push(attrNum);
        if (!candidates.length) return;
        const best = candidates.reduce((a, b) => b > a ? b : a, candidates[0]);
        const clamped = Math.min(viewport, Math.max(minLimit, best));
        setWidth(prev => {
          if (clamped > prev) {
            record({ source: 'ChatLayout-reconcile-apply-late', phase, prev, candidate: clamped });
            return clamped;
          }
          record({ source: 'ChatLayout-reconcile-skip-late', phase, prev, candidate: clamped });
          return prev;
        });
      } catch { /* noop */ }
    };

    const onEarlyWidthSet = (e: any) => {
      try {
        const detailWidth = e?.detail?.width;
        if (Number.isFinite(detailWidth)) {
          setWidth(prev => {
            if (detailWidth > prev) {
              record({ source: 'ChatLayout-event-apply', prev, candidate: detailWidth, phase: e.detail?.phase });
              return detailWidth;
            }
            record({ source: 'ChatLayout-event-skip', prev, candidate: detailWidth, phase: e.detail?.phase });
            return prev;
          });
        }
      } catch { /* noop */ }
    };

    window.addEventListener('svmai-width-set', onEarlyWidthSet);
    const t3 = setTimeout(() => lateApply('deferred-300ms'), 300);
    const t4 = setTimeout(() => lateApply('deferred-600ms'), 600);
    const t5 = setTimeout(() => lateApply('deferred-1200ms'), 1200);

    return () => {
      window.removeEventListener('svmai-width-set', onEarlyWidthSet);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
    };
  }, []);

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

  // Width instrumentation & persistence guard (prevents downward overwrite after user-set width)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const w: any = window;
      const arr = (w.__SVMAI_WIDTH_EVENTS__ = w.__SVMAI_WIDTH_EVENTS__ || []);
      arr.push({ ts: Date.now(), source: 'ChatLayout-width-render', width });
      const lsRaw = localStorage.getItem('aiSidebarWidth');
      const lsNum = lsRaw ? parseInt(lsRaw, 10) : NaN;
      if (Number.isFinite(lsNum) && lsNum >= 630 && width < lsNum) {
        arr.push({ ts: Date.now(), source: 'ChatLayout-skip-downward', saved: lsNum, attempt: width });
        return;
      }
      if (!Number.isFinite(lsNum) || width !== lsNum) {
        localStorage.setItem('aiSidebarWidth', String(width));
        arr.push({ ts: Date.now(), source: 'ChatLayout-persist', width });
      }
    } catch { /* noop */ }
  }, [width]);

  // Hydration readiness + early root replacement
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = sidebarRef.current;
    if (!root) return;

    // Mark root ready once
    if (!root.getAttribute('data-ai-root-ready')) {
      root.setAttribute('data-ai-root-ready', '1');
      try {
        window.dispatchEvent(new CustomEvent('svmai-root-ready', {
          detail: {
            ts: Date.now(),
            width,
            open: isOpen ? 1 : 0,
            source: 'hydrated'
          }
        }));
      } catch (e) { /* ignore */ }
    }

    // Remove early placeholder root if present
    const early = document.getElementById('svmai-early-root');
    if (early && early !== root) {
      try { early.setAttribute('data-ai-sidebar-replaced', '1'); } catch (e) { }
      // Defer actual removal to next frame to avoid interfering with any observers
      requestAnimationFrame(() => {
        try { early.remove(); } catch (e) { }
      });
    }

    // Sync width attribute aggressively to eliminate race in tests reading it immediately
    root.setAttribute('data-ai-sidebar-width', String(width));
    root.setAttribute('data-open', isOpen ? '1' : '0');
    root.setAttribute('data-ai-sidebar-visible', isOpen ? '1' : '0');
  }, [isOpen, width]);

  // Runtime validation to ensure a single authoritative AI sidebar root.
  // Marks the first discovered root as primary and stamps duplicates for diagnostics without removing them.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const roots = document.querySelectorAll('[data-ai-sidebar-root]');
    if (!roots.length) return;

    const primary = roots[0] as HTMLElement;

    roots.forEach((el, idx) => {
      if (idx === 0) {
        if (!el.getAttribute('data-ai-root-primary')) {
          el.setAttribute('data-ai-root-primary', '1');
        }
      } else {
        if (!el.getAttribute('data-ai-root-duplicate')) {
          el.setAttribute('data-ai-root-duplicate', '1');
        }
      }
    });

    // Stamp validation & dispatch event once when this component instance owns the primary root
    if (sidebarRef.current === primary && !primary.getAttribute('data-ai-root-validated')) {
      primary.setAttribute('data-ai-root-validated', '1');
      try {
        window.dispatchEvent(new CustomEvent('svmai-root-validated', {
          detail: {
            ts: Date.now(),
            count: roots.length
          }
        }));
      } catch { /* ignore */ }
    }
  }, []);

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
      const minLimit = Math.min(560, viewportWidth);
      const restored = Math.min(viewportWidth, Math.max(minLimit, lastCollapsedWidthRef.current || minLimit));
      setWidth(restored);
      setIsExpanded(false);
    }
    if (onExpand) { onExpand(); }
  };

  // Always render sidebar container (even when closed) so tests can locate the landmark immediately.
  // Visibility & off-screen positioning handled via transform + data attributes.

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
          className={`bg-black shadow-xl overflow-hidden ${className} ${!isResizing.current && 'transition-transform duration-300 ease-in-out'}`}
          role="complementary"
          aria-label="AI Chat Sidebar"
          data-testid="ai-chat-sidebar"
          data-ai-sidebar
          data-ai-sidebar-root
          data-ai-mode={activeTab}
          data-ai-sidebar-visible={isOpen ? '1' : '0'}
          data-ai-sidebar-width={String(width)}
          data-open={isOpen ? '1' : '0'}
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
                const minLimit = Math.min(560, viewportWidth);
                const newWidth = Math.min(viewportWidth, Math.max(minLimit, oldWidth + delta));
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
                  onTabTogglePin={onTabTogglePin}
                  knowledgeActive={knowledgeActive}
                  onSelectKnowledge={onSelectKnowledge}
                  historyActive={historyActive}
                  onSelectHistory={onSelectHistory}
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
                            data-ai-open-token-panel
                            title="Open settings and token management"
                          >
                            <Settings size={16} />
                            Settings
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
                          <button
                            onClick={() => {
                              setIsMenuOpen(false);
                              onClose?.();
                            }}
                            className="w-full px-4 py-2 text-sm text-white hover:bg-white/10 flex items-center gap-2 transition-colors focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
                            role="menuitem"
                          >
                            <X size={16} />
                            Close Chat
                          </button>
                        </div>
                      </div>
                    </div>
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
                          data-ai-open-token-panel
                          title="Open settings and token management"
                        >
                          <Settings size={16} />
                          Settings
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
            <div className="flex-1 min-h-0 bg-black overflow-y-auto">
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
