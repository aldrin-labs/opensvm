/**
 * User History Statistics Component
 * Displays detailed statistics about user browsing history
 */

'use client';

import { UserHistoryStats } from '@/types/user-history';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  BarChart3, 
  Calendar, 
  Activity, 
  TrendingUp, 
  Clock,
  Eye,
  MousePointer,
  FileText,
  Coins,
  Server,
  Code,
  Search,
  Globe
} from 'lucide-react';

interface UserHistoryStatsProps {
  stats: UserHistoryStats;
}

const pageTypeIcons = {
  transaction: FileText,
  account: MousePointer,
  block: Calendar,
  program: Code,
  token: Coins,
  validator: Server,
  analytics: BarChart3,
  search: Search,
  other: Globe
};

const pageTypeColors = {
  transaction: 'bg-blue-500',
  account: 'bg-green-500',
  block: 'bg-purple-500',
  program: 'bg-orange-500',
  token: 'bg-yellow-500',
  validator: 'bg-red-500',
  analytics: 'bg-indigo-500',
  search: 'bg-pink-500',
  other: 'bg-gray-500'
};

export function UserHistoryStats({ stats }: UserHistoryStatsProps) {
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getDaysActive = () => {
    if (!stats.firstVisit) return 0;
    const today = new Date();
    const firstVisit = new Date(stats.firstVisit);
    const timeDiff = today.getTime() - firstVisit.getTime();
    return Math.ceil(timeDiff / (1000 * 3600 * 24));
  };

  const getAverageVisitsPerDay = () => {
    const daysActive = getDaysActive();
    return daysActive > 0 ? (stats.totalVisits / daysActive).toFixed(1) : '0';
  };

  const getMaxDailyVisits = () => {
    return Math.max(...stats.dailyActivity.map(d => d.visits), 0);
  };

  const getRecentActivity = () => {
    const last7Days = stats.dailyActivity.slice(-7);
    return last7Days.reduce((sum, day) => sum + day.visits, 0);
  };

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Days Active
                </p>
                <p className="text-2xl font-bold text-foreground">
                  {getDaysActive()}
                </p>
              </div>
              <Calendar className="h-8 w-8 text-blue-600" />
            </div>
            <div className="mt-4 text-xs text-muted-foreground">
              Since {formatDate(stats.firstVisit)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Avg. Daily Visits
                </p>
                <p className="text-2xl font-bold text-foreground">
                  {getAverageVisitsPerDay()}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
            <div className="mt-4 text-xs text-muted-foreground">
              Based on {stats.totalVisits} total visits
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Peak Daily Visits
                </p>
                <p className="text-2xl font-bold text-foreground">
                  {getMaxDailyVisits()}
                </p>
              </div>
              <Activity className="h-8 w-8 text-purple-600" />
            </div>
            <div className="mt-4 text-xs text-muted-foreground">
              Highest single day activity
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Recent Activity
                </p>
                <p className="text-2xl font-bold text-foreground">
                  {getRecentActivity()}
                </p>
              </div>
              <Clock className="h-8 w-8 text-orange-600" />
            </div>
            <div className="mt-4 text-xs text-muted-foreground">
              Last 7 days
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Page Type Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Page Type Distribution
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {stats.pageTypeDistribution.map((type, index) => {
            const Icon = pageTypeIcons[type.type as keyof typeof pageTypeIcons] || Globe;
            const colorClass = pageTypeColors[type.type as keyof typeof pageTypeColors] || pageTypeColors.other;
            
            return (
              <div key={type.type} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    <span className="font-medium capitalize">{type.type}</span>
                    <Badge variant="outline" className="text-xs">
                      {type.count}
                    </Badge>
                  </div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {type.percentage.toFixed(1)}%
                  </span>
                </div>
                <Progress
                  value={type.percentage}
                  className="h-2"
                  style={{
                    '--progress-background': `${colorClass.replace('bg-', '')}`
                  } as any}
                />
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Daily Activity Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Daily Activity Timeline
          </CardTitle>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Your browsing activity over the last {Math.min(stats.dailyActivity.length, 30)} days
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Activity Chart */}
            <div className="h-32 flex items-end justify-between gap-1">
              {stats.dailyActivity.slice(-30).map((day, index) => {
                const maxVisits = Math.max(...stats.dailyActivity.map(d => d.visits));
                const height = maxVisits > 0 ? (day.visits / maxVisits) * 100 : 0;
                
                return (
                  <div
                    key={day.date}
                    className="flex-1 bg-blue-500 rounded-t-sm transition-all hover:bg-blue-600"
                    style={{ height: `${height}%` }}
                    title={`${day.date}: ${day.visits} visits`}
                  />
                );
              })}
            </div>
            
            {/* Date Labels */}
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-500">
              <span>
                {stats.dailyActivity.length > 0 && formatDate(
                  new Date(stats.dailyActivity[Math.max(0, stats.dailyActivity.length - 30)].date).getTime()
                )}
              </span>
              <span>Today</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Activity Heatmap */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Activity Heatmap
          </CardTitle>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Your browsing pattern visualization
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1 text-center">
            {/* Week Headers */}
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-xs font-medium text-gray-500 dark:text-gray-500 p-2">
                {day}
              </div>
            ))}
            
            {/* Generate last 7 weeks of data */}
            {Array.from({ length: 49 }, (_, i) => {
              const date = new Date();
              date.setDate(date.getDate() - (48 - i));
              const dateStr = date.toISOString().split('T')[0];
              
              const dayData = stats.dailyActivity.find(d => d.date === dateStr);
              const visits = dayData?.visits || 0;
              const maxVisits = Math.max(...stats.dailyActivity.map(d => d.visits));
              
              let intensity = 0;
              if (visits > 0) {
                intensity = Math.min(4, Math.ceil((visits / maxVisits) * 4));
              }
              
              const intensityColors = [
                'bg-gray-100 dark:bg-gray-800',
                'bg-blue-100 dark:bg-blue-900',
                'bg-blue-300 dark:bg-blue-700',
                'bg-blue-500 dark:bg-blue-500',
                'bg-blue-700 dark:bg-blue-300'
              ];
              
              return (
                <div
                  key={i}
                  className={`w-6 h-6 rounded-sm ${intensityColors[intensity]} border border-gray-200 dark:border-gray-700`}
                  title={`${dateStr}: ${visits} visits`}
                />
              );
            })}
          </div>
          
          <div className="flex items-center justify-between mt-4 text-xs text-gray-500 dark:text-gray-500">
            <span>Less active</span>
            <div className="flex items-center gap-1">
              {[0, 1, 2, 3, 4].map(level => (
                <div
                  key={level}
                  className={`w-3 h-3 rounded-sm ${
                    level === 0 ? 'bg-gray-100 dark:bg-gray-800' :
                    level === 1 ? 'bg-blue-100 dark:bg-blue-900' :
                    level === 2 ? 'bg-blue-300 dark:bg-blue-700' :
                    level === 3 ? 'bg-blue-500 dark:bg-blue-500' :
                    'bg-blue-700 dark:bg-blue-300'
                  }`}
                />
              ))}
            </div>
            <span>More active</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}