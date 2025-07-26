/**
 * Adaptive Tooltip Component
 * 
 * Provides intelligent tooltip positioning and sizing that adapts to:
 * - Screen size and viewport constraints
 * - Content length and complexity
 * - Mobile vs desktop environments
 * - Accessibility requirements
 * 
 * @see docs/architecture/components.md#tooltip-patterns
 */

'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { useAccessibilityMessenger } from '@/lib/accessibility-messaging';

/**
 * Tooltip positioning options
 */
export type TooltipPosition = 
  | 'top' | 'top-start' | 'top-end'
  | 'bottom' | 'bottom-start' | 'bottom-end'
  | 'left' | 'left-start' | 'left-end'
  | 'right' | 'right-start' | 'right-end'
  | 'auto';

/**
 * Tooltip trigger types
 */
export type TooltipTrigger = 'hover' | 'click' | 'focus' | 'manual';

/**
 * Tooltip content types
 */
export interface TooltipContent {
  title?: string;
  description?: string;
  content?: React.ReactNode;
  actions?: Array<{
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary' | 'danger';
  }>;
}

/**
 * Tooltip configuration
 */
interface TooltipConfig {
  /** Preferred position */
  position: TooltipPosition;
  /** Trigger behavior */
  trigger: TooltipTrigger | TooltipTrigger[];
  /** Delay before showing (ms) */
  showDelay: number;
  /** Delay before hiding (ms) */
  hideDelay: number;
  /** Maximum width in pixels */
  maxWidth: number;
  /** Whether to show arrow */
  showArrow: boolean;
  /** Whether to close on outside click */
  closeOnOutsideClick: boolean;
  /** Whether to close on escape key */
  closeOnEscape: boolean;
  /** Custom offset from trigger element */
  offset: number;
  /** Whether to adapt to mobile */
  adaptToMobile: boolean;
  /** Whether to prevent overflow */
  preventOverflow: boolean;
  /** Custom z-index */
  zIndex: number;
}

/**
 * Default tooltip configuration
 */
const DEFAULT_CONFIG: TooltipConfig = {
  position: 'auto',
  trigger: 'hover',
  showDelay: 500,
  hideDelay: 200,
  maxWidth: 320,
  showArrow: true,
  closeOnOutsideClick: true,
  closeOnEscape: true,
  offset: 8,
  adaptToMobile: true,
  preventOverflow: true,
  zIndex: 9999
};

/**
 * Viewport information
 */
interface ViewportInfo {
  width: number;
  height: number;
  isMobile: boolean;
  isTablet: boolean;
}

/**
 * Calculated position information
 */
interface PositionInfo {
  position: TooltipPosition;
  x: number;
  y: number;
  maxWidth: number;
  maxHeight: number;
  arrowPosition?: {
    x: number;
    y: number;
    side: 'top' | 'bottom' | 'left' | 'right';
  };
}

/**
 * Adaptive Tooltip Props
 */
interface AdaptiveTooltipProps {
  /** Tooltip content */
  content: TooltipContent | string | React.ReactNode;
  /** Children element that triggers the tooltip */
  children: React.ReactNode;
  /** Configuration options */
  config?: Partial<TooltipConfig>;
  /** Whether tooltip is open (for manual control) */
  open?: boolean;
  /** Callback when tooltip opens/closes */
  onOpenChange?: (open: boolean) => void;
  /** Custom class name */
  className?: string;
  /** Custom content class name */
  contentClassName?: string;
  /** Disabled state */
  disabled?: boolean;
}

/**
 * Adaptive Tooltip Component
 */
