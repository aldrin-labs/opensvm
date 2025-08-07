'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useI18n } from '@/lib/i18n';
import { useAccessibility } from '@/lib/accessibility';

// User expertise levels
export type ExpertiseLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';

// Interface complexity modes
export type InterfaceComplexity = 'simple' | 'standard' | 'advanced' | 'expert';

// Feature categories for progressive disclosure
export type FeatureCategory = 
  | 'basic-search'
  | 'advanced-search'
  | 'analytics'
  | 'developer-tools'
  | 'api-access'
  | 'data-export'
  | 'customization'
  | 'automation'
  | 'enterprise-features'
  | 'ai-analysis';

// User behavior tracking metrics
interface UserBehaviorMetrics {
  sessionDuration: number;
  actionsPerSession: number;
  featuresUsed: Set<string>;
  searchQueries: number;
  advancedFiltersUsed: number;
  apiCallsMade: number;
  dataExportsCreated: number;
  customizationsMade: number;
  helpSectionVisits: number;
  errorEncountered: number;
  timeSpentInAreas: Record<string, number>;
  returnVisits: number;
  consecutiveDays: number;
}

// User expertise assessment
interface ExpertiseAssessment {
  level: ExpertiseLevel;
  confidence: number; // 0-1 confidence score
  suggestedComplexity: InterfaceComplexity;
  lastAssessmentDate: Date;
  skillAreas: Record<FeatureCategory, number>; // 0-1 proficiency per area
}

// Feature accessibility configuration
interface FeatureConfig {
  id: string;
  category: FeatureCategory;
  minLevel: ExpertiseLevel;
  requiredSkillAreas?: FeatureCategory[];
  minSkillLevel?: number;
  description: string;
  learningResources?: string[];
}

// User preferences for progressive disclosure
interface ProgressiveDisclosurePreferences {
  manualComplexityOverride?: InterfaceComplexity;
  autoAdaptComplexity: boolean;
  showFeatureSuggestions: boolean;
  hideAdvancedFeatures: boolean;
  showProgressTracker: boolean;
  enableTutorialPrompts: boolean;
}

interface UserExpertiseContextType {
  currentLevel: ExpertiseLevel;
  currentComplexity: InterfaceComplexity;
  assessment: ExpertiseAssessment | null;
  behaviorMetrics: UserBehaviorMetrics;
  preferences: ProgressiveDisclosurePreferences;
  availableFeatures: FeatureConfig[];
  
  // Feature access methods
  isFeatureAvailable: (featureId: string) => boolean;
  shouldShowFeature: (category: FeatureCategory, minLevel?: ExpertiseLevel) => boolean;
  getFeatureSuggestions: () => FeatureConfig[];
  
  // User interaction tracking
  trackAction: (action: string, category?: FeatureCategory) => void;
  trackFeatureUsage: (featureId: string, duration?: number) => void;
  trackError: (errorType: string) => void;
  
  // Expertise management
  reassessExpertise: () => Promise<void>;
  upgradeComplexity: () => void;
  downgradeComplexity: () => void;
  setComplexityOverride: (complexity: InterfaceComplexity | null) => void;
  
  // Preferences
  updatePreferences: (preferences: Partial<ProgressiveDisclosurePreferences>) => void;
  
  // Progression tracking
  getProgressToNextLevel: () => number;
  getSkillGaps: () => FeatureCategory[];
  getLearningPath: () => FeatureConfig[];
}

const UserExpertiseContext = createContext<UserExpertiseContextType | undefined>(undefined);

