/**
 * Enhanced Mobile Gesture Detection System
 * 
 * Provides improved gesture detection with better accuracy and reduced
 * accidental triggers. Includes support for various gesture types and
 * customizable sensitivity settings.
 * 
 * @see docs/architecture/development-guidelines.md#mobile-optimizations
 */

import { useEffect, useRef, useCallback } from 'react';
import { accessibilityMessenger } from './accessibility-messaging';

/**
 * Gesture types supported by the system
 */
export enum GestureType {
  SWIPE_LEFT = 'swipe-left',
  SWIPE_RIGHT = 'swipe-right',
  SWIPE_UP = 'swipe-up',
  SWIPE_DOWN = 'swipe-down',
  TAP = 'tap',
  DOUBLE_TAP = 'double-tap',
  LONG_PRESS = 'long-press',
  PINCH = 'pinch',
  ZOOM = 'zoom'
}

/**
 * Gesture configuration options
 */
interface GestureConfig {
  /** Minimum distance for swipe gestures (px) */
  minSwipeDistance: number;
  /** Maximum time for swipe gestures (ms) */
  maxSwipeTime: number;
  /** Minimum velocity for swipe gestures (px/ms) */
  minSwipeVelocity: number;
  /** Maximum deviation from straight line for swipes (px) */
  maxSwipeDeviation: number;
  /** Time for long press detection (ms) */
  longPressTime: number;
  /** Maximum movement during long press (px) */
  longPressMaxMovement: number;
  /** Time between taps for double tap (ms) */
  doubleTapMaxTime: number;
  /** Maximum distance between taps for double tap (px) */
  doubleTapMaxDistance: number;
  /** Prevent default browser behavior */
  preventDefault: boolean;
  /** Enable haptic feedback if available */
  enableHaptics: boolean;
  /** Announce gestures to screen readers */
  announceGestures: boolean;
}

/**
 * Default gesture configuration
 */
const DEFAULT_CONFIG: GestureConfig = {
  minSwipeDistance: 50,
  maxSwipeTime: 500,
  minSwipeVelocity: 0.1,
  maxSwipeDeviation: 100,
  longPressTime: 500,
  longPressMaxMovement: 10,
  doubleTapMaxTime: 300,
  doubleTapMaxDistance: 30,
  preventDefault: true,
  enableHaptics: true,
  announceGestures: false
};

/**
 * Touch point information
 */
interface TouchPoint {
  x: number;
  y: number;
  timestamp: number;
  identifier: number;
}

/**
 * Gesture event data
 */
interface GestureEvent {
  type: GestureType;
  startPoint: TouchPoint;
  endPoint: TouchPoint;
  distance: number;
  duration: number;
  velocity: number;
  direction?: 'horizontal' | 'vertical';
  angle?: number;
  originalEvent: TouchEvent;
}

/**
 * Gesture handlers interface
 */
interface GestureHandlers {
  onSwipeLeft?: (event: GestureEvent) => void;
  onSwipeRight?: (event: GestureEvent) => void;
  onSwipeUp?: (event: GestureEvent) => void;
  onSwipeDown?: (event: GestureEvent) => void;
  onTap?: (event: GestureEvent) => void;
  onDoubleTap?: (event: GestureEvent) => void;
  onLongPress?: (event: GestureEvent) => void;
  onPinch?: (event: GestureEvent) => void;
  onZoom?: (event: GestureEvent) => void;
  onGestureStart?: (event: TouchEvent) => void;
  onGestureEnd?: (event: TouchEvent) => void;
}

/**
 * Enhanced gesture detector class
 */
export class EnhancedGestureDetector {
  private element: HTMLElement;
  private config: GestureConfig;
  private handlers: GestureHandlers;
  
  private touchStart: TouchPoint | null = null;
  private touchCurrent: TouchPoint | null = null;
  private lastTap: TouchPoint | null = null;
  private longPressTimer: NodeJS.Timeout | null = null;
  private isLongPressing = false;
  private isScrolling = false;
  private scrollThreshold = 10;

  constructor(
    element: HTMLElement,
    handlers: GestureHandlers,
    config: Partial<GestureConfig> = {}
  ) {
    this.element = element;
    this.handlers = handlers;
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    this.attachEventListeners();
  }

  /**
   * Attach touch event listeners
   */
  private attachEventListeners(): void {
    this.element.addEventListener('touchstart', this.handleTouchStart, { passive: false });
    this.element.addEventListener('touchmove', this.handleTouchMove, { passive: false });
    this.element.addEventListener('touchend', this.handleTouchEnd, { passive: false });
    this.element.addEventListener('touchcancel', this.handleTouchCancel, { passive: false });
  }

  /**
   * Remove touch event listeners
   */
  private removeEventListeners(): void {
    this.element.removeEventListener('touchstart', this.handleTouchStart);
    this.element.removeEventListener('touchmove', this.handleTouchMove);
    this.element.removeEventListener('touchend', this.handleTouchEnd);
    this.element.removeEventListener('touchcancel', this.handleTouchCancel);
  }

