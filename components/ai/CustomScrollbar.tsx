import React, { forwardRef } from 'react';
import { useScrollbar } from './hooks/useScrollbar';
import { cn } from '@/lib/utils';

interface CustomScrollbarProps {
  children: React.ReactNode;
  className?: string;
  onScroll?: (scrollTop: number, scrollHeight: number, clientHeight: number) => void;
  autoScrollToBottom?: boolean;
  autoScrollThreshold?: number;
  showScrollbar?: boolean;
  ariaLabel?: string;
}

export const CustomScrollbar = forwardRef<HTMLDivElement, CustomScrollbarProps>(({
  children,
  className,
  onScroll,
  autoScrollToBottom = true,
  autoScrollThreshold = 50,
  showScrollbar = true,
  ariaLabel = "Scrollable content",
}, forwardedRef) => {
  const {
    containerRef,
    contentRef,
    thumbRef,
    trackRef,
    scrollTop,
    scrollHeight,
    clientHeight,
    isDragging,
    isAtBottom,
    scrollPercentage,
    handleThumbMouseDown,
    handleTrackClick,
  } = useScrollbar({
    onScroll,
    autoScrollToBottom,
    autoScrollThreshold,
  });

  // Calculate if scrollbar should be visible
  const isScrollable = scrollHeight > clientHeight;
  const shouldShowScrollbar = showScrollbar && isScrollable;


  // Calculate thumb dimensions and position
  const thumbHeight = isScrollable 
    ? Math.max(30, (clientHeight / scrollHeight) * clientHeight)
    : 0;
  
  const thumbTop = isScrollable 
    ? (scrollTop / (scrollHeight - clientHeight)) * (clientHeight - thumbHeight)
    : 0;

  // Combine refs
  React.useImperativeHandle(forwardedRef, () => containerRef.current!);

  return (
    <div className="relative flex-1 min-h-0">
      {/* Scrollable Content Container */}
      <div
        ref={containerRef}
        className={cn(
          "flex-1 min-h-0 overflow-y-auto overflow-x-hidden focus:outline-none",
          "scrollbar-hide", // Hide native scrollbars
          className
        )}
        role="region"
        aria-label={ariaLabel}
        tabIndex={0}
        style={{
          scrollbarWidth: 'none', // Firefox
          msOverflowStyle: 'none', // IE/Edge
        }}
      >
        <div ref={contentRef} className="min-h-full">
          {children}
        </div>
      </div>

      {/* Custom Scrollbar Track */}
      {shouldShowScrollbar && (
        <div
          ref={trackRef}
          className={cn(
            "absolute right-0 top-0 bottom-0 w-3 cursor-pointer z-[250]",
            "scrollbar-track",
            "transition-opacity duration-200",
            isDragging ? "opacity-100" : "opacity-60 hover:opacity-100"
          )}
          onClick={handleTrackClick}
          role="scrollbar"
          aria-controls={ariaLabel}
          aria-valuenow={Math.round(scrollPercentage * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Scroll position: ${Math.round(scrollPercentage * 100)}%`}
        >
          {/* Track Background */}
          <div className="absolute inset-x-0 inset-y-2 rounded-full scrollbar-track-bg" />
          
          {/* Scroll Thumb */}
          <div
            ref={thumbRef}
            className={cn(
              "absolute inset-x-0 rounded-full cursor-grab active:cursor-grabbing",
              "scrollbar-thumb",
              "transition-colors duration-150",
              isDragging && "scrollbar-thumb-active"
            )}
            style={{
              height: `${thumbHeight}px`,
              top: `${thumbTop + 8}px`, // Account for track padding
            }}
            onMouseDown={handleThumbMouseDown}
            role="slider"
            aria-label="Drag to scroll"
            tabIndex={0}
            onKeyDown={(e) => {
              // Allow keyboard interaction with thumb
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                containerRef.current?.focus();
              }
            }}
          >
            {/* Thumb inner element for visual styling */}
            <div className="absolute inset-0 rounded-full scrollbar-thumb-inner" />
          </div>

          {/* Scroll position indicator */}
          {!isAtBottom && (
            <div 
              className="absolute right-4 scrollbar-position-indicator"
              style={{ top: `${thumbTop + thumbHeight / 2}px` }}
            >
              <div className="w-1 h-1 rounded-full scrollbar-indicator-dot" />
            </div>
          )}
        </div>
      )}

      {/* Focus indicator for keyboard navigation */}
      <div 
        className={cn(
          "absolute inset-0 pointer-events-none border-2 border-transparent rounded",
          "transition-colors duration-150",
          containerRef.current === document.activeElement && "scrollbar-focus-ring"
        )}
      />
    </div>
  );
});

CustomScrollbar.displayName = 'CustomScrollbar';