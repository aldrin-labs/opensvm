/**
 * Mobile optimization utilities for transaction explorer components
 */

import React from 'react';

// Mobile breakpoints
export const MOBILE_BREAKPOINTS = {
  xs: 320,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280
} as const;

// Touch gesture utilities
export class TouchGestureUtils {
  private static touchStartX = 0;
  private static touchStartY = 0;
  private static touchEndX = 0;
  private static touchEndY = 0;
  private static minSwipeDistance = 50;

  static handleTouchStart(event: TouchEvent): void {
    this.touchStartX = event.changedTouches[0].screenX;
    this.touchStartY = event.changedTouches[0].screenY;
  }

  static handleTouchEnd(event: TouchEvent): void {
    this.touchEndX = event.changedTouches[0].screenX;
    this.touchEndY = event.changedTouches[0].screenY;
  }

  static getSwipeDirection(): 'left' | 'right' | 'up' | 'down' | null {
    const deltaX = this.touchEndX - this.touchStartX;
    const deltaY = this.touchEndY - this.touchStartY;

    if (Math.abs(deltaX) < this.minSwipeDistance && Math.abs(deltaY) < this.minSwipeDistance) {
      return null;
    }

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      return deltaX > 0 ? 'right' : 'left';
    } else {
      return deltaY > 0 ? 'down' : 'up';
    }
  }

  static addSwipeListeners(
    element: HTMLElement,
    callbacks: {
      onSwipeLeft?: () => void;
      onSwipeRight?: () => void;
      onSwipeUp?: () => void;
      onSwipeDown?: () => void;
    }
  ): () => void {
    const handleTouchStart = (e: TouchEvent) => this.handleTouchStart(e);
    const handleTouchEnd = (e: TouchEvent) => {
      this.handleTouchEnd(e);
      const direction = this.getSwipeDirection();
      
      switch (direction) {
        case 'left':
          callbacks.onSwipeLeft?.();
          break;
        case 'right':
          callbacks.onSwipeRight?.();
          break;
        case 'up':
          callbacks.onSwipeUp?.();
          break;
        case 'down':
          callbacks.onSwipeDown?.();
          break;
      }
    };

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }
}

// Mobile viewport utilities
export class MobileViewportUtils {
  static isMobile(): boolean {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < MOBILE_BREAKPOINTS.md;
  }

  static isTablet(): boolean {
    if (typeof window === 'undefined') return false;
    return window.innerWidth >= MOBILE_BREAKPOINTS.md && window.innerWidth < MOBILE_BREAKPOINTS.lg;
  }

  static isDesktop(): boolean {
    if (typeof window === 'undefined') return false;
    return window.innerWidth >= MOBILE_BREAKPOINTS.lg;
  }

  static getViewportSize(): { width: number; height: number } {
    if (typeof window === 'undefined') return { width: 0, height: 0 };
    return {
      width: window.innerWidth,
      height: window.innerHeight
    };
  }

  static getOptimalColumnCount(containerWidth: number, minColumnWidth: number = 300): number {
    return Math.max(1, Math.floor(containerWidth / minColumnWidth));
  }

  static getResponsiveGridCols(containerWidth: number): string {
    if (containerWidth < MOBILE_BREAKPOINTS.sm) return 'grid-cols-1';
    if (containerWidth < MOBILE_BREAKPOINTS.md) return 'grid-cols-1';
    if (containerWidth < MOBILE_BREAKPOINTS.lg) return 'grid-cols-2';
    return 'grid-cols-3';
  }
}

// Mobile-optimized component utilities
export class MobileComponentUtils {
  static getResponsiveTextSize(baseSize: string): string {
    const sizeMap: Record<string, string> = {
      'text-xs': 'text-sm md:text-xs',
      'text-sm': 'text-base md:text-sm',
      'text-base': 'text-lg md:text-base',
      'text-lg': 'text-xl md:text-lg',
      'text-xl': 'text-2xl md:text-xl',
      'text-2xl': 'text-3xl md:text-2xl'
    };
    return sizeMap[baseSize] || baseSize;
  }

