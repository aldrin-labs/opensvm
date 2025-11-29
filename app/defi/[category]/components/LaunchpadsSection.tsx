'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Rocket, Calendar, Users, DollarSign, Target, Crown, CheckCircle, RefreshCw } from 'lucide-react';
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

  const fetchLaunchpadData = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const response = await fetch('/api/analytics/launchpads');
      const data = await response.json();

      if (data.success && data.data) {
        setPlatforms(data.data.platforms || []);
        setProjects(data.data.projects || []);
      } else {
        throw new Error(data.error || 'Failed to fetch data');
      }
    } catch (error) {
      console.error('Failed to fetch launchpad data:', error);
      setPlatforms([]);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLaunchpadData();
    const interval = setInterval(() => fetchLaunchpadData(true), 60000);
    return () => clearInterval(interval);
  }, [fetchLaunchpadData]);

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
      case 'upcoming': return 'text-info bg-info/10';
      case 'live': return 'text-success bg-success/10';
      case 'completed': return 'text-muted-foreground bg-muted';
      case 'cancelled': return 'text-destructive bg-destructive/10';
      default: return 'text-muted-foreground bg-muted';
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
                <Crown className="h-5 w-5 text-warning" />
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
                  <span className="font-medium text-success">{platform.successRate}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Total Raised:</span>
                  <span className="font-medium">{formatCurrency(platform.totalRaised)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Avg ROI:</span>
                  <span className="font-medium text-info">{platform.averageRoi}%</span>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div>
            <label className="sr-only" htmlFor="status-filter">Filter by status</label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border rounded-lg bg-background"
              aria-label="Filter by status"
            >
              <option value="all">All Status</option>
              <option value="upcoming">Upcoming</option>
              <option value="live">Live</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div>
            <label className="sr-only" htmlFor="platform-filter">Filter by platform</label>
            <select
              id="platform-filter"
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
              className="px-4 py-2 border rounded-lg bg-background"
              aria-label="Filter by platform"
            >
              <option value="all">All Platforms</option>
              {platforms.map((platform) => (
                <option key={platform.name} value={platform.name}>
                  {platform.name}
                </option>
              ))}
            </select>
          </div>

          <Button variant="outline" onClick={() => fetchLaunchpadData(true)}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>

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
                <span className="px-2 py-1 bg-info/10 text-info rounded">
                  {project.platform}
                </span>
                <span className="px-2 py-1 bg-primary/10 text-primary rounded">
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
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-success h-2 rounded-full transition-all duration-300"
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