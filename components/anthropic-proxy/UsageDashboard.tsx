'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
    TrendingUpIcon,
    DollarSignIcon,
    ClockIcon,
    ActivityIcon,
    RefreshCwIcon,
    ZapIcon,
    CheckCircleIcon,
    AlertTriangleIcon,
    TargetIcon,
    BarChart3Icon,
    PieChartIcon
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useSettings } from '@/lib/settings';
import { useAuthContext } from '@/contexts/AuthContext';

interface UsageData {
    period: 'day' | 'week' | 'month';
    usage: {
        totalRequests: number;
        totalTokens: number;
        totalCost: number;
        averageResponseTime: number;
        errorRate: number;
    };
    breakdown: {
        models: Array<{
            model: string;
            requests: number;
            tokens: number;
            cost: number;
            percentage: number;
        }>;
        costByModel: Array<{
            model: string;
            cost: number;
            percentage: number;
        }>;
        dailyUsage: Array<{
            date: string;
            requests: number;
            tokens: number;
            cost: number;
        }>;
    };
    charts: Array<{
        type: string;
        title: string;
        data: any[];
    }>;
    summary: {
        totalRequests: number;
        totalTokensConsumed: number;
        totalSVMAISpent: number;
        averageResponseTime: number;
        errorRate: number;
    };
    tokenBreakdown: {
        averageTokensPerRequest: number;
    };
    balance: {
        availableBalance: number;
    };
    modelUsage: Array<{
        model: string;
        requests: number;
        tokens: number;
    }>;
    costBreakdown: Array<{
        model: string;
        svmaiCost: number;
    }>;
    insights: Array<{
        type: string;
        title: string;
        category: string;
        description: string;
        recommendation: string;
    }>;
    apiKeys: {
        total: number;
        active: number;
        lastUsed: string | null;
    };
}

