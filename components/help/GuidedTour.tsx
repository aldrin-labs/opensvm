'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  XIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlayIcon,
  PauseIcon,
  SkipForwardIcon,
  RotateCcwIcon,
  HelpCircleIcon,
  CheckCircleIcon,
  ArrowRightIcon
} from 'lucide-react';
import { useAccessibility, useKeyboardNavigation } from '@/lib/accessibility-utils';
import { useMobileDetection } from '@/lib/mobile-utils';

export interface TourStep {
  id: string;
  title: string;
  content: React.ReactNode;
  targetSelector: string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  action?: 'click' | 'hover' | 'scroll' | 'wait';
  actionDelay?: number;
  highlightPadding?: number;
  optional?: boolean;
  beforeStep?: () => void | Promise<void>;
  afterStep?: () => void | Promise<void>;
  validation?: () => boolean;
}

export interface TourConfig {
  id: string;
  title: string;
  description: string;
  steps: TourStep[];
  autoStart?: boolean;
  showProgress?: boolean;
  allowSkip?: boolean;
  showMinimap?: boolean;
  onComplete?: () => void;
  onSkip?: () => void;
  onExit?: () => void;
}

interface GuidedTourProps {
  config: TourConfig;
  isActive: boolean;
  onClose: () => void;
  className?: string;
}

