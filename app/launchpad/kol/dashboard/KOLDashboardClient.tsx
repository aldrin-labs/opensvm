'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { KOLAllocation, ReferralLink, Contribution } from '@/types/launchpad';

export default function KOLDashboardClient() {
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
      
      const data = await response.json();
      if (data.success) {
        setDashboardData({
          ...dashboardData,
          referralLinks: [...(dashboardData.referralLinks || []), data.data],
        });
        setNewLinkName('');
        setShowLinkGenerator(false);
      }
    } catch (error) {
      console.error('Error generating link:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-white">Loading dashboard...</div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-white">No dashboard data found</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">KOL Dashboard</h1>
      
      {/* Referrer Info */}
      <div className="mb-6 p-4 bg-neutral-900 rounded-lg">
        <h2 className="text-xl mb-2">Referrer Info</h2>
        <p>Name: {dashboardData.referrer?.name}</p>
        <p>Code: {dashboardData.referrer?.code}</p>
        <p>Tier: {dashboardData.referrer?.tier}</p>
      </div>

      {/* Allocations */}
      <div className="mb-6">
        <h2 className="text-xl mb-4">Allocations</h2>
        <div className="space-y-4">
          {dashboardData.allocations?.map((allocation: KOLAllocation) => (
            <div key={allocation.id} className="p-4 bg-neutral-900 rounded-lg">
              <p>Sale: {allocation.sale_id}</p>
              <p>Allocation: {allocation.allocation_amount} {allocation.sale_token_symbol}</p>
              <p>Commission: {allocation.commission_rate}%</p>
            </div>
          ))}
        </div>
      </div>

      {/* Referral Links */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl">Referral Links</h2>
          <button
            onClick={() => setShowLinkGenerator(!showLinkGenerator)}
            className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700"
          >
            Generate New Link
          </button>
        </div>

        {showLinkGenerator && (
          <div className="mb-4 p-4 bg-neutral-800 rounded-lg">
            <input
              type="text"
              value={newLinkName}
              onChange={(e) => setNewLinkName(e.target.value)}
              placeholder="Campaign name"
              className="w-full px-3 py-2 bg-neutral-900 rounded mb-2"
            />
            <button
              onClick={generateReferralLink}
              className="px-4 py-2 bg-green-600 rounded hover:bg-green-700"
            >
              Generate
            </button>
          </div>
        )}

        <div className="space-y-4">
          {dashboardData.referralLinks?.map((link: ReferralLink) => (
            <div key={link.id} className="p-4 bg-neutral-900 rounded-lg">
              <p>Campaign: {link.campaign_name}</p>
              <p>Code: {link.code}</p>
              <p>Clicks: {link.total_clicks}</p>
              <p>Conversions: {link.total_conversions}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Contributions */}
      <div>
        <h2 className="text-xl mb-4">Referred Contributions</h2>
        <div className="space-y-4">
          {dashboardData.contributions?.map((contrib: Contribution) => (
            <div key={contrib.id} className="p-4 bg-neutral-900 rounded-lg">
              <p>Amount: {contrib.contribution_amount}</p>
              <p>Status: {contrib.status}</p>
              <p>Commission: {contrib.commission_amount || 0}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
