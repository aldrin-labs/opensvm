'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
}

const variantStyles = {
  danger: {
    icon: 'text-red-500',
    button: 'bg-red-500 hover:bg-red-600 text-white',
  },
  warning: {
    icon: 'text-yellow-500',
    button: 'bg-yellow-500 hover:bg-yellow-600 text-white',
  },
  info: {
    icon: 'text-blue-500',
    button: 'bg-primary hover:bg-primary/90 text-white',
  },
};

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const styles = variantStyles[variant];

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={onCancel}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="bg-card border border-border rounded-lg p-6 max-w-md w-full mx-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-labelledby="dialog-title"
            aria-describedby="dialog-description"
          >
            <div className="flex items-start gap-4">
              <div className={`${styles.icon} flex-shrink-0`}>
                <AlertTriangle size={24} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 id="dialog-title" className="text-lg font-bold text-foreground mb-2">
                  {title}
                </h3>
                <p id="dialog-description" className="text-muted-foreground text-sm leading-relaxed">
                  {message}
                </p>
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={onCancel}
                className="px-4 py-2 border border-border rounded hover:bg-muted transition-colors text-sm font-medium"
              >
                {cancelLabel}
              </button>
              <button
                onClick={() => {
                  onConfirm();
                  onCancel(); // Close dialog after confirm
                }}
                className={`px-4 py-2 rounded transition-colors text-sm font-medium ${styles.button}`}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