// Default feature configurations
const defaultFeatures: FeatureConfig[] = [
  // Basic features - always available
  {
    id: 'basic-search',
    category: 'basic-search',
    minLevel: 'beginner',
    description: 'Search for transactions, blocks, and accounts',
  },
  {
    id: 'transaction-details',
    category: 'basic-search',
    minLevel: 'beginner',
    description: 'View basic transaction information',
  },
  
  // Intermediate features
  {
    id: 'advanced-filters',
    category: 'advanced-search',
    minLevel: 'intermediate',
    description: 'Use advanced search filters and date ranges',
    learningResources: ['/docs/advanced-search'],
  },
  {
    id: 'bulk-operations',
    category: 'advanced-search',
    minLevel: 'intermediate',
    description: 'Perform operations on multiple items',
  },
  
  // Advanced analytics
  {
    id: 'custom-dashboards',
    category: 'analytics',
    minLevel: 'advanced',
    requiredSkillAreas: ['basic-search', 'advanced-search'],
    minSkillLevel: 0.7,
    description: 'Create and customize analytics dashboards',
    learningResources: ['/docs/dashboards', '/tutorial/analytics'],
  },
  {
    id: 'data-visualization',
    category: 'analytics',
    minLevel: 'advanced',
    description: 'Advanced data visualization and charting',
  },
  
  // Developer tools
  {
    id: 'api-explorer',
    category: 'developer-tools',
    minLevel: 'advanced',
    description: 'Interactive API exploration and testing',
    learningResources: ['/docs/api'],
  },
  {
    id: 'webhook-management',
    category: 'developer-tools',
    minLevel: 'expert',
    requiredSkillAreas: ['api-access'],
    minSkillLevel: 0.8,
    description: 'Configure and manage webhooks',
  },
  
  // Enterprise features
  {
    id: 'role-based-access',
    category: 'enterprise-features',
    minLevel: 'expert',
    description: 'Advanced user and permission management',
  },
  {
    id: 'audit-logging',
    category: 'enterprise-features',
    minLevel: 'expert',
    description: 'Comprehensive audit trail and logging',
  },
  
  // AI features
  {
    id: 'ai-insights',
    category: 'ai-analysis',
    minLevel: 'intermediate',
    description: 'AI-powered transaction and pattern analysis',
  },
  {
    id: 'predictive-analytics',
    category: 'ai-analysis',
    minLevel: 'advanced',
    requiredSkillAreas: ['analytics', 'ai-analysis'],
    minSkillLevel: 0.6,
    description: 'Predictive modeling and forecasting',
  },
];

// Expertise level thresholds and requirements
const expertiseThresholds = {
  beginner: {
    minActions: 0,
    minFeatures: 0,
    minSessionDuration: 0,
    minReturnVisits: 0,
  },
  intermediate: {
    minActions: 50,
    minFeatures: 5,
    minSessionDuration: 300, // 5 minutes
    minReturnVisits: 3,
  },
  advanced: {
    minActions: 200,
    minFeatures: 10,
    minSessionDuration: 900, // 15 minutes
    minReturnVisits: 10,
  },
  expert: {
    minActions: 500,
    minFeatures: 15,
    minSessionDuration: 1800, // 30 minutes
    minReturnVisits: 25,
  },
};

// Initial behavior metrics
const initialMetrics: UserBehaviorMetrics = {
  sessionDuration: 0,
  actionsPerSession: 0,
  featuresUsed: new Set(),
  searchQueries: 0,
  advancedFiltersUsed: 0,
  apiCallsMade: 0,
  dataExportsCreated: 0,
  customizationsMade: 0,
  helpSectionVisits: 0,
  errorEncountered: 0,
  timeSpentInAreas: {},
  returnVisits: 0,
  consecutiveDays: 0,
};

const initialPreferences: ProgressiveDisclosurePreferences = {
  autoAdaptComplexity: true,
  showFeatureSuggestions: true,
  hideAdvancedFeatures: false,
  showProgressTracker: true,
  enableTutorialPrompts: true,
};

