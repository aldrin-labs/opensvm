'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useOptimisticUI, useOptimisticMutation, useOptimisticList, useOptimisticForm } from '@/lib/optimistic-ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner, LoadingButton } from '@/components/ui/loading';
import { Skeleton } from '@/components/ui/skeleton';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { Check, X, Clock, RefreshCw, Undo2 } from 'lucide-react';

// Optimistic Action Status Indicator
interface ActionStatusProps {
  actionId: string;
  className?: string;
  showRetry?: boolean;
  showRollback?: boolean;
}

export function ActionStatus({ 
  actionId, 
  className,
  showRetry = true,
  showRollback = false 
}: ActionStatusProps) {
  const { getActionStatus, retryFailedAction, rollbackAction } = useOptimisticUI();
  const { t } = useI18n();
  const status = getActionStatus(actionId);

  if (!status) return null;

  const statusConfig = {
    pending: {
      icon: Clock,
      color: 'bg-info/10 text-info border-info/30',
      label: t('optimistic.status.pending')
    },
    success: {
      icon: Check,
      color: 'bg-success/10 text-success border-success/30',
      label: t('optimistic.status.success')
    },
    error: {
      icon: X,
      color: 'bg-destructive/10 text-destructive border-destructive/30',
      label: t('optimistic.status.error')
    }
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className={cn(
      'inline-flex items-center space-x-2 px-2 py-1 rounded-md border text-xs font-medium',
      config.color,
      className
    )}>
      <Icon className="w-3 h-3" />
      <span>{config.label}</span>
      
      {status === 'error' && showRetry && (
        <Button
          size="sm"
          variant="ghost"
          className="h-auto p-0 text-xs"
          onClick={() => retryFailedAction(actionId)}
        >
          <RefreshCw className="w-3 h-3" />
        </Button>
      )}
      
      {status === 'pending' && showRollback && (
        <Button
          size="sm"
          variant="ghost"
          className="h-auto p-0 text-xs"
          onClick={() => rollbackAction(actionId)}
        >
          <Undo2 className="w-3 h-3" />
        </Button>
      )}
    </div>
  );
}

