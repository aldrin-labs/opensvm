'use client';

import React, { useState, useEffect } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import type { Commitment, AccountInfo } from '@solana/web3.js';
import DisassemblyView from './components/disassembly-view';

// Use reliable RPC endpoints with fallback
const RPC_ENDPOINTS = [
  'https://api.mainnet-beta.solana.com',
  'https://solana-api.projectserum.com',
  'https://rpc.ankr.com/solana'
] as const;

type RpcEndpoint = (typeof RPC_ENDPOINTS)[number];

let currentEndpointIndex = 0;

// Ensure currentEndpointIndex stays within bounds and always returns a valid endpoint
const getCurrentEndpoint = (): RpcEndpoint => {
  // Ensure index wraps around
  const index = currentEndpointIndex % RPC_ENDPOINTS.length;
  // Return the current endpoint (type is guaranteed to be RpcEndpoint due to modulo)
  return RPC_ENDPOINTS[index]!;
};

const COMMITMENT: Commitment = 'processed';

// BPF Upgradeable Loader program ID
const BPF_LOADER_UPGRADEABLE = new PublicKey('BPFLoaderUpgradeab1e11111111111111111111111');

interface ProgramInfo {
  address: string;
  owner: string;
  dataSize: number;
  isUpgradeable: boolean;
  programDataAddress?: string;
  data: number[];
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

interface GetProgramDataOptions {
  retries?: number;
  signal?: AbortSignal;
}

async function getProgramData(
  address: string, 
  options: GetProgramDataOptions = { retries: 5 }
): Promise<ProgramInfo> {
  const { retries = 5, signal } = options;
  try {
    const endpoint = getCurrentEndpoint();
    console.log(`Trying endpoint ${currentEndpointIndex + 1}/${RPC_ENDPOINTS.length}: ${endpoint}`);
    
    const connection = new Connection(endpoint, {
      commitment: COMMITMENT,
      confirmTransactionInitialTimeout: 30000,
    });
    
    const programId = new PublicKey(address);
    const programInfo = await Promise.race([
      connection.getAccountInfo(programId),
      new Promise<AccountInfo<Buffer> | null>((_, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timeout')), 10000);
        signal?.addEventListener('abort', () => {
          clearTimeout(timeout);
          reject(new Error('Request aborted'));
        });
      })
    ]);
    
    if (!programInfo) {
      throw new Error('Program not found');
    }

    // Check if this is an upgradeable program
    if (programInfo.owner.equals(BPF_LOADER_UPGRADEABLE)) {
      // The first 4 bytes are a version prefix, next 32 bytes are the programdata address
      const programDataAddress = new PublicKey(programInfo.data.slice(4, 36));
      
      // Get the programdata account which contains the actual program data
      const programDataInfo = await Promise.race([
        connection.getAccountInfo(programDataAddress),
        new Promise<AccountInfo<Buffer> | null>((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 10000)
        )
      ]);
      
      if (!programDataInfo) {
        throw new Error('Program data account not found');
      }

      // The program data starts after the metadata (8 bytes slot, 32 bytes authority)
      const dataStart = 8 + 32;

      return {
        address,
        owner: programInfo.owner.toBase58(),
        dataSize: programDataInfo.data.length - dataStart,
        isUpgradeable: true,
        programDataAddress: programDataAddress.toBase58(),
        data: [...programDataInfo.data.slice(dataStart)]
      };
    } else {
      return {
        address,
        owner: programInfo.owner.toBase58(),
        dataSize: programInfo.data.length,
        isUpgradeable: false,
        data: [...programInfo.data]
      };
    }
  } catch (error) {
    console.error(`Error with endpoint ${currentEndpointIndex + 1}/${RPC_ENDPOINTS.length}:`, error);
    
    if (retries > 0 && !signal?.aborted) {
      // Try next endpoint
      currentEndpointIndex = (currentEndpointIndex + 1) % RPC_ENDPOINTS.length;
      
      // Exponential backoff with jitter
      const delay = Math.min(1000 * Math.pow(2, 5 - retries) + Math.random() * 1000, 10000);
      console.log(`Retrying with endpoint ${currentEndpointIndex + 1}/${RPC_ENDPOINTS.length} in ${delay}ms... (${retries} retries left)`);
      await sleep(delay);
      return getProgramData(address, { ...options, retries: retries - 1 });
    }
    throw error;
  }
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="space-y-4 text-center">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <div className="text-gray-400">Loading program data...</div>
        <div className="text-sm text-gray-500">Using endpoint {currentEndpointIndex + 1} of {RPC_ENDPOINTS.length}</div>
      </div>
    </div>
  );
}

