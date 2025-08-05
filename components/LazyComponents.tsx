'use client';

import { lazy, Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import React from 'react';

// Loading skeleton components for better perceived performance
const GraphSkeleton = () => (
  <div className="w-full h-[400px] border rounded-lg p-4">
    <Skeleton className="h-6 w-48 mb-4" />
    <div className="grid grid-cols-3 gap-4 h-full">
      <Skeleton className="h-full rounded" />
      <Skeleton className="h-full rounded" />
      <Skeleton className="h-full rounded" />
    </div>
  </div>
);

const TableSkeleton = () => (
  <div className="w-full border rounded-lg p-4">
    <Skeleton className="h-8 w-64 mb-4" />
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex space-x-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-28" />
        </div>
      ))}
    </div>
  </div>
);

// Lazy load heavy components with proper error boundaries
const LazyTransactionGraph = lazy(() => 
  import('@/components/transaction-graph/TransactionGraph').catch(err => {
    console.warn('Failed to load TransactionGraph:', err);
    return { 
      default: React.memo(() => (
        <div className="w-full h-[400px] border rounded-lg p-4 bg-gray-50 flex items-center justify-center">
          <p className="text-gray-500">Graph unavailable</p>
        </div>
      ))
    };
  })
);

const LazyAccountTabs = lazy(() => 
  import('@/app/account/[address]/tabs').catch(err => {
    console.warn('Failed to load AccountTabs:', err);
    return { 
      default: () => (
        <div className="w-full border rounded-lg p-4 bg-gray-50 flex items-center justify-center">
          <p className="text-gray-500">Tabs unavailable</p>
        </div>
      )
    };
  })
);

const LazyTransfersTable = lazy(() => 
  import('@/components/TransfersTable').then(mod => ({ default: mod.TransfersTable })).catch(err => {
    console.warn('Failed to load TransfersTable:', err);
    return { 
      default: React.memo(() => (
        <div className="w-full border rounded-lg p-4 bg-gray-50 flex items-center justify-center">
          <p className="text-gray-500">Table unavailable</p>
        </div>
      )) as any
    };
  })
);

// Optimized wrapper components with suspense
export const TransactionGraphLazy = (props: any) => (
  <Suspense fallback={<GraphSkeleton />}>
    <LazyTransactionGraph {...props} />
  </Suspense>
);

export const AccountTabsLazy = (props: any) => (
  <Suspense fallback={<TableSkeleton />}>
    <LazyAccountTabs {...props} />
  </Suspense>
);

export const TransfersTableLazy = (props: any) => (
  <Suspense fallback={<TableSkeleton />}>
    <LazyTransfersTable {...props} />
  </Suspense>
);

// Progressive loading hook for performance monitoring
export const useProgressiveLoading = () => {
  const [loadingStage, setLoadingStage] = useState<'initial' | 'core' | 'secondary' | 'complete'>('initial');
  
  useEffect(() => {
    // Stage 1: Core content loaded
    setLoadingStage('core');
    
    // Stage 2: Secondary content (after a small delay)
    const timer1 = setTimeout(() => setLoadingStage('secondary'), 100);
    
    // Stage 3: Everything loaded
    const timer2 = setTimeout(() => setLoadingStage('complete'), 500);
    
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);
  
  return loadingStage;
};

// Performance-optimized component wrapper
export const PerformanceWrapper = ({ 
  children, 
  priority = 'normal',
  fallback = null 
}: {
  children: React.ReactNode;
  priority?: 'high' | 'normal' | 'low';
  fallback?: React.ReactNode;
}) => {
  const loadingStage = useProgressiveLoading();
  
  // High priority components load immediately
  if (priority === 'high') {
    return <>{children}</>;
  }
  
  // Normal priority waits for core stage
  if (priority === 'normal' && loadingStage === 'initial') {
    return <>{fallback}</>;
  }
  
  // Low priority waits for secondary stage
  if (priority === 'low' && ['initial', 'core'].includes(loadingStage)) {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
};

// Import useState for the hook
import { useState, useEffect } from 'react';