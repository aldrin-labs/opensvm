'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Toast } from '@/components/ui/Toast';

export type NotificationType = 'success' | 'error' | 'warning' | 'info' | 'loading';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  duration?: number; // Auto-dismiss after ms (0 = manual close)
  action?: {
    label: string;
    onClick: () => void;
  };
  dismissible?: boolean;
  sound?: boolean;
}

interface NotificationContextValue {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id'>) => string;
  removeNotification: (id: string) => void;
  updateNotification: (id: string, updates: Partial<Omit<Notification, 'id'>>) => void;
  clearAll: () => void;
}

export const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = useCallback((notification: Omit<Notification, 'id'>) => {
    const id = `notification-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const newNotification: Notification = {
      ...notification,
      id,
      dismissible: notification.dismissible !== false,
    };

    setNotifications((prev) => [...prev, newNotification]);

    // Auto-dismiss if duration is set and > 0
    if (notification.duration && notification.duration > 0) {
      setTimeout(() => {
        removeNotification(id);
      }, notification.duration);
    }

    // Play notification sound if enabled
    if (notification.sound && typeof window !== 'undefined') {
      // TODO: Add actual sound effect
      // new Audio('/sounds/notification.mp3').play().catch(() => {});
    }

    return id;
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const updateNotification = useCallback((id: string, updates: Partial<Omit<Notification, 'id'>>) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, ...updates } : n))
    );
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  return (
    <NotificationContext.Provider
      value={{ notifications, addNotification, removeNotification, updateNotification, clearAll }}
    >
      {children}
      <NotificationContainer notifications={notifications} onClose={removeNotification} />
    </NotificationContext.Provider>
  );
}

function NotificationContainer({
  notifications,
  onClose,
}: {
  notifications: Notification[];
  onClose: (id: string) => void;
}) {
  return (
    <div
      className="fixed bottom-4 right-4 z-[9999] flex flex-col-reverse gap-2 pointer-events-none"
      aria-live="polite"
      aria-atomic="true"
    >
      <AnimatePresence mode="popLayout">
        {notifications.map((notification) => (
          <div key={notification.id} className="pointer-events-auto">
            <Toast notification={notification} onClose={() => onClose(notification.id)} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
}

// Safe version that doesn't throw
export function useNotificationsSafe() {
  const context = useContext(NotificationContext);
  if (!context) {
    // Return a fallback that logs warnings instead of throwing
    return {
      notifications: [],
      addNotification: (notification: Omit<Notification, 'id'>) => {
        console.warn('[useNotificationsSafe] NotificationProvider not found, notification:', notification);
        return 'no-op-id';
      },
      removeNotification: (id: string) => {
        console.warn('[useNotificationsSafe] NotificationProvider not found, cannot remove:', id);
      },
      updateNotification: (id: string, updates: Partial<Omit<Notification, 'id'>>) => {
        console.warn('[useNotificationsSafe] NotificationProvider not found, cannot update:', id, updates);
      },
      clearAll: () => {
        console.warn('[useNotificationsSafe] NotificationProvider not found, cannot clear');
      },
    };
  }
  return context;
}
