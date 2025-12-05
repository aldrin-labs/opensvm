'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Transaction, Connection } from '@solana/web3.js';
import { Buffer } from 'buffer';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Flame,
  RefreshCw,
  Loader2,
  Coins,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Info,
  Sparkles,
  Zap,
  ExternalLink,
  Square,
  CheckSquare
} from 'lucide-react';

interface PriceData {
  price: number;
  source: string;
  timestamp: number;
  confidence: number;
}

interface ClosableAccount {
  pubkey: string;
  mint: string;
  owner: string;
  balance: string;
  decimals: number;
  uiBalance: number;
  rentLamports: number;
  rentSOL: number;
  symbol?: string;
  name?: string;
  logoURI?: string;
  isZeroBalance: boolean;
  isDust: boolean;
  isFrozen?: boolean;
  tokenUsdValue: number;
  rentUsdValue: number;
  economicLoss: number;
  isProfitable: boolean;
  priceData?: PriceData;
  slippage: number;
  riskLevel: 'low' | 'medium' | 'high';
  accountType: 'standard' | 'nft' | 'lp' | 'custom';
  isCompressed?: boolean;
  collectionName?: string;
}

interface IncineratorData {
  accounts: ClosableAccount[];
  totalRentReclaimable: number;
  totalAccounts: number;
  zeroBalanceCount: number;
  dustCount: number;
  priceAccuracy: number;
  warnings: string[];
  gasInfo?: {
    totalLamports: number;
    totalSOL: number;
    totalUSD: number;
    costPerAccount: number;
    costPerAccountUSD: number;
    solPrice: number;
  };
}

type TransactionStatus = 'idle' | 'building' | 'signing' | 'confirming' | 'success' | 'error';

