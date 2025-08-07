'use client';

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { useErrorHandling } from '@/lib/error-handling';
import { useAccessibility } from '@/lib/accessibility';
import { cn } from '@/lib/utils';

// Types for optimistic updates
export type OptimisticAction<T = any> = {
  id: string;
  type: string;
  payload: T;
  timestamp: Date;
  status: 'pending' | 'success' | 'error';
  error?: Error;
  rollbackData?: any;
};

export type OptimisticUpdate<T = any> = {
  id: string;
  optimisticData: T;
  actualData?: T;
  action: OptimisticAction<T>;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
  onRollback?: (data: any) => void;
};

// Optimistic UI context
interface OptimisticUIContextType {
  // State management
  pendingActions: OptimisticAction[];
  completedActions: OptimisticAction[];
  
  // Action management
  addOptimisticUpdate: <T>(
    id: string,
    optimisticData: T,
    action: () => Promise<T>,
    options?: {
      type?: string;
      rollbackData?: any;
      onSuccess?: (data: T) => void;
      onError?: (error: Error) => void;
      onRollback?: () => void;
    }
  ) => Promise<T>;
  
  // Bulk operations
  addOptimisticUpdates: <T>(
    updates: Array<{
      id: string;
      optimisticData: T;
      action: () => Promise<T>;
      options?: any;
    }>
  ) => Promise<T[]>;
  
  // State queries
  isActionPending: (id: string) => boolean;
  getActionStatus: (id: string) => OptimisticAction['status'] | null;
  getPendingActionsCount: () => number;
  
  // Utilities
  clearCompletedActions: () => void;
  retryFailedAction: (id: string) => Promise<void>;
  rollbackAction: (id: string) => void;
}

const OptimisticUIContext = createContext<OptimisticUIContextType | undefined>(undefined);

// Optimistic UI Provider
export function OptimisticUIProvider({ children }: { children: React.ReactNode }) {
  const [actions, setActions] = useState<OptimisticAction[]>([]);
  const [updates, setUpdates] = useState<Map<string, OptimisticUpdate>>(new Map());
  const { reportError } = useErrorHandling();
  const { announceToScreenReader } = useAccessibility();

  const pendingActions = actions.filter(action => action.status === 'pending');
  const completedActions = actions.filter(action => action.status !== 'pending');

  const updateAction = useCallback((id: string, updates: Partial<OptimisticAction>) => {
    setActions(prev => prev.map(action => 
      action.id === id ? { ...action, ...updates } : action
    ));
  }, []);

  const addOptimisticUpdate = useCallback(async <T,>(
    id: string,
    optimisticData: T,
    action: () => Promise<T>,
    options: {
      type?: string;
      rollbackData?: any;
      onSuccess?: (data: T) => void;
      onError?: (error: Error) => void;
      onRollback?: () => void;
    } = {}
  ): Promise<T> => {
    const actionRecord: OptimisticAction<T> = {
      id,
      type: options.type || 'update',
      payload: optimisticData,
      timestamp: new Date(),
      status: 'pending',
      rollbackData: options.rollbackData,
    };

    const updateRecord: OptimisticUpdate<T> = {
      id,
      optimisticData,
      action: actionRecord,
      onSuccess: options.onSuccess,
      onError: options.onError,
      onRollback: options.onRollback,
    };

    // Add to state immediately (optimistic)
    setActions(prev => [...prev, actionRecord]);
    setUpdates(prev => new Map(prev).set(id, updateRecord));

    try {
      // Execute actual action
      const result = await action();
      
      // Update with success
      updateAction(id, { status: 'success' });
      setUpdates(prev => {
        const newMap = new Map(prev);
        const update = newMap.get(id);
        if (update) {
          update.actualData = result;
          newMap.set(id, update);
        }
        return newMap;
      });

      // Call success callback
      options.onSuccess?.(result);
      
      return result;
    } catch (error) {
      // Update with error
      updateAction(id, { status: 'error', error: error as Error });
      
      // Report error
      reportError(error as Error, { 
        component: 'OptimisticUI', 
        actionId: id, 
        actionType: options.type 
      });
      
      // Announce to screen reader
      announceToScreenReader(`Action failed: ${(error as Error).message}`, 'assertive');
      
      // Call error callback
      options.onError?.(error as Error);
      
      throw error;
    }
  }, [updateAction, reportError, announceToScreenReader]);

  const addOptimisticUpdates = useCallback(async <T,>(
    updatesList: Array<{
      id: string;
      optimisticData: T;
      action: () => Promise<T>;
      options?: any;
    }>
  ): Promise<T[]> => {
    const promises = updatesList.map(({ id, optimisticData, action, options }) =>
      addOptimisticUpdate(id, optimisticData, action, options)
    );
    
    return Promise.all(promises);
  }, [addOptimisticUpdate]);

  const isActionPending = useCallback((id: string): boolean => {
    return actions.some(action => action.id === id && action.status === 'pending');
  }, [actions]);

  const getActionStatus = useCallback((id: string): OptimisticAction['status'] | null => {
    const action = actions.find(action => action.id === id);
    return action?.status || null;
  }, [actions]);

  const getPendingActionsCount = useCallback((): number => {
    return pendingActions.length;
  }, [pendingActions.length]);

  const clearCompletedActions = useCallback(() => {
    setActions(prev => prev.filter(action => action.status === 'pending'));
    setUpdates(prev => {
      const newMap = new Map();
      prev.forEach((update, id) => {
        if (update.action.status === 'pending') {
          newMap.set(id, update);
        }
      });
      return newMap;
    });
  }, []);

  const retryFailedAction = useCallback(async (id: string): Promise<void> => {
    const update = updates.get(id);
    if (!update || update.action.status !== 'error') {
      return;
    }

    updateAction(id, { status: 'pending', error: undefined });

    try {
      // Retry the action (this is a simplified approach)
      // In a real implementation, you'd need to store the original action function
      announceToScreenReader('Retrying action...', 'polite');
    } catch (error) {
      updateAction(id, { status: 'error', error: error as Error });
      reportError(error as Error, { component: 'OptimisticUI', actionId: id, retry: true });
    }
  }, [updates, updateAction, announceToScreenReader, reportError]);

  const rollbackAction = useCallback((id: string) => {
    const update = updates.get(id);
    if (!update) return;

    // Call rollback callback
    update.onRollback?.();

    // Remove the action
    setActions(prev => prev.filter(action => action.id !== id));
    setUpdates(prev => {
      const newMap = new Map(prev);
      newMap.delete(id);
      return newMap;
    });

    announceToScreenReader('Action rolled back', 'polite');
  }, [updates, announceToScreenReader]);

  // Auto-cleanup completed actions after 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      setActions(prev => prev.filter(action => 
        action.status === 'pending' || action.timestamp > fiveMinutesAgo
      ));
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, []);

  const contextValue: OptimisticUIContextType = {
    pendingActions,
    completedActions,
    addOptimisticUpdate,
    addOptimisticUpdates,
    isActionPending,
    getActionStatus,
    getPendingActionsCount,
    clearCompletedActions,
    retryFailedAction,
    rollbackAction,
  };

  return (
    <OptimisticUIContext.Provider value={contextValue}>
      {children}
    </OptimisticUIContext.Provider>
  );
}