export const AdaptiveTooltip: React.FC<AdaptiveTooltipProps> = ({
  content,
  children,
  config: userConfig = {},
  open: controlledOpen,
  onOpenChange,
  className,
  contentClassName,
  disabled = false
}) => {
  const config = useMemo(() => ({ ...DEFAULT_CONFIG, ...userConfig }), [userConfig]);
  const [isOpen, setIsOpen] = useState(false);
  const [positionInfo, setPositionInfo] = useState<PositionInfo | null>(null);
  const [viewportInfo, setViewportInfo] = useState<ViewportInfo>({
    width: 0,
    height: 0,
    isMobile: false,
    isTablet: false
  });

  const triggerRef = useRef<HTMLElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const showTimeoutRef = useRef<NodeJS.Timeout>();
  const hideTimeoutRef = useRef<NodeJS.Timeout>();

  const accessibility = useAccessibilityMessenger();

  // Determine if tooltip should be open
  const shouldBeOpen = controlledOpen !== undefined ? controlledOpen : isOpen;

  /**
   * Update viewport information
   */
  const updateViewportInfo = useCallback(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    setViewportInfo({
      width,
      height,
      isMobile: width < 768,
      isTablet: width >= 768 && width < 1024
    });
  }, []);

  /**
   * Calculate optimal tooltip position
   */
  const calculatePosition = useCallback((): PositionInfo | null => {
    if (!triggerRef.current || !shouldBeOpen) return null;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const { width: viewportWidth, height: viewportHeight, isMobile } = viewportInfo;
    
    // Adjust max width for mobile
    const maxWidth = isMobile && config.adaptToMobile 
      ? Math.min(config.maxWidth, viewportWidth - 32)
      : config.maxWidth;

    const maxHeight = viewportHeight * 0.6; // Max 60% of viewport height

    // Calculate available space in each direction
    const spaceTop = triggerRect.top;
    const spaceBottom = viewportHeight - triggerRect.bottom;
    const spaceLeft = triggerRect.left;
    const spaceRight = viewportWidth - triggerRect.right;

    let position = config.position;
    let x = 0;
    let y = 0;

    // Auto-position logic
    if (position === 'auto') {
      if (spaceBottom >= spaceTop && spaceBottom >= 100) {
        position = 'bottom';
      } else if (spaceTop >= 100) {
        position = 'top';
      } else if (spaceRight >= spaceLeft && spaceRight >= 200) {
        position = 'right';
      } else if (spaceLeft >= 200) {
        position = 'left';
      } else {
        // Fallback to bottom with scrolling
        position = 'bottom';
      }
    }

    // Calculate position based on determined placement
    switch (position) {
      case 'top':
      case 'top-start':
      case 'top-end':
        y = triggerRect.top - config.offset;
        x = position === 'top-start' ? triggerRect.left :
            position === 'top-end' ? triggerRect.right - maxWidth :
            triggerRect.left + triggerRect.width / 2 - maxWidth / 2;
        break;

      case 'bottom':
      case 'bottom-start':
      case 'bottom-end':
        y = triggerRect.bottom + config.offset;
        x = position === 'bottom-start' ? triggerRect.left :
            position === 'bottom-end' ? triggerRect.right - maxWidth :
            triggerRect.left + triggerRect.width / 2 - maxWidth / 2;
        break;

      case 'left':
      case 'left-start':
      case 'left-end':
        x = triggerRect.left - maxWidth - config.offset;
        y = position === 'left-start' ? triggerRect.top :
            position === 'left-end' ? triggerRect.bottom - maxHeight :
            triggerRect.top + triggerRect.height / 2 - maxHeight / 2;
        break;

      case 'right':
      case 'right-start':
      case 'right-end':
        x = triggerRect.right + config.offset;
        y = position === 'right-start' ? triggerRect.top :
            position === 'right-end' ? triggerRect.bottom - maxHeight :
            triggerRect.top + triggerRect.height / 2 - maxHeight / 2;
        break;
    }

    // Prevent overflow
    if (config.preventOverflow) {
      x = Math.max(8, Math.min(x, viewportWidth - maxWidth - 8));
      y = Math.max(8, Math.min(y, viewportHeight - maxHeight - 8));
    }

    // Calculate arrow position
    let arrowPosition: PositionInfo['arrowPosition'];
    if (config.showArrow) {
      const arrowSize = 8;
      const triggerCenterX = triggerRect.left + triggerRect.width / 2;
      const triggerCenterY = triggerRect.top + triggerRect.height / 2;

      if (position.startsWith('top') || position.startsWith('bottom')) {
        arrowPosition = {
          x: Math.max(arrowSize, Math.min(triggerCenterX - x, maxWidth - arrowSize)),
          y: position.startsWith('top') ? maxHeight : -arrowSize,
          side: position.startsWith('top') ? 'bottom' : 'top'
        };
      } else {
        arrowPosition = {
          x: position.startsWith('left') ? maxWidth : -arrowSize,
          y: Math.max(arrowSize, Math.min(triggerCenterY - y, maxHeight - arrowSize)),
          side: position.startsWith('left') ? 'right' : 'left'
        };
      }
    }

    return {
      position,
      x,
      y,
      maxWidth,
      maxHeight,
      arrowPosition
    };
  }, [config, viewportInfo, shouldBeOpen]);

  /**
   * Show tooltip
   */
  const showTooltip = useCallback(() => {
    if (disabled) return;

    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = undefined;
    }

    showTimeoutRef.current = setTimeout(() => {
      setIsOpen(true);
      onOpenChange?.(true);
      
      if (config.trigger.includes('focus')) {
        accessibility.announce('Tooltip opened');
      }
    }, config.showDelay);
  }, [disabled, config.showDelay, config.trigger, onOpenChange, accessibility]);

  /**
   * Hide tooltip
   */
  const hideTooltip = useCallback(() => {
    if (showTimeoutRef.current) {
      clearTimeout(showTimeoutRef.current);
      showTimeoutRef.current = undefined;
    }

    hideTimeoutRef.current = setTimeout(() => {
      setIsOpen(false);
      onOpenChange?.(false);
    }, config.hideDelay);
  }, [config.hideDelay, onOpenChange]);

  /**
   * Handle trigger events
   */
  const handleTriggerEvents = useMemo(() => {
    const triggers = Array.isArray(config.trigger) ? config.trigger : [config.trigger];
    const events: Record<string, any> = {};

    if (triggers.includes('hover')) {
      events.onMouseEnter = showTooltip;
      events.onMouseLeave = hideTooltip;
    }

    if (triggers.includes('focus')) {
      events.onFocus = showTooltip;
      events.onBlur = hideTooltip;
    }

    if (triggers.includes('click')) {
      events.onClick = (e: React.MouseEvent) => {
        e.preventDefault();
        if (shouldBeOpen) {
          hideTooltip();
        } else {
          showTooltip();
        }
      };
    }

    return events;
  }, [config.trigger, showTooltip, hideTooltip, shouldBeOpen]);

  /**
   * Handle outside click
   */
  const handleOutsideClick = useCallback((event: MouseEvent) => {
    if (config.closeOnOutsideClick && shouldBeOpen) {
      const target = event.target as Node;
      if (
        triggerRef.current && !triggerRef.current.contains(target) &&
        tooltipRef.current && !tooltipRef.current.contains(target)
      ) {
        hideTooltip();
      }
    }
  }, [config.closeOnOutsideClick, shouldBeOpen, hideTooltip]);

  /**
   * Handle escape key
   */
  const handleEscapeKey = useCallback((event: KeyboardEvent) => {
    if (config.closeOnEscape && shouldBeOpen && event.key === 'Escape') {
      hideTooltip();
    }
  }, [config.closeOnEscape, shouldBeOpen, hideTooltip]);

  // Update viewport info on mount and resize
  useEffect(() => {
    updateViewportInfo();
    window.addEventListener('resize', updateViewportInfo);
    return () => window.removeEventListener('resize', updateViewportInfo);
  }, [updateViewportInfo]);

  // Calculate position when tooltip should be shown
  useEffect(() => {
    if (shouldBeOpen) {
      const position = calculatePosition();
      setPositionInfo(position);
    }
  }, [shouldBeOpen, calculatePosition]);

  // Add/remove global event listeners
  useEffect(() => {
    if (shouldBeOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('keydown', handleEscapeKey);
      
      return () => {
        document.removeEventListener('mousedown', handleOutsideClick);
        document.removeEventListener('keydown', handleEscapeKey);
      };
    }
  }, [shouldBeOpen, handleOutsideClick, handleEscapeKey]);

  // Cleanup timeouts
  useEffect(() => {
    return () => {
      if (showTimeoutRef.current) clearTimeout(showTimeoutRef.current);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, []);

  /**
   * Render tooltip content
   */
  const renderContent = () => {
    if (typeof content === 'string') {
      return <div className="text-sm">{content}</div>;
    }

    if (React.isValidElement(content)) {
      return content;
    }

    const tooltipContent = content as TooltipContent;
    return (
      <div className="space-y-2">
        {tooltipContent.title && (
          <div className="font-semibold text-sm">{tooltipContent.title}</div>
        )}
        {tooltipContent.description && (
          <div className="text-sm text-gray-600 dark:text-gray-300">
            {tooltipContent.description}
          </div>
        )}
        {tooltipContent.content && (
          <div>{tooltipContent.content}</div>
        )}
        {tooltipContent.actions && tooltipContent.actions.length > 0 && (
          <div className="flex gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
            {tooltipContent.actions.map((action, index) => (
              <button
                key={index}
                onClick={action.onClick}
                className={cn(
                  'px-2 py-1 text-xs rounded transition-colors',
                  action.variant === 'primary' && 'bg-blue-500 text-white hover:bg-blue-600',
                  action.variant === 'danger' && 'bg-red-500 text-white hover:bg-red-600',
                  (!action.variant || action.variant === 'secondary') && 
                    'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                )}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  /**
   * Render tooltip portal
   */
  const renderTooltip = () => {
    if (!shouldBeOpen || !positionInfo) return null;

    const tooltipElement = (
      <div
        ref={tooltipRef}
        className={cn(
          'fixed bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700',
          'rounded-lg shadow-lg p-3 text-gray-900 dark:text-gray-100',
          'animate-in fade-in-0 zoom-in-95 duration-200',
          viewportInfo.isMobile && config.adaptToMobile && 'mx-2',
          contentClassName
        )}
        style={{
          left: positionInfo.x,
          top: positionInfo.y,
          maxWidth: positionInfo.maxWidth,
          maxHeight: positionInfo.maxHeight,
          zIndex: config.zIndex
        }}
        role="tooltip"
        aria-hidden={!shouldBeOpen}
      >
        {renderContent()}
        
        {config.showArrow && positionInfo.arrowPosition && (
          <div
            className={cn(
              'absolute w-2 h-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700',
              'rotate-45',
              positionInfo.arrowPosition.side === 'top' && 'border-b-0 border-r-0',
              positionInfo.arrowPosition.side === 'bottom' && 'border-t-0 border-l-0',
              positionInfo.arrowPosition.side === 'left' && 'border-t-0 border-r-0',
              positionInfo.arrowPosition.side === 'right' && 'border-b-0 border-l-0'
            )}
            style={{
              left: positionInfo.arrowPosition.x - 4,
              top: positionInfo.arrowPosition.y - 4
            }}
          />
        )}
      </div>
    );

    return createPortal(tooltipElement, document.body);
  };

  return (
    <>
      {React.cloneElement(children as React.ReactElement, {
        ref: triggerRef,
        className: cn((children as React.ReactElement).props.className, className),
        ...handleTriggerEvents,
        'aria-describedby': shouldBeOpen ? 'adaptive-tooltip' : undefined
      })}
      {renderTooltip()}
    </>
  );
};

export default AdaptiveTooltip;