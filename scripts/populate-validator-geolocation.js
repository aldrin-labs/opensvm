#!/usr/bin/env node

/**
 * One-time script to populate Qdrant with validator geolocation data
 * After running this, the validator analytics endpoint will be fast
 */

const { Connection } = require('@solana/web3.js');
const { QdrantClient } = require('@qdrant/js-client-rest');

const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const QDRANT_SERVER = process.env.QDRANT_SERVER || 'http://localhost:6333';
const QDRANT_KEY = process.env.QDRANT;
const COLLECTION_NAME = 'validator_geolocation';

// Free geolocation API (no key required, rate limited)
async function geocodeIP(ip) {
  try {
    // Use ip-api.com (free, no key required, 45 requests/minute)
    const response = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,region,regionName,city,lat,lon,timezone,isp,org,as,query`
    );
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.status === 'success') {
      return {
        ip,
        country: data.country || 'Unknown',
        countryCode: data.countryCode || 'XX',
        region: data.regionName || 'Unknown',
        city: data.city || 'Unknown',
        datacenter: data.org || data.isp || 'Unknown',
        isp: data.isp || 'Unknown',
        lat: data.lat || 0,
        lon: data.lon || 0,
        timezone: data.timezone,
        asn: data.as,
        source: 'ip-api.com',
        cached_at: Date.now()
      };
    }
    
    throw new Error(data.message || 'Geolocation failed');
  } catch (error) {
    console.warn(`Failed to geocode ${ip}:`, error.message);
    return {
      ip,
      country: 'Unknown',
      countryCode: 'XX',
      region: 'Unknown',
      city: 'Unknown',
      datacenter: 'Unknown',
      isp: 'Unknown',
      lat: 0,
      lon: 0,
      source: 'fallback',
      cached_at: Date.now()
    };
  }
}

function extractIPFromEndpoint(endpoint) {
  try {
    if (endpoint.includes('://')) {
      const url = new URL(endpoint);
      return url.hostname;
    } else if (endpoint.includes(':')) {
      const [ip] = endpoint.split(':');
      return ip;
    }
    return endpoint;
  } catch (error) {
    return null;
  }
}

function ipToVector(ip, geoData) {
  const lat = geoData.lat || 0;
  const lon = geoData.lon || 0;
  
  const ipParts = ip.split('.').map(part => parseInt(part, 10) || 0);
  const ipVector = ipParts.map(part => part / 255);
  
  return [
    lat / 90,
    lon / 180,
    ...ipVector
  ];
}

function stringToHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

async function populateValidatorGeolocation() {
  console.log('📊 Starting validator geolocation population...\n');
  
  // Initialize Solana connection
  console.log('🔗 Connecting to Solana RPC...');
  const connection = new Connection(RPC_URL, 'confirmed');
  
  // Initialize Qdrant client
  console.log('🔗 Connecting to Qdrant...');
  const qdrant = new QdrantClient({
    url: QDRANT_SERVER,
    apiKey: QDRANT_KEY
  });
  
  // Create or recreate collection
  console.log(`📦 Setting up Qdrant collection: ${COLLECTION_NAME}...`);
  try {
    await qdrant.deleteCollection(COLLECTION_NAME);
    console.log('  ✓ Deleted existing collection');
  } catch (error) {
    console.log('  ℹ No existing collection to delete');
  }
  
  await qdrant.createCollection(COLLECTION_NAME, {
    vectors: {
      size: 6, // [lat/90, lon/180, ip_octet1/255, ip_octet2/255, ip_octet3/255, ip_octet4/255]
      distance: 'Cosine'
    }
  });
  
  await qdrant.createPayloadIndex(COLLECTION_NAME, {
    field_name: 'ip',
    field_schema: 'keyword'
  });
  
  console.log('  ✓ Collection created with IP index\n');
  
  // Fetch validators
  console.log('📡 Fetching validator data from Solana...');
  const [voteAccounts, clusterNodes] = await Promise.all([
    connection.getVoteAccounts('confirmed'),
    connection.getClusterNodes()
  ]);
  
  const allValidators = [...voteAccounts.current, ...voteAccounts.delinquent];
  console.log(`  ✓ Found ${allValidators.length} validators\n`);
  
  // Extract unique IPs
  const ipSet = new Set();
  const ipToValidators = new Map();
  
  allValidators.forEach(validator => {
    const clusterNode = clusterNodes.find(node => node.pubkey === validator.nodePubkey);
    if (clusterNode?.tpu) {
      const ip = extractIPFromEndpoint(clusterNode.tpu);
      if (ip && ip !== '127.0.0.1' && ip !== 'localhost') {
        ipSet.add(ip);
        if (!ipToValidators.has(ip)) {
          ipToValidators.set(ip, []);
        }
        ipToValidators.get(ip).push(validator.votePubkey);
      }
    }
  });
  
  const uniqueIps = Array.from(ipSet);
  console.log(`📍 Found ${uniqueIps.length} unique IP addresses to geocode\n`);
  
  // Geocode IPs in batches (rate limit: 45 requests/minute)
  console.log('🌍 Starting geolocation (rate limited to 45 req/min)...\n');
  const batchSize = 40; // Process 40 IPs per batch
  const delayBetweenBatches = 60000; // 1 minute between batches
  const delayBetweenRequests = 1500; // 1.5 seconds between requests in a batch
  
  let processed = 0;
  const totalIps = uniqueIps.length;
  const points = [];
  
  for (let i = 0; i < uniqueIps.length; i += batchSize) {
    const batch = uniqueIps.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(uniqueIps.length / batchSize);
    
    console.log(`📦 Batch ${batchNum}/${totalBatches} (${batch.length} IPs)`);
    
    for (const ip of batch) {
      const geoData = await geocodeIP(ip);
      const vector = ipToVector(ip, geoData);
      const pointId = stringToHash(ip);
      
      points.push({
        id: pointId,
        vector,
        payload: {
          ...geoData,
          validators: ipToValidators.get(ip) || []
        }
      });
      
      processed++;
      process.stdout.write(`  Progress: ${processed}/${totalIps} (${((processed/totalIps)*100).toFixed(1)}%)\r`);
      
      // Rate limiting delay
      if (i + batch.indexOf(ip) < uniqueIps.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenRequests));
      }
    }
    
    console.log(''); // New line after progress
    
    // Upload batch to Qdrant
    console.log(`  💾 Uploading batch to Qdrant...`);
    await qdrant.upsert(COLLECTION_NAME, {
      wait: true,
      points: points.splice(0, points.length)
    });
    console.log(`  ✓ Batch ${batchNum} uploaded\n`);
    
    // Delay between batches (except for last batch)
    if (i + batchSize < uniqueIps.length) {
      console.log(`  ⏳ Waiting 60s before next batch (rate limiting)...\n`);
      await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
    }
  }
  
  // Final stats
  console.log('═'.repeat(80));
  console.log('✅ Geolocation population complete!\n');
  console.log(`📊 Statistics:`);
  console.log(`   - Total IPs processed: ${totalIps}`);
  console.log(`   - Total validators covered: ${allValidators.length}`);
  console.log(`   - Collection: ${COLLECTION_NAME}`);
  console.log('═'.repeat(80));
  console.log('\n💡 The validator analytics endpoint will now use this cached data');
  console.log('   and only geocode NEW validators going forward.\n');
}

populateValidatorGeolocation().catch(console.error);
