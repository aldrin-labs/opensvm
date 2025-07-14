import { useCallback, useEffect, useRef, useState } from 'react';

interface UseScrollbarOptions {
  onScroll?: (scrollTop: number, scrollHeight: number, clientHeight: number) => void;
  autoScrollToBottom?: boolean;
  autoScrollThreshold?: number;
}

interface ScrollbarState {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
  isDragging: boolean;
  isAtBottom: boolean;
  scrollPercentage: number;
}

export function useScrollbar(options: UseScrollbarOptions = {}) {
  const {
    onScroll,
    autoScrollToBottom = true,
    autoScrollThreshold = 50,
  } = options;

  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  
  const [state, setState] = useState<ScrollbarState>({
    scrollTop: 0,
    scrollHeight: 0,
    clientHeight: 0,
    isDragging: false,
    isAtBottom: true,
    scrollPercentage: 0,
  });

  const [dragState, setDragState] = useState({
    startY: 0,
    startScrollTop: 0,
  });

  // Calculate scroll metrics
  const updateScrollMetrics = useCallback(() => {
    if (!containerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - autoScrollThreshold;
    const scrollPercentage = scrollHeight > clientHeight 
      ? scrollTop / (scrollHeight - clientHeight) 
      : 0;

    setState(prev => ({
      ...prev,
      scrollTop,
      scrollHeight,
      clientHeight,
      isAtBottom,
      scrollPercentage,
    }));

    onScroll?.(scrollTop, scrollHeight, clientHeight);
  }, [onScroll, autoScrollThreshold]);

  // Scroll to specific position
  const scrollTo = useCallback((position: number, smooth = true) => {
    if (!containerRef.current) return;

    containerRef.current.scrollTo({
      top: position,
      behavior: smooth ? 'smooth' : 'auto',
    });
  }, []);

  // Scroll to bottom
  const scrollToBottom = useCallback((smooth = true) => {
    if (!containerRef.current) return;

    const { scrollHeight, clientHeight } = containerRef.current;
    scrollTo(scrollHeight - clientHeight, smooth);
  }, [scrollTo]);

  // Scroll by specific amount
  const scrollBy = useCallback((delta: number, smooth = true) => {
    if (!containerRef.current) return;

    const newPosition = containerRef.current.scrollTop + delta;
    scrollTo(newPosition, smooth);
  }, [scrollTo]);

  // Handle mouse wheel
  const handleWheel = useCallback((e: WheelEvent) => {
    if (!containerRef.current || state.isDragging) return;

    e.preventDefault();
    const delta = e.deltaY;
    scrollBy(delta, false);
  }, [scrollBy, state.isDragging]);

  // Handle thumb drag start
  const handleThumbMouseDown = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current || !trackRef.current) return;

    e.preventDefault();
    e.stopPropagation();

    const startY = e.clientY;
    const startScrollTop = containerRef.current.scrollTop;

    setDragState({ startY, startScrollTop });
    setState(prev => ({ ...prev, isDragging: true }));

    // Add global mouse event listeners
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current || !trackRef.current) return;

      const deltaY = e.clientY - startY;
      const trackHeight = trackRef.current.clientHeight;
      const thumbHeight = thumbRef.current?.clientHeight || 0;
      const scrollableHeight = trackHeight - thumbHeight;
      const maxScrollTop = containerRef.current.scrollHeight - containerRef.current.clientHeight;

      if (scrollableHeight > 0) {
        const scrollRatio = deltaY / scrollableHeight;
        const newScrollTop = Math.max(0, Math.min(maxScrollTop, startScrollTop + (scrollRatio * maxScrollTop)));
        scrollTo(newScrollTop, false);
      }
    };

    const handleMouseUp = () => {
      setState(prev => ({ ...prev, isDragging: false }));
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [scrollTo]);

  // Handle track click
  const handleTrackClick = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current || !trackRef.current || !thumbRef.current) return;
    if (e.target === thumbRef.current) return;

    e.preventDefault();
    
    const trackRect = trackRef.current.getBoundingClientRect();
    const thumbHeight = thumbRef.current.clientHeight;
    const clickY = e.clientY - trackRect.top;
    const trackHeight = trackRect.height;
    
    // Calculate target scroll position
    const maxScrollTop = containerRef.current.scrollHeight - containerRef.current.clientHeight;
    const targetRatio = Math.max(0, Math.min(1, (clickY - thumbHeight / 2) / (trackHeight - thumbHeight)));
    const targetScrollTop = targetRatio * maxScrollTop;

    scrollTo(targetScrollTop, true);
  }, [scrollTo]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!containerRef.current) return;

    const { clientHeight } = containerRef.current;
    let handled = false;

    switch (e.key) {
      case 'ArrowUp':
        scrollBy(-40, true);
        handled = true;
        break;
      case 'ArrowDown':
        scrollBy(40, true);
        handled = true;
        break;
      case 'PageUp':
        scrollBy(-clientHeight * 0.8, true);
        handled = true;
        break;
      case 'PageDown':
      case ' ':
        scrollBy(clientHeight * 0.8, true);
        handled = true;
        break;
      case 'Home':
        scrollTo(0, true);
        handled = true;
        break;
      case 'End':
        scrollToBottom(true);
        handled = true;
        break;
    }

    if (handled) {
      e.preventDefault();
    }
  }, [scrollBy, scrollTo, scrollToBottom]);

  // Set up scroll event listener
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('scroll', updateScrollMetrics, { passive: true });
    return () => container.removeEventListener('scroll', updateScrollMetrics);
  }, [updateScrollMetrics]);

  // Set up wheel event listener
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // Set up keyboard event listener
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Update metrics on content changes
  useEffect(() => {
    updateScrollMetrics();
  }, [updateScrollMetrics]);

  // Auto-scroll to bottom on content changes
  useEffect(() => {
    if (autoScrollToBottom && state.isAtBottom && !state.isDragging) {
      requestAnimationFrame(() => {
        scrollToBottom(false);
      });
    }
  }, [autoScrollToBottom, state.isAtBottom, state.isDragging, scrollToBottom]);

  return {
    // Refs
    containerRef,
    contentRef,
    thumbRef,
    trackRef,
    
    // State
    ...state,
    
    // Actions
    scrollTo,
    scrollToBottom,
    scrollBy,
    
    // Event handlers
    handleThumbMouseDown,
    handleTrackClick,
    
    // Utils
    updateScrollMetrics,
  };
}