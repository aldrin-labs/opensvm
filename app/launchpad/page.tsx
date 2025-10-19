'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sale } from '@/types/launchpad';

export default function LaunchpadPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'active' | 'finalized'>('all');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const url = filter === 'all'
          ? '/api/launchpad/sales'
          : `/api/launchpad/sales?status=${filter}`;
        const response = await fetch(url);
        const data = await response.json();
        if (data.success) {
          setSales(data.data);
        }
      } catch (error) {
        console.error('Error fetching sales:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [filter]);

  const formatSOL = (lamports: number) => {
    return (lamports / 1_000_000_000).toFixed(2);
  };

  const calculateProgress = (sale: Sale) => {
    return (sale.current_raise_lamports / sale.target_raise_lamports) * 100;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'upcoming': return 'bg-blue-100 text-blue-800';
      case 'active': return 'bg-green-100 text-green-800';
      case 'finalized': return 'bg-gray-100 text-gray-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTimeRemaining = (endDate: string) => {
    const now = new Date();
    const end = new Date(endDate);
    const diff = end.getTime() - now.getTime();
    
    if (diff <= 0) return 'Ended';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `${days}d ${hours}h remaining`;
    return `${hours}h remaining`;
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4">SOL ICO Launchpad</h1>
        <p className="text-gray-600 dark:text-gray-400 text-lg">
          Participate in vetted token launches on Solana with transparent vesting and reward mechanisms
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {['all', 'upcoming', 'active', 'finalized'].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status as any)}
            className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
              filter === status
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {/* Sales Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 animate-pulse">
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
              <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </div>
          ))}
        </div>
      ) : sales.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-900 rounded-lg">
          <p className="text-gray-500 dark:text-gray-400 text-lg">
            No {filter !== 'all' ? filter : ''} sales found
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sales.map((sale) => (
            <Link
              key={sale.id}
              href={`/launchpad/sale/${sale.id}`}
              className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 hover:border-blue-500 dark:hover:border-blue-400 transition-colors group"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                    {sale.name}
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 font-mono">
                    ${sale.token_symbol}
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(sale.status)}`}>
                  {sale.status}
                </span>
              </div>

              {/* Progress */}
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600 dark:text-gray-400">Raised</span>
                  <span className="font-medium">
                    {formatSOL(sale.current_raise_lamports)} / {formatSOL(sale.target_raise_lamports)} SOL
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${Math.min(calculateProgress(sale), 100)}%` }}
                  ></div>
                </div>
                <div className="text-right text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {calculateProgress(sale).toFixed(1)}%
                </div>
              </div>

              {/* Time Remaining */}
              {sale.status === 'active' && (
                <div className="flex items-center justify-between text-sm mb-4">
                  <span className="text-gray-600 dark:text-gray-400">Time remaining</span>
                  <span className="font-medium text-orange-600 dark:text-orange-400">
                    {getTimeRemaining(sale.end_date)}
                  </span>
                </div>
              )}

              {/* Key Metrics */}
              <div className="grid grid-cols-2 gap-2 text-xs mb-4">
                <div className="bg-gray-50 dark:bg-gray-800 p-2 rounded">
                  <div className="text-gray-500 dark:text-gray-400">Min Contribution</div>
                  <div className="font-medium">{formatSOL(sale.min_contribution_lamports)} SOL</div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 p-2 rounded">
                  <div className="text-gray-500 dark:text-gray-400">Total Supply</div>
                  <div className="font-medium">{(sale.total_supply / 1_000_000).toFixed(0)}M</div>
                </div>
              </div>

              {/* CTA Button */}
              <button className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
                sale.status === 'active'
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
              }`}>
                {sale.status === 'active' ? 'Contribute Now' : 'View Details'}
              </button>
            </Link>
          ))}
        </div>
      )}

      {/* Info Section */}
      <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-lg">
          <div className="text-3xl mb-2">
            <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
          </div>
          <h3 className="font-bold mb-2">Transparent Vesting</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            All token distributions follow pre-defined vesting schedules with cliff periods
          </p>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 p-6 rounded-lg">
          <div className="text-3xl mb-2">
            <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
              <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
            </svg>
          </div>
          <h3 className="font-bold mb-2">KOL Rewards</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Earn tokens by referring contributors and generating trading volume
          </p>
        </div>
        <div className="bg-purple-50 dark:bg-purple-900/20 p-6 rounded-lg">
          <div className="text-3xl mb-2">
            <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
          <h3 className="font-bold mb-2">Anti-Fraud Protection</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Advanced heuristics detect and prevent fraudulent contributions
          </p>
        </div>
      </div>
    </div>
  );
}
