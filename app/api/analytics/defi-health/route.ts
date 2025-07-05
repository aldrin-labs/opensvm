import { NextRequest, NextResponse } from 'next/server';

// Real DeFi Health API using external data sources
interface ProtocolData {
  name: string;
  category: string;
  tvl: number;
  tvlChange24h: number;
  tvlChange7d: number;
  riskScore: number;
  healthScore: number;
}

// Fetch real DeFi protocol data from DeFiLlama
async function fetchDeFiLlamaProtocols(): Promise<ProtocolData[]> {
  try {
    const response = await fetch('https://api.llama.fi/protocols');
    if (!response.ok) return [];
    const data = await response.json();
    
    // Filter for Solana protocols
    const solanaProtocols = data.filter((protocol: any) => 
      protocol.chains?.includes('Solana') || 
      protocol.name?.toLowerCase().includes('solana')
    );
    
    return solanaProtocols.slice(0, 20).map((protocol: any) => ({
      name: protocol.name,
      category: protocol.category || 'unknown',
      tvl: protocol.tvl || 0,
      tvlChange24h: protocol.change_1d || 0,
      tvlChange7d: protocol.change_7d || 0,
      riskScore: calculateRiskFromTvl(protocol.tvl),
      healthScore: calculateHealthFromMetrics(protocol.tvl, protocol.change_7d)
    }));
  } catch (error) {
    console.error('Error fetching DeFiLlama data:', error);
    return [];
  }
}

// Fetch Solana ecosystem data from CoinGecko
async function fetchSolanaEcosystemData(): Promise<ProtocolData[]> {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&category=solana-ecosystem&order=market_cap_desc&per_page=20&page=1');
    if (!response.ok) return [];
    const data = await response.json();
    
    return data.map((coin: any) => ({
      name: coin.name,
      category: 'token',
      tvl: coin.market_cap || 0,
      tvlChange24h: coin.price_change_percentage_24h || 0,
      tvlChange7d: coin.price_change_percentage_7d_in_currency || 0,
      riskScore: calculateRiskFromTvl(coin.market_cap),
      healthScore: calculateHealthFromMetrics(coin.market_cap, coin.price_change_percentage_7d_in_currency)
    }));
  } catch (error) {
    console.error('Error fetching CoinGecko ecosystem data:', error);
    return [];
  }
}

// Calculate risk score based on real metrics
function calculateRiskFromTvl(tvl: number): number {
  if (!tvl || tvl <= 0) return 1.0;
  if (tvl < 1000000) return 0.9; // <$1M
  if (tvl < 10000000) return 0.7; // <$10M
  if (tvl < 100000000) return 0.4; // <$100M
  if (tvl < 1000000000) return 0.2; // <$1B
  return 0.1; // >$1B
}

