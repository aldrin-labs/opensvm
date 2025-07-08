/**
 * Global search interface component
 * 
 * Provides multi-type search functionality for Solana blockchain data including
 * transactions, accounts, blocks, and programs. Implements intelligent query
 * detection and routing to appropriate detail pages.
 * 
 * @see docs/architecture/components.md#ui-components
 * @see docs/architecture/system-overview.md#user-interface-layer
 * @see docs/architecture/data-flow.md#user-request-flow
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { isValidTransactionSignature, isValidSolanaAddress } from '@/lib/utils';

/**
 * SearchBar component provides global search functionality
 * 
 * Features:
 * - Multi-type query detection (transactions, accounts, blocks, programs)
 * - Intelligent routing based on query format
 * - Loading state management
 * - Input validation and error handling
 * 
 * Supported query types:
 * - Transaction signatures (88 characters, Base58)
 * - Account addresses (32-44 characters, Base58)
 * - Block numbers (numeric)
 * - Program addresses (valid Solana addresses)
 */
export default function SearchBar() {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedQuery = query.trim();
    if (!trimmedQuery || isLoading) { return; }
    
    try {
      setIsLoading(true);
      
      // Check if query is a block number
      if (/^\d+$/.test(trimmedQuery)) {
        console.log('Redirecting to block page:', trimmedQuery);
        router.push(`/block/${trimmedQuery}`);
        return;
      }
      
      // Check if query is a transaction signature (88 chars)
      if (isValidTransactionSignature(trimmedQuery)) {
        console.log('Redirecting to transaction page:', trimmedQuery);
        window.location.href = `/tx/${trimmedQuery}`;
        return;
      }
      
      // Check if query is a valid Solana address
      if (isValidSolanaAddress(trimmedQuery)) {
        // Check account type using API
        const response = await fetch(`/api/check-account-type?address=${encodeURIComponent(trimmedQuery)}`);
        const data = await response.json();
        
      switch (data.type) {
        case 'token':
          console.log('Redirecting to token page:', query);
          window.location.href = `/token/${query.trim()}`;
          break;
        case 'program':
          console.log('Redirecting to program page:', query);
          window.location.href = `/program/${query.trim()}`;
          break;
        case 'account':
          console.log('Redirecting to account page:', query);
          window.location.href = `/account/${query.trim()}`;
          break;
        default:
          window.location.href = `/search?q=${encodeURIComponent(query.trim())}`;
      }
      } else {
        // If no specific match, use the search page
        router.push(`/search?q=${encodeURIComponent(trimmedQuery)}`);
      }
    } catch (error) {
      console.error('Error processing search:', error);
      // On error, use the search page
      router.push(`/search?q=${encodeURIComponent(trimmedQuery)}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="relative flex w-full">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by address, transaction, block or token"
        className="w-full rounded-l-lg border border-r-0 border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 focus:border-[#00ffbd] focus:outline-none focus:ring-1 focus:ring-[#00ffbd]"
      />
      <button
        type="submit"
        disabled={isLoading}
        className={`rounded-r-lg bg-[#00ffbd] px-6 py-3 text-sm font-medium text-black hover:bg-[#00e6aa] flex items-center justify-center ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {isLoading ? 'Searching...' : 'Search'}
      </button>
    </form>
  );
}
