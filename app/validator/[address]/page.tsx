'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, ExternalLink, TrendingUp, TrendingDown, Users, Zap, Shield, DollarSign, Activity, Calendar, AlertTriangle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

interface ValidatorProfile {
  voteAccount: string;
  name: string;
  commission: number;
  activatedStake: number;
  lastVote: number;
  rootSlot: number;
  credits: number;
  epochCredits: number;
  version: string;
  status: 'active' | 'delinquent' | 'inactive';
  datacenter?: string;
  country?: string;
  apy: number;
  performanceScore: number;
  uptimePercent: number;
  detailedStats: {
    epochHistory: Array<{
      epoch: number;
      credits: number;
      stake: number;
      apy: number;
      performance: number;
      date: string;
    }>;
    stakeHistory: Array<{
      timestamp: number;
      stake: number;
      date: string;
    }>;
    topStakers: Array<{
      delegatorAddress: string;
      stakedAmount: number;
      pnl: number;
      pnlPercent: number;
      stakingDuration: number;
      rewards: number;
    }>;
  };
  recommendations: {
    shouldStake: boolean;
    riskLevel: 'low' | 'medium' | 'high';
    reasons: string[];
    alternatives: string[];
  };
}

export default function ValidatorProfilePage() {
  const params = useParams();
  const router = useRouter();
  const [validatorData, setValidatorData] = useState<ValidatorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'performance' | 'stakers' | 'recommendations'>('overview');

  const validatorAddress = params.address as string;

  useEffect(() => {
    const fetchValidatorData = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/validator/${validatorAddress}`);
        const result = await response.json();
        
        if (result.success) {
          setValidatorData(result.data);
        } else {
          setError(result.error || 'Failed to fetch validator data');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Network error');
      } finally {
        setLoading(false);
      }
    };

    if (validatorAddress) {
      fetchValidatorData();
    }
  }, [validatorAddress]);

  const formatCurrency = (value: number) => {
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
    return `$${value.toFixed(2)}`;
  };

  const formatSOL = (lamports: number) => {
    const sol = lamports / 1e9;
    if (sol >= 1e6) return `${(sol / 1e6).toFixed(2)}M SOL`;
    if (sol >= 1e3) return `${(sol / 1e3).toFixed(2)}K SOL`;
    return `${sol.toFixed(2)} SOL`;
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  const handleStakeAction = (action: 'stake' | 'unstake') => {
    // This would integrate with wallet connection and staking functionality
    alert(`${action} functionality would be implemented here with wallet integration`);
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <span className="ml-4">Loading validator profile...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-500 mb-4">{error}</p>
            <button
              onClick={() => router.push('/analytics?tab=validators')}
              className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
            >
              Back to Validators
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!validatorData) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center h-64">
          <span>No validator data found</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => router.push('/analytics?tab=validators')}
          className="flex items-center text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Validators
        </button>
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center">
              {validatorData.name}
              <span className={`ml-3 px-2 py-1 text-xs rounded-full ${
                validatorData.status === 'active' 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {validatorData.status}
              </span>
            </h1>
            <p className="text-muted-foreground mt-2 flex items-center">
              <code className="bg-muted px-2 py-1 rounded text-sm mr-2">
                {validatorData.voteAccount}
              </code>
              <ExternalLink className="h-4 w-4 cursor-pointer" />
            </p>
          </div>
          
          <div className="flex space-x-3">
            <button
              onClick={() => handleStakeAction('stake')}
              className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium flex items-center"
            >
              <Zap className="h-4 w-4 mr-2" />
              Stake SOL
            </button>
            <button
              onClick={() => handleStakeAction('unstake')}
              className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium flex items-center"
            >
              <TrendingDown className="h-4 w-4 mr-2" />
              Unstake
            </button>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-background border rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Stake</p>
              <p className="text-2xl font-bold">{formatSOL(validatorData.activatedStake)}</p>
            </div>
            <DollarSign className="h-8 w-8 text-green-600" />
          </div>
        </div>
        
        <div className="bg-background border rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">APY</p>
              <p className="text-2xl font-bold">{formatPercent(validatorData.apy)}</p>
            </div>
            <TrendingUp className="h-8 w-8 text-blue-600" />
          </div>
        </div>
        
        <div className="bg-background border rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Commission</p>
              <p className="text-2xl font-bold">{formatPercent(validatorData.commission)}</p>
            </div>
            <Activity className="h-8 w-8 text-orange-600" />
          </div>
        </div>
        
        <div className="bg-background border rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Uptime</p>
              <p className="text-2xl font-bold">{formatPercent(validatorData.uptimePercent)}</p>
            </div>
            <Shield className="h-8 w-8 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="mb-8">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'performance', label: 'Performance History' },
              { id: 'stakers', label: 'Top Stakers' },
              { id: 'recommendations', label: 'Recommendations' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-background border rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">Validator Information</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Vote Account:</span>
                  <span className="font-mono text-sm">{validatorData.voteAccount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Version:</span>
                  <span>{validatorData.version}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Datacenter:</span>
                  <span>{validatorData.datacenter || 'Unknown'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Country:</span>
                  <span>{validatorData.country || 'Unknown'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last Vote:</span>
                  <span>{validatorData.lastVote}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Root Slot:</span>
                  <span>{validatorData.rootSlot}</span>
                </div>
              </div>
            </div>
            
            <div className="bg-background border rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">Performance Metrics</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Performance Score:</span>
                  <span className="font-medium">{formatPercent(validatorData.performanceScore * 100)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Epoch Credits:</span>
                  <span className="font-medium">{validatorData.epochCredits.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Credits:</span>
                  <span className="font-medium">{validatorData.credits.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Uptime:</span>
                  <span className="font-medium">{formatPercent(validatorData.uptimePercent)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'performance' && (
          <div className="space-y-6">
            <div className="bg-background border rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">Stake History</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={validatorData.detailedStats.stakeHistory}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="stake" stroke="#8884d8" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            
            <div className="bg-background border rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">Epoch Performance</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={validatorData.detailedStats.epochHistory}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="epoch" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="performance" fill="#82ca9d" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {activeTab === 'stakers' && (
          <div className="bg-background border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Top 100 Stakers</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">Rank</th>
                    <th className="text-left py-3 px-4">Delegator</th>
                    <th className="text-left py-3 px-4">Staked Amount</th>
                    <th className="text-left py-3 px-4">PnL</th>
                    <th className="text-left py-3 px-4">PnL %</th>
                    <th className="text-left py-3 px-4">Duration</th>
                    <th className="text-left py-3 px-4">Rewards</th>
                  </tr>
                </thead>
                <tbody>
                  {validatorData.detailedStats.topStakers.map((staker, index) => (
                    <tr key={staker.delegatorAddress} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-4">{index + 1}</td>
                      <td className="py-3 px-4">
                        <code className="text-sm">{staker.delegatorAddress.slice(0, 8)}...{staker.delegatorAddress.slice(-4)}</code>
                      </td>
                      <td className="py-3 px-4">{formatSOL(staker.stakedAmount)}</td>
                      <td className={`py-3 px-4 ${staker.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {staker.pnl >= 0 ? '+' : ''}{formatSOL(staker.pnl)}
                      </td>
                      <td className={`py-3 px-4 ${staker.pnlPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {staker.pnlPercent >= 0 ? '+' : ''}{formatPercent(staker.pnlPercent)}
                      </td>
                      <td className="py-3 px-4">{staker.stakingDuration} days</td>
                      <td className="py-3 px-4">{formatSOL(staker.rewards)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'recommendations' && (
          <div className="space-y-6">
            <div className="bg-background border rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">Staking Recommendation</h3>
              <div className={`p-4 rounded-lg mb-4 ${
                validatorData.recommendations.shouldStake 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-red-50 border-red-200'
              }`}>
                <div className="flex items-center mb-2">
                  {validatorData.recommendations.shouldStake ? (
                    <Shield className="h-5 w-5 text-green-600 mr-2" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
                  )}
                  <span className="font-medium">
                    {validatorData.recommendations.shouldStake ? 'Recommended' : 'Not Recommended'}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Risk Level: <span className="font-medium">{validatorData.recommendations.riskLevel}</span>
                </p>
              </div>
              
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Reasons:</h4>
                  <ul className="space-y-1">
                    {validatorData.recommendations.reasons.map((reason, index) => (
                      <li key={index} className="text-sm text-muted-foreground flex items-start">
                        <span className="mr-2">•</span>
                        {reason}
                      </li>
                    ))}
                  </ul>
                </div>
                
                {validatorData.recommendations.alternatives.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Alternative Validators:</h4>
                    <ul className="space-y-1">
                      {validatorData.recommendations.alternatives.map((alt, index) => (
                        <li key={index} className="text-sm text-muted-foreground flex items-start">
                          <span className="mr-2">•</span>
                          {alt}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}