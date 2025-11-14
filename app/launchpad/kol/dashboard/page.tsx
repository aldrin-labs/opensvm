'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { KOLAllocation, ReferralLink, Contribution } from '@/types/launchpad';

export default function KOLDashboardPage() {
  const searchParams = useSearchParams();
  const kolId = searchParams?.get('id') || '';
  
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [showLinkGenerator, setShowLinkGenerator] = useState(false);
  const [newLinkName, setNewLinkName] = useState('');

  useEffect(() => {
    if (kolId) {
      fetchDashboard();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kolId]);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/launchpad/kol/${kolId}`);
      const data = await response.json();
      if (data.success) {
        setDashboardData(data.data);
      }
    } catch (error) {
      console.error('Error fetching dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateReferralLink = async () => {
    if (!newLinkName || !dashboardData?.referrer) return;
    
    try {
      const response = await fetch(`/api/launchpad/sales/${dashboardData.allocations[0]?.sale_id}/referral-links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kol_id: kolId,
          campaign_name: newLinkName,
        }),
      });
      
      if (response.ok) {
        alert('Referral link created!');
        setNewLinkName('');
        setShowLinkGenerator(false);
        fetchDashboard();
      }
    } catch (error) {
      console.error('Error creating link:', error);
    }
  };

  if (!kolId) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold mb-2">KOL ID Required</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Please provide your KOL ID in the URL: /launchpad/kol/dashboard?id=YOUR_ID
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!dashboardData || !dashboardData.referrer) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold mb-2">KOL Not Found</h2>
          <p className="text-gray-600 dark:text-gray-400">
            No KOL found with the provided ID or your application is still pending.
          </p>
        </div>
      </div>
    );
  }

  const { referrer, allocations = [], referral_links = [], contributions = [] } = dashboardData;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">KOL Dashboard</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Welcome back, {referrer.display_name}
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Referrals</div>
          <div className="text-3xl font-bold">{contributions.length}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Pending Tokens</div>
          <div className="text-3xl font-bold">
            {allocations.reduce((sum: number, a: any) => sum + (a.allocated_tokens - a.distributed_tokens), 0).toLocaleString()}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Claimable Tokens</div>
          <div className="text-3xl font-bold text-green-600">
            {allocations.reduce((sum: number, a: any) => sum + (a.allocated_tokens - a.vested_tokens - a.distributed_tokens), 0).toLocaleString()}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Active Links</div>
          <div className="text-3xl font-bold">{referral_links.filter((l: any) => l.status === 'active').length}</div>
        </div>
      </div>

      {/* Referral Links */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Referral Links</h2>
          <button
            onClick={() => setShowLinkGenerator(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            + Create Link
          </button>
        </div>

        {referral_links.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-400 text-center py-8">
            No referral links yet. Create your first link to start earning rewards!
          </p>
        ) : (
          <div className="space-y-3">
            {referral_links.map((link: any) => (
              <div key={link.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-bold">{link.campaign_name}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Code: <span className="font-mono">{link.code}</span></div>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs ${
                    link.status === 'active' ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                  }`}>
                    {link.status}
                  </span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={link.url}
                    readOnly
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-700 text-sm"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(link.url);
                      alert('Link copied!');
                    }}
                    className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded transition-colors text-sm"
                  >
                    Copy
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Allocations */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 mb-8">
        <h2 className="text-2xl font-bold mb-4">Token Allocations</h2>
        {allocations.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-400 text-center py-8">
            No token allocations yet. Start referring users to earn rewards!
          </p>
        ) : (
          <div className="space-y-4">
            {allocations.map((allocation: any) => (
              <div key={allocation.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <div className="font-bold">Sale: {allocation.sale_id.substring(0, 8)}...</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Updated: {new Date(allocation.updated_at).toLocaleDateString()}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-gray-600 dark:text-gray-400">Allocated</div>
                    <div className="font-bold">{allocation.allocated_tokens.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-gray-600 dark:text-gray-400">Distributed</div>
                    <div className="font-bold">{allocation.distributed_tokens.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-gray-600 dark:text-gray-400">Vested</div>
                    <div className="font-bold">{allocation.vested_tokens.toLocaleString()}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Contributions */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-4">Recent Referrals</h2>
        {contributions.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-400 text-center py-8">
            No contributions yet. Share your referral links to start earning!
          </p>
        ) : (
          <div className="space-y-2">
            {contributions.slice(0, 10).map((contrib: any) => (
              <div key={contrib.contrib_id} className="flex justify-between items-center border-b border-gray-200 dark:border-gray-700 pb-2">
                <div>
                  <div className="font-mono text-sm">{contrib.contrib_id.substring(0, 12)}...</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    {new Date(contrib.created_at).toLocaleString()}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold">{(contrib.amount_lamports / 1_000_000_000).toFixed(2)} SOL</div>
                  <div className={`text-xs ${
                    contrib.status === 'confirmed' ? 'text-green-600' : 
                    contrib.status === 'pending' ? 'text-yellow-600' : 'text-gray-600'
                  }`}>
                    {contrib.status}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Link Generator Modal */}
      {showLinkGenerator && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Create Referral Link</h3>
              <button
                onClick={() => {
                  setShowLinkGenerator(false);
                  setNewLinkName('');
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                ✗
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Campaign Name</label>
                <input
                  type="text"
                  value={newLinkName}
                  onChange={(e) => setNewLinkName(e.target.value)}
                  placeholder="e.g., Twitter Campaign"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                />
              </div>
              
              <button
                onClick={generateReferralLink}
                disabled={!newLinkName}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Generate Link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
