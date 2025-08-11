import { Connection, PublicKey } from '@solana/web3.js';
import { getMint } from '@solana/spl-token';// Token Metadata Program ID (Metaplex)
const TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

// Well-known tokens for immediate access and fallback
const WELL_KNOWN_TOKENS: { [key: string]: TokenInfo } = {
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': {
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
    verified: true
  },
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': {
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.png',
    verified: true
  },
  'So11111111111111111111111111111111111111112': {
    symbol: 'WSOL',
    name: 'Wrapped SOL',
    decimals: 9,
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
    verified: true
  },
  'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': {
    symbol: 'mSOL',
    name: 'Marinade staked SOL',
    decimals: 9,
    verified: true
  }
};

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

// In-memory cache for token metadata
const tokenCache = new Map<string, TokenInfo>();
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
const cacheTimestamps = new Map<string, number>();

/**
 * Get token information with caching (checks well-known tokens first, then Qdrant cache, then fetches metadata)
 */
export async function getTokenInfo(connection: Connection, mintAddress: string): Promise<TokenInfo | null> {
  // Check well-known tokens first (fastest)
  const knownToken = WELL_KNOWN_TOKENS[mintAddress];
  if (knownToken) {
    return knownToken;
  }

  // Check in-memory cache first
  const cached = tokenCache.get(mintAddress);
  const cachedTime = cacheTimestamps.get(mintAddress);

  if (cached && cachedTime && (Date.now() - cachedTime) < CACHE_DURATION) {
    return cached;
  }

  // Fetch from on-chain metadata
  const metadata = await fetchNativeTokenMetadata(connection, mintAddress);

  if (metadata) {
    // Cache the result in memory
    tokenCache.set(mintAddress, metadata);
    cacheTimestamps.set(mintAddress, Date.now());

    // Use server-only Qdrant caching if on server
    if (typeof window === 'undefined') {
      try {
        const { getTokenInfoWithQdrantCache } = await import('./token-metadata-cache');
        // This will cache in Qdrant asynchronously
        getTokenInfoWithQdrantCache(mintAddress, metadata).catch((error: any) => {
          console.warn('Failed to update Qdrant cache:', error);
        });
      } catch (error) {
        console.warn('Error importing server-only token cache:', error);
      }
    }
  }

  return metadata;
}/**
 * Batch fetch token metadata for multiple tokens (more efficient with Qdrant caching)
 */
export async function batchFetchTokenMetadata(connection: Connection, mintAddresses: string[]): Promise<Map<string, TokenInfo>> {
  const results = new Map<string, TokenInfo>();

  // First, check well-known tokens
  const remainingMints: string[] = [];
  for (const mintAddress of mintAddresses) {
    const knownToken = WELL_KNOWN_TOKENS[mintAddress];
    if (knownToken) {
      results.set(mintAddress, knownToken);
    } else {
      remainingMints.push(mintAddress);
    }
  }

  if (remainingMints.length === 0) {
    return results;
  }

  // Check Qdrant cache for remaining tokens (server-side only)
  let uncachedMints = remainingMints;
  if (typeof window === 'undefined') {
    try {
      const qdrantCached = await batchGetCachedTokenMetadata(remainingMints);
      uncachedMints = [];

      for (const mintAddress of remainingMints) {
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
      uncachedMints = remainingMints; // Fall back to fetching all
    }
  }

  if (uncachedMints.length === 0) {
    return results;
  }

  // Process remaining uncached tokens in batches to avoid RPC limits
  const batchSize = 10;
  for (let i = 0; i < uncachedMints.length; i += batchSize) {
    const batch = uncachedMints.slice(i, i + batchSize);

    const promises = batch.map(async (mintAddress) => {
      const info = await getTokenInfo(connection, mintAddress);
      if (info) {
        results.set(mintAddress, info);
      }
    });

    await Promise.all(promises);
  }

  return results;
}