interface Props {
  address: string;
}

export default function ProgramContentClient({ address }: Props) {
  const [programInfo, setProgramInfo] = useState<ProgramInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'disassembly'>('disassembly');

  useEffect(() => {
    let isMounted = true;
    let retryTimeout: NodeJS.Timeout | null = null;
    let abortController = new AbortController();

    const loadData = async () => {
      try {
        const info = await getProgramData(address, { signal: abortController.signal });
        if (isMounted) {
          setProgramInfo(info);
          setError(null);
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          console.error('Failed to load program:', err);
          setError(err instanceof Error ? err.message : 'Failed to load program data');
          setProgramInfo(null);
          setLoading(false);
          
          if (!abortController.signal.aborted) {
            // Auto-retry after 5 seconds
            retryTimeout = setTimeout(() => {
              if (isMounted) {
                console.log('Auto-retrying...');
                loadData();
              }
            }, 5000);
          }
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
      abortController.abort();
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
    };
  }, [address]);

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-lg">
        <div className="flex items-center space-x-2">
          <svg 
            className="w-5 h-5 text-red-400" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
            />
          </svg>
          <div className="font-medium text-red-400">Error loading program</div>
        </div>
        <div className="mt-2 text-sm text-red-400/90">{error}</div>
        <div className="mt-3 text-sm text-red-400/75">
          {error.includes('timeout') ? (
            'The request timed out. Please check your network connection.'
          ) : (
            'Retrying automatically...'
          )}
        </div>
      </div>
    );
  }

  if (!programInfo) {
    return null;
  }

  return (
    <div className="space-y-8 max-w-[1920px] mx-auto px-4 pb-8">
      {/* Program Info */}
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <h1 className="text-2xl font-bold">Program Details</h1>
          <div className="px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm">
            {programInfo.isUpgradeable ? 'Upgradeable' : 'Non-upgradeable'}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-gray-400">Program Address</label>
              <div className="p-3 bg-white/5 rounded-lg font-mono text-sm break-all">
                {programInfo.address}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-gray-400">Owner</label>
              <div className="p-3 bg-white/5 rounded-lg font-mono text-sm break-all">
                {programInfo.owner}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-gray-400">Program Size</label>
              <div className="p-3 bg-white/5 rounded-lg font-mono text-sm">
                {formatSize(programInfo.dataSize)}
              </div>
            </div>

            {programInfo.programDataAddress && (
              <div className="space-y-2">
                <label className="text-sm text-gray-400">Program Data Address</label>
                <div className="p-3 bg-white/5 rounded-lg font-mono text-sm break-all">
                  {programInfo.programDataAddress}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* View Selection */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setActiveView('disassembly')}
              className="px-4 py-2 rounded-lg font-medium bg-blue-500 text-white"
            >
              Disassembly
            </button>
          </div>
        </div>
      </div>

      {activeView === 'disassembly' && (
        <div className="bg-black border border-white/10 rounded-lg overflow-hidden h-[calc(100vh-24rem)]">
          <div className="p-4 border-b border-white/10">
            <div className="text-sm text-gray-400">
              Disassembly View
            </div>
          </div>
          <div className="h-[calc(100%-3rem)] overflow-auto">
            <DisassemblyView data={programInfo?.data || []} address={address} />
          </div>
        </div>
      )}
    </div>
  );
}
