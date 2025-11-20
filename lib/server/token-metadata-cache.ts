/**
 * Server-side token metadata caching with Qdrant
 * This module should NEVER be imported on the client side
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { getMint } from '@solana/spl-token';
import {
    storeTokenMetadata,
    getCachedTokenMetadata,
    batchGetCachedTokenMetadata,
    type TokenMetadataEntry
} from '@/lib/search/qdrant';

export interface TokenInfo {
    symbol: string;
    name: string;
    decimals: number;
    logoURI?: string;
    verified?: boolean;
}

interface TokenMetadata {
    name: string;
    symbol: string;
    uri?: string;
}

// Cache duration for token metadata
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

// Token Metadata Program ID (Metaplex)
const TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

/**
 * Get the metadata account address for a token mint
 */
function getMetadataAddress(mint: PublicKey): PublicKey {
    const [metadataAddress] = PublicKey.findProgramAddressSync(
        [
            Buffer.from('metadata'),
            TOKEN_METADATA_PROGRAM_ID.toBuffer(),
            mint.toBuffer(),
        ],
        TOKEN_METADATA_PROGRAM_ID
    );
    return metadataAddress;
}

/**
 * Parse token metadata from account data (Metaplex Token Metadata format)
 */
function parseTokenMetadata(data: Buffer): TokenMetadata | null {
    try {
        // Skip the first byte (discriminator)
        let offset = 1;

        // Skip update authority (32 bytes)
        offset += 32;

        // Skip mint (32 bytes)
        offset += 32;

        // Read name length and name
        const nameLength = data.readUInt32LE(offset);
        offset += 4;
        const name = data.slice(offset, offset + nameLength).toString('utf8').replace(/\0/g, '').trim();
        offset += nameLength;

        // Read symbol length and symbol
        const symbolLength = data.readUInt32LE(offset);
        offset += 4;
        const symbol = data.slice(offset, offset + symbolLength).toString('utf8').replace(/\0/g, '').trim();
        offset += symbolLength;

        // Read URI length and URI
        const uriLength = data.readUInt32LE(offset);
        offset += 4;
        const uri = data.slice(offset, offset + uriLength).toString('utf8').replace(/\0/g, '').trim();

        return {
            name: name || 'Unknown Token',
            symbol: symbol || 'UNK',
            uri: uri || undefined
        };
    } catch (error) {
        console.warn('Failed to parse token metadata:', error);
        return null;
    }
}

/**
 * Fetch token metadata natively from on-chain SPL Token metadata
 */
async function fetchNativeTokenMetadata(connection: Connection, mintAddress: string): Promise<TokenInfo | null> {
    try {
        const mint = new PublicKey(mintAddress);

        // Get mint info for decimals
        const mintInfo = await getMint(connection, mint);

        // Try to get metadata account
        const metadataAddress = getMetadataAddress(mint);

        try {
            const metadataAccount = await connection.getAccountInfo(metadataAddress);

            if (metadataAccount && metadataAccount.data) {
                const metadata = parseTokenMetadata(metadataAccount.data);

                if (metadata) {
                    return {
                        symbol: metadata.symbol,
                        name: metadata.name,
                        decimals: mintInfo.decimals,
                        logoURI: metadata.uri,
                        verified: false // On-chain metadata doesn't have verification status
                    };
                }
            }
        } catch (metadataError) {
            console.warn(`No metadata found for token ${mintAddress}:`, metadataError);
        }

        // Fallback to mint info only
        return {
            symbol: `${mintAddress.slice(0, 4)}...${mintAddress.slice(-4)}`,
            name: 'Unknown Token',
            decimals: mintInfo.decimals,
            verified: false
        };

    } catch (error) {
        console.error(`Failed to fetch token info for ${mintAddress}:`, error);
        return null;
    }
}

/**
 * Server-side token metadata retrieval with Qdrant caching
 */
export async function getTokenInfoServer(connection: Connection, mintAddress: string): Promise<TokenInfo | null> {
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

    // Fetch from on-chain metadata
    const metadata = await fetchNativeTokenMetadata(connection, mintAddress);

    if (metadata) {
        // Cache in Qdrant asynchronously (don't block the response)
        const now = Date.now();
        const qdrantEntry: TokenMetadataEntry = {
            id: mintAddress,
            mintAddress,
            symbol: metadata.symbol,
            name: metadata.name,
            decimals: metadata.decimals,
            logoURI: metadata.logoURI,
            verified: metadata.verified || false,
            metadataUri: metadata.logoURI,
            cached: true,
            lastUpdated: now,
            cacheExpiry: now + CACHE_DURATION
        };

        // Store asynchronously without blocking
        storeTokenMetadata(qdrantEntry).catch(error => {
            console.warn('Failed to cache token metadata in Qdrant:', error);
        });
    }

    return metadata;
}

/**
 * Server-side batch token metadata retrieval with Qdrant caching
 */
export async function batchGetTokenInfoServer(connection: Connection, mintAddresses: string[]): Promise<Map<string, TokenInfo>> {
    const results = new Map<string, TokenInfo>();

    if (mintAddresses.length === 0) {
        return results;
    }

    // Check Qdrant cache for all tokens
    let uncachedMints = mintAddresses;
    try {
        const qdrantCached = await batchGetCachedTokenMetadata(mintAddresses);
        uncachedMints = [];

        for (const mintAddress of mintAddresses) {
            const cachedMetadata = qdrantCached.get(mintAddress);
            if (cachedMetadata) {
                results.set(mintAddress, {
                    symbol: cachedMetadata.symbol,
                    name: cachedMetadata.name,
                    decimals: cachedMetadata.decimals,
                    logoURI: cachedMetadata.logoURI,
                    verified: cachedMetadata.verified
                });
            } else {
                uncachedMints.push(mintAddress);
            }
        }
    } catch (error) {
        console.warn('Error batch fetching from Qdrant cache:', error);
        uncachedMints = mintAddresses; // Fall back to fetching all
    }

    if (uncachedMints.length === 0) {
        return results;
    }

    // Process remaining uncached tokens in batches to avoid RPC limits
    const batchSize = 10;
    for (let i = 0; i < uncachedMints.length; i += batchSize) {
        const batch = uncachedMints.slice(i, i + batchSize);

        const promises = batch.map(async (mintAddress) => {
            const info = await getTokenInfoServer(connection, mintAddress);
            if (info) {
                results.set(mintAddress, info);
            }
        });

        await Promise.all(promises);
    }

    return results;
}