// Expertise assessment algorithm
function assessExpertise(metrics: UserBehaviorMetrics): ExpertiseAssessment {
  const levels: ExpertiseLevel[] = ['beginner', 'intermediate', 'advanced', 'expert'];
  let assessedLevel: ExpertiseLevel = 'beginner';
  let confidence = 0;

  // Check each level threshold
  for (const level of levels) {
    const threshold = expertiseThresholds[level];
    const meetsRequirements = 
      metrics.actionsPerSession >= threshold.minActions &&
      metrics.featuresUsed.size >= threshold.minFeatures &&
      metrics.sessionDuration >= threshold.minSessionDuration &&
      metrics.returnVisits >= threshold.minReturnVisits;

    if (meetsRequirements) {
      assessedLevel = level;
      confidence = Math.min(1, confidence + 0.2);
    }
  }

  // Calculate skill areas proficiency
  const skillAreas: Record<FeatureCategory, number> = {
    'basic-search': Math.min(1, metrics.searchQueries / 20),
    'advanced-search': Math.min(1, metrics.advancedFiltersUsed / 10),
    'analytics': Math.min(1, (metrics.timeSpentInAreas.analytics || 0) / 3600),
    'developer-tools': Math.min(1, metrics.apiCallsMade / 50),
    'api-access': Math.min(1, metrics.apiCallsMade / 100),
    'data-export': Math.min(1, metrics.dataExportsCreated / 5),
    'customization': Math.min(1, metrics.customizationsMade / 3),
    'automation': 0, // Would be calculated based on automation usage
    'enterprise-features': 0, // Would be calculated based on enterprise feature usage
    'ai-analysis': Math.min(1, (metrics.timeSpentInAreas.ai || 0) / 1800),
  };

  // Determine suggested complexity
  let suggestedComplexity: InterfaceComplexity = 'simple';
  if (assessedLevel === 'intermediate') suggestedComplexity = 'standard';
  else if (assessedLevel === 'advanced') suggestedComplexity = 'advanced';
  else if (assessedLevel === 'expert') suggestedComplexity = 'expert';

  return {
    level: assessedLevel,
    confidence,
    suggestedComplexity,
    lastAssessmentDate: new Date(),
    skillAreas,
  };
}

