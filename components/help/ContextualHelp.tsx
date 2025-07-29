'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  HelpCircleIcon,
  XIcon,
  BookOpenIcon,
  InfoIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  ExternalLinkIcon,
  ChevronRightIcon,
  ChevronDownIcon
} from 'lucide-react';
import { useAccessibility, useKeyboardNavigation } from '@/lib/accessibility-utils';
import { useMobileDetection } from '@/lib/mobile-utils';

export interface HelpContent {
  id: string;
  title: string;
  description: string;
  type: 'info' | 'warning' | 'tip' | 'concept';
  content: React.ReactNode;
  relatedTopics?: string[];
  externalLinks?: Array<{
    title: string;
    url: string;
    description?: string;
  }>;
}

interface ContextualHelpProps {
  helpId: string;
  content: HelpContent;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'auto';
  trigger?: 'hover' | 'click' | 'focus';
  className?: string;
  children?: React.ReactNode;
  showIcon?: boolean;
  iconSize?: 'sm' | 'md' | 'lg';
}

const ContextualHelp: React.FC<ContextualHelpProps> = ({
  helpId,
  content,
  position = 'auto',
  trigger = 'hover',
  className = '',
  children,
  showIcon = true,
  iconSize = 'sm'
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [actualPosition, setActualPosition] = useState<'top' | 'bottom' | 'left' | 'right'>('top');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const { announceToScreenReader, isTouchDevice } = useAccessibility();
  const { isMobile } = useMobileDetection();

  // Keyboard navigation for the help content
  useKeyboardNavigation(tooltipRef, {
    onEscape: () => setIsVisible(false),
    trapFocus: isVisible
  });

  // Calculate optimal position
  const calculatePosition = () => {
    if (!triggerRef.current || position !== 'auto') {
      return position as 'top' | 'bottom' | 'left' | 'right';
    }

    const rect = triggerRef.current.getBoundingClientRect();
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 768;
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1024;

    // Check available space
    const spaceAbove = rect.top;
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceLeft = rect.left;
    const spaceRight = viewportWidth - rect.right;

    // Prefer bottom, then top, then right, then left
    if (spaceBelow > 200) return 'bottom';
    if (spaceAbove > 200) return 'top';
    if (spaceRight > 300) return 'right';
    if (spaceLeft > 300) return 'left';

    return 'bottom'; // fallback
  };

  const showHelp = () => {
    setActualPosition(calculatePosition());
    setIsVisible(true);
    announceToScreenReader(`Help opened: ${content.title}`);
  };

  const hideHelp = useCallback(() => {
    setIsVisible(false);
    announceToScreenReader('Help closed');
  }, [announceToScreenReader]);

  const toggleHelp = () => {
    if (isVisible) {
      hideHelp();
    } else {
      showHelp();
    }
  };

  const handleTriggerEvent = (event: React.MouseEvent | React.FocusEvent) => {
    if (trigger === 'click') {
      event.preventDefault();
      toggleHelp();
    } else if (trigger === 'hover' && event.type === 'mouseenter') {
      showHelp();
    } else if (trigger === 'hover' && event.type === 'mouseleave') {
      hideHelp();
    } else if (trigger === 'focus' && event.type === 'focus') {
      showHelp();
    } else if (trigger === 'focus' && event.type === 'blur') {
      hideHelp();
    }
  };

  const getTypeIcon = (type: HelpContent['type']) => {
    const iconClass = `w-4 h-4 ${iconSize === 'sm' ? 'w-3 h-3' :
      iconSize === 'lg' ? 'w-5 h-5' : 'w-4 h-4'
      }`;

    switch (type) {
      case 'info':
        return <InfoIcon className={`${iconClass} text-blue-500`} />;
      case 'warning':
        return <AlertTriangleIcon className={`${iconClass} text-yellow-500`} />;
      case 'tip':
        return <CheckCircleIcon className={`${iconClass} text-green-500`} />;
      case 'concept':
        return <BookOpenIcon className={`${iconClass} text-purple-500`} />;
      default:
        return <InfoIcon className={`${iconClass} text-gray-500`} />;
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

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isVisible &&
        tooltipRef.current &&
        triggerRef.current &&
        !tooltipRef.current.contains(event.target as Node) &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        hideHelp();
      }
    };

    if (trigger === 'click') {
      if (typeof document !== 'undefined') {
        document.addEventListener('mousedown', handleClickOutside);
      }
      return () => {
        if (typeof document !== 'undefined') {
          document.removeEventListener('mousedown', handleClickOutside);
        }
      };
    }
  }, [isVisible, trigger, hideHelp]);

  return (
    <div className={`relative inline-block ${className}`}>
      <div
        ref={triggerRef}
        className={`${trigger === 'click' ? 'cursor-pointer' : ''} ${isTouchDevice ? 'min-h-[44px] min-w-[44px] flex items-center justify-center' : ''
          }`}
        onMouseEnter={trigger === 'hover' ? handleTriggerEvent : undefined}
        onMouseLeave={trigger === 'hover' ? handleTriggerEvent : undefined}
        onFocus={trigger === 'focus' ? handleTriggerEvent : undefined}
        onBlur={trigger === 'focus' ? handleTriggerEvent : undefined}
        onClick={trigger === 'click' ? handleTriggerEvent : undefined}
        role={trigger === 'click' ? 'button' : undefined}
        aria-expanded={trigger === 'click' ? isVisible : undefined}
        aria-describedby={isVisible ? `help-content-${helpId}` : undefined}
        tabIndex={trigger === 'click' ? 0 : undefined}
      >
        {children || (
          showIcon && (
            <HelpCircleIcon
              className={`${iconSize === 'sm' ? 'w-4 h-4' :
                iconSize === 'lg' ? 'w-6 h-6' : 'w-5 h-5'
                } text-muted-foreground hover:text-foreground transition-colors`}
            />
          )
        )}
      </div>

      {isVisible && (
        <div
          ref={tooltipRef}
          id={`help-content-${helpId}`}
          className={getPositionClasses()}
          role="tooltip"
          aria-live="polite"
        >
          <div className="p-4 max-h-96 overflow-y-auto">
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center space-x-2">
                {getTypeIcon(content.type)}
                <h3 className="font-semibold text-foreground">{content.title}</h3>
              </div>
              {trigger === 'click' && (
                <button
                  onClick={hideHelp}
                  className="text-muted-foreground hover:text-foreground transition-colors p-1"
                  aria-label="Close help"
                >
                  <XIcon className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Description */}
            <div className="text-sm text-muted-foreground mb-4">
              {content.description}
            </div>

            {/* Main Content */}
            <div className="text-sm text-foreground mb-4">
              {content.content}
            </div>

            {/* Related Topics */}
            {content.relatedTopics && content.relatedTopics.length > 0 && (
              <div className="mb-4">
                <button
                  onClick={() => toggleSection('related')}
                  className="flex items-center space-x-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
                >
                  {expandedSections.has('related') ? (
                    <ChevronDownIcon className="w-4 h-4" />
                  ) : (
                    <ChevronRightIcon className="w-4 h-4" />
                  )}
                  <span>Related Topics</span>
                </button>

                {expandedSections.has('related') && (
                  <div className="mt-2 ml-6 space-y-1">
                    {content.relatedTopics.map((topic, index) => (
                      <div key={index} className="text-sm text-muted-foreground">
                        • {topic}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* External Links */}
            {content.externalLinks && content.externalLinks.length > 0 && (
              <div>
                <button
                  onClick={() => toggleSection('links')}
                  className="flex items-center space-x-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
                >
                  {expandedSections.has('links') ? (
                    <ChevronDownIcon className="w-4 h-4" />
                  ) : (
                    <ChevronRightIcon className="w-4 h-4" />
                  )}
                  <span>Learn More</span>
                </button>

                {expandedSections.has('links') && (
                  <div className="mt-2 ml-6 space-y-2">
                    {content.externalLinks.map((link, index) => (
                      <a
                        key={index}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center space-x-2 text-sm text-primary hover:text-primary/80 transition-colors"
                      >
                        <ExternalLinkIcon className="w-3 h-3" />
                        <span>{link.title}</span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Arrow pointer */}
          <div className={`absolute w-2 h-2 bg-background border-border transform rotate-45 ${actualPosition === 'top' ? 'top-full left-1/2 -translate-x-1/2 -mt-1 border-b border-r' :
            actualPosition === 'bottom' ? 'bottom-full left-1/2 -translate-x-1/2 -mb-1 border-t border-l' :
              actualPosition === 'left' ? 'left-full top-1/2 -translate-y-1/2 -ml-1 border-t border-r' :
                'right-full top-1/2 -translate-y-1/2 -mr-1 border-b border-l'
            }`} />
        </div>
      )}
    </div>
  );
};

export default ContextualHelp;