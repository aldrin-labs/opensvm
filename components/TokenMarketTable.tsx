'use client';

import React from 'react';
import type { TokenMarketData } from '@/types/token-market';
import { formatCurrency, formatPercentage } from '@/utils/format';

interface TokenMarketTableProps {
  tokens: TokenMarketData[];
  type: 'all' | 'gainers' | 'new';
  onTokenClick: (address: string) => void;
  isLoading?: boolean;
}

export default function TokenMarketTable({ tokens, type, onTokenClick, isLoading }: TokenMarketTableProps) {
  if (isLoading) {
    return (
      <div className="w-full border border-border rounded-lg overflow-hidden bg-background">
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span className="ml-2 text-muted-foreground">Loading tokens...</span>
        </div>
      </div>
    );
  }

  if (!tokens.length) {
    return (
      <div className="w-full border border-border rounded-lg overflow-hidden bg-background">
        <div className="flex items-center justify-center h-96">
          <p className="text-muted-foreground">No tokens found</p>
        </div>
      </div>
    );
  }

  const getPriceChangeColor = (value: number) => {
    if (value > 0) return 'text-green-500';
    if (value < 0) return 'text-red-500';
    return 'text-muted-foreground';
  };

  return (
    <div className="w-full border border-border rounded-lg overflow-hidden bg-background">
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                #
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                Token
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                Price
              </th>
              {type === 'gainers' && (
                <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                  24h Change
                </th>
              )}
              {type === 'new' && (
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  Listed
                </th>
              )}
              {type === 'all' && (
                <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                  24h %
                </th>
              )}
              <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                Market Cap
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                24h Volume
              </th>
            </tr>
          </thead>
          <tbody>
            {tokens.map((token, index) => (
              <tr 
                key={token.address}
                className="border-b border-border hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => onTokenClick(token.address)}
              >
                <td className="px-4 py-3">
                  <div className="text-sm font-bold text-center text-muted-foreground">
                    {index + 1}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-muted border border-border flex items-center justify-center overflow-hidden">
                      {token.icon ? (
                        <img 
                          src={token.icon} 
                          alt={token.name}
                          className="w-6 h-6 rounded-full"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-gradient-to-r from-blue-400 to-purple-500"></div>
                      )}
                    </div>
                    <div>
                      <div className="font-medium text-foreground">{token.name}</div>
                      <div className="text-sm text-muted-foreground">{token.symbol?.toUpperCase()}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-sm font-medium text-foreground">
                    {token.price ? formatCurrency(token.price) : '-'}
                  </span>
                </td>
                {type === 'gainers' && (
                  <td className="px-4 py-3 text-right">
                    <div className="space-y-1">
                      <div className={`text-sm font-medium ${getPriceChangeColor((token as any).priceChange24h || 0)}`}>
                        {formatCurrency((token as any).priceChange24h || 0)}
                      </div>
                      <div className={`text-xs ${getPriceChangeColor((token as any).priceChangePercentage24h || 0)}`}>
                        {formatPercentage((token as any).priceChangePercentage24h || 0)}
                      </div>
                    </div>
                  </td>
                )}
                {type === 'new' && (
                  <td className="px-4 py-3">
                    <span className="text-sm text-foreground">
                      {(token as any).daysOld === 0 ? 'Today' : `${(token as any).daysOld}d ago`}
                    </span>
                  </td>
                )}
                {type === 'all' && (
                  <td className="px-4 py-3 text-right">
                    <span className={`text-sm font-medium ${getPriceChangeColor(token.priceChangePercentage24h || 0)}`}>
                      {formatPercentage(token.priceChangePercentage24h || 0)}
                    </span>
                  </td>
                )}
                <td className="px-4 py-3 text-right">
                  <span className="text-sm text-foreground">
                    {token.marketCap ? formatCurrency(token.marketCap, true) : '-'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-sm text-foreground">
                    {token.volume24h ? formatCurrency(token.volume24h, true) : '-'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}