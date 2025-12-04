'use client';

import { useState, useEffect } from 'react';
import { LiquidityPool, ArbitrageOpportunity } from '@/lib/dex-integration';

interface DEXAnalyticsProps {
  className?: string;
}

export function DEXAnalytics({ className = '' }: DEXAnalyticsProps) {
  const [pools, setPools] = useState<LiquidityPool[]>([]);
  const [arbitrageOps, setArbitrageOps] = useState<ArbitrageOpportunity[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [totalLiquidity, setTotalLiquidity] = useState(0);
  const [totalVolume24h, setTotalVolume24h] = useState(0);

  useEffect(() => {
    const fetchDEXData = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/dex-data?arbitrage=true');
        if (response.ok) {
          const data = await response.json();
          
          setPools(data.pools || []);
          setArbitrageOps(data.arbitrageOpportunities || []);
          setTotalLiquidity(data.totalLiquidity || 0);
          setTotalVolume24h(data.totalVolume24h || 0);
          setLastUpdated(new Date());
        }
      } catch (error) {
        console.error('Error fetching DEX data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDEXData();
    
    // Refresh every 2 minutes
    const interval = setInterval(fetchDEXData, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-lg bg-black/20 backdrop-blur-sm p-4">
          <h3 className="text-sm font-medium text-gray-400 mb-1">Total Liquidity</h3>
          <p className="text-2xl font-bold text-gray-100">
            ${totalLiquidity.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
        </div>
        <div className="rounded-lg bg-black/20 backdrop-blur-sm p-4">
          <h3 className="text-sm font-medium text-gray-400 mb-1">24h Volume</h3>
          <p className="text-2xl font-bold text-gray-100">
            ${totalVolume24h.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
        </div>
        <div className="rounded-lg bg-black/20 backdrop-blur-sm p-4">
          <h3 className="text-sm font-medium text-gray-400 mb-1">Arbitrage Opportunities</h3>
          <p className="text-2xl font-bold text-green-400">
            {arbitrageOps.length}
          </p>
        </div>
      </div>

      {/* Arbitrage Opportunities */}
      {arbitrageOps.length > 0 && (
        <div className="rounded-lg bg-black/20 backdrop-blur-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Arbitrage Opportunities</h2>
            {loading && (
              <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
            )}
          </div>
          <div className="space-y-3">
            {arbitrageOps.slice(0, 5).map((opportunity, index) => (
              <div
                key={`${opportunity.tokenMint}-${index}`}
                className="flex items-center justify-between p-3 rounded-lg bg-black/30 border border-green-500/20"
              >
                <div className="flex items-center space-x-4">
                  <div className="text-sm">
                    <div className="text-gray-300 font-medium">
                      {opportunity.tokenSymbol}
                    </div>
                    <div className="text-gray-500 text-xs">
                      Buy on {opportunity.buyDEX} → Sell on {opportunity.sellDEX}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-green-400 font-bold">
                    +{opportunity.profitPercentage.toFixed(2)}%
                  </div>
                  <div className="text-gray-500 text-xs">
                    ${opportunity.buyPrice.toFixed(4)} → ${opportunity.sellPrice.toFixed(4)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Liquidity Pools */}
      <div className="rounded-lg bg-black/20 backdrop-blur-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Top Liquidity Pools</h2>
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
        
        {pools.length > 0 ? (
          <div className="space-y-3">
            {pools.slice(0, 10).map((pool, index) => (
              <div
                key={pool.address}
                className="flex items-center justify-between p-3 rounded-lg bg-black/30 hover:bg-black/40 transition-colors"
              >
                <div className="flex items-center space-x-4">
                  <div className="text-sm">
                    <div className="text-gray-300 font-medium">
                      {pool.tokenASymbol}/{pool.tokenBSymbol}
                      <span className="ml-2 px-2 py-1 bg-blue-600/20 text-blue-400 text-xs rounded">
                        {pool.dex}
                      </span>
                    </div>
                    <div className="text-gray-500 text-xs font-mono truncate w-48">
                      {pool.address}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-gray-300">
                    TVL: ${pool.liquidity.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                  <div className="text-gray-500 text-sm">
                    Vol: ${pool.volume24h.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                  {pool.apy > 0 && (
                    <div className="text-green-400 text-sm">
                      APY: {pool.apy.toFixed(2)}%
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            {loading ? 'Loading pool data...' : 'No pool data available'}
          </div>
        )}
      </div>
    </div>
  );
}