export function SolIncinerator() {
  const { signTransaction, connected, publicKey } = useWallet();
  const [data, setData] = useState<IncineratorData | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());
  const [burnDust, setBurnDust] = useState(false);
  const [txStatus, setTxStatus] = useState<TransactionStatus>('idle');
  const [txMessage, setTxMessage] = useState<string>('');
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmUnprofitable, setConfirmUnprofitable] = useState(false);
  
  // Advanced filtering state
  const [filterRiskLevel, setFilterRiskLevel] = useState<'all' | 'low' | 'medium' | 'high'>('all');
  const [filterAccountType, setFilterAccountType] = useState<'all' | 'standard' | 'nft' | 'lp' | 'custom'>('all');
  const [filterProfitability, setFilterProfitability] = useState<'all' | 'profitable' | 'unprofitable'>('all');
  const [filterValueRange, setFilterValueRange] = useState<{ min: number; max: number }>({ min: 0, max: 1000 });
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [sortBy, setSortBy] = useState<'profitability' | 'value' | 'risk'>('profitability');

  const fetchClosableAccounts = useCallback(async () => {
    if (!connected || !publicKey) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/bank/incinerator/closable', {
        credentials: 'include'
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch closable accounts');
      }
      
      const result: IncineratorData = await response.json();
      setData(result);
      
      // Auto-select zero balance accounts by default
      const zeroBalanceAccounts = new Set(
        result.accounts
          .filter(a => a.isZeroBalance)
          .map(a => a.pubkey)
      );
      setSelectedAccounts(zeroBalanceAccounts);
      
    } catch (err) {
      console.error('Error fetching closable accounts:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch accounts');
    } finally {
      setLoading(false);
    }
  }, [connected, publicKey]);

  useEffect(() => {
    if (connected && publicKey) {
      fetchClosableAccounts();
    }
  }, [connected, publicKey, fetchClosableAccounts]);

  const toggleAccount = (pubkey: string) => {
    setSelectedAccounts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(pubkey)) {
        newSet.delete(pubkey);
      } else {
        newSet.add(pubkey);
      }
      return newSet;
    });
  };

  const selectAllZeroBalance = () => {
    if (!data) return;
    const zeroBalanceAccounts = new Set(
      data.accounts
        .filter(a => a.isZeroBalance)
        .map(a => a.pubkey)
    );
    setSelectedAccounts(zeroBalanceAccounts);
  };

  const selectAll = () => {
    if (!data) return;
    const allAccounts = new Set(data.accounts.map(a => a.pubkey));
    setSelectedAccounts(allAccounts);
  };

  const clearSelection = () => {
    setSelectedAccounts(new Set());
  };

  const handleIncinerate = async () => {
    if (!signTransaction || selectedAccounts.size === 0) return;
    
    // Require confirmation if there's an unprofitable trade
    if (hasUnprofitableTrades && !confirmUnprofitable) {
      setError('Please confirm you understand the economic loss');
      return;
    }
    
    setTxStatus('building');
    setTxMessage('Building transaction...');
    setTxSignature(null);
    setError(null);
    
    try {
      // Build the transaction via API
      const buildResponse = await fetch('/api/bank/incinerator/close', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accounts: Array.from(selectedAccounts),
          burnDust
        })
      });
      
      if (!buildResponse.ok) {
        const errorData = await buildResponse.json();
        throw new Error(errorData.error || 'Failed to build transaction');
      }
      
      const { transaction: serializedTx, accountsToClose, estimatedRentReclaim, message } = await buildResponse.json();
      
      setTxMessage(`${message}. Waiting for signature...`);
      setTxStatus('signing');
      
      // Deserialize and sign transaction
      const transactionBuffer = Buffer.from(serializedTx, 'base64');
      const transaction = Transaction.from(transactionBuffer);
      
      // Sign with wallet
      const signedTransaction = await signTransaction(transaction);
      
      setTxStatus('confirming');
      setTxMessage(`Simulating transaction...`);
      
      // Send the signed transaction
      const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
      const connection = new Connection(rpcUrl, 'confirmed');
      
      // Simulate transaction first to catch errors early
      const simulation = await connection.simulateTransaction(signedTransaction);
      if (simulation.value.err) {
        throw new Error(`Transaction simulation failed: ${JSON.stringify(simulation.value.err)}`);
      }
      
      setTxMessage(`Sending transaction to close ${accountsToClose} account(s)...`);
      
      const signature = await connection.sendRawTransaction(signedTransaction.serialize(), {
        skipPreflight: true, // Skip preflight since we already simulated
        preflightCommitment: 'confirmed'
      });
      
      setTxSignature(signature);
      setTxMessage(`Transaction sent! Confirming...`);
      
      // Wait for confirmation
      const confirmation = await connection.confirmTransaction(signature, 'confirmed');
      
      if (confirmation.value.err) {
        throw new Error('Transaction failed to confirm');
      }
      
      setTxStatus('success');
      setTxMessage(`Successfully closed ${accountsToClose} account(s)! Reclaimed ~${estimatedRentReclaim.toFixed(6)} SOL`);
      
      // Reset confirmation
      setConfirmUnprofitable(false);
      
      // Refresh the list after successful incineration
      setTimeout(() => {
        fetchClosableAccounts();
      }, 2000);
      
    } catch (err) {
      console.error('Incineration error:', err);
      setTxStatus('error');
      setError(err instanceof Error ? err.message : 'Transaction failed');
      setTxMessage('');
    }
  };

  const selectedAccounting = data
    ? data.accounts
        .filter(a => selectedAccounts.has(a.pubkey))
        .reduce((acc, a) => ({
          rentReclaim: acc.rentReclaim + a.rentSOL,
          rentUsdValue: acc.rentUsdValue + a.rentUsdValue,
          tokenUsdValue: acc.tokenUsdValue + a.tokenUsdValue,
          economicLoss: acc.economicLoss + a.economicLoss,
          count: acc.count + 1
        }), { rentReclaim: 0, rentUsdValue: 0, tokenUsdValue: 0, economicLoss: 0, count: 0 })
    : { rentReclaim: 0, rentUsdValue: 0, tokenUsdValue: 0, economicLoss: 0, count: 0 };

  // Calculate total worth of all accounts (tokens + rent)
  const totalAccountsWorth = data
    ? data.accounts.reduce((acc, a) => ({
        totalTokenValue: acc.totalTokenValue + a.tokenUsdValue,
        totalRentValue: acc.totalRentValue + a.rentUsdValue,
        totalRentSOL: acc.totalRentSOL + a.rentSOL
      }), { totalTokenValue: 0, totalRentValue: 0, totalRentSOL: 0 })
    : { totalTokenValue: 0, totalRentValue: 0, totalRentSOL: 0 };

  const hasUnprofitableTrades = selectedAccounting.economicLoss > 0;
  const hasSignificantLoss = selectedAccounting.economicLoss > 1; // More than $1 loss

  // Apply advanced filters and sorting
  const filteredAndSortedAccounts = data ? [...data.accounts]
    .filter(account => {
      // Risk level filter
      if (filterRiskLevel !== 'all' && account.riskLevel !== filterRiskLevel) {
        return false;
      }
      
      // Account type filter
      if (filterAccountType !== 'all' && account.accountType !== filterAccountType) {
        return false;
      }
      
      // Profitability filter
      if (filterProfitability === 'profitable' && !account.isProfitable) {
        return false;
      }
      if (filterProfitability === 'unprofitable' && account.isProfitable) {
        return false;
      }
      
      // Value range filter
      if (account.tokenUsdValue < filterValueRange.min || account.tokenUsdValue > filterValueRange.max) {
        return false;
      }
      
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'profitability':
          // Sort by profitability (most profitable first)
          if (a.isProfitable && !b.isProfitable) return -1;
          if (!a.isProfitable && b.isProfitable) return 1;
          return a.economicLoss - b.economicLoss;
        
        case 'value':
          // Sort by token value (highest first)
          return b.tokenUsdValue - a.tokenUsdValue;
        
        case 'risk':
          // Sort by risk level (low to high)
          const riskOrder = { low: 0, medium: 1, high: 2 };
          return riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
        
        default:
          return 0;
      }
    }) : [];

  if (!connected || !publicKey) {
    return (
      <Card className="border-orange-500/30 bg-gradient-to-br from-orange-500/5 to-red-500/5">
        <CardContent className="p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center mx-auto mb-4">
            <Flame className="h-8 w-8 text-white" />
          </div>
          <h3 className="text-2xl font-bold mb-2 text-foreground">Sol Incinerator</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            Connect your wallet to reclaim SOL from empty token accounts
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-orange-500/30 bg-gradient-to-br from-orange-500/5 to-red-500/5">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
              <Flame className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                Sol Incinerator
                <Badge variant="secondary" className="text-xs">
                  <Sparkles className="h-3 w-3 mr-1" />
                  Reclaim SOL
                </Badge>
              </CardTitle>
              <CardDescription>
                Close empty token accounts to reclaim rent SOL
              </CardDescription>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchClosableAccounts}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Warnings */}
        {data && data.warnings.length > 0 && (
          <div className="space-y-2">
            {data.warnings.map((warning, index) => (
              <div key={index} className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-600 dark:text-amber-400">{warning}</p>
              </div>
            ))}
          </div>
        )}

        {/* Stats Overview */}
        {data && (
          <>
            {/* Total Worth Banner */}
            <div className="p-4 rounded-lg bg-gradient-to-r from-emerald-500/10 via-cyan-500/10 to-blue-500/10 border border-emerald-500/30">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Estimated Total Account Worth</p>
                  <p className="text-3xl font-bold bg-gradient-to-r from-emerald-500 to-cyan-500 bg-clip-text text-transparent">
                    ${(totalAccountsWorth.totalTokenValue + totalAccountsWorth.totalRentValue).toFixed(2)}
                  </p>
                </div>
                <div className="flex gap-6 text-sm">
                  <div className="text-center">
                    <p className="text-muted-foreground">Token Value</p>
                    <p className="font-semibold text-blue-500">${totalAccountsWorth.totalTokenValue.toFixed(2)}</p>
                  </div>
                  <div className="text-center border-l border-border pl-6">
                    <p className="text-muted-foreground">Locked Rent</p>
                    <p className="font-semibold text-emerald-500">${totalAccountsWorth.totalRentValue.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">{totalAccountsWorth.totalRentSOL.toFixed(4)} SOL</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="p-3 rounded-lg bg-background border">
                <p className="text-xs text-muted-foreground">Total Accounts</p>
                <p className="text-xl font-bold">{data.totalAccounts}</p>
              </div>
              <div className="p-3 rounded-lg bg-background border border-green-500/30">
                <p className="text-xs text-muted-foreground">Zero Balance</p>
                <p className="text-xl font-bold text-green-500">{data.zeroBalanceCount}</p>
              </div>
              <div className="p-3 rounded-lg bg-background border border-amber-500/30">
                <p className="text-xs text-muted-foreground">Dust Accounts</p>
                <p className="text-xl font-bold text-amber-500">{data.dustCount}</p>
              </div>
              <div className="p-3 rounded-lg bg-background border border-orange-500/30">
                <p className="text-xs text-muted-foreground">Reclaimable SOL</p>
                <p className="text-xl font-bold text-orange-500">{data.totalRentReclaimable.toFixed(4)}</p>
              </div>
              <div className="p-3 rounded-lg bg-background border border-blue-500/30">
                <p className="text-xs text-muted-foreground">Price Accuracy</p>
                <p className={`text-xl font-bold ${data.priceAccuracy >= 90 ? 'text-green-500' : data.priceAccuracy >= 70 ? 'text-amber-500' : 'text-red-500'}`}>
                  {data.priceAccuracy}%
                </p>
              </div>
            </div>

            {/* Gas Cost Information */}
            {data.gasInfo && (
              <div className="p-4 rounded-lg bg-purple-500/5 border border-purple-500/30">
                <div className="flex items-center gap-2 mb-3">
                  <Coins className="h-4 w-4 text-purple-500" />
                  <span className="text-sm font-semibold text-purple-500 dark:text-purple-400">Transaction Costs (Gas Fees)</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div>
                    <p className="text-muted-foreground">Per Account:</p>
                    <p className="font-semibold text-purple-600">
                      ${data.gasInfo.costPerAccountUSD.toFixed(4)}
                    </p>
                    <p className="text-muted-foreground">
                      {data.gasInfo.costPerAccount.toFixed(0)} lamports
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total Cost:</p>
                    <p className="font-semibold text-purple-600">
                      ${data.gasInfo.totalUSD.toFixed(4)}
                    </p>
                    <p className="text-muted-foreground">
                      {data.gasInfo.totalSOL.toFixed(6)} SOL
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Current SOL Price:</p>
                    <p className="font-semibold text-purple-600">
                      ${data.gasInfo.solPrice.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Network Fee:</p>
                    <p className="font-semibold text-purple-600">
                      {data.gasInfo.totalLamports - (data.gasInfo.costPerAccount * data.totalAccounts)} lamports
                    </p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Transaction Status */}
        {txStatus !== 'idle' && (
          <div className={`p-4 rounded-lg border ${
            txStatus === 'success' ? 'bg-green-500/10 border-green-500/30' :
            txStatus === 'error' ? 'bg-red-500/10 border-red-500/30' :
            'bg-blue-500/10 border-blue-500/30'
          }`}>
            <div className="flex items-center gap-3">
              {txStatus === 'building' || txStatus === 'signing' || txStatus === 'confirming' ? (
                <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
              ) : txStatus === 'success' ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              <div className="flex-1">
                <p className="text-sm font-medium">
                  {txStatus === 'building' && 'Building Transaction...'}
                  {txStatus === 'signing' && 'Waiting for Signature...'}
                  {txStatus === 'confirming' && 'Confirming Transaction...'}
                  {txStatus === 'success' && 'Success!'}
                  {txStatus === 'error' && 'Error'}
                </p>
                {txMessage && <p className="text-xs text-muted-foreground mt-1">{txMessage}</p>}
                {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
              </div>
              {txSignature && (
                <a
                  href={`https://solscan.io/tx/${txSignature}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-500 hover:underline flex items-center gap-1"
                >
                  View <ExternalLink className="h-3 w-3" />
                </a>
              )}
              {txStatus === 'error' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setTxStatus('idle');
                    setError(null);
                    setTxMessage('');
                  }}
                >
                  Dismiss
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Advanced Filters */}
        {data && data.accounts.length > 0 && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={selectAllZeroBalance}>
                  Select Zero Balance
                </Button>
                <Button variant="outline" size="sm" onClick={selectAll}>
                  Select All
                </Button>
                <Button variant="ghost" size="sm" onClick={clearSelection}>
                  Clear
                </Button>
              </div>
              <div className="flex-1" />
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                >
                  <Info className="h-3 w-3 mr-1" />
                  {showAdvancedFilters ? 'Hide Filters' : 'Advanced Filters'}
                </Button>
                <Switch
                  label="Burn dust tokens"
                  checked={burnDust}
                  onChange={setBurnDust}
                />
                <AlertTriangle className="h-3 w-3 text-amber-500" />
              </div>
            </div>

            {showAdvancedFilters && (
              <div className="p-4 rounded-lg bg-muted/50 border space-y-3">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium">Advanced Filters</span>
                  <Badge variant="outline" className="text-xs">
                    {filteredAndSortedAccounts.length} of {data.accounts.length} accounts
                  </Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Risk Level Filter */}
                  <div>
                    <label className="text-sm font-medium mb-2">Risk Level</label>
                    <select
                      value={filterRiskLevel}
                      onChange={(e) => setFilterRiskLevel(e.target.value as any)}
                      className="w-full p-2 border rounded text-sm"
                    >
                      <option value="all">All Levels</option>
                      <option value="low">Low Risk Only</option>
                      <option value="medium">Medium Risk Only</option>
                      <option value="high">High Risk Only</option>
                    </select>
                  </div>

                  {/* Account Type Filter */}
                  <div>
                    <label className="text-sm font-medium mb-2">Account Type</label>
                    <select
                      value={filterAccountType}
                      onChange={(e) => setFilterAccountType(e.target.value as any)}
                      className="w-full p-2 border rounded text-sm"
                    >
                      <option value="all">All Types</option>
                      <option value="standard">Standard Tokens</option>
                      <option value="nft">NFTs Only</option>
                      <option value="lp">LP Tokens Only</option>
                      <option value="custom">Custom Tokens</option>
                    </select>
                  </div>

                  {/* Profitability Filter */}
                  <div>
                    <label className="text-sm font-medium mb-2">Profitability</label>
                    <select
                      value={filterProfitability}
                      onChange={(e) => setFilterProfitability(e.target.value as any)}
                      className="w-full p-2 border rounded text-sm"
                    >
                      <option value="all">All Accounts</option>
                      <option value="profitable">Profitable Only</option>
                      <option value="unprofitable">Unprofitable Only</option>
                    </select>
                  </div>

                  {/* Sort By */}
                  <div>
                    <label className="text-sm font-medium mb-2">Sort By</label>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="w-full p-2 border rounded text-sm"
                    >
                      <option value="profitability">Best Trades First</option>
                      <option value="value">Highest Value First</option>
                      <option value="risk">Lowest Risk First</option>
                    </select>
                  </div>
                </div>

                {/* Value Range Filter */}
                <div>
                  <label className="text-sm font-medium mb-2">Token Value Range ($)</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      placeholder="Min"
                      value={filterValueRange.min}
                      onChange={(e) => setFilterValueRange(prev => ({ ...prev, min: parseFloat(e.target.value) || 0 }))}
                      className="w-24 p-2 border rounded text-sm"
                    />
                    <span className="text-muted-foreground">to</span>
                    <input
                      type="number"
                      placeholder="Max"
                      value={filterValueRange.max}
                      onChange={(e) => setFilterValueRange(prev => ({ ...prev, max: parseFloat(e.target.value) || 1000 }))}
                      className="w-24 p-2 border rounded text-sm"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Accounts List */}
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error && !data ? (
          <div className="text-center p-8 text-red-500">
            <XCircle className="h-8 w-8 mx-auto mb-2" />
            <p>{error}</p>
          </div>
        ) : data && data.accounts.length === 0 ? (
          <div className="text-center p-8 text-muted-foreground">
            <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
            <p>No closable token accounts found!</p>
            <p className="text-sm">Your wallet is already optimized.</p>
          </div>
        ) : data ? (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {filteredAndSortedAccounts.map((account) => (
              <div
                key={account.pubkey}
                className={`p-3 rounded-lg border transition-all ${
                  selectedAccounts.has(account.pubkey)
                    ? 'bg-orange-500/10 border-orange-500/30'
                    : 'bg-background border-border hover:border-muted-foreground/30'
                }`}
              >
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => toggleAccount(account.pubkey)}
                        disabled={account.isFrozen || (!account.isZeroBalance && !burnDust)}
                        className={`flex-shrink-0 ${(account.isFrozen || (!account.isZeroBalance && !burnDust)) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:opacity-80'}`}
                        title={account.isFrozen ? 'Frozen accounts cannot be closed' : undefined}
                      >
                        {selectedAccounts.has(account.pubkey) ? (
                          <CheckSquare className="h-5 w-5 text-orange-500" />
                        ) : (
                          <Square className="h-5 w-5 text-muted-foreground" />
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {account.logoURI ? (
                            <img
                              src={account.logoURI}
                              alt={account.symbol}
                              className="w-6 h-6 rounded-full"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xs font-bold">
                              {account.symbol?.slice(0, 2) || '??'}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{account.symbol || 'Unknown'}</p>
                            <p className="text-xs text-muted-foreground truncate">{account.name}</p>
                            {/* Account Type Badge */}
                            <div className="flex items-center gap-1 mt-1">
                              {account.isFrozen && (
                                <Badge variant="outline" className="text-xs text-red-500 border-red-500/30">
                                  🔒 Frozen
                                </Badge>
                              )}
                              {account.accountType === 'nft' && (
                                <Badge variant="outline" className="text-xs text-purple-500 border-purple-500/30">
                                  {account.isCompressed ? 'Compressed NFT' : 'NFT'}
                                </Badge>
                              )}
                              {account.accountType === 'lp' && (
                                <Badge variant="outline" className="text-xs text-blue-500 border-blue-500/30">
                                  LP Token
                                </Badge>
                              )}
                              {account.accountType === 'custom' && (
                                <Badge variant="outline" className="text-xs text-orange-500 border-orange-500/30">
                                  Custom Token
                                </Badge>
                              )}
                              {account.collectionName && (
                                <span className="text-xs text-muted-foreground truncate">
                                  {account.collectionName}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        {account.isZeroBalance ? (
                          <Badge variant="outline" className="text-green-500 border-green-500/30">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Safe
                          </Badge>
                        ) : account.isProfitable ? (
                          <Badge variant="outline" className="text-blue-500 border-blue-500/30">
                            <Zap className="h-3 w-3 mr-1" />
                            Profitable
                          </Badge>
                        ) : account.economicLoss < 0.1 ? (
                          <Badge variant="outline" className="text-amber-500 border-amber-500/30">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Small Loss
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-red-500 border-red-500/30">
                            <XCircle className="h-3 w-3 mr-1" />
                            Big Loss
                          </Badge>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {account.uiBalance > 0 && `${account.uiBalance.toLocaleString()} tokens`}
                        </p>
                      </div>
                    </div>
                    
                    {/* Risk and Price Info */}
                    {account.priceData && (
                      <div className="ml-9 pl-3 border-l-2 border-muted space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Price source:</span>
                          <span className="font-medium">
                            {account.priceData.source}
                            {account.priceData.confidence < 90 && (
                              <span className="text-amber-500 ml-1">({account.priceData.confidence}%)</span>
                            )}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Risk level:</span>
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${
                              account.riskLevel === 'low' ? 'text-green-500 border-green-500/30' :
                              account.riskLevel === 'medium' ? 'text-amber-500 border-amber-500/30' :
                              'text-red-500 border-red-500/30'
                            }`}
                          >
                            {account.riskLevel === 'low' && 'Low'}
                            {account.riskLevel === 'medium' && 'Medium'}
                            {account.riskLevel === 'high' && 'High'}
                          </Badge>
                        </div>
                        {account.slippage > 0 && (
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Est. slippage:</span>
                            <span className="font-medium text-amber-500">
                              {account.slippage.toFixed(1)}%
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Economic breakdown */}
                    <div className="ml-9 pl-3 border-l-2 border-muted space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Token value:</span>
                        <span className={account.tokenUsdValue > 0 ? 'font-medium' : 'text-muted-foreground'}>
                          ${account.tokenUsdValue.toFixed(4)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Rent reclaim:</span>
                        <span className="font-medium text-green-500">
                          ${account.rentUsdValue.toFixed(4)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs pt-1 border-t border-muted">
                        <span className={account.isProfitable ? 'text-green-500 font-medium' : 'text-red-500 font-medium'}>
                          Net:
                        </span>
                        <span className={account.isProfitable ? 'font-bold text-green-500' : 'font-bold text-red-500'}>
                          {account.isProfitable ? '+' : ''}{(-account.economicLoss).toFixed(4)} USD
                        </span>
                      </div>
                    </div>
                  </div>
              </div>
            ))}
          </div>
        ) : null}

        {/* Action Button */}
        {data && data.accounts.length > 0 && (
          <div className="pt-4 border-t space-y-3">
            {/* Economic Impact Summary */}
            <div className={`p-4 rounded-lg border ${
              hasUnprofitableTrades
                ? hasSignificantLoss
                  ? 'bg-red-500/10 border-red-500/30'
                  : 'bg-amber-500/10 border-amber-500/30'
                : 'bg-green-500/10 border-green-500/30'
            }`}>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Selected accounts:</span>
                  <span className="font-medium">{selectedAccounting.count}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Tokens to burn:</span>
                  <span className="font-medium">${selectedAccounting.tokenUsdValue.toFixed(4)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">SOL to reclaim:</span>
                  <span className="font-medium text-green-500">${selectedAccounting.rentUsdValue.toFixed(4)}</span>
                </div>
                
                {/* Gas Costs */}
                {data.gasInfo && (
                  <>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Transaction fees:</span>
                      <span className="font-medium text-purple-500">
                        -${(data.gasInfo.costPerAccountUSD * selectedAccounting.count).toFixed(4)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm pt-2 border-t border-border">
                      {(() => {
                        const gasCost = data.gasInfo.costPerAccountUSD * selectedAccounting.count;
                        const netProfit = selectedAccounting.rentUsdValue - selectedAccounting.tokenUsdValue - gasCost;
                        const isProfit = netProfit > 0;
                        return (
                          <>
                            <span className={`font-semibold ${isProfit ? 'text-green-500' : 'text-red-500'}`}>
                              Net impact (after gas):
                            </span>
                            <span className={`font-bold ${isProfit ? 'text-green-500' : 'text-red-500'}`}>
                              {isProfit ? '+' : ''}
                              ${netProfit.toFixed(4)}
                            </span>
                          </>
                        );
                      })()}
                    </div>
                  </>
                )}
                
                {/* Fallback if no gas info */}
                {!data.gasInfo && (
                  <div className="flex items-center justify-between text-sm pt-2 border-t border-border">
                    {(() => {
                      const netProfit = selectedAccounting.rentUsdValue - selectedAccounting.tokenUsdValue;
                      const isProfit = netProfit > 0;
                      return (
                        <>
                          <span className={`font-semibold ${isProfit ? 'text-green-500' : 'text-red-500'}`}>
                            Net economic impact:
                          </span>
                          <span className={`font-bold ${isProfit ? 'text-green-500' : 'text-red-500'}`}>
                            {isProfit ? '+' : ''}${netProfit.toFixed(4)}
                          </span>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>

            {/* Unprofitable Trade Warning & Confirmation */}
            {hasUnprofitableTrades && (
              <div className={`p-4 rounded-lg border space-y-3 ${
                hasSignificantLoss
                  ? 'bg-red-500/10 border-red-500/30'
                  : 'bg-amber-500/10 border-amber-500/30'
              }`}>
                <div className="flex items-start gap-3">
                  <AlertTriangle className={`h-5 w-5 flex-shrink-0 ${hasSignificantLoss ? 'text-red-500' : 'text-amber-500'}`} />
                  <div className="flex-1">
                    <p className={`text-sm font-semibold ${hasSignificantLoss ? 'text-red-500' : 'text-amber-500'}`}>
                      {hasSignificantLoss ? '⚠️ SIGNIFICANT ECONOMIC LOSS' : 'Economic Loss Warning'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      You will burn ${selectedAccounting.tokenUsdValue.toFixed(4)} worth of tokens to reclaim ${selectedAccounting.rentUsdValue.toFixed(4)} in SOL. 
                      This results in a loss of ${selectedAccounting.economicLoss.toFixed(4)}.
                    </p>
                  </div>
                </div>
                
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={confirmUnprofitable}
                    onChange={(e) => setConfirmUnprofitable(e.target.checked)}
                    className="mt-1"
                  />
                  <span className="text-xs">
                    I understand I will lose ${selectedAccounting.economicLoss.toFixed(4)} in token value and want to proceed anyway
                  </span>
                </label>
              </div>
            )}

            <Button
              className="w-full gap-2 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
              onClick={handleIncinerate}
              disabled={
                selectedAccounts.size === 0 || 
                txStatus === 'building' || 
                txStatus === 'signing' || 
                txStatus === 'confirming' ||
                (hasUnprofitableTrades && !confirmUnprofitable)
              }
            >
              {txStatus === 'building' || txStatus === 'signing' || txStatus === 'confirming' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4" />
                  Incinerate {selectedAccounts.size > 20 ? `first 20 of ${selectedAccounts.size}` : `${selectedAccounts.size}`} Account{selectedAccounts.size !== 1 ? 's' : ''}
                </>
              )}
            </Button>
            
            {selectedAccounts.size > 20 && (
              <p className="text-xs text-blue-500 flex items-center gap-1">
                <Info className="h-3 w-3" />
                Maximum 20 accounts per transaction. Run multiple times to close all.
              </p>
            )}
            
            {!burnDust && data.dustCount > 0 && (
              <p className="text-xs text-amber-500 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Enable &quot;Burn dust tokens&quot; to close accounts with small balances
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
