/**
 * Cache Demo Component
 * 
 * Demonstrates the cache-first data retrieval hooks and DuckDB integration
 */

import React from 'react';
import { 
  useCachedTransaction, 
  useCachedBlock, 
  useCachedAccount, 
  useCacheManager,
  useBulkCache 
} from '@/lib/hooks/use-cache-first';

export function CacheDemo() {
  const { stats, clearCache, refreshStats } = useCacheManager();
  const { preloadTransactions, preloadBlocks } = useBulkCache();

  // Example usage of cache-first hooks
  const transactionResult = useCachedTransaction('2SUpdEWYWEkATxbrceCDgrkRdYcCkbq3eMnJevFh1go3uhGZyh3K2wFHLnS7S9jutiuXMnQUsQ3CsYuStvqvbJ2B');
  const blockResult = useCachedBlock(123456789);
  const accountResult = useCachedAccount('11111111111111111111111111111112');

  const handlePreloadExample = async () => {
    // Example of bulk preloading
    await preloadTransactions([
      'signature1',
      'signature2',
      'signature3'
    ]);
    
    await preloadBlocks([123456789, 123456790, 123456791]);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">DuckDB Cache Demo</h1>
      
      {/* Cache Statistics */}
      <div className="bg-gray-100 p-4 rounded-lg mb-6">
        <h2 className="text-lg font-semibold mb-3">Cache Statistics</h2>
        {stats ? (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p><strong>Total Entries:</strong> {stats.totalEntries}</p>
              <p><strong>Total Size:</strong> {(stats.totalSize / 1024 / 1024).toFixed(2)} MB</p>
              <p><strong>Hit Rate:</strong> {(stats.hitRate * 100).toFixed(1)}%</p>
            </div>
            <div>
              <p><strong>Miss Rate:</strong> {(stats.missRate * 100).toFixed(1)}%</p>
              <p><strong>Evictions:</strong> {stats.evictionCount}</p>
              <p><strong>Cache Age:</strong> {stats.oldestEntry ? new Date(stats.oldestEntry).toLocaleString() : 'N/A'}</p>
            </div>
          </div>
        ) : (
          <p>Loading cache statistics...</p>
        )}
        
        <div className="mt-4 space-x-2">
          <button 
            onClick={refreshStats}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Refresh Stats
          </button>
          <button 
            onClick={clearCache}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Clear Cache
          </button>
          <button 
            onClick={handlePreloadExample}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Preload Example Data
          </button>
        </div>
      </div>

      {/* Transaction Example */}
      <div className="bg-white border rounded-lg p-4 mb-4">
        <h3 className="text-lg font-semibold mb-2">Transaction Cache Example</h3>
        <div className="flex items-center space-x-4 mb-2">
          <span className={`px-2 py-1 rounded text-sm ${transactionResult.fromCache ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
            {transactionResult.fromCache ? 'From Cache' : 'From API'}
          </span>
          <span className={`px-2 py-1 rounded text-sm ${transactionResult.loading ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'}`}>
            {transactionResult.loading ? 'Loading...' : 'Loaded'}
          </span>
          {transactionResult.cacheStats.hit && (
            <span className="text-sm text-green-600">Cache Hit!</span>
          )}
        </div>
        {transactionResult.error ? (
          <p className="text-red-600">Error: {transactionResult.error.message}</p>
        ) : transactionResult.data ? (
          <div className="text-sm">
            <p><strong>Signature:</strong> {transactionResult.data.signature || 'Demo signature'}</p>
            <p><strong>Status:</strong> {transactionResult.data.status || 'Demo status'}</p>
          </div>
        ) : (
          <p>No data available</p>
        )}
        <button 
          onClick={transactionResult.refresh}
          className="mt-2 px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
        >
          Refresh
        </button>
      </div>

      {/* Block Example */}
      <div className="bg-white border rounded-lg p-4 mb-4">
        <h3 className="text-lg font-semibold mb-2">Block Cache Example</h3>
        <div className="flex items-center space-x-4 mb-2">
          <span className={`px-2 py-1 rounded text-sm ${blockResult.fromCache ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
            {blockResult.fromCache ? 'From Cache' : 'From API'}
          </span>
          <span className={`px-2 py-1 rounded text-sm ${blockResult.loading ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'}`}>
            {blockResult.loading ? 'Loading...' : 'Loaded'}
          </span>
        </div>
        {blockResult.error ? (
          <p className="text-red-600">Error: {blockResult.error.message}</p>
        ) : blockResult.data ? (
          <div className="text-sm">
            <p><strong>Slot:</strong> {blockResult.data.slot || 123456789}</p>
            <p><strong>Blockhash:</strong> {blockResult.data.blockhash || 'Demo blockhash'}</p>
          </div>
        ) : (
          <p>No data available</p>
        )}
      </div>

      {/* Account Example */}
      <div className="bg-white border rounded-lg p-4 mb-4">
        <h3 className="text-lg font-semibold mb-2">Account Cache Example</h3>
        <div className="flex items-center space-x-4 mb-2">
          <span className={`px-2 py-1 rounded text-sm ${accountResult.fromCache ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
            {accountResult.fromCache ? 'From Cache' : 'From API'}
          </span>
          <span className={`px-2 py-1 rounded text-sm ${accountResult.loading ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'}`}>
            {accountResult.loading ? 'Loading...' : 'Loaded'}
          </span>
        </div>
        {accountResult.error ? (
          <p className="text-red-600">Error: {accountResult.error.message}</p>
        ) : accountResult.data ? (
          <div className="text-sm">
            <p><strong>Address:</strong> {accountResult.data.address || '11111111111111111111111111111112'}</p>
            <p><strong>Lamports:</strong> {accountResult.data.lamports || 'Demo lamports'}</p>
          </div>
        ) : (
          <p>No data available</p>
        )}
      </div>

      {/* Cache Benefits */}
      <div className="bg-blue-50 p-4 rounded-lg">
        <h3 className="text-lg font-semibold mb-2">Cache Benefits</h3>
        <ul className="list-disc list-inside text-sm space-y-1">
          <li><strong>Performance:</strong> Sub-millisecond data retrieval from local DuckDB cache</li>
          <li><strong>Offline Support:</strong> Data available even when API is unavailable</li>
          <li><strong>Reduced API Load:</strong> Fewer requests to Solana RPC endpoints</li>
          <li><strong>Smart Eviction:</strong> LRU/LFU policies ensure most relevant data stays cached</li>
          <li><strong>Compression:</strong> Automatic compression for large data sets</li>
          <li><strong>Structured Storage:</strong> Dedicated tables for different blockchain data types</li>
        </ul>
      </div>
    </div>
  );
}

export default CacheDemo;