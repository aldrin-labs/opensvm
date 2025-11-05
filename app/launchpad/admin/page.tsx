'use client';

import React, { useEffect, useState } from 'react';
import { Referrer } from '@/types/launchpad';

export default function AdminDashboard() {
  const [referrers, setReferrers] = useState<Referrer[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'kols' | 'sales' | 'disputes'>('kols');

  useEffect(() => {
    fetchReferrers();
  }, []);

  const fetchReferrers = async () => {
    try {
      setLoading(true);
      // Note: We need to create this API endpoint
      const response = await fetch('/api/launchpad/admin/referrers');
      if (response.ok) {
        const data = await response.json();
        setReferrers(data.success ? data.data : []);
      }
    } catch (error) {
      console.error('Error fetching referrers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      const response = await fetch(`/api/launchpad/admin/referrers/${id}/approve`, {
        method: 'POST',
      });
      if (response.ok) {
        fetchReferrers();
      }
    } catch (error) {
      console.error('Error approving referrer:', error);
    }
  };

  const handleReject = async (id: string) => {
    try {
      const response = await fetch(`/api/launchpad/admin/referrers/${id}/reject`, {
        method: 'POST',
      });
      if (response.ok) {
        fetchReferrers();
      }
    } catch (error) {
      console.error('Error rejecting referrer:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'rejected': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      case 'suspended': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4">Launchpad Admin Dashboard</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Manage KOL applications, sales, and disputes
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-gray-700">
        {[
          { key: 'kols', label: 'KOL Applications', count: referrers.filter(r => r.status === 'pending').length },
          { key: 'sales', label: 'Sales Management', count: 0 },
          { key: 'disputes', label: 'Disputes', count: 0 },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === tab.key
                ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs bg-red-500 text-white rounded-full">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* KOL Applications Tab */}
      {activeTab === 'kols' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">KOL Applications</h2>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {referrers.filter(r => r.status === 'pending').length} pending
            </div>
          </div>

          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 animate-pulse">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
                </div>
              ))}
            </div>
          ) : referrers.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <p className="text-gray-500 dark:text-gray-400">No KOL applications found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {referrers.map((referrer) => (
                <div
                  key={referrer.id}
                  className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-bold mb-1">{referrer.display_name}</h3>
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <span>{referrer.email}</span>
                        {referrer.kyc_verified && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400 rounded text-xs">
                            ✓ KYC Verified
                          </span>
                        )}
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(referrer.status)}`}>
                      {referrer.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Payout Wallet</div>
                      <div className="font-mono text-sm">
                        {referrer.payout_wallet.slice(0, 6)}...{referrer.payout_wallet.slice(-4)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Applied</div>
                      <div className="text-sm">
                        {new Date(referrer.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  {referrer.socials && (
                    <div className="mb-4">
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">Social Media</div>
                      <div className="flex gap-3 text-sm">
                        {referrer.socials.twitter && (
                          <a
                            href={`https://twitter.com/${referrer.socials.twitter}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            @{referrer.socials.twitter}
                          </a>
                        )}
                        {referrer.socials.telegram && (
                          <span className="text-gray-600 dark:text-gray-400">
                            Telegram: @{referrer.socials.telegram}
                          </span>
                        )}
                        {referrer.socials.discord && (
                          <span className="text-gray-600 dark:text-gray-400">
                            Discord: {referrer.socials.discord}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {referrer.status === 'pending' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(referrer.id)}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                      >
                        ✓ Approve
                      </button>
                      <button
                        onClick={() => handleReject(referrer.id)}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                      >
                        ✗ Reject
                      </button>
                    </div>
                  )}

                  {referrer.approved_at && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      Approved on {new Date(referrer.approved_at).toLocaleDateString()}
                      {referrer.approved_by && ` by ${referrer.approved_by}`}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sales Management Tab */}
      {activeTab === 'sales' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Sales Management</h2>
            <button className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors">
              Create New Sale
            </button>
          </div>
          <div className="text-center py-12 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <p className="text-gray-500 dark:text-gray-400">Sales management coming soon</p>
          </div>
        </div>
      )}

      {/* Disputes Tab */}
      {activeTab === 'disputes' && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold">Disputes</h2>
          <div className="text-center py-12 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <p className="text-gray-500 dark:text-gray-400">No disputes at this time</p>
          </div>
        </div>
      )}
    </div>
  );
}
