'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Loader2,
  ArrowRight,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Wallet,
  Coins,
  X,
  ExternalLink,
  Zap
} from 'lucide-react';

interface ManagedWallet {
  id: string;
  address: string;
  name: string;
  balance: number;
}

interface SweepPreview {
  walletId: string;
  walletName: string;
  walletAddress: string;
  solBalance: number;
  tokens: Array<{ mint: string; symbol: string; amount: number }>;
  emptyAccounts: number;
  requiresHardwareSignature: boolean;
}

interface SweepResult {
  walletId: string;
  walletName: string;
  success: boolean;
  signature?: string;
  solSwept: number;
  tokensSwept: Array<{ mint: string; amount: number }>;
  accountsClosed: number;
  error?: string;
}

interface SweepModalProps {
  isOpen: boolean;
  onClose: () => void;
  wallets: ManagedWallet[];
  onSweepComplete: () => void;
}

type SweepStep = 'select' | 'preview' | 'sweeping' | 'complete';

export function SweepModal({
  isOpen,
  onClose,
  wallets,
  onSweepComplete
}: SweepModalProps) {
  const [step, setStep] = useState<SweepStep>('select');
  const [selectedWallets, setSelectedWallets] = useState<Set<string>>(new Set());
  const [destinationId, setDestinationId] = useState<string>('');
  const [preview, setPreview] = useState<SweepPreview[]>([]);
  const [previewSummary, setPreviewSummary] = useState<any>(null);
  const [results, setResults] = useState<SweepResult[]>([]);
  const [resultSummary, setResultSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sweepTokens, setSweepTokens] = useState(true);
  const [closeAccounts, setCloseAccounts] = useState(true);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('select');
      setSelectedWallets(new Set());
      setDestinationId('');
      setPreview([]);
      setResults([]);
      setError(null);
    }
  }, [isOpen]);

  const toggleWallet = (walletId: string) => {
    const newSelected = new Set(selectedWallets);
    if (newSelected.has(walletId)) {
      newSelected.delete(walletId);
    } else {
      newSelected.add(walletId);
    }
    setSelectedWallets(newSelected);
  };

  const selectAll = () => {
    const newSelected = new Set(
      wallets
        .filter(w => w.id !== destinationId)
        .map(w => w.id)
    );
    setSelectedWallets(newSelected);
  };

  const deselectAll = () => {
    setSelectedWallets(new Set());
  };

  const loadPreview = async () => {
    if (selectedWallets.size === 0 || !destinationId) {
      setError('Please select source wallets and destination');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        walletIds: Array.from(selectedWallets).join(',')
      });

      const response = await fetch(`/api/bank/wallets/sweep?${params}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to load preview');
      }

      const data = await response.json();
      setPreview(data.preview);
      setPreviewSummary(data.summary);
      setStep('preview');

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load preview');
    } finally {
      setLoading(false);
    }
  };

  const executeSweep = async () => {
    setLoading(true);
    setError(null);
    setStep('sweeping');

    try {
      const response = await fetch('/api/bank/wallets/sweep', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceWalletIds: Array.from(selectedWallets),
          destinationWalletId: destinationId,
          sweepTokens,
          closeEmptyAccounts: closeAccounts,
          leaveMinimumSOL: 0.001
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Sweep failed');
      }

      setResults(data.results);
      setResultSummary(data.summary);
      setStep('complete');
      onSweepComplete();

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sweep failed');
      setStep('preview');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep('select');
    setSelectedWallets(new Set());
    setDestinationId('');
    setPreview([]);
    setResults([]);
    setError(null);
    onClose();
  };

  const destinationWallet = wallets.find(w => w.id === destinationId);
  const availableSourceWallets = wallets.filter(w => w.id !== destinationId);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-background border rounded-xl w-full max-w-2xl mx-4 shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="font-semibold text-lg">Sweep Wallets</h2>
              <p className="text-xs text-muted-foreground">
                Consolidate assets from multiple wallets
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Step: Select */}
          {step === 'select' && (
            <div className="space-y-6">
              {/* Destination Selection */}
              <div>
                <label className="text-sm font-medium mb-2 block">Destination Wallet</label>
                <select
                  value={destinationId}
                  onChange={(e) => {
                    setDestinationId(e.target.value);
                    // Remove destination from selected sources
                    const newSelected = new Set(selectedWallets);
                    newSelected.delete(e.target.value);
                    setSelectedWallets(newSelected);
                  }}
                  className="w-full p-3 border rounded-lg bg-background"
                >
                  <option value="">Select destination wallet</option>
                  {wallets.map(wallet => (
                    <option key={wallet.id} value={wallet.id}>
                      {wallet.name} ({wallet.balance.toFixed(4)} SOL)
                    </option>
                  ))}
                </select>
              </div>

              {/* Source Selection */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">Source Wallets</label>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={selectAll}>
                      Select All
                    </Button>
                    <Button variant="ghost" size="sm" onClick={deselectAll}>
                      Deselect All
                    </Button>
                  </div>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-2">
                  {availableSourceWallets.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      {destinationId ? 'No other wallets available' : 'Select a destination first'}
                    </p>
                  ) : (
                    availableSourceWallets.map(wallet => (
                      <label
                        key={wallet.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedWallets.has(wallet.id)
                            ? 'bg-primary/10 border-primary'
                            : 'hover:bg-muted'
                        }`}
                      >
                        <Checkbox
                          checked={selectedWallets.has(wallet.id)}
                          onCheckedChange={() => toggleWallet(wallet.id)}
                        />
                        <Wallet className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1">
                          <p className="font-medium text-sm">{wallet.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {wallet.balance.toFixed(4)} SOL
                          </p>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </div>

              {/* Options */}
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <Checkbox
                    checked={sweepTokens}
                    onCheckedChange={(checked) => setSweepTokens(checked as boolean)}
                  />
                  <div>
                    <p className="text-sm font-medium">Sweep SPL Tokens</p>
                    <p className="text-xs text-muted-foreground">Transfer all tokens to destination</p>
                  </div>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <Checkbox
                    checked={closeAccounts}
                    onCheckedChange={(checked) => setCloseAccounts(checked as boolean)}
                  />
                  <div>
                    <p className="text-sm font-medium">Close Empty Accounts</p>
                    <p className="text-xs text-muted-foreground">Reclaim rent from empty token accounts</p>
                  </div>
                </label>
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <p className="text-sm text-red-500">{error}</p>
                </div>
              )}

              <Button
                onClick={loadPreview}
                disabled={loading || selectedWallets.size === 0 || !destinationId}
                className="w-full gap-2"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
                Preview Sweep ({selectedWallets.size} wallets)
              </Button>
            </div>
          )}

          {/* Step: Preview */}
          {step === 'preview' && (
            <div className="space-y-4">
              {/* Summary */}
              {previewSummary && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg bg-muted text-center">
                    <p className="text-xs text-muted-foreground">Total SOL</p>
                    <p className="font-semibold">{previewSummary.totalSol.toFixed(4)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted text-center">
                    <p className="text-xs text-muted-foreground">Token Accounts</p>
                    <p className="font-semibold">{previewSummary.totalTokenAccounts}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted text-center">
                    <p className="text-xs text-muted-foreground">Empty Accounts</p>
                    <p className="font-semibold">{previewSummary.totalEmptyAccounts}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-green-500/10 text-center">
                    <p className="text-xs text-green-500">Rent Reclaim</p>
                    <p className="font-semibold text-green-500">
                      +{previewSummary.estimatedRentReclaim.toFixed(4)}
                    </p>
                  </div>
                </div>
              )}

              {/* Destination */}
              {destinationWallet && (
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/30 flex items-center gap-3">
                  <ArrowRight className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium">Sweeping to: {destinationWallet.name}</p>
                    <code className="text-xs text-muted-foreground">
                      {destinationWallet.address.slice(0, 8)}...{destinationWallet.address.slice(-8)}
                    </code>
                  </div>
                </div>
              )}

              {/* Preview List */}
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {preview.map(item => (
                  <div key={item.walletId} className="p-3 rounded-lg border">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium text-sm">{item.walletName}</p>
                      {item.requiresHardwareSignature && (
                        <Badge variant="destructive">Requires HW</Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">SOL:</span>{' '}
                        <span className="font-mono">{item.solBalance.toFixed(4)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Tokens:</span>{' '}
                        <span className="font-mono">{item.tokens.length}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Empty:</span>{' '}
                        <span className="font-mono">{item.emptyAccounts}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Hardware Wallet Warning */}
              {previewSummary?.walletsRequiringHardware > 0 && (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-500">Hardware Wallet Required</p>
                    <p className="text-xs text-muted-foreground">
                      {previewSummary.walletsRequiringHardware} wallet(s) require hardware signature and will be skipped.
                    </p>
                  </div>
                </div>
              )}

              {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <p className="text-sm text-red-500">{error}</p>
                </div>
              )}

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep('select')} className="flex-1">
                  Back
                </Button>
                <Button
                  onClick={executeSweep}
                  disabled={loading}
                  className="flex-1 gap-2 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Zap className="h-4 w-4" />
                  )}
                  Execute Sweep
                </Button>
              </div>
            </div>
          )}

          {/* Step: Sweeping */}
          {step === 'sweeping' && (
            <div className="py-12 text-center">
              <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
              <h3 className="font-semibold text-lg">Sweeping Wallets...</h3>
              <p className="text-sm text-muted-foreground mt-2">
                This may take a moment. Please don't close this window.
              </p>
            </div>
          )}

          {/* Step: Complete */}
          {step === 'complete' && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="text-center py-4">
                <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="h-8 w-8 text-green-500" />
                </div>
                <h3 className="font-semibold text-lg">Sweep Complete!</h3>
                {resultSummary && (
                  <p className="text-sm text-muted-foreground mt-2">
                    {resultSummary.successfulSweeps} of {resultSummary.totalWalletsProcessed} wallets swept successfully
                  </p>
                )}
              </div>

              {/* Stats */}
              {resultSummary && (
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-lg bg-green-500/10 text-center">
                    <p className="text-xs text-green-500">SOL Swept</p>
                    <p className="font-semibold text-green-500">
                      {resultSummary.totalSolSwept.toFixed(4)}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-blue-500/10 text-center">
                    <p className="text-xs text-blue-500">Tokens Swept</p>
                    <p className="font-semibold text-blue-500">
                      {resultSummary.totalTokensSwept}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-purple-500/10 text-center">
                    <p className="text-xs text-purple-500">Accounts Closed</p>
                    <p className="font-semibold text-purple-500">
                      {resultSummary.totalAccountsClosed}
                    </p>
                  </div>
                </div>
              )}

              {/* Results */}
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {results.map(result => (
                  <div
                    key={result.walletId}
                    className={`p-3 rounded-lg border flex items-center justify-between ${
                      result.success ? 'bg-green-500/5 border-green-500/30' : 'bg-red-500/5 border-red-500/30'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {result.success ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                      <span className="text-sm font-medium">{result.walletName}</span>
                    </div>
                    {result.signature ? (
                      <a
                        href={`https://solscan.io/tx/${result.signature}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-500 hover:underline flex items-center gap-1"
                      >
                        View <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : result.error ? (
                      <span className="text-xs text-red-500">{result.error}</span>
                    ) : null}
                  </div>
                ))}
              </div>

              <Button onClick={handleClose} className="w-full">
                Done
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
