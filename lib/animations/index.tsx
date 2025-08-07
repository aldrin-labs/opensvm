'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useTheme } from '@/lib/design-system/theme-provider';
import { useAccessibility } from '@/lib/accessibility';

// Animation configuration types
export type AnimationDuration = 'fast' | 'normal' | 'slow' | 'instant';
export type AnimationEasing = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'bounce' | 'elastic';
export type AnimationType = 'fade' | 'slide' | 'scale' | 'rotate' | 'bounce' | 'elastic' | 'flip';

export interface AnimationConfig {
  duration: AnimationDuration;
  easing: AnimationEasing;
  respectReducedMotion: boolean;
  enableInteractions: boolean;
  enableTransitions: boolean;
  enableScrollAnimations: boolean;
  staggerDelay: number;
}

// Default animation configuration
const defaultAnimationConfig: AnimationConfig = {
  duration: 'normal',
  easing: 'ease-in-out',
  respectReducedMotion: true,
  enableInteractions: true,
  enableTransitions: true,
  enableScrollAnimations: true,
  staggerDelay: 50,
};

// Animation duration mappings
export const ANIMATION_DURATIONS = {
  instant: '0ms',
  fast: '150ms',
  normal: '300ms',
  slow: '500ms',
} as const;

// Animation easing mappings
export const ANIMATION_EASINGS = {
  linear: 'linear',
  'ease-in': 'ease-in',
  'ease-out': 'ease-out',
  'ease-in-out': 'ease-in-out',
  bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  elastic: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
} as const;

// Animation context
interface AnimationContextType {
  config: AnimationConfig;
  updateConfig: (newConfig: Partial<AnimationConfig>) => void;
  isReducedMotion: boolean;
  getDuration: (duration?: AnimationDuration) => string;
  getEasing: (easing?: AnimationEasing) => string;
  shouldAnimate: () => boolean;
}

const AnimationContext = createContext<AnimationContextType | undefined>(undefined);

// Animation provider
export function AnimationProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<AnimationConfig>(defaultAnimationConfig);
  const [isReducedMotion, setIsReducedMotion] = useState(false);
  const { currentConfig } = useTheme();
  const { announceToScreenReader } = useAccessibility();

  // Check for reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setIsReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setIsReducedMotion(e.matches);
      if (e.matches) {
        announceToScreenReader('Animations have been reduced for accessibility', 'polite');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [announceToScreenReader]);

  // Update config when theme changes
  useEffect(() => {
    if (currentConfig?.reducedMotion !== undefined) {
      setConfig(prev => ({
        ...prev,
        respectReducedMotion: currentConfig.reducedMotion
      }));
    }
  }, [currentConfig?.reducedMotion]);

  const updateConfig = (newConfig: Partial<AnimationConfig>) => {
    setConfig(prev => ({ ...prev, ...newConfig }));
  };

  const getDuration = (duration?: AnimationDuration): string => {
    if (!shouldAnimate()) return ANIMATION_DURATIONS.instant;
    return ANIMATION_DURATIONS[duration || config.duration];
  };

  const getEasing = (easing?: AnimationEasing): string => {
    return ANIMATION_EASINGS[easing || config.easing];
  };

  const shouldAnimate = (): boolean => {
    if (config.respectReducedMotion && isReducedMotion) return false;
    return true;
  };

  const contextValue: AnimationContextType = {
    config,
    updateConfig,
    isReducedMotion,
    getDuration,
    getEasing,
    shouldAnimate,
  };

  return (
    <AnimationContext.Provider value={contextValue}>
      {children}
    </AnimationContext.Provider>
  );
}

export function useAnimation() {
  const context = useContext(AnimationContext);
  if (context === undefined) {
    throw new Error('useAnimation must be used within an AnimationProvider');
  }
  return context;
}

// Animation utilities
export function getAnimationClasses(
  type: AnimationType,
  duration?: AnimationDuration,
  easing?: AnimationEasing,
  delay?: number
): string {
  const animationDuration = ANIMATION_DURATIONS[duration || 'normal'];
  const animationEasing = ANIMATION_EASINGS[easing || 'ease-in-out'];
  
  const baseClasses = 'transition-all';
  const durationClass = `duration-[${animationDuration}]`;
  const easingStyle = `ease-[${animationEasing}]`;
  const delayClass = delay ? `delay-[${delay}ms]` : '';

  return [baseClasses, durationClass, easingStyle, delayClass].filter(Boolean).join(' ');
}

// Custom animation hook
export function useAnimationStyles(
  duration?: AnimationDuration,
  easing?: AnimationEasing
) {
  const { getDuration, getEasing, shouldAnimate } = useAnimation();

  return {
    duration: shouldAnimate() ? getDuration(duration) : '0ms',
    easing: getEasing(easing),
    shouldAnimate: shouldAnimate(),
  };
}

