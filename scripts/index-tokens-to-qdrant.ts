/**
 * Script to index Solana token list to Qdrant
 *
 * Downloads the Solana Labs token list and indexes all mainnet tokens to Qdrant
 * for vector search capabilities.
 *
 * Usage: npx ts-node scripts/index-tokens-to-qdrant.ts
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import * as crypto from 'crypto';

// Qdrant configuration
const QDRANT_URL = process.env.QDRANT_SERVER || 'http://localhost:6333';
const QDRANT_API_KEY = process.env.QDRANT || undefined;
const COLLECTION_NAME = 'solana_tokens';
const BATCH_SIZE = 100;

// Token list URL
const TOKEN_LIST_URL = 'https://raw.githubusercontent.com/solana-labs/token-list/main/src/tokens/solana.tokenlist.json';

interface SolanaToken {
  chainId: number;
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  tags?: string[];
  extensions?: Record<string, string>;
}

interface TokenList {
  name: string;
  tokens: SolanaToken[];
  tags: Record<string, { name: string; description: string }>;
}

// Simple text to vector function (deterministic hash-based for now)
// In production, you'd use an embedding model like OpenAI or sentence-transformers
function textToVector(text: string, dimensions: number = 384): number[] {
  const hash = crypto.createHash('sha512').update(text).digest();
  const vector: number[] = [];

  for (let i = 0; i < dimensions; i++) {
    // Use hash bytes to generate pseudo-random values
    const byteIndex = i % hash.length;
    const value = (hash[byteIndex] / 255) * 2 - 1; // Normalize to [-1, 1]
    vector.push(value);
  }

  // Normalize the vector
  const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  return vector.map(v => v / magnitude);
}

// Generate searchable text from token
function getSearchableText(token: SolanaToken): string {
  const parts = [
    token.symbol,
    token.name,
    token.address,
    ...(token.tags || []),
  ];

  if (token.extensions) {
    if (token.extensions.description) parts.push(token.extensions.description);
    if (token.extensions.website) parts.push(token.extensions.website);
  }

  return parts.filter(Boolean).join(' ').toLowerCase();
}

async function main() {
  console.log('=== Solana Token Indexer for Qdrant ===\n');

  // Initialize Qdrant client
  const client = new QdrantClient({
    url: QDRANT_URL,
    apiKey: QDRANT_API_KEY,
  });

  console.log(`Connecting to Qdrant at ${QDRANT_URL}...`);

  // Fetch token list
  console.log(`\nFetching token list from ${TOKEN_LIST_URL}...`);
  const response = await fetch(TOKEN_LIST_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch token list: ${response.status}`);
  }

  const tokenList: TokenList = await response.json();
  console.log(`Total tokens in list: ${tokenList.tokens.length}`);

  // Filter mainnet tokens only (chainId 101)
  const mainnetTokens = tokenList.tokens.filter(t => t.chainId === 101);
  console.log(`Mainnet tokens (chainId 101): ${mainnetTokens.length}`);

  // Create or recreate collection
  console.log(`\nSetting up collection: ${COLLECTION_NAME}...`);

  try {
    // Check if collection exists
    const exists = await client.getCollection(COLLECTION_NAME).catch(() => null);

    if (exists) {
      console.log('Collection exists, recreating...');
      await client.deleteCollection(COLLECTION_NAME);
    }

    // Create collection with proper schema
    await client.createCollection(COLLECTION_NAME, {
      vectors: {
        size: 384,
        distance: 'Cosine',
      },
    });

    console.log('Collection created successfully');

    // Create payload indexes for efficient filtering
    console.log('Creating payload indexes...');

    const indexes = ['symbol', 'address', 'decimals'];
    for (const field of indexes) {
      try {
        await client.createPayloadIndex(COLLECTION_NAME, {
          field_name: field,
          field_schema: field === 'decimals' ? 'integer' : 'keyword',
        });
        console.log(`  - Created index: ${field}`);
      } catch (e: any) {
        console.log(`  - Index ${field} already exists or failed`);
      }
    }

    // Also create text index for tags
    try {
      await client.createPayloadIndex(COLLECTION_NAME, {
        field_name: 'tags',
        field_schema: 'keyword',
      });
      console.log('  - Created index: tags');
    } catch (e) {
      console.log('  - Index tags already exists or failed');
    }

  } catch (error) {
    console.error('Error setting up collection:', error);
    throw error;
  }

  // Index tokens in batches
  console.log(`\nIndexing ${mainnetTokens.length} tokens in batches of ${BATCH_SIZE}...`);

  let indexed = 0;
  let failed = 0;

  for (let i = 0; i < mainnetTokens.length; i += BATCH_SIZE) {
    const batch = mainnetTokens.slice(i, i + BATCH_SIZE);

    const points = batch.map((token, idx) => {
      const searchText = getSearchableText(token);
      const vector = textToVector(searchText);

      return {
        id: i + idx + 1, // Qdrant requires positive integer IDs
        vector,
        payload: {
          address: token.address,
          symbol: token.symbol,
          name: token.name,
          decimals: token.decimals,
          logoURI: token.logoURI || null,
          tags: token.tags || [],
          extensions: token.extensions || {},
          chainId: token.chainId,
          searchText, // Store for debugging
        },
      };
    });

    try {
      await client.upsert(COLLECTION_NAME, {
        wait: true,
        points,
      });

      indexed += batch.length;
      const progress = ((indexed / mainnetTokens.length) * 100).toFixed(1);
      process.stdout.write(`\rProgress: ${indexed}/${mainnetTokens.length} (${progress}%)`);
    } catch (error) {
      console.error(`\nError indexing batch at ${i}:`, error);
      failed += batch.length;
    }
  }

  console.log(`\n\n=== Indexing Complete ===`);
  console.log(`Indexed: ${indexed} tokens`);
  console.log(`Failed: ${failed} tokens`);

  // Verify collection
  const info = await client.getCollection(COLLECTION_NAME);
  console.log(`\nCollection info:`);
  console.log(`  - Points count: ${info.points_count}`);
  console.log(`  - Vectors count: ${info.vectors_count}`);
  console.log(`  - Status: ${info.status}`);

  // Test search
  console.log('\n=== Testing Search ===');

  const testQueries = ['USDC', 'wrapped bitcoin', 'meme', 'stablecoin'];

  for (const query of testQueries) {
    const queryVector = textToVector(query.toLowerCase());

    const results = await client.search(COLLECTION_NAME, {
      vector: queryVector,
      limit: 3,
      with_payload: true,
    });

    console.log(`\nQuery: "${query}"`);
    results.forEach((r, i) => {
      const payload = r.payload as any;
      console.log(`  ${i + 1}. ${payload.symbol} - ${payload.name} (score: ${r.score.toFixed(3)})`);
    });
  }

  console.log('\n=== Done ===');
}

main().catch(console.error);
