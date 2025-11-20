'use client';

import React from 'react';
import { HelpCircleIcon, PlayIcon } from 'lucide-react';
import { useHelp } from './HelpProvider';
import { useAccessibility } from '@/lib/ui/accessibility-utils';

interface HelpButtonProps {
  variant?: 'icon' | 'text' | 'tour';
  size?: 'sm' | 'md' | 'lg';
  tourId?: string;
  className?: string;
  children?: React.ReactNode;
  showTooltip?: boolean;
  tooltipContent?: string;
  onClick?: () => void;
}

export default function HelpButton({
  variant = 'icon',
  size = 'md',
  className = '',
  tourId,
  children,
  onClick
}: HelpButtonProps) {
  const { toggleHelpPanel, startTour, trackHelpInteraction } = useHelp();
  const { isTouchDevice } = useAccessibility();

  const handleClick = () => {
    if (onClick) {
      onClick();
      return;
    }

    if (tourId) {
      startTour(tourId);
      trackHelpInteraction('help_button_tour_start', tourId);
    } else {
      toggleHelpPanel();
      trackHelpInteraction('help_button_panel_toggle', 'main');
    }
  };

  const getSizeClasses = () => {
    const touchPadding = isTouchDevice ? 'min-h-[44px] min-w-[44px]' : '';

    switch (size) {
      case 'sm':
        return `p-1 ${touchPadding}`;
      case 'lg':
        return `p-3 ${touchPadding}`;
      default:
        return `p-2 ${touchPadding}`;
    }
  };

  const getIconSize = () => {
    switch (size) {
      case 'sm':
        return 'w-3 h-3';
      case 'lg':
        return 'w-6 h-6';
      default:
        return 'w-4 h-4';
    }
  };

  const getIcon = () => {
    if (variant === 'tour') {
      return <PlayIcon className={getIconSize()} />;
    }
    return <HelpCircleIcon className={getIconSize()} />;
  };

  const getLabel = () => {
    if (tourId) {
      return 'Start tour';
    }
    return 'Open help';
  };

  if (variant === 'text') {
    return (
      <button
        onClick={handleClick}
        className={`inline-flex items-center space-x-2 text-primary hover:text-primary/80 transition-colors ${getSizeClasses()} ${className}`}
        aria-label={getLabel()}
        title={getLabel()}
      >
        {getIcon()}
        <span className="text-sm">
          {children || (tourId ? 'Start Tour' : 'Help')}
        </span>
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      className={`inline-flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted/50 ${getSizeClasses()} ${className}`}
      aria-label={getLabel()}
      title={getLabel()}
      data-tour="help-button"
    >
      {children || getIcon()}
    </button>
  );
};