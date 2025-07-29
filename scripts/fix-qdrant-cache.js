#!/usr/bin/env node

/**
 * Script to fix Qdrant cache collection issues
 * - Ensures discriminator index exists
 * - Cleans up invalid point IDs
 * - Recreates collection if necessary
 */

// Load environment variables
require('dotenv').config();

const { QdrantClient } = require('@qdrant/js-client-rest');

const qdrantClient = new QdrantClient({
  url: process.env.QDRANT_SERVER || 'http://localhost:6333',
  apiKey: process.env.QDRANT || undefined,
});

const CACHE_COLLECTIONS = {
  TRANSACTION_ANALYSIS: 'transaction_analysis_cache',
};

async function fixQdrantCache() {
  console.log('🔧 Starting Qdrant cache fix...');

  try {
    // Check if collection exists
    let collectionExists = false;
    try {
      await qdrantClient.getCollection(CACHE_COLLECTIONS.TRANSACTION_ANALYSIS);
      collectionExists = true;
      console.log('✅ Transaction analysis cache collection exists');
    } catch (error) {
      console.log('❌ Transaction analysis cache collection does not exist');
    }

    // If collection exists, try to add missing indexes
    if (collectionExists) {
      console.log('🔍 Checking and creating indexes...');
      
      const indexes = ['cacheType', 'signature', 'programId', 'discriminator', 'expiresAt'];
      
      for (const field of indexes) {
        try {
          await qdrantClient.createPayloadIndex(CACHE_COLLECTIONS.TRANSACTION_ANALYSIS, {
            field_name: field,
            field_schema: 'keyword'
          });
          console.log(`✅ Created index for ${field}`);
        } catch (error) {
          if (error?.message?.includes('already exists')) {
            console.log(`✅ Index for ${field} already exists`);
          } else {
            console.error(`❌ Failed to create index for ${field}:`, error?.message);
          }
        }
      }

      // Clean up invalid point IDs by recreating the collection
      console.log('🧹 Recreating collection to fix invalid point IDs...');
      
      try {
        await qdrantClient.deleteCollection(CACHE_COLLECTIONS.TRANSACTION_ANALYSIS);
        console.log('✅ Deleted old collection');
      } catch (error) {
        console.error('❌ Failed to delete collection:', error?.message);
      }
    }

    // Create collection with proper structure
    console.log('🏗️ Creating transaction analysis cache collection...');
    
    try {
      await qdrantClient.createCollection(CACHE_COLLECTIONS.TRANSACTION_ANALYSIS, {
        vectors: {
          size: 384, // Dimension for embeddings
          distance: 'Cosine'
        }
      });
      console.log('✅ Created transaction analysis cache collection');
    } catch (error) {
      if (error?.message?.includes('already exists')) {
        console.log('✅ Collection already exists');
      } else {
        throw error;
      }
    }

    // Create all necessary indexes
    console.log('📋 Creating all necessary indexes...');
    
    const indexes = ['cacheType', 'signature', 'programId', 'discriminator', 'expiresAt'];
    
    for (const field of indexes) {
      try {
        // Use 'float' schema for expiresAt, otherwise 'keyword'
        const fieldSchema = field === 'expiresAt' ? 'float' : 'keyword';
        await qdrantClient.createPayloadIndex(CACHE_COLLECTIONS.TRANSACTION_ANALYSIS, {
          field_name: field,
          field_schema: fieldSchema
        });
        console.log(`✅ Created index for ${field}`);
      } catch (error) {
        if (error?.message?.includes('already exists')) {
          console.log(`✅ Index for ${field} already exists`);
        } else {
          console.error(`❌ Failed to create index for ${field}:`, error?.message);
        }
      }
    }

    console.log('🎉 Qdrant cache fix completed successfully!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Restart your application');
    console.log('2. The cache will be rebuilt automatically as transactions are processed');
    console.log('3. Monitor for any remaining errors');

  } catch (error) {
    console.error('💥 Failed to fix Qdrant cache:', error);
    process.exit(1);
  }
}

// Run the fix
if (require.main === module) {
  fixQdrantCache()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('💥 Script failed:', error);
      process.exit(1);
    });
}

module.exports = { fixQdrantCache };
