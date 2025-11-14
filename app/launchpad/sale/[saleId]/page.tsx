'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Sale, ContributionReceipt } from '@/types/launchpad';
import ContributeModal from '@/components/launchpad/ContributeModal';
import ReceiptCard from '@/components/launchpad/ReceiptCard';

export default function SaleDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const saleId = params?.saleId as string;
  const referralCode = searchParams?.get('ref') || '';
  
  const [sale, setSale] = useState<Sale | null>(null);
  const [loading, setLoading] = useState(true);
  const [showContributeModal, setShowContributeModal] = useState(false);
  const [receipt, setReceipt] = useState<ContributionReceipt | null>(null);
  const [referrerInfo, setReferrerInfo] = useState<{ name: string; code: string } | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareUrl, setShareUrl] = useState('');

  useEffect(() => {
    if (saleId) {
      fetchSale();
    }
    if (referralCode) {
      fetchReferrerInfo(referralCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saleId, referralCode]);

  const fetchSale = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/launchpad/sales/${saleId}`);
      const data = await response.json();
      if (data.success) {
        setSale(data.data);
      }
    } catch (error) {
      console.error('Error fetching sale:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchReferrerInfo = async (code: string) => {
    try {
      // Fetch referrer info to display banner
      const response = await fetch(`/api/launchpad/referral-links/${code}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setReferrerInfo({
            name: data.data.referrer_name || 'KOL',
            code: code,
          });
        }
      }
    } catch (error) {
      console.error('Error fetching referrer info:', error);
    }
  };

  const handleContributeSuccess = (newReceipt: ContributionReceipt) => {
    setReceipt(newReceipt);
    setShowContributeModal(false);
  };

  const formatSOL = (lamports: number) => {
    return (lamports / 1_000_000_000).toFixed(2);
  };

  const calculateProgress = () => {
    if (!sale) return 0;
    return (sale.current_raise_lamports / sale.target_raise_lamports) * 100;
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mb-8"></div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </div>
            <div className="space-y-6">
              <div className="h-96 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!sale) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold mb-2">Sale Not Found</h2>
          <p className="text-gray-600 dark:text-gray-400">
            The sale you're looking for doesn't exist or has been removed.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Referrer Banner */}
      {referrerInfo && (
        <div className="mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                {referrerInfo.name.charAt(0)}
              </div>
              <div>
                <div className="font-medium">Referred by {referrerInfo.name}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Code: <span className="font-mono font-bold">{referrerInfo.code}</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setReferrerInfo(null)}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              ✗
            </button>
          </div>
          <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Your referrer will earn rewards from your contribution and trading activity.
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-4xl font-bold mb-2">{sale.name}</h1>
            <div className="flex items-center gap-3">
              <span className="text-gray-600 dark:text-gray-400 font-mono text-lg">
                ${sale.token_symbol}
              </span>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                sale.status === 'active' ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' :
                sale.status === 'upcoming' ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200' :
                'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
              }`}>
                {sale.status}
              </span>
            </div>
          </div>
          {sale.status === 'active' && (
            <div className="flex gap-3">
              <button
                onClick={() => setShowContributeModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors flex-1"
              >
                Contribute Now
              </button>
              <button
                onClick={() => {
                  const url = `${window.location.origin}/launchpad/sale/${saleId}${referralCode ? `?ref=${referralCode}` : ''}`;
                  setShareUrl(url);
                  setShowShareModal(true);
                }}
                className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
                title="Share this sale"
              >
                ⇈ Share
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Progress Card */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
            <h3 className="text-xl font-bold mb-4">Raise Progress</h3>
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600 dark:text-gray-400">Current / Target</span>
                <span className="font-bold text-lg">
                  {formatSOL(sale.current_raise_lamports)} / {formatSOL(sale.target_raise_lamports)} SOL
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                <div
                  className="bg-blue-600 h-3 rounded-full transition-all"
                  style={{ width: `${Math.min(calculateProgress(), 100)}%` }}
                ></div>
              </div>
              <div className="text-right text-sm text-gray-500 dark:text-gray-400 mt-2">
                {calculateProgress().toFixed(1)}% Complete
              </div>
            </div>
          </div>

          {/* Token Distribution */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
            <h3 className="text-xl font-bold mb-4">Token Distribution</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">◉ Liquidity Pool</span>
                <span className="font-medium">{sale.liquidity_percent}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">▣ DAO Lock</span>
                <span className="font-medium">{sale.dao_lock_percent}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">⧖ Vested ({sale.vesting_duration_months} months)</span>
                <span className="font-medium">{sale.vesting_percent}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">◈ KOL Rewards</span>
                <span className="font-medium">{sale.kol_pool_percent}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">▦ Volume Rewards</span>
                <span className="font-medium">{sale.volume_rewards_percent}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">▨ Airdrop (SVMAI holders)</span>
                <span className="font-medium">{sale.airdrop_percent}%</span>
              </div>
            </div>
          </div>

          {/* Vesting Schedule */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
            <h3 className="text-xl font-bold mb-4">Vesting Details</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Duration</span>
                <span className="font-medium">{sale.vesting_duration_months} months (linear)</span>
              </div>
              {sale.vesting_cliff_days && (
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Cliff Period</span>
                  <span className="font-medium">{sale.vesting_cliff_days} days</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Volume Rewards Distribution</span>
                <span className="font-medium">{sale.volume_rewards_days} days</span>
              </div>
            </div>
          </div>

          {/* Receipt Card */}
          {receipt && (
            <ReceiptCard receipt={receipt} />
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Stats */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
            <h3 className="text-lg font-bold mb-4">Quick Stats</h3>
            <div className="space-y-3">
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Supply</div>
                <div className="font-mono font-bold text-lg">
                  {(sale.total_supply / 1_000_000).toFixed(0)}M {sale.token_symbol}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Min Contribution</div>
                <div className="font-mono font-bold">{formatSOL(sale.min_contribution_lamports)} SOL</div>
              </div>
              {sale.max_contribution_lamports && (
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Max Contribution</div>
                  <div className="font-mono font-bold">{formatSOL(sale.max_contribution_lamports)} SOL</div>
                </div>
              )}
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Platform Fee</div>
                <div className="font-mono font-bold">{(sale.platform_fee_percent * 100).toFixed(2)}%</div>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
            <h3 className="text-lg font-bold mb-4">Timeline</h3>
            <div className="space-y-3">
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Start Date</div>
                <div className="font-medium">{new Date(sale.start_date).toLocaleString()}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">End Date</div>
                <div className="font-medium">{new Date(sale.end_date).toLocaleString()}</div>
              </div>
            </div>
          </div>

          {/* Share Section */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
            <h3 className="text-lg font-bold mb-2">Earn Rewards</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Are you a KOL? Apply to earn tokens by referring contributors and generating volume.
            </p>
            <a
              href="/launchpad/kol/apply"
              className="block w-full bg-blue-600 hover:bg-blue-700 text-white text-center font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Apply as KOL
            </a>
          </div>
        </div>
      </div>

      {/* Contribute Modal */}
      {showContributeModal && (
        <ContributeModal
          sale={sale}
          initialReferralCode={referralCode}
          onClose={() => setShowContributeModal(false)}
          onSuccess={handleContributeSuccess}
        />
      )}

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Share Sale</h3>
              <button
                onClick={() => setShowShareModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                ✗
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Share URL</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={shareUrl}
                    readOnly
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-sm"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(shareUrl);
                      alert('Link copied to clipboard!');
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors text-sm"
                  >
                    Copy
                  </button>
                </div>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    window.open(`https://twitter.com/intent/tweet?text=Check out this token launch on OpenSVM&url=${encodeURIComponent(shareUrl)}`, '_blank');
                  }}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Twitter
                </button>
                <button
                  onClick={() => {
                    window.open(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=Check out this token launch on OpenSVM`, '_blank');
                  }}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Telegram
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
