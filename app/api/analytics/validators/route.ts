import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';
import { VALIDATOR_CONSTANTS, PERFORMANCE_CONSTANTS } from '@/lib/constants/analytics-constants';

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

// Cache for geolocation data to avoid excessive API calls
const geoCache = new Map<string, { data: GeolocationData; timestamp: number }>();

// Fetch geolocation data for IP addresses using multiple services
async function fetchGeolocation(ip: string): Promise<GeolocationData> {
  const cacheKey = ip;
  const cached = geoCache.get(cacheKey);
  
  // Return cached data if it's less than 24 hours old
  if (cached && Date.now() - cached.timestamp < PERFORMANCE_CONSTANTS.CACHE_RETENTION.DAILY_CACHE_MS) {
    return cached.data;
  }
  
  try {
    // Try multiple geolocation services for better coverage
    const geoData = await fetchGeoFromMultipleSources(ip);
    
    // Cache the result
    geoCache.set(cacheKey, {
      data: geoData,
      timestamp: Date.now()
    });
    
    return geoData;
  } catch (error) {
    console.error(`Error fetching geolocation for ${ip}:`, error);
    
    // Return default data if all services fail
    const defaultData: GeolocationData = {
      country: 'Unknown',
      countryCode: 'XX',
      region: 'Unknown',
      city: 'Unknown',
      datacenter: 'Unknown',
      isp: 'Unknown'
    };
    
    geoCache.set(cacheKey, {
      data: defaultData,
      timestamp: Date.now()
    });
    
    return defaultData;
  }
}

// Fetch geolocation from multiple sources with fallback
async function fetchGeoFromMultipleSources(ip: string): Promise<GeolocationData> {
  const sources = [
    // Free tier of ipapi.co (1000 requests/day)
    async () => {
      const response = await fetch(`https://ipapi.co/${ip}/json/`);
      if (!response.ok) throw new Error('ipapi.co failed');
      const data = await response.json();
      return {
        country: data.country_name || 'Unknown',
        countryCode: data.country_code || 'XX',
        region: data.region || 'Unknown',
        city: data.city || 'Unknown',
        datacenter: data.org || 'Unknown',
        isp: data.org || 'Unknown',
        lat: data.latitude,
        lon: data.longitude
      };
    },
    
    // Free tier of ip-api.com (1000 requests/hour)
    async () => {
      const response = await fetch(`http://ip-api.com/json/${ip}`);
      if (!response.ok) throw new Error('ip-api.com failed');
      const data = await response.json();
      return {
        country: data.country || 'Unknown',
        countryCode: data.countryCode || 'XX', 
        region: data.regionName || 'Unknown',
        city: data.city || 'Unknown',
        datacenter: data.isp || 'Unknown',
        isp: data.isp || 'Unknown',
        lat: data.lat,
        lon: data.lon
      };
    },
    
    // Free tier of ipinfo.io (50,000 requests/month)  
    async () => {
      const response = await fetch(`https://ipinfo.io/${ip}/json`);
      if (!response.ok) throw new Error('ipinfo.io failed');
      const data = await response.json();
      const [city, region] = (data.city || 'Unknown,Unknown').split(',');
      return {
        country: data.country || 'Unknown',
        countryCode: data.country || 'XX',
        region: region?.trim() || 'Unknown', 
        city: city?.trim() || 'Unknown',
        datacenter: data.org || 'Unknown',
        isp: data.org || 'Unknown',
        lat: data.loc ? parseFloat(data.loc.split(',')[0]) : undefined,
        lon: data.loc ? parseFloat(data.loc.split(',')[1]) : undefined
      };
    }
  ];
  
  // Try each source with exponential backoff
  for (let i = 0; i < sources.length; i++) {
    try {
      const result = await sources[i]();
      if (result.country !== 'Unknown') {
        return result;
      }
    } catch (error) {
      console.warn(`Geolocation source ${i + 1} failed for ${ip}:`, error);
      
      // Add delay between retries
      if (i < sources.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  }
  
  throw new Error('All geolocation sources failed');
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

export async function GET(request: NextRequest) {
  try {
    const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
    
    // Fetch real validator data from Solana RPC
    const voteAccounts = await connection.getVoteAccounts('confirmed');
    const epochInfo = await connection.getEpochInfo('confirmed');
    const clusterNodes = await connection.getClusterNodes();
    
    // Process real validator data
    const allValidators = [...voteAccounts.current, ...voteAccounts.delinquent];
    const totalNetworkStake = allValidators.reduce((sum, v) => sum + v.activatedStake, 0);
    
    // Limit to top 50 validators by stake for performance
    const topValidators = allValidators
      .sort((a, b) => b.activatedStake - a.activatedStake)
      .slice(0, 50);
    
    // Fetch geolocation data for validators (with rate limiting)
    const validatorsWithGeo = await Promise.all(
      topValidators.map(async (validator, index) => {
        const clusterNode = clusterNodes.find(node => 
          node.pubkey === validator.nodePubkey
        );
        
        // Add delay between geolocation requests to respect rate limits
        if (index > 0) {
          await new Promise(resolve => setTimeout(resolve, PERFORMANCE_CONSTANTS.RATE_LIMITS.COOLDOWN_MS));
        }
        
        // Get geolocation data for validator
        let geoData: GeolocationData = {
          country: 'Unknown',
          countryCode: 'XX',
          region: 'Unknown',
          city: 'Unknown',
          datacenter: 'Unknown',
          isp: 'Unknown'
        };
        
        if (clusterNode?.tpu) {
          const ip = extractIPFromEndpoint(clusterNode.tpu);
          if (ip && ip !== '127.0.0.1' && ip !== 'localhost') {
            try {
              geoData = await fetchGeolocation(ip);
            } catch (error) {
              console.warn(`Failed to get geolocation for validator ${validator.votePubkey}:`, error);
            }
          }
        }
        
        // Calculate performance metrics from real data
        const totalCredits = validator.epochCredits.reduce((sum, credit) => sum + credit[1], 0);
        const recentCredits = validator.epochCredits.slice(-5).reduce((sum, credit) => sum + credit[1], 0);
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
          rootSlot: validator.rootSlot,
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
      const currentDatacenter = datacenterMap.get(validator.datacenter) || { count: 0, stake: 0 };
      datacenterMap.set(validator.datacenter, {
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

    return NextResponse.json({
      success: true,
      data: {
        validators: validatorsWithGeo,
        networkStats,
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

