'use client';

import React, { useState, useEffect } from 'react';
import { Loader2, TrendingUp, ExternalLink, Heart, Users, Target, DollarSign, InfoIcon } from 'lucide-react';

interface LaunchpadData {
  launchpads: Array<{
    name: string;
    platform: string;
    totalRaised: number;
    projectsLaunched: number;
    avgRoi: number;
    successRate: number;
    marketCap: number;
    website: string;
    description: string;
    likes: number;
    category: string;
    status: 'active' | 'inactive' | 'maintenance';
    launchDate: string;
    lastUpdate: number;
  }>;
  recentProjects: Array<{
    name: string;
    platform: string;
    raised: number;
    roi: number;
    status: 'completed' | 'active' | 'upcoming';
    launchDate: string;
    website: string;
    description: string;
  }>;
  summary: {
    totalPlatforms: number;
    totalRaised: number;
    avgSuccessRate: number;
    avgRoi: number;
    totalProjectsLaunched: number;
    lastUpdate: number;
  };
}

export function LaunchpadsTab() {
  const [data, setData] = useState<LaunchpadData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'likes' | 'totalRaised' | 'avgRoi' | 'successRate'>('likes');
  const [likedPlatforms, setLikedPlatforms] = useState<Set<string>>(new Set());

  // Safe formatting functions
  const formatCurrency = (value: number | undefined | null): string => {
    if (value == null || isNaN(value)) return '$0';
    if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
    return `$${value.toFixed(0)}`;
  };

  const formatPercent = (value: number | undefined | null): string => {
    if (value == null || isNaN(value)) return '0%';
    return `${Math.max(0, Math.min(100, value)).toFixed(1)}%`;
  };

  const formatROI = (value: number | undefined | null): string => {
    if (value == null || isNaN(value)) return '0%';
    return `${value.toFixed(1)}%`;
  };

  const handleLike = (platformName: string) => {
    const newLiked = new Set(likedPlatforms);
    if (newLiked.has(platformName)) {
      newLiked.delete(platformName);
    } else {
      newLiked.add(platformName);
    }
    setLikedPlatforms(newLiked);

    // Update the data with new like count
    if (data) {
      const updatedLaunchpads = data.launchpads.map(lp => {
        if (lp.name === platformName) {
          return {
            ...lp,
            likes: newLiked.has(platformName) ? lp.likes + 1 : lp.likes - 1
          };
        }
        return lp;
      });
      setData({ ...data, launchpads: updatedLaunchpads });
    }
  };

  const getSortedLaunchpads = () => {
    if (!data) return [];
    
    return [...data.launchpads].sort((a, b) => {
      switch (sortBy) {
        case 'likes':
          return b.likes - a.likes;
        case 'totalRaised':
          return b.totalRaised - a.totalRaised;
        case 'avgRoi':
          return b.avgRoi - a.avgRoi;
        case 'successRate':
          return b.successRate - a.successRate;
        default:
          return 0;
      }
    });
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch('/api/analytics/launchpads');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        setData(result);
      } catch (err) {
        console.error('Error fetching launchpad data:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading launchpad data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-destructive text-center py-8">
        Error loading launchpad data: {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-muted-foreground text-center py-8">
        No launchpad data available
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-card p-4 rounded-lg border">
          <div className="flex items-center space-x-2">
            <Target className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Total Platforms</p>
              <p className="text-xl font-bold">{data.summary.totalPlatforms}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-card p-4 rounded-lg border">
          <div className="flex items-center space-x-2">
            <DollarSign className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Total Raised</p>
              <p className="text-xl font-bold">{formatCurrency(data.summary.totalRaised)}</p>
            </div>
          </div>
        </div>

        <div className="bg-card p-4 rounded-lg border">
          <div className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Avg ROI</p>
              <p className="text-xl font-bold">{formatROI(data.summary.avgRoi)}</p>
            </div>
          </div>
        </div>

        <div className="bg-card p-4 rounded-lg border">
          <div className="flex items-center space-x-2">
            <Target className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Success Rate</p>
              <p className="text-xl font-bold">{formatPercent(data.summary.avgSuccessRate)}</p>
            </div>
          </div>
        </div>

        <div className="bg-card p-4 rounded-lg border">
          <div className="flex items-center space-x-2">
            <Users className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Projects Launched</p>
              <p className="text-xl font-bold">{data.summary.totalProjectsLaunched}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Sort Controls */}
      <div className="flex flex-wrap gap-2">
        <span className="text-sm font-medium text-muted-foreground">Sort by:</span>
        {[
          { key: 'likes', label: 'Likes' },
          { key: 'totalRaised', label: 'Total Raised' },
          { key: 'avgRoi', label: 'ROI' },
          { key: 'successRate', label: 'Success Rate' }
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setSortBy(key as any)}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              sortBy === key
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Launchpad Rankings */}
      <div className="bg-card rounded-lg border overflow-hidden">
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold">Launchpad Rankings</h3>
          <p className="text-sm text-muted-foreground">Comprehensive analysis of Solana launchpad platforms</p>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Platform</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Category</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Total Raised</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Projects</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Avg ROI</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Success Rate</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Likes</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {getSortedLaunchpads().map((launchpad, index) => (
                <tr key={launchpad.name} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-4">
                    <div className="flex items-center space-x-3">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                          <span className="text-sm font-bold text-primary">{index + 1}</span>
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">{launchpad.name}</span>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            launchpad.status === 'active' 
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                              : launchpad.status === 'maintenance'
                              ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                              : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                          }`}>
                            {launchpad.status}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">{launchpad.platform}</p>
                        <p className="text-xs text-muted-foreground max-w-xs truncate">{launchpad.description}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
                      {launchpad.category}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="font-medium">{formatCurrency(launchpad.totalRaised)}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="font-medium">{launchpad.projectsLaunched}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="font-medium text-green-600 dark:text-green-400">
                      {formatROI(launchpad.avgRoi)}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="font-medium">{formatPercent(launchpad.successRate)}</span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center space-x-2">
                      <Heart 
                        className={`h-4 w-4 cursor-pointer transition-colors ${
                          likedPlatforms.has(launchpad.name) 
                            ? 'text-red-500 fill-current' 
                            : 'text-muted-foreground hover:text-red-500'
                        }`}
                        onClick={() => handleLike(launchpad.name)}
                      />
                      <span className="text-sm font-medium">{launchpad.likes}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center space-x-2">
                      <a
                        href={launchpad.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center space-x-1 text-sm text-primary hover:text-primary/80 transition-colors"
                      >
                        <ExternalLink className="h-4 w-4" />
                        <span>Visit</span>
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Projects */}
      <div className="bg-card rounded-lg border overflow-hidden">
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold">Recent Successful Projects</h3>
          <p className="text-sm text-muted-foreground">Latest project launches with performance metrics</p>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Project</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Platform</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Raised</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">ROI</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Launch Date</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.recentProjects.map((project, index) => (
                <tr key={project.name} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-4">
                    <div>
                      <span className="font-medium">{project.name}</span>
                      <p className="text-xs text-muted-foreground max-w-xs truncate">{project.description}</p>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-sm">{project.platform}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="font-medium">{formatCurrency(project.raised)}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="font-medium text-green-600 dark:text-green-400">
                      {formatROI(project.roi)}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-sm">{new Date(project.launchDate).toLocaleDateString()}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      project.status === 'completed' 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        : project.status === 'active'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                    }`}>
                      {project.status}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <a
                      href={project.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center space-x-1 text-sm text-primary hover:text-primary/80 transition-colors"
                    >
                      <ExternalLink className="h-4 w-4" />
                      <span>Visit</span>
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}