  static getResponsivePadding(basePadding: string): string {
    const paddingMap: Record<string, string> = {
      'p-2': 'p-4 md:p-2',
      'p-3': 'p-4 md:p-3',
      'p-4': 'p-6 md:p-4',
      'p-6': 'p-8 md:p-6',
      'px-2': 'px-4 md:px-2',
      'px-3': 'px-4 md:px-3',
      'px-4': 'px-6 md:px-4',
      'py-2': 'py-3 md:py-2',
      'py-3': 'py-4 md:py-3'
    };
    return paddingMap[basePadding] || basePadding;
  }

  static getResponsiveSpacing(baseSpacing: string): string {
    const spacingMap: Record<string, string> = {
      'space-x-2': 'space-x-3 md:space-x-2',
      'space-x-3': 'space-x-4 md:space-x-3',
      'space-x-4': 'space-x-6 md:space-x-4',
      'space-y-2': 'space-y-3 md:space-y-2',
      'space-y-3': 'space-y-4 md:space-y-3',
      'space-y-4': 'space-y-6 md:space-y-4'
    };
    return spacingMap[baseSpacing] || baseSpacing;
  }

  static getTouchFriendlyButtonClass(): string {
    return 'min-h-[44px] min-w-[44px] touch-manipulation';
  }

  static getResponsiveButtonSize(baseSize: string): string {
    const sizeMap: Record<string, string> = {
      'h-8': 'h-12 md:h-8',
      'h-9': 'h-12 md:h-9',
      'h-10': 'h-12 md:h-10',
      'h-11': 'h-14 md:h-11',
      'h-12': 'h-14 md:h-12'
    };
    return sizeMap[baseSize] || baseSize;
  }
}

// Mobile graph optimization utilities
export class MobileGraphUtils {
  static getOptimalGraphDimensions(containerWidth: number, containerHeight: number): {
    width: number;
    height: number;
  } {
    if (containerWidth < MOBILE_BREAKPOINTS.md) {
      // Mobile: prioritize width, adjust height
      return {
        width: Math.min(containerWidth - 32, 400),
        height: Math.min(containerHeight - 100, 300)
      };
    } else if (containerWidth < MOBILE_BREAKPOINTS.lg) {
      // Tablet: balanced dimensions
      return {
        width: Math.min(containerWidth - 64, 600),
        height: Math.min(containerHeight - 120, 400)
      };
    } else {
      // Desktop: use provided dimensions
      return {
        width: containerWidth,
        height: containerHeight
      };
    }
  }

  static getMobileNodeSize(baseSize: number, isMobile: boolean): number {
    return isMobile ? Math.max(baseSize * 1.5, 12) : baseSize;
  }

  static getMobileEdgeWidth(baseWidth: number, isMobile: boolean): number {
    return isMobile ? Math.max(baseWidth * 1.2, 2) : baseWidth;
  }

  static getMobileFontSize(baseFontSize: number, isMobile: boolean): number {
    return isMobile ? Math.max(baseFontSize * 1.2, 12) : baseFontSize;
  }

  static shouldShowLabels(isMobile: boolean, nodeCount: number): boolean {
    if (!isMobile) return true;
    return nodeCount <= 20; // Hide labels on mobile if too many nodes
  }

  static getOptimalZoomLimits(isMobile: boolean): { min: number; max: number } {
    return isMobile 
      ? { min: 0.5, max: 3 }  // More zoom range on mobile
      : { min: 0.1, max: 10 }; // Standard zoom range on desktop
  }
}

// Mobile table optimization utilities
export class MobileTableUtils {
  static getResponsiveColumns<T>(
    columns: Array<{ key: keyof T; header: string; mobile?: boolean }>,
    isMobile: boolean
  ): Array<{ key: keyof T; header: string }> {
    if (!isMobile) {
      return columns.map(({ key, header }) => ({ key, header }));
    }
    
    // On mobile, only show columns marked as mobile-friendly
    return columns
      .filter(col => col.mobile !== false)
      .map(({ key, header }) => ({ key, header }));
  }

  static getCardLayoutBreakpoint(): string {
    return 'md'; // Switch to card layout below md breakpoint
  }

  static getMobileTableHeight(): string {
    return 'h-[60vh]'; // Use viewport height on mobile
  }
}

// Mobile modal utilities
export class MobileModalUtils {
  static getModalClasses(isMobile: boolean): string {
    if (isMobile) {
      return 'fixed inset-0 z-50 bg-background p-4 overflow-y-auto';
    }
    return 'fixed inset-0 z-50 flex items-center justify-center p-4';
  }

