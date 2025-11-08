import React, { useState, useEffect, useRef } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';

/**
 * ReasoningBlock (Simplified Stabilized Version)
 *
 * Goals:
 *  - Remove legacy global stabilizers, mutation observers, repeated sweeping loops.
 *  - Eliminate early placeholders (#early-reasoning-content or placeholder attributes).
 *  - Ensure a single real reasoning content node per block.
 *  - Deterministic initial collapsed state (always collapsed on first mount).
 *  - Provide a single, well-defined readiness signal:
 *        * Sets documentElement[data-ai-reasoning-stabilized="1"] (once)
 *        * Dispatches window 'svmai-reasoning-ready' CustomEvent with { blockCount }
 *  - Avoid pointer-event interception (content has pointer-events:none while collapsed).
 *
 * Test Synchronization:
 *    Wait for either:
 *      document.documentElement.getAttribute('data-ai-reasoning-stabilized') === '1'
 *        OR listen for 'svmai-reasoning-ready' event.
 *
 * No polling / intervals / observers are retained to reduce flake risk.
 */

// One-time legacy purge at module evaluation.
if (typeof window !== 'undefined') {
  try {
    document
      .querySelectorAll('#early-reasoning-content,[data-ai-reasoning-block-placeholder],[data-ai-reasoning-early]')
      .forEach((el) => {
        try { el.remove(); } catch { /* noop */ }
      });
  } catch { /* noop */ }
}

interface ReasoningBlockProps {
  reasoning: {
    text: string;
    tokensEst: number;
  };
  collapsed?: boolean; // Kept for API compatibility (ignored for deterministic initial state)
  onToggle?: (expanded: boolean) => void;
  className?: string;
}

/**
 * Ensure only one reasoning content node exists inside each real block root.
 * Returns total reasoning block count (real).
 */
function ensureSingleContent(root?: HTMLElement | null): number {
  if (typeof document === 'undefined') return 0;
  try {
    // Remove any lingering legacy placeholders anywhere
    document
      .querySelectorAll('#early-reasoning-content,[data-ai-reasoning-block-placeholder],[data-ai-reasoning-early]')
      .forEach((el) => { try { el.remove(); } catch { /* noop */ } });

    // De‑duplicate content nodes inside each real block
    const blocks = Array.from(
      document.querySelectorAll('[data-ai-reasoning-block][data-ai-reasoning-real="1"]')
    ) as HTMLElement[];

    for (const b of blocks) {
      const contents = Array.from(b.querySelectorAll('[data-ai-reasoning-content]'));
      if (contents.length > 1) {
        // Keep the last (assumed most recent) and remove earlier duplicates
        contents.slice(0, -1).forEach((c) => { try { c.remove(); } catch { /* noop */ } });
      }
    }
    return blocks.length;
  } catch {
    return 0;
  }
}