export function UserExpertiseProvider({ children }: { children: React.ReactNode }) {
  const [assessment, setAssessment] = useState<ExpertiseAssessment | null>(null);
  const [behaviorMetrics, setBehaviorMetrics] = useState<UserBehaviorMetrics>(initialMetrics);
  const [preferences, setPreferences] = useState<ProgressiveDisclosurePreferences>(initialPreferences);
  const [sessionStartTime] = useState<Date>(new Date());
  const [availableFeatures] = useState<FeatureConfig[]>(defaultFeatures);

  // Load saved data on mount
  useEffect(() => {
    const savedAssessment = localStorage.getItem('opensvm-user-assessment');
    const savedMetrics = localStorage.getItem('opensvm-behavior-metrics');
    const savedPreferences = localStorage.getItem('opensvm-progressive-preferences');

    if (savedAssessment) {
      try {
        const parsed = JSON.parse(savedAssessment);
        parsed.lastAssessmentDate = new Date(parsed.lastAssessmentDate);
        setAssessment(parsed);
      } catch (error) {
        console.warn('Failed to load user assessment:', error);
      }
    }

    if (savedMetrics) {
      try {
        const parsed = JSON.parse(savedMetrics);
        parsed.featuresUsed = new Set(parsed.featuresUsed);
        setBehaviorMetrics(parsed);
      } catch (error) {
        console.warn('Failed to load behavior metrics:', error);
      }
    }

    if (savedPreferences) {
      try {
        setPreferences(JSON.parse(savedPreferences));
      } catch (error) {
        console.warn('Failed to load progressive preferences:', error);
      }
    }

    // Initial assessment if none exists
    if (!savedAssessment) {
      const initialAssessment = assessExpertise(initialMetrics);
      setAssessment(initialAssessment);
    }
  }, []);

  // Save session data on unmount
  useEffect(() => {
    const handleBeforeUnload = () => {
      const sessionDuration = Date.now() - sessionStartTime.getTime();
      const updatedMetrics = {
        ...behaviorMetrics,
        sessionDuration: sessionDuration / 1000,
      };
      setBehaviorMetrics(updatedMetrics);
      localStorage.setItem('opensvm-behavior-metrics', JSON.stringify(updatedMetrics));
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [behaviorMetrics, sessionStartTime]);

  // Save assessment and preferences when they change
  useEffect(() => {
    if (assessment) {
      localStorage.setItem('opensvm-user-assessment', JSON.stringify(assessment));
    }
  }, [assessment]);

  useEffect(() => {
    localStorage.setItem('opensvm-progressive-preferences', JSON.stringify(preferences));
  }, [preferences]);

  const currentLevel = assessment?.level || 'beginner';
  const currentComplexity = preferences.manualComplexityOverride || 
    (preferences.autoAdaptComplexity ? assessment?.suggestedComplexity : 'standard') || 'simple';

  const trackAction = useCallback((action: string, category?: FeatureCategory) => {
    setBehaviorMetrics(prev => ({
      ...prev,
      actionsPerSession: prev.actionsPerSession + 1,
      featuresUsed: category ? new Set([...prev.featuresUsed, category]) : prev.featuresUsed,
    }));
  }, []);

  const trackFeatureUsage = useCallback((featureId: string, duration?: number) => {
    setBehaviorMetrics(prev => {
      const feature = availableFeatures.find(f => f.id === featureId);
      const category = feature?.category;
      
      return {
        ...prev,
        featuresUsed: new Set([...prev.featuresUsed, featureId]),
        timeSpentInAreas: category ? {
          ...prev.timeSpentInAreas,
          [category]: (prev.timeSpentInAreas[category] || 0) + (duration || 0),
        } : prev.timeSpentInAreas,
      };
    });
  }, [availableFeatures]);

  const trackError = useCallback((errorType: string) => {
    setBehaviorMetrics(prev => ({
      ...prev,
      errorEncountered: prev.errorEncountered + 1,
    }));
  }, []);

  const reassessExpertise = useCallback(async () => {
    const newAssessment = assessExpertise(behaviorMetrics);
    setAssessment(newAssessment);
  }, [behaviorMetrics]);

  const isFeatureAvailable = useCallback((featureId: string): boolean => {
    const feature = availableFeatures.find(f => f.id === featureId);
    if (!feature || !assessment) return false;

    // Check minimum level requirement
    const levelOrder: ExpertiseLevel[] = ['beginner', 'intermediate', 'advanced', 'expert'];
    const currentLevelIndex = levelOrder.indexOf(assessment.level);
    const requiredLevelIndex = levelOrder.indexOf(feature.minLevel);
    
    if (currentLevelIndex < requiredLevelIndex) return false;

    // Check skill area requirements
    if (feature.requiredSkillAreas && feature.minSkillLevel) {
      const hasRequiredSkills = feature.requiredSkillAreas.every(area => 
        (assessment.skillAreas[area] || 0) >= feature.minSkillLevel!
      );
      if (!hasRequiredSkills) return false;
    }

    return true;
  }, [availableFeatures, assessment]);

  const shouldShowFeature = useCallback((
    category: FeatureCategory, 
    minLevel: ExpertiseLevel = 'beginner'
  ): boolean => {
    if (!assessment) return minLevel === 'beginner';
    
    if (preferences.hideAdvancedFeatures && minLevel !== 'beginner') return false;

    const levelOrder: ExpertiseLevel[] = ['beginner', 'intermediate', 'advanced', 'expert'];
    const currentLevelIndex = levelOrder.indexOf(assessment.level);
    const requiredLevelIndex = levelOrder.indexOf(minLevel);

    return currentLevelIndex >= requiredLevelIndex;
  }, [assessment, preferences]);

  const getFeatureSuggestions = useCallback((): FeatureConfig[] => {
    if (!preferences.showFeatureSuggestions || !assessment) return [];

    return availableFeatures.filter(feature => {
      // Feature should be just above current level or accessible but not used
      const isNextLevel = feature.minLevel === 'intermediate' && assessment.level === 'beginner';
      const isAccessible = isFeatureAvailable(feature.id);
      const isNotUsed = !behaviorMetrics.featuresUsed.has(feature.id);
      
      return (isNextLevel || (isAccessible && isNotUsed));
    }).slice(0, 3); // Show up to 3 suggestions
  }, [availableFeatures, assessment, preferences, behaviorMetrics, isFeatureAvailable]);

  const upgradeComplexity = useCallback(() => {
    const complexities: InterfaceComplexity[] = ['simple', 'standard', 'advanced', 'expert'];
    const currentIndex = complexities.indexOf(currentComplexity);
    if (currentIndex < complexities.length - 1) {
      setPreferences(prev => ({
        ...prev,
        manualComplexityOverride: complexities[currentIndex + 1],
      }));
    }
  }, [currentComplexity]);

  const downgradeComplexity = useCallback(() => {
    const complexities: InterfaceComplexity[] = ['simple', 'standard', 'advanced', 'expert'];
    const currentIndex = complexities.indexOf(currentComplexity);
    if (currentIndex > 0) {
      setPreferences(prev => ({
        ...prev,
        manualComplexityOverride: complexities[currentIndex - 1],
      }));
    }
  }, [currentComplexity]);

  const setComplexityOverride = useCallback((complexity: InterfaceComplexity | null) => {
    setPreferences(prev => ({
      ...prev,
      manualComplexityOverride: complexity,
    }));
  }, []);

  const updatePreferences = useCallback((newPreferences: Partial<ProgressiveDisclosurePreferences>) => {
    setPreferences(prev => ({ ...prev, ...newPreferences }));
  }, []);

  const getProgressToNextLevel = useCallback((): number => {
    if (!assessment) return 0;

    const levels: ExpertiseLevel[] = ['beginner', 'intermediate', 'advanced', 'expert'];
    const currentIndex = levels.indexOf(assessment.level);
    if (currentIndex === levels.length - 1) return 100; // Already at max level

    const nextLevel = levels[currentIndex + 1];
    const nextThreshold = expertiseThresholds[nextLevel];
    
    // Calculate progress based on multiple metrics
    const actionProgress = Math.min(100, (behaviorMetrics.actionsPerSession / nextThreshold.minActions) * 100);
    const featureProgress = Math.min(100, (behaviorMetrics.featuresUsed.size / nextThreshold.minFeatures) * 100);
    const sessionProgress = Math.min(100, (behaviorMetrics.sessionDuration / nextThreshold.minSessionDuration) * 100);
    const visitProgress = Math.min(100, (behaviorMetrics.returnVisits / nextThreshold.minReturnVisits) * 100);

    return Math.round((actionProgress + featureProgress + sessionProgress + visitProgress) / 4);
  }, [assessment, behaviorMetrics]);

  const getSkillGaps = useCallback((): FeatureCategory[] => {
    if (!assessment) return [];

    return Object.entries(assessment.skillAreas)
      .filter(([_, proficiency]) => proficiency < 0.5)
      .map(([category]) => category as FeatureCategory);
  }, [assessment]);

  const getLearningPath = useCallback((): FeatureConfig[] => {
    if (!assessment) return [];

    const skillGaps = getSkillGaps();
    return availableFeatures
      .filter(feature => skillGaps.includes(feature.category))
      .filter(feature => isFeatureAvailable(feature.id))
      .sort((a, b) => {
        const aLevel = ['beginner', 'intermediate', 'advanced', 'expert'].indexOf(a.minLevel);
        const bLevel = ['beginner', 'intermediate', 'advanced', 'expert'].indexOf(b.minLevel);
        return aLevel - bLevel;
      })
      .slice(0, 5);
  }, [assessment, getSkillGaps, availableFeatures, isFeatureAvailable]);

  const contextValue: UserExpertiseContextType = {
    currentLevel,
    currentComplexity,
    assessment,
    behaviorMetrics,
    preferences,
    availableFeatures,
    isFeatureAvailable,
    shouldShowFeature,
    getFeatureSuggestions,
    trackAction,
    trackFeatureUsage,
    trackError,
    reassessExpertise,
    upgradeComplexity,
    downgradeComplexity,
    setComplexityOverride,
    updatePreferences,
    getProgressToNextLevel,
    getSkillGaps,
    getLearningPath,
  };

  return (
    <UserExpertiseContext.Provider value={contextValue}>
      {children}
    </UserExpertiseContext.Provider>
  );
}

export function useUserExpertise() {
  const context = useContext(UserExpertiseContext);
  if (context === undefined) {
    throw new Error('useUserExpertise must be used within a UserExpertiseProvider');
  }
  return context;
}

// Higher-order component for feature gating
export function withFeatureGate<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  featureId: string,
  fallback?: React.ComponentType<P>
) {
  return function FeatureGatedComponent(props: P) {
    const { isFeatureAvailable } = useUserExpertise();
    
    if (isFeatureAvailable(featureId)) {
      return <WrappedComponent {...props} />;
    }
    
    if (fallback) {
      const FallbackComponent = fallback;
      return <FallbackComponent {...props} />;
    }
    
    return null;
  };
}

// Feature availability hook
export function useFeature(featureId: string) {
  const { isFeatureAvailable, trackFeatureUsage } = useUserExpertise();
  
  const available = isFeatureAvailable(featureId);
  
  const trackUsage = useCallback((duration?: number) => {
    trackFeatureUsage(featureId, duration);
  }, [featureId, trackFeatureUsage]);
  
  return {
    available,
    trackUsage,
  };
}