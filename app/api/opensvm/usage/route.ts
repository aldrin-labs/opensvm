import { NextRequest, NextResponse } from 'next/server';
import { UsageReporter } from '../../../../lib/anthropic-proxy/reporting/UsageReporter';
import { JWTAuth } from '../../../../lib/anthropic-proxy/auth/JWTAuth';
import { globalUsageAnalytics } from '../../../../lib/anthropic-proxy/analytics/UsageAnalytics';
import { globalChartMapper } from '../../../../lib/anthropic-proxy/utils/ChartDataMapper';

const usageReporter = new UsageReporter();
const jwtAuth = new JWTAuth();

// Enhanced user authentication with JWT support
function authenticateUser(request: NextRequest): { isValid: boolean; userId?: string; error?: string } {
    const authHeader = request.headers.get('Authorization');

    // Try JWT authentication first
    const jwtResult = jwtAuth.requireAuth(authHeader);
    if (jwtResult.isValid) {
        return {
            isValid: true,
            userId: jwtResult.userId
        };
    }

    // Fallback to X-User-ID for testing/development
    const userIdHeader = request.headers.get('X-User-ID');
    if (userIdHeader && process.env.NODE_ENV !== 'production') {
        console.warn('Using fallback X-User-ID authentication in non-production environment');
        return {
            isValid: true,
            userId: userIdHeader
        };
    }

    return {
        isValid: false,
        error: jwtResult.error || 'Authentication required'
    };
}

export async function GET(request: NextRequest) {
    try {
        const authResult = authenticateUser(request);
        if (!authResult.isValid) {
            return NextResponse.json(
                { error: authResult.error || 'Authentication required' },
                { status: 401 }
            );
        }

        const userId = authResult.userId;
        if (!userId) {
            return NextResponse.json(
                { error: 'Authentication failed to extract user ID' },
                { status: 500 }
            );
        }

        const url = new URL(request.url);

        // Enhanced filtering options
        const filters = {
            period: url.searchParams.get('period') as 'day' | 'week' | 'month' || 'month',
            keyId: url.searchParams.get('keyId'),
            model: url.searchParams.get('model'),
            startDate: url.searchParams.get('startDate'),
            endDate: url.searchParams.get('endDate'),
            minCost: url.searchParams.get('minCost'),
            maxCost: url.searchParams.get('maxCost'),
            minTokens: url.searchParams.get('minTokens'),
            maxTokens: url.searchParams.get('maxTokens'),
            status: url.searchParams.get('status') as 'success' | 'error' | null,
            sortBy: url.searchParams.get('sortBy') as 'date' | 'cost' | 'tokens' | 'model' || 'date',
            sortOrder: url.searchParams.get('sortOrder') as 'asc' | 'desc' || 'desc',
            limit: parseInt(url.searchParams.get('limit') || '100'),
            offset: parseInt(url.searchParams.get('offset') || '0'),
            groupBy: url.searchParams.get('groupBy') as 'hour' | 'day' | 'week' | 'month' || null,
            includeMetadata: url.searchParams.get('includeMetadata') === 'true'
        };

        // Validate and sanitize filters
        const sanitizedFilters = {
            ...filters,
            limit: Math.min(Math.max(filters.limit, 1), 1000), // Limit between 1-1000
            offset: Math.max(filters.offset, 0),
            startDate: filters.startDate ? new Date(filters.startDate) : undefined,
            endDate: filters.endDate ? new Date(filters.endDate) : undefined,
            minCost: filters.minCost ? parseFloat(filters.minCost) : undefined,
            maxCost: filters.maxCost ? parseFloat(filters.maxCost) : undefined,
            minTokens: filters.minTokens ? parseInt(filters.minTokens) : undefined,
            maxTokens: filters.maxTokens ? parseInt(filters.maxTokens) : undefined
        };

        // Generate analytics
        const analytics = await globalUsageAnalytics.generateAnalytics(authResult.userId!, filters.period);

        // Apply additional filtering to analytics data
        const filteredAnalytics = await applyAdvancedFilters(analytics, sanitizedFilters);

        // Generate forecast for next 7 days
        const forecast = await globalUsageAnalytics.generateForecast(authResult.userId!, 7);

        // If specific key requested, get key usage stats
        let keyUsageStats = null;
        if (filters.keyId) {
            try {
                keyUsageStats = await usageReporter.getKeyUsageStats(filters.keyId);
            } catch (error) {
                console.warn('Failed to get key usage stats:', error);
            }
        }

        // Prepare comprehensive response with filtered data
        const response = {
            filters: sanitizedFilters,
            period: filters.period,
            userId: authResult.userId,
            analytics: {
                metrics: filteredAnalytics.metrics,
                modelBreakdown: filteredAnalytics.modelBreakdown,
                timeSeries: filteredAnalytics.timeSeries,
                recentActivity: filteredAnalytics.recentActivity
            },
            forecast: {
                next7Days: forecast,
                confidence: forecast.confidence,
                basedOnDays: 30
            },
            keyStats: keyUsageStats,
            pagination: {
                limit: sanitizedFilters.limit,
                offset: sanitizedFilters.offset,
                total: filteredAnalytics.totalCount || filteredAnalytics.metrics.totalRequests,
                hasMore: (sanitizedFilters.offset + sanitizedFilters.limit) < (filteredAnalytics.totalCount || filteredAnalytics.metrics.totalRequests)
            },
            charts: [
                globalChartMapper.createTimeSeriesChart(
                    filteredAnalytics.timeSeries,
                    { title: 'Usage Over Time', xAxis: 'Time', yAxis: 'Requests' },
                    (point) => point.requests,
                    (point) => point.date
                ),
                globalChartMapper.createCategoricalChart(
                    filteredAnalytics.modelBreakdown,
                    { title: 'Usage by Model' },
                    (model) => model.model,
                    (model) => model.requests,
                    'pie'
                ),
                globalChartMapper.createCategoricalChart(
                    filteredAnalytics.modelBreakdown,
                    { title: 'Cost by Model' },
                    (model) => model.model,
                    (model) => model.cost,
                    'bar'
                ),
                globalChartMapper.createTimeSeriesChart(
                    filteredAnalytics.timeSeries,
                    { title: 'Error Rate Trend', xAxis: 'Time', yAxis: 'Error Rate (%)' },
                    (point) => point.requests > 0 ? (point.errors / point.requests) * 100 : 0,
                    (point) => point.date
                )
            ].filter(chart => !chart.isEmpty) // Filter out empty/error charts
        };

        return NextResponse.json(response);

    } catch (error) {
        console.error('Error fetching usage statistics:', error);
        return NextResponse.json(
            { error: 'Failed to fetch usage statistics' },
            { status: 500 }
        );
    }
}

