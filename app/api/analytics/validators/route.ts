import { NextResponse } from 'next/server';
import { Connection } from '@solana/web3.js';
import { VALIDATOR_CONSTANTS, PERFORMANCE_CONSTANTS } from '@/lib/constants/analytics-constants';
import { getGeolocationService, type GeolocationData as GeoData } from '@/lib/services/geolocation';

// Real Solana RPC endpoint - using public mainnet RPC
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

interface GeolocationData {
  country: string;
  countryCode: string;
  region: string;
  city: string;
  datacenter?: string;
  isp?: string;
  lat?: number;
  lon?: number;
}

// Fetch geolocation data for IP addresses using the new service
async function fetchGeolocation(ip: string): Promise<GeolocationData> {
  try {
    const geoService = await getGeolocationService();
    const geoData = await geoService.getGeolocation(ip);
    
    // Convert to the expected format
    return {
      country: geoData.country,
      countryCode: geoData.countryCode,
      region: geoData.region,
      city: geoData.city,
      datacenter: geoData.datacenter,
      isp: geoData.isp,
      lat: geoData.lat,
      lon: geoData.lon
    };
  } catch (error) {
    console.error(`Error fetching geolocation for ${ip}:`, error);
    
    // Return default data if service fails
    return {
      country: 'Unknown',
      countryCode: 'XX',
      region: 'Unknown',
      city: 'Unknown',
      datacenter: 'Unknown',
      isp: 'Unknown'
    };
  }
}

// Extract IP address from TPU or RPC endpoint
function extractIPFromEndpoint(endpoint: string): string | null {
  try {
    // Handle different endpoint formats
    if (endpoint.includes('://')) {
      const url = new URL(endpoint);
      return url.hostname;
    } else if (endpoint.includes(':')) {
      const [ip] = endpoint.split(':');
      return ip;
    }
    return endpoint;
  } catch (error) {
    console.warn(`Could not extract IP from endpoint: ${endpoint}`);
    return null;
  }
}

// Calculate validator performance score using standardized weights
function calculatePerformanceScore(
  commission: number,
  activatedStake: number,
  totalStake: number,
  epochCredits: number,
  version: string,
  geoData: GeolocationData
): number {
  const weights = VALIDATOR_CONSTANTS.PERFORMANCE_WEIGHTS;
  const thresholds = VALIDATOR_CONSTANTS.COMMISSION;
  
  // Commission score (lower is better)
  let commissionScore = 0;
  if (commission <= thresholds.EXCELLENT_THRESHOLD) commissionScore = 1.0;
  else if (commission <= thresholds.GOOD_THRESHOLD) commissionScore = 0.8;
  else if (commission <= thresholds.MODERATE_THRESHOLD) commissionScore = 0.6;
  else if (commission <= thresholds.POOR_THRESHOLD) commissionScore = 0.4;
  else commissionScore = 0.2;
  
  // Stake score (relative to network)
  const stakePercentage = (activatedStake / totalStake) * 100;
  const stakeScore = Math.min(stakePercentage / 5, 1); // Cap at 5% network share
  
  // Uptime score (based on epoch credits)
  const maxCredits = 440000; // Approximate max credits per epoch
  const uptimeScore = Math.min(epochCredits / maxCredits, 1);
  
  // Geography score (bonus for geographic diversity)
  const geoScore = geoData.country !== 'Unknown' ? 1.0 : 0.5;
  
  // Version score (latest version gets full score)
  const versionScore = version !== 'Unknown' ? 1.0 : 0.5;
  
  return (
    commissionScore * weights.COMMISSION_WEIGHT +
    stakeScore * weights.STAKE_WEIGHT +
    uptimeScore * weights.UPTIME_WEIGHT +
    geoScore * weights.GEOGRAPHY_WEIGHT +
    versionScore * weights.VERSION_WEIGHT
  );
}

