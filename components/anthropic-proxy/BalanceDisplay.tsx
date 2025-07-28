'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import {
    Wallet,
    TrendingDown,
    Clock,
    AlertTriangle,
    Plus,
    RefreshCw,
    ArrowUpRight,
    DollarSign
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useSettings } from '@/lib/settings';
import SVMAIDepositModal from './SVMAIDepositModal';

interface BalanceDisplayProps {
    variant?: 'compact' | 'card' | 'dashboard';
    className?: string;
    showDepositButton?: boolean;
    showWarnings?: boolean;
    refreshInterval?: number;
}

interface BalanceData {
    balance: {
        current: number;
        available: number;
        reserved: number;
        total: number;
    };
    hasSufficientBalance: boolean;
    usageStats: {
        totalSpent: number;
        averageCostPerRequest: number;
        requestsThisMonth: number;
        tokensThisMonth: number;
    };
    recentTransactions: Array<{
        id: string;
        type: 'deposit' | 'deduction' | 'refund';
        amount: number;
        description: string;
        timestamp: string;
        status: 'pending' | 'completed' | 'failed';
    }>;
    transactionSummary: {
        totalDeposits: number;
        totalSpent: number;
        netBalance: number;
        transactionCount: number;
    };
    deposit: {
        multisigAddress: string;
        tokenMint: string;
        minimumAmount: number;
    };
    warnings: {
        lowBalance: boolean;
        highBurnRate: boolean;
        noBalance: boolean;
    };
    monthly: {
        spending: number;
        estimatedMonthlyBurn: number;
    };
    lifetime: {
        totalSpent: number;
        totalDeposited: number;
    };
}

