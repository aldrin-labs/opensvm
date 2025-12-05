'use client';

import React, { useState, useCallback } from 'react';
import { X, Plus, Link2, Eye, EyeOff, Trash2, ArrowRightLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MultiAccountViewState } from './hooks/useAccountGraphCache';

interface MultiAccountPanelProps {
  multiAccountView: MultiAccountViewState;
  currentAccount: string;
  onAddAccount: (account: string) => void;
  onRemoveAccount: (account: string) => void;
  onToggleView: () => void;
  onBuildMultiView: () => void;
  className?: string;
}

const ACCOUNT_COLORS = [
  'bg-chart-1',
  'bg-chart-2',
  'bg-chart-3',
  'bg-chart-4',
  'bg-chart-5'
];

export const MultiAccountPanel: React.FC<MultiAccountPanelProps> = ({
  multiAccountView,
  currentAccount,
  onAddAccount,
  onRemoveAccount,
  onToggleView,
  onBuildMultiView,
  className
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [newAccountInput, setNewAccountInput] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);

  const handleAddAccount = useCallback(() => {
    const trimmed = newAccountInput.trim();

    // Basic validation
    if (!trimmed) {
      setInputError('Enter an account address');
      return;
    }

    if (trimmed.length < 32 || trimmed.length > 44) {
      setInputError('Invalid address length');
      return;
    }

    if (!/^[1-9A-HJ-NP-Za-km-z]+$/.test(trimmed)) {
      setInputError('Invalid address format');
      return;
    }

    if (multiAccountView.accounts.includes(trimmed)) {
      setInputError('Account already added');
      return;
    }

    onAddAccount(trimmed);
    setNewAccountInput('');
    setInputError(null);
  }, [newAccountInput, multiAccountView.accounts, onAddAccount]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddAccount();
    }
  }, [handleAddAccount]);

  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const accountsCount = multiAccountView.accounts.length;
  const hasConnections = multiAccountView.connections.length > 0;

  return (
    <div className={cn(
      'absolute top-4 right-4 z-20 bg-background/95 backdrop-blur-sm border border-border rounded-xl shadow-lg',
      'transition-all duration-300 ease-in-out',
      isExpanded ? 'w-80' : 'w-auto',
      className
    )}>
      {/* Header */}
      <div
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 rounded-t-xl"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Link2 className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Multi-Account View</p>
            {accountsCount > 0 && (
              <p className="text-xs text-muted-foreground">
                {accountsCount} account{accountsCount !== 1 ? 's' : ''}
                {hasConnections && ` | ${multiAccountView.connections.length} connection${multiAccountView.connections.length !== 1 ? 's' : ''}`}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {multiAccountView.isActive && (
            <span className="px-2 py-0.5 text-xs bg-success/10 text-success rounded-full">
              Active
            </span>
          )}
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-border p-3 space-y-3">
          {/* Add Account Input */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={newAccountInput}
                onChange={(e) => {
                  setNewAccountInput(e.target.value);
                  setInputError(null);
                }}
                onKeyPress={handleKeyPress}
                placeholder="Add account address..."
                className={cn(
                  'flex-1 px-3 py-2 text-sm rounded-lg border bg-background',
                  'focus:outline-none focus:ring-2 focus:ring-primary/50',
                  inputError ? 'border-destructive' : 'border-border'
                )}
              />
              <button
                onClick={handleAddAccount}
                className="p-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {inputError && (
              <p className="text-xs text-destructive">{inputError}</p>
            )}
          </div>

          {/* Quick Add Current */}
          {currentAccount && !multiAccountView.accounts.includes(currentAccount) && (
            <button
              onClick={() => onAddAccount(currentAccount)}
              className="w-full px-3 py-2 text-sm text-left rounded-lg border border-dashed border-border hover:border-primary hover:bg-primary/5 transition-colors"
            >
              <span className="text-muted-foreground">+ Add current account: </span>
              <span className="font-mono text-primary">{formatAddress(currentAccount)}</span>
            </button>
          )}

          {/* Account List */}
          {accountsCount > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Tracked Accounts
              </p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {multiAccountView.accounts.map((account, index) => (
                  <div
                    key={account}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/50 group"
                  >
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        'w-3 h-3 rounded-full',
                        ACCOUNT_COLORS[index % ACCOUNT_COLORS.length]
                      )} />
                      <span className="font-mono text-sm">{formatAddress(account)}</span>
                      {account === currentAccount && (
                        <span className="px-1.5 py-0.5 text-xs bg-primary/10 text-primary rounded">
                          current
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => onRemoveAccount(account)}
                      className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Connections */}
          {hasConnections && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Connections Found
              </p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {multiAccountView.connections.map((conn, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 rounded-lg bg-success/5 border border-success/20"
                  >
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-mono">{formatAddress(conn.from)}</span>
                      <ArrowRightLeft className="w-3 h-3 text-success" />
                      <span className="font-mono">{formatAddress(conn.to)}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {conn.transfers} tx
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          {accountsCount >= 2 && (
            <div className="flex gap-2 pt-2 border-t border-border">
              <button
                onClick={onToggleView}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors',
                  multiAccountView.isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-muted/80 text-foreground'
                )}
              >
                {multiAccountView.isActive ? (
                  <>
                    <EyeOff className="w-4 h-4" />
                    Disable
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4" />
                    Enable
                  </>
                )}
              </button>
              <button
                onClick={onBuildMultiView}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-lg bg-success/10 hover:bg-success/20 text-success transition-colors"
              >
                <Link2 className="w-4 h-4" />
                Build View
              </button>
            </div>
          )}

          {/* Empty State */}
          {accountsCount === 0 && (
            <div className="text-center py-4 text-muted-foreground">
              <Link2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Add accounts to track connections</p>
              <p className="text-xs mt-1">See how wallets are connected</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MultiAccountPanel;
