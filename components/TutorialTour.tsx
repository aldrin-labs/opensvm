"use client";

import { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { safeStorage } from '@/lib/ui/safe-storage';

export interface TutorialStep {
  id: string;
  title: string;
  content: string;
  target?: string; // CSS selector for the element to highlight
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  action?: string; // Optional action button text
}

interface TutorialTourProps {
  steps: TutorialStep[];
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
  storageKey?: string; // Key to store completion status
}

export function TutorialTour({
  steps,
  isOpen,
  onClose,
  onComplete,
  storageKey = 'tutorial-completed',
}: TutorialTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });

  const step = steps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;

  // Update target element and position when step changes
  useEffect(() => {
    if (!isOpen || !step?.target) {
      setTargetElement(null);
      return;
    }

    const element = document.querySelector(step.target) as HTMLElement;
    if (element) {
      setTargetElement(element);
      
      // Calculate tooltip position
      const rect = element.getBoundingClientRect();
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

      let top = 0;
      let left = 0;

      switch (step.position) {
        case 'top':
          top = rect.top + scrollTop - 120;
          left = rect.left + scrollLeft + rect.width / 2;
          break;
        case 'bottom':
          top = rect.bottom + scrollTop + 20;
          left = rect.left + scrollLeft + rect.width / 2;
          break;
        case 'left':
          top = rect.top + scrollTop + rect.height / 2;
          left = rect.left + scrollLeft - 320;
          break;
        case 'right':
          top = rect.top + scrollTop + rect.height / 2;
          left = rect.right + scrollLeft + 20;
          break;
        default: // center
          top = window.innerHeight / 2 + scrollTop;
          left = window.innerWidth / 2 + scrollLeft;
      }

      setTooltipPosition({ top, left });

      // Scroll element into view
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentStep, isOpen, step]);

  const handleNext = () => {
    if (isLastStep) {
      handleComplete();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (!isFirstStep) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleComplete = () => {
    if (storageKey) {
      safeStorage.setItem(storageKey, 'true');
    }
    onComplete?.();
    onClose();
  };

  const handleSkip = () => {
    if (storageKey) {
      safeStorage.setItem(storageKey, 'skipped');
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100]" />

      {/* Highlight for target element */}
      {targetElement && (
        <div
          className="fixed z-[101] pointer-events-none"
          style={{
            top: targetElement.getBoundingClientRect().top + window.pageYOffset,
            left: targetElement.getBoundingClientRect().left + window.pageXOffset,
            width: targetElement.offsetWidth,
            height: targetElement.offsetHeight,
            boxShadow: '0 0 0 4px rgba(var(--primary-rgb, 59, 130, 246), 0.5), 0 0 0 9999px rgba(0, 0, 0, 0.5)',
            borderRadius: '8px',
            transition: 'all 300ms ease-in-out',
          }}
        />
      )}

      {/* Tooltip */}
      <div
        className="fixed z-[102] bg-card border-2 border-primary rounded-lg shadow-2xl max-w-md"
        style={{
          top: step.position === 'center' ? '50%' : tooltipPosition.top,
          left: step.position === 'center' ? '50%' : tooltipPosition.left,
          transform: step.position === 'center' ? 'translate(-50%, -50%)' : 
                     step.position === 'top' || step.position === 'bottom' ? 'translateX(-50%)' :
                     step.position === 'left' || step.position === 'right' ? 'translateY(-50%)' : 'none',
          transition: 'all 300ms ease-in-out',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              {steps.map((_, index) => (
                <div
                  key={index}
                  className={`h-1.5 rounded-full transition-all duration-200 ${
                    index === currentStep
                      ? 'w-6 bg-primary'
                      : index < currentStep
                      ? 'w-1.5 bg-primary/50'
                      : 'w-1.5 bg-muted'
                  }`}
                />
              ))}
            </div>
            <span className="text-xs text-muted-foreground ml-2">
              {currentStep + 1} of {steps.length}
            </span>
          </div>
          <button
            onClick={handleSkip}
            className="text-muted-foreground hover:text-foreground transition-colors duration-150"
            aria-label="Skip tutorial"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="px-4 py-4">
          <h3 className="text-lg font-semibold text-foreground mb-2">
            {step.title}
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {step.content}
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/30">
          <button
            onClick={handleSkip}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-150"
          >
            Skip Tutorial
          </button>

          <div className="flex items-center gap-2">
            {!isFirstStep && (
              <button
                onClick={handlePrevious}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors duration-150"
              >
                <ChevronLeft size={16} />
                Previous
              </button>
            )}
            <button
              onClick={handleNext}
              className="flex items-center gap-1 px-4 py-1.5 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors duration-150"
            >
              {isLastStep ? (
                <>
                  <Check size={16} />
                  Finish
                </>
              ) : (
                <>
                  Next
                  <ChevronRight size={16} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * Hook to manage tutorial state
 */
export function useTutorial(storageKey: string = 'tutorial-completed') {
  const [showTutorial, setShowTutorial] = useState(false);

  useEffect(() => {
    // Check if tutorial has been completed
    const completed = safeStorage.getItem(storageKey);
    if (!completed) {
      // Show tutorial after a short delay
      const timer = setTimeout(() => {
        setShowTutorial(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [storageKey]);

  const startTutorial = () => setShowTutorial(true);
  const closeTutorial = () => setShowTutorial(false);

  return {
    showTutorial,
    startTutorial,
    closeTutorial,
  };
}
