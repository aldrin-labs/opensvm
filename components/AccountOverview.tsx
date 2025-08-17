"use client";

import { useState, useEffect, useMemo } from 'react';
import { Loader2, User } from 'lucide-react';
import { type TokenAccount } from '../lib/solana';
import AccountExplorerLinks from './AccountExplorerLinks';
import { useTheme } from '../lib/design-system/theme-provider';
import { Button } from '../components/ui/button';
import { useRouter } from 'next/navigation';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend
} from 'recharts';

interface Props {
  address: string;
  solBalance: number;
  tokenAccounts: TokenAccount[];
  isSystemProgram?: boolean;
  parsedOwner?: string;
}

interface PortfolioItem {
  name: string;
  value: number;
  usdValue: number;
  color: string;
}

export default function AccountOverview({
  address,
  solBalance,
  tokenAccounts,
  isSystemProgram,
  parsedOwner
}: Props) {
  const [accountStats, setAccountStats] = useState<{
    totalTransactions: string | number | null;
    tokenTransfers: number | null;
  }>({ totalTransactions: null, tokenTransfers: null });
  const [statsLoading, setStatsLoading] = useState(true);
  const { config, resolvedTheme } = useTheme();
  const router = useRouter();

  useEffect(() => {
    async function fetchAccountStats() {
      try {
        setStatsLoading(true);
        const response = await fetch(`/api/account-stats/${address}`);
        if (!response.ok) throw new Error('Failed to fetch account stats');
        const data = await response.json();
        setAccountStats({
          totalTransactions: data.totalTransactions ?? null,
          tokenTransfers: data.tokenTransfers ?? null
        });
      } catch (error) {
        console.error('Error fetching account stats:', error);
        setAccountStats({ totalTransactions: null, tokenTransfers: null });
      } finally {
        setStatsLoading(false);
      }
    }
    fetchAccountStats();
  }, [address]);

  // Calculate portfolio breakdown for pie chart
  const portfolioData = useMemo<PortfolioItem[]>(() => {
    // Generate theme-aware colors for the pie chart
    const getThemeAwareColors = (theme: string) => {
      const colorSchemes = {
        paper: [
          '#22c55e',
          '#3b82f6',
          '#f59e0b',
          '#ef4444',
          '#8b5cf6',
          '#06b6d4',
          '#f97316',
          '#ec4899',
          '#84cc16',
          '#6366f1',
        ],
        'high-contrast': [
          '#00ff00',
          '#00ffff',
            '#ffff00',
          '#ff0000',
          '#ff00ff',
          '#0080ff',
          '#ff8000',
          '#80ff00',
          '#8000ff',
          '#ff0080',
        ],
        'dos-blue': [
          '#ffff00',
          '#00ffff',
          '#ff00ff',
          '#00ff00',
          '#ff8000',
          '#8080ff',
          '#ff8080',
          '#80ff80',
          '#ffff80',
          '#ff80ff',
        ],
        cyberpunk: [
          '#ff00ff',
          '#00ffff',
          '#ff0080',
          '#8000ff',
          '#ff4080',
          '#40ff80',
          '#ff8040',
          '#4080ff',
          '#80ff40',
          '#ff4040',
        ],
        solarized: [
          '#268bd2',
          '#2aa198',
          '#859900',
          '#b58900',
          '#cb4b16',
          '#d33682',
          '#dc322f',
          '#6c71c4',
          '#586e75',
          '#657b83',
        ],
      };

      return colorSchemes[config.variant as keyof typeof colorSchemes] || colorSchemes.paper;
    };

    const themeColors = getThemeAwareColors(config.variant);
    const data: PortfolioItem[] = [];

    const SOL_PRICE = 235.19;
    if (solBalance > 0) {
      data.push({
        name: 'SOL',
        value: solBalance,
        usdValue: solBalance * SOL_PRICE,
        color: themeColors[0]
      });
    }

    tokenAccounts.forEach((token, index) => {
      if (token.uiAmount > 0) {
        const mockPrice = Math.random() * 1000 + 10;
        data.push({
          name: token.symbol || `${token.mint?.slice(0, 4)}...${token.mint?.slice(-4)}` || 'Unknown',
          value: token.uiAmount,
          usdValue: token.uiAmount * mockPrice,
          color: themeColors[(index + 1) % themeColors.length]
        });
      }
    });

    data.sort((a, b) => b.usdValue - a.usdValue);

    if (data.length > 10) {
      const top10 = data.slice(0, 10);
      const others = data.slice(10);

      const othersTotal = others.reduce((sum, item) => sum + item.usdValue, 0);
      const othersValueTotal = others.reduce((sum, item) => sum + item.value, 0);

      if (othersTotal > 0) {
        top10.push({
          name: 'Others',
          value: othersValueTotal,
          usdValue: othersTotal,
          color: '#666666'
        });
      }

      return top10;
    }

    return data;
  }, [solBalance, tokenAccounts, config.variant]);

  return (
    <div className="rounded-lg border bg-card text-card-foreground">
      <div className="p-6">
        <h2 className="text-xl font-semibold mb-4">Overview</h2>

        <div className="space-y-4">
          <div>
            <div className="text-sm text-muted-foreground">SOL Balance</div>
            <div className="flex items-center gap-2">
              <div className="text-lg">{solBalance.toFixed(4)} SOL</div>
              <div className="text-sm text-muted-foreground">(${(solBalance * 235.19).toFixed(2)})</div>
            </div>
          </div>

          <div>
            <div className="text-sm text-muted-foreground">Token Balance</div>
            <div className="flex items-center gap-2">
              <div className="text-lg">{tokenAccounts.length} Tokens</div>
              <div className="text-sm text-muted-foreground">($0.00)</div>
            </div>
            {tokenAccounts && tokenAccounts.length > 0 && (
              <div className="mt-2 space-y-2">
                {/* Display top 3 tokens with proper formatting */}
                {tokenAccounts.slice(0, 3).map((token, index) => (
                  <div key={token.mint || index} className="bg-muted rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {token.icon && (
                          <img src={token.icon} alt={token.symbol} className="w-5 h-5 rounded-full" />
                        )}
                        <div>
                          <div className="text-sm font-medium">
                            {token.symbol || `${token.mint?.slice(0, 4)}...${token.mint?.slice(-4)}`}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {token.name || 'Unknown Token'}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-mono">
                          {token.uiAmount?.toLocaleString() || '0'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {token.usdValue ? `$${token.usdValue.toFixed(2)}` : '$0.00'}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {tokenAccounts.length > 3 && (
                  <div className="text-xs text-muted-foreground text-center py-2">
                    + {tokenAccounts.length - 3} more tokens
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Portfolio Breakdown Pie Chart */}
          {portfolioData.length > 0 && (
            <div>
              <div className="text-sm text-muted-foreground mb-2">Portfolio Breakdown</div>
              <div className="bg-muted rounded-lg p-4">
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={portfolioData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={60}
                        fill="#8884d8"
                        dataKey="usdValue"
                        label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                      >
                        {portfolioData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number, name: string) => [
                          `$${value.toFixed(2)}`,
                          name
                        ]}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          <div>
            <div className="text-sm text-muted-foreground">Total Transactions</div>
            {statsLoading ? (
              <div className="flex items-center mt-1">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : accountStats.totalTransactions === null ? (
              <div className="text-sm text-muted-foreground">-</div>
            ) : (
              <div className="text-lg">
                {typeof accountStats.totalTransactions === 'number'
                  ? accountStats.totalTransactions.toLocaleString()
                  : accountStats.totalTransactions}
              </div>
            )}
          </div>

          <div>
            <div className="text-sm text-muted-foreground">Token Transfers</div>
            {statsLoading ? (
              <div className="flex items-center mt-1">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : accountStats.tokenTransfers === null ? (
              <div className="text-sm text-muted-foreground">-</div>
            ) : (
              <div className="text-lg">{accountStats.tokenTransfers.toLocaleString()}</div>
            )}
          </div>

          {parsedOwner && (
            <div>
              <div className="text-sm text-muted-foreground">Owner</div>
              <div className="text-sm font-mono break-all">{parsedOwner}</div>
            </div>
          )}

          {isSystemProgram !== undefined && (
            <div>
              <div className="text-sm text-muted-foreground">Type</div>
              <div className="text-sm">{isSystemProgram ? 'System Program' : 'User Account'}</div>
            </div>
          )}

          <AccountExplorerLinks address={address} />

          {/* User Page Redirect Button */}
          <div className="mt-4">
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => router.push(`/user/${address}`)}
            >
              <User className="h-4 w-4" />
              View User Profile & History
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
