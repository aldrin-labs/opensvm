'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useAnimation, useAnimationStyles, useIntersectionObserver, ANIMATION_PRESETS } from '@/lib/animations';
import { cn } from '@/lib/utils';

// Animated container with entrance animations
interface AnimatedContainerProps {
  children: React.ReactNode;
  animation?: keyof typeof ANIMATION_PRESETS;
  delay?: number;
  duration?: 'fast' | 'normal' | 'slow';
  trigger?: boolean;
  className?: string;
}

export function AnimatedContainer({
  children,
  animation = 'fadeIn',
  delay = 0,
  duration = 'normal',
  trigger = true,
  className
}: AnimatedContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isVisible = useIntersectionObserver(containerRef);
  const { shouldAnimate, getDuration, getEasing } = useAnimation();
  
  const shouldTrigger = trigger && (isVisible || !shouldAnimate());
  
  return (
    <div
      ref={containerRef}
      className={cn(
        'transition-all',
        !shouldTrigger && 'opacity-0 translate-y-4',
        className
      )}
      style={{
        transitionDuration: shouldAnimate() ? getDuration(duration) : '0ms',
        transitionTimingFunction: getEasing(),
        transitionDelay: shouldAnimate() ? `${delay}ms` : '0ms',
        opacity: shouldTrigger ? 1 : 0,
        transform: shouldTrigger ? 'translateY(0)' : 'translateY(1rem)',
      }}
    >
      {children}
    </div>
  );
}

// Hover scale effect
interface HoverScaleProps {
  children: React.ReactNode;
  scale?: number;
  className?: string;
}

export function HoverScale({ children, scale = 1.05, className }: HoverScaleProps) {
  const { shouldAnimate, getDuration } = useAnimation();

  return (
    <div
      className={cn('transition-transform cursor-pointer', className)}
      style={{
        transitionDuration: shouldAnimate() ? getDuration('fast') : '0ms',
      }}
      onMouseEnter={(e) => {
        if (shouldAnimate()) {
          e.currentTarget.style.transform = `scale(${scale})`;
        }
      }}
      onMouseLeave={(e) => {
        if (shouldAnimate()) {
          e.currentTarget.style.transform = 'scale(1)';
        }
      }}
    >
      {children}
    </div>
  );
}

// Click ripple effect
interface ClickRippleProps {
  children: React.ReactNode;
  color?: string;
  className?: string;
}

export function ClickRipple({ children, color = 'rgba(255,255,255,0.3)', className }: ClickRippleProps) {
  const [ripples, setRipples] = useState<Array<{ x: number; y: number; id: number }>>([]);
  const { shouldAnimate } = useAnimation();

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!shouldAnimate()) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = Date.now();

    setRipples(prev => [...prev, { x, y, id }]);

    setTimeout(() => {
      setRipples(prev => prev.filter(ripple => ripple.id !== id));
    }, 600);
  };

  return (
    <div
      className={cn('relative overflow-hidden', className)}
      onClick={handleClick}
    >
      {children}
      {ripples.map(({ x, y, id }) => (
        <span
          key={id}
          className="absolute rounded-full animate-ping pointer-events-none"
          style={{
            left: x - 10,
            top: y - 10,
            width: 20,
            height: 20,
            backgroundColor: color,
            animationDuration: '600ms',
            animationTimingFunction: 'cubic-bezier(0, 0, 0.2, 1)',
          }}
        />
      ))}
    </div>
  );
}

// Stagger animation for lists
interface StaggerListProps {
  children: React.ReactNode[];
  delay?: number;
  animation?: 'fadeIn' | 'slideUp' | 'slideLeft' | 'scaleIn';
  className?: string;
}

export function StaggerList({ 
  children, 
  delay = 50, 
  animation = 'fadeIn', 
  className 
}: StaggerListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isVisible = useIntersectionObserver(containerRef);
  const { shouldAnimate, getDuration } = useAnimation();

  const getAnimationStyle = (index: number) => {
    if (!shouldAnimate()) return {};

    const animationDelay = isVisible ? index * delay : 0;
    
    const animations = {
      fadeIn: {
        opacity: isVisible ? 1 : 0,
        transition: `opacity ${getDuration()} ease-out ${animationDelay}ms`,
      },
      slideUp: {
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
        transition: `all ${getDuration()} ease-out ${animationDelay}ms`,
      },
      slideLeft: {
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateX(0)' : 'translateX(-20px)',
        transition: `all ${getDuration()} ease-out ${animationDelay}ms`,
      },
      scaleIn: {
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'scale(1)' : 'scale(0.9)',
        transition: `all ${getDuration()} ease-out ${animationDelay}ms`,
      },
    };

    return animations[animation];
  };

  return (
    <div ref={containerRef} className={className}>
      {children.map((child, index) => (
        <div key={index} style={getAnimationStyle(index)}>
          {child}
        </div>
      ))}
    </div>
  );
}

// Floating animation
interface FloatingProps {
  children: React.ReactNode;
  intensity?: 'subtle' | 'normal' | 'strong';
  duration?: number;
  className?: string;
}

export function Floating({ 
  children, 
  intensity = 'normal', 
  duration = 3000, 
  className 
}: FloatingProps) {
  const { shouldAnimate } = useAnimation();

  const intensityMap = {
    subtle: 5,
    normal: 10,
    strong: 15,
  };

  const floatDistance = intensityMap[intensity];

  if (!shouldAnimate()) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div
      className={cn('animate-bounce', className)}
      style={{
        animation: `float ${duration}ms ease-in-out infinite`,
        animationDirection: 'alternate',
      }}
    >
      {children}
      <style jsx>{`
        @keyframes float {
          0% { transform: translateY(0px); }
          100% { transform: translateY(-${floatDistance}px); }
        }
      `}</style>
    </div>
  );
}

