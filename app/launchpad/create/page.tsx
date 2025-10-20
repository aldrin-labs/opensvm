'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function CreateLaunchpadPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    // Token Information
    name: '',
    token_symbol: '',
    description: '',
    total_supply: '',
    token_price_sol: '',
    
    // Sale Configuration
    target_raise_sol: '',
    min_contribution_sol: '',
    max_contribution_sol: '',
    start_date: '',
    end_date: '',
    
    // Distribution Settings
    liquidity_pool_percent: '50',
    dao_lock_percent: '25',
    vested_percent: '25',
    vesting_duration_days: '90',
    cliff_period_days: '30',
    
    // KOL Rewards
    kol_contribution_percent: '5',
    kol_volume_percent: '3',
    volume_reward_days: '30',
    
    // Airdrop
    airdrop_percent: '1',
    airdrop_snapsh holders: '100',
    
    // Creator Info
    creator_wallet: '',
    project_website: '',
    project_twitter: '',
    project_telegram: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Convert SOL amounts to lamports
      const saleData = {
        name: formData.name,
        token_symbol: formData.token_symbol,
        description: formData.description,
        total_supply: parseFloat(formData.total_supply) * 1_000_000, // Convert to base units
        token_price_lamports: Math.floor(parseFloat(formData.token_price_sol) * 1_000_000_000),
        target_raise_lamports: Math.floor(parseFloat(formData.target_raise_sol) * 1_000_000_000),
        min_contribution_lamports: Math.floor(parseFloat(formData.min_contribution_sol) * 1_000_000_000),
        max_contribution_lamports: Math.floor(parseFloat(formData.max_contribution_sol) * 1_000_000_000),
        start_date: new Date(formData.start_date).toISOString(),
        end_date: new Date(formData.end_date).toISOString(),
        
        // Distribution
        liquidity_pool_percent: parseFloat(formData.liquidity_pool_percent),
        dao_lock_percent: parseFloat(formData.dao_lock_percent),
        vested_percent: parseFloat(formData.vested_percent),
        vesting_duration_days: parseInt(formData.vesting_duration_days),
        cliff_period_days: parseInt(formData.cliff_period_days),
        
        // KOL Rewards
        kol_contribution_percent: parseFloat(formData.kol_contribution_percent),
        kol_volume_percent: parseFloat(formData.kol_volume_percent),
        volume_reward_days: parseInt(formData.volume_reward_days),
        
        // Airdrop
        airdrop_percent: parseFloat(formData.airdrop_percent),
        airdrop_snapshot_holders: parseInt(formData.airdrop_snapshot_holders),
        
        // Creator Info
        creator_wallet: formData.creator_wallet,
        project_website: formData.project_website,
        project_twitter: formData.project_twitter,
        project_telegram: formData.project_telegram,
        
        status: 'upcoming',
        current_raise_lamports: 0,
      };

      const response = await fetch('/api/launchpad/sales', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(saleData),
      });

      const result = await response.json();

      if (result.success) {
        // Redirect to the created sale page
        router.push(`/launchpad/sale/${result.data.id}`);
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      console.error('Error creating sale:', error);
      alert('Failed to create sale. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4">Launch Your ICO</h1>
        <p className="text-gray-600 dark:text-gray-400 text-lg">
          Create a permissionless token sale on Solana with transparent vesting and KOL rewards
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Token Information */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md">
          <h2 className="text-2xl font-bold mb-4">Token Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Token Name *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                placeholder="e.g., Solana Protocol Token"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Token Symbol *</label>
              <input
                type="text"
                name="token_symbol"
                value={formData.token_symbol}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                placeholder="e.g., SPT"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2">Description *</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                required
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                placeholder="Describe your project and tokenomics..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Total Supply (millions) *</label>
              <input
                type="number"
                name="total_supply"
                value={formData.total_supply}
                onChange={handleChange}
                required
                min="0"
                step="0.000001"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                placeholder="e.g., 100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Token Price (SOL) *</label>
              <input
                type="number"
                name="token_price_sol"
                value={formData.token_price_sol}
                onChange={handleChange}
                required
                min="0"
                step="0.000001"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                placeholder="e.g., 0.001"
              />
            </div>
          </div>
        </div>

        {/* Sale Configuration */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md">
          <h2 className="text-2xl font-bold mb-4">Sale Configuration</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Target Raise (SOL) *</label>
              <input
                type="number"
                name="target_raise_sol"
                value={formData.target_raise_sol}
                onChange={handleChange}
                required
                min="0"
                step="0.1"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                placeholder="e.g., 10000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Min Contribution (SOL) *</label>
              <input
                type="number"
                name="min_contribution_sol"
                value={formData.min_contribution_sol}
                onChange={handleChange}
                required
                min="0"
                step="0.1"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                placeholder="e.g., 0.1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Max Contribution (SOL) *</label>
              <input
                type="number"
                name="max_contribution_sol"
                value={formData.max_contribution_sol}
                onChange={handleChange}
                required
                min="0"
                step="0.1"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                placeholder="e.g., 100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Start Date *</label>
              <input
                type="datetime-local"
                name="start_date"
                value={formData.start_date}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">End Date *</label>
              <input
                type="datetime-local"
                name="end_date"
                value={formData.end_date}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>
        </div>

        {/* Distribution & Vesting */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md">
          <h2 className="text-2xl font-bold mb-4">Distribution & Vesting</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Liquidity Pool (%)</label>
              <input
                type="number"
                name="liquidity_pool_percent"
                value={formData.liquidity_pool_percent}
                onChange={handleChange}
                min="0"
                max="100"
                step="0.1"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">DAO Lock (%)</label>
              <input
                type="number"
                name="dao_lock_percent"
                value={formData.dao_lock_percent}
                onChange={handleChange}
                min="0"
                max="100"
                step="0.1"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Vested (%)</label>
              <input
                type="number"
                name="vested_percent"
                value={formData.vested_percent}
                onChange={handleChange}
                min="0"
                max="100"
                step="0.1"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Vesting Duration (days)</label>
              <input
                type="number"
                name="vesting_duration_days"
                value={formData.vesting_duration_days}
                onChange={handleChange}
                min="0"
                step="1"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Cliff Period (days)</label>
              <input
                type="number"
                name="cliff_period_days"
                value={formData.cliff_period_days}
                onChange={handleChange}
                min="0"
                step="1"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>
        </div>

        {/* KOL Rewards */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md">
          <h2 className="text-2xl font-bold mb-4">KOL Reward Pool</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Contribution Rewards (%)</label>
              <input
                type="number"
                name="kol_contribution_percent"
                value={formData.kol_contribution_percent}
                onChange={handleChange}
                min="0"
                max="100"
                step="0.1"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Volume Rewards (%)</label>
              <input
                type="number"
                name="kol_volume_percent"
                value={formData.kol_volume_percent}
                onChange={handleChange}
                min="0"
                max="100"
                step="0.1"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Volume Reward Period (days)</label>
              <input
                type="number"
                name="volume_reward_days"
                value={formData.volume_reward_days}
                onChange={handleChange}
                min="0"
                step="1"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>
        </div>

        {/* Airdrop */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md">
          <h2 className="text-2xl font-bold mb-4">Airdrop Settings</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Airdrop Allocation (%)</label>
              <input
                type="number"
                name="airdrop_percent"
                value={formData.airdrop_percent}
                onChange={handleChange}
                min="0"
                max="100"
                step="0.1"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Top SVMAI Holders</label>
              <input
                type="number"
                name="airdrop_snapshot_holders"
                value={formData.airdrop_snapshot_holders}
                onChange={handleChange}
                min="0"
                step="1"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>
        </div>

        {/* Project Details */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md">
          <h2 className="text-2xl font-bold mb-4">Project Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2">Creator Wallet Address *</label>
              <input
                type="text"
                name="creator_wallet"
                value={formData.creator_wallet}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono"
                placeholder="Solana wallet address"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Website</label>
              <input
                type="url"
                name="project_website"
                value={formData.project_website}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                placeholder="https://yourproject.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Twitter</label>
              <input
                type="url"
                name="project_twitter"
                value={formData.project_twitter}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                placeholder="https://twitter.com/yourproject"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Telegram</label>
              <input
                type="url"
                name="project_telegram"
                value={formData.project_telegram}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                placeholder="https://t.me/yourproject"
              />
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex gap-4">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            {loading ? 'Creating Sale...' : 'Create ICO Launch'}
          </button>
          <button
            type="button"
            onClick={() => router.push('/launchpad')}
            className="px-6 py-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
        </div>

        {/* Info Note */}
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            <strong>Note:</strong> Your ICO will be created instantly without admin approval. 
            All token distributions follow the configured vesting schedules. KOLs can start generating referral links immediately after approval.
          </p>
        </div>
      </form>
    </div>
  );
}