const GuidedTour: React.FC<GuidedTourProps> = ({
  config,
  isActive,
  onClose,
  className = ''
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [highlightedElement, setHighlightedElement] = useState<HTMLElement | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  const overlayRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const playIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const { announceToScreenReader } = useAccessibility();
  const { isMobile, isTablet } = useMobileDetection();

  // Keyboard navigation
  useKeyboardNavigation(tooltipRef, {
    onEscape: onClose,
    trapFocus: true
  });

  const currentStep = config.steps[currentStepIndex];
  const isLastStep = currentStepIndex === config.steps.length - 1;
  const isFirstStep = currentStepIndex === 0;

  // Find and highlight target element
  const highlightTarget = useCallback((step: TourStep) => {
    const element = typeof document !== 'undefined' ? document.querySelector(step.targetSelector) as HTMLElement : null;
    if (!element) {
      console.warn(`Tour step "${step.id}": Target element not found: ${step.targetSelector}`);
      return null;
    }

    setHighlightedElement(element);

    // Calculate tooltip position
    const rect = element.getBoundingClientRect();
    const padding = step.highlightPadding || 8;

    let x = rect.left + rect.width / 2;
    let y = rect.bottom + padding;

    // Adjust position based on step preference and available space
    const position = step.position || 'bottom';
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1024;
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 768;

    switch (position) {
      case 'top':
        y = rect.top - padding;
        break;
      case 'left':
        x = rect.left - padding;
        y = rect.top + rect.height / 2;
        break;
      case 'right':
        x = rect.right + padding;
        y = rect.top + rect.height / 2;
        break;
      case 'center':
        x = viewportWidth / 2;
        y = viewportHeight / 2;
        break;
      default: // bottom
        y = rect.bottom + padding;
    }

    // Ensure tooltip stays within viewport
    if (isMobile || isTablet) {
      x = Math.max(20, Math.min(x, viewportWidth - 320));
      y = Math.max(20, Math.min(y, viewportHeight - 200));
    } else {
      x = Math.max(20, Math.min(x, viewportWidth - 400));
      y = Math.max(20, Math.min(y, viewportHeight - 300));
    }

    setTooltipPosition({ x, y });

    // Scroll element into view
    element.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'center'
    });

    return element;
  }, [isMobile, isTablet]);

  // Execute step action
  const executeStepAction = useCallback(async (step: TourStep, element: HTMLElement) => {
    if (!step.action) return;

    const delay = step.actionDelay || 1000;

    switch (step.action) {
      case 'click':
        setTimeout(() => {
          element.click();
          announceToScreenReader(`Clicked ${step.title}`);
        }, delay);
        break;

      case 'hover':
        setTimeout(() => {
          const event = new MouseEvent('mouseenter', { bubbles: true });
          element.dispatchEvent(event);
          announceToScreenReader(`Hovered over ${step.title}`);
        }, delay);
        break;

      case 'scroll':
        setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          announceToScreenReader(`Scrolled to ${step.title}`);
        }, delay);
        break;

      case 'wait':
        setTimeout(() => {
          announceToScreenReader(`Waited at ${step.title}`);
        }, delay);
        break;
    }
  }, [announceToScreenReader]);

  // Go to specific step
  const goToStep = useCallback(async (stepIndex: number) => {
    if (stepIndex < 0 || stepIndex >= config.steps.length) return;

    const step = config.steps[stepIndex];

    // Execute before step callback
    if (step.beforeStep) {
      await step.beforeStep();
    }

    setCurrentStepIndex(stepIndex);

    const element = highlightTarget(step);
    if (element) {
      await executeStepAction(step, element);
    }

    // Execute after step callback
    if (step.afterStep) {
      await step.afterStep();
    }

    announceToScreenReader(`Step ${stepIndex + 1} of ${config.steps.length}: ${step.title}`);
  }, [config.steps, highlightTarget, executeStepAction, announceToScreenReader]);

  // Complete tour
  const completeTour = useCallback(() => {
    setCompletedSteps(prev => new Set([...prev, currentStep.id]));
    announceToScreenReader('Tour completed successfully');

    if (config.onComplete) {
      config.onComplete();
    }

    onClose();
  }, [currentStep.id, config, onClose, announceToScreenReader]);

  // Navigate to next step
  const nextStep = useCallback(() => {
    if (currentStep.validation && !currentStep.validation()) {
      announceToScreenReader('Please complete the current step before continuing');
      return;
    }

    // Mark current step as completed
    setCompletedSteps(prev => new Set([...prev, currentStep.id]));

    if (isLastStep) {
      completeTour();
    } else {
      goToStep(currentStepIndex + 1);
    }
  }, [currentStep, isLastStep, currentStepIndex, goToStep, completeTour, announceToScreenReader]);

  // Navigate to previous step
  const previousStep = useCallback(() => {
    if (!isFirstStep) {
      goToStep(currentStepIndex - 1);
    }
  }, [isFirstStep, currentStepIndex, goToStep]);

  // Skip tour
  const skipTour = useCallback(() => {
    announceToScreenReader('Tour skipped');

    if (config.onSkip) {
      config.onSkip();
    }

    onClose();
  }, [config, onClose, announceToScreenReader]);

  // Auto-play functionality
  const toggleAutoPlay = useCallback(() => {
    setIsPlaying(!isPlaying);

    if (!isPlaying) {
      playIntervalRef.current = setInterval(() => {
        setCurrentStepIndex(prev => {
          if (prev >= config.steps.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 3000);
      announceToScreenReader('Auto-play started');
    } else {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
        playIntervalRef.current = null;
      }
      announceToScreenReader('Auto-play stopped');
    }
  }, [isPlaying, config.steps.length, announceToScreenReader]);

  // Restart tour
  const restartTour = useCallback(() => {
    setCurrentStepIndex(0);
    setCompletedSteps(new Set());
    setIsPlaying(false);
    if (playIntervalRef.current) {
      clearInterval(playIntervalRef.current);
      playIntervalRef.current = null;
    }
    goToStep(0);
    announceToScreenReader('Tour restarted');
  }, [goToStep, announceToScreenReader]);

  // Initialize tour
  useEffect(() => {
    if (isActive && currentStep) {
      goToStep(currentStepIndex);
    }
  }, [isActive, currentStepIndex, currentStep, goToStep]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
      }
    };
  }, []);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (currentStep && highlightedElement) {
        highlightTarget(currentStep);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', handleResize);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', handleResize);
      }
    };
  }, [currentStep, highlightedElement, highlightTarget]);

  if (!isActive || !currentStep) {
    return null;
  }

  return (
    <>
      {/* Overlay */}
      <div
        ref={overlayRef}
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        style={{
          background: highlightedElement ? `
            radial-gradient(
              circle at ${highlightedElement.getBoundingClientRect().left + highlightedElement.getBoundingClientRect().width / 2}px 
              ${highlightedElement.getBoundingClientRect().top + highlightedElement.getBoundingClientRect().height / 2}px,
              transparent ${Math.max(highlightedElement.getBoundingClientRect().width, highlightedElement.getBoundingClientRect().height) / 2 + (currentStep.highlightPadding || 8)}px,
              rgba(0, 0, 0, 0.5) ${Math.max(highlightedElement.getBoundingClientRect().width, highlightedElement.getBoundingClientRect().height) / 2 + (currentStep.highlightPadding || 8) + 20}px
            )
          ` : 'rgba(0, 0, 0, 0.5)'
        }}
      />

      {/* Tour Tooltip */}
      <div
        ref={tooltipRef}
        className={`fixed z-50 bg-background border border-border rounded-lg shadow-xl ${isMobile ? 'w-80 max-w-[90vw]' : 'w-96 max-w-md'
          } ${className}`}
        style={{
          left: tooltipPosition.x - (isMobile ? 160 : 200),
          top: tooltipPosition.y,
          transform: currentStep.position === 'center' ? 'translate(-50%, -50%)' : 'none'
        }}
        role="dialog"
        aria-labelledby="tour-title"
        aria-describedby="tour-content"
      >
        <div className="p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <HelpCircleIcon className="w-5 h-5 text-primary" />
              <h2 id="tour-title" className="font-semibold text-foreground">
                {currentStep.title}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors p-1"
              aria-label="Close tour"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>

          {/* Progress Bar */}
          {config.showProgress && (
            <div className="mb-4">
              <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
                <span>Step {currentStepIndex + 1} of {config.steps.length}</span>
                <span>{Math.round(((currentStepIndex + 1) / config.steps.length) * 100)}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${((currentStepIndex + 1) / config.steps.length) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Content */}
          <div id="tour-content" className="mb-4 text-sm text-foreground">
            {currentStep.content}
          </div>

          {/* Step Validation */}
          {currentStep.validation && !currentStep.validation() && (
            <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
              <div className="flex items-center space-x-2 text-yellow-800 dark:text-yellow-200">
                <ArrowRightIcon className="w-4 h-4" />
                <span className="text-sm">Complete this step to continue</span>
              </div>
            </div>
          )}

          {/* Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {/* Auto-play controls */}
              <button
                onClick={toggleAutoPlay}
                className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted"
                title={isPlaying ? 'Pause auto-play' : 'Start auto-play'}
                aria-label={isPlaying ? 'Pause auto-play' : 'Start auto-play'}
              >
                {isPlaying ? (
                  <PauseIcon className="w-4 h-4" />
                ) : (
                  <PlayIcon className="w-4 h-4" />
                )}
              </button>

              {/* Restart */}
              <button
                onClick={restartTour}
                className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted"
                title="Restart tour"
                aria-label="Restart tour"
              >
                <RotateCcwIcon className="w-4 h-4" />
              </button>

              {/* Skip */}
              {config.allowSkip && (
                <button
                  onClick={skipTour}
                  className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted"
                  title="Skip tour"
                  aria-label="Skip tour"
                >
                  <SkipForwardIcon className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Navigation */}
            <div className="flex items-center space-x-2">
              <button
                onClick={previousStep}
                disabled={isFirstStep}
                className="flex items-center space-x-1 px-3 py-2 text-sm bg-muted text-muted-foreground hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors"
                aria-label="Previous step"
              >
                <ChevronLeftIcon className="w-4 h-4" />
                <span>Previous</span>
              </button>

              <button
                onClick={nextStep}
                disabled={currentStep.validation && !currentStep.validation()}
                className="flex items-center space-x-1 px-3 py-2 text-sm bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors"
                aria-label={isLastStep ? 'Complete tour' : 'Next step'}
              >
                <span>{isLastStep ? 'Complete' : 'Next'}</span>
                {isLastStep ? (
                  <CheckCircleIcon className="w-4 h-4" />
                ) : (
                  <ChevronRightIcon className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Step indicators */}
          {config.showProgress && (
            <div className="flex justify-center space-x-1 mt-4">
              {config.steps.map((step, index) => (
                <button
                  key={step.id}
                  onClick={() => goToStep(index)}
                  className={`w-2 h-2 rounded-full transition-colors ${index === currentStepIndex
                    ? 'bg-primary'
                    : completedSteps.has(step.id)
                      ? 'bg-green-500'
                      : 'bg-muted'
                    }`}
                  aria-label={`Go to step ${index + 1}: ${step.title}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default GuidedTour;