export async function GET() {
  try {
    const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
    
    // Fetch real validator data from Solana RPC
    const voteAccounts = await connection.getVoteAccounts('confirmed');
    // const epochInfo = await connection.getEpochInfo('confirmed');
    const clusterNodes = await connection.getClusterNodes();
    
    // Process real validator data
    const allValidators = [...voteAccounts.current, ...voteAccounts.delinquent];
    const totalNetworkStake = allValidators.reduce((sum, v) => sum + v.activatedStake, 0);
    
    // Sort all validators by stake (no limit - show full list)
    const sortedValidators = allValidators
      .sort((a, b) => b.activatedStake - a.activatedStake);
    
    // Collect all unique IPs first for batch geolocation
    const ipToValidatorMap = new Map<string, any[]>();
    const validatorToIpMap = new Map<string, string>();
    
    sortedValidators.forEach(validator => {
      const clusterNode = clusterNodes.find(node => 
        node.pubkey === validator.nodePubkey
      );
      
      if (clusterNode?.tpu) {
        const ip = extractIPFromEndpoint(clusterNode.tpu);
        if (ip && ip !== '127.0.0.1' && ip !== 'localhost') {
          validatorToIpMap.set(validator.votePubkey, ip);
          if (!ipToValidatorMap.has(ip)) {
            ipToValidatorMap.set(ip, []);
          }
          ipToValidatorMap.get(ip)!.push(validator);
        }
      }
    });
    
    // Batch geocode all unique IPs
    const uniqueIps = Array.from(ipToValidatorMap.keys());
    const geoService = await getGeolocationService();
    const geoResults = await geoService.batchGeolocation(uniqueIps);
    
    console.log(`Batch geocoded ${uniqueIps.length} unique IPs for ${sortedValidators.length} validators`);
    
    // Process validators with cached geolocation data
    const validatorsWithGeo = await Promise.all(
      sortedValidators.map(async (validator, index) => {
        const clusterNode = clusterNodes.find(node => 
          node.pubkey === validator.nodePubkey
        );
        
        // Get geolocation data from batch results
        let geoData: GeolocationData = {
          country: 'Unknown',
          countryCode: 'XX',
          region: 'Unknown',
          city: 'Unknown',
          datacenter: 'Unknown',
          isp: 'Unknown'
        };
        
        const ip = validatorToIpMap.get(validator.votePubkey);
        if (ip && geoResults.has(ip)) {
          const batchGeoData = geoResults.get(ip)!;
          geoData = {
            country: batchGeoData.country,
            countryCode: batchGeoData.countryCode,
            region: batchGeoData.region,
            city: batchGeoData.city,
            datacenter: batchGeoData.datacenter || 'Unknown',
            isp: batchGeoData.isp || 'Unknown',
            lat: batchGeoData.lat,
            lon: batchGeoData.lon
          };
        }
        
        // Calculate performance metrics from real data
        const totalCredits = validator.epochCredits.reduce((sum, credit) => sum + credit[1], 0);
        // const recentCredits = validator.epochCredits.slice(-5).reduce((sum, credit) => sum + credit[1], 0);
        const currentEpochCredits = validator.epochCredits[validator.epochCredits.length - 1]?.[1] || 0;
        
        // Calculate performance score using standardized algorithm
        const performanceScore = calculatePerformanceScore(
          validator.commission,
          validator.activatedStake,
          totalNetworkStake,
          currentEpochCredits,
          clusterNode?.version || 'Unknown',
          geoData
        );
        
        // Calculate APY estimate based on commission and performance
        const baseAPY = 7; // Base Solana staking APY
        const apy = baseAPY * (1 - validator.commission / 100) * performanceScore;
        
        // Calculate uptime percentage (as decimal 0-1 for consistency)
        const maxCredits = 440000; // Approximate max credits per epoch
        const uptimeDecimal = Math.min(currentEpochCredits / maxCredits, 1.0); // Keep as 0-1
        
          return {
            voteAccount: validator.votePubkey,
            name: `${geoData.city}, ${geoData.country}` || `Validator ${index + 1}`,
            commission: validator.commission,
            activatedStake: validator.activatedStake,
            lastVote: validator.lastVote,
            // rootSlot: validator.rootSlot, // Property does not exist, remove
            credits: totalCredits,
            epochCredits: currentEpochCredits,
            version: clusterNode?.version || 'Unknown',
            status: voteAccounts.current.includes(validator) ? 'active' as const : 'delinquent' as const,
            datacenter: geoData.datacenter,
            country: geoData.country,
            countryCode: geoData.countryCode,
            region: geoData.region,
            city: geoData.city,
            isp: geoData.isp,
            coordinates: geoData.lat && geoData.lon ? { lat: geoData.lat, lon: geoData.lon } : undefined,
            apy: Math.round(apy * 100) / 100,
            performanceScore: Math.round(performanceScore * 100) / 100,
            uptimePercent: Math.round(uptimeDecimal * 10000) / 100 // Store as percentage (0-100) with 2 decimal precision
          };
        })
      );

    // Calculate real network stats from Solana data
    const totalValidators = allValidators.length;
    const activeValidators = voteAccounts.current.length;
    const delinquentValidators = voteAccounts.delinquent.length;
    const totalStake = allValidators.reduce((sum, v) => sum + v.activatedStake, 0);
    const averageCommission = allValidators.reduce((sum, v) => sum + v.commission, 0) / totalValidators;
    const averageUptime = validatorsWithGeo.reduce((sum, v) => sum + (v.uptimePercent / 100), 0) / validatorsWithGeo.length; // Convert back to decimal for internal calculations

    // Calculate Nakamoto coefficient from real stake distribution using standardized threshold
    const sortedByStake = [...allValidators].sort((a, b) => b.activatedStake - a.activatedStake);
    let cumulativeStake = 0;
    let nakamotoCoefficient = 0;
    const thresholdStake = totalStake * 0.33; // 33% threshold for consensus
    
    for (const validator of sortedByStake) {
      cumulativeStake += validator.activatedStake;
      nakamotoCoefficient++;
      if (cumulativeStake >= thresholdStake) break;
    }

    const networkHealth = averageUptime > 99 ? 'excellent' : averageUptime > 97 ? 'good' : averageUptime > 95 ? 'fair' : 'poor';

    const networkStats = {
      totalValidators,
      activeValidators,
      delinquentValidators,
      totalStake,
      averageCommission,
      nakamotoCoefficient,
      averageUptime,
      networkHealth
    };

    // Calculate decentralization metrics from real geolocation data
    const countryMap = new Map<string, { count: number, stake: number }>();
    const datacenterMap = new Map<string, { count: number, stake: number }>();
    const versionMap = new Map<string, number>();
    
    validatorsWithGeo.forEach(validator => {
      // Country distribution with real geolocation data
      const currentCountry = countryMap.get(validator.country) || { count: 0, stake: 0 };
      countryMap.set(validator.country, {
        count: currentCountry.count + 1,
        stake: currentCountry.stake + validator.activatedStake
      });
      
      // Datacenter distribution based on ISP/organization
      const datacenterKey = validator.datacenter || 'Unknown';
      const currentDatacenter = datacenterMap.get(datacenterKey) || { count: 0, stake: 0 };
      datacenterMap.set(datacenterKey, {
        count: currentDatacenter.count + 1,
        stake: currentDatacenter.stake + validator.activatedStake
      });
      
      // Version distribution from real cluster data
      const currentVersion = versionMap.get(validator.version) || 0;
      versionMap.set(validator.version, currentVersion + 1);
    });

    const geograficDistribution = Array.from(countryMap.entries())
      .map(([country, data]) => ({
        country,
        validatorCount: data.count,
        stakePercent: (data.stake / totalStake) * 100
      }))
      .sort((a, b) => b.stakePercent - a.stakePercent);

    const datacenterDistribution = Array.from(datacenterMap.entries())
      .map(([datacenter, data]) => ({
        datacenter,
        validatorCount: data.count,
        stakePercent: (data.stake / totalStake) * 100
      }))
      .sort((a, b) => b.stakePercent - a.stakePercent);

    const clientDistribution = Array.from(versionMap.entries())
      .map(([version, count]) => ({
        version,
        validatorCount: count,
        percent: (count / validatorsWithGeo.length) * 100
      }))
      .sort((a, b) => b.percent - a.percent);

    const decentralization = {
      geograficDistribution,
      datacenterDistribution,
      clientDistribution
    };

    // Health status based on real network conditions using standardized thresholds
    const issues = [];
    if (activeValidators < VALIDATOR_CONSTANTS.DECENTRALIZATION.MIN_VALIDATORS_FOR_HEALTH) {
      issues.push('Low active validator count');
    }
    if (averageUptime < 95) {
      issues.push('Below average network uptime');
    }
    if (delinquentValidators > totalValidators * 0.05) {
      issues.push('High delinquent validator ratio');
    }
    if (nakamotoCoefficient < VALIDATOR_CONSTANTS.DECENTRALIZATION.NAKAMOTO_COEFFICIENT_TARGET) {
      issues.push('Low Nakamoto coefficient indicates centralization risk');
    }

    const health = {
      isHealthy: issues.length === 0,
      lastUpdate: Date.now(),
      monitoredValidators: validatorsWithGeo.length,
      issues
    };

    // Process RPC nodes (cluster nodes that provide RPC but don't necessarily vote)
    const rpcNodes = clusterNodes
      .filter(node => node.rpc !== null) // Only nodes that provide RPC service
      .map(node => ({
        pubkey: node.pubkey,
        gossip: node.gossip,
        rpc: node.rpc,
        tpu: node.tpu,
        version: node.version
      }));

    // Update network stats to include RPC node count
    const updatedNetworkStats = {
      ...networkStats,
      totalRpcNodes: rpcNodes.length
    };

    return NextResponse.json({
      success: true,
      data: {
        validators: validatorsWithGeo,
        rpcNodes,
        networkStats: updatedNetworkStats,
        decentralization,
        health
      },
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('Error fetching real validator data:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch validator data from Solana RPC'
    }, { status: 500 });
  }
}