// Parallax scroll effect
interface ParallaxProps {
  children: React.ReactNode;
  speed?: number;
  className?: string;
}

export function Parallax({ children, speed = 0.5, className }: ParallaxProps) {
  const [offsetY, setOffsetY] = useState(0);
  const { shouldAnimate } = useAnimation();

  useEffect(() => {
    if (!shouldAnimate()) return;

    const handleScroll = () => {
      setOffsetY(window.pageYOffset);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [shouldAnimate]);

  return (
    <div
      className={className}
      style={{
        transform: shouldAnimate() ? `translateY(${offsetY * speed}px)` : 'none',
      }}
    >
      {children}
    </div>
  );
}

// Magnetic hover effect
interface MagneticHoverProps {
  children: React.ReactNode;
  strength?: number;
  className?: string;
}

export function MagneticHover({ children, strength = 20, className }: MagneticHoverProps) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const elementRef = useRef<HTMLDivElement>(null);
  const { shouldAnimate, getDuration } = useAnimation();

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!shouldAnimate() || !elementRef.current) return;

    const rect = elementRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const deltaX = (e.clientX - centerX) / rect.width;
    const deltaY = (e.clientY - centerY) / rect.height;
    
    setPosition({
      x: deltaX * strength,
      y: deltaY * strength,
    });
  };

  const handleMouseLeave = () => {
    setPosition({ x: 0, y: 0 });
  };

  return (
    <div
      ref={elementRef}
      className={cn('transition-transform cursor-pointer', className)}
      style={{
        transform: shouldAnimate() 
          ? `translate(${position.x}px, ${position.y}px)` 
          : 'none',
        transitionDuration: getDuration('fast'),
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {children}
    </div>
  );
}

// Morph shape animation
interface MorphShapeProps {
  children: React.ReactNode;
  fromShape: string;
  toShape: string;
  trigger: boolean;
  duration?: 'fast' | 'normal' | 'slow';
  className?: string;
}

export function MorphShape({
  children,
  fromShape,
  toShape,
  trigger,
  duration = 'normal',
  className
}: MorphShapeProps) {
  const { getDuration, shouldAnimate } = useAnimation();

  return (
    <div
      className={cn('transition-all', className)}
      style={{
        clipPath: shouldAnimate() && trigger ? toShape : fromShape,
        transitionDuration: shouldAnimate() ? getDuration(duration) : '0ms',
      }}
    >
      {children}
    </div>
  );
}

// Text reveal animation
interface TextRevealProps {
  text: string;
  delay?: number;
  staggerDelay?: number;
  className?: string;
}

export function TextReveal({ 
  text, 
  delay = 0, 
  staggerDelay = 50, 
  className 
}: TextRevealProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isVisible = useIntersectionObserver(containerRef);
  const { shouldAnimate, getDuration } = useAnimation();

  const words = text.split(' ');

  return (
    <div ref={containerRef} className={cn('overflow-hidden', className)}>
      {words.map((word, index) => (
        <span
          key={index}
          className="inline-block"
          style={{
            opacity: shouldAnimate() && isVisible ? 1 : 0,
            transform: shouldAnimate() && isVisible ? 'translateY(0)' : 'translateY(100%)',
            transition: shouldAnimate() 
              ? `all ${getDuration()} ease-out ${delay + index * staggerDelay}ms`
              : 'none',
          }}
        >
          {word}&nbsp;
        </span>
      ))}
    </div>
  );
}

// Loading shimmer effect
interface ShimmerProps {
  children: React.ReactNode;
  className?: string;
}

export function Shimmer({ children, className }: ShimmerProps) {
  const { shouldAnimate } = useAnimation();

  if (!shouldAnimate()) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div className={cn('relative overflow-hidden', className)}>
      {children}
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      <style jsx>{`
        @keyframes shimmer {
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>
    </div>
  );
}

// Breath animation
interface BreathProps {
  children: React.ReactNode;
  intensity?: number;
  duration?: number;
  className?: string;
}

export function Breath({ 
  children, 
  intensity = 0.05, 
  duration = 4000, 
  className 
}: BreathProps) {
  const { shouldAnimate } = useAnimation();

  if (!shouldAnimate()) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div
      className={className}
      style={{
        animation: `breath ${duration}ms ease-in-out infinite`,
      }}
    >
      {children}
      <style jsx>{`
        @keyframes breath {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(${1 + intensity}); }
        }
      `}</style>
    </div>
  );
}

// Count up animation
interface CountUpProps {
  from: number;
  to: number;
  duration?: number;
  delay?: number;
  className?: string;
  formatter?: (value: number) => string;
}

export function CountUp({
  from,
  to,
  duration = 2000,
  delay = 0,
  className,
  formatter = (value) => Math.round(value).toString()
}: CountUpProps) {
  const [count, setCount] = useState(from);
  const elementRef = useRef<HTMLSpanElement>(null);
  const isVisible = useIntersectionObserver(elementRef);
  const { shouldAnimate } = useAnimation();

  useEffect(() => {
    if (!isVisible || !shouldAnimate()) {
      setCount(to);
      return;
    }

    const timer = setTimeout(() => {
      const startTime = Date.now();
      const difference = to - from;

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function (easeOutCubic)
        const eased = 1 - Math.pow(1 - progress, 3);
        const currentCount = from + difference * eased;
        
        setCount(currentCount);

        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };

      animate();
    }, delay);

    return () => clearTimeout(timer);
  }, [isVisible, from, to, duration, delay, shouldAnimate]);

  return (
    <span ref={elementRef} className={className}>
      {formatter(count)}
    </span>
  );
}