  /**
   * Handle touch start event
   */
  private handleTouchStart = (event: TouchEvent): void => {
    if (event.touches.length === 1) {
      const touch = event.touches[0];
      this.touchStart = {
        x: touch.clientX,
        y: touch.clientY,
        timestamp: Date.now(),
        identifier: touch.identifier
      };
      
      this.touchCurrent = { ...this.touchStart };
      this.isScrolling = false;
      
      // Start long press timer
      this.startLongPressTimer();
      
      // Call gesture start handler
      this.handlers.onGestureStart?.(event);
      
      if (this.config.preventDefault) {
        event.preventDefault();
      }
    }
  };

  /**
   * Handle touch move event
   */
  private handleTouchMove = (event: TouchEvent): void => {
    if (!this.touchStart || event.touches.length !== 1) return;
    
    const touch = event.touches[0];
    if (touch.identifier !== this.touchStart.identifier) return;
    
    this.touchCurrent = {
      x: touch.clientX,
      y: touch.clientY,
      timestamp: Date.now(),
      identifier: touch.identifier
    };
    
    // Check if user is scrolling
    const deltaX = Math.abs(this.touchCurrent.x - this.touchStart.x);
    const deltaY = Math.abs(this.touchCurrent.y - this.touchStart.y);
    
    if (deltaY > this.scrollThreshold && deltaY > deltaX * 2) {
      this.isScrolling = true;
      this.cancelLongPress();
    }
    
    // Cancel long press if moved too much
    const distance = this.calculateDistance(this.touchStart, this.touchCurrent);
    if (distance > this.config.longPressMaxMovement) {
      this.cancelLongPress();
    }
    
    if (this.config.preventDefault && !this.isScrolling) {
      event.preventDefault();
    }
  };

  /**
   * Handle touch end event
   */
  private handleTouchEnd = (event: TouchEvent): void => {
    if (!this.touchStart || !this.touchCurrent) return;
    
    this.cancelLongPress();
    
    const gestureEvent = this.createGestureEvent(event);
    
    // Don't process gestures if user was scrolling
    if (this.isScrolling) {
      this.reset();
      return;
    }
    
    // Detect gesture type
    const gestureType = this.detectGestureType(gestureEvent);
    
    if (gestureType) {
      this.handleGesture(gestureType, gestureEvent);
    }
    
    // Call gesture end handler
    this.handlers.onGestureEnd?.(event);
    
    this.reset();
  };

  /**
   * Handle touch cancel event
   */
  private handleTouchCancel = (event: TouchEvent): void => {
    this.cancelLongPress();
    this.reset();
    this.handlers.onGestureEnd?.(event);
  };

  /**
   * Start long press timer
   */
  private startLongPressTimer(): void {
    this.longPressTimer = setTimeout(() => {
      if (this.touchStart && this.touchCurrent && !this.isScrolling) {
        this.isLongPressing = true;
        const gestureEvent = this.createGestureEvent();
        this.handleGesture(GestureType.LONG_PRESS, gestureEvent);
      }
    }, this.config.longPressTime);
  }

  /**
   * Cancel long press timer
   */
  private cancelLongPress(): void {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
    this.isLongPressing = false;
  }

  /**
   * Create gesture event object
   */
  private createGestureEvent(originalEvent?: TouchEvent): GestureEvent {
    if (!this.touchStart || !this.touchCurrent) {
      throw new Error('Invalid touch state');
    }
    
    const distance = this.calculateDistance(this.touchStart, this.touchCurrent);
    const duration = this.touchCurrent.timestamp - this.touchStart.timestamp;
    const velocity = duration > 0 ? distance / duration : 0;
    const angle = this.calculateAngle(this.touchStart, this.touchCurrent);
    
    return {
      type: GestureType.TAP, // Will be overridden
      startPoint: this.touchStart,
      endPoint: this.touchCurrent,
      distance,
      duration,
      velocity,
      direction: Math.abs(this.touchCurrent.x - this.touchStart.x) > 
                Math.abs(this.touchCurrent.y - this.touchStart.y) ? 'horizontal' : 'vertical',
      angle,
      originalEvent: originalEvent || new TouchEvent('touchend')
    };
  }

