'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle, AlertTriangle, Info, Loader2, X } from 'lucide-react';
import type { Notification } from '@/components/providers/NotificationProvider';

interface ToastProps {
  notification: Notification;
  onClose: () => void;
}

const icons = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
  loading: Loader2,
};

const bgColors = {
  success: 'bg-success/10 border-success/50',
  error: 'bg-destructive/10 border-destructive/50',
  warning: 'bg-warning/10 border-warning/50',
  info: 'bg-info/10 border-info/50',
  loading: 'bg-muted border-border',
};

const iconColors = {
  success: 'text-success',
  error: 'text-destructive',
  warning: 'text-warning',
  info: 'text-info',
  loading: 'text-muted-foreground',
};

export function Toast({ notification, onClose }: ToastProps) {
  const Icon = icons[notification.type];

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={`flex items-start gap-3 p-4 rounded-lg border backdrop-blur-sm shadow-lg ${bgColors[notification.type]} min-w-[320px] max-w-[480px]`}
      role="alert"
      aria-live={notification.type === 'error' ? 'assertive' : 'polite'}
    >
      <Icon
        className={`${iconColors[notification.type]} flex-shrink-0 ${
          notification.type === 'loading' ? 'animate-spin' : ''
        }`}
        size={20}
        aria-hidden="true"
      />
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-foreground text-sm">{notification.title}</h4>
        {notification.message && (
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
            {notification.message}
          </p>
        )}
        {notification.action && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              notification.action!.onClick();
            }}
            className="text-sm text-primary hover:underline mt-2 font-medium"
          >
            {notification.action.label}
          </button>
        )}
      </div>
      {notification.dismissible && (
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
          aria-label="Close notification"
        >
          <X size={16} />
        </button>
      )}
    </motion.div>
  );
}