export function useOptimisticUI() {
  const context = useContext(OptimisticUIContext);
  if (context === undefined) {
    throw new Error('useOptimisticUI must be used within an OptimisticUIProvider');
  }
  return context;
}

// Hook for optimistic data mutations
export function useOptimisticMutation<TData, TVariables = any>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options: {
    onSuccess?: (data: TData, variables: TVariables) => void;
    onError?: (error: Error, variables: TVariables) => void;
    generateOptimisticData: (variables: TVariables) => TData;
    generateId?: (variables: TVariables) => string;
  }
) {
  const { addOptimisticUpdate } = useOptimisticUI();
  const [isLoading, setIsLoading] = useState(false);

  const mutate = useCallback(async (variables: TVariables): Promise<TData> => {
    setIsLoading(true);
    
    const id = options.generateId?.(variables) || 
                `mutation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const optimisticData = options.generateOptimisticData(variables);

    try {
      const result = await addOptimisticUpdate(
        id,
        optimisticData,
        () => mutationFn(variables),
        {
          type: 'mutation',
          onSuccess: (data) => options.onSuccess?.(data, variables),
          onError: (error) => options.onError?.(error, variables),
        }
      );
      
      return result;
    } finally {
      setIsLoading(false);
    }
  }, [addOptimisticUpdate, mutationFn, options]);

  return { mutate, isLoading };
}

// Hook for optimistic list updates
export function useOptimisticList<T>(
  initialData: T[],
  keyExtractor: (item: T) => string | number = (item: any) => item.id
) {
  const [optimisticItems, setOptimisticItems] = useState<Map<string, T>>(new Map());
  const { addOptimisticUpdate } = useOptimisticUI();

  // Merge actual data with optimistic updates
  const data = React.useMemo(() => {
    const merged = [...initialData];
    
    // Apply optimistic updates
    optimisticItems.forEach((optimisticItem, id) => {
      const index = merged.findIndex(item => keyExtractor(item).toString() === id);
      if (index !== -1) {
        merged[index] = optimisticItem;
      } else {
        merged.push(optimisticItem);
      }
    });
    
    return merged;
  }, [initialData, optimisticItems, keyExtractor]);

  const addItem = useCallback(async (
    newItem: T,
    saveFn: (item: T) => Promise<T>
  ): Promise<T> => {
    const id = keyExtractor(newItem).toString();
    
    // Add optimistic item
    setOptimisticItems(prev => new Map(prev).set(id, newItem));
    
    return addOptimisticUpdate(
      `add-${id}`,
      newItem,
      () => saveFn(newItem),
      {
        type: 'add',
        onSuccess: () => {
          // Remove from optimistic items when confirmed
          setOptimisticItems(prev => {
            const newMap = new Map(prev);
            newMap.delete(id);
            return newMap;
          });
        },
        onError: () => {
          // Remove from optimistic items on error
          setOptimisticItems(prev => {
            const newMap = new Map(prev);
            newMap.delete(id);
            return newMap;
          });
        },
      }
    );
  }, [addOptimisticUpdate, keyExtractor]);

  const updateItem = useCallback(async (
    updatedItem: T,
    updateFn: (item: T) => Promise<T>
  ): Promise<T> => {
    const id = keyExtractor(updatedItem).toString();
    
    // Store current item for rollback
    const currentItem = data.find(item => keyExtractor(item).toString() === id);
    
    // Apply optimistic update
    setOptimisticItems(prev => new Map(prev).set(id, updatedItem));
    
    return addOptimisticUpdate(
      `update-${id}`,
      updatedItem,
      () => updateFn(updatedItem),
      {
        type: 'update',
        rollbackData: currentItem,
        onSuccess: () => {
          // Remove from optimistic items when confirmed
          setOptimisticItems(prev => {
            const newMap = new Map(prev);
            newMap.delete(id);
            return newMap;
          });
        },
        onError: () => {
          // Rollback optimistic update
          setOptimisticItems(prev => {
            const newMap = new Map(prev);
            if (currentItem) {
              newMap.set(id, currentItem);
            } else {
              newMap.delete(id);
            }
            return newMap;
          });
        },
      }
    );
  }, [addOptimisticUpdate, keyExtractor, data]);

  const removeItem = useCallback(async (
    item: T,
    deleteFn: (item: T) => Promise<void>
  ): Promise<void> => {
    const id = keyExtractor(item).toString();
    
    // Remove optimistically
    setOptimisticItems(prev => {
      const newMap = new Map(prev);
      newMap.set(id, { ...item, __deleted: true } as any);
      return newMap;
    });
    
    await addOptimisticUpdate(
      `delete-${id}`,
      null,
      async () => {
        await deleteFn(item);
        return null;
      },
      {
        type: 'delete',
        rollbackData: item,
        onSuccess: () => {
          // Remove from optimistic items when confirmed
          setOptimisticItems(prev => {
            const newMap = new Map(prev);
            newMap.delete(id);
            return newMap;
          });
        },
        onError: () => {
          // Restore item on error
          setOptimisticItems(prev => {
            const newMap = new Map(prev);
            newMap.delete(id);
            return newMap;
          });
        },
      }
    );
  }, [addOptimisticUpdate, keyExtractor]);

  // Filter out deleted items
  const filteredData = data.filter(item => !(item as any).__deleted);

  return {
    data: filteredData,
    addItem,
    updateItem,
    removeItem,
  };
}

// Hook for optimistic form submissions
export function useOptimisticForm<TFormData, TResult>(
  submitFn: (data: TFormData) => Promise<TResult>,
  options: {
    onSuccess?: (result: TResult, data: TFormData) => void;
    onError?: (error: Error, data: TFormData) => void;
    showOptimisticSuccess?: boolean;
    successMessage?: string;
  } = {}
) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [optimisticSuccess, setOptimisticSuccess] = useState(false);
  const { addOptimisticUpdate } = useOptimisticUI();
  const { announceToScreenReader } = useAccessibility();

  const submit = useCallback(async (data: TFormData): Promise<TResult> => {
    setIsSubmitting(true);
    
    if (options.showOptimisticSuccess) {
      setOptimisticSuccess(true);
      if (options.successMessage) {
        announceToScreenReader(options.successMessage, 'polite');
      }
    }

    const id = `form-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      const result = await addOptimisticUpdate(
        id,
        data,
        () => submitFn(data),
        {
          type: 'form-submit',
          onSuccess: (result) => {
            options.onSuccess?.(result, data);
            setOptimisticSuccess(false);
          },
          onError: (error) => {
            options.onError?.(error, data);
            setOptimisticSuccess(false);
          },
        }
      );
      
      return result;
    } finally {
      setIsSubmitting(false);
    }
  }, [addOptimisticUpdate, submitFn, options, announceToScreenReader]);

  return {
    submit,
    isSubmitting,
    optimisticSuccess,
  };
}

// Component for displaying pending actions
interface PendingActionsIndicatorProps {
  className?: string;
  showCount?: boolean;
  showDetails?: boolean;
}

export function PendingActionsIndicator({ 
  className, 
  showCount = true, 
  showDetails = false 
}: PendingActionsIndicatorProps) {
  const { pendingActions, getPendingActionsCount } = useOptimisticUI();
  const count = getPendingActionsCount();

  if (count === 0) return null;

  return (
    <div className={cn(
      "flex items-center space-x-2 px-3 py-2 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg text-sm text-blue-800 dark:text-blue-200",
      className
    )}>
      <div className="w-3 h-3 bg-blue-600 rounded-full animate-pulse" />
      <span>
        {showCount ? `${count} pending action${count > 1 ? 's' : ''}` : 'Processing...'}
      </span>
      
      {showDetails && (
        <div className="text-xs text-blue-600 dark:text-blue-400">
          {pendingActions.map(action => action.type).join(', ')}
        </div>
      )}
    </div>
  );
}

export default OptimisticUIProvider;