  /**
   * Detect gesture type based on movement
   */
  private detectGestureType(gestureEvent: GestureEvent): GestureType | null {
    const { distance, duration, velocity, direction } = gestureEvent;
    const deltaX = gestureEvent.endPoint.x - gestureEvent.startPoint.x;
    const deltaY = gestureEvent.endPoint.y - gestureEvent.startPoint.y;
    
    // Check for swipe gestures
    if (distance >= this.config.minSwipeDistance &&
        duration <= this.config.maxSwipeTime &&
        velocity >= this.config.minSwipeVelocity) {
      
      if (direction === 'horizontal') {
        if (Math.abs(deltaY) <= this.config.maxSwipeDeviation) {
          return deltaX > 0 ? GestureType.SWIPE_RIGHT : GestureType.SWIPE_LEFT;
        }
      } else {
        if (Math.abs(deltaX) <= this.config.maxSwipeDeviation) {
          return deltaY > 0 ? GestureType.SWIPE_DOWN : GestureType.SWIPE_UP;
        }
      }
    }
    
    // Check for tap gestures
    if (distance < this.config.longPressMaxMovement && 
        duration < this.config.longPressTime &&
        !this.isLongPressing) {
      
      // Check for double tap
      if (this.lastTap &&
          Date.now() - this.lastTap.timestamp <= this.config.doubleTapMaxTime &&
          this.calculateDistance(this.lastTap, gestureEvent.startPoint) <= this.config.doubleTapMaxDistance) {
        
        this.lastTap = null; // Reset to prevent triple tap
        return GestureType.DOUBLE_TAP;
      }
      
      this.lastTap = gestureEvent.startPoint;
      return GestureType.TAP;
    }
    
    return null;
  }

  /**
   * Handle detected gesture
   */
  private handleGesture(type: GestureType, event: GestureEvent): void {
    event.type = type;
    
    // Provide haptic feedback if available
    if (this.config.enableHaptics && 'vibrate' in navigator) {
      navigator.vibrate(50);
    }
    
    // Announce gesture to screen readers if enabled
    if (this.config.announceGestures) {
      accessibilityMessenger.mobile.gestureDetected(type);
    }
    
    // Call appropriate handler
    switch (type) {
      case GestureType.SWIPE_LEFT:
        this.handlers.onSwipeLeft?.(event);
        break;
      case GestureType.SWIPE_RIGHT:
        this.handlers.onSwipeRight?.(event);
        break;
      case GestureType.SWIPE_UP:
        this.handlers.onSwipeUp?.(event);
        break;
      case GestureType.SWIPE_DOWN:
        this.handlers.onSwipeDown?.(event);
        break;
      case GestureType.TAP:
        this.handlers.onTap?.(event);
        break;
      case GestureType.DOUBLE_TAP:
        this.handlers.onDoubleTap?.(event);
        break;
      case GestureType.LONG_PRESS:
        this.handlers.onLongPress?.(event);
        break;
    }
  }

  /**
   * Calculate distance between two points
   */
  private calculateDistance(point1: TouchPoint, point2: TouchPoint): number {
    const deltaX = point2.x - point1.x;
    const deltaY = point2.y - point1.y;
    return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  }

  /**
   * Calculate angle between two points
   */
  private calculateAngle(point1: TouchPoint, point2: TouchPoint): number {
    const deltaX = point2.x - point1.x;
    const deltaY = point2.y - point1.y;
    return Math.atan2(deltaY, deltaX) * (180 / Math.PI);
  }

  /**
   * Reset gesture state
   */
  private reset(): void {
    this.touchStart = null;
    this.touchCurrent = null;
    this.isScrolling = false;
    this.isLongPressing = false;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<GestureConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Destroy gesture detector
   */
  destroy(): void {
    this.removeEventListeners();
    this.cancelLongPress();
    this.reset();
  }
}

/**
 * React hook for enhanced gesture detection
 */
export function useEnhancedGestures(
  handlers: GestureHandlers,
  config: Partial<GestureConfig> = {}
) {
  const elementRef = useRef<HTMLElement>(null);
  const detectorRef = useRef<EnhancedGestureDetector | null>(null);

  const updateHandlers = useCallback((newHandlers: GestureHandlers) => {
    if (detectorRef.current) {
      detectorRef.current.destroy();
    }
    
    if (elementRef.current) {
      detectorRef.current = new EnhancedGestureDetector(
        elementRef.current,
        newHandlers,
        config
      );
    }
  }, [config]);

  useEffect(() => {
    updateHandlers(handlers);
    
    return () => {
      if (detectorRef.current) {
        detectorRef.current.destroy();
      }
    };
  }, [handlers, updateHandlers]);

  return elementRef;
}

/**
 * Simplified hook for common swipe gestures
 */
export function useSwipeGestures(
  onSwipeLeft?: () => void,
  onSwipeRight?: () => void,
  onSwipeUp?: () => void,
  onSwipeDown?: () => void,
  config: Partial<GestureConfig> = {}
) {
  const handlers: GestureHandlers = {
    onSwipeLeft: onSwipeLeft ? () => onSwipeLeft() : undefined,
    onSwipeRight: onSwipeRight ? () => onSwipeRight() : undefined,
    onSwipeUp: onSwipeUp ? () => onSwipeUp() : undefined,
    onSwipeDown: onSwipeDown ? () => onSwipeDown() : undefined,
  };

  return useEnhancedGestures(handlers, {
    ...config,
    // More restrictive settings for swipe-only usage
    minSwipeDistance: config.minSwipeDistance || 60,
    maxSwipeDeviation: config.maxSwipeDeviation || 80,
    minSwipeVelocity: config.minSwipeVelocity || 0.15
  });
}