export function ReasoningBlock({
  reasoning,
  collapsed = true, // ignored for determinism
  onToggle,
  className = ''
}: ReasoningBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false); // Always start collapsed
  const rootRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // In-render quick purge scoped broadly (fast path before Playwright can interact)
  if (typeof window !== 'undefined') {
    try {
      document
        .querySelectorAll('#early-reasoning-content,[data-ai-reasoning-block-placeholder],[data-ai-reasoning-early]')
        .forEach((el) => { try { el.remove(); } catch { /* noop */ } });
    } catch { /* noop */ }
  }

  // Single stabilization sequence (mount -> microtask -> short timeout)
  useEffect(() => {
    const finalize = () => {
      try {
        const count = ensureSingleContent(rootRef.current);
        const docEl = document.documentElement;
        if (!docEl.getAttribute('data-ai-reasoning-stabilized')) {
          docEl.setAttribute('data-ai-reasoning-stabilized', '1');
        }
        window.dispatchEvent(
          new CustomEvent('svmai-reasoning-ready', {
            detail: {
              ts: Date.now(),
              blockCount: count
            }
          })
        );
      } catch { /* noop */ }
    };

    // Initial sweep
    ensureSingleContent(rootRef.current);
    // Microtask sweep
    try { queueMicrotask(() => ensureSingleContent(rootRef.current)); } catch { /* noop */ }
    // Short delayed finalization to allow any concurrent mounts
    const t = setTimeout(finalize, 40);
    return () => clearTimeout(t);
  }, []);

  // Apply dynamic classes & aria state for expansion
  useEffect(() => {
    try {
      const root = rootRef.current;
      const content = contentRef.current;
      if (root) {
        root.setAttribute('data-ai-reasoning-expanded', isExpanded ? '1' : '0');
      }
      if (content) {
        if (isExpanded) {
          content.classList.remove('max-h-0', 'opacity-0', 'pointer-events-none');
          content.classList.add('max-h-none', 'opacity-100');
          content.style.pointerEvents = 'auto';
          content.setAttribute('aria-hidden', 'false');
        } else {
          content.classList.remove('max-h-none', 'opacity-100');
            if (!content.classList.contains('max-h-0')) {
              content.classList.add('max-h-0', 'opacity-0');
            }
          content.classList.add('pointer-events-none');
          content.style.pointerEvents = 'none';
          content.setAttribute('aria-hidden', 'true');
        }
      }
    } catch { /* noop */ }
  }, [isExpanded]);

  const handleToggle = () => {
    ensureSingleContent(rootRef.current); // Safety before toggling
    const next = !isExpanded;
    setIsExpanded(next);
    onToggle?.(next);
    try {
      window.dispatchEvent(
        new CustomEvent('svmai:event', {
          detail: {
            type: next ? 'reasoning_expand' : 'reasoning_collapse',
            ts: Date.now(),
            payload: {
              tokens: reasoning.tokensEst,
              expanded: next
            }
          }
        })
      );
    } catch { /* noop */ }
  };

  const toggleId = `reasoning-toggle-${Math.random().toString(36).slice(2, 11)}`;
  const contentId = `reasoning-content-${Math.random().toString(36).slice(2, 11)}`;

  return (
    <div
      ref={rootRef}
      className={`reasoning-block relative z-[300] ${className}`}
      data-ai-reasoning-block
      data-ai-reasoning-real="1"
      data-ai-reasoning-expanded={isExpanded ? '1' : '0'}
      style={{
        scrollMarginTop: '80px',
        scrollMarginBottom: '240px'
      }}
      data-ai-reasoning-scroll-padding="1"
    >
      <button
        id={toggleId}
        onClick={handleToggle}
        className="relative z-[3000] flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors py-1 px-2 rounded hover:bg-muted/50 focus:outline-none focus:ring-1 focus:ring-ring pointer-events-auto"
        aria-expanded={isExpanded}
        aria-controls={contentId}
        data-ai-reasoning-toggle
        type="button"
      >
        {isExpanded ? (
          <ChevronDown size={12} aria-hidden="true" />
        ) : (
          <ChevronRight size={12} aria-hidden="true" />
        )}
        <span className="font-medium">
          Reasoning
          <span className="text-muted-foreground/70 ml-1">
            ({reasoning.tokensEst} token{reasoning.tokensEst !== 1 ? 's' : ''})
          </span>
        </span>
      </button>

      <div
        ref={contentRef}
        id={contentId}
        aria-labelledby={toggleId}
        className={`reasoning-content transition-all duration-150 ease-in-out overflow-hidden ${isExpanded ? 'max-h-none opacity-100' : 'max-h-0 opacity-0 pointer-events-none'} relative z-[10]`}
        aria-hidden={!isExpanded}
        data-ai-reasoning-content
      >
        <div className="mt-1 p-3 bg-muted/50 border border-border rounded text-xs font-mono text-foreground whitespace-pre-wrap leading-relaxed">
          {reasoning.text}
        </div>
      </div>
    </div>
  );
}
