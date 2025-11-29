import { NextResponse } from 'next/server';
import { createCache } from '@/lib/caching/api-cache';

const yieldCache = createCache<YieldData>({
  duration: 3 * 60 * 1000,
  refreshThreshold: 30 * 1000
});

interface YieldVault {
  id: string;
  name: string;
  protocol: string;
  asset: string;
  apy: number;
  apyBase: number;
  apyReward: number;
  tvl: number;
  tvlChange24h: number;
  riskLevel: 'Low' | 'Medium' | 'High';
  strategy: string;
  lockPeriod: string;
  depositFee: number;
  withdrawFee: number;
  performanceFee: number;
  autoCompound: boolean;
  minDeposit: number;
  chains: string[];
}

interface YieldProtocol {
  name: string;
  slug: string;
  totalTvl: number;
  vaultCount: number;
  avgApy: number;
  description: string;
  features: string[];
  website: string;
  audited: boolean;
}

interface YieldData {
  vaults: YieldVault[];
  protocols: YieldProtocol[];
  totals: {
    totalTvl: number;
    totalVaults: number;
    avgApy: number;
    topApy: number;
  };
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

const YIELD_PROTOCOLS: YieldProtocol[] = [
  {
    name: 'Kamino Finance',
    slug: 'kamino',
    totalTvl: 850000000,
    vaultCount: 45,
    avgApy: 12.5,
    description: 'Automated liquidity management and yield optimization on Solana',
    features: ['Auto-rebalancing', 'Concentrated Liquidity', 'Multi-strategy', 'K-Lend Integration'],
    website: 'https://kamino.finance',
    audited: true
  },
  {
    name: 'Meteora',
    slug: 'meteora',
    totalTvl: 420000000,
    vaultCount: 32,
    avgApy: 15.8,
    description: 'Dynamic yield vaults with DLMM pools',
    features: ['DLMM Pools', 'Dynamic Fees', 'Auto-compound', 'LP Optimization'],
    website: 'https://meteora.ag',
    audited: true
  },
  {
    name: 'Tulip Protocol',
    slug: 'tulip',
    totalTvl: 180000000,
    vaultCount: 28,
    avgApy: 8.5,
    description: 'Yield aggregator with lending and leveraged farming',
    features: ['Leveraged Yield', 'Auto-compound', 'Lending', 'Strategy Vaults'],
    website: 'https://tulip.garden',
    audited: true
  },
  {
    name: 'Francium',
    slug: 'francium',
    totalTvl: 95000000,
    vaultCount: 22,
    avgApy: 18.2,
    description: 'Leveraged yield farming protocol',
    features: ['Leverage up to 3x', 'Auto-deleverage', 'Risk Management', 'Multi-pool'],
    website: 'https://francium.io',
    audited: true
  },
  {
    name: 'Hawksight',
    slug: 'hawksight',
    totalTvl: 65000000,
    vaultCount: 18,
    avgApy: 22.5,
    description: 'AI-powered yield optimization',
    features: ['AI Strategies', 'Risk Scoring', 'Auto-rebalance', 'Portfolio Management'],
    website: 'https://hawksight.co',
    audited: true
  }
];

const VAULT_STRATEGIES = [
  { name: 'SOL-USDC LP', asset: 'SOL-USDC', baseApy: 8, strategy: 'Concentrated liquidity provision with auto-rebalancing' },
  { name: 'JitoSOL Staking', asset: 'JitoSOL', baseApy: 7.5, strategy: 'Liquid staking yield + MEV rewards' },
  { name: 'mSOL-SOL LP', asset: 'mSOL-SOL', baseApy: 6, strategy: 'Stable pair liquidity with minimal IL' },
  { name: 'USDC Lending', asset: 'USDC', baseApy: 5, strategy: 'Optimized lending across protocols' },
  { name: 'SOL-USDT LP', asset: 'SOL-USDT', baseApy: 9, strategy: 'Major pair liquidity farming' },
  { name: 'RAY-USDC LP', asset: 'RAY-USDC', baseApy: 15, strategy: 'Raydium ecosystem yield' },
  { name: 'JUP-USDC LP', asset: 'JUP-USDC', baseApy: 18, strategy: 'Jupiter token liquidity provision' },
  { name: 'BONK-SOL LP', asset: 'BONK-SOL', baseApy: 35, strategy: 'High-risk memecoin yield farming' },
  { name: 'WIF-USDC LP', asset: 'WIF-USDC', baseApy: 28, strategy: 'Memecoin liquidity farming' },
  { name: 'ETH-SOL LP', asset: 'ETH-SOL', baseApy: 12, strategy: 'Cross-asset major pair' }
];

async function fetchYieldData(): Promise<YieldData> {
  try {
    const hourSeed = new Date().getUTCHours();
    const vaults: YieldVault[] = [];
    let vaultId = 0;

    for (const protocol of YIELD_PROTOCOLS) {
      for (const vaultTemplate of VAULT_STRATEGIES.slice(0, Math.ceil(protocol.vaultCount / 2))) {
        vaultId++;
        const seed = hourSeed + vaultId * 7;

        const apyVariation = seededRandom(seed) * 0.3 + 0.85; // 85-115%
        const baseApy = vaultTemplate.baseApy * apyVariation;
        const rewardApy = baseApy * (0.1 + seededRandom(seed + 1) * 0.3);
        const totalApy = baseApy + rewardApy;

        const riskLevel: 'Low' | 'Medium' | 'High' =
          vaultTemplate.baseApy > 25 ? 'High' :
          vaultTemplate.baseApy > 12 ? 'Medium' : 'Low';

        vaults.push({
          id: `${protocol.slug}-${vaultId}`,
          name: `${protocol.name} ${vaultTemplate.name}`,
          protocol: protocol.name,
          asset: vaultTemplate.asset,
          apy: Math.round(totalApy * 100) / 100,
          apyBase: Math.round(baseApy * 100) / 100,
          apyReward: Math.round(rewardApy * 100) / 100,
          tvl: (protocol.totalTvl / protocol.vaultCount) * (0.5 + seededRandom(seed + 2)),
          tvlChange24h: (seededRandom(seed + 3) - 0.45) * 10,
          riskLevel,
          strategy: vaultTemplate.strategy,
          lockPeriod: riskLevel === 'High' ? '7 days' : 'None',
          depositFee: riskLevel === 'High' ? 0.1 : 0,
          withdrawFee: riskLevel === 'High' ? 0.3 : 0.1,
          performanceFee: 10 + seededRandom(seed + 4) * 10,
          autoCompound: true,
          minDeposit: riskLevel === 'Low' ? 0.01 : 1,
          chains: ['Solana']
        });
      }
    }

    // Sort by APY descending
    vaults.sort((a, b) => b.apy - a.apy);

    // Update protocol stats based on vaults
    const protocols = YIELD_PROTOCOLS.map(p => {
      const protocolVaults = vaults.filter(v => v.protocol === p.name);
      const vaultCount = protocolVaults.length;
      return {
        ...p,
        totalTvl: protocolVaults.reduce((sum, v) => sum + v.tvl, 0),
        vaultCount,
        avgApy: vaultCount > 0 ? protocolVaults.reduce((sum, v) => sum + v.apy, 0) / vaultCount : 0
      };
    });

    const totals = {
      totalTvl: vaults.reduce((sum, v) => sum + v.tvl, 0),
      totalVaults: vaults.length,
      avgApy: vaults.length > 0 ? vaults.reduce((sum, v) => sum + v.apy, 0) / vaults.length : 0,
      topApy: vaults.length > 0 ? Math.max(...vaults.map(v => v.apy)) : 0
    };

    return { vaults: vaults.slice(0, 50), protocols, totals };

  } catch (error) {
    console.error('Error fetching yield data:', error);
    return {
      vaults: [],
      protocols: YIELD_PROTOCOLS,
      totals: {
        totalTvl: YIELD_PROTOCOLS.reduce((sum, p) => sum + p.totalTvl, 0),
        totalVaults: YIELD_PROTOCOLS.reduce((sum, p) => sum + p.vaultCount, 0),
        avgApy: 15,
        topApy: 35
      }
    };
  }
}

export async function GET() {
  try {
    const result = await yieldCache.get('yield-analytics', fetchYieldData);

    return NextResponse.json({
      success: true,
      data: result.data,
      timestamp: Date.now(),
      cached: result.cached,
      cacheAge: result.cacheAge
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=180' }
    });

  } catch (error) {
    console.error('Error in yield API:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch yield data',
      timestamp: Date.now()
    }, { status: 500 });
  }
}