  static getModalContentClasses(isMobile: boolean): string {
    if (isMobile) {
      return 'w-full max-w-none bg-background rounded-lg border border-border';
    }
    return 'w-full max-w-2xl bg-background rounded-lg border border-border shadow-lg';
  }

  static shouldUseFullScreen(isMobile: boolean, contentHeight?: number): boolean {
    if (!isMobile) return false;
    if (!contentHeight) return true;
    return contentHeight > window.innerHeight * 0.8;
  }
}

// React hooks for mobile optimization
export function useMobileDetection() {
  const [isMobile, setIsMobile] = React.useState(false);
  const [isTablet, setIsTablet] = React.useState(false);
  const [viewportSize, setViewportSize] = React.useState({ width: 0, height: 0 });

  React.useEffect(() => {
    const updateMobileState = () => {
      setIsMobile(MobileViewportUtils.isMobile());
      setIsTablet(MobileViewportUtils.isTablet());
      setViewportSize(MobileViewportUtils.getViewportSize());
    };

    updateMobileState();
    window.addEventListener('resize', updateMobileState);
    window.addEventListener('orientationchange', updateMobileState);

    return () => {
      window.removeEventListener('resize', updateMobileState);
      window.removeEventListener('orientationchange', updateMobileState);
    };
  }, []);

  return {
    isMobile,
    isTablet,
    isDesktop: !isMobile && !isTablet,
    viewportSize,
    orientation: viewportSize.width > viewportSize.height ? 'landscape' : 'portrait'
  };
}

export function useSwipeGestures(
  elementRef: React.RefObject<HTMLElement>,
  callbacks: {
    onSwipeLeft?: () => void;
    onSwipeRight?: () => void;
    onSwipeUp?: () => void;
    onSwipeDown?: () => void;
  }
) {
  React.useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const cleanup = TouchGestureUtils.addSwipeListeners(element, callbacks);
    return cleanup;
  }, [elementRef, callbacks]);
}

export function useResponsiveLayout(containerRef: React.RefObject<HTMLElement>) {
  const [layout, setLayout] = React.useState({
    columns: 1,
    itemWidth: 300,
    containerWidth: 0
  });

  React.useEffect(() => {
    const updateLayout = () => {
      if (!containerRef.current) return;

      const containerWidth = containerRef.current.offsetWidth;
      const columns = MobileViewportUtils.getOptimalColumnCount(containerWidth);
      const itemWidth = Math.floor(containerWidth / columns) - 16; // Account for gaps

      setLayout({
        columns,
        itemWidth,
        containerWidth
      });
    };

    updateLayout();
    window.addEventListener('resize', updateLayout);
    
    return () => window.removeEventListener('resize', updateLayout);
  }, [containerRef]);

  return layout;
}

// Mobile-optimized component props
export interface MobileOptimizedProps {
  isMobile?: boolean;
  isTablet?: boolean;
  viewportSize?: { width: number; height: number };
  orientation?: 'portrait' | 'landscape';
}

// Mobile-friendly event handlers
export class MobileEventUtils {
  static createTouchFriendlyClickHandler(
    onClick: () => void,
    options: {
      preventDefault?: boolean;
      stopPropagation?: boolean;
    } = {}
  ) {
    return (event: React.MouseEvent | React.TouchEvent) => {
      if (options.preventDefault) {
        event.preventDefault();
      }
      if (options.stopPropagation) {
        event.stopPropagation();
      }
      onClick();
    };
  }

  static addTouchFeedback(element: HTMLElement): void {
    element.style.touchAction = 'manipulation';
    element.style.userSelect = 'none';
    // @ts-ignore: webkitTapHighlightColor is supported in some browsers
    element.style.webkitTapHighlightColor = 'transparent';
    
    const addActiveClass = () => element.classList.add('touch-active');
    const removeActiveClass = () => element.classList.remove('touch-active');

    element.addEventListener('touchstart', addActiveClass, { passive: true });
    element.addEventListener('touchend', removeActiveClass, { passive: true });
    element.addEventListener('touchcancel', removeActiveClass, { passive: true });
  }
}

const mobileUtils = {
  TouchGestureUtils,
  MobileViewportUtils,
  MobileComponentUtils,
  MobileGraphUtils,
  MobileTableUtils,
  MobileModalUtils,
  MobileEventUtils
};

export default mobileUtils;