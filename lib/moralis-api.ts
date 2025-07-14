// Moralis API integration for Solana blockchain data
import axios from 'axios';

// Moralis API configuration
const MORALIS_API_KEY = process.env.MORALIS_API_KEY;

if (!MORALIS_API_KEY) {
  throw new Error('MORALIS_API_KEY environment variable is required');
}
const MORALIS_BASE_URL = 'https://solana-gateway.moralis.io';

// Network type for Solana
type SolanaNetwork = 'mainnet' | 'devnet';

// Default network to use
const DEFAULT_NETWORK: SolanaNetwork = 'mainnet';

// Cache for API responses to improve performance
const apiCache: Record<string, { data: any; timestamp: number }> = {};
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

// Interface for pagination parameters
interface PaginationParams {
  limit?: number;
  cursor?: string;
}

// Interface for NFT search parameters
interface NFTSearchParams extends PaginationParams {
  nftMetadata?: boolean;
}

// Interface for transaction search parameters
interface TransactionSearchParams extends PaginationParams {
  fromDate?: string;
  toDate?: string;
}

/**
 * Make a cached API request to Moralis
 * @param endpoint The API endpoint
 * @param params Optional query parameters
 * @param network The Solana network (mainnet or devnet)
 * @param forceRefresh Whether to bypass cache and force a fresh request
 * @returns API response data
 */
