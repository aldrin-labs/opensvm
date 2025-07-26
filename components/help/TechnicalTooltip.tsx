'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  InfoIcon, 
  HelpCircleIcon, 
  BookOpenIcon, 
  AlertTriangleIcon,
  CheckCircleIcon,
  ZapIcon,
  CopyIcon,
  CheckIcon,
  ExternalLinkIcon
} from 'lucide-react';
import { useAccessibility } from '@/lib/accessibility-utils';
import { useMobileDetection } from '@/lib/mobile-utils';

interface TechnicalTooltipProps {
  term: string;
  definition: string;
  explanation?: React.ReactNode;
  examples?: string[];
  relatedTerms?: string[];
  type?: 'concept' | 'warning' | 'tip' | 'technical';
  children?: React.ReactNode;
  className?: string;
  showIcon?: boolean;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'auto';
}

const TechnicalTooltip: React.FC<TechnicalTooltipProps> = ({
  term,
  definition,
  explanation,
  examples = [],
  relatedTerms = [],
  type = 'concept',
  children,
  className = '',
  showIcon = true,
  position = 'auto'
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [actualPosition, setActualPosition] = useState<'top' | 'bottom' | 'left' | 'right'>('top');
  const [copiedExample, setCopiedExample] = useState<number | null>(null);
  
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  
  const { announceToScreenReader, isTouchDevice } = useAccessibility();
  const { isMobile } = useMobileDetection();

  // Calculate optimal position
  const calculatePosition = () => {
    if (!triggerRef.current || position !== 'auto') {
      return position as 'top' | 'bottom' | 'left' | 'right';
    }

    const rect = triggerRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    
    const spaceAbove = rect.top;
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceLeft = rect.left;
    const spaceRight = viewportWidth - rect.right;
    
    // Prefer top for mobile, bottom for desktop
    if (isMobile) {
      if (spaceAbove > 250) return 'top';
      if (spaceBelow > 250) return 'bottom';
    } else {
      if (spaceBelow > 200) return 'bottom';
      if (spaceAbove > 200) return 'top';
    }
    
    if (spaceRight > 350) return 'right';
    if (spaceLeft > 350) return 'left';
    
    return 'bottom';
  };

  const showTooltip = () => {
    setActualPosition(calculatePosition());
    setIsVisible(true);
    announceToScreenReader(`Definition opened: ${term}`);
  };

  const hideTooltip = useCallback(() => {
    setIsVisible(false);
    announceToScreenReader('Definition closed');
  }, [announceToScreenReader]);

  const copyExample = async (example: string, index: number) => {
    try {
      await navigator.clipboard.writeText(example);
      setCopiedExample(index);
      setTimeout(() => setCopiedExample(null), 2000);
      announceToScreenReader('Example copied to clipboard');
    } catch (err) {
      console.error('Failed to copy example:', err);
    }
  };

  const getTypeIcon = () => {
    switch (type) {
      case 'concept':
        return <BookOpenIcon className="w-4 h-4 text-blue-500" />;
      case 'warning':
        return <AlertTriangleIcon className="w-4 h-4 text-yellow-500" />;
      case 'tip':
        return <CheckCircleIcon className="w-4 h-4 text-green-500" />;
      case 'technical':
        return <ZapIcon className="w-4 h-4 text-purple-500" />;
      default:
        return <InfoIcon className="w-4 h-4 text-gray-500" />;
    }
  };

  const getTypeColor = () => {
    switch (type) {
      case 'concept':
        return 'border-blue-200 dark:border-blue-800';
      case 'warning':
        return 'border-yellow-200 dark:border-yellow-800';
      case 'tip':
        return 'border-green-200 dark:border-green-800';
      case 'technical':
        return 'border-purple-200 dark:border-purple-800';
      default:
        return 'border-gray-200 dark:border-gray-800';
    }
  };

  const getPositionClasses = () => {
    const baseClasses = 'absolute z-50 bg-background border border-border rounded-lg shadow-lg backdrop-blur-sm';
    const width = isMobile ? 'w-80 max-w-[90vw]' : 'w-96 max-w-md';
    
    switch (actualPosition) {
      case 'top':
        return `${baseClasses} ${width} bottom-full left-1/2 transform -translate-x-1/2 mb-2`;
      case 'bottom':
        return `${baseClasses} ${width} top-full left-1/2 transform -translate-x-1/2 mt-2`;
      case 'left':
        return `${baseClasses} ${width} right-full top-1/2 transform -translate-y-1/2 mr-2`;
      case 'right':
        return `${baseClasses} ${width} left-full top-1/2 transform -translate-y-1/2 ml-2`;
      default:
        return `${baseClasses} ${width} top-full left-1/2 transform -translate-x-1/2 mt-2`;
    }
  };

  // Close on outside click for mobile
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isVisible &&
        tooltipRef.current &&
        triggerRef.current &&
        !tooltipRef.current.contains(event.target as Node) &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        hideTooltip();
      }
    };

    if (isTouchDevice) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isVisible, isTouchDevice, hideTooltip]);

  return (
    <span className={`relative inline-block ${className}`}>
      <span
        ref={triggerRef}
        className={`${
          children ? '' : 'border-b border-dotted border-primary cursor-help'
        } ${isTouchDevice ? 'cursor-pointer' : 'cursor-help'}`}
        onMouseEnter={!isTouchDevice ? showTooltip : undefined}
        onMouseLeave={!isTouchDevice ? hideTooltip : undefined}
        onClick={isTouchDevice ? (isVisible ? hideTooltip : showTooltip) : undefined}
        role="button"
        aria-describedby={isVisible ? `tooltip-${term.replace(/\s+/g, '-')}` : undefined}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (isVisible) hideTooltip();
            else showTooltip();
          }
          if (e.key === 'Escape' && isVisible) {
            hideTooltip();
          }
        }}
      >
        {children || (
          <span className="inline-flex items-center space-x-1">
            <span>{term}</span>
            {showIcon && <HelpCircleIcon className="w-3 h-3 text-muted-foreground" />}
          </span>
        )}
      </span>

      {isVisible && (
        <div
          ref={tooltipRef}
          id={`tooltip-${term.replace(/\s+/g, '-')}`}
          className={`${getPositionClasses()} ${getTypeColor()}`}
          role="tooltip"
          aria-live="polite"
        >
          <div className="p-4 max-h-80 overflow-y-auto">
            {/* Header */}
            <div className="flex items-start space-x-2 mb-3">
              {getTypeIcon()}
              <div className="flex-1">
                <h3 className="font-semibold text-foreground text-sm">{term}</h3>
                <p className="text-sm text-muted-foreground mt-1">{definition}</p>
              </div>
            </div>

            {/* Detailed Explanation */}
            {explanation && (
              <div className="mb-4 text-sm text-foreground">
                {explanation}
              </div>
            )}

            {/* Examples */}
            {examples.length > 0 && (
              <div className="mb-4">
                <h4 className="font-medium text-foreground text-sm mb-2">Examples:</h4>
                <div className="space-y-2">
                  {examples.map((example, index) => (
                    <div key={index} className="bg-muted/20 p-2 rounded-md">
                      <div className="flex items-center justify-between">
                        <code className="text-xs font-mono text-foreground flex-1 mr-2">
                          {example}
                        </code>
                        <button
                          onClick={() => copyExample(example, index)}
                          className="text-muted-foreground hover:text-foreground transition-colors p-1"
                          title="Copy example"
                          aria-label={`Copy example ${index + 1}`}
                        >
                          {copiedExample === index ? (
                            <CheckIcon className="w-3 h-3 text-green-500" />
                          ) : (
                            <CopyIcon className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Related Terms */}
            {relatedTerms.length > 0 && (
              <div>
                <h4 className="font-medium text-foreground text-sm mb-2">Related Terms:</h4>
                <div className="flex flex-wrap gap-1">
                  {relatedTerms.map((relatedTerm, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 bg-muted/30 text-muted-foreground text-xs rounded-md"
                    >
                      {relatedTerm}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Mobile close hint */}
            {isTouchDevice && (
              <div className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground text-center">
                Tap outside to close
              </div>
            )}
          </div>

          {/* Arrow pointer */}
          <div className={`absolute w-2 h-2 bg-background border-border transform rotate-45 ${
            actualPosition === 'top' ? 'top-full left-1/2 -translate-x-1/2 -mt-1 border-b border-r' :
            actualPosition === 'bottom' ? 'bottom-full left-1/2 -translate-x-1/2 -mb-1 border-t border-l' :
            actualPosition === 'left' ? 'left-full top-1/2 -translate-y-1/2 -ml-1 border-t border-r' :
            'right-full top-1/2 -translate-y-1/2 -mr-1 border-b border-l'
          }`} />
        </div>
      )}
    </span>
  );
};

export default TechnicalTooltip;