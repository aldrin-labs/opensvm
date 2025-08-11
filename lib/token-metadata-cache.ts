/**
 * Server-only token metadata caching using Qdrant
 * This file should never be imported on the client side
 */

import {
    storeTokenMetadata,
    getCachedTokenMetadata,
    batchGetCachedTokenMetadata,
    type TokenMetadataEntry
} from '@/lib/qdrant';
import type { TokenInfo } from './token-registry';

const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

/**
 * Server-only function to get token info with Qdrant caching
 */
export async function getTokenInfoWithQdrantCache(
    mintAddress: string,
    fallbackTokenInfo: TokenInfo | null
): Promise<TokenInfo | null> {
    // Only run on server
    if (typeof window !== 'undefined') {
        throw new Error('getTokenInfoWithQdrantCache should not be called on client side');
    }

    try {
        // Check Qdrant cache first
        const cachedMetadata = await getCachedTokenMetadata(mintAddress);
        if (cachedMetadata) {
            return {
                symbol: cachedMetadata.symbol,
                name: cachedMetadata.name,
                decimals: cachedMetadata.decimals,
                logoURI: cachedMetadata.logoURI,
                verified: cachedMetadata.verified
            };
        }
    } catch (error) {
        console.warn('Error fetching from Qdrant cache:', error);
    }

    // If we have fallback token info, cache it in Qdrant
    if (fallbackTokenInfo) {
        try {
            const now = Date.now();
            const qdrantEntry: TokenMetadataEntry = {
                id: mintAddress,
                mintAddress,
                symbol: fallbackTokenInfo.symbol,
                name: fallbackTokenInfo.name,
                decimals: fallbackTokenInfo.decimals,
                logoURI: fallbackTokenInfo.logoURI,
                verified: fallbackTokenInfo.verified || false,
                metadataUri: fallbackTokenInfo.logoURI,
                cached: true,
                lastUpdated: now,
                cacheExpiry: now + CACHE_DURATION
            };

            // Store asynchronously without blocking
            storeTokenMetadata(qdrantEntry).catch(error => {
                console.warn('Failed to cache token metadata in Qdrant:', error);
            });
        } catch (error) {
            console.warn('Error preparing Qdrant cache entry:', error);
        }
    }

    return fallbackTokenInfo;
}

/**
 * Server-only batch token metadata fetching with Qdrant
 */
export async function batchGetTokenInfoWithQdrantCache(
    mintAddresses: string[]
): Promise<Map<string, TokenInfo>> {
    // Only run on server
    if (typeof window !== 'undefined') {
        throw new Error('batchGetTokenInfoWithQdrantCache should not be called on client side');
    }

    const results = new Map<string, TokenInfo>();

    try {
        const qdrantCached = await batchGetCachedTokenMetadata(mintAddresses);

        for (const [mintAddress, cachedMetadata] of qdrantCached) {
            results.set(mintAddress, {
                symbol: cachedMetadata.symbol,
                name: cachedMetadata.name,
                decimals: cachedMetadata.decimals,
                logoURI: cachedMetadata.logoURI,
                verified: cachedMetadata.verified
            });
        }
    } catch (error) {
        console.warn('Error batch fetching from Qdrant cache:', error);
    }

    return results;
}
