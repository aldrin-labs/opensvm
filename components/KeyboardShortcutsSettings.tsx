"use client";

import { useState, useEffect } from 'react';
import { X, Keyboard, RotateCcw, Check, AlertCircle } from 'lucide-react';
import {
  getAllShortcuts,
  saveCustomShortcuts,
  resetShortcuts,
  validateShortcutKey,
  formatKeyDisplay,
  type ShortcutAction,
} from '@/lib/ui/keyboard-shortcuts-config';

interface KeyboardShortcutsSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export function KeyboardShortcutsSettings({ isOpen, onClose }: KeyboardShortcutsSettingsProps) {
  const [shortcuts, setShortcuts] = useState<ShortcutAction[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShortcuts(getAllShortcuts());
      setHasChanges(false);
    }
  }, [isOpen]);

  const handleStartEdit = (shortcut: ShortcutAction) => {
    setEditingId(shortcut.id);
    setEditingKey(shortcut.customKey || shortcut.defaultKey);
    setError(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingKey('');
    setError(null);
  };

  const handleSaveEdit = (actionId: string) => {
    const validation = validateShortcutKey(actionId, editingKey, shortcuts);
    
    if (!validation.valid) {
      setError(validation.error || 'Invalid shortcut');
      return;
    }

    const updatedShortcuts = shortcuts.map(s =>
      s.id === actionId ? { ...s, customKey: editingKey } : s
    );
    
    setShortcuts(updatedShortcuts);
    setEditingId(null);
    setEditingKey('');
    setError(null);
    setHasChanges(true);
  };

  const handleResetSingle = (actionId: string) => {
    const updatedShortcuts = shortcuts.map(s =>
      s.id === actionId ? { ...s, customKey: undefined } : s
    );
    
    setShortcuts(updatedShortcuts);
    setHasChanges(true);
  };

  const handleResetAll = () => {
    if (confirm('Reset all shortcuts to defaults?')) {
      resetShortcuts();
      setShortcuts(getAllShortcuts());
      setHasChanges(false);
    }
  };

  const handleSaveAll = () => {
    const customMap = new Map<string, string>();
    shortcuts.forEach(s => {
      if (s.customKey) {
        customMap.set(s.id, s.customKey);
      }
    });
    
    saveCustomShortcuts(customMap);
    setHasChanges(false);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    
    const parts: string[] = [];
    if (e.shiftKey) parts.push('Shift');
    if (e.ctrlKey) parts.push('Ctrl');
    if (e.altKey) parts.push('Alt');
    if (e.metaKey) parts.push('Meta');
    
    // Get the actual key
    let key = e.key;
    
    // Handle special keys
    if (key === 'Shift' || key === 'Control' || key === 'Alt' || key === 'Meta') {
      return; // Don't set modifier-only shortcuts
    }
    
    // Normalize arrow keys
    if (key.startsWith('Arrow')) {
      key = key; // Keep as is (ArrowLeft, ArrowRight, etc.)
    } else if (key.length === 1) {
      key = key.toUpperCase();
    }
    
    if (parts.length > 0) {
      parts.push(key);
      setEditingKey(parts.join('+'));
    } else {
      setEditingKey(key);
    }
  };

  const groupedShortcuts = shortcuts.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) {
      acc[shortcut.category] = [];
    }
    acc[shortcut.category].push(shortcut);
    return acc;
  }, {} as Record<string, ShortcutAction[]>);

  const categoryNames = {
    general: 'General',
    navigation: 'Navigation',
    panels: 'Panels',
    trading: 'Trading',
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-background border border-border rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <Keyboard className="text-primary" size={24} />
            <h2 className="text-xl font-semibold text-foreground">Keyboard Shortcuts</h2>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors duration-150"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {Object.entries(groupedShortcuts).map(([category, categoryShortcuts]) => (
            <div key={category} className="mb-6 last:mb-0">
              <h3 className="text-sm font-semibold text-primary mb-3 uppercase tracking-wide">
                {categoryNames[category as keyof typeof categoryNames]}
              </h3>
              
              <div className="space-y-2">
                {categoryShortcuts.map(shortcut => {
                  const isEditing = editingId === shortcut.id;
                  const currentKey = shortcut.customKey || shortcut.defaultKey;
                  const isCustom = !!shortcut.customKey;
                  
                  return (
                    <div
                      key={shortcut.id}
                      className="flex items-center justify-between p-3 rounded-md bg-card border border-border hover:border-primary/50 transition-colors duration-150"
                    >
                      <div className="flex-1 min-w-0 mr-4">
                        <div className="font-medium text-foreground text-sm">
                          {shortcut.name}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {shortcut.description}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {isEditing ? (
                          <>
                            <input
                              type="text"
                              value={formatKeyDisplay(editingKey)}
                              onChange={() => {}} // Controlled by onKeyDown
                              onKeyDown={handleKeyDown}
                              placeholder="Press key..."
                              className="w-24 px-2 py-1 text-sm text-center bg-background border border-primary rounded focus:outline-none focus:ring-2 focus:ring-primary/50"
                              autoFocus
                              readOnly
                            />
                            <button
                              onClick={() => handleSaveEdit(shortcut.id)}
                              className="p-1 text-green-500 hover:text-green-600 transition-colors duration-150"
                              aria-label="Save"
                            >
                              <Check size={16} />
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="p-1 text-muted-foreground hover:text-foreground transition-colors duration-150"
                              aria-label="Cancel"
                            >
                              <X size={16} />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleStartEdit(shortcut)}
                              className={`px-3 py-1 text-sm font-mono rounded border transition-colors duration-150 ${
                                isCustom
                                  ? 'bg-primary/10 border-primary text-primary hover:bg-primary/20'
                                  : 'bg-muted border-border text-foreground hover:bg-muted/80'
                              }`}
                            >
                              {formatKeyDisplay(currentKey)}
                            </button>
                            {isCustom && (
                              <button
                                onClick={() => handleResetSingle(shortcut.id)}
                                className="p-1 text-muted-foreground hover:text-foreground transition-colors duration-150"
                                aria-label="Reset to default"
                                title="Reset to default"
                              >
                                <RotateCcw size={14} />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Error Message */}
        {error && (
          <div className="px-6 py-2 bg-destructive/10 border-t border-destructive/20">
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/30">
          <button
            onClick={handleResetAll}
            className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors duration-150"
          >
            <RotateCcw size={16} />
            Reset All
          </button>
          
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors duration-150"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveAll}
              disabled={!hasChanges}
              className={`px-4 py-2 text-sm rounded transition-colors duration-150 ${
                hasChanges
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'bg-muted text-muted-foreground cursor-not-allowed'
              }`}
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
