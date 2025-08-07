'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useI18n } from '@/lib/i18n';
import { useAccessibility } from '@/lib/accessibility';
import { useResponsive } from '@/lib/design-system/responsive';
import { EnhancedButton } from '@/components/ui/enhanced-button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { X, ChevronLeft, ChevronRight, Play, Pause, RotateCcw } from 'lucide-react';

// Onboarding step types
export interface OnboardingStep {
  id: string;
  title: string;
  content: string;
  target?: string; // CSS selector for element to highlight
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  action?: 'click' | 'type' | 'hover' | 'observe';
  actionData?: any;
  validation?: () => boolean;
  beforeStep?: () => Promise<void>;
  afterStep?: () => Promise<void>;
  skippable?: boolean;
  required?: boolean;
}

export interface OnboardingFlow {
  id: string;
  title: string;
  description: string;
  category: 'getting-started' | 'advanced' | 'developer' | 'analyst';
  estimatedTime: number; // in minutes
  prerequisites?: string[];
  steps: OnboardingStep[];
  icon?: React.ReactNode;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

interface OnboardingProgress {
  flowId: string;
  currentStepIndex: number;
  completedSteps: string[];
  startedAt: Date;
  lastActiveAt: Date;
  completed: boolean;
}

interface OnboardingContextType {
  availableFlows: OnboardingFlow[];
  activeFlow: OnboardingFlow | null;
  currentStep: OnboardingStep | null;
  currentStepIndex: number;
  isActive: boolean;
  progress: OnboardingProgress | null;
  userPreferences: {
    showTooltips: boolean;
    autoAdvance: boolean;
    playSpeed: 'slow' | 'normal' | 'fast';
    skipCompleted: boolean;
  };
  startFlow: (flowId: string) => void;
  nextStep: () => void;
  previousStep: () => void;
  skipStep: () => void;
  pauseFlow: () => void;
  resumeFlow: () => void;
  resetFlow: () => void;
  completeFlow: () => void;
  dismissOnboarding: () => void;
  updatePreferences: (preferences: Partial<OnboardingContextType['userPreferences']>) => void;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

// Default onboarding flows
const defaultFlows: OnboardingFlow[] = [
  {
    id: 'getting-started',
    title: 'Getting Started with OpenSVM',
    description: 'Learn the basics of exploring Solana blockchain data',
    category: 'getting-started',
    estimatedTime: 5,
    difficulty: 'beginner',
    steps: [
      {
        id: 'welcome',
        title: 'Welcome to OpenSVM',
        content: 'OpenSVM is your gateway to exploring Solana blockchain data with AI assistance. Let\'s take a quick tour!',
        position: 'center',
        skippable: false,
      },
      {
        id: 'search-basics',
        title: 'Search Functionality',
        content: 'Use the search bar to find transactions, blocks, programs, and tokens. Try typing a transaction signature or token address.',
        target: 'input[placeholder*="Search"]',
        position: 'bottom',
        action: 'type',
        actionData: { placeholder: 'Try searching for something...' },
      },
      {
        id: 'ai-assistant',
        title: 'AI Assistant',
        content: 'Click the AI Assistant button to get help analyzing blockchain data with natural language queries.',
        target: 'button:contains("AI Assistant")',
        position: 'left',
        action: 'click',
      },
      {
        id: 'network-stats',
        title: 'Network Statistics',
        content: 'Monitor real-time Solana network metrics including TPS, block height, and validator count.',
        target: '.stats-grid, [data-testid="network-stats"]',
        position: 'top',
        action: 'observe',
      },
      {
        id: 'theme-customization',
        title: 'Customize Your Experience',
        content: 'Switch between different themes and adjust accessibility settings using the theme switcher.',
        target: '[data-testid="theme-switcher"], .theme-switcher',
        position: 'bottom',
        action: 'click',
      },
    ],
  },
  {
    id: 'advanced-search',
    title: 'Advanced Search Techniques',
    description: 'Master advanced search and filtering capabilities',
    category: 'advanced',
    estimatedTime: 8,
    difficulty: 'intermediate',
    prerequisites: ['getting-started'],
    steps: [
      {
        id: 'search-filters',
        title: 'Search Filters',
        content: 'Use advanced filters to narrow down your search results by transaction type, time range, and more.',
        target: '[data-testid="search-filters"]',
        position: 'right',
      },
      {
        id: 'search-suggestions',
        title: 'Smart Suggestions',
        content: 'OpenSVM provides intelligent search suggestions based on your input. Try typing to see suggestions appear.',
        target: '[data-testid="search-suggestions"]',
        position: 'bottom',
      },
      {
        id: 'search-history',
        title: 'Search History',
        content: 'Access your recent searches and save frequently used queries for quick access.',
        target: '[data-testid="search-history"]',
        position: 'left',
      },
    ],
  },
  {
    id: 'developer-tools',
    title: 'Developer Tools',
    description: 'Explore developer-focused features and APIs',
    category: 'developer',
    estimatedTime: 12,
    difficulty: 'advanced',
    prerequisites: ['getting-started', 'advanced-search'],
    steps: [
      {
        id: 'api-access',
        title: 'API Access',
        content: 'Learn how to access OpenSVM\'s API for programmatic data retrieval.',
        target: '[data-testid="api-docs"]',
        position: 'center',
      },
      {
        id: 'transaction-analysis',
        title: 'Transaction Analysis',
        content: 'Deep dive into transaction details, instruction breakdowns, and program interactions.',
        target: '[data-testid="transaction-details"]',
        position: 'top',
      },
      {
        id: 'program-registry',
        title: 'Program Registry',
        content: 'Explore the comprehensive program registry to understand on-chain program behavior.',
        target: '[data-testid="program-registry"]',
        position: 'bottom',
      },
    ],
  },
];

// Onboarding overlay component
interface OnboardingOverlayProps {
  step: OnboardingStep;
  targetElement?: HTMLElement | null;
  onNext: () => void;
  onPrevious: () => void;
  onSkip: () => void;
  onDismiss: () => void;
  currentIndex: number;
  totalSteps: number;
  canGoBack: boolean;
  canGoNext: boolean;
}

const OnboardingOverlay: React.FC<OnboardingOverlayProps> = ({
  step,
  targetElement,
  onNext,
  onPrevious,
  onSkip,
  onDismiss,
  currentIndex,
  totalSteps,
  canGoBack,
  canGoNext,
}) => {
  const { t } = useI18n();
  const { announceToScreenReader } = useAccessibility();
  const { isMobile } = useResponsive();

  useEffect(() => {
    announceToScreenReader(`Step ${currentIndex + 1} of ${totalSteps}: ${step.title}`, 'polite');
  }, [step, currentIndex, totalSteps, announceToScreenReader]);

  const getOverlayPosition = () => {
    if (!targetElement || step.position === 'center') {
      return {
        position: 'fixed' as const,
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 1000,
      };
    }

    const rect = targetElement.getBoundingClientRect();
    const overlay = {
      position: 'fixed' as const,
      zIndex: 1000,
    };

    switch (step.position) {
      case 'top':
        return {
          ...overlay,
          bottom: `${window.innerHeight - rect.top + 10}px`,
          left: `${rect.left}px`,
        };
      case 'bottom':
        return {
          ...overlay,
          top: `${rect.bottom + 10}px`,
          left: `${rect.left}px`,
        };
      case 'left':
        return {
          ...overlay,
          top: `${rect.top}px`,
          right: `${window.innerWidth - rect.left + 10}px`,
        };
      case 'right':
        return {
          ...overlay,
          top: `${rect.top}px`,
          left: `${rect.right + 10}px`,
        };
      default:
        return {
          ...overlay,
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        };
    }
  };

  const highlightStyle = targetElement ? {
    position: 'fixed' as const,
    top: `${targetElement.getBoundingClientRect().top - 4}px`,
    left: `${targetElement.getBoundingClientRect().left - 4}px`,
    width: `${targetElement.getBoundingClientRect().width + 8}px`,
    height: `${targetElement.getBoundingClientRect().height + 8}px`,
    border: '2px solid hsl(var(--primary))',
    borderRadius: '0.5rem',
    pointerEvents: 'none' as const,
    zIndex: 999,
    boxShadow: '0 0 0 4px rgba(var(--primary), 0.2)',
  } : null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-998"
        onClick={step.skippable !== false ? onDismiss : undefined}
      />
      
      {/* Highlight */}
      {highlightStyle && (
        <div style={highlightStyle} />
      )}
      
      {/* Tooltip */}
      <Card
        className="p-6 max-w-sm bg-background border-2 border-primary shadow-2xl"
        style={getOverlayPosition()}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {step.title}
            </h3>
            <Badge variant="secondary" className="text-xs">
              {currentIndex + 1} of {totalSteps}
            </Badge>
          </div>
          <EnhancedButton
            variant="ghost"
            size="icon-sm"
            onClick={onDismiss}
            aria-label={t('common.close')}
          >
            <X className="h-4 w-4" />
          </EnhancedButton>
        </div>
        
        <p className="text-muted-foreground mb-6 text-sm leading-relaxed">
          {step.content}
        </p>
        
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {canGoBack && (
              <EnhancedButton
                variant="outline"
                size="sm"
                onClick={onPrevious}
                leftIcon={<ChevronLeft className="h-4 w-4" />}
              >
                {t('common.back')}
              </EnhancedButton>
            )}
          </div>
          
          <div className="flex gap-2">
            {step.skippable !== false && (
              <EnhancedButton
                variant="ghost"
                size="sm"
                onClick={onSkip}
              >
                {t('common.skip')}
              </EnhancedButton>
            )}
            {canGoNext && (
              <EnhancedButton
                size="sm"
                onClick={onNext}
                rightIcon={<ChevronRight className="h-4 w-4" />}
              >
                {currentIndex === totalSteps - 1 ? t('common.finish') : t('common.next')}
              </EnhancedButton>
            )}
          </div>
        </div>
        
        {/* Progress bar */}
        <div className="mt-4">
          <Progress value={((currentIndex + 1) / totalSteps) * 100} className="h-1" />
        </div>
      </Card>
    </>
  );
};

// Main onboarding provider
export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [availableFlows] = useState<OnboardingFlow[]>(defaultFlows);
  const [activeFlow, setActiveFlow] = useState<OnboardingFlow | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [progress, setProgress] = useState<OnboardingProgress | null>(null);
  const [userPreferences, setUserPreferences] = useState({
    showTooltips: true,
    autoAdvance: false,
    playSpeed: 'normal' as const,
    skipCompleted: true,
  });

