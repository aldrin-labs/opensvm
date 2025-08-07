'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAnimation, useAnimationStyles } from '@/lib/animations';
import { ClickRipple, HoverScale, AnimatedContainer } from '@/components/ui/micro-interactions';
import { cn } from '@/lib/utils';
import { 
  ChevronDown, 
  ChevronUp, 
  Check, 
  X, 
  ArrowRight, 
  Plus, 
  Minus,
  Heart,
  Star,
  ThumbsUp
} from 'lucide-react';

// Animated Button with multiple effects
interface AnimatedButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  animation?: 'bounce' | 'pulse' | 'shake' | 'glow' | 'slide';
  hoverEffect?: boolean;
  ripple?: boolean;
  children: React.ReactNode;
}

export function AnimatedButton({
  variant = 'default',
  size = 'default',
  animation,
  hoverEffect = true,
  ripple = true,
  children,
  className,
  ...props
}: AnimatedButtonProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const { shouldAnimate, getDuration } = useAnimation();

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (animation && shouldAnimate()) {
      setIsAnimating(true);
      setTimeout(() => setIsAnimating(false), 600);
    }
    props.onClick?.(e);
  };

  const getAnimationClass = () => {
    if (!isAnimating || !shouldAnimate()) return '';
    
    switch (animation) {
      case 'bounce': return 'animate-bounce';
      case 'pulse': return 'animate-pulse';
      case 'shake': return 'animate-shake';
      case 'glow': return 'animate-glow';
      case 'slide': return 'animate-slide-right';
      default: return '';
    }
  };

  const ButtonComponent = (
    <Button
      {...props}
      variant={variant}
      size={size}
      onClick={handleClick}
      className={cn(
        'transition-all',
        hoverEffect && shouldAnimate() && 'transform hover:scale-105',
        getAnimationClass(),
        className
      )}
      style={{
        transitionDuration: shouldAnimate() ? getDuration('fast') : '0ms',
      }}
    >
      {children}
    </Button>
  );

  if (ripple) {
    return <ClickRipple>{ButtonComponent}</ClickRipple>;
  }

  return ButtonComponent;
}

// Expandable Card with smooth transitions
interface ExpandableCardProps {
  title: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  icon?: React.ReactNode;
  className?: string;
}

export function ExpandableCard({
  title,
  children,
  defaultExpanded = false,
  icon,
  className
}: ExpandableCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const contentRef = useRef<HTMLDivElement>(null);
  const { shouldAnimate, getDuration, getEasing } = useAnimation();

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <AnimatedContainer>
      <Card className={cn('overflow-hidden', className)}>
        <CardHeader 
          className="cursor-pointer select-none hover:bg-muted/50 transition-colors"
          onClick={toggleExpanded}
        >
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {icon}
              <span>{title}</span>
            </div>
            <div
              className="transition-transform"
              style={{
                transitionDuration: shouldAnimate() ? getDuration('fast') : '0ms',
                transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
              }}
            >
              <ChevronDown className="w-5 h-5" />
            </div>
          </CardTitle>
        </CardHeader>
        <div
          ref={contentRef}
          className="overflow-hidden transition-all"
          style={{
            maxHeight: isExpanded ? contentRef.current?.scrollHeight + 'px' : '0px',
            transitionDuration: shouldAnimate() ? getDuration('normal') : '0ms',
            transitionTimingFunction: getEasing(),
          }}
        >
          <CardContent className="pt-0">
            {children}
          </CardContent>
        </div>
      </Card>
    </AnimatedContainer>
  );
}

// Animated Input with focus effects
interface AnimatedInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  success?: boolean;
  icon?: React.ReactNode;
}

