'use client';

import { useState, useEffect } from 'react';
import { TokenPrice } from '@/lib/dex-integration';

interface Token {
  address: string;
  name: string;
  symbol: string;
  volume24h: number;
  price: number;
  priceUsd: number | null;
  change24h: number;
  decimals: number;
  source?: string;
}

// Fallback data in case API fails
const FALLBACK_TOKENS: Token[] = [
  {
    address: 'So11111111111111111111111111111111111111112',
    name: 'Wrapped SOL',
    symbol: 'wSOL',
    volume24h: 123456789,
    price: 100.50,
    priceUsd: 100.50,
    change24h: 2.5,
    decimals: 9
  },
  {
    address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    name: 'USD Coin',
    symbol: 'USDC',
    volume24h: 98765432,
    price: 1.00,
    priceUsd: 1.00,
    change24h: 0.1,
    decimals: 6
  },
  {
    address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    name: 'USDT',
    symbol: 'USDT',
    volume24h: 87654321,
    price: 1.00,
    priceUsd: 1.00,
    change24h: -0.1,
    decimals: 6
  }
];

export function TrendingTokens() {
  const [tokens, setTokens] = useState<Token[]>(FALLBACK_TOKENS);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    const fetchTokenData = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/dex-data');
        if (response.ok) {
          const data = await response.json();
          
          // Convert TokenPrice to Token interface
          const fetchedTokens: Token[] = data.prices.map((price: TokenPrice) => ({
            address: price.mint,
            name: price.symbol, // Using symbol as name for now
            symbol: price.symbol,
            volume24h: price.volume24h || 0,
            price: price.price,
            priceUsd: price.priceUsd,
            change24h: price.change24h || 0,
            decimals: 9, // Default decimals
            source: price.source
          }));

          if (fetchedTokens.length > 0) {
            setTokens(fetchedTokens.slice(0, 5)); // Show top 5
            setLastUpdated(new Date());
          }
        }
      } catch (error) {
        console.error('Error fetching token data:', error);
        // Keep fallback data on error
      } finally {
        setLoading(false);
      }
    };

    fetchTokenData();
    
    // Refresh every 5 minutes
    const interval = setInterval(fetchTokenData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="rounded-lg bg-black/20 backdrop-blur-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Trending Tokens</h2>
        <div className="flex items-center space-x-2">
          {loading && (
            <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
          )}
          {lastUpdated && (
            <span className="text-xs text-gray-500">
              Updated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>
      <div className="space-y-4">
        {tokens.map((token) => (
          <div
            key={token.address}
            className="flex items-center justify-between p-3 rounded-lg bg-black/30 hover:bg-black/40 transition-colors"
          >
            <div className="flex items-center space-x-4">
              <div className="text-sm">
                <div className="text-gray-300 font-medium">
                  {token.name} <span className="text-gray-500">({token.symbol})</span>
                  {token.source && (
                    <span className="ml-2 px-2 py-1 bg-blue-600/20 text-blue-400 text-xs rounded">
                      {token.source}
                    </span>
                  )}
                </div>
                <div className="text-gray-500 text-xs font-mono truncate w-48">
                  {token.address}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-gray-300">
                ${token.priceUsd?.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 8
                })}
              </div>
              <div className={`text-sm ${token.change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {token.change24h >= 0 ? '+' : ''}{token.change24h.toFixed(2)}%
              </div>
              <div className="text-gray-500 text-xs">
                Vol: ${token.volume24h.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
            </div>
          </div>
        ))}
      </div>
      {!loading && tokens.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No token data available
        </div>
      )}
    </div>
  );
}