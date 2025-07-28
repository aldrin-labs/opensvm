'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Progress } from '../ui/progress';
import {
    BarChart3,
    TrendingUp,
    Clock,
    Zap,
    DollarSign,
    Calendar,
    RefreshCw,
    Download,
    Filter,
    Activity,
    CheckCircle,
    AlertCircle,
    Target,
    PieChart
} from 'lucide-react';
import { toast } from 'sonner';
import { useSettings } from '@/lib/settings';

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
    const [usageData, setUsageData] = useState<UsageData | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedPeriod, setSelectedPeriod] = useState<'day' | 'week' | 'month'>('month');
    const [selectedModel, setSelectedModel] = useState<string>('all');

    // Get user settings for theme and font
    const settings = useSettings();

    // Theme-aware CSS classes
    const themeClasses = {
        container: "space-y-4 sm:space-y-6 p-4 sm:p-6",
        header: "flex flex-col sm:flex-row sm:items-center justify-between gap-4",
        title: "text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2",
        subtitle: "text-muted-foreground mt-2",
        controls: "flex flex-col sm:flex-row gap-2 sm:gap-4",
        metricsGrid: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4",
        metricCard: "p-4 sm:p-6 bg-card border rounded-lg",
        metricHeader: "flex items-center justify-between mb-2",
        metricIcon: "h-4 w-4 sm:h-5 sm:w-5",
        metricTitle: "text-sm font-medium text-muted-foreground",
        metricValue: "text-2xl sm:text-3xl font-bold",
        metricChange: "text-xs text-muted-foreground",
        chartsGrid: "grid lg:grid-cols-2 gap-4 sm:gap-6",
        chartCard: "p-4 sm:p-6",
        chartTitle: "text-lg font-semibold mb-4",
        chartPlaceholder: "h-64 bg-muted/30 rounded-lg flex items-center justify-center text-muted-foreground",
        modelGrid: "grid sm:grid-cols-2 lg:grid-cols-3 gap-4",
        modelCard: "p-4 bg-muted/30 rounded-lg",
        modelName: "font-medium text-sm mb-2",
        modelStats: "space-y-1 text-xs text-muted-foreground",
        loadingSkeleton: "animate-pulse bg-muted rounded",
        emptyState: "text-center py-8 text-muted-foreground"
    };

    // Apply font family from settings
    const fontClass = settings.fontFamily === 'berkeley' ? 'font-mono' :
        settings.fontFamily === 'jetbrains' ? 'font-mono' :
            'font-sans';

    // Apply font size from settings
    const fontSizeClass = settings.fontSize === 'small' ? 'text-sm' :
        settings.fontSize === 'large' ? 'text-lg' :
            'text-base';

    useEffect(() => {
        loadUsageData();
    }, [selectedPeriod]);

    const loadUsageData = async () => {
        try {
            setLoading(true);
            const period = selectedPeriod === 'all_time' ? '' : selectedPeriod;
            const response = await fetch(`/api/opensvm/usage?period=${period}`, {
                headers: {
                    'x-user-id': 'current-user', // TODO: Get from auth context
                },
            });

            if (response.ok) {
                const data = await response.json();
                setUsageData(data.data);
            } else {
                toast.error('Failed to load usage data');
            }
        } catch (error) {
            toast.error('Error loading usage data');
        } finally {
            setLoading(false);
        }
    };

    const exportUsageData = async () => {
        try {
            // TODO: Implement actual export functionality
            const csvData = generateCSVData();
            const blob = new Blob([csvData], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `usage-data-${selectedPeriod}-${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
            window.URL.revokeObjectURL(url);
            toast.success('Usage data exported successfully!');
        } catch (error) {
            toast.error('Failed to export usage data');
        }
    };

    const generateCSVData = () => {
        if (!usageData) return '';

        const headers = ['Date', 'Requests', 'Tokens', 'SVMAI Cost'];
        const rows = usageData.dailyUsage.map(day => [
            day.date,
            day.requests.toString(),
            day.tokens.toString(),
            day.svmaiCost.toFixed(2)
        ]);

        return [headers, ...rows].map(row => row.join(',')).join('\n');
    };

    const formatNumber = (num: number, decimals: number = 1) => {
        if (num >= 1000000) {
            return `${(num / 1000000).toFixed(decimals)}M`;
        } else if (num >= 1000) {
            return `${(num / 1000).toFixed(decimals)}K`;
        }
        return num.toFixed(decimals);
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' });
    };

    const getInsightIcon = (type: string) => {
        switch (type) {
            case 'success':
                return <CheckCircle className="h-4 w-4 text-success" />;
            case 'warning':
                return <AlertCircle className="h-4 w-4 text-warning" />;
            case 'tip':
                return <Target className="h-4 w-4 text-primary" />;
            case 'info':
                return <Activity className="h-4 w-4 text-muted-foreground" />;
            default:
                return null;
        }
    };

    const getInsightColor = (type: string) => {
        switch (type) {
            case 'success':
                return 'border-green-200 bg-green-50';
            case 'warning':
                return 'border-yellow-200 bg-yellow-50';
            case 'tip':
                return 'border-blue-200 bg-blue-50';
            case 'info':
                return 'border-gray-200 bg-gray-50';
            default:
                return 'border-gray-200 bg-gray-50';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'success':
                return <CheckCircle className="h-4 w-4 text-success" />;
            case 'warning':
                return <AlertCircle className="h-4 w-4 text-warning" />;
            case 'info':
                return <Target className="h-4 w-4 text-primary" />;
            default:
                return <Activity className="h-4 w-4 text-muted-foreground" />;
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
                <Activity className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
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
                        <BarChart3 className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
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
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Key Metrics */}
            <div className={themeClasses.metricsGrid}>
                <Card className={themeClasses.metricCard}>
                    <div className={themeClasses.metricHeader}>
                        <div className="p-2 bg-primary/10 rounded-lg">
                            <Activity className={`${themeClasses.metricIcon} text-primary`} />
                        </div>
                        <Badge variant="secondary">
                            {usageData.usage.totalRequests > 0 ? '+' : ''}
                            {((usageData.usage.totalRequests / 1000) * 100).toFixed(1)}%
                        </Badge>
                    </div>
                    <p className={themeClasses.metricTitle}>Total Requests</p>
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
                            <Zap className={`${themeClasses.metricIcon} text-secondary`} />
                        </div>
                        <Badge variant="secondary">
                            {usageData.usage.totalTokens > 0 ? '+' : ''}
                            {((usageData.usage.totalTokens / 100000) * 100).toFixed(1)}%
                        </Badge>
                    </div>
                    <p className={themeClasses.metricTitle}>Tokens Consumed</p>
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
                            <DollarSign className={`${themeClasses.metricIcon} text-tertiary`} />
                        </div>
                        <Badge variant="secondary">
                            {usageData.usage.totalCost > 0 ? '+' : ''}
                            {((usageData.usage.totalCost / 100) * 100).toFixed(1)}%
                        </Badge>
                    </div>
                    <p className={themeClasses.metricTitle}>SVMAI Spent</p>
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
                            <Clock className={`${themeClasses.metricIcon} text-quaternary`} />
                        </div>
                        <Badge variant="secondary">
                            {usageData.usage.averageResponseTime > 0 ? '+' : ''}
                            {((usageData.usage.averageResponseTime / 100) * 100).toFixed(1)}%
                        </Badge>
                    </div>
                    <p className={themeClasses.metricTitle}>Avg Response Time</p>
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
                            <PieChart className="h-5 w-5" />
                            Model Usage
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {usageData.modelUsage.map((model, index) => {
                                const percentage = (model.tokens / usageData.usage.totalTokens) * 100;
                                const modelName = model.model.replace('claude-3-', '').replace('-20240307', '').replace('-20240229', '');
                                return (
                                    <div key={model.model} className="space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="font-medium capitalize">{modelName}</span>
                                            <span>{formatNumber(model.tokens, 0)} ({percentage.toFixed(1)}%)</span>
                                        </div>
                                        <Progress value={percentage} className="h-2" />
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>

                {/* Cost Breakdown */}
                <Card className={themeClasses.chartCard}>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <DollarSign className="h-5 w-5" />
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
                        <TrendingUp className="h-5 w-5" />
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
                            <Target className="h-5 w-5" />
                            Insights & Recommendations
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {usageData.insights.map((insight, index) => (
                                <div key={index} className={themeClasses.modelCard}>
                                    <div className="flex items-start gap-3">
                                        {getStatusIcon(insight.type)}
                                        <div className="flex-1">
                                            <h4 className="font-medium text-foreground">{insight.title}</h4>
                                            <p className="text-sm text-muted-foreground mb-2">
                                                {insight.description}
                                            </p>
                                            <p className="text-xs text-primary font-medium">
                                                💡 {insight.recommendation}
                                            </p>
                                        </div>
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