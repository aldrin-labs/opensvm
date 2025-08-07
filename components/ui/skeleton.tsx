'use client';

import React from 'react';
import { cn } from '@/lib/utils';

// Base skeleton component
interface SkeletonProps {
  className?: string;
  animate?: boolean;
}

export function Skeleton({ className, animate = true }: SkeletonProps) {
  return (
    <div
      className={cn(
        "bg-muted rounded-md",
        animate && "animate-pulse",
        className
      )}
    />
  );
}

// Table skeleton
interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  showHeader?: boolean;
  className?: string;
}

export function TableSkeleton({ 
  rows = 5, 
  columns = 4, 
  showHeader = true, 
  className 
}: TableSkeletonProps) {
  return (
    <div className={cn("w-full", className)}>
      <div className="border border-border rounded-lg overflow-hidden">
        {showHeader && (
          <div className="bg-muted/50 border-b border-border p-4">
            <div className="flex space-x-4">
              {Array.from({ length: columns }).map((_, i) => (
                <Skeleton key={i} className="h-5 flex-1" />
              ))}
            </div>
          </div>
        )}
        <div className="divide-y divide-border">
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <div key={rowIndex} className="p-4">
              <div className="flex space-x-4">
                {Array.from({ length: columns }).map((_, colIndex) => (
                  <Skeleton 
                    key={colIndex} 
                    className="h-4 flex-1"
                    style={{ 
                      width: `${60 + Math.random() * 40}%` 
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Card skeleton
interface CardSkeletonProps {
  showImage?: boolean;
  showAvatar?: boolean;
  lines?: number;
  className?: string;
}

export function CardSkeleton({ 
  showImage = false, 
  showAvatar = false, 
  lines = 3, 
  className 
}: CardSkeletonProps) {
  return (
    <div className={cn("bg-card border border-border rounded-lg p-6", className)}>
      {showImage && (
        <Skeleton className="w-full h-48 mb-4 rounded-lg" />
      )}
      
      <div className="flex items-center space-x-4 mb-4">
        {showAvatar && (
          <Skeleton className="w-12 h-12 rounded-full" />
        )}
        <div className="flex-1 space-y-2">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
      
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton 
            key={i} 
            className="h-4"
            style={{ 
              width: i === lines - 1 ? `${50 + Math.random() * 30}%` : '100%' 
            }}
          />
        ))}
      </div>
      
      <div className="flex items-center space-x-2 mt-6 pt-4 border-t border-border">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-16" />
      </div>
    </div>
  );
}

// List skeleton
interface ListSkeletonProps {
  items?: number;
  showAvatar?: boolean;
  showActions?: boolean;
  className?: string;
}

export function ListSkeleton({ 
  items = 5, 
  showAvatar = true, 
  showActions = true, 
  className 
}: ListSkeletonProps) {
  return (
    <div className={cn("space-y-0 divide-y divide-border", className)}>
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center space-x-4 py-4">
          {showAvatar && (
            <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
          )}
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          {showActions && (
            <div className="flex space-x-2">
              <Skeleton className="w-8 h-8 rounded" />
              <Skeleton className="w-8 h-8 rounded" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// Chart skeleton
interface ChartSkeletonProps {
  type?: 'line' | 'bar' | 'pie' | 'area';
  showLegend?: boolean;
  className?: string;
}

export function ChartSkeleton({ 
  type = 'line', 
  showLegend = true, 
  className 
}: ChartSkeletonProps) {
  return (
    <div className={cn("bg-card border border-border rounded-lg p-6", className)}>
      <div className="flex items-center justify-between mb-6">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-8 w-24" />
      </div>
      
      <div className="flex items-end space-x-2 h-64 mb-4">
        {type === 'pie' ? (
          <div className="w-full h-full flex items-center justify-center">
            <Skeleton className="w-48 h-48 rounded-full" />
          </div>
        ) : type === 'bar' ? (
          Array.from({ length: 8 }).map((_, i) => (
            <Skeleton 
              key={i} 
              className="flex-1 rounded-t"
              style={{ height: `${30 + Math.random() * 70}%` }}
            />
          ))
        ) : (
          <div className="w-full h-full relative">
            <Skeleton className="w-full h-full rounded" />
            <div className="absolute inset-4 flex items-end">
              <svg className="w-full h-full">
                <defs>
                  <linearGradient id="skeleton-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" className="stop-color-muted" />
                    <stop offset="50%" className="stop-color-muted-foreground/20" />
                    <stop offset="100%" className="stop-color-muted" />
                  </linearGradient>
                </defs>
                <path
                  d={`M 0 ${200 - Math.random() * 50} ${Array.from({ length: 10 }).map((_, i) => 
                    `L ${(i + 1) * 30} ${200 - Math.random() * 100}`
                  ).join(' ')}`}
                  stroke="url(#skeleton-gradient)"
                  strokeWidth="2"
                  fill="none"
                />
              </svg>
            </div>
          </div>
        )}
      </div>
      
      {showLegend && (
        <div className="flex items-center justify-center space-x-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center space-x-2">
              <Skeleton className="w-3 h-3 rounded" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Dashboard skeleton
export function DashboardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-16" />
              </div>
              <Skeleton className="w-12 h-12 rounded" />
            </div>
          </div>
        ))}
      </div>
      
      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartSkeleton type="line" />
        <ChartSkeleton type="bar" />
      </div>
      
      {/* Table */}
      <TableSkeleton rows={8} columns={5} />
    </div>
  );
}

// Form skeleton
interface FormSkeletonProps {
  fields?: number;
  showSubmit?: boolean;
  className?: string;
}

export function FormSkeleton({ 
  fields = 5, 
  showSubmit = true, 
  className 
}: FormSkeletonProps) {
  return (
    <div className={cn("space-y-6", className)}>
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
      ))}
      
      {showSubmit && (
        <div className="flex items-center space-x-4 pt-4">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-20" />
        </div>
      )}
    </div>
  );
}

// Profile skeleton
export function ProfileSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("bg-card border border-border rounded-lg", className)}>
      {/* Cover Image */}
      <Skeleton className="w-full h-32 rounded-t-lg" />
      
      {/* Profile Content */}
      <div className="p-6">
        <div className="flex items-start space-x-4 -mt-12">
          <Skeleton className="w-20 h-20 rounded-full border-4 border-background" />
          <div className="flex-1 pt-8">
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>
          <Skeleton className="h-10 w-24 mt-8" />
        </div>
        
        <div className="mt-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-32" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-28" />
            </div>
          </div>
          
          <div className="flex items-center space-x-4 pt-4 border-t border-border">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="text-center">
                <Skeleton className="h-6 w-12 mx-auto mb-1" />
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Navigation skeleton
export function NavigationSkeleton({ 
  items = 6, 
  className 
}: { 
  items?: number; 
  className?: string; 
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center space-x-3 p-2">
          <Skeleton className="w-5 h-5 rounded" />
          <Skeleton className="h-4 flex-1" />
        </div>
      ))}
    </div>
  );
}

// Search results skeleton
export function SearchResultsSkeleton({ 
  results = 5, 
  className 
}: { 
  results?: number; 
  className?: string; 
}) {
  return (
    <div className={cn("space-y-4", className)}>
      {Array.from({ length: results }).map((_, i) => (
        <div key={i} className="border border-border rounded-lg p-4">
          <div className="space-y-2">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <div className="flex items-center space-x-2 pt-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-12" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Text skeleton with different line patterns
export function TextSkeleton({ 
  lines = 3, 
  className 
}: { 
  lines?: number; 
  className?: string; 
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => {
        const isLastLine = i === lines - 1;
        const width = isLastLine 
          ? `${50 + Math.random() * 30}%` 
          : `${80 + Math.random() * 20}%`;
        
        return (
          <Skeleton 
            key={i} 
            className="h-4" 
            style={{ width }}
          />
        );
      })}
    </div>
  );
}

export default Skeleton;