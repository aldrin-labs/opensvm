'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, ExternalLink, TrendingUp, Shield, DollarSign, Activity, AlertTriangle, Search, ChevronUp, ChevronDown } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { ShareButton } from '@/components/ShareButton';
import { ValidatorStaking } from '@/components/solana/validator-staking';

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

  // Stakers tab state
  const [stakersPage, setStakersPage] = useState(1);
  const [stakersPerPage, setStakersPerPage] = useState(25);
  const [stakersSearch, setStakersSearch] = useState('');
  const [stakersSortBy, setStakersSortBy] = useState<'rank' | 'amount' | 'pnl' | 'pnlPercent' | 'duration' | 'rewards'>('amount');
  const [stakersSortOrder, setStakersSortOrder] = useState<'asc' | 'desc'>('desc');

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

  const formatSOL = (lamports: number) => {
    const sol = lamports / 1e9;
    if (sol >= 1e6) return `${(sol / 1e6).toFixed(2)}M SOL`;
    if (sol >= 1e3) return `${(sol / 1e3).toFixed(2)}K SOL`;
    return `${sol.toFixed(2)} SOL`;
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  // Helper functions for stakers tab
  const handleStakersSort = (column: typeof stakersSortBy) => {
    if (stakersSortBy === column) {
      setStakersSortOrder(stakersSortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setStakersSortBy(column);
      setStakersSortOrder('desc');
    }
    setStakersPage(1); // Reset to first page when sorting
  };

  const getFilteredAndSortedStakers = () => {
    if (!validatorData?.detailedStats.topStakers) return [];

    let stakers = [...validatorData.detailedStats.topStakers];

    // Filter by search term
    if (stakersSearch.trim()) {
      const searchTerm = stakersSearch.toLowerCase();
      stakers = stakers.filter(staker =>
        staker.delegatorAddress.toLowerCase().includes(searchTerm)
      );
    }

    // Sort stakers
    stakers.sort((a, b) => {
      let aValue: number;
      let bValue: number;

      switch (stakersSortBy) {
        case 'amount':
          aValue = a.stakedAmount;
          bValue = b.stakedAmount;
          break;
        case 'pnl':
          aValue = a.pnl;
          bValue = b.pnl;
          break;
        case 'pnlPercent':
          aValue = a.pnlPercent;
          bValue = b.pnlPercent;
          break;
        case 'duration':
          aValue = a.stakingDuration;
          bValue = b.stakingDuration;
          break;
        case 'rewards':
          aValue = a.rewards;
          bValue = b.rewards;
          break;
        default: // rank
          aValue = stakers.indexOf(a);
          bValue = stakers.indexOf(b);
          break;
      }

      return stakersSortOrder === 'asc' ? aValue - bValue : bValue - aValue;
    });

    return stakers;
  };

  const filteredStakers = getFilteredAndSortedStakers();
  const totalStakers = filteredStakers.length;
  const totalPages = Math.ceil(totalStakers / stakersPerPage);
  const paginatedStakers = filteredStakers.slice(
    (stakersPage - 1) * stakersPerPage,
    stakersPage * stakersPerPage
  );

  const handleAddressClick = (address: string) => {
    router.push(`/account/${address}`);
  };

  const getSortIcon = (column: typeof stakersSortBy) => {
    if (stakersSortBy !== column) return null;
    return stakersSortOrder === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />;
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
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-bold flex items-center">
                {validatorData.name}
                <span className={`ml-3 px-2 py-1 text-xs rounded-full ${validatorData.status === 'active'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
                  }`}>
                  {validatorData.status}
                </span>
              </h1>
              <ShareButton entityType="validator" entityId={validatorData.voteAccount} />
            </div>
            <p className="text-muted-foreground mt-2 flex items-center">
              <code className="bg-muted px-2 py-1 rounded text-sm mr-2">
                {validatorData.voteAccount}
              </code>
              <ExternalLink className="h-4 w-4 cursor-pointer" />
            </p>
          </div>

          <ValidatorStaking
            validatorVoteAccount={validatorData.voteAccount}
            validatorName={validatorData.name}
            commission={validatorData.commission}
            apy={validatorData.apy}
          />
        </div>
      </div>

      {/* SVMAI Requirement Info */}
      <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <div className="flex items-start">
          <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-3 mt-0.5" />
          <div>
            <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
              Staking Requirements
            </h3>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              To stake or unstake SOL with validators, you must hold at least 100,000 $SVMAI tokens.
              This requirement ensures committed participation in the ecosystem and helps prevent spam.
            </p>
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
              { id: 'stakers', label: 'Delegators' },
              { id: 'recommendations', label: 'Recommendations' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${activeTab === tab.id
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
          <div className="bg-background border rounded-lg p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
              <div>
                <h3 className="text-lg font-semibold">Delegators</h3>
                <p className="text-sm text-muted-foreground">
                  Total: {validatorData.detailedStats.topStakers.length} delegators
                  {stakersSearch.trim() && ` (${totalStakers} matching "${stakersSearch}")`}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search delegator address..."
                    value={stakersSearch}
                    onChange={(e) => {
                      setStakersSearch(e.target.value);
                      setStakersPage(1); // Reset to first page when searching
                    }}
                    className="pl-10 pr-4 py-2 border rounded-md text-sm bg-background w-full sm:w-64"
                  />
                </div>

                {/* Items per page */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground whitespace-nowrap">Show:</span>
                  <select
                    value={stakersPerPage}
                    onChange={(e) => {
                      setStakersPerPage(Number(e.target.value));
                      setStakersPage(1);
                    }}
                    className="border rounded px-3 py-2 text-sm bg-background"
                  >
                    <option value="10">10</option>
                    <option value="25">25</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <div className="min-w-full inline-block align-middle">
                <table className="w-full min-w-[800px]">
                  <thead>
                    <tr className="border-b bg-muted/20">
                      <th className="text-left py-3 px-4 font-medium">
                        <button
                          onClick={() => handleStakersSort('rank')}
                          className="flex items-center gap-1 hover:text-primary transition-colors"
                        >
                          Rank {getSortIcon('rank')}
                        </button>
                      </th>
                      <th className="text-left py-3 px-4 font-medium min-w-[300px]">Delegator Address</th>
                      <th className="text-left py-3 px-4 font-medium">
                        <button
                          onClick={() => handleStakersSort('amount')}
                          className="flex items-center gap-1 hover:text-primary transition-colors"
                        >
                          Staked Amount {getSortIcon('amount')}
                        </button>
                      </th>
                      <th className="text-left py-3 px-4 font-medium">
                        <button
                          onClick={() => handleStakersSort('pnl')}
                          className="flex items-center gap-1 hover:text-primary transition-colors"
                        >
                          PnL {getSortIcon('pnl')}
                        </button>
                      </th>
                      <th className="text-left py-3 px-4 font-medium">
                        <button
                          onClick={() => handleStakersSort('pnlPercent')}
                          className="flex items-center gap-1 hover:text-primary transition-colors"
                        >
                          PnL % {getSortIcon('pnlPercent')}
                        </button>
                      </th>
                      <th className="text-left py-3 px-4 font-medium">
                        <button
                          onClick={() => handleStakersSort('duration')}
                          className="flex items-center gap-1 hover:text-primary transition-colors"
                        >
                          Duration {getSortIcon('duration')}
                        </button>
                      </th>
                      <th className="text-left py-3 px-4 font-medium">
                        <button
                          onClick={() => handleStakersSort('rewards')}
                          className="flex items-center gap-1 hover:text-primary transition-colors"
                        >
                          Rewards {getSortIcon('rewards')}
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedStakers.map((staker, index) => {
                      const globalIndex = (stakersPage - 1) * stakersPerPage + index;
                      return (
                        <tr key={staker.delegatorAddress} className="border-b hover:bg-muted/50 transition-colors">
                          <td className="py-3 px-4 text-sm">{globalIndex + 1}</td>
                          <td className="py-3 px-4">
                            <button
                              onClick={() => handleAddressClick(staker.delegatorAddress)}
                              className="text-primary hover:text-primary/80 underline decoration-dotted hover:decoration-solid font-mono text-sm transition-all duration-200 break-all"
                              title="Click to view account details"
                            >
                              {staker.delegatorAddress}
                            </button>
                          </td>
                          <td className="py-3 px-4 text-sm font-medium">{formatSOL(staker.stakedAmount)}</td>
                          <td className={`py-3 px-4 text-sm font-medium ${staker.pnl >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {staker.pnl >= 0 ? '+' : ''}{formatSOL(staker.pnl)}
                          </td>
                          <td className={`py-3 px-4 text-sm font-medium ${staker.pnlPercent >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {staker.pnlPercent >= 0 ? '+' : ''}{formatPercent(staker.pnlPercent)}
                          </td>
                          <td className="py-3 px-4 text-sm">{staker.stakingDuration} days</td>
                          <td className="py-3 px-4 text-sm font-medium">{formatSOL(staker.rewards)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-6 pt-4 border-t">
                <div className="text-sm text-muted-foreground order-2 sm:order-1">
                  Showing {((stakersPage - 1) * stakersPerPage) + 1}-{Math.min(stakersPage * stakersPerPage, totalStakers)} of {totalStakers} delegators
                </div>
                <div className="flex items-center justify-center sm:justify-end gap-2 order-1 sm:order-2">
                  <button
                    onClick={() => setStakersPage(Math.max(1, stakersPage - 1))}
                    disabled={stakersPage === 1}
                    className="px-3 py-2 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted transition-colors"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-muted-foreground px-2">
                    Page {stakersPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setStakersPage(Math.min(totalPages, stakersPage + 1))}
                    disabled={stakersPage === totalPages}
                    className="px-3 py-2 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}

            {/* No results message */}
            {totalStakers === 0 && stakersSearch.trim() && (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No delegators found matching "{stakersSearch}"</p>
                <button
                  onClick={() => setStakersSearch('')}
                  className="mt-2 text-primary hover:text-primary/80 underline"
                >
                  Clear search
                </button>
              </div>
            )}

            {/* Empty state */}
            {validatorData.detailedStats.topStakers.length === 0 && (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No delegator data available for this validator</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'recommendations' && (
          <div className="space-y-6">
            <div className="bg-background border rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">Staking Recommendation</h3>
              <div className={`p-4 rounded-lg mb-4 ${validatorData.recommendations.shouldStake
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
