#!/usr/bin/env node

/**
 * Script to add missing 'id' index to existing Qdrant collections
 */

require('dotenv').config();
const { QdrantClient } = require('@qdrant/js-client-rest');

const qdrantClient = new QdrantClient({
  url: process.env.QDRANT_SERVER || 'http://localhost:6333',
  apiKey: process.env.QDRANT || undefined,
});

const COLLECTIONS = {
  API_KEYS: 'api_keys',
  AUTH_LINKS: 'auth_links',
};

async function addIdIndexes() {
  try {
    console.log('Adding missing "id" indexes to Qdrant collections...\n');

    // Add index to api_keys collection
    console.log('1. Adding "id" index to api_keys collection...');
    try {
      await qdrantClient.createPayloadIndex(COLLECTIONS.API_KEYS, {
        field_name: 'id',
        field_schema: 'keyword',
      });
      console.log('✅ Successfully created "id" index for api_keys');
    } catch (error) {
      if (error.message?.includes('already exists')) {
        console.log('ℹ️  Index already exists for api_keys');
      } else {
        throw error;
      }
    }

    // Add index to auth_links collection
    console.log('\n2. Adding "id" index to auth_links collection...');
    try {
      await qdrantClient.createPayloadIndex(COLLECTIONS.AUTH_LINKS, {
        field_name: 'id',
        field_schema: 'keyword',
      });
      console.log('✅ Successfully created "id" index for auth_links');
    } catch (error) {
      if (error.message?.includes('already exists')) {
        console.log('ℹ️  Index already exists for auth_links');
      } else {
        throw error;
      }
    }

    console.log('\n✅ All indexes have been added successfully!');
    console.log('\nYou can now test the API key creation flow.');

  } catch (error) {
    console.error('❌ Error adding indexes:', error.message);
    if (error.data) {
      console.error('Error data:', JSON.stringify(error.data, null, 2));
    }
    process.exit(1);
  }
}

// Run the script
addIdIndexes();
