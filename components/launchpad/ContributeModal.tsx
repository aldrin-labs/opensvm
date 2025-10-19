'use client';

import React, { useState } from 'react';
import { Sale, ContributionReceipt } from '@/types/launchpad';

interface ContributeModalProps {
  sale: Sale;
  initialReferralCode?: string;
  onClose: () => void;
  onSuccess: (receipt: ContributionReceipt) => void;
}

export default function ContributeModal({ sale, initialReferralCode = '', onClose, onSuccess }: ContributeModalProps) {
  const [amount, setAmount] = useState('');
  const [referralCode, setReferralCode] = useState(initialReferralCode);
  const [walletAddress, setWalletAddress] = useState('');
  const [depositMode, setDepositMode] = useState<'wallet_transfer' | 'in_app_send'>('wallet_transfer');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [depositInfo, setDepositInfo] = useState<{ address: string; memo: string; qrCode: string } | null>(null);

  const presetAmounts = [0.5, 1, 5, 10, 50];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!walletAddress) {
      setError('Please enter your wallet address');
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    const minSOL = sale.min_contribution_lamports / 1_000_000_000;
    const maxSOL = sale.max_contribution_lamports ? sale.max_contribution_lamports / 1_000_000_000 : Infinity;

    if (amountNum < minSOL) {
      setError(`Minimum contribution is ${minSOL} SOL`);
      return;
    }

    if (amountNum > maxSOL) {
      setError(`Maximum contribution is ${maxSOL} SOL`);
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/launchpad/sales/${sale.id}/contribute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sale_id: sale.id,
          contributor_pubkey: walletAddress,
          amount_lamports: Math.floor(amountNum * 1_000_000_000),
          referral_code: referralCode || undefined,
          deposit_mode: depositMode,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || 'Failed to create contribution');
        return;
      }

      if (data.data.fraud_warning) {
        setError(`Warning: ${data.data.fraud_warning.join(', ')}`);
      }

      // Set deposit info for QR display
      if (depositMode === 'wallet_transfer') {
        setDepositInfo({
          address: data.data.receipt.deposit_address,
          memo: data.data.receipt.deposit_memo || '',
          qrCode: await generateDepositQR(data.data.receipt.deposit_address, amountNum, data.data.receipt.deposit_memo),
        });
      }

      onSuccess(data.data.receipt);
    } catch (err) {
      setError('Failed to submit contribution');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const generateDepositQR = async (address: string, amount: number, memo?: string): Promise<string> => {
    // Generate Solana payment URI
    const solanaUri = `solana:${address}?amount=${amount}${memo ? `&memo=${encodeURIComponent(memo)}` : ''}`;
    
    // In production, use a real QR code library like qrcode.react
    // For now, return a data URI that can be used with QR libraries
    try {
      // Placeholder - in real implementation, generate actual QR code
      return `data:image/svg+xml;base64,${btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="white"/><text x="100" y="100" text-anchor="middle" font-size="10">QR: ${address.substring(0, 8)}...</text></svg>`)}`;
    } catch {
      return '';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6 flex justify-between items-center">
          <h2 className="text-2xl font-bold">Contribute to {sale.name}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Wallet Address */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Your Wallet Address <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
              placeholder="Enter your Solana wallet address"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Amount (SOL) <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2 mb-2">
              {presetAmounts.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setAmount(preset.toString())}
                  className="flex-1 py-2 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  {preset} SOL
                </button>
              ))}
            </div>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Or enter custom amount"
              step="0.1"
              min={sale.min_contribution_lamports / 1_000_000_000}
              max={sale.max_contribution_lamports ? sale.max_contribution_lamports / 1_000_000_000 : undefined}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Min: {(sale.min_contribution_lamports / 1_000_000_000).toFixed(2)} SOL
              {sale.max_contribution_lamports && ` | Max: ${(sale.max_contribution_lamports / 1_000_000_000).toFixed(2)} SOL`}
            </div>
          </div>

          {/* Referral Code */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Referral Code (Optional)
            </label>
            <input
              type="text"
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
              placeholder="Enter KOL referral code"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase"
            />
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Have a referral code from a KOL? Enter it here to support them!
            </div>
          </div>

          {/* Deposit Mode */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Deposit Method
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-3 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                <input
                  type="radio"
                  value="wallet_transfer"
                  checked={depositMode === 'wallet_transfer'}
                  onChange={(e) => setDepositMode(e.target.value as any)}
                  className="text-blue-600"
                />
                <div>
                  <div className="font-medium">Wallet Transfer</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Transfer SOL from your wallet to provided address
                  </div>
                </div>
              </label>
              <label className="flex items-center gap-3 p-3 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                <input
                  type="radio"
                  value="in_app_send"
                  checked={depositMode === 'in_app_send'}
                  onChange={(e) => setDepositMode(e.target.value as any)}
                  className="text-blue-600"
                />
                <div>
                  <div className="font-medium">In-App Send</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Send directly via connected wallet
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* QR Code Display (after successful creation) */}
          {depositInfo && depositMode === 'wallet_transfer' && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h3 className="font-medium mb-3">Deposit Information</h3>
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <img 
                    src={depositInfo.qrCode} 
                    alt="Deposit QR Code" 
                    className="w-32 h-32 border-2 border-white rounded"
                  />
                  <div className="text-xs text-center text-gray-600 dark:text-gray-400 mt-1">
                    Scan to pay
                  </div>
                </div>
                <div className="flex-1 space-y-2 text-sm">
                  <div>
                    <div className="text-gray-600 dark:text-gray-400 text-xs">Address:</div>
                    <div className="font-mono text-xs break-all">{depositInfo.address}</div>
                  </div>
                  {depositInfo.memo && (
                    <div>
                      <div className="text-gray-600 dark:text-gray-400 text-xs">Memo:</div>
                      <div className="font-mono font-bold">{depositInfo.memo}</div>
                    </div>
                  )}
                  <div>
                    <div className="text-gray-600 dark:text-gray-400 text-xs">Amount:</div>
                    <div className="font-bold">{amount} SOL</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Summary */}
          <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
            <h3 className="font-medium mb-2">Summary</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Amount</span>
                <span className="font-medium">{amount || '0'} SOL</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Platform Fee ({(sale.platform_fee_percent * 100).toFixed(3)}%)</span>
                <span className="font-medium">{amount ? (parseFloat(amount) * sale.platform_fee_percent).toFixed(6) : '0'} SOL</span>
              </div>
              <div className="flex justify-between border-t border-gray-200 dark:border-gray-700 pt-2">
                <span className="font-medium">Net Contribution</span>
                <span className="font-bold">{amount ? (parseFloat(amount) * (1 - sale.platform_fee_percent)).toFixed(6) : '0'} SOL</span>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-3 px-6 rounded-lg transition-colors"
          >
            {loading ? 'Processing...' : 'Create Contribution'}
          </button>

          <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
            By contributing, you agree to the token distribution and vesting terms
          </div>
        </form>
      </div>
    </div>
  );
}
