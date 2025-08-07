'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Activity,
  DollarSign,
  Users,
  Target
} from 'lucide-react';

interface MetricsCardProps {
  config: {
    title: string;
    value: number | string;
    unit?: string;
    trend?: {
      value: number;
      direction: 'up' | 'down' | 'neutral';
      period?: string;
    } | null;
    color?: 'blue' | 'green' | 'red' | 'yellow' | 'purple';
    icon?: string;
    description?: string;
    target?: number;
  };
  data?: any;
  size: { w: number; h: number };
}

export function MetricsCard({ config, size }: MetricsCardProps) {
  const {
    title,
    value,
    unit = '',
    trend,
    color = 'blue',
    icon,
    description,
    target
  } = config;

  const colorClasses = {
    blue: 'text-blue-600 bg-blue-50 border-blue-200',
    green: 'text-green-600 bg-green-50 border-green-200',
    red: 'text-red-600 bg-red-50 border-red-200',
    yellow: 'text-yellow-600 bg-yellow-50 border-yellow-200',
    purple: 'text-purple-600 bg-purple-50 border-purple-200',
  };

  const iconMap = {
    activity: Activity,
    dollar: DollarSign,
    users: Users,
    target: Target,
  };

  const IconComponent = icon && iconMap[icon as keyof typeof iconMap] ? iconMap[icon as keyof typeof iconMap] : Activity;

  const getTrendIcon = () => {
    if (!trend) return null;
    
    switch (trend.direction) {
      case 'up':
        return <TrendingUp className="w-4 h-4 text-green-600" />;
      case 'down':
        return <TrendingDown className="w-4 h-4 text-red-600" />;
      default:
        return <Minus className="w-4 h-4 text-gray-600" />;
    }
  };

  const getTrendColor = () => {
    if (!trend) return '';
    
    switch (trend.direction) {
      case 'up':
        return 'text-green-600 bg-green-50';
      case 'down':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const formatValue = (val: number | string) => {
    if (typeof val === 'string') return val;
    
    // Format large numbers
    if (val >= 1000000) {
      return (val / 1000000).toFixed(1) + 'M';
    } else if (val >= 1000) {
      return (val / 1000).toFixed(1) + 'K';
    }
    
    return val.toLocaleString();
  };

  const progress = target ? Math.min((Number(value) / target) * 100, 100) : null;

  return (
    <Card className={cn('h-full', colorClasses[color])}>
      <CardContent className="p-4 h-full flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-2">
            <IconComponent className="w-5 h-5" />
            <h3 className="font-medium text-sm truncate">{title}</h3>
          </div>
          {trend && (
            <Badge variant="outline" className={cn('text-xs px-2 py-1', getTrendColor())}>
              <div className="flex items-center space-x-1">
                {getTrendIcon()}
                <span>
                  {Math.abs(trend.value)}%
                  {trend.period && ` ${trend.period}`}
                </span>
              </div>
            </Badge>
          )}
        </div>

        {/* Value */}
        <div className="flex-1 flex flex-col justify-center">
          <div className="text-2xl font-bold mb-1">
            {formatValue(value)}
            {unit && <span className="text-sm font-normal ml-1">{unit}</span>}
          </div>
          
          {description && (
            <p className="text-xs opacity-75 mb-2">{description}</p>
          )}

          {/* Progress bar for target */}
          {target && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs opacity-75">
                <span>Progress</span>
                <span>{Math.round(progress || 0)}% of target</span>
              </div>
              <div className="w-full bg-white/30 rounded-full h-2">
                <div
                  className="bg-current h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer - only show if there's space */}
        {size.h > 2 && (
          <div className="text-xs opacity-50 mt-2">
            Updated {new Date().toLocaleTimeString()}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Also export as default for backwards compatibility
export default MetricsCard;