async function makeApiRequest(
  endpoint: string,
  params: Record<string, any> = {},
  network: SolanaNetwork = DEFAULT_NETWORK,
  forceRefresh: boolean = false
): Promise<any> {
  const url = `${MORALIS_BASE_URL}${endpoint.replace('{network}', network)}`;
  const cacheKey = `${url}:${JSON.stringify(params)}`;
  
  // Check cache if not forcing refresh
  if (!forceRefresh && apiCache[cacheKey] && Date.now() - apiCache[cacheKey].timestamp < CACHE_DURATION) {
    console.log(`Using cached data for ${endpoint}`);
    return apiCache[cacheKey].data;
  }
  
  try {
    const response = await axios.get(url, {
      params,
      headers: {
        'X-Api-Key': MORALIS_API_KEY
      }
    });
    
    // Cache the response
    apiCache[cacheKey] = {
      data: response.data,
      timestamp: Date.now()
    };
    
    return response.data;
  } catch (error: any) {
    // Handle rate limiting
    if (error.response && error.response.status === 429) {
      console.error('Rate limit exceeded for Moralis API. Retrying after delay...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      return makeApiRequest(endpoint, params, network, forceRefresh);
    }
    
    // Handle other errors
    console.error(`Error fetching ${endpoint}:`, error.response?.data || error.message);
    return null;
  }
}

/**
 * Get NFT metadata for a given contract address
 * @param address The contract address
 * @param network The Solana network (mainnet or devnet)
 * @returns NFT metadata
 */
export async function getNFTMetadata(address: string, network: SolanaNetwork = DEFAULT_NETWORK) {
  return makeApiRequest(`/nft/{network}/${address}/metadata`, {}, network);
}

/**
 * Get NFTs owned by a given address
 * @param address The wallet address
 * @param params Search parameters including pagination and metadata options
 * @param network The Solana network (mainnet or devnet)
 * @returns Array of NFTs owned by the address
 */
export async function getNFTsForAddress(
  address: string, 
  params: NFTSearchParams = {},
  network: SolanaNetwork = DEFAULT_NETWORK
) {
  return makeApiRequest(`/account/{network}/${address}/nft`, params, network);
}

/**
 * Get token metadata for a given contract address
 * @param address The token contract address
 * @param network The Solana network (mainnet or devnet)
 * @returns Token metadata
 */
export async function getTokenMetadata(address: string, network: SolanaNetwork = DEFAULT_NETWORK) {
  return makeApiRequest(`/token/{network}/${address}/metadata`, {}, network);
}

/**
 * Get token price for a given contract address
 * @param address The token contract address
 * @param network The Solana network (mainnet or devnet)
 * @returns Token price information
 */
export async function getTokenPrice(address: string, network: SolanaNetwork = DEFAULT_NETWORK) {
  return makeApiRequest(`/token/{network}/${address}/price`, {}, network);
}

/**
 * Get portfolio information for a given address
 * @param address The wallet address
 * @param includeNftMetadata Whether to include full NFT metadata
 * @param network The Solana network (mainnet or devnet)
 * @returns Portfolio information including native balance, tokens, and NFTs
 */
export async function getPortfolio(
  address: string, 
  includeNftMetadata: boolean = false,
  network: SolanaNetwork = DEFAULT_NETWORK
) {
  return makeApiRequest(
    `/account/{network}/${address}/portfolio`, 
    { nftMetadata: includeNftMetadata }, 
    network
  );
}

/**
 * Get token balances for a given address
 * @param address The wallet address
 * @param network The Solana network (mainnet or devnet)
 * @returns Array of token balances
 */
export async function getTokenBalances(address: string, network: SolanaNetwork = DEFAULT_NETWORK) {
  return makeApiRequest(`/account/{network}/${address}/tokens`, {}, network);
}

/**
 * Get native SOL balance for a given address
 * @param address The wallet address
 * @param network The Solana network (mainnet or devnet)
 * @returns Native balance information
 */
export async function getNativeBalance(address: string, network: SolanaNetwork = DEFAULT_NETWORK) {
  return makeApiRequest(`/account/{network}/${address}/balance`, {}, network);
}

/**
 * Get swap transactions for a given wallet address
 * @param address The wallet address
 * @param params Search parameters including pagination
 * @param network The Solana network (mainnet or devnet)
 * @returns Swap transaction information
 */
export async function getSwapsByWalletAddress(
  address: string, 
  params: PaginationParams = { limit: 100 },
  network: SolanaNetwork = DEFAULT_NETWORK
) {
  return makeApiRequest(`/account/{network}/${address}/swaps`, params, network);
}

/**
 * Get swap transactions for a given token address
 * @param address The token address
 * @param params Search parameters including pagination
 * @param network The Solana network (mainnet or devnet)
 * @returns Swap transaction information
 */
export async function getSwapsByTokenAddress(
  address: string, 
  params: PaginationParams = { limit: 100 },
  network: SolanaNetwork = DEFAULT_NETWORK
) {
  return makeApiRequest(`/token/{network}/${address}/swaps`, params, network);
}

/**
 * Get token holders information
 * @param address The token address
 * @param network The Solana network (mainnet or devnet)
 * @returns Token holders information
 */
export async function getTokenHolders(address: string, network: SolanaNetwork = DEFAULT_NETWORK) {
  return makeApiRequest(`/token/{network}/holders/${address}`, {}, network);
}

/**
 * Get SPL token transfers for a given address
 * @param address The wallet or token address
 * @param params Search parameters including pagination and date range
 * @param network The Solana network (mainnet or devnet)
 * @returns SPL token transfers
 */
export async function getSPLTokenTransfers(
  address: string,
  params: TransactionSearchParams = { limit: 100 },
  network: SolanaNetwork = DEFAULT_NETWORK
) {
  return makeApiRequest(`/account/{network}/${address}/spl-transfers`, params, network);
}

/**
 * Get SOL transfers for a given address
 * @param address The wallet address
 * @param params Search parameters including pagination and date range
 * @param network The Solana network (mainnet or devnet)
 * @returns SOL transfers
 */
export async function getSOLTransfers(
  address: string,
  params: TransactionSearchParams = { limit: 100 },
  network: SolanaNetwork = DEFAULT_NETWORK
) {
  return makeApiRequest(`/account/{network}/${address}/sol-transfers`, params, network);
}

/**
 * Get transaction details by signature
 * @param signature The transaction signature
 * @param network The Solana network (mainnet or devnet)
 * @returns Transaction details
 */
export async function getTransactionBySignature(signature: string, network: SolanaNetwork = DEFAULT_NETWORK) {
  return makeApiRequest(`/transaction/{network}/${signature}`, {}, network);
}

/**
 * Get all transactions for a given address
 * @param address The wallet address
 * @param params Search parameters including pagination and date range
 * @param network The Solana network (mainnet or devnet)
 * @returns Transactions for the address
 */
export async function getTransactionsByAddress(
  address: string,
  params: TransactionSearchParams = { limit: 100 },
  network: SolanaNetwork = DEFAULT_NETWORK
) {
  return makeApiRequest(`/account/{network}/${address}/transactions`, params, network);
}

/**
 * Get domain information for a given address (e.g., .sol domains)
 * @param address The wallet address
 * @param network The Solana network (mainnet or devnet)
 * @returns Domain information
 */
export async function getDomainInfo(address: string, network: SolanaNetwork = DEFAULT_NETWORK) {
  return makeApiRequest(`/account/{network}/${address}/domains`, {}, network);
}

/**
 * Resolve domain to address (e.g., .sol domains)
 * @param domain The domain name (e.g., "example.sol")
 * @param network The Solana network (mainnet or devnet)
 * @returns Resolved address information
 */
export async function resolveDomain(domain: string, network: SolanaNetwork = DEFAULT_NETWORK) {
  return makeApiRequest(`/resolve/{network}/domain`, { domain }, network);
}

/**
 * Get historical token price data
 * @param address The token address
 * @param days Number of days of historical data to retrieve
 * @param network The Solana network (mainnet or devnet)
 * @returns Historical price data
 */
export async function getHistoricalTokenPrice(
  address: string,
  days: number = 7,
  network: SolanaNetwork = DEFAULT_NETWORK
) {
  const toDate = new Date().toISOString();
  const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  
  return makeApiRequest(
    `/token/{network}/${address}/price/history`, 
    { to_date: toDate, from_date: fromDate }, 
    network
  );
}

/**
 * Get token stats (e.g., volume, market cap)
 * @param address The token address
 * @param network The Solana network (mainnet or devnet)
 * @returns Token stats
 */
export async function getTokenStats(address: string, network: SolanaNetwork = DEFAULT_NETWORK) {
  return makeApiRequest(`/token/{network}/${address}/stats`, {}, network);
}

/**
 * Get NFT collection stats
 * @param address The collection address
 * @param network The Solana network (mainnet or devnet)
 * @returns NFT collection stats
 */
export async function getNFTCollectionStats(address: string, network: SolanaNetwork = DEFAULT_NETWORK) {
  return makeApiRequest(`/nft/{network}/collection/${address}/stats`, {}, network);
}

/**
 * Get NFT collection items
 * @param address The collection address
 * @param params Search parameters including pagination
 * @param network The Solana network (mainnet or devnet)
 * @returns NFT collection items
 */
export async function getNFTCollectionItems(
  address: string,
  params: NFTSearchParams = { limit: 100, nftMetadata: true },
  network: SolanaNetwork = DEFAULT_NETWORK
) {
  return makeApiRequest(`/nft/{network}/collection/${address}/items`, params, network);
}

/**
 * Get comprehensive blockchain data for a given address or transaction
 * @param query The address, transaction, or token to query
 * @param network The Solana network (mainnet or devnet)
 * @returns Comprehensive blockchain data
 */
export async function getComprehensiveBlockchainData(query: string, network: SolanaNetwork = DEFAULT_NETWORK) {
  // Initialize result object
  const result: any = {
    query,
    network,
    timestamp: new Date().toISOString(),
    data: {}
  };

  try {
    // First, try to get transaction details if it looks like a signature
    if (query.length > 80) {
      const transactionDetails = await getTransactionBySignature(query, network);
      if (transactionDetails) {
        result.type = 'transaction';
        result.data.transaction = transactionDetails;
        return result;
      }
    }
    
    // Try to get token metadata
    const tokenMetadata = await getTokenMetadata(query, network);
    if (tokenMetadata) {
      result.type = 'token';
      result.data.metadata = tokenMetadata;
      
      // Get token price
      const tokenPrice = await getTokenPrice(query, network);
      if (tokenPrice) {
        result.data.price = tokenPrice;
      }
      
      // Get historical price data (7 days)
      const historicalPrice = await getHistoricalTokenPrice(query, 7, network);
      if (historicalPrice) {
        result.data.historicalPrice = historicalPrice;
      }
      
      // Get token stats
      const tokenStats = await getTokenStats(query, network);
      if (tokenStats) {
        result.data.stats = tokenStats;
      }
      
      // Get token holders
      const tokenHolders = await getTokenHolders(query, network);
      if (tokenHolders) {
        result.data.holders = tokenHolders;
      }
      
      // Get token swaps
      const tokenSwaps = await getSwapsByTokenAddress(query, { limit: 20 }, network);
      if (tokenSwaps) {
        result.data.recentSwaps = tokenSwaps;
      }
      
      return result;
    }
    
    // Try to get NFT metadata
    const nftMetadata = await getNFTMetadata(query, network);
    if (nftMetadata) {
      result.type = 'nft';
      result.data.metadata = nftMetadata;
      
      // Try to get collection stats if this is a collection
      const collectionStats = await getNFTCollectionStats(query, network);
      if (collectionStats) {
        result.data.collectionStats = collectionStats;
      }
      
      // Try to get collection items if this is a collection
      const collectionItems = await getNFTCollectionItems(query, { limit: 10, nftMetadata: true }, network);
      if (collectionItems) {
        result.data.collectionItems = collectionItems;
      }
      
      return result;
    }
    
    // Try to resolve domain if it looks like a .sol domain
    if (query.endsWith('.sol')) {
      const resolvedAddress = await resolveDomain(query, network);
      if (resolvedAddress) {
        // Use the resolved address for further queries
        const domainResult = await getComprehensiveBlockchainData(resolvedAddress.address, network);
        if (domainResult) {
          domainResult.data.domain = query;
          return domainResult;
        }
      }
    }
    
    // Try to get account portfolio
    const portfolio = await getPortfolio(query, false, network);
    if (portfolio) {
      result.type = 'account';
      result.data.portfolio = portfolio;
      
      // Get native balance
      const nativeBalance = await getNativeBalance(query, network);
      if (nativeBalance) {
        result.data.nativeBalance = nativeBalance;
      }
      
      // Get token balances
      const tokenBalances = await getTokenBalances(query, network);
      if (tokenBalances) {
        result.data.tokenBalances = tokenBalances;
      }
      
      // Get NFTs for address
      const nfts = await getNFTsForAddress(query, { limit: 10, nftMetadata: true }, network);
      if (nfts) {
        result.data.nfts = nfts;
      }
      
      // Get recent transactions
      const transactions = await getTransactionsByAddress(query, { limit: 20 }, network);
      if (transactions) {
        result.data.recentTransactions = transactions;
      }
      
      // Get SOL transfers
      const solTransfers = await getSOLTransfers(query, { limit: 10 }, network);
      if (solTransfers) {
        result.data.solTransfers = solTransfers;
      }
      
      // Get SPL token transfers
      const splTransfers = await getSPLTokenTransfers(query, { limit: 10 }, network);
      if (splTransfers) {
        result.data.splTransfers = splTransfers;
      }
      
      // Get account swaps
      const accountSwaps = await getSwapsByWalletAddress(query, { limit: 10 }, network);
      if (accountSwaps) {
        result.data.recentSwaps = accountSwaps;
      }
      
      // Get domain info
      const domainInfo = await getDomainInfo(query, network);
      if (domainInfo) {
        result.data.domains = domainInfo;
      }
      
      return result;
    }
    
    // If we couldn't identify the type, return a generic result
    result.type = 'unknown';
    return result;
  } catch (error) {
    console.error('Error fetching comprehensive blockchain data:', error);
    result.type = 'error';
    result.error = 'Failed to fetch blockchain data';
    return result;
  }
}

/**
 * Clear the API cache
 */
export function clearCache() {
  Object.keys(apiCache).forEach(key => delete apiCache[key]);
}

const MoralisAPI = {
  getNFTMetadata,
  getNFTsForAddress,
  getTokenMetadata,
  getTokenPrice,
  getPortfolio,
  getTokenBalances,
  getNativeBalance,
  getSwapsByWalletAddress,
  getSwapsByTokenAddress,
  getTokenHolders,
  getSPLTokenTransfers,
  getSOLTransfers,
  getTransactionBySignature,
  getTransactionsByAddress,
  getDomainInfo,
  resolveDomain,
  getHistoricalTokenPrice,
  getTokenStats,
  getNFTCollectionStats,
  getNFTCollectionItems,
  getComprehensiveBlockchainData,
  clearCache
};

export default MoralisAPI;