export default function BalanceDisplay({
    variant = 'card',
    className = '',
    showDepositButton = true,
    showWarnings = true,
    refreshInterval = 30
}: BalanceDisplayProps = {}) {
    const [balance, setBalance] = useState<BalanceData | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [showDepositModal, setShowDepositModal] = useState(false);

    // Get user settings for theme and font
    const settings = useSettings();

    // Theme-aware CSS classes
    const themeClasses = {
        container: "space-y-4 sm:space-y-6 p-4 sm:p-6",
        loadingSkeleton: "animate-pulse bg-muted rounded",
        header: "flex flex-col sm:flex-row sm:items-center justify-between gap-4",
        title: "text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2",
        balanceCard: "border-2 border-primary/20 bg-primary/5",
        balanceHeader: "flex flex-col sm:flex-row sm:items-center justify-between gap-4",
        balanceTitle: "text-primary flex items-center gap-2",
        balanceGrid: "grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6",
        balanceItem: "text-center",
        balanceLabel: "text-sm text-muted-foreground",
        balanceValue: "text-xl sm:text-2xl font-bold",
        balanceUnit: "text-base sm:text-lg text-muted-foreground ml-2",
        warningCard: "border-warning/20 bg-warning/5",
        warningHeader: "text-warning flex items-center gap-2",
        warningText: "text-sm text-warning/80",
        statsGrid: "grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6",
        statCard: "p-4 bg-muted/30 rounded-lg",
        statHeader: "flex items-center gap-2 mb-2",
        statIcon: "h-4 w-4 sm:h-5 sm:w-5",
        statTitle: "font-medium text-sm sm:text-base",
        statValue: "text-xl sm:text-2xl font-bold",
        statSubtext: "text-sm text-muted-foreground mt-1",
        transactionItem: "flex items-center justify-between p-3 bg-muted/50 rounded-lg",
        transactionMeta: "text-sm text-muted-foreground",
        compactBalanceValue: "text-2xl sm:text-3xl font-bold",
        compactBalanceUnit: "text-base sm:text-lg text-muted-foreground",
        compactWarning: "flex items-center gap-2 p-2 bg-warning/10 rounded-lg text-sm text-warning/80"
    };

    // Apply font family from settings
    const fontClass = settings.fontFamily === 'berkeley' ? 'font-mono' :
        settings.fontFamily === 'jetbrains' ? 'font-mono' :
            'font-sans';

    // Apply font size from settings
    const fontSizeClass = settings.fontSize === 'small' ? 'text-sm' :
        settings.fontSize === 'large' ? 'text-lg' :
            'text-base';

    // Helper function to get balance color based on amount
    const getBalanceColor = (amount: number) => {
        if (amount >= 1000) return 'text-success';
        if (amount >= 100) return 'text-foreground';
        if (amount >= 50) return 'text-warning';
        return 'text-destructive';
    };

    const loadBalance = useCallback(async () => {
        try {
            const response = await fetch('/api/opensvm/balance', {
                headers: {
                    'x-user-id': 'current-user', // TODO: Get from auth context
                },
            });

            if (response.ok) {
                const data = await response.json();
                setBalance(data.data);
                setLastUpdated(new Date());
            } else {
                toast.error('Failed to load balance');
            }
        } catch (error) {
            toast.error('Error loading balance');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadBalance();

        // Set up auto-refresh
        if (refreshInterval > 0) {
            const interval = setInterval(loadBalance, refreshInterval * 1000);
            return () => clearInterval(interval);
        }
    }, [refreshInterval, loadBalance]);

    const refreshBalance = async () => {
        setRefreshing(true);
        await loadBalance();
        setRefreshing(false);
    };

    const formatBalance = (amount: number) => {
        if (amount >= 1000000) {
            return `${(amount / 1000000).toFixed(1)}M`;
        } else if (amount >= 1000) {
            return `${(amount / 1000).toFixed(1)}K`;
        }
        return amount.toFixed(1);
    };

    const formatTimeAgo = (date: Date) => {
        const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
        if (seconds < 60) return 'Just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        return `${Math.floor(seconds / 86400)}d ago`;
    };

    const getBalanceStatus = (amount: number) => {
        if (amount <= 0) return { label: 'Empty', color: 'bg-red-100 text-red-800' };
        if (amount < 10) return { label: 'Critical', color: 'bg-red-100 text-red-800' };
        if (amount < 50) return { label: 'Low', color: 'bg-yellow-100 text-yellow-800' };
        if (amount < 200) return { label: 'Good', color: 'bg-green-100 text-green-800' };
        return { label: 'Excellent', color: 'bg-blue-100 text-blue-800' };
    };

    const onDepositSuccess = (amount: number) => {
        toast.success(`Successfully deposited ${amount} SVMAI!`);
        loadBalance(); // Refresh balance
        setShowDepositModal(false);
    };

    if (loading) {
        return (
            <div className={`${fontClass} ${fontSizeClass} ${className}`}>
                {variant === 'compact' ? (
                    <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 ${themeClasses.loadingSkeleton}`}></div>
                        <div className={`w-20 h-4 ${themeClasses.loadingSkeleton}`}></div>
                    </div>
                ) : (
                    <Card>
                        <CardContent className="p-4">
                            <div className="space-y-2">
                                <div className={`w-24 h-4 ${themeClasses.loadingSkeleton}`}></div>
                                <div className={`w-32 h-6 ${themeClasses.loadingSkeleton}`}></div>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        );
    }

    if (!balance) {
        return (
            <div className={`text-destructive text-sm ${fontClass} ${fontSizeClass} ${className}`}>
                Failed to load balance
            </div>
        );
    }

    // Compact variant for headers/navbars
    if (variant === 'compact') {
        return (
            <div className={`flex items-center gap-2 ${fontClass} ${fontSizeClass} ${className}`}>
                <Wallet className="h-5 w-5 text-primary" />
                <div className="flex flex-col">
                    <span className={`${themeClasses.compactBalanceValue} ${getBalanceColor(balance.balance.available)}`}>
                        {formatBalance(balance.balance.available)}
                    </span>
                    <span className={themeClasses.compactBalanceUnit}>SVMAI</span>
                    {balance.balance.reserved > 0 && (
                        <span className="text-sm text-warning">
                            {formatBalance(balance.balance.reserved)} reserved
                        </span>
                    )}
                </div>

                {/* Low balance warning */}
                {!balance.hasSufficientBalance && (
                    <div className={themeClasses.compactWarning}>
                        <AlertTriangle className="h-4 w-4 text-warning" />
                        <span>Low balance</span>
                    </div>
                )}

                {showDepositButton && (
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowDepositModal(true)}
                    >
                        <Plus className="h-4 w-4 mr-1" />
                        Add SVMAI
                    </Button>
                )}
            </div>
        );
    }

    // Dashboard variant with full statistics
    if (variant === 'dashboard') {
        const status = getBalanceStatus(balance.balance.available);
        const burnRate = balance.monthly.estimatedMonthlyBurn;
        const usagePercent = balance.lifetime.totalSpent > 0
            ? (balance.monthly.spending / balance.lifetime.totalSpent) * 100
            : 0;

        return (
            <div className={`space-y-4 ${className}`}>
                {/* Main Balance Card */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center justify-between">
                            <span className="flex items-center gap-2">
                                <Wallet className="h-5 w-5 text-primary" />
                                <div className="flex-1">
                                    <p className="text-lg font-semibold">SVMAI Balance</p>
                                    <p className="text-sm text-muted-foreground">
                                        Last updated: {lastUpdated ? formatTimeAgo(lastUpdated) : 'Never'}
                                    </p>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={refreshBalance}
                                    disabled={refreshing}
                                >
                                    <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                                </Button>
                            </span>
                            <div className="flex items-center gap-2">
                                <Badge className={status.color}>
                                    {status.label}
                                </Badge>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={loadBalance}
                                >
                                    <RefreshCw className="h-4 w-4" />
                                </Button>
                            </div>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-3 gap-4">
                            <div className={themeClasses.balanceItem}>
                                <p className={themeClasses.balanceLabel}>Available</p>
                                <p className={`${themeClasses.balanceValue} ${getBalanceColor(balance.balance.available)}`}>
                                    {formatBalance(balance.balance.available)}
                                </p>
                            </div>
                            <div className={themeClasses.balanceItem}>
                                <p className={themeClasses.balanceLabel}>Reserved</p>
                                <p className={`${themeClasses.balanceValue} text-warning`}>
                                    {formatBalance(balance.balance.reserved)}
                                </p>
                            </div>
                            <div className={themeClasses.balanceItem}>
                                <p className={themeClasses.balanceLabel}>Total</p>
                                <p className={`${themeClasses.balanceValue} text-foreground`}>
                                    {formatBalance(balance.balance.total)}
                                    <span className={themeClasses.balanceUnit}>SVMAI</span>
                                </p>
                            </div>
                        </div>

                        {balance.balance.reserved > 0 && (
                            <div>
                                <div className="flex justify-between text-sm mb-2">
                                    <span>Balance Utilization</span>
                                    <span>{((balance.balance.reserved / balance.balance.total) * 100).toFixed(1)}% reserved</span>
                                </div>
                                <Progress value={(balance.balance.reserved / balance.balance.total) * 100} className="h-2" />
                            </div>
                        )}

                        {showDepositButton && (
                            <Button
                                onClick={() => setShowDepositModal(true)}
                                className="w-full"
                                variant={balance.warnings.lowBalance ? 'default' : 'outline'}
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                Add SVMAI Tokens
                            </Button>
                        )}
                    </CardContent>
                </Card>

                {/* Usage Statistics */}
                <div className="grid md:grid-cols-2 gap-4">
                    <div className={themeClasses.statCard}>
                        <div className={themeClasses.statHeader}>
                            <TrendingDown className={`${themeClasses.statIcon} text-destructive`} />
                            <span className={themeClasses.statTitle}>Monthly Spending</span>
                        </div>
                        <p className={`${themeClasses.statValue} text-destructive`}>
                            {balance.usageStats.totalSpent.toFixed(1)} SVMAI
                        </p>
                        <p className={themeClasses.statSubtext}>
                            Avg: {balance.usageStats.averageCostPerRequest.toFixed(2)} per request
                        </p>
                    </div>

                    <div className={themeClasses.statCard}>
                        <div className={themeClasses.statHeader}>
                            <Clock className={`${themeClasses.statIcon} text-primary`} />
                            <span className={themeClasses.statTitle}>Time Remaining</span>
                        </div>
                        <p className={`${themeClasses.statValue} text-primary`}>
                            ~{Math.floor(balance.balance.available / balance.usageStats.averageCostPerRequest)} requests
                        </p>
                        <p className={themeClasses.statSubtext}>
                            At current usage rate
                        </p>
                    </div>
                </div>

                {/* Warnings */}
                {showWarnings && (balance.warnings.lowBalance || balance.warnings.highBurnRate || balance.warnings.noBalance) && (
                    <Card className={themeClasses.warningCard}>
                        <CardContent className="p-4">
                            <div className="flex items-start gap-2">
                                <AlertTriangle className="h-5 w-5 text-warning mt-0.5" />
                                <div className="space-y-2">
                                    <h4 className="font-medium text-warning">Balance Warnings</h4>
                                    <ul className={`text-sm text-warning/80 space-y-1`}>
                                        {balance.warnings.noBalance && (
                                            <li>• Your balance is empty. Add tokens to continue using the API.</li>
                                        )}
                                        {balance.warnings.lowBalance && !balance.warnings.noBalance && (
                                            <li>• Your balance is low. Consider adding more SVMAI tokens.</li>
                                        )}
                                        {balance.warnings.highBurnRate && (
                                            <li>• Your usage rate is high. Monitor your balance closely.</li>
                                        )}
                                    </ul>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {lastUpdated && (
                    <p className="text-xs text-muted-foreground text-center">
                        Last updated: {lastUpdated ? formatTimeAgo(lastUpdated) : 'Never'}
                    </p>
                )}

                <SVMAIDepositModal
                    isOpen={showDepositModal}
                    onClose={() => setShowDepositModal(false)}
                    onDepositSuccess={onDepositSuccess}
                    currentBalance={balance?.balance?.current || 0}
                />
            </div>
        );
    }

    // Default card variant
    const status = getBalanceStatus(balance.balance.available);

    return (
        <Card className={`${fontClass} ${fontSizeClass} ${className}`}>
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                        <Wallet className="h-5 w-5 text-primary" />
                        SVMAI Balance
                    </span>
                    <div className="flex items-center gap-2">
                        <Badge className={status.color}>
                            {status.label}
                        </Badge>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={loadBalance}
                        >
                            <RefreshCw className="h-4 w-4" />
                        </Button>
                    </div>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-baseline gap-2">
                    <span className={`text-3xl font-bold ${getBalanceColor(balance.balance.available)}`}>
                        {formatBalance(balance.balance.available)}
                    </span>
                    <span className="text-lg text-muted-foreground">SVMAI</span>
                    {balance.balance.reserved > 0 && (
                        <span className="text-sm text-warning">
                            ({formatBalance(balance.balance.reserved)} reserved)
                        </span>
                    )}
                </div>

                <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Monthly spent: {formatBalance(balance.monthly.spending)}</span>
                    <span>Lifetime: {formatBalance(balance.lifetime.totalDeposited)}</span>
                </div>

                {showWarnings && balance.warnings.lowBalance && (
                    <div className={themeClasses.compactWarning}>
                        <AlertTriangle className="h-4 w-4 text-warning" />
                        <span className="text-sm text-warning/80">
                            Balance is running low. Consider adding more SVMAI tokens.
                        </span>
                    </div>
                )}

                {showDepositButton && (
                    <Button
                        onClick={() => setShowDepositModal(true)}
                        className="w-full"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Add SVMAI Tokens
                    </Button>
                )}
            </CardContent>
        </Card>
    );
} 