  const { announceToScreenReader } = useAccessibility();
  
  const currentStep = activeFlow?.steps[currentStepIndex] || null;

  // Load progress from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('opensvm-onboarding-progress');
    if (saved) {
      try {
        const savedProgress = JSON.parse(saved);
        setProgress(savedProgress);
      } catch (error) {
        console.warn('Failed to load onboarding progress:', error);
      }
    }

    const savedPrefs = localStorage.getItem('opensvm-onboarding-preferences');
    if (savedPrefs) {
      try {
        const prefs = JSON.parse(savedPrefs);
        setUserPreferences(prev => ({ ...prev, ...prefs }));
      } catch (error) {
        console.warn('Failed to load onboarding preferences:', error);
      }
    }
  }, []);

  // Save progress to localStorage
  const saveProgress = useCallback((progressData: OnboardingProgress) => {
    setProgress(progressData);
    localStorage.setItem('opensvm-onboarding-progress', JSON.stringify(progressData));
  }, []);

  const startFlow = useCallback((flowId: string) => {
    const flow = availableFlows.find(f => f.id === flowId);
    if (!flow) return;

    setActiveFlow(flow);
    setCurrentStepIndex(0);
    setIsActive(true);

    const newProgress: OnboardingProgress = {
      flowId,
      currentStepIndex: 0,
      completedSteps: [],
      startedAt: new Date(),
      lastActiveAt: new Date(),
      completed: false,
    };
    saveProgress(newProgress);
    
    announceToScreenReader(`Started onboarding: ${flow.title}`, 'assertive');
  }, [availableFlows, saveProgress, announceToScreenReader]);

  const nextStep = useCallback(() => {
    if (!activeFlow || !progress) return;

    const newIndex = currentStepIndex + 1;
    const completedSteps = [...progress.completedSteps, currentStep?.id].filter(Boolean) as string[];

    if (newIndex >= activeFlow.steps.length) {
      // Complete the flow
      const completedProgress: OnboardingProgress = {
        ...progress,
        currentStepIndex: newIndex,
        completedSteps,
        lastActiveAt: new Date(),
        completed: true,
      };
      saveProgress(completedProgress);
      setIsActive(false);
      announceToScreenReader('Onboarding completed!', 'assertive');
    } else {
      setCurrentStepIndex(newIndex);
      const updatedProgress: OnboardingProgress = {
        ...progress,
        currentStepIndex: newIndex,
        completedSteps,
        lastActiveAt: new Date(),
      };
      saveProgress(updatedProgress);
    }
  }, [activeFlow, progress, currentStepIndex, currentStep, saveProgress, announceToScreenReader]);

  const previousStep = useCallback(() => {
    if (currentStepIndex > 0) {
      const newIndex = currentStepIndex - 1;
      setCurrentStepIndex(newIndex);
      if (progress) {
        const updatedProgress: OnboardingProgress = {
          ...progress,
          currentStepIndex: newIndex,
          lastActiveAt: new Date(),
        };
        saveProgress(updatedProgress);
      }
    }
  }, [currentStepIndex, progress, saveProgress]);

  const skipStep = useCallback(() => {
    nextStep();
  }, [nextStep]);

  const pauseFlow = useCallback(() => {
    setIsActive(false);
    if (progress) {
      const pausedProgress: OnboardingProgress = {
        ...progress,
        lastActiveAt: new Date(),
      };
      saveProgress(pausedProgress);
    }
  }, [progress, saveProgress]);

  const resumeFlow = useCallback(() => {
    if (activeFlow && progress) {
      setIsActive(true);
      setCurrentStepIndex(progress.currentStepIndex);
    }
  }, [activeFlow, progress]);

  const resetFlow = useCallback(() => {
    if (activeFlow) {
      setCurrentStepIndex(0);
      if (progress) {
        const resetProgress: OnboardingProgress = {
          ...progress,
          currentStepIndex: 0,
          completedSteps: [],
          lastActiveAt: new Date(),
          completed: false,
        };
        saveProgress(resetProgress);
      }
    }
  }, [activeFlow, progress, saveProgress]);

  const completeFlow = useCallback(() => {
    if (progress) {
      const completedProgress: OnboardingProgress = {
        ...progress,
        completed: true,
        lastActiveAt: new Date(),
      };
      saveProgress(completedProgress);
    }
    setIsActive(false);
  }, [progress, saveProgress]);

  const dismissOnboarding = useCallback(() => {
    setIsActive(false);
    setActiveFlow(null);
    setCurrentStepIndex(0);
  }, []);

  const updatePreferences = useCallback((newPreferences: Partial<typeof userPreferences>) => {
    const updated = { ...userPreferences, ...newPreferences };
    setUserPreferences(updated);
    localStorage.setItem('opensvm-onboarding-preferences', JSON.stringify(updated));
  }, [userPreferences]);

  const contextValue: OnboardingContextType = {
    availableFlows,
    activeFlow,
    currentStep,
    currentStepIndex,
    isActive,
    progress,
    userPreferences,
    startFlow,
    nextStep,
    previousStep,
    skipStep,
    pauseFlow,
    resumeFlow,
    resetFlow,
    completeFlow,
    dismissOnboarding,
    updatePreferences,
  };

  return (
    <OnboardingContext.Provider value={contextValue}>
      {children}
      {isActive && currentStep && (
        <OnboardingOverlay
          step={currentStep}
          targetElement={currentStep.target ? document.querySelector(currentStep.target) : null}
          onNext={nextStep}
          onPrevious={previousStep}
          onSkip={skipStep}
          onDismiss={dismissOnboarding}
          currentIndex={currentStepIndex}
          totalSteps={activeFlow?.steps.length || 1}
          canGoBack={currentStepIndex > 0}
          canGoNext={true}
        />
      )}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (context === undefined) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
}

// Onboarding launcher component
export function OnboardingLauncher() {
  const { availableFlows, startFlow } = useOnboarding();
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <EnhancedButton
        variant="outline"
        onClick={() => setIsOpen(true)}
        leftIcon={<Play className="h-4 w-4" />}
        className="fixed bottom-4 left-4 z-50"
      >
        {t('onboarding.startTour', 'Start Tour')}
      </EnhancedButton>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-1000">
          <Card className="p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-xl font-semibold">Choose Your Learning Path</h2>
              <EnhancedButton
                variant="ghost"
                size="icon-sm"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-4 w-4" />
              </EnhancedButton>
            </div>
            
            <div className="space-y-3">
              {availableFlows.map(flow => (
                <div
                  key={flow.id}
                  className="p-4 border rounded-lg hover:bg-accent cursor-pointer transition-colors"
                  onClick={() => {
                    startFlow(flow.id);
                    setIsOpen(false);
                  }}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-medium">{flow.title}</h3>
                    <Badge variant="outline">{flow.difficulty}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{flow.description}</p>
                  <div className="text-xs text-muted-foreground">
                    {flow.estimatedTime} min • {flow.steps.length} steps
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </>
  );
}