export async function OPTIONS(_request: NextRequest) {
    const { getCorsHeaders } = await import('@/lib/cors-utils');
    const corsHeaders = getCorsHeaders(request);
    return new NextResponse(null, {
        status: 204,
        headers: {
            ...corsHeaders,
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-ID',
            'Access-Control-Max-Age': '86400'
        }
    });
}

// Advanced filtering helper function
async function applyAdvancedFilters(analytics: any, filters: any): Promise<any> {
    let filteredAnalytics = { ...analytics };

    // Filter model breakdown
    if (filters.model) {
        filteredAnalytics.modelBreakdown = analytics.modelBreakdown.filter(
            (model: any) => model.model.toLowerCase().includes(filters.model.toLowerCase())
        );
    }

    // Filter by cost range
    if (filters.minCost !== undefined || filters.maxCost !== undefined) {
        filteredAnalytics.modelBreakdown = filteredAnalytics.modelBreakdown.filter((model: any) => {
            if (filters.minCost !== undefined && model.cost < filters.minCost) return false;
            if (filters.maxCost !== undefined && model.cost > filters.maxCost) return false;
            return true;
        });
    }

    // Filter by token range
    if (filters.minTokens !== undefined || filters.maxTokens !== undefined) {
        filteredAnalytics.modelBreakdown = filteredAnalytics.modelBreakdown.filter((model: any) => {
            if (filters.minTokens !== undefined && model.tokens < filters.minTokens) return false;
            if (filters.maxTokens !== undefined && model.tokens > filters.maxTokens) return false;
            return true;
        });
    }

    // Filter recent activity by status
    if (filters.status) {
        filteredAnalytics.recentActivity = analytics.recentActivity.filter(
            (activity: any) => activity.status === filters.status
        );
    }

    // Apply sorting to model breakdown
    if (filters.sortBy && filters.sortBy !== 'date') {
        const sortKey = filters.sortBy;
        const isAsc = filters.sortOrder === 'asc';

        filteredAnalytics.modelBreakdown.sort((a: any, b: any) => {
            const valueA = a[sortKey] || 0;
            const valueB = b[sortKey] || 0;
            return isAsc ? valueA - valueB : valueB - valueA;
        });
    }

    // Apply pagination to recent activity
    const startIndex = filters.offset;
    const endIndex = startIndex + filters.limit;
    filteredAnalytics.recentActivity = filteredAnalytics.recentActivity.slice(startIndex, endIndex);

    // Recalculate metrics based on filtered data
    if (filters.model || filters.minCost || filters.maxCost || filters.minTokens || filters.maxTokens) {
        filteredAnalytics.metrics = recalculateMetrics(filteredAnalytics.modelBreakdown);
    }

    return filteredAnalytics;
}

// Helper to recalculate metrics from filtered data
function recalculateMetrics(modelBreakdown: any[]): any {
    const totalRequests = modelBreakdown.reduce((sum, model) => sum + model.requests, 0);
    const totalTokens = modelBreakdown.reduce((sum, model) => sum + model.tokens, 0);
    const totalCost = modelBreakdown.reduce((sum, model) => sum + model.cost, 0);
    const totalErrors = modelBreakdown.reduce((sum, model) => sum + (model.requests * model.errorRate / 100), 0);

    return {
        totalRequests,
        totalTokens,
        totalCost,
        averageResponseTime: 0, // Would need more detailed data
        errorRate: totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0,
        uniqueModelsUsed: modelBreakdown.length,
        peakHour: 0, // Would need hourly data
        averageTokensPerRequest: totalRequests > 0 ? totalTokens / totalRequests : 0
    };
} 