// Optimistic List Item
interface OptimisticListItemProps<T> {
  item: T;
  isOptimistic?: boolean;
  isDeleting?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function OptimisticListItem<T>({ 
  item, 
  isOptimistic = false,
  isDeleting = false,
  children, 
  className 
}: OptimisticListItemProps<T>) {
  return (
    <div className={cn(
      'transition-all duration-200',
      isOptimistic && 'opacity-70 bg-info/10',
      isDeleting && 'opacity-30 scale-95',
      className
    )}>
      {children}
      {isOptimistic && (
        <div className="flex items-center space-x-1 mt-1">
          <LoadingSpinner size="sm" />
          <span className="text-xs text-muted-foreground">Saving...</span>
        </div>
      )}
    </div>
  );
}

// Optimistic Form with Preview
interface OptimisticFormProps {
  onSubmit: (data: any) => Promise<any>;
  children: React.ReactNode;
  showPreview?: boolean;
  previewData?: any;
  className?: string;
}

export function OptimisticForm({ 
  onSubmit, 
  children, 
  showPreview = false,
  previewData,
  className 
}: OptimisticFormProps) {
  const { submit, isSubmitting, optimisticSuccess } = useOptimisticForm(onSubmit, {
    showOptimisticSuccess: true,
    successMessage: 'Form submitted successfully!'
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const data = Object.fromEntries(formData);
    submit(data);
  };

  return (
    <div className={className}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {children}
        
        <div className="flex items-center justify-between">
          <LoadingButton
            type="submit"
            loading={isSubmitting}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Submitting...' : 'Submit'}
          </LoadingButton>
          
          {optimisticSuccess && (
            <Badge variant="secondary" className="bg-success/10 text-success border border-success/30">
              <Check className="w-3 h-3 mr-1" />
              Success (pending confirmation)
            </Badge>
          )}
        </div>
      </form>
      
      {showPreview && previewData && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-sm">Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-muted p-2 rounded overflow-auto">
              {JSON.stringify(previewData, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Optimistic Counter with Instant Feedback
interface OptimisticCounterProps {
  initialValue: number;
  onIncrement: () => Promise<number>;
  onDecrement: () => Promise<number>;
  className?: string;
}

export function OptimisticCounter({ 
  initialValue, 
  onIncrement, 
  onDecrement, 
  className 
}: OptimisticCounterProps) {
  const [optimisticValue, setOptimisticValue] = useState(initialValue);
  const [pendingActions, setPendingActions] = useState<Set<string>>(new Set());
  const { addOptimisticUpdate } = useOptimisticUI();

  const handleIncrement = async () => {
    const actionId = `increment-${Date.now()}`;
    setPendingActions(prev => new Set(prev).add(actionId));
    setOptimisticValue(prev => prev + 1);

    try {
      await addOptimisticUpdate(
        actionId,
        optimisticValue + 1,
        onIncrement,
        {
          type: 'increment',
          onSuccess: (newValue) => {
            setOptimisticValue(newValue);
          },
          onError: () => {
            setOptimisticValue(prev => prev - 1); // Rollback
          }
        }
      );
    } finally {
      setPendingActions(prev => {
        const newSet = new Set(prev);
        newSet.delete(actionId);
        return newSet;
      });
    }
  };

  const handleDecrement = async () => {
    const actionId = `decrement-${Date.now()}`;
    setPendingActions(prev => new Set(prev).add(actionId));
    setOptimisticValue(prev => prev - 1);

    try {
      await addOptimisticUpdate(
        actionId,
        optimisticValue - 1,
        onDecrement,
        {
          type: 'decrement',
          onSuccess: (newValue) => {
            setOptimisticValue(newValue);
          },
          onError: () => {
            setOptimisticValue(prev => prev + 1); // Rollback
          }
        }
      );
    } finally {
      setPendingActions(prev => {
        const newSet = new Set(prev);
        newSet.delete(actionId);
        return newSet;
      });
    }
  };

  return (
    <div className={cn('flex items-center space-x-4', className)}>
      <Button 
        variant="outline" 
        size="sm" 
        onClick={handleDecrement}
        disabled={pendingActions.size > 0}
      >
        -
      </Button>
      
      <div className="relative">
        <span className={cn(
          'text-2xl font-bold min-w-[3rem] text-center inline-block',
          pendingActions.size > 0 && 'opacity-70'
        )}>
          {optimisticValue}
        </span>
        {pendingActions.size > 0 && (
          <LoadingSpinner 
            size="sm" 
            className="absolute -top-1 -right-1" 
          />
        )}
      </div>
      
      <Button 
        variant="outline" 
        size="sm" 
        onClick={handleIncrement}
        disabled={pendingActions.size > 0}
      >
        +
      </Button>
    </div>
  );
}

// Optimistic Like Button
interface OptimisticLikeButtonProps {
  itemId: string;
  initialLiked: boolean;
  initialCount: number;
  onToggle: (itemId: string, liked: boolean) => Promise<{ liked: boolean; count: number }>;
  className?: string;
}

export function OptimisticLikeButton({ 
  itemId,
  initialLiked, 
  initialCount, 
  onToggle, 
  className 
}: OptimisticLikeButtonProps) {
  const [optimisticLiked, setOptimisticLiked] = useState(initialLiked);
  const [optimisticCount, setOptimisticCount] = useState(initialCount);
  const { isActionPending } = useOptimisticUI();
  
  const { mutate, isLoading } = useOptimisticMutation(
    async ({ itemId, liked }: { itemId: string; liked: boolean }) => {
      return onToggle(itemId, liked);
    },
    {
      generateOptimisticData: ({ liked }) => ({ liked, count: optimisticCount + (liked ? 1 : -1) }),
      generateId: () => `like-${itemId}`,
      onSuccess: (data) => {
        setOptimisticLiked(data.liked);
        setOptimisticCount(data.count);
      },
      onError: () => {
        // Rollback optimistic changes
        setOptimisticLiked(initialLiked);
        setOptimisticCount(initialCount);
      }
    }
  );

  const handleToggle = () => {
    const newLiked = !optimisticLiked;
    
    // Apply optimistic updates immediately
    setOptimisticLiked(newLiked);
    setOptimisticCount(prev => prev + (newLiked ? 1 : -1));
    
    // Trigger actual mutation
    mutate({ itemId, liked: newLiked });
  };

  const pending = isActionPending(`like-${itemId}`);

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleToggle}
      disabled={isLoading}
      className={cn(
        'flex items-center space-x-2 transition-colors',
        optimisticLiked && 'text-destructive hover:text-destructive/90',
        pending && 'opacity-70',
        className
      )}
    >
      <span className={cn(
        'transition-transform',
        optimisticLiked && 'scale-110'
      )}>
        {optimisticLiked ? '❤️' : '🤍'}
      </span>
      <span className="text-sm">{optimisticCount}</span>
      {pending && <LoadingSpinner size="xs" />}
    </Button>
  );
}

// Optimistic Comment System
interface Comment {
  id: string;
  text: string;
  author: string;
  timestamp: Date;
  optimistic?: boolean;
}

interface OptimisticCommentsProps {
  initialComments: Comment[];
  onAddComment: (text: string) => Promise<Comment>;
  onDeleteComment: (id: string) => Promise<void>;
  className?: string;
}

export function OptimisticComments({ 
  initialComments, 
  onAddComment, 
  onDeleteComment, 
  className 
}: OptimisticCommentsProps) {
  const { data: comments, addItem, removeItem } = useOptimisticList(
    initialComments,
    (comment) => comment.id
  );
  
  const [newCommentText, setNewCommentText] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const handleAddComment = async () => {
    if (!newCommentText.trim()) return;
    
    setIsAdding(true);
    const optimisticComment: Comment = {
      id: `temp-${Date.now()}`,
      text: newCommentText,
      author: 'You',
      timestamp: new Date(),
      optimistic: true
    };

    try {
      await addItem(optimisticComment, () => onAddComment(newCommentText));
      setNewCommentText('');
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteComment = async (comment: Comment) => {
    await removeItem(comment, () => onDeleteComment(comment.id));
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Add Comment Form */}
      <div className="flex space-x-2">
        <Input
          value={newCommentText}
          onChange={(e) => setNewCommentText(e.target.value)}
          placeholder="Add a comment..."
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleAddComment();
            }
          }}
        />
        <LoadingButton
          onClick={handleAddComment}
          loading={isAdding}
          disabled={!newCommentText.trim() || isAdding}
        >
          Add
        </LoadingButton>
      </div>

      {/* Comments List */}
      <div className="space-y-2">
        {comments.map((comment) => (
          <OptimisticListItem
            key={comment.id}
            item={comment}
            isOptimistic={comment.optimistic}
            className="p-3 border rounded-lg"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <span className="font-medium text-sm">{comment.author}</span>
                  <span className="text-xs text-muted-foreground">
                    {comment.timestamp.toLocaleTimeString()}
                  </span>
                  {comment.optimistic && (
                    <Badge variant="secondary" className="text-xs">
                      Pending
                    </Badge>
                  )}
                </div>
                <p className="text-sm mt-1">{comment.text}</p>
              </div>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDeleteComment(comment)}
                className="text-destructive hover:text-destructive/90"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </OptimisticListItem>
        ))}
        
        {comments.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <p>No comments yet. Be the first to add one!</p>
          </div>
        )}
      </div>
    </div>
  );
}
