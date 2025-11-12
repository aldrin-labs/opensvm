'use client';

import { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import type { ApiKey, ApiKeyMetrics, ApiKeyActivity } from '@/lib/api-auth/types';

export default function ApiKeysProfilePage() {
  const { publicKey, signMessage } = useWallet();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<ApiKeyMetrics | null>(null);
  const [activity, setActivity] = useState<ApiKeyActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  // Fetch user's API keys
  useEffect(() => {
    if (publicKey) {
      fetchApiKeys();
    }
  }, [publicKey]);

  // Fetch metrics and activity when a key is selected
  useEffect(() => {
    if (selectedKey) {
      fetchMetrics(selectedKey);
      fetchActivity(selectedKey);
    }
  }, [selectedKey]);

  const fetchApiKeys = async () => {
    if (!publicKey || !signMessage) return;
    
    try {
      setLoading(true);
      
      // Create and sign authentication message
      const message = `Authenticate to view API keys\nWallet: ${publicKey.toString()}\nTimestamp: ${Date.now()}`;
      const messageBytes = new TextEncoder().encode(message);
      const signature = await signMessage(messageBytes);
      const signatureBase64 = Buffer.from(signature).toString('base64');
      
      // Build URL with authentication parameters
      const url = new URL('/api/auth/api-keys/list', window.location.origin);
      url.searchParams.set('walletAddress', publicKey.toString());
      url.searchParams.set('signature', signatureBase64);
      url.searchParams.set('message', message);
      
      const response = await fetch(url.toString());
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch API keys');
      }
      
      setApiKeys(data.apiKeys);
      if (data.apiKeys.length > 0 && !selectedKey) {
        setSelectedKey(data.apiKeys[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch API keys');
    } finally {
      setLoading(false);
    }
  };

  const fetchMetrics = async (apiKeyId: string) => {
    if (!publicKey || !signMessage) return;
    
    try {
      // Create and sign authentication message
      const message = `Authenticate to view API key metrics\nWallet: ${publicKey.toString()}\nTimestamp: ${Date.now()}`;
      const messageBytes = new TextEncoder().encode(message);
      const signature = await signMessage(messageBytes);
      const signatureBase64 = Buffer.from(signature).toString('base64');
      
      // Build URL with authentication parameters
      const url = new URL('/api/auth/api-keys/metrics', window.location.origin);
      url.searchParams.set('apiKeyId', apiKeyId);
      url.searchParams.set('walletAddress', publicKey.toString());
      url.searchParams.set('signature', signatureBase64);
      url.searchParams.set('message', message);
      
      const response = await fetch(url.toString());
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch metrics');
      }
      
      setMetrics(data);
    } catch (err) {
      console.error('Error fetching metrics:', err);
    }
  };

  const fetchActivity = async (apiKeyId: string) => {
    if (!publicKey || !signMessage) return;
    
    try {
      // Create and sign authentication message
      const message = `Authenticate to view API key activity\nWallet: ${publicKey.toString()}\nTimestamp: ${Date.now()}`;
      const messageBytes = new TextEncoder().encode(message);
      const signature = await signMessage(messageBytes);
      const signatureBase64 = Buffer.from(signature).toString('base64');
      
      // Build URL with authentication parameters
      const url = new URL('/api/auth/api-keys/activity', window.location.origin);
      url.searchParams.set('apiKeyId', apiKeyId);
      url.searchParams.set('limit', '50');
      url.searchParams.set('walletAddress', publicKey.toString());
      url.searchParams.set('signature', signatureBase64);
      url.searchParams.set('message', message);
      
      const response = await fetch(url.toString());
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch activity');
      }
      
      setActivity(data.activities);
    } catch (err) {
      console.error('Error fetching activity:', err);
    }
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleString();
  };

  const formatResponseTime = (ms: number) => {
    return `${ms.toFixed(0)}ms`;
  };

  if (!publicKey) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-gray-800 rounded-lg shadow-xl p-8 border border-gray-700 text-center">
          <h1 className="text-2xl font-bold text-white mb-4">API Keys Profile</h1>
          <p className="text-gray-400 mb-6">Connect your wallet to view your API keys and activity</p>
          <WalletMultiButton className="!bg-blue-600 hover:!bg-blue-700" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">API Keys Dashboard</h1>
            <p className="text-gray-400">Manage and monitor your API keys</p>
          </div>
          <WalletMultiButton className="!bg-blue-600 hover:!bg-blue-700" />
        </div>

        {error && (
          <div className="bg-red-900/20 border border-red-500 rounded-lg p-4 mb-6">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
            <p className="text-gray-400 mt-4">Loading API keys...</p>
          </div>
        ) : apiKeys.length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-8 text-center border border-gray-700">
            <p className="text-gray-400 mb-4">No API keys found</p>
            <p className="text-gray-500 text-sm">Create an API key using the CLI or API</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* API Keys List */}
            <div className="lg:col-span-1">
              <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                <div className="p-4 border-b border-gray-700">
                  <h2 className="text-lg font-semibold text-white">Your API Keys</h2>
                </div>
                <div className="divide-y divide-gray-700 max-h-[600px] overflow-y-auto">
                  {apiKeys.map((key) => (
                    <button
                      key={key.id}
                      onClick={() => setSelectedKey(key.id)}
                      className={`w-full text-left p-4 hover:bg-gray-700/50 transition-colors ${
                        selectedKey === key.id ? 'bg-gray-700/50 border-l-4 border-blue-500' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-medium text-white truncate flex-1 min-w-0">{key.name}</h3>
                        <span
                          className={`ml-2 px-2 py-1 text-xs rounded flex-shrink-0 ${
                            key.status === 'active'
                              ? 'bg-green-900/30 text-green-400'
                              : key.status === 'pending'
                              ? 'bg-yellow-900/30 text-yellow-400'
                              : 'bg-red-900/30 text-red-400'
                          }`}
                        >
                          {key.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400">
                        Created: {formatDate(key.createdAt)}
                      </p>
                      {key.lastUsedAt && (
                        <p className="text-xs text-gray-500 mt-1">
                          Last used: {formatDate(key.lastUsedAt)}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Metrics and Activity */}
            <div className="lg:col-span-2 space-y-6">
              {/* Metrics */}
              {metrics && (
                <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                  <h2 className="text-xl font-semibold text-white mb-6">Metrics</h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-gray-700/50 rounded-lg p-4">
                      <p className="text-gray-400 text-sm mb-1">Total Requests</p>
                      <p className="text-2xl font-bold text-white">{metrics.totalRequests}</p>
                    </div>
                    <div className="bg-green-900/20 rounded-lg p-4">
                      <p className="text-gray-400 text-sm mb-1">Successful</p>
                      <p className="text-2xl font-bold text-green-400">{metrics.successfulRequests}</p>
                    </div>
                    <div className="bg-red-900/20 rounded-lg p-4">
                      <p className="text-gray-400 text-sm mb-1">Failed</p>
                      <p className="text-2xl font-bold text-red-400">{metrics.failedRequests}</p>
                    </div>
                    <div className="bg-blue-900/20 rounded-lg p-4">
                      <p className="text-gray-400 text-sm mb-1">Avg Response</p>
                      <p className="text-2xl font-bold text-blue-400">
                        {formatResponseTime(metrics.averageResponseTime)}
                      </p>
                    </div>
                  </div>

                  {/* Top Endpoints */}
                  {Object.keys(metrics.requestsByEndpoint).length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-lg font-medium text-white mb-3">Top Endpoints</h3>
                      <div className="space-y-2">
                        {Object.entries(metrics.requestsByEndpoint)
                          .sort(([, a], [, b]) => b - a)
                          .slice(0, 5)
                          .map(([endpoint, count]) => (
                            <div key={endpoint} className="flex items-center justify-between bg-gray-700/30 rounded p-3">
                              <span className="text-gray-300 text-sm font-mono truncate flex-1 min-w-0">{endpoint}</span>
                              <span className="text-white font-semibold ml-4 flex-shrink-0">{count}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Activity Log */}
              <div className="bg-gray-800 rounded-lg border border-gray-700">
                <div className="p-4 border-b border-gray-700">
                  <h2 className="text-xl font-semibold text-white">Recent Activity</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-700/50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Time</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Endpoint</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Method</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Response Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {activity.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                            No activity recorded yet
                          </td>
                        </tr>
                      ) : (
                        activity.map((log) => (
                          <tr key={log.id} className="hover:bg-gray-700/30">
                            <td className="px-4 py-3 text-sm text-gray-300 whitespace-nowrap">
                              {formatDate(log.timestamp)}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-300 font-mono truncate max-w-xs">
                              {log.endpoint}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <span className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs font-medium">
                                {log.method}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <span
                                className={`px-2 py-1 rounded text-xs font-medium ${
                                  log.statusCode >= 200 && log.statusCode < 300
                                    ? 'bg-green-900/30 text-green-400'
                                    : log.statusCode >= 400
                                    ? 'bg-red-900/30 text-red-400'
                                    : 'bg-yellow-900/30 text-yellow-400'
                                }`}
                              >
                                {log.statusCode}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-300 whitespace-nowrap">
                              {formatResponseTime(log.responseTime)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