export function AnimatedInput({
  label,
  error,
  success,
  icon,
  className,
  ...props
}: AnimatedInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [hasValue, setHasValue] = useState(!!props.value || !!props.defaultValue);
  const { shouldAnimate, getDuration } = useAnimation();

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    props.onFocus?.(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    props.onBlur?.(e);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setHasValue(!!e.target.value);
    props.onChange?.(e);
  };

  return (
    <div className="relative">
      {label && (
        <label
          className={cn(
            'absolute left-3 transition-all pointer-events-none text-muted-foreground',
            (isFocused || hasValue) 
              ? 'top-0 -translate-y-1/2 text-xs bg-background px-2 text-primary'
              : 'top-1/2 -translate-y-1/2 text-sm'
          )}
          style={{
            transitionDuration: shouldAnimate() ? getDuration('fast') : '0ms',
          }}
        >
          {label}
        </label>
      )}
      <div className="relative">
        <Input
          {...props}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onChange={handleChange}
          className={cn(
            'transition-all',
            label && 'pt-6 pb-2',
            icon && 'pr-10',
            error && 'border-red-500 focus:border-red-500',
            success && 'border-green-500 focus:border-green-500',
            className
          )}
          style={{
            transitionDuration: shouldAnimate() ? getDuration('fast') : '0ms',
          }}
        />
        {icon && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            {success ? (
              <Check className="w-4 h-4 text-green-500" />
            ) : error ? (
              <X className="w-4 h-4 text-red-500" />
            ) : (
              icon
            )}
          </div>
        )}
      </div>
      {error && (
        <p className="text-sm text-red-500 mt-1 animate-in slide-in-from-top-1 duration-200">
          {error}
        </p>
      )}
    </div>
  );
}

// Animated Badge with hover effects
interface AnimatedBadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
  hoverable?: boolean;
  className?: string;
}

export function AnimatedBadge({
  children,
  variant = 'default',
  size = 'md',
  animated = true,
  hoverable = true,
  className
}: AnimatedBadgeProps) {
  const [isHovered, setIsHovered] = useState(false);
  const { shouldAnimate, getDuration } = useAnimation();

  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-2'
  };

  return (
    <Badge
      variant={variant}
      className={cn(
        'transition-all',
        sizeClasses[size],
        hoverable && 'hover:scale-110 cursor-pointer',
        animated && shouldAnimate() && 'animate-in fade-in duration-300',
        className
      )}
      style={{
        transitionDuration: shouldAnimate() ? getDuration('fast') : '0ms',
        transform: isHovered && hoverable && shouldAnimate() ? 'scale(1.1)' : 'scale(1)',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {children}
    </Badge>
  );
}

// Floating Action Button with animations
interface FloatingActionButtonProps {
  onClick?: () => void;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'secondary' | 'success' | 'danger';
  className?: string;
}

export function FloatingActionButton({
  onClick,
  icon = <Plus className="w-6 h-6" />,
  children,
  position = 'bottom-right',
  size = 'md',
  variant = 'primary',
  className
}: FloatingActionButtonProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { shouldAnimate, getDuration } = useAnimation();

  const positionClasses = {
    'bottom-right': 'bottom-6 right-6',
    'bottom-left': 'bottom-6 left-6',
    'top-right': 'top-6 right-6',
    'top-left': 'top-6 left-6',
  };

  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-14 h-14',
    lg: 'w-16 h-16',
  };

  const variantClasses = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
    success: 'bg-green-600 text-white hover:bg-green-700',
    danger: 'bg-red-600 text-white hover:bg-red-700',
  };

  return (
    <div className={cn('fixed z-50', positionClasses[position])}>
      {children && isExpanded && (
        <div
          className="mb-4 space-y-2 animate-in slide-in-from-bottom-2 fade-in duration-200"
          style={{
            animationDuration: shouldAnimate() ? getDuration('fast') : '0ms',
          }}
        >
          {children}
        </div>
      )}
      
      <button
        onClick={children ? () => setIsExpanded(!isExpanded) : onClick}
        className={cn(
          'rounded-full shadow-lg transition-all transform',
          'hover:scale-110 active:scale-95',
          'focus:outline-none focus:ring-4 focus:ring-primary/20',
          sizeClasses[size],
          variantClasses[variant],
          className
        )}
        style={{
          transitionDuration: shouldAnimate() ? getDuration('fast') : '0ms',
        }}
      >
        <div
          className="transition-transform"
          style={{
            transform: isExpanded ? 'rotate(45deg)' : 'rotate(0deg)',
            transitionDuration: shouldAnimate() ? getDuration('fast') : '0ms',
          }}
        >
          {icon}
        </div>
      </button>
    </div>
  );
}

// Animated Counter with increment/decrement
interface AnimatedCounterProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  className?: string;
}

