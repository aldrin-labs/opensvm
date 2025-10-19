'use client';

import React, { useState } from 'react';
import { ContributionReceipt } from '@/types/launchpad';

interface ReceiptCardProps {
  receipt: ContributionReceipt;
}

export default function ReceiptCard({ receipt }: ReceiptCardProps) {
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<'success' | 'failure' | null>(null);
  const [copied, setCopied] = useState(false);

  const handleLocalVerification = async () => {
    setVerifying(true);
    try {
      // In a real implementation, this would verify the signature client-side
      // For now, we'll simulate verification
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Simulate verification logic
      const isValid = receipt.platform_signature && receipt.platform_pubkey;
      setVerificationResult(isValid ? 'success' : 'failure');
    } catch (error) {
      setVerificationResult('failure');
    } finally {
      setVerifying(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatAddress = (address: string) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20';
      case 'settled': return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20';
      case 'pending': return 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20';
      case 'failed': return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20';
      default: return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/20';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed': return '✓';
      case 'settled': return '✓✓';
      case 'pending': return '⧗';
      case 'failed': return '✗';
      default: return '○';
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xl font-bold">Contribution Receipt</h3>
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(receipt.status)}`}>
            {getStatusIcon(receipt.status)} {receipt.status.toUpperCase()}
          </div>
        </div>
        <div className="text-blue-100 text-sm">
          {new Date(receipt.timestamp).toLocaleString()}
        </div>
      </div>

      {/* Body */}
      <div className="p-6 space-y-4">
        {/* Contribution ID */}
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600 dark:text-gray-400">Contribution ID</span>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm">{formatAddress(receipt.contrib_id)}</span>
            <button
              onClick={() => copyToClipboard(receipt.contrib_id, 'Contribution ID')}
              className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-xs"
            >
              {copied ? '✓' : '▣'}
            </button>
          </div>
        </div>

        {/* Amount */}
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600 dark:text-gray-400">Amount</span>
          <span className="font-bold text-lg">
            {(receipt.amount_lamports / 1_000_000_000).toFixed(6)} SOL
          </span>
        </div>

        {/* Deposit Address */}
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600 dark:text-gray-400">Deposit Address</span>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm">{formatAddress(receipt.deposit_address)}</span>
            <button
              onClick={() => copyToClipboard(receipt.deposit_address, 'Deposit Address')}
              className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-xs"
            >
              ▣
            </button>
          </div>
        </div>

        {/* Memo */}
        {receipt.deposit_memo && (
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600 dark:text-gray-400">Memo</span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm">{receipt.deposit_memo}</span>
              <button
                onClick={() => copyToClipboard(receipt.deposit_memo || '', 'Memo')}
                className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-xs"
              >
                📋
              </button>
            </div>
          </div>
        )}

        {/* Referral Code */}
        {receipt.referral_code && (
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600 dark:text-gray-400">Referral Code</span>
            <span className="font-mono text-sm font-medium">{receipt.referral_code}</span>
          </div>
        )}

        {/* Divider */}
        <div className="border-t border-gray-200 dark:border-gray-700 my-4"></div>

        {/* Signature Info */}
        <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg space-y-2">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">Cryptographic Proof</div>
          
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Platform Signature</div>
            <div className="font-mono text-xs break-all text-gray-700 dark:text-gray-300">
              {receipt.platform_signature}
            </div>
          </div>
          
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Platform Public Key</div>
            <div className="font-mono text-xs break-all text-gray-700 dark:text-gray-300">
              {receipt.platform_pubkey}
            </div>
          </div>
        </div>

        {/* Verification */}
        <div className="flex gap-2">
          <button
            onClick={handleLocalVerification}
            disabled={verifying}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
          >
            {verifying ? 'Verifying...' : '◉ Verify Locally'}
          </button>
          <button
            onClick={() => window.open(receipt.verify_url, '_blank')}
            className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
          >
            ⎋ Verify Online
          </button>
        </div>

        {/* Verification Result */}
        {verificationResult && (
          <div className={`p-3 rounded-lg text-sm ${
            verificationResult === 'success'
              ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
          }`}>
            {verificationResult === 'success' ? (
              <>✓ Signature verified successfully! This receipt is authentic.</>
            ) : (
              <>✗ Signature verification failed. Please contact support.</>
            )}
          </div>
        )}

        {/* Status Details */}
        <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
          {receipt.status === 'pending' && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-3 rounded">
              ⧗ Your contribution is pending. Please transfer {(receipt.amount_lamports / 1_000_000_000).toFixed(6)} SOL 
              to the deposit address above with the memo "{receipt.deposit_memo}".
            </div>
          )}
          {receipt.status === 'confirmed' && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-3 rounded">
              ✓ Deposit confirmed! Your contribution will be processed when the sale is finalized.
            </div>
          )}
          {receipt.status === 'settled' && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-3 rounded">
              ✓✓ Contribution settled! Your tokens will be distributed according to the vesting schedule.
            </div>
          )}
        </div>

        {/* Download/Print */}
        <div className="flex gap-2 pt-2">
          <button
            onClick={() => window.print()}
            className="flex-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium py-2 px-4 rounded-lg transition-colors text-sm"
          >
            ⎙ Print Receipt
          </button>
          <button
            onClick={() => {
              const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(receipt, null, 2));
              const downloadAnchorNode = document.createElement('a');
              downloadAnchorNode.setAttribute("href", dataStr);
              downloadAnchorNode.setAttribute("download", `receipt-${receipt.contrib_id}.json`);
              document.body.appendChild(downloadAnchorNode);
              downloadAnchorNode.click();
              downloadAnchorNode.remove();
            }}
            className="flex-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium py-2 px-4 rounded-lg transition-colors text-sm"
          >
            ⇓ Download JSON
          </button>
        </div>
      </div>
    </div>
  );
}
