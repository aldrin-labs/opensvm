'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { PublicKey } from '@solana/web3.js';
import {
  Search,
  Filter,
  Download,
  RefreshCw,
  Eye,
  EyeOff,
  Copy,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Hash,
  Wallet,
  Calendar,
  Database,
  AlertCircle,
  CheckCircle,
  Settings
} from 'lucide-react';

interface ProgramAccount {
  address: string;
  data: string;
  executable: boolean;
  lamports: number;
  owner: string;
  rentEpoch: number;
  dataSize: number;
  decoded?: any;
}

interface PDADerivation {
  seeds: string[];
  programId: string;
  bump: number;
}

interface ProgramAccountSearchProps {
  programId: string;
}

export function ProgramAccountSearch({ programId }: ProgramAccountSearchProps) {
  const [accounts, setAccounts] = useState<ProgramAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchType, setSearchType] = useState<'all' | 'filtered' | 'pda'>('all');
  const [filters, setFilters] = useState({
    minBalance: '',
    maxBalance: '',
    dataSize: '',
    executable: 'all'
  });
  const [pdaSeeds, setPdaSeeds] = useState<string[]>(['']);
  const [derivedPDAs, setDerivedPDAs] = useState<{ address: string; bump: number; seeds: string[] }[]>([]);
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);

  const searchAccounts = useCallback(async () => {
    if (!programId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/program-accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          programId,
          searchType,
          filters,
          pdaSeeds: searchType === 'pda' ? pdaSeeds.filter(s => s.trim()) : undefined
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.accounts) {
        setAccounts(data.accounts);
      }
      
      if (data.derivedPDAs) {
        setDerivedPDAs(data.derivedPDAs);
      }
    } catch (err) {
      console.error('Error searching accounts:', err);
      setError(err instanceof Error ? err.message : 'Failed to search accounts');
    } finally {
      setLoading(false);
    }
  }, [programId, searchType, filters, pdaSeeds]);

  const addSeed = () => {
    setPdaSeeds([...pdaSeeds, '']);
  };

  const removeSeed = (index: number) => {
    setPdaSeeds(pdaSeeds.filter((_, i) => i !== index));
  };

  const updateSeed = (index: number, value: string) => {
    const newSeeds = [...pdaSeeds];
    newSeeds[index] = value;
    setPdaSeeds(newSeeds);
  };

  const toggleAccountExpanded = (address: string) => {
    const newExpanded = new Set(expandedAccounts);
    if (newExpanded.has(address)) {
      newExpanded.delete(address);
    } else {
      newExpanded.add(address);
    }
    setExpandedAccounts(newExpanded);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const formatSOL = (lamports: number) => {
    return (lamports / 1e9).toFixed(6);
  };

  const formatDataSize = (size: number) => {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  const exportAccounts = () => {
    const dataStr = JSON.stringify(accounts, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `program_accounts_${programId}_${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  // Auto-search on component mount
  useEffect(() => {
    if (programId && searchType === 'all') {
      searchAccounts();
    }
  }, [programId]);

  return (
    <div className="space-y-6">
      {/* Search Controls */}
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Account Search</h2>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center space-x-2 px-3 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
          >
            <Settings className="w-4 h-4" />
            <span>Filters</span>
            {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* Search Type Selection */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <button
            onClick={() => setSearchType('all')}
            className={`p-4 rounded-lg border-2 transition-colors ${
              searchType === 'all'
                ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                : 'border-gray-600 bg-gray-700 hover:bg-gray-600'
            }`}
          >
            <Database className="w-6 h-6 mx-auto mb-2" />
            <div className="font-medium">All Accounts</div>
            <div className="text-sm text-gray-400">Search all program accounts</div>
          </button>
          
          <button
            onClick={() => setSearchType('filtered')}
            className={`p-4 rounded-lg border-2 transition-colors ${
              searchType === 'filtered'
                ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                : 'border-gray-600 bg-gray-700 hover:bg-gray-600'
            }`}
          >
            <Filter className="w-6 h-6 mx-auto mb-2" />
            <div className="font-medium">Filtered Search</div>
            <div className="text-sm text-gray-400">Apply custom filters</div>
          </button>
          
          <button
            onClick={() => setSearchType('pda')}
            className={`p-4 rounded-lg border-2 transition-colors ${
              searchType === 'pda'
                ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                : 'border-gray-600 bg-gray-700 hover:bg-gray-600'
            }`}
          >
            <Hash className="w-6 h-6 mx-auto mb-2" />
            <div className="font-medium">PDA Derivation</div>
            <div className="text-sm text-gray-400">Derive Program Derived Addresses</div>
          </button>
        </div>

        {/* Filters Panel */}
        {showFilters && (searchType === 'filtered' || searchType === 'all') && (
          <div className="bg-gray-700 rounded-lg p-4 mb-4">
            <h3 className="font-medium mb-3">Search Filters</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Min Balance (SOL)</label>
                <input
                  type="number"
                  step="0.000001"
                  value={filters.minBalance}
                  onChange={(e) => setFilters({...filters, minBalance: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:border-blue-500 focus:outline-none"
                  placeholder="0.0"
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-1">Max Balance (SOL)</label>
                <input
                  type="number"
                  step="0.000001"
                  value={filters.maxBalance}
                  onChange={(e) => setFilters({...filters, maxBalance: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:border-blue-500 focus:outline-none"
                  placeholder="1000.0"
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-1">Data Size (bytes)</label>
                <input
                  type="number"
                  value={filters.dataSize}
                  onChange={(e) => setFilters({...filters, dataSize: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:border-blue-500 focus:outline-none"
                  placeholder="Any size"
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-1">Executable</label>
                <select
                  value={filters.executable}
                  onChange={(e) => setFilters({...filters, executable: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:border-blue-500 focus:outline-none"
                >
                  <option value="all">All</option>
                  <option value="true">Executable only</option>
                  <option value="false">Non-executable only</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* PDA Seeds Input */}
        {searchType === 'pda' && (
          <div className="bg-gray-700 rounded-lg p-4 mb-4">
            <h3 className="font-medium mb-3">PDA Seeds</h3>
            <p className="text-sm text-gray-400 mb-4">
              Enter the seeds used to derive Program Derived Addresses. Each seed can be text or hex (prefix with 0x).
            </p>
            
            {pdaSeeds.map((seed, index) => (
              <div key={index} className="flex items-center space-x-2 mb-2">
                <input
                  type="text"
                  value={seed}
                  onChange={(e) => updateSeed(index, e.target.value)}
                  className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:border-blue-500 focus:outline-none"
                  placeholder={`Seed ${index + 1} (text or 0x...)`}
                />
                {pdaSeeds.length > 1 && (
                  <button
                    onClick={() => removeSeed(index)}
                    className="px-3 py-2 text-red-400 hover:text-red-300 transition-colors"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
            
            <button
              onClick={addSeed}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Add Seed
            </button>
          </div>
        )}

        {/* Search Button */}
        <div className="flex items-center justify-between">
          <button
            onClick={searchAccounts}
            disabled={loading}
            className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <Search className="w-5 h-5" />
            )}
            <span>{loading ? 'Searching...' : 'Search Accounts'}</span>
          </button>

          {accounts.length > 0 && (
            <button
              onClick={exportAccounts}
              className="flex items-center space-x-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Export ({accounts.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-900/20 border border-red-500 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <span className="text-red-400 font-medium">Error</span>
          </div>
          <p className="text-red-300 mt-1">{error}</p>
        </div>
      )}

      {/* Derived PDAs */}
      {searchType === 'pda' && derivedPDAs.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Derived PDAs</h3>
          <div className="space-y-3">
            {derivedPDAs.map((pda, index) => (
              <div key={index} className="bg-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <Hash className="w-4 h-4 text-blue-400" />
                    <span className="font-mono text-sm">{pda.address}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-400">Bump: {pda.bump}</span>
                    <button
                      onClick={() => copyToClipboard(pda.address)}
                      className="text-gray-400 hover:text-white transition-colors"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <a
                      href={`https://explorer.solana.com/address/${pda.address}?cluster=devnet`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-white transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>
                <div className="text-sm text-gray-400">
                  Seeds: {pda.seeds.map(seed => `"${seed}"`).join(', ')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {accounts.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Found Accounts ({accounts.length})</h3>
            <div className="text-sm text-gray-400">
              Total Balance: {formatSOL(accounts.reduce((sum, acc) => sum + acc.lamports, 0))} SOL
            </div>
          </div>

          <div className="space-y-3">
            {accounts.map((account) => (
              <div key={account.address} className="border border-gray-700 rounded-lg overflow-hidden">
                <div 
                  className="p-4 cursor-pointer hover:bg-gray-700 transition-colors"
                  onClick={() => toggleAccountExpanded(account.address)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Wallet className="w-5 h-5 text-blue-400" />
                      <div>
                        <div className="font-mono text-sm">{account.address}</div>
                        <div className="text-xs text-gray-400">
                          {formatSOL(account.lamports)} SOL • {formatDataSize(account.dataSize)}
                          {account.executable && <span className="ml-2 px-2 py-1 bg-green-900 text-green-300 rounded text-xs">Executable</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(account.address);
                        }}
                        className="text-gray-400 hover:text-white transition-colors"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <a
                        href={`https://explorer.solana.com/address/${account.address}?cluster=devnet`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-gray-400 hover:text-white transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                      {expandedAccounts.has(account.address) ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </div>
                  </div>
                </div>

                {expandedAccounts.has(account.address) && (
                  <div className="px-4 pb-4 bg-gray-900">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                      <div>
                        <div className="text-xs text-gray-400">Balance</div>
                        <div className="font-mono">{formatSOL(account.lamports)} SOL</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400">Data Size</div>
                        <div className="font-mono">{formatDataSize(account.dataSize)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400">Rent Epoch</div>
                        <div className="font-mono">{account.rentEpoch}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400">Executable</div>
                        <div className="flex items-center space-x-1">
                          {account.executable ? (
                            <CheckCircle className="w-4 h-4 text-green-400" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-gray-400" />
                          )}
                          <span>{account.executable ? 'Yes' : 'No'}</span>
                        </div>
                      </div>
                    </div>

                    {account.data && account.data !== '11111111111111111111111111111111' && (
                      <div>
                        <div className="text-xs text-gray-400 mb-2">Account Data (Base58)</div>
                        <div className="bg-gray-800 p-3 rounded font-mono text-xs break-all">
                          {account.data.length > 200 ? (
                            <>
                              {account.data.substring(0, 200)}...
                              <span className="text-gray-500 ml-2">({account.data.length} chars total)</span>
                            </>
                          ) : (
                            account.data
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && !error && accounts.length === 0 && searchType !== 'pda' && (
        <div className="text-center py-12">
          <Database className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-400 mb-2">No accounts found</h3>
          <p className="text-gray-500">
            {searchType === 'all' 
              ? 'This program has no associated accounts'
              : 'No accounts match your search criteria'
            }
          </p>
        </div>
      )}
    </div>
  );
}
