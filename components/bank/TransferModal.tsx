'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  ArrowRight,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ExternalLink,
  Wallet,
  Coins,
  ArrowLeftRight,
  X,
  Shield
} from 'lucide-react';

interface ManagedWallet {
  id: string;
  address: string;
  name: string;
  balance: number;
  tokens: Array<{
    mint: string;
    symbol: string;
    balance: number;
    usdValue: number;
  }>;
}

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceWallet: ManagedWallet;
  availableWallets: ManagedWallet[];
  solPrice: number;
  onTransferComplete: () => void;
}

type TransferStatus = 'idle' | 'loading' | 'success' | 'error';

export function TransferModal({
  isOpen,
  onClose,
  sourceWallet,
  availableWallets,
  solPrice,
  onTransferComplete
}: TransferModalProps) {
  const [destinationType, setDestinationType] = useState<'internal' | 'external'>('internal');
  const [selectedDestWallet, setSelectedDestWallet] = useState<string>('');
  const [externalAddress, setExternalAddress] = useState('');
  const [assetType, setAssetType] = useState<'SOL' | string>('SOL');
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState<TransferStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [requiresMultisig, setRequiresMultisig] = useState(false);
  const [multisigChallenge, setMultisigChallenge] = useState<string | null>(null);

  // Filter out source wallet from destinations
  const destinationWallets = availableWallets.filter(w => w.id !== sourceWallet.id);

  // Get available balance for selected asset
  const getAvailableBalance = () => {
    if (assetType === 'SOL') {
      return sourceWallet.balance;
    }
    const token = sourceWallet.tokens.find(t => t.mint === assetType);
    return token?.balance || 0;
  };

  const getAssetSymbol = () => {
    if (assetType === 'SOL') return 'SOL';
    const token = sourceWallet.tokens.find(t => t.mint === assetType);
    return token?.symbol || 'Token';
  };

  // Check if source wallet requires hardware signature
  useEffect(() => {
    const checkMultisig = async () => {
      try {
        const response = await fetch(`/api/bank/wallets/${sourceWallet.id}/hardware`, {
          credentials: 'include'
        });
        if (response.ok) {
          const data = await response.json();
          setRequiresMultisig(data.requiresHardwareSignature || false);
        }
      } catch {
        // Ignore errors
      }
    };
    if (isOpen) {
      checkMultisig();
    }
  }, [isOpen, sourceWallet.id]);

  const handleTransfer = async () => {
    const destination = destinationType === 'internal' ? selectedDestWallet : externalAddress;

    if (!destination || !amount || parseFloat(amount) <= 0) {
      setErrorMessage('Please fill in all fields');
      return;
    }

    const numAmount = parseFloat(amount);
    if (numAmount > getAvailableBalance()) {
      setErrorMessage('Insufficient balance');
      return;
    }

    setStatus('loading');
    setErrorMessage('');
    setTxSignature(null);

    try {
      const endpoint = requiresMultisig
        ? '/api/bank/wallets/transfer/multisig'
        : '/api/bank/wallets/transfer';

      const response = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromWalletId: sourceWallet.id,
          toAddress: destination,
          amount: numAmount,
          tokenMint: assetType === 'SOL' ? undefined : assetType,
          isInternalTransfer: destinationType === 'internal'
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Transfer failed');
      }

      // For multisig, check if we need hardware signature
      if (requiresMultisig && data.step === 1) {
        setMultisigChallenge(data.challenge);
        setStatus('idle');
        return;
      }

      setStatus('success');
      setTxSignature(data.signature);
      onTransferComplete();

    } catch (error) {
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Transfer failed');
    }
  };

  const handleSetMax = () => {
    const available = getAvailableBalance();
    // For SOL, leave some for fees
    if (assetType === 'SOL' && available > 0.001) {
      setAmount((available - 0.001).toFixed(9));
    } else {
      setAmount(available.toString());
    }
  };

  const resetForm = () => {
    setDestinationType('internal');
    setSelectedDestWallet('');
    setExternalAddress('');
    setAssetType('SOL');
    setAmount('');
    setStatus('idle');
    setErrorMessage('');
    setTxSignature(null);
    setMultisigChallenge(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-background border rounded-xl w-full max-w-lg mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
              <ArrowLeftRight className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="font-semibold text-lg">Transfer</h2>
              <p className="text-xs text-muted-foreground">
                From {sourceWallet.name}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Multisig Badge */}
          {requiresMultisig && (
            <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center gap-2">
              <Shield className="h-4 w-4 text-purple-500" />
              <span className="text-sm text-purple-500">
                This wallet requires hardware wallet signature
              </span>
            </div>
          )}

          {/* Multisig Challenge */}
          {multisigChallenge && (
            <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-semibold text-amber-500">
                  Hardware Wallet Signature Required
                </span>
              </div>
              <div className="p-3 rounded bg-background border">
                <p className="text-xs text-muted-foreground mb-2">Sign this message with your hardware wallet:</p>
                <code className="text-xs font-mono break-all whitespace-pre-wrap">
                  {multisigChallenge}
                </code>
              </div>
              <p className="text-xs text-muted-foreground">
                After signing, submit the signature via the API to complete the transfer.
              </p>
              <Button size="sm" onClick={() => setMultisigChallenge(null)}>
                Cancel
              </Button>
            </div>
          )}

          {/* Success State */}
          {status === 'success' && txSignature && (
            <div className="p-6 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </div>
              <div>
                <h3 className="font-semibold text-lg text-green-500">Transfer Complete!</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {amount} {getAssetSymbol()} sent successfully
                </p>
              </div>
              <a
                href={`https://solscan.io/tx/${txSignature}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-blue-500 hover:underline"
              >
                View on Solscan <ExternalLink className="h-4 w-4" />
              </a>
              <Button onClick={handleClose} className="w-full mt-4">
                Done
              </Button>
            </div>
          )}

          {/* Transfer Form */}
          {status !== 'success' && !multisigChallenge && (
            <>
              {/* Destination Type */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Destination</label>
                <div className="flex gap-2">
                  <Button
                    variant={destinationType === 'internal' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setDestinationType('internal')}
                    className="flex-1 gap-2"
                  >
                    <Wallet className="h-4 w-4" />
                    My Wallet
                  </Button>
                  <Button
                    variant={destinationType === 'external' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setDestinationType('external')}
                    className="flex-1 gap-2"
                  >
                    <ArrowRight className="h-4 w-4" />
                    External
                  </Button>
                </div>
              </div>

              {/* Destination Selection */}
              {destinationType === 'internal' ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Select Wallet</label>
                  <select
                    value={selectedDestWallet}
                    onChange={(e) => setSelectedDestWallet(e.target.value)}
                    className="w-full p-2 border rounded-lg bg-background"
                  >
                    <option value="">Choose destination wallet</option>
                    {destinationWallets.map(wallet => (
                      <option key={wallet.id} value={wallet.id}>
                        {wallet.name} ({wallet.address.slice(0, 8)}...)
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Recipient Address</label>
                  <Input
                    value={externalAddress}
                    onChange={(e) => setExternalAddress(e.target.value)}
                    placeholder="Enter Solana address"
                  />
                </div>
              )}

              {/* Asset Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Asset</label>
                <select
                  value={assetType}
                  onChange={(e) => setAssetType(e.target.value)}
                  className="w-full p-2 border rounded-lg bg-background"
                >
                  <option value="SOL">SOL ({sourceWallet.balance.toFixed(4)} available)</option>
                  {sourceWallet.tokens.map(token => (
                    <option key={token.mint} value={token.mint}>
                      {token.symbol} ({token.balance.toLocaleString()} available)
                    </option>
                  ))}
                </select>
              </div>

              {/* Amount */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Amount</label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={handleSetMax}
                  >
                    Max
                  </Button>
                </div>
                <div className="relative">
                  <Input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="pr-16"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    {getAssetSymbol()}
                  </span>
                </div>
                {assetType === 'SOL' && amount && (
                  <p className="text-xs text-muted-foreground">
                    ≈ ${(parseFloat(amount || '0') * solPrice).toFixed(2)} USD
                  </p>
                )}
              </div>

              {/* Error */}
              {errorMessage && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                  <p className="text-sm text-red-500">{errorMessage}</p>
                </div>
              )}

              {/* Transfer Button */}
              <Button
                onClick={handleTransfer}
                disabled={status === 'loading' || !amount || parseFloat(amount) <= 0}
                className="w-full gap-2 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600"
              >
                {status === 'loading' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <ArrowRight className="h-4 w-4" />
                    Transfer {amount && `${amount} ${getAssetSymbol()}`}
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
