'use client';

import React, { useMemo } from 'react';
import { SocialFeedEvent as FeedEvent } from '@/lib/user/feed-events';
import { BarChart3, TrendingUp, Users, Heart } from 'lucide-react';

interface FeedChartsProps {
  events: FeedEvent[];
}

export function FeedAnalyticsPanel({ events }: FeedChartsProps) {
  const analytics = useMemo(() => {
    // Event type distribution
    const typeDistribution: Record<string, number> = {};
    events.forEach(event => {
      typeDistribution[event.eventType] = (typeDistribution[event.eventType] || 0) + 1;
    });

    // Calculate daily activity (last 7 days)
    const now = Date.now();
    const dailyActivity = new Array(7).fill(0);
    events.forEach(event => {
      const daysDiff = Math.floor((now - event.timestamp) / (1000 * 60 * 60 * 24));
      if (daysDiff >= 0 && daysDiff < 7) {
        dailyActivity[6 - daysDiff]++;
      }
    });

    // Extract trending tokens/accounts
    const trendingItems: Record<string, { count: number; type: string; url?: string }> = {};
    events.forEach(event => {
      if (event.eventType === 'visit' && event.metadata?.clickableUrl) {
        const key = event.content.split('•')[0]?.trim() || event.content.substring(0, 50);
        if (!trendingItems[key]) {
          trendingItems[key] = { count: 0, type: 'visit', url: event.metadata.clickableUrl };
        }
        trendingItems[key].count++;
      }
    });

    const topTrending = Object.entries(trendingItems)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5);

    // Engagement metrics
    const totalLikes = events.reduce((sum, event) => sum + (event.likes || 0), 0);
    const avgLikes = events.length > 0 ? (totalLikes / events.length).toFixed(1) : '0';
    const mostLiked = events.reduce((max, event) => 
      (event.likes || 0) > (max?.likes || 0) ? event : max, 
      events[0]
    );

    // Top users
    const userActivity: Record<string, number> = {};
    events.forEach(event => {
      userActivity[event.userAddress] = (userActivity[event.userAddress] || 0) + 1;
    });
    const topUsers = Object.entries(userActivity)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return {
      typeDistribution,
      dailyActivity,
      topTrending,
      totalLikes,
      avgLikes,
      mostLiked,
      topUsers,
    };
  }, [events]);

  const eventTypeColors: Record<string, string> = {
    visit: 'bg-cyan-500',
    follow: 'bg-green-500',
    like: 'bg-pink-500',
    transaction: 'bg-blue-500',
    profile_update: 'bg-purple-500',
    token_transfer: 'bg-orange-500',
  };

  const eventTypeLabels: Record<string, string> = {
    visit: 'Visits',
    follow: 'Follows',
    like: 'Likes',
    transaction: 'Transactions',
    profile_update: 'Profile Updates',
    token_transfer: 'Token Transfers',
  };

  const maxCount = Math.max(...Object.values(analytics.typeDistribution));

  return (
    <div className="mb-6 rounded-lg border border-gray-800 bg-gray-900/50 p-4">
      <div className="mb-4 flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-purple-400" />
        <h3 className="text-lg font-semibold text-white">Feed Analytics</h3>
        <span className="text-sm text-gray-400">({events.length} events)</span>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Event Type Distribution */}
        <div className="rounded-lg bg-gray-800/50 p-4">
          <h4 className="mb-3 text-sm font-medium text-gray-300">Event Distribution</h4>
          <div className="space-y-2">
            {Object.entries(analytics.typeDistribution).map(([type, count]) => (
              <div key={type} className="group">
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-gray-400">{eventTypeLabels[type] || type}</span>
                  <span className="text-gray-300">{count}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-gray-700">
                  <div
                    className={`h-full transition-all duration-500 ${eventTypeColors[type]}`}
                    style={{ width: `${(count / maxCount) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Activity Timeline */}
        <div className="rounded-lg bg-gray-800/50 p-4">
          <h4 className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-300">
            <TrendingUp className="h-4 w-4" />
            Activity (7 days)
          </h4>
          <div className="flex items-end justify-between gap-1 h-24">
            {analytics.dailyActivity.map((count, index) => {
              const maxActivity = Math.max(...analytics.dailyActivity);
              const height = maxActivity > 0 ? (count / maxActivity) * 100 : 0;
              return (
                <div key={index} className="flex-1 flex flex-col items-center">
                  <div className="w-full bg-gray-700 rounded-t" style={{ height: `${height}%`, minHeight: height > 0 ? '4px' : '2px' }}>
                    <div className="w-full h-full bg-gradient-to-t from-purple-500 to-purple-400 rounded-t" />
                  </div>
                  <span className="text-[10px] text-gray-500 mt-1">
                    {index === 6 ? 'T' : index === 5 ? 'Y' : ''}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Engagement Metrics */}
        <div className="rounded-lg bg-gray-800/50 p-4">
          <h4 className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-300">
            <Heart className="h-4 w-4" />
            Engagement
          </h4>
          <div className="space-y-3">
            <div>
              <div className="text-2xl font-bold text-pink-400">{analytics.totalLikes}</div>
              <div className="text-xs text-gray-400">Total Likes</div>
            </div>
            <div>
              <div className="text-xl font-semibold text-purple-400">{analytics.avgLikes}</div>
              <div className="text-xs text-gray-400">Avg per Event</div>
            </div>
          </div>
        </div>

        {/* Trending Content */}
        <div className="rounded-lg bg-gray-800/50 p-4 md:col-span-2">
          <h4 className="mb-3 text-sm font-medium text-gray-300">🔥 Trending Content</h4>
          <div className="space-y-2">
            {analytics.topTrending.length === 0 ? (
              <p className="text-xs text-gray-500">No trending content yet</p>
            ) : (
              analytics.topTrending.map(([name, data], index) => (
                <a
                  key={name}
                  href={data.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between rounded p-2 hover:bg-gray-700/50 transition-colors group"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-xs font-medium text-gray-500">#{index + 1}</span>
                    <span className="text-sm text-gray-300 truncate group-hover:text-white">{name}</span>
                  </div>
                  <span className="text-xs text-cyan-400">{data.count} views</span>
                </a>
              ))
            )}
          </div>
        </div>

        {/* Top Contributors */}
        <div className="rounded-lg bg-gray-800/50 p-4">
          <h4 className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-300">
            <Users className="h-4 w-4" />
            Top Contributors
          </h4>
          <div className="space-y-2">
            {analytics.topUsers.length === 0 ? (
              <p className="text-xs text-gray-500">No activity yet</p>
            ) : (
              analytics.topUsers.map(([address, count]) => (
                <div key={address} className="flex items-center justify-between">
                  <span className="text-xs text-gray-400 font-mono">
                    {address.slice(0, 4)}...{address.slice(-4)}
                  </span>
                  <span className="text-xs text-green-400">{count} events</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
