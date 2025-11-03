/**
 * useSwipeGesture Hook
 * 
 * Detects swipe gestures on touch devices (left, right, up, down).
 * Useful for implementing swipeable tabs, carousels, and drawers on mobile.
 * 
 * @module hooks/useSwipeGesture
 */

'use client';

import { useRef, useEffect, RefObject } from 'react';

export type SwipeDirection = 'left' | 'right' | 'up' | 'down';

export interface SwipeCallbacks {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onSwipe?: (direction: SwipeDirection) => void;
}

export interface SwipeOptions {
  /** Minimum distance (px) for a swipe to register (default: 50) */
  threshold?: number;
  /** Maximum time (ms) for a swipe to register (default: 300) */
  maxDuration?: number;
  /** Prevent default touch behavior (default: true) */
  preventDefault?: boolean;
}

/**
 * Hook for detecting swipe gestures on touch devices
 * 
 * @param callbacks - Object containing swipe direction callbacks
 * @param options - Configuration options for swipe detection
 * @returns Ref to attach to the swipeable element
 * 
 * @example
 * ```tsx
 * const swipeRef = useSwipeGesture({
 *   onSwipeLeft: () => nextTab(),
 *   onSwipeRight: () => prevTab(),
 *   onSwipeUp: () => closeDrawer(),
 * }, { threshold: 100 });
 * 
 * return <div ref={swipeRef}>Swipeable content</div>;
 * ```
 */
export function useSwipeGesture<T extends HTMLElement = HTMLDivElement>(
  callbacks: SwipeCallbacks,
  options: SwipeOptions = {}
): RefObject<T> {
  const {
    threshold = 50,
    maxDuration = 300,
    preventDefault = true,
  } = options;

  const elementRef = useRef<T>(null);
  const touchStart = useRef<{ x: number; y: number; time: number } | null>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      touchStart.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
      };
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchStart.current) return;

      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - touchStart.current.x;
      const deltaY = touch.clientY - touchStart.current.y;
      const duration = Date.now() - touchStart.current.time;

      // Reset touch start
      touchStart.current = null;

      // Check if swipe was fast enough
      if (duration > maxDuration) return;

      // Determine if horizontal or vertical swipe
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      // Require minimum threshold
      if (absX < threshold && absY < threshold) return;

      let direction: SwipeDirection;

      // Horizontal swipe
      if (absX > absY) {
        direction = deltaX > 0 ? 'right' : 'left';
        
        if (direction === 'left' && callbacks.onSwipeLeft) {
          if (preventDefault) e.preventDefault();
          callbacks.onSwipeLeft();
        } else if (direction === 'right' && callbacks.onSwipeRight) {
          if (preventDefault) e.preventDefault();
          callbacks.onSwipeRight();
        }
      }
      // Vertical swipe
      else {
        direction = deltaY > 0 ? 'down' : 'up';
        
        if (direction === 'up' && callbacks.onSwipeUp) {
          if (preventDefault) e.preventDefault();
          callbacks.onSwipeUp();
        } else if (direction === 'down' && callbacks.onSwipeDown) {
          if (preventDefault) e.preventDefault();
          callbacks.onSwipeDown();
        }
      }

      // Call generic swipe callback
      if (callbacks.onSwipe) {
        callbacks.onSwipe(direction);
      }
    };

    const handleTouchCancel = () => {
      touchStart.current = null;
    };

    // Add event listeners
    element.addEventListener('touchstart', handleTouchStart, { passive: !preventDefault });
    element.addEventListener('touchend', handleTouchEnd, { passive: !preventDefault });
    element.addEventListener('touchcancel', handleTouchCancel);

    // Cleanup
    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchend', handleTouchEnd);
      element.removeEventListener('touchcancel', handleTouchCancel);
    };
  }, [callbacks, threshold, maxDuration, preventDefault]);

  return elementRef;
}

/**
 * Hook for detecting horizontal swipes only
 */
export function useHorizontalSwipe<T extends HTMLElement = HTMLDivElement>(
  onSwipeLeft?: () => void,
  onSwipeRight?: () => void,
  options?: SwipeOptions
): RefObject<T> {
  return useSwipeGesture<T>(
    {
      onSwipeLeft,
      onSwipeRight,
    },
    options
  );
}

/**
 * Hook for detecting vertical swipes only
 */
export function useVerticalSwipe<T extends HTMLElement = HTMLDivElement>(
  onSwipeUp?: () => void,
  onSwipeDown?: () => void,
  options?: SwipeOptions
): RefObject<T> {
  return useSwipeGesture<T>(
    {
      onSwipeUp,
      onSwipeDown,
    },
    options
  );
}
