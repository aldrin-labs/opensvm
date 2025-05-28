/**
 * Test script for search functionality
 * 
 * This script tests the enhanced search functionality with various query types
 * to ensure all features are working properly.
 */

import { unifiedSearch } from '../lib/unified-search';
import { getComprehensiveBlockchainData } from '../lib/moralis-api';
import { searchTelegramChats } from '../lib/telegram-search';
import { searchDuckDuckGo } from '../lib/duckduckgo-search';
import { searchXCom } from '../lib/xcom-search';

// Sample queries for testing
const testQueries = [
  // Solana addresses
  '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', // Token address
  'So11111111111111111111111111111111111111112',  // SOL token
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC token
  
  // General blockchain terms
  'Solana NFT',
  'DeFi protocols',
  'Solana validators',
  
  // Transaction signatures (simulated)
  '4Zw5SHkZ7MUQpE4h4exhX9ic4GawTYNhexoAXgbUMBJNnJwZfpHJhWkP5ysJAXrEFGDPFdtYjKfLJbj3GriekK3Y',
  
  // Mixed queries
  'Solana ecosystem',
  'Solana wallet',
  'Solana transaction fees'
];

// Test search with different options
async function runSearchTests() {
  console.log('🧪 Starting search functionality tests...\n');
  
  // Test 1: Basic unified search
  console.log('Test 1: Basic unified search');
  try {
    const basicResult = await unifiedSearch(testQueries[0]);
    console.log(`✅ Basic search returned ${basicResult.combined.length} results`);
    console.log(`  - SVM: ${basicResult.sources.svm.length} results`);
    console.log(`  - Telegram: ${basicResult.sources.telegram.length} results`);
    console.log(`  - DuckDuckGo: ${basicResult.sources.duckduckgo.length} results`);
    console.log(`  - X.com: ${basicResult.sources.xcom.length} results`);
  } catch (error) {
    console.error('❌ Basic search test failed:', error);
  }
  
  // Test 2: Source-specific search
  console.log('\nTest 2: Source-specific search');
  try {
    const telegramResult = await unifiedSearch(testQueries[1], { sources: ['telegram'] });
    console.log(`✅ Telegram search returned ${telegramResult.sources.telegram.length} results`);
    
    const webResult = await unifiedSearch(testQueries[2], { sources: ['duckduckgo'] });
    console.log(`✅ DuckDuckGo search returned ${webResult.sources.duckduckgo.length} results`);
    
    const xcomResult = await unifiedSearch(testQueries[3], { sources: ['xcom'] });
    console.log(`✅ X.com search returned ${xcomResult.sources.xcom.length} results`);
  } catch (error) {
    console.error('❌ Source-specific search test failed:', error);
  }
  
  // Test 3: Time-filtered search
  console.log('\nTest 3: Time-filtered search');
  try {
    const dayResult = await unifiedSearch(testQueries[4], { timeRange: 'day' });
    console.log(`✅ 24-hour search returned ${dayResult.combined.length} results`);
    
    const weekResult = await unifiedSearch(testQueries[4], { timeRange: 'week' });
    console.log(`✅ Week search returned ${weekResult.combined.length} results`);
  } catch (error) {
    console.error('❌ Time-filtered search test failed:', error);
  }
  
  // Test 4: Sorted search
  console.log('\nTest 4: Sorted search');
  try {
    const relevanceResult = await unifiedSearch(testQueries[5], { sortBy: 'relevance' });
    console.log(`✅ Relevance-sorted search returned ${relevanceResult.combined.length} results`);
    
    const dateResult = await unifiedSearch(testQueries[5], { sortBy: 'date' });
    console.log(`✅ Date-sorted search returned ${dateResult.combined.length} results`);
  } catch (error) {
    console.error('❌ Sorted search test failed:', error);
  }
  
  // Test 5: Blockchain data retrieval
  console.log('\nTest 5: Blockchain data retrieval');
  try {
    const blockchainData = await getComprehensiveBlockchainData(testQueries[0]);
    console.log(`✅ Blockchain data retrieved for ${testQueries[0]}`);
    console.log(`  - Data type: ${blockchainData?.type || 'unknown'}`);
    console.log(`  - Data fields: ${blockchainData ? Object.keys(blockchainData.data).join(', ') : 'none'}`);
  } catch (error) {
    console.error('❌ Blockchain data retrieval test failed:', error);
  }
  
  // Test 6: Individual search services
  console.log('\nTest 6: Individual search services');
  try {
    const telegramResults = await searchTelegramChats(testQueries[6], 5);
    console.log(`✅ Telegram search returned ${telegramResults.length} results`);
    
    const duckduckgoResults = await searchDuckDuckGo(testQueries[7], 5);
    console.log(`✅ DuckDuckGo search returned ${duckduckgoResults.length} results`);
    
    const xcomResults = await searchXCom(testQueries[8], 5);
    console.log(`✅ X.com search returned ${xcomResults.length} results`);
  } catch (error) {
    console.error('❌ Individual search services test failed:', error);
  }
  
  // Test 7: Cache performance
  console.log('\nTest 7: Cache performance');
  try {
    console.time('First search');
    await unifiedSearch(testQueries[9]);
    console.timeEnd('First search');
    
    console.time('Cached search');
    await unifiedSearch(testQueries[9]);
    console.timeEnd('Cached search');
    console.log('✅ Cache performance test completed');
  } catch (error) {
    console.error('❌ Cache performance test failed:', error);
  }
  
  console.log('\n🎉 All search tests completed!');
}

// Run the tests
runSearchTests().catch(error => {
  console.error('Error running tests:', error);
});
