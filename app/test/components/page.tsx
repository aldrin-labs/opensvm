'use client';

import AccountExplorerLinks from '@/components/AccountExplorerLinks';
import AccountOverview from '@/components/AccountOverview';
import { useState, useMemo } from 'react';
import { Search, X } from 'lucide-react';

// Mock token accounts for testing
const mockTokenAccounts = [
  {
    mint: 'So11111111111111111111111111111111111111112',
    symbol: 'WSOL',
    uiAmount: 10.5,
    account: '4VvJHWPXf8bxQmM5vLNHUDzjfCrpCPiPCaVFQmrMjJdH'
  },
  {
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    symbol: 'USDC',
    uiAmount: 1250.75,
    account: '7KqpRwzkkeweW5GT1CiRBGKdRhPKJYm2e7DjT9L5dTwz'
  },
  {
    mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    symbol: 'USDT',
    uiAmount: 500.25,
    account: 'BkV8hmX2cGBbYwyR7NtFkgWc1e4bGmCjqH7JfDfwFKyq'
  }
];

// Mock transfers data for search demo
const mockTransfers = [
  {
    signature: 'abcd1234567890efgh1234567890ijkl1234567890mnop',
    timestamp: '2024-01-15T10:30:00Z',
    type: 'transfer',
    amount: 5.5,
    tokenSymbol: 'SOL',
    from: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
    to: '7KqpRwzkkeweW5GT1CiRBGKdRhPKJYm2e7DjT9L5dTwz'
  },
  {
    signature: 'xyz9876543210abc9876543210def9876543210ghi987',
    timestamp: '2024-01-15T09:15:00Z',
    type: 'transfer',
    amount: 1000,
    tokenSymbol: 'USDC',
    from: '7KqpRwzkkeweW5GT1CiRBGKdRhPKJYm2e7DjT9L5dTwz',
    to: 'BkV8hmX2cGBbYwyR7NtFkgWc1e4bGmCjqH7JfDfwFKyq'
  },
  {
    signature: 'pqr5555666677778888999900001111222233334444',
    timestamp: '2024-01-14T16:45:00Z',
    type: 'swap',
    amount: 2.1,
    tokenSymbol: 'WSOL',
    from: 'BkV8hmX2cGBbYwyR7NtFkgWc1e4bGmCjqH7JfDfwFKyq',
    to: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM'
  }
];

function MockTransfersTable() {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredTransfers = useMemo(() => {
    if (!searchTerm.trim()) return mockTransfers;
    
    const lowerSearchTerm = searchTerm.toLowerCase();
    return mockTransfers.filter(transfer => 
      transfer.from?.toLowerCase().includes(lowerSearchTerm) ||
      transfer.to?.toLowerCase().includes(lowerSearchTerm) ||
      transfer.tokenSymbol?.toLowerCase().includes(lowerSearchTerm) ||
      transfer.signature?.toLowerCase().includes(lowerSearchTerm)
    );
  }, [searchTerm]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-white">
          Transfers ({mockTransfers.length})
        </h2>
      </div>

      {/* Search Input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
          <Search className="h-4 w-4 text-gray-400" />
        </div>
        <input
          type="text"
          placeholder="Search transfers by address, token symbol, or signature..."
          className="w-full pl-10 pr-10 py-2 border border-gray-600 rounded-lg bg-gray-800 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-300"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Search Results Count */}
      {searchTerm && (
        <div className="text-sm text-gray-400">
          Found {filteredTransfers.length} transfers matching "{searchTerm}"
        </div>
      )}

      {/* Mock transfers table */}
      <div className="bg-gray-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-700">
            <tr>
              <th className="px-4 py-3 text-left text-gray-300">Time</th>
              <th className="px-4 py-3 text-left text-gray-300">Type</th>
              <th className="px-4 py-3 text-right text-gray-300">Amount</th>
              <th className="px-4 py-3 text-left text-gray-300">Token</th>
              <th className="px-4 py-3 text-left text-gray-300">From</th>
              <th className="px-4 py-3 text-left text-gray-300">To</th>
              <th className="px-4 py-3 text-left text-gray-300">Signature</th>
            </tr>
          </thead>
          <tbody>
            {filteredTransfers.map((transfer, index) => (
              <tr key={transfer.signature} className="border-t border-gray-600 hover:bg-gray-700">
                <td className="px-4 py-3 text-gray-300">
                  {new Date(transfer.timestamp).toLocaleDateString()} {new Date(transfer.timestamp).toLocaleTimeString()}
                </td>
                <td className="px-4 py-3 text-gray-300 capitalize">{transfer.type}</td>
                <td className="px-4 py-3 text-right text-gray-300 font-mono">{transfer.amount}</td>
                <td className="px-4 py-3 text-gray-300">{transfer.tokenSymbol}</td>
                <td className="px-4 py-3 text-blue-400 font-mono text-xs">
                  {transfer.from?.slice(0, 8)}...{transfer.from?.slice(-4)}
                </td>
                <td className="px-4 py-3 text-blue-400 font-mono text-xs">
                  {transfer.to?.slice(0, 8)}...{transfer.to?.slice(-4)}
                </td>
                <td className="px-4 py-3 text-blue-400 font-mono text-xs">
                  {transfer.signature?.slice(0, 8)}...{transfer.signature?.slice(-4)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredTransfers.length === 0 && searchTerm && (
          <div className="text-center py-8 text-gray-400">
            No transfers found matching "{searchTerm}"
          </div>
        )}
      </div>
    </div>
  );
}

const testAddress = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM';

export default function ComponentsTestPage() {
  return (
    <div className="min-h-screen bg-black p-4">
      <div className="container mx-auto space-y-8">
        <h1 className="text-3xl font-bold text-white mb-8">
          OpenSVM Components Test Page
        </h1>
        
        {/* Account Explorer Links Test */}
        <div className="bg-neutral-900 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Account Explorer Links</h2>
          <AccountExplorerLinks address={testAddress} />
        </div>

        {/* Account Overview with Pie Chart Test */}
        <div className="bg-neutral-900 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Account Overview with Portfolio Pie Chart</h2>
          <AccountOverview
            address={testAddress}
            solBalance={25.5}
            tokenAccounts={mockTokenAccounts}
            isSystemProgram={false}
            parsedOwner="11111111111111111111111111111111"
          />
        </div>

        {/* Transfers Table with Search Test */}
        <div className="bg-neutral-900 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Transfers Table with Search (Mock Data)</h2>
          <p className="text-gray-400 mb-4">
            This demonstrates the search functionality with mock transfer data. Try searching for "SOL", "USDC", or parts of addresses.
          </p>
          <MockTransfersTable />
        </div>
      </div>
    </div>
  );
}