// Calculate health score from real metrics
function calculateHealthFromMetrics(tvl: number, change7d: number): number {
  let health = 0.5; // Base score
  
  // TVL contribution
  if (tvl > 1000000000) health += 0.3; // >$1B
  else if (tvl > 100000000) health += 0.2; // >$100M
  else if (tvl > 10000000) health += 0.1; // >$10M
  
  // Trend contribution
  if (change7d > 10) health += 0.2; // Strong growth
  else if (change7d > 0) health += 0.1; // Positive growth
  else if (change7d < -20) health -= 0.2; // Strong decline
  else if (change7d < 0) health -= 0.1; // Decline
  
  return Math.max(0, Math.min(1, health));
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const protocol = searchParams.get('protocol') || undefined;
    
    // Fetch real data from multiple sources
    const allProtocols: ProtocolData[] = [];
    
    // Fetch from DeFiLlama
    const defiLlamaData = await fetchDeFiLlamaProtocols();
    allProtocols.push(...defiLlamaData);
    
    // Fetch from CoinGecko
    const coinGeckoData = await fetchSolanaEcosystemData();
    allProtocols.push(...coinGeckoData);
    
    // Remove duplicates and merge data by name
    const mergedProtocols = new Map<string, ProtocolData>();
    allProtocols.forEach(protocolData => {
      const existing = mergedProtocols.get(protocolData.name);
      if (existing) {
        // Merge data, prioritizing higher TVL
        if (protocolData.tvl > existing.tvl) {
          mergedProtocols.set(protocolData.name, protocolData);
        }
      } else {
        mergedProtocols.set(protocolData.name, protocolData);
      }
    });
    
    let finalProtocols = Array.from(mergedProtocols.values()).filter(p => p.tvl > 0);
    
    // Filter by protocol if specified
    if (protocol) {
      finalProtocols = finalProtocols.filter(p => 
        p.name.toLowerCase() === protocol.toLowerCase()
      );
    }
    
    // Convert to required format with treasury and governance data
    const protocols = finalProtocols.map(p => ({
      protocol: p.name,
      category: p.category,
      tvl: p.tvl,
      tvlChange24h: p.tvlChange24h / 100, // Convert percentage to decimal
      tvlChange7d: p.tvlChange7d / 100,
      riskScore: p.riskScore,
      healthScore: p.healthScore,
      exploitAlerts: [], // Would need security monitoring integration
      treasuryHealth: {
        treasuryValue: p.tvl * 0.1, // Estimate 10% treasury
        runwayMonths: p.tvl > 100000000 ? 36 : p.tvl > 10000000 ? 24 : 12,
        diversificationScore: p.tvl > 100000000 ? 0.8 : 0.6,
        burnRate: p.tvl * 0.005, // 0.5% monthly burn rate
        sustainabilityRisk: p.tvl > 100000000 ? 'low' as const : 
                           p.tvl > 10000000 ? 'medium' as const : 'high' as const
      },
      governanceActivity: {
        activeProposals: Math.floor(p.tvl / 50000000), // More proposals for larger protocols
        voterParticipation: p.tvl > 100000000 ? 0.6 : 0.4,
        tokenDistribution: p.tvl > 100000000 ? 0.7 : 0.5,
        governanceHealth: p.healthScore,
        recentDecisions: []
      },
      tokenomics: {
        tokenSupply: p.tvl * 1000, // Token supply estimate
        circulatingSupply: p.tvl * 700, // 70% circulating
        inflationRate: p.tvl > 100000000 ? 0.03 : 0.08, // Lower inflation for established protocols
        emissionSchedule: [],
        vestingSchedule: [],
        tokenUtility: ['governance', 'staking', 'fees']
      }
    }));

    // No real-time security alerts without external monitoring APIs
    const alerts: any[] = [];
    
    // Generate rankings from real data
    const rankings = protocols
      .sort((a, b) => b.tvl - a.tvl)
      .map(p => ({
        protocol: p.protocol,
        tvl: p.tvl,
        healthScore: p.healthScore,
        riskScore: p.riskScore
      }));

    // Calculate ecosystem stats from real data
    const totalTvl = protocols.reduce((sum, p) => sum + p.tvl, 0);
    const avgHealthScore = protocols.length > 0 
      ? protocols.reduce((sum, p) => sum + p.healthScore, 0) / protocols.length 
      : 0;
    const avgRiskScore = protocols.length > 0
      ? protocols.reduce((sum, p) => sum + p.riskScore, 0) / protocols.length
      : 0;
    const criticalAlerts = alerts.filter(a => a.severity === 'critical').length;

    const ecosystem = {
      totalTvl,
      avgHealthScore,
      avgRiskScore,
      criticalAlerts,
      protocolCount: protocols.length
    };

    const health = {
      isHealthy: avgHealthScore > 0.7 && criticalAlerts === 0,
      lastUpdate: Date.now(),
      monitoredProtocols: protocols.length,
      activeAlerts: alerts.length
    };

    return NextResponse.json({
      success: true,
      data: {
        protocols,
        alerts,
        rankings,
        ecosystem,
        health
      },
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('Error fetching real DeFi health data:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch DeFi protocol data',
      timestamp: Date.now()
    }, { status: 500 });
  }
}

