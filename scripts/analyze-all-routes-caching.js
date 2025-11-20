#!/usr/bin/env node

/**
 * Comprehensive API Routes Caching Analysis
 * Analyzes all 191 API routes for caching implementation
 */

const fs = require('fs');
const path = require('path');

// Routes that should have caching (read-only, expensive operations)
const SHOULD_CACHE = [
  // Token routes
  'token/[address]',
  'token/[address]/holders',
  'token/[address]/holdersByVolume',
  'token/[address]/traders',
  
  // Account routes
  'account-portfolio/[address]',
  'account-stats/[address]',
  'account-token-stats/[address]/[mint]',
  'account-transactions/[address]',
  'account-transfers/[address]',
  
  // Analytics routes
  'analytics/overview',
  'analytics/dex',
  'analytics/validators',
  'analytics/defi-health',
  'analytics/trending-validators',
  
  // Block routes
  'blocks',
  'blocks/[slot]',
  'blocks/stats',
  
  // Transaction routes
  'transaction/[signature]',
  'transaction/[signature]/analysis',
  'transaction/[signature]/metrics',
  'transaction/[signature]/related',
  
  // Program routes
  'program/[address]',
  'program-registry',
  'program-registry/[programId]',
  
  // NFT routes
  'nft-collections',
  'nft-collections/trending',
  
  // Market data
  'market-data',
  'dex/[name]',
  
  // Validator routes
  'validator/[address]',
  
  // User profile (read operations)
  'user-profile/[walletAddress]',
  'user-history/[walletAddress]',
];

// Routes that should NOT have caching (write operations, real-time data)
const SHOULD_NOT_CACHE = [
  // Auth routes
  'auth/',
  
  // Write operations
  'bank/wallets/create',
  'launchpad/sales/[saleId]/contribute',
  'user-social/follow',
  'user-social/like',
  
  // Real-time streams
  'stream/',
  'sse-',
  'websocket',
  
  // Trading operations
  'trading/execute',
  'trading/positions',
  
  // Admin operations
  'launchpad/admin/',
];

function findAllRoutes() {
  const routes = [];
  const apiDir = path.join(process.cwd(), 'app', 'api');
  
  function scanDir(dir, relativePath = '') {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const newRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
      
      if (entry.isDirectory()) {
        scanDir(fullPath, newRelativePath);
      } else if (entry.name === 'route.ts') {
        routes.push({
          path: relativePath,
          file: fullPath
        });
      }
    }
  }
  
  scanDir(apiDir);
  return routes;
}

function analyzeRouteFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    const hasCache = content.includes('Cache') || content.includes('cache');
    const hasCacheDuration = /CACHE_DURATION|cache.*duration/i.test(content);
    const hasBackgroundRefresh = /background.*update|updateCache.*Background/i.test(content);
    const hasCachedFlag = /cached:\s*true|cached:\s*false/i.test(content);
    const hasCacheAge = /cacheAge/i.test(content);
    
    return {
      hasCache,
      hasCacheDuration,
      hasBackgroundRefresh,
      hasCachedFlag,
      hasCacheAge,
      score: (hasCache ? 1 : 0) + 
             (hasCacheDuration ? 1 : 0) + 
             (hasBackgroundRefresh ? 1 : 0) + 
             (hasCachedFlag ? 1 : 0) + 
             (hasCacheAge ? 1 : 0)
    };
  } catch (error) {
    return null;
  }
}

function shouldHaveCache(routePath) {
  return SHOULD_CACHE.some(pattern => routePath.includes(pattern));
}

function shouldNotHaveCache(routePath) {
  return SHOULD_NOT_CACHE.some(pattern => routePath.includes(pattern));
}

function main() {
  console.log('🔍 Analyzing All API Routes for Caching...\n');
  
  const routes = findAllRoutes();
  console.log(`Found ${routes.length} total routes\n`);
  
  const results = {
    withCache: [],
    withoutCache: [],
    shouldHaveCache: [],
    shouldNotHaveCache: [],
    complete: [],
    incomplete: []
  };
  
  for (const route of routes) {
    const analysis = analyzeRouteFile(route.file);
    if (!analysis) continue;
    
    const shouldCache = shouldHaveCache(route.path);
    const shouldNotCache = shouldNotHaveCache(route.path);
    
    const routeInfo = {
      path: route.path,
      ...analysis,
      shouldCache,
      shouldNotCache
    };
    
    if (analysis.hasCache) {
      results.withCache.push(routeInfo);
      
      if (analysis.score >= 4) {
        results.complete.push(routeInfo);
      } else {
        results.incomplete.push(routeInfo);
      }
    } else {
      results.withoutCache.push(routeInfo);
      
      if (shouldCache) {
        results.shouldHaveCache.push(routeInfo);
      }
    }
    
    if (shouldNotCache) {
      results.shouldNotHaveCache.push(routeInfo);
    }
  }
  
  // Summary
  console.log('📊 CACHING ANALYSIS SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total Routes: ${routes.length}`);
  console.log(`Routes with caching: ${results.withCache.length}`);
  console.log(`Routes without caching: ${results.withoutCache.length}`);
  console.log(`Complete caching (score 4-5): ${results.complete.length}`);
  console.log(`Incomplete caching (score 1-3): ${results.incomplete.length}`);
  console.log(`Missing caching (should have): ${results.shouldHaveCache.length}`);
  console.log('='.repeat(80));
  
  // Complete caching routes
  if (results.complete.length > 0) {
    console.log('\n✅ Routes with Complete Caching:');
    results.complete.forEach(r => {
      console.log(`  ✓ ${r.path} (score: ${r.score}/5)`);
    });
  }
  
  // Incomplete caching routes
  if (results.incomplete.length > 0) {
    console.log('\n⚠️  Routes with Incomplete Caching:');
    results.incomplete.forEach(r => {
      const missing = [];
      if (!r.hasCacheDuration) missing.push('duration');
      if (!r.hasBackgroundRefresh) missing.push('background refresh');
      if (!r.hasCachedFlag) missing.push('cached flag');
      if (!r.hasCacheAge) missing.push('cacheAge');
      console.log(`  ⚠️  ${r.path} (score: ${r.score}/5) - missing: ${missing.join(', ')}`);
    });
  }
  
  // Routes that should have caching
  if (results.shouldHaveCache.length > 0) {
    console.log('\n❌ Routes Missing Caching (should have):');
    results.shouldHaveCache.forEach(r => {
      console.log(`  ✗ ${r.path}`);
    });
  }
  
  // Export detailed report
  const report = {
    timestamp: new Date().toISOString(),
    totalRoutes: routes.length,
    summary: {
      withCache: results.withCache.length,
      withoutCache: results.withoutCache.length,
      complete: results.complete.length,
      incomplete: results.incomplete.length,
      shouldHaveCache: results.shouldHaveCache.length
    },
    complete: results.complete.map(r => r.path),
    incomplete: results.incomplete.map(r => ({ path: r.path, score: r.score })),
    missing: results.shouldHaveCache.map(r => r.path)
  };
  
  fs.writeFileSync('caching-analysis-report.json', JSON.stringify(report, null, 2));
  console.log('\n📄 Detailed report saved to: caching-analysis-report.json');
}

main();
