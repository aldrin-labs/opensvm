export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { sanitizeSearchQuery } from '@/lib/utils';

// Route segment config: Set timeout to 120 seconds
export const maxDuration = 120;


// Common Solana-related search suggestions
const COMMON_SUGGESTIONS = [
  'Solana mainnet status',
  'SOL price',
  'Solana validator performance',
  'Recent blocks',
  'Top tokens by market cap',
  'DeFi protocols on Solana',
  'NFT collections',
  'Solana network statistics',
  'Transaction fees',
  'Staking rewards',
];

// Address/signature prefixes for common known addresses
const KNOWN_ADDRESSES = [
  'So11111111111111111111111111111111111111112', // Wrapped SOL
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
  '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R', // Raydium
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // Bonk
];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query) {
      return NextResponse.json([]);
    }

    const sanitizedQuery = sanitizeSearchQuery(query);
    if (!sanitizedQuery) {
      return NextResponse.json([]);
    }

    const suggestions: string[] = [];
    const lowercaseQuery = sanitizedQuery.toLowerCase();

    // If query looks like it could be an address or signature, suggest known addresses
    if (sanitizedQuery.length >= 32 && /^[A-Za-z0-9]+$/.test(sanitizedQuery)) {
      // Find matching known addresses
      const matchingAddresses = KNOWN_ADDRESSES.filter(addr => 
        addr.toLowerCase().includes(lowercaseQuery)
      );
      suggestions.push(...matchingAddresses.slice(0, 3));
    }

    // Add common suggestions that match the query
    const matchingCommon = COMMON_SUGGESTIONS.filter(suggestion =>
      suggestion.toLowerCase().includes(lowercaseQuery)
    );
    suggestions.push(...matchingCommon.slice(0, 5));

    // If query could be a token symbol or name
    if (sanitizedQuery.length >= 2 && /^[A-Za-z]+$/.test(sanitizedQuery)) {
      const tokenSuggestions = [
        `${sanitizedQuery.toUpperCase()} token info`,
        `${sanitizedQuery.toUpperCase()} price`,
        `${sanitizedQuery.toUpperCase()} market data`,
        `${sanitizedQuery} trading pairs`,
      ];
      suggestions.push(...tokenSuggestions.slice(0, 2));
    }

    // If query looks like it could be a program name
    if (sanitizedQuery.length >= 3) {
      const programSuggestions = [
        `${sanitizedQuery} program`,
        `${sanitizedQuery} smart contract`,
        `${sanitizedQuery} DApp`,
      ];
      suggestions.push(...programSuggestions.slice(0, 1));
    }

    // Remove duplicates and limit to 10 suggestions
    const uniqueSuggestions = Array.from(new Set(suggestions)).slice(0, 10);

    // Return in OpenSearch suggestions format: [query, [suggestions], [descriptions], [urls]]
    return NextResponse.json([
      sanitizedQuery,
      uniqueSuggestions,
      new Array(uniqueSuggestions.length).fill(''), // No descriptions
      uniqueSuggestions.map(suggestion => `https://osvm.ai/search?q=${encodeURIComponent(suggestion)}`)
    ]);

  } catch (error) {
    console.error('Error in search suggestions API:', error);
    return NextResponse.json([]);
  }
}
