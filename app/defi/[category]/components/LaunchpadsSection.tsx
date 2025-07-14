'use client';

import React, { useState, useEffect } from 'react';
import { Rocket, Calendar, Users, DollarSign, Target, Crown, CheckCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface LaunchpadProject {
  id: string;
  name: string;
  symbol: string;
  description: string;
  platform: string;
  status: 'upcoming' | 'live' | 'completed' | 'cancelled';
  launchDate: string;
  endDate?: string;
  targetRaise: number;
  currentRaise: number;
  tokenPrice: number;
  totalSupply: number;
  participants: number;
  minAllocation: number;
  maxAllocation: number;
  vesting: string;
  website?: string;
  twitter?: string;
  telegram?: string;
  category: string;
  imageUrl?: string;
}

interface LaunchpadPlatform {
  name: string;
  totalProjects: number;
  successRate: number;
  totalRaised: number;
  averageRoi: number;
  description: string;
}

export default function LaunchpadsSection() {
  const [projects, setProjects] = useState<LaunchpadProject[]>([]);
  const [platforms, setPlatforms] = useState<LaunchpadPlatform[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [platformFilter, setPlatformFilter] = useState<string>('all');

  useEffect(() => {
    const fetchLaunchpadData = async () => {
      try {
        setLoading(true);
        
        // Mock platforms data - Solana-native launchpads
        const mockPlatforms: LaunchpadPlatform[] = [
          {
            name: 'Magic Eden Launchpad',
            totalProjects: 156,
            successRate: 87.5,
            totalRaised: 89000000,
            averageRoi: 245.6,
            description: 'Premier NFT and token launchpad on Solana'
          },
          {
            name: 'Raydium AcceleRaytor',
            totalProjects: 89,
            successRate: 78.9,
            totalRaised: 45000000,
            averageRoi: 189.3,
            description: 'Community-driven IDO platform on Raydium'
          },
          {
            name: 'Solanium',
            totalProjects: 123,
            successRate: 82.1,
            totalRaised: 67000000,
            averageRoi: 167.8,
            description: 'Decentralized fundraising platform for Solana projects'
          },
          {
            name: 'Jupiter Launchpad',
            totalProjects: 67,
            successRate: 91.2,
            totalRaised: 34000000,
            averageRoi: 298.7,
            description: 'New token launches integrated with Jupiter aggregator'
          },
          {
            name: 'Step Finance Launchpad',
            totalProjects: 45,
            successRate: 75.6,
            totalRaised: 23000000,
            averageRoi: 134.5,
            description: 'Portfolio management and token launch platform'
          }
        ];

        // Mock projects data - Solana token projects
        const mockProjects: LaunchpadProject[] = [
          {
            id: '1',
            name: 'SolanaVault Protocol',
            symbol: 'SVAULT',
            description: 'Advanced yield farming and vault management protocol on Solana',
            platform: 'Magic Eden Launchpad',
            status: 'live',
            launchDate: '2024-12-20T10:00:00Z',
            endDate: '2024-12-25T10:00:00Z',
            targetRaise: 2000000,
            currentRaise: 1450000,
            tokenPrice: 0.15,
            totalSupply: 100000000,
            participants: 3456,
            minAllocation: 50,
            maxAllocation: 5000,
            vesting: '20% TGE, 80% over 12 months',
            category: 'DeFi'
          },
          {
            id: '2',
            name: 'MetaPlex Studio',
            symbol: 'MSTUDIO',
            description: 'Next-generation NFT creation and trading platform',
            platform: 'Jupiter Launchpad',
            status: 'upcoming',
            launchDate: '2024-12-28T15:00:00Z',
            targetRaise: 5000000,
            currentRaise: 0,
            tokenPrice: 0.25,
            totalSupply: 200000000,
            participants: 0,
            minAllocation: 100,
            maxAllocation: 10000,
            vesting: '15% TGE, 85% over 18 months',
            category: 'NFT'
          },
          {
            id: '3',
            name: 'SolanaOracle Network',
            symbol: 'SORACLE',
            description: 'Decentralized oracle network providing real-time data feeds',
            platform: 'Raydium AcceleRaytor',
            status: 'completed',
            launchDate: '2024-12-10T12:00:00Z',
            endDate: '2024-12-15T12:00:00Z',
            targetRaise: 3000000,
            currentRaise: 3000000,
            tokenPrice: 0.08,
            totalSupply: 500000000,
            participants: 8923,
            minAllocation: 25,
            maxAllocation: 2500,
            vesting: '25% TGE, 75% over 24 months',
            category: 'Infrastructure'
          },
          {
            id: '4',
            name: 'SolGame Protocol',
            symbol: 'SGAME',
            description: 'Gaming infrastructure and marketplace for Solana gaming ecosystem',
            platform: 'Solanium',
            status: 'live',
            launchDate: '2024-12-22T08:00:00Z',
            endDate: '2024-12-27T08:00:00Z',
            targetRaise: 1500000,
            currentRaise: 890000,
            tokenPrice: 0.12,
            totalSupply: 150000000,
            participants: 2167,
            minAllocation: 75,
            maxAllocation: 7500,
            vesting: '30% TGE, 70% over 15 months',
            category: 'Gaming'
          },
          {
            id: '5',
            name: 'SolStable Finance',
            symbol: 'SSTABLE',
            description: 'Algorithmic stablecoin protocol with yield generation',
            platform: 'Step Finance Launchpad',
            status: 'upcoming',
            launchDate: '2024-12-30T14:00:00Z',
            targetRaise: 4000000,
            currentRaise: 0,
            tokenPrice: 0.20,
            totalSupply: 300000000,
            participants: 0,
            minAllocation: 200,
            maxAllocation: 15000,
            vesting: '10% TGE, 90% over 36 months',
            category: 'Stablecoin'
          },
          {
            id: '6',
            name: 'SolanaAI Assistant',
            symbol: 'SOLAI',
            description: 'AI-powered trading and portfolio management for Solana DeFi',
            platform: 'Magic Eden Launchpad',
            status: 'completed',
            launchDate: '2024-12-05T16:00:00Z',
            endDate: '2024-12-08T16:00:00Z',
            targetRaise: 2500000,
            currentRaise: 2500000,
            tokenPrice: 0.18,
            totalSupply: 180000000,
            participants: 5678,
            minAllocation: 100,
            maxAllocation: 8000,
            vesting: '20% TGE, 80% over 20 months',
            category: 'AI'
          }
        ];

        setPlatforms(mockPlatforms);
        setProjects(mockProjects);
      } catch (error) {
        console.error('Failed to fetch launchpad data:', error);
        setPlatforms([]);
        setProjects([]);
      } finally {
        setLoading(false);
      }
    };

    fetchLaunchpadData();
  }, []);

  const filteredProjects = projects.filter(project => {
    const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
    const matchesPlatform = platformFilter === 'all' || project.platform === platformFilter;
    return matchesStatus && matchesPlatform;
  });

  const formatCurrency = (value: number) => {
    if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
    return `$${value.toLocaleString()}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'upcoming': return 'text-blue-600 bg-blue-100';
      case 'live': return 'text-green-600 bg-green-100';
      case 'completed': return 'text-gray-600 bg-gray-100';
      case 'cancelled': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getProgressPercentage = (current: number, target: number) => {
    return Math.min((current / target) * 100, 100);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Rocket className="h-8 w-8 text-primary" />
        <h2 className="text-2xl font-bold">Solana Launchpads</h2>
      </div>

      {/* Platform Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {platforms.map((platform, index) => (
          <Card key={index} className="p-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-yellow-500" />
                <h3 className="font-semibold">{platform.name}</h3>
              </div>
              <p className="text-sm text-muted-foreground">{platform.description}</p>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Projects:</span>
                  <span className="font-medium">{platform.totalProjects}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Success Rate:</span>
                  <span className="font-medium text-green-600">{platform.successRate}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Total Raised:</span>
                  <span className="font-medium">{formatCurrency(platform.totalRaised)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Avg ROI:</span>
                  <span className="font-medium text-blue-600">{platform.averageRoi}%</span>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border rounded-lg bg-background"
          >
            <option value="all">All Status</option>
            <option value="upcoming">Upcoming</option>
            <option value="live">Live</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <select
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value)}
            className="px-4 py-2 border rounded-lg bg-background"
          >
            <option value="all">All Platforms</option>
            {platforms.map((platform) => (
              <option key={platform.name} value={platform.name}>
                {platform.name}
              </option>
            ))}
          </select>

          <Button variant="outline" className="ml-auto">
            <Target className="h-4 w-4 mr-2" />
            Apply for Launchpad
          </Button>
        </div>
      </Card>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredProjects.map((project) => (
          <Card key={project.id} className="p-6 hover:shadow-lg transition-shadow">
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-semibold">{project.name}</h3>
                    <span className="text-sm text-muted-foreground">({project.symbol})</span>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded uppercase font-medium ${getStatusColor(project.status)}`}>
                    {project.status}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Token Price</p>
                  <p className="font-bold">{formatCurrency(project.tokenPrice)}</p>
                </div>
              </div>

              {/* Description */}
              <p className="text-sm text-muted-foreground">{project.description}</p>

              {/* Platform & Category */}
              <div className="flex items-center gap-4 text-sm">
                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">
                  {project.platform}
                </span>
                <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded">
                  {project.category}
                </span>
              </div>

              {/* Progress (for live projects) */}
              {project.status === 'live' && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Progress</span>
                    <span>{formatCurrency(project.currentRaise)} / {formatCurrency(project.targetRaise)}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${getProgressPercentage(project.currentRaise, project.targetRaise)}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {getProgressPercentage(project.currentRaise, project.targetRaise).toFixed(1)}% funded
                  </p>
                </div>
              )}

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground">Launch Date</p>
                    <p className="font-medium">{formatDate(project.launchDate)}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground">Participants</p>
                    <p className="font-medium">{project.participants.toLocaleString()}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground">Min Allocation</p>
                    <p className="font-medium">{formatCurrency(project.minAllocation)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground">Max Allocation</p>
                    <p className="font-medium">{formatCurrency(project.maxAllocation)}</p>
                  </div>
                </div>
              </div>

              {/* Vesting */}
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-sm font-medium mb-1">Vesting Schedule</p>
                <p className="text-xs text-muted-foreground">{project.vesting}</p>
              </div>

              {/* Action Button */}
              <div className="pt-2">
                {project.status === 'upcoming' && (
                  <Button className="w-full" variant="outline">
                    <Calendar className="h-4 w-4 mr-2" />
                    Set Reminder
                  </Button>
                )}
                {project.status === 'live' && (
                  <Button className="w-full">
                    <Rocket className="h-4 w-4 mr-2" />
                    Participate Now
                  </Button>
                )}
                {project.status === 'completed' && (
                  <Button className="w-full" variant="outline" disabled>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Completed
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {filteredProjects.length === 0 && (
        <Card className="p-8 text-center">
          <Rocket className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No projects found matching your criteria</p>
        </Card>
      )}
    </div>
  );
}