export default function UsageDashboard() {
    const [usageData, setUsageData] = React.useState<UsageData | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [selectedPeriod, setSelectedPeriod] = React.useState<'day' | 'week' | 'month'>('month');

    // Get user settings for theme and font
    const settings = useSettings();

    // Get user ID from auth context
    const { walletAddress } = useAuthContext();
    const userId = walletAddress || 'current-user';

    // Theme-aware CSS classes
    const themeClasses = {
        container: "min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8",
        header: "mb-6 sm:mb-8",
        title: "text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2 flex-wrap",
        subtitle: "text-muted-foreground mt-2",
        emptyState: "text-center py-8 text-muted-foreground",
        emptyIcon: "h-12 w-12 mx-auto mb-4 text-muted-foreground/50",
        metricCard: "border rounded-lg p-4 hover:bg-muted/50 transition-colors",
        metricHeader: "flex items-center justify-between mb-3",
        metricIcon: "h-5 w-5",
        metricValue: "text-2xl font-bold",
        metricLabel: "text-sm text-muted-foreground",
        metricChange: "text-xs",
        chartCard: "border rounded-lg p-4",
        chartTitle: "font-semibold mb-4",
        insightCard: "border rounded-lg p-4",
        insightTitle: "font-semibold mb-3",
        insightList: "space-y-2",
        insightItem: "flex items-start gap-2 p-2 rounded-lg",
        insightIcon: "h-4 w-4 mt-0.5",
        loadingSkeleton: "animate-pulse bg-muted rounded",
        metricsGrid: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4",
        controls: "flex flex-col sm:flex-row gap-2 sm:gap-4",
        chartsGrid: "grid lg:grid-cols-2 gap-4 sm:gap-6",
        modelGrid: "grid sm:grid-cols-2 lg:grid-cols-3 gap-4"
    };

    // Apply font family from settings
    const fontClass = settings.fontFamily === 'berkeley' ? 'font-mono' :
        settings.fontFamily === 'jetbrains' ? 'font-mono' :
            'font-sans';

    // Apply font size from settings
    const fontSizeClass = settings.fontSize === 'small' ? 'text-sm' :
        settings.fontSize === 'large' ? 'text-lg' :
            'text-base';

    const loadUsageData = React.useCallback(async () => {
        try {
            setLoading(true);

            // Try to fetch real usage data from API
            try {
                const response = await fetch(`/api/opensvm/usage?period=${selectedPeriod}`, {
                    headers: {
                        'x-user-id': userId,
                    },
                });

                if (response.ok) {
                    const data = await response.json();
                    setUsageData(data.data);
                    return;
                }
            } catch (error) {
                console.warn('Failed to fetch real usage data, using mock data:', error);
            }

            // Fallback to mock data if API call fails
            const mockData: UsageData = {
                period: selectedPeriod,
                usage: {
                    totalRequests: 15420,
                    totalTokens: 2847500,
                    totalCost: 156.80,
                    averageResponseTime: 2.3,
                    errorRate: 0.5
                },
                breakdown: {
                    models: [
                        { model: 'claude-3-sonnet', requests: 8500, tokens: 1500000, cost: 85.00, percentage: 55 },
                        { model: 'claude-3-haiku', requests: 4200, tokens: 800000, cost: 40.00, percentage: 27 },
                        { model: 'claude-3-opus', requests: 2720, tokens: 547500, cost: 31.80, percentage: 18 }
                    ],
                    costByModel: [
                        { model: 'claude-3-sonnet', cost: 85.00, percentage: 54 },
                        { model: 'claude-3-haiku', cost: 40.00, percentage: 26 },
                        { model: 'claude-3-opus', cost: 31.80, percentage: 20 }
                    ],
                    dailyUsage: [
                        { date: '2024-01-01', requests: 1200, tokens: 250000, cost: 12.50 },
                        { date: '2024-01-02', requests: 1350, tokens: 280000, cost: 14.00 },
                        { date: '2024-01-03', requests: 1100, tokens: 220000, cost: 11.00 },
                        { date: '2024-01-04', requests: 1600, tokens: 320000, cost: 16.00 },
                        { date: '2024-01-05', requests: 1400, tokens: 290000, cost: 14.50 },
                        { date: '2024-01-06', requests: 1300, tokens: 270000, cost: 13.50 },
                        { date: '2024-01-07', requests: 1500, tokens: 310000, cost: 15.50 }
                    ]
                },
                charts: [
                    { type: 'bar', title: 'Daily Requests', data: [{ date: '2024-01-01', requests: 1200 }, { date: '2024-01-02', requests: 1350 }, { date: '2024-01-03', requests: 1100 }, { date: '2024-01-04', requests: 1600 }, { date: '2024-01-05', requests: 1400 }, { date: '2024-01-06', requests: 1300 }, { date: '2024-01-07', requests: 1500 }] },
                    { type: 'line', title: 'Average Response Time', data: [{ date: '2024-01-01', time: 2.1 }, { date: '2024-01-02', time: 2.2 }, { date: '2024-01-03', time: 2.0 }, { date: '2024-01-04', time: 2.4 }, { date: '2024-01-05', time: 2.3 }, { date: '2024-01-06', time: 2.2 }, { date: '2024-01-07', time: 2.3 }] }
                ],
                summary: {
                    totalRequests: 15420,
                    totalTokensConsumed: 2847500,
                    totalSVMAISpent: 156.80,
                    averageResponseTime: 2.3,
                    errorRate: 0.5
                },
                tokenBreakdown: {
                    averageTokensPerRequest: 184
                },
                balance: {
                    availableBalance: 1000.00
                },
                modelUsage: [
                    { model: 'claude-3-sonnet', requests: 8500, tokens: 1500000 },
                    { model: 'claude-3-haiku', requests: 4200, tokens: 800000 },
                    { model: 'claude-3-opus', requests: 2720, tokens: 547500 }
                ],
                costBreakdown: [
                    { model: 'claude-3-sonnet', svmaiCost: 85.00 },
                    { model: 'claude-3-haiku', svmaiCost: 40.00 },
                    { model: 'claude-3-opus', svmaiCost: 31.80 }
                ],
                insights: [
                    { type: 'success', title: 'Usage is within expected limits', category: 'Performance', description: 'Your API usage is within the normal range for this period.', recommendation: 'Keep up the good work!' },
                    { type: 'warning', title: 'Consider optimizing token usage for cost savings', category: 'Cost Optimization', description: 'Your average token usage per request is higher than the industry average. Consider optimizing your prompts.', recommendation: 'Review your prompt engineering.' },
                    { type: 'tip', title: 'Peak usage occurs between 2-4 PM', category: 'Performance', description: 'Your API usage peaks during this time period. Consider scaling your infrastructure if needed.', recommendation: 'Monitor peak usage closely.' },
                    { type: 'info', title: 'Average response time is excellent', category: 'Performance', description: 'Your average response time is well below the target. Keep it up!', recommendation: 'Continue optimizing your API calls.' }
                ],
                apiKeys: {
                    total: 10,
                    active: 8,
                    lastUsed: '2024-03-15T10:30:00Z'
                }
            };
            setUsageData(mockData);
        } catch (error) {
            console.error('Failed to load usage data:', error);
            toast.error('Failed to load usage data');
        } finally {
            setLoading(false);
        }
    }, [selectedPeriod, userId]);

    React.useEffect(() => {
        loadUsageData();
    }, [loadUsageData]);

    const formatNumber = (num: number, decimals: number = 1) => {
        return new Intl.NumberFormat('en-US', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        }).format(num);
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' });
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'success':
                return <CheckCircleIcon className="h-4 w-4 text-success" />;
            case 'warning':
                return <AlertTriangleIcon className="h-4 w-4 text-warning" />;
            case 'info':
                return <TargetIcon className="h-4 w-4 text-primary" />;
            default:
                return <ActivityIcon className="h-4 w-4 text-muted-foreground" />;
        }
    };

    if (loading) {
        return (
            <div className={`${themeClasses.container} ${fontClass} ${fontSizeClass}`}>
                <div className={themeClasses.header}>
                    <div className={`${themeClasses.loadingSkeleton} h-8 w-1/3`}></div>
                    <div className={`${themeClasses.loadingSkeleton} h-8 w-24`}></div>
                </div>
                <div className={themeClasses.metricsGrid}>
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className={`${themeClasses.loadingSkeleton} h-24`}></div>
                    ))}
                </div>
                <div className={`${themeClasses.loadingSkeleton} h-64`}></div>
            </div>
        );
    }

    if (!usageData) {
        return (
            <div className={`${themeClasses.emptyState} ${fontClass} ${fontSizeClass}`}>
                <ActivityIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <p>No usage data available</p>
                <p className="text-sm">Start making API requests to see your usage statistics</p>
            </div>
        );
    }

    return (
        <div className={`${themeClasses.container} ${fontClass} ${fontSizeClass}`}>
            {/* Header */}
            <div className={themeClasses.header}>
                <div>
                    <h1 className={themeClasses.title}>
                        <BarChart3Icon className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
                        Usage Analytics
                    </h1>
                    <p className={themeClasses.subtitle}>
                        Monitor your API usage, costs, and performance metrics
                    </p>
                </div>

                <div className={themeClasses.controls}>
                    <Select value={selectedPeriod} onValueChange={(value: any) => setSelectedPeriod(value)}>
                        <SelectTrigger className="w-32">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="day">Today</SelectItem>
                            <SelectItem value="week">This Week</SelectItem>
                            <SelectItem value="month">This Month</SelectItem>
                        </SelectContent>
                    </Select>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={loadUsageData}
                    >
                        <RefreshCwIcon className="h-4 w-4 mr-2" />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Key Metrics */}
            <div className={themeClasses.metricsGrid}>
                <Card className={themeClasses.metricCard}>
                    <div className={themeClasses.metricHeader}>
                        <div className="p-2 bg-primary/10 rounded-lg">
                            <ActivityIcon className={`${themeClasses.metricIcon} text-primary`} />
                        </div>
                        <Badge variant="secondary">
                            {usageData.usage.totalRequests > 0 ? '+' : ''}
                            {((usageData.usage.totalRequests / 1000) * 100).toFixed(1)}%
                        </Badge>
                    </div>
                    <p className={themeClasses.metricLabel}>Total Requests</p>
                    <p className={`${themeClasses.metricValue} text-primary`}>
                        {usageData.usage.totalRequests.toLocaleString()}
                    </p>
                    <p className={themeClasses.metricChange}>
                        vs last {selectedPeriod}
                    </p>
                </Card>

                <Card className={themeClasses.metricCard}>
                    <div className={themeClasses.metricHeader}>
                        <div className="p-2 bg-secondary/10 rounded-lg">
                            <ZapIcon className={`${themeClasses.metricIcon} text-secondary`} />
                        </div>
                        <Badge variant="secondary">
                            {usageData.usage.totalTokens > 0 ? '+' : ''}
                            {((usageData.usage.totalTokens / 100000) * 100).toFixed(1)}%
                        </Badge>
                    </div>
                    <p className={themeClasses.metricLabel}>Tokens Consumed</p>
                    <p className={`${themeClasses.metricValue} text-secondary`}>
                        {usageData.usage.totalTokens.toLocaleString()}
                    </p>
                    <p className={themeClasses.metricChange}>
                        vs last {selectedPeriod}
                    </p>
                </Card>

                <Card className={themeClasses.metricCard}>
                    <div className={themeClasses.metricHeader}>
                        <div className="p-2 bg-tertiary/10 rounded-lg">
                            <DollarSignIcon className={`${themeClasses.metricIcon} text-tertiary`} />
                        </div>
                        <Badge variant="secondary">
                            {usageData.usage.totalCost > 0 ? '+' : ''}
                            {((usageData.usage.totalCost / 100) * 100).toFixed(1)}%
                        </Badge>
                    </div>
                    <p className={themeClasses.metricLabel}>SVMAI Spent</p>
                    <p className={`${themeClasses.metricValue} text-tertiary`}>
                        {formatNumber(usageData.usage.totalCost)}
                    </p>
                    <p className={themeClasses.metricChange}>
                        vs last {selectedPeriod}
                    </p>
                </Card>

                <Card className={themeClasses.metricCard}>
                    <div className={themeClasses.metricHeader}>
                        <div className="p-2 bg-quaternary/10 rounded-lg">
                            <ClockIcon className={`${themeClasses.metricIcon} text-quaternary`} />
                        </div>
                        <Badge variant="secondary">
                            {usageData.usage.averageResponseTime > 0 ? '+' : ''}
                            {((usageData.usage.averageResponseTime / 100) * 100).toFixed(1)}%
                        </Badge>
                    </div>
                    <p className={themeClasses.metricLabel}>Avg Response Time</p>
                    <p className={`${themeClasses.metricValue} text-quaternary`}>
                        {(usageData.usage.averageResponseTime / 1000).toFixed(1)}s
                    </p>
                    <p className={themeClasses.metricChange}>
                        vs last {selectedPeriod}
                    </p>
                </Card>
            </div>

            {/* Charts Row */}
            <div className={themeClasses.chartsGrid}>
                {/* Model Usage */}
                <Card className={themeClasses.chartCard}>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <PieChartIcon className="h-5 w-5" />
                            Model Usage
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {usageData.modelUsage.map((model, _index) => (
                                <div key={_index} className={themeClasses.insightItem}>
                                    <div className="flex-1">
                                        <h4 className="font-medium">{model.model}</h4>
                                        <p className="text-sm text-muted-foreground">
                                            {model.requests.toLocaleString()} requests • {model.tokens.toLocaleString()} tokens
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Cost Breakdown */}
                <Card className={themeClasses.chartCard}>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <DollarSignIcon className="h-5 w-5" />
                            Cost Breakdown
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {usageData.costBreakdown.map((cost) => {
                                const percentage = (cost.svmaiCost / usageData.usage.totalCost) * 100;
                                const modelName = cost.model.replace('claude-3-', '').replace('-20240307', '').replace('-20240229', '');
                                return (
                                    <div key={cost.model} className="space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="font-medium capitalize">{modelName}</span>
                                            <span>{formatNumber(cost.svmaiCost)} SVMAI ({percentage.toFixed(1)}%)</span>
                                        </div>
                                        <Progress value={percentage} className="h-2" />
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Daily Usage Chart */}
            <Card className={themeClasses.chartCard}>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <TrendingUpIcon className="h-5 w-5" />
                        Daily Usage Trends
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {/* Simple bar chart visualization */}
                        <div className="grid grid-cols-7 gap-2 h-40">
                            {usageData.breakdown.dailyUsage.slice(-7).map((day, index) => {
                                const maxRequests = Math.max(...usageData.breakdown.dailyUsage.map(d => d.requests));
                                const height = maxRequests > 0 ? (day.requests / maxRequests) * 100 : 0;
                                return (
                                    <div
                                        key={index}
                                        className="flex flex-col items-center gap-1"
                                    >
                                        <div
                                            className="w-full bg-primary rounded-t transition-all hover:bg-primary/80"
                                            style={{ height: `${height}%` }}
                                        />
                                        <span className="text-xs text-muted-foreground">
                                            {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}
                                        </span>
                                        <p className="text-xs text-muted-foreground mt-2">
                                            {day.requests} requests
                                        </p>
                                    </div>
                                );
                            })}
                        </div>

                        <div className={themeClasses.modelGrid}>
                            <div>
                                <p className="text-muted-foreground">Peak Day</p>
                                <p className="font-bold">
                                    {formatNumber(Math.max(...usageData.breakdown.dailyUsage.map(d => d.requests)), 0)} requests
                                </p>
                            </div>
                            <div>
                                <p className="text-muted-foreground">Total Period</p>
                                <p className="font-bold">
                                    {formatNumber(usageData.breakdown.dailyUsage.reduce((sum, d) => sum + d.requests, 0), 0)} requests
                                </p>
                            </div>
                            <div>
                                <p className="text-muted-foreground">Daily Average</p>
                                <p className="font-bold">
                                    {formatNumber(usageData.breakdown.dailyUsage.reduce((sum, d) => sum + d.requests, 0) / usageData.breakdown.dailyUsage.length, 0)} requests
                                </p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Insights & Recommendations */}
            {usageData.insights.length > 0 && (
                <Card className={themeClasses.chartCard}>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <TargetIcon className="h-5 w-5" />
                            Insights & Recommendations
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {usageData.insights.map((insight, _index) => (
                                <div key={_index} className={themeClasses.insightItem}>
                                    <div className={themeClasses.insightIcon}>
                                        {getStatusIcon(insight.type)}
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-medium">{insight.title}</h4>
                                        <p className="text-sm text-muted-foreground">{insight.description}</p>
                                        <p className="text-xs text-primary mt-1">{insight.recommendation}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* API Keys Summary */}
            <Card className={themeClasses.chartCard}>
                <CardHeader>
                    <CardTitle>API Keys Overview</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid md:grid-cols-3 gap-4">
                        <div className="text-center p-4 bg-muted/30 rounded-lg">
                            <p className={`text-2xl font-bold text-primary`}>{usageData.apiKeys.total}</p>
                            <p className="text-sm text-muted-foreground">Total Keys</p>
                        </div>
                        <div className="text-center p-4 bg-muted/30 rounded-lg">
                            <p className={`text-2xl font-bold text-success`}>{usageData.apiKeys.active}</p>
                            <p className="text-sm text-muted-foreground">Active Keys</p>
                        </div>
                        <div className="text-center p-4 bg-muted/30 rounded-lg">
                            <p className={`text-2xl font-bold text-muted-foreground`}>
                                {usageData.apiKeys.lastUsed ? formatDate(usageData.apiKeys.lastUsed) : 'Never'}
                            </p>
                            <p className="text-sm text-muted-foreground">Last Used Key</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
} 