// Intersection Observer hook for scroll animations
export function useIntersectionObserver(
  elementRef: React.RefObject<Element>,
  options: IntersectionObserverInit = {}
): boolean {
  const [isIntersecting, setIsIntersecting] = useState(false);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(([entry]) => {
      setIsIntersecting(entry.isIntersecting);
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -100px 0px',
      ...options,
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [elementRef, options]);

  return isIntersecting;
}

// Animation sequence hook
export function useAnimationSequence(
  steps: Array<{
    delay: number;
    callback: () => void;
  }>,
  trigger: boolean = true
) {
  const { shouldAnimate } = useAnimation();

  useEffect(() => {
    if (!trigger || !shouldAnimate()) return;

    const timeouts = steps.map(({ delay, callback }) => 
      setTimeout(callback, delay)
    );

    return () => {
      timeouts.forEach(clearTimeout);
    };
  }, [trigger, steps, shouldAnimate]);
}

// Stagger animation hook
export function useStaggerAnimation<T extends HTMLElement>(
  itemsRef: React.MutableRefObject<T[]>,
  options: {
    delay?: number;
    duration?: AnimationDuration;
    trigger?: boolean;
  } = {}
) {
  const { delay = 50, duration = 'normal', trigger = true } = options;
  const { getDuration, shouldAnimate } = useAnimation();

  useEffect(() => {
    if (!trigger || !shouldAnimate()) return;

    const items = itemsRef.current;
    if (!items.length) return;

    items.forEach((item, index) => {
      if (!item) return;
      
      const animationDelay = index * delay;
      item.style.animationDelay = `${animationDelay}ms`;
      item.style.animationDuration = getDuration(duration);
      item.style.animationFillMode = 'both';
    });
  }, [trigger, delay, duration, getDuration, shouldAnimate, itemsRef]);
}

// Spring animation hook using Web Animations API
export function useSpringAnimation(
  elementRef: React.RefObject<HTMLElement>,
  config: {
    from: Partial<CSSStyleDeclaration>;
    to: Partial<CSSStyleDeclaration>;
    trigger: boolean;
    duration?: number;
    easing?: string;
  }
) {
  const { shouldAnimate } = useAnimation();

  useEffect(() => {
    const element = elementRef.current;
    if (!element || !config.trigger || !shouldAnimate()) return;

    const animation = element.animate(
      [config.from, config.to],
      {
        duration: config.duration || 300,
        easing: config.easing || 'ease-out',
        fill: 'forwards',
      }
    );

    return () => animation.cancel();
  }, [config, shouldAnimate, elementRef]);
}

// Performance monitoring for animations
export function useAnimationPerformance() {
  const [fps, setFps] = useState<number>(60);
  const [isPerformanceGood, setIsPerformanceGood] = useState(true);

  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();
    let animationId: number;

    function measureFPS() {
      frameCount++;
      const currentTime = performance.now();
      
      if (currentTime >= lastTime + 1000) {
        const currentFps = Math.round((frameCount * 1000) / (currentTime - lastTime));
        setFps(currentFps);
        setIsPerformanceGood(currentFps >= 45); // Consider 45fps as good performance
        
        frameCount = 0;
        lastTime = currentTime;
      }
      
      animationId = requestAnimationFrame(measureFPS);
    }

    animationId = requestAnimationFrame(measureFPS);
    return () => cancelAnimationFrame(animationId);
  }, []);

  return { fps, isPerformanceGood };
}

// Keyframe animation generator
export function generateKeyframes(
  name: string,
  keyframes: Record<string, Partial<CSSStyleDeclaration>>
): string {
  const keyframeRules = Object.entries(keyframes)
    .map(([percentage, styles]) => {
      const styleString = Object.entries(styles)
        .map(([prop, value]) => `${prop}: ${value}`)
        .join('; ');
      return `${percentage} { ${styleString} }`;
    })
    .join('\n  ');

  return `@keyframes ${name} {\n  ${keyframeRules}\n}`;
}

// Animation preset configurations
export const ANIMATION_PRESETS = {
  // Entrance animations
  fadeIn: {
    from: { opacity: '0' },
    to: { opacity: '1' },
  },
  slideInUp: {
    from: { transform: 'translateY(100%)', opacity: '0' },
    to: { transform: 'translateY(0)', opacity: '1' },
  },
  slideInDown: {
    from: { transform: 'translateY(-100%)', opacity: '0' },
    to: { transform: 'translateY(0)', opacity: '1' },
  },
  slideInLeft: {
    from: { transform: 'translateX(-100%)', opacity: '0' },
    to: { transform: 'translateX(0)', opacity: '1' },
  },
  slideInRight: {
    from: { transform: 'translateX(100%)', opacity: '0' },
    to: { transform: 'translateX(0)', opacity: '1' },
  },
  scaleIn: {
    from: { transform: 'scale(0)', opacity: '0' },
    to: { transform: 'scale(1)', opacity: '1' },
  },
  bounceIn: {
    from: { transform: 'scale(0.3)', opacity: '0' },
    to: { transform: 'scale(1)', opacity: '1' },
  },
  
  // Exit animations
  fadeOut: {
    from: { opacity: '1' },
    to: { opacity: '0' },
  },
  slideOutUp: {
    from: { transform: 'translateY(0)', opacity: '1' },
    to: { transform: 'translateY(-100%)', opacity: '0' },
  },
  slideOutDown: {
    from: { transform: 'translateY(0)', opacity: '1' },
    to: { transform: 'translateY(100%)', opacity: '0' },
  },
  scaleOut: {
    from: { transform: 'scale(1)', opacity: '1' },
    to: { transform: 'scale(0)', opacity: '0' },
  },

  // Attention animations
  pulse: {
    '0%': { transform: 'scale(1)' },
    '50%': { transform: 'scale(1.05)' },
    '100%': { transform: 'scale(1)' },
  },
  shake: {
    '0%, 100%': { transform: 'translateX(0)' },
    '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-10px)' },
    '20%, 40%, 60%, 80%': { transform: 'translateX(10px)' },
  },
  bounce: {
    '0%, 20%, 53%, 80%, 100%': { transform: 'translateY(0)' },
    '40%, 43%': { transform: 'translateY(-30px)' },
    '70%': { transform: 'translateY(-15px)' },
    '90%': { transform: 'translateY(-4px)' },
  },
} as const;

export default AnimationProvider;