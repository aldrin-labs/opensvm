/**
 * Comprehensive Qdrant Migration Script
 * Initializes all Qdrant collections and indexes for the application
 */

const { QdrantClient } = require('@qdrant/js-client-rest');

// Initialize Qdrant client
const qdrantClient = new QdrantClient({
  url: process.env.QDRANT_SERVER || 'http://localhost:6333',
  apiKey: process.env.QDRANT || undefined,
});

// Collection configurations
const COLLECTIONS = {
  USER_HISTORY: {
    name: 'user_history',
    vectors: { size: 384, distance: 'Cosine' },
    indexes: [
      'walletAddress', 'pageType', 'timestamp', 'path', 'pageTitle',
      'metadata.transactionId', 'metadata.accountAddress', 'metadata.programId', 
      'metadata.tokenMint', 'metadata.validatorAddress', 'metadata.searchQuery',
      'userAgent', 'referrer'
    ]
  },
  USER_PROFILES: {
    name: 'user_profiles',
    vectors: { size: 384, distance: 'Cosine' },
    indexes: [
      'walletAddress', 'displayName', 'isPublic', 'createdAt', 'lastActive',
      'socialStats.followers', 'socialStats.following', 'socialStats.likes',
      'socialStats.profileViews', 'stats.totalVisits', 'stats.uniquePages'
    ]
  },
  USER_FOLLOWS: {
    name: 'user_follows',
    vectors: { size: 384, distance: 'Cosine' },
    indexes: ['followerAddress', 'targetAddress', 'timestamp']
  },
  USER_LIKES: {
    name: 'user_likes',
    vectors: { size: 384, distance: 'Cosine' },
    indexes: ['likerAddress', 'targetAddress', 'timestamp']
  },
  SHARES: {
    name: 'shares',
    vectors: { size: 384, distance: 'Cosine' },
    indexes: [
      'shareCode', 'referrerAddress', 'entityType', 'entityId', 'timestamp',
      'clicks', 'conversions', 'expiresAt', 'title', 'description'
    ]
  },
  SHARE_CLICKS: {
    name: 'share_clicks',
    vectors: { size: 384, distance: 'Cosine' },
    indexes: [
      'shareCode', 'clickerAddress', 'timestamp', 'userAgent', 
      'referrer', 'converted'
    ]
  },
  TRANSFERS: {
    name: 'transfers',
    vectors: { size: 384, distance: 'Cosine' },
    indexes: [
      'walletAddress', 'signature', 'token', 'tokenSymbol', 'tokenName',
      'from', 'to', 'mint', 'programId', 'type', 'amount', 'usdValue',
      'isSolanaOnly', 'cached', 'timestamp', 'lastUpdated'
    ]
  },
  TOKEN_METADATA: {
    name: 'token_metadata',
    vectors: { size: 384, distance: 'Cosine' },
    indexes: [
      'mintAddress', 'symbol', 'name', 'decimals', 'verified', 'cached', 
      'cacheExpiry', 'lastUpdated', 'metadataUri', 'description'
    ]
  },
  PROGRAM_METADATA: {
    name: 'program_metadata',
    vectors: { size: 384, distance: 'Cosine' },
    indexes: [
      'programId', 'name', 'category', 'verified', 'cached', 'cacheExpiry',
      'description', 'tags', 'authority', 'upgradeAuthority', 'deployedSlot',
      'lastUpdated'
    ]
  },
  TRANSACTION_ANALYSIS: {
    name: 'transaction_analysis_cache',
    vectors: { size: 384, distance: 'Cosine' },
    indexes: ['cacheType', 'signature', 'programId', 'discriminator', 'expiresAt']
  }
};

async function ensureIndex(collectionName, fieldName) {
  try {
    await qdrantClient.createPayloadIndex(collectionName, {
      field_name: fieldName,
      field_schema: 'keyword'
    });
    console.log(`✅ Created index for ${fieldName} in ${collectionName}`);
  } catch (error) {
    if (error?.data?.status?.error?.includes('already exists') || 
        error?.message?.includes('already exists')) {
      console.log(`ℹ️  Index for ${fieldName} in ${collectionName} already exists`);
    } else {
      console.warn(`⚠️  Failed to create index for ${fieldName} in ${collectionName}:`, 
                   error?.data?.status?.error || error?.message);
    }
  }
}

async function ensureCollection(config) {
  const { name, vectors, indexes } = config;
  
  try {
    console.log(`\n🔍 Checking collection: ${name}`);
    
    // Check if collection exists
    const exists = await qdrantClient.getCollection(name).catch(() => null);
    
    if (!exists) {
      console.log(`🏗️  Creating collection: ${name}`);
      await qdrantClient.createCollection(name, { vectors });
      console.log(`✅ Created collection: ${name}`);
    } else {
      console.log(`ℹ️  Collection ${name} already exists`);
    }

    // Ensure all indexes exist
    console.log(`📋 Creating indexes for ${name}...`);
    for (const indexField of indexes) {
      await ensureIndex(name, indexField);
    }
    
    console.log(`✅ Collection ${name} setup complete`);
    
  } catch (error) {
    console.error(`❌ Error setting up collection ${name}:`, error);
    throw error;
  }
}

async function main() {
  try {
    console.log('🚀 Starting comprehensive Qdrant migration...');
    console.log(`📡 Connecting to: ${process.env.QDRANT_SERVER || 'http://localhost:6333'}`);
    
    // Test connection
    try {
      await qdrantClient.getCollections();
      console.log('✅ Qdrant connection successful');
    } catch (error) {
      console.error('❌ Failed to connect to Qdrant:', error);
      process.exit(1);
    }

    // Migrate all collections
    for (const [key, config] of Object.entries(COLLECTIONS)) {
      console.log(`\n📦 Processing ${key}...`);
      await ensureCollection(config);
    }

    console.log('\n🎉 All Qdrant migrations completed successfully!');
    console.log('\n📊 Collection Summary:');
    
    // Show final status
    const collections = await qdrantClient.getCollections();
    for (const collection of collections.collections) {
      const info = await qdrantClient.getCollection(collection.name);
      console.log(`  - ${collection.name}: ${info.points_count || 0} points`);
    }

    console.log('\n✨ Migration complete. You can now:');
    console.log('  1. Restart your application');
    console.log('  2. User stats will sync automatically to Qdrant');
    console.log('  3. Real-time feed updates will work properly');
    console.log('  4. All database operations should function without errors');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n⏹️  Migration interrupted by user');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n⏹️  Migration terminated');
  process.exit(0);
});

main().catch(error => {
  console.error('💥 Unexpected error:', error);
  process.exit(1);
});
