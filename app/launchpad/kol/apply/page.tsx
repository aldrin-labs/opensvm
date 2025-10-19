'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function KOLApplicationPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    display_name: '',
    payout_wallet: '',
    email: '',
    twitter: '',
    telegram: '',
    discord: '',
    bio: '',
    audience_size: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/launchpad/kol/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: formData.display_name,
          payout_wallet: formData.payout_wallet,
          email: formData.email,
          socials: {
            twitter: formData.twitter || undefined,
            telegram: formData.telegram || undefined,
            discord: formData.discord || undefined,
          },
          bio: formData.bio || undefined,
          audience_size: formData.audience_size ? parseInt(formData.audience_size) : undefined,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || 'Failed to submit application');
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/launchpad');
      }, 3000);
    } catch (err) {
      setError('Failed to submit application');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  if (success) {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-md mx-auto text-center">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-3xl font-bold mb-4">Application Submitted!</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Thank you for applying to become a KOL. We'll review your application and get back to you via email.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Redirecting to launchpad...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-4">Apply as a KOL</h1>
          <p className="text-gray-600 dark:text-gray-400 text-lg">
            Earn tokens by referring contributors and generating trading volume for token launches
          </p>
        </div>

        {/* Benefits Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
            <div className="text-2xl mb-2">💰</div>
            <h3 className="font-bold mb-1">Contribution Rewards</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Earn a share of tokens based on contributions from your referrals
            </p>
          </div>
          <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
            <div className="text-2xl mb-2">📊</div>
            <h3 className="font-bold mb-1">Volume Rewards</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Get daily rewards based on trading volume from your referred users
            </p>
          </div>
          <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
            <div className="text-2xl mb-2">📈</div>
            <h3 className="font-bold mb-1">Dashboard & Analytics</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Track your performance with detailed analytics and reports
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Basic Information</h2>
            
            <div>
              <label className="block text-sm font-medium mb-2">
                Display Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="display_name"
                value={formData.display_name}
                onChange={handleChange}
                placeholder="Your public display name"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Email Address <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="your@email.com"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Solana Wallet Address (Payout) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="payout_wallet"
                value={formData.payout_wallet}
                onChange={handleChange}
                placeholder="Your Solana wallet address for payouts"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                required
              />
            </div>
          </div>

          {/* Social Media */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Social Media</h2>
            
            <div>
              <label className="block text-sm font-medium mb-2">
                Twitter/X Handle
              </label>
              <div className="flex">
                <span className="inline-flex items-center px-3 border border-r-0 border-gray-300 dark:border-gray-600 rounded-l-lg bg-gray-50 dark:bg-gray-700 text-gray-500">
                  @
                </span>
                <input
                  type="text"
                  name="twitter"
                  value={formData.twitter}
                  onChange={handleChange}
                  placeholder="username"
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-r-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Telegram Username
              </label>
              <div className="flex">
                <span className="inline-flex items-center px-3 border border-r-0 border-gray-300 dark:border-gray-600 rounded-l-lg bg-gray-50 dark:bg-gray-700 text-gray-500">
                  @
                </span>
                <input
                  type="text"
                  name="telegram"
                  value={formData.telegram}
                  onChange={handleChange}
                  placeholder="username"
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-r-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Discord Username
              </label>
              <input
                type="text"
                name="discord"
                value={formData.discord}
                onChange={handleChange}
                placeholder="username#1234"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Additional Info */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Additional Information</h2>
            
            <div>
              <label className="block text-sm font-medium mb-2">
                Audience Size (Approximate)
              </label>
              <input
                type="number"
                name="audience_size"
                value={formData.audience_size}
                onChange={handleChange}
                placeholder="Total followers/subscribers across platforms"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Bio / About You
              </label>
              <textarea
                name="bio"
                value={formData.bio}
                onChange={handleChange}
                placeholder="Tell us about yourself and why you'd like to become a KOL..."
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Terms */}
          <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg text-sm text-gray-600 dark:text-gray-400">
            By submitting this application, you agree to:
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Follow the platform's KOL guidelines and code of conduct</li>
              <li>Provide accurate information and maintain updated contact details</li>
              <li>Comply with all applicable laws and regulations</li>
              <li>Not engage in fraudulent or manipulative activities</li>
            </ul>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-3 px-6 rounded-lg transition-colors"
          >
            {loading ? 'Submitting...' : 'Submit Application'}
          </button>
        </form>
      </div>
    </div>
  );
}