export function AnimatedCounter({
  value,
  min = 0,
  max = 999,
  step = 1,
  onChange,
  className
}: AnimatedCounterProps) {
  const [isIncrementing, setIsIncrementing] = useState(false);
  const [isDecrementing, setIsDecrementing] = useState(false);
  const { shouldAnimate, getDuration } = useAnimation();

  const increment = () => {
    if (value < max) {
      setIsIncrementing(true);
      onChange(value + step);
      setTimeout(() => setIsIncrementing(false), 200);
    }
  };

  const decrement = () => {
    if (value > min) {
      setIsDecrementing(true);
      onChange(value - step);
      setTimeout(() => setIsDecrementing(false), 200);
    }
  };

  return (
    <div className={cn('flex items-center space-x-2', className)}>
      <AnimatedButton
        variant="outline"
        size="sm"
        onClick={decrement}
        disabled={value <= min}
        animation={isDecrementing ? 'pulse' : undefined}
      >
        <Minus className="w-4 h-4" />
      </AnimatedButton>
      
      <div
        className="min-w-[3rem] text-center font-bold text-lg transition-all"
        style={{
          transform: (isIncrementing || isDecrementing) && shouldAnimate() 
            ? 'scale(1.2)' 
            : 'scale(1)',
          transitionDuration: shouldAnimate() ? getDuration('fast') : '0ms',
        }}
      >
        {value}
      </div>
      
      <AnimatedButton
        variant="outline"
        size="sm"
        onClick={increment}
        disabled={value >= max}
        animation={isIncrementing ? 'pulse' : undefined}
      >
        <Plus className="w-4 h-4" />
      </AnimatedButton>
    </div>
  );
}

// Animated Like Button
interface AnimatedLikeButtonProps {
  liked: boolean;
  onToggle: () => void;
  count?: number;
  className?: string;
}

export function AnimatedLikeButton({
  liked,
  onToggle,
  count,
  className
}: AnimatedLikeButtonProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const { shouldAnimate, getDuration } = useAnimation();

  const handleToggle = () => {
    setIsAnimating(true);
    onToggle();
    setTimeout(() => setIsAnimating(false), 600);
  };

  return (
    <button
      onClick={handleToggle}
      className={cn(
        'flex items-center space-x-2 px-3 py-2 rounded-lg transition-all',
        'hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/20',
        liked ? 'text-red-500' : 'text-muted-foreground',
        className
      )}
      style={{
        transitionDuration: shouldAnimate() ? getDuration('fast') : '0ms',
      }}
    >
      <Heart
        className={cn(
          'w-5 h-5 transition-all',
          liked && 'fill-current',
          isAnimating && shouldAnimate() && 'animate-bounce'
        )}
        style={{
          transform: isAnimating && shouldAnimate() ? 'scale(1.3)' : 'scale(1)',
          transitionDuration: shouldAnimate() ? getDuration('fast') : '0ms',
        }}
      />
      {count !== undefined && (
        <span className="text-sm font-medium">{count}</span>
      )}
    </button>
  );
}

// Page Transition Wrapper
interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
}

export function PageTransition({ children, className }: PageTransitionProps) {
  const { shouldAnimate, getDuration } = useAnimation();

  return (
    <div
      className={cn(
        'animate-in fade-in slide-in-from-bottom-4',
        className
      )}
      style={{
        animationDuration: shouldAnimate() ? getDuration('normal') : '0ms',
        animationFillMode: 'both',
      }}
    >
      {children}
    </div>
  );
}

// CSS keyframes for custom animations
const customAnimations = `
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    10%, 30%, 50%, 70%, 90% { transform: translateX(-2px); }
    20%, 40%, 60%, 80% { transform: translateX(2px); }
  }

  @keyframes glow {
    0%, 100% { box-shadow: 0 0 5px currentColor; }
    50% { box-shadow: 0 0 20px currentColor, 0 0 30px currentColor; }
  }

  @keyframes slide-right {
    0% { transform: translateX(0); }
    50% { transform: translateX(4px); }
    100% { transform: translateX(0); }
  }

  .animate-shake {
    animation: shake 0.6s ease-in-out;
  }

  .animate-glow {
    animation: glow 0.6s ease-in-out;
  }

  .animate-slide-right {
    animation: slide-right 0.3s ease-in-out;
  }
`;

// Inject custom animations
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = customAnimations;
  document.head.appendChild(styleElement);
}
