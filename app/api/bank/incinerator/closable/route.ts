import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookie } from '@/lib/api-auth/auth-server';
import { Connection, PublicKey, LAMPORTS_PER_SOL, ParsedAccountData } from '@solana/web3.js';
import { 
  TOKEN_PROGRAM_ID, 
  AccountLayout, 
  TOKEN_2022_PROGRAM_ID
} from '@solana/spl-token';

interface PriceData {
  price: number;
  source: string;
  timestamp: number;
  confidence: number;
}

interface ClosableAccount {
  pubkey: string;
  mint: string;
  owner: string;
  balance: string;
  decimals: number;
  uiBalance: number;
  rentLamports: number;
  rentSOL: number;
  symbol?: string;
  name?: string;
  logoURI?: string;
  isZeroBalance: boolean;
  isDust: boolean;
  isFrozen: boolean;
  tokenUsdValue: number;
  rentUsdValue: number;
  economicLoss: number;
  isProfitable: boolean;
  priceData?: PriceData;
  slippage: number;
  riskLevel: 'low' | 'medium' | 'high';
  accountType: 'standard' | 'nft' | 'lp' | 'custom';
  isCompressed?: boolean;
  collectionName?: string;
}

interface ClosableAccountsResponse {
  accounts: ClosableAccount[];
  totalRentReclaimable: number;
  totalAccounts: number;
  zeroBalanceCount: number;
  dustCount: number;
  priceAccuracy: number;
  warnings: string[];
  gasInfo?: {
    totalLamports: number;
    totalSOL: number;
    totalUSD: number;
    costPerAccount: number;
    costPerAccountUSD: number;
    solPrice: number;
  };
}

/**
 * Get Solana connection
 */
function getSolanaConnection(): Connection {
  const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
  return new Connection(rpcUrl, 'confirmed');
}

/**
 * Fetch current gas price information
 */
async function fetchGasPriceInfo(): Promise<{
  lamportsPerSignature: number;
  lamportsPerAccountClose: number;
  solPrice: number;
  avgComputeUnits: number;
}> {
  try {
    const connection = getSolanaConnection();
    
    // Get recent fee information
    const feeCalculator = await connection.getRecentPrioritizationFees();
    const lamportsPerSignature = feeCalculator?.[0]?.prioritizationFee || 5000; // Default 5000 lamports
    
    // Account close instruction typically costs 0.000001 SOL
    const lamportsPerAccountClose = 1000;
    
    // Average compute units for close account instruction
    const avgComputeUnits = 200;
    
    // Get current SOL price
    const SOL_MINT = 'So11111111111111111111111111111111111112';
    const aggregator = new PriceAggregator();
    const prices = await aggregator.fetchReliablePrices([SOL_MINT]);
    const solPrice = prices.get(SOL_MINT)?.price || 50;
    
    return {
      lamportsPerSignature,
      lamportsPerAccountClose,
      solPrice,
      avgComputeUnits
    };
  } catch (error) {
    console.error('Error fetching gas prices:', error);
    // Fallback values
    return {
      lamportsPerSignature: 5000,
      lamportsPerAccountClose: 1000,
      solPrice: 50,
      avgComputeUnits: 200
    };
  }
}

/**
 * Calculate transaction costs for batch operations
 */
function calculateTransactionCosts(
  accountCount: number,
  gasInfo: ReturnType<typeof fetchGasPriceInfo> extends Promise<infer T> ? T : never
): {
  totalLamports: number;
  totalSOL: number;
  totalUSD: number;
  costPerAccount: number;
  costPerAccountUSD: number;
} {
  // Each close account needs:
  // 1. Account close instruction (1000 lamports)
  // 2. Signature fee (5000 lamports, shared across batch)
  // 3. Optional: Additional instructions for balance recovery
  
  const baseInstructionCost = gasInfo.lamportsPerAccountClose * accountCount;
  const signatureFee = gasInfo.lamportsPerSignature;
  const totalLamports = baseInstructionCost + signatureFee;
  const totalSOL = totalLamports / LAMPORTS_PER_SOL;
  const totalUSD = totalSOL * gasInfo.solPrice;
  
  return {
    totalLamports,
    totalSOL,
    totalUSD,
    costPerAccount: totalLamports / accountCount,
    costPerAccountUSD: totalUSD / accountCount
  };
}

interface JupiterToken {
  address: string;
  symbol: string;
  name: string;
  logoURI?: string;
}

/**
 * Fetch token metadata from Jupiter API
 */
async function fetchTokenMetadata(mints: string[]): Promise<Map<string, { symbol: string; name: string; logoURI?: string }>> {
  const metadata = new Map<string, { symbol: string; name: string; logoURI?: string }>();
  
  try {
    // Fetch from Jupiter token list
    const response = await fetch('https://token.jup.ag/all', {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 3600 } // Cache for 1 hour
    });
    
    if (response.ok) {
      const tokens: JupiterToken[] = await response.json();
      const tokenMap = new Map<string, JupiterToken>(tokens.map((t) => [t.address, t]));
      
      for (const mint of mints) {
        const token = tokenMap.get(mint);
        if (token) {
          metadata.set(mint, {
            symbol: token.symbol || 'Unknown',
            name: token.name || 'Unknown Token',
            logoURI: token.logoURI
          });
        }
      }
    }
  } catch (error) {
    console.error('Error fetching token metadata:', error);
  }
  
  return metadata;
}

interface PriceOracle {
  name: string;
  fetchPrices(mints: string[]): Promise<Map<string, PriceData>>;
  getReliabilityScore(): number;
}

class JupiterOracle implements PriceOracle {
  name = 'Jupiter';
  
  async fetchPrices(mints: string[]): Promise<Map<string, PriceData>> {
    const prices = new Map<string, PriceData>();
    
    try {
      const mintsParam = mints.join(',');
      const response = await fetch(`https://price.jup.ag/v6/price?ids=${mintsParam}`, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.data) {
          for (const [mint, priceData] of Object.entries(data.data)) {
            const price = (priceData as any).price;
            if (typeof price === 'number') {
              prices.set(mint, {
                price,
                source: this.name,
                timestamp: Date.now(),
                confidence: 96 // Updated confidence for v6
              });
            }
          }
        }
      }
    } catch (error) {
      console.error('Jupiter oracle error:', error);
    }
    
    return prices;
  }
  
  getReliabilityScore(): number {
    return 96;
  }
}

class CoinGeckoOracle implements PriceOracle {
  name = 'CoinGecko';
  
  async fetchPrices(mints: string[]): Promise<Map<string, PriceData>> {
    const prices = new Map<string, PriceData>();
    
    try {
      const coinIds = this.mapMintsToCoinIds(mints);
      const idsParam = Object.values(coinIds).join(',');
      
      if (idsParam) {
        const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${idsParam}&vs_currencies=usd&include_24hr_change=true`, {
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(8000) // 8 second timeout
        });
        
        if (response.ok) {
          const data = await response.json();
          
          for (const [mint, coinId] of Object.entries(coinIds)) {
            if (data[coinId]?.usd) {
              const change24h = data[coinId]?.usd_24h_change || 0;
              const confidence = Math.max(75, 95 - Math.abs(change24h) * 10); // Lower confidence for volatile tokens
              
              prices.set(mint, {
                price: data[coinId].usd,
                source: this.name,
                timestamp: Date.now(),
                confidence
              });
            }
          }
        }
      }
    } catch (error) {
      console.error('CoinGecko oracle error:', error);
    }
    
    return prices;
  }
  
  private mapMintsToCoinIds(mints: string[]): Record<string, string> {
    const mapping: Record<string, string> = {};
    
    // Expanded mapping for better coverage
    const knownTokens: Record<string, string> = {
      'So11111111111111111111111111111111111112': 'solana',
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 'usd-coin',
      'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 'tether',
      '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU': 'wrapped-bitcoin',
      '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R': 'jupiter-exchange-jup',
      'DezXAZ8z7PnyWe8fgJHR2A2fTQHYPT7YdN3rG': 'bonk',
      'mSoLzYCxHdYgdzU16g5QSh3iRYKsLFqvu4': 'marinade',
      'J1toso1uCk8GZcmGqWXsLtfD9LsJWiZA8L': 'jupiter-sol',
      'JUPyiWrYvFmk5uBTwu1kggV38pSakeUtp8rK': 'jupiter-exchange-jup-v2'
    };
    
    for (const mint of mints) {
      if (knownTokens[mint]) {
        mapping[mint] = knownTokens[mint];
      }
    }
    
    return mapping;
  }
  
  getReliabilityScore(): number {
    return 85;
  }
}

class BirdeyeOracle implements PriceOracle {
  name = 'Birdeye';
  
  async fetchPrices(mints: string[]): Promise<Map<string, PriceData>> {
    const prices = new Map<string, PriceData>();
    
    try {
      // Birdeye API for real-time DEX data
      const promises = mints.map(async (mint) => {
        try {
          const response = await fetch(`https://public-api.birdeye.so/defi/price?address=${mint}`, {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(6000) // 6 second timeout
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data.success && data.price) {
              const price = parseFloat(data.price);
              const volume = parseFloat(data.volume24h || '0');
              const confidence = volume > 10000 ? 88 : volume > 1000 ? 82 : 75; // Confidence based on volume
              
              prices.set(mint, {
                price,
                source: this.name,
                timestamp: Date.now(),
                confidence
              });
            }
          }
        } catch (error) {
          console.error(`Birdeye error for ${mint}:`, error);
        }
      });
      
      await Promise.allSettled(promises);
    } catch (error) {
      console.error('Birdeye oracle error:', error);
    }
    
    return prices;
  }
  
  getReliabilityScore(): number {
    return 82; // Good for DEX data, but varies by token
  }
}

class DexScreenerOracle implements PriceOracle {
  name = 'DexScreener';
  
  async fetchPrices(mints: string[]): Promise<Map<string, PriceData>> {
    const prices = new Map<string, PriceData>();
    
    try {
      // DexScreener API for cross-validation
      const promises = mints.map(async (mint) => {
        try {
          const response = await fetch(`https://api.dexscreener.com/latest/dex/pairs?q=${mint}`, {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(7000) // 7 second timeout
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data.pairs && data.pairs.length > 0) {
              const pair = data.pairs[0]; // Take first/most liquid pair
              const price = parseFloat(pair.priceUsd);
              const liquidity = parseFloat(pair.liquidity?.usd || '0');
              const confidence = liquidity > 100000 ? 90 : liquidity > 10000 ? 85 : 78;
              
              prices.set(mint, {
                price,
                source: this.name,
                timestamp: Date.now(),
                confidence
              });
            }
          }
        } catch (error) {
          console.error(`DexScreener error for ${mint}:`, error);
        }
      });
      
      await Promise.allSettled(promises);
    } catch (error) {
      console.error('DexScreener oracle error:', error);
    }
    
    return prices;
  }
  
  getReliabilityScore(): number {
    return 80; // Good for cross-DEX validation
  }
}

class PriceAggregator {
  private oracles: PriceOracle[] = [
    new JupiterOracle(),
    new CoinGeckoOracle(),
    new BirdeyeOracle(),
    new DexScreenerOracle()
  ];
  
  async fetchReliablePrices(mints: string[]): Promise<Map<string, PriceData>> {
    const allPrices = new Map<string, PriceData[]>();
    
    // Fetch prices from all oracles in parallel
    const oraclePromises = this.oracles.map(async (oracle) => {
      try {
        const prices = await oracle.fetchPrices(mints);
        return { oracle, prices };
      } catch (error) {
        console.error(`${oracle.name} oracle failed:`, error);
        return { oracle, prices: new Map<string, PriceData>() };
      }
    });
    
    const results = await Promise.all(oraclePromises);
    
    // Aggregate prices by mint
    for (const { prices } of results) {
      for (const [mint, priceData] of prices.entries()) {
        if (!allPrices.has(mint)) {
          allPrices.set(mint, []);
        }
        allPrices.get(mint)!.push(priceData);
      }
    }
    
    // Determine best price for each mint
    const finalPrices = new Map<string, PriceData>();
    
    for (const [mint, priceList] of allPrices.entries()) {
      if (priceList.length === 1) {
        // Only one source available
        finalPrices.set(mint, priceList[0]);
      } else if (priceList.length > 1) {
        // Multiple sources - use weighted average based on confidence
        const weightedPrice = priceList.reduce((sum, price) => 
          sum + (price.price * price.confidence), 0
        ) / priceList.reduce((sum, price) => sum + price.confidence, 0);
        
        const avgConfidence = priceList.reduce((sum, price) => sum + price.confidence, 0) / priceList.length;
        
        finalPrices.set(mint, {
          price: weightedPrice,
          source: 'Aggregated',
          timestamp: Math.max(...priceList.map(p => p.timestamp)),
          confidence: Math.min(95, avgConfidence + 5) // Boost confidence for multiple sources
        });
      }
    }
    
    return finalPrices;
  }
}

/**
 * Fetch token prices using multi-oracle system
 */
async function fetchTokenPrices(mints: string[]): Promise<Map<string, PriceData>> {
  const aggregator = new PriceAggregator();
  return await aggregator.fetchReliablePrices(mints);
}

/**
 * Detect account type based on mint and balance characteristics
 */
async function detectAccountType(
  mint: string, 
  balance: string, 
  uiBalance: number,
  connection: Connection
): Promise<{ 
  accountType: 'standard' | 'nft' | 'lp' | 'custom', 
  isCompressed?: boolean,
  collectionName?: string 
}> {
  try {
    // Get mint info to determine token properties
    const mintInfo = await connection.getParsedAccountInfo(new PublicKey(mint));
    
    if (!mintInfo.value) {
      return { accountType: 'custom' };
    }
    
    const parsedMint = (mintInfo.value.data as ParsedAccountData)?.parsed;
    if (!parsedMint) {
      return { accountType: 'custom' };
    }
    
    const mintData = parsedMint.info;
    const supply = typeof mintData.supply === 'string' ? parseInt(mintData.supply) : mintData.supply;
    const decimals = mintData.decimals || 0;
    
    // NFT Detection Logic
    // NFTs typically have: decimals = 0, supply = 1 (or small), balance = 1
    if (decimals === 0 && supply <= 1 && (balance === '1' || uiBalance === 1)) {
      return { 
        accountType: 'nft',
        isCompressed: false,
        collectionName: mintData.name || 'NFT Collection'
      };
    }
    
    // LP Token Detection Logic
    // LP tokens often have specific characteristics:
    // - Usually have more decimals (6-18)
    // - Often names contain "LP", "UNI-", "CAKE-", etc.
    // - Balance patterns suggest pool shares
    if (mintData.name?.toLowerCase().includes('lp') ||
        mintData.name?.toLowerCase().includes('liquidity') ||
        mintData.symbol?.toLowerCase().includes('lp') ||
        (decimals >= 6 && uiBalance > 0 && uiBalance < 1000000)) {
      return { 
        accountType: 'lp',
        collectionName: mintData.name || 'LP Token'
      };
    }
    
    // Compressed NFT Detection
    // For compressed NFTs, we'd need to check for Merkle tree accounts
    // This is more complex and requires additional RPC calls
    // For now, we'll use heuristics
    if (uiBalance === 0 && mintData.mintAuthority === null) {
      // Might be a compressed NFT that was already redeemed
      return { 
        accountType: 'nft',
        isCompressed: true,
        collectionName: 'Compressed NFT'
      };
    }
    
    // Standard token detection
    if (decimals > 0 && supply > 1) {
      return { 
        accountType: 'standard',
        isCompressed: false
      };
    }
    
    // Fallback to custom
    return { 
      accountType: 'custom',
      isCompressed: false
    };
    
  } catch (error) {
    console.error('Error detecting account type:', error);
    // Fallback to standard if detection fails
    return { accountType: 'standard' };
  }
}

/**
 * Fetch SOL price using multi-oracle system
 */
async function fetchSolPrice(): Promise<number> {
  const SOL_MINT = 'So11111111111111111111111111111111111111112';
  const aggregator = new PriceAggregator();
  const prices = await aggregator.fetchReliablePrices([SOL_MINT]);
  
  return prices.get(SOL_MINT)?.price || 50; // Fallback to $50/SOL
}

/**
 * Calculate price accuracy based on successful price fetches
 */
function calculatePriceAccuracy(prices: Map<string, PriceData>, totalMints: number): number {
  if (totalMints === 0) return 100;
  const successRate = (prices.size / totalMints) * 100;
  return Math.round(successRate);
}

/**
 * Calculate slippage based on token value and liquidity
 */
function calculateSlippage(tokenAmount: number, tokenPrice: number): number {
  const tokenValue = tokenAmount * tokenPrice;
  
  // Simple slippage calculation based on token value
  // Higher value = higher potential slippage
  if (tokenValue < 1) return 0.5; // 0.5% for small amounts
  if (tokenValue < 10) return 1; // 1% for medium amounts
  if (tokenValue < 100) return 2; // 2% for large amounts
  return 3; // 3% for very large amounts
}

/**
 * Calculate risk level based on account characteristics
 */
function calculateRiskLevel(account: ClosableAccount, priceInfo: PriceData): 'low' | 'medium' | 'high' {
  // High-value tokens are higher risk
  if (account.tokenUsdValue > 50) return 'high';
  
  // Low confidence prices are higher risk
  if (priceInfo.confidence < 70) return 'high';
  
  // Medium-value tokens with decent confidence are medium risk
  if (account.tokenUsdValue > 10 || priceInfo.confidence < 85) return 'medium';
  
  // Everything else is low risk
  return 'low';
}

/**
 * Generate warnings based on account analysis
 */
function generateWarnings(accounts: ClosableAccount[], priceAccuracy: number): string[] {
  const warnings: string[] = [];
  
  // Price accuracy warnings
  if (priceAccuracy < 100) {
    warnings.push(`Price data incomplete: ${100 - priceAccuracy}% of token prices unavailable`);
  }
  
  // High-value token warnings
  const highValueAccounts = accounts.filter(a => a.tokenUsdValue > 10);
  if (highValueAccounts.length > 0) {
    warnings.push(`${highValueAccounts.length} account(s) contain tokens worth >$10 each`);
  }
  
  // High economic loss warnings
  const highLossAccounts = accounts.filter(a => a.economicLoss > 1);
  if (highLossAccounts.length > 0) {
    warnings.push(`${highLossAccounts.length} account(s) would result in >$1 economic loss if closed`);
  }
  
  // Large batch warning
  if (accounts.length > 10) {
    warnings.push('Large batch detected - consider processing in smaller groups');
  }
  
  // Frozen accounts warning
  const frozenAccounts = accounts.filter(a => a.isFrozen);
  if (frozenAccounts.length > 0) {
    warnings.push(`${frozenAccounts.length} frozen account(s) cannot be closed until unfrozen`);
  }
  
  return warnings;
}

/**
 * GET /api/bank/incinerator/closable
 * Fetch all closable token accounts for authenticated user's connected wallet
 */
export async function GET(req: NextRequest) {
  try {
    // Get authenticated user from session
    const session = await getSessionFromCookie();
    let walletAddress = session?.walletAddress;
    
    // For testing purposes, allow unauthenticated access with mock wallet
    if (!walletAddress) {
      const isDevelopment = process.env.NODE_ENV === 'development' || 
                          req.headers.get('host')?.includes('localhost') ||
                          req.headers.get('host')?.includes('127.0.0.1');
      
      if (isDevelopment) {
        // Use a mock wallet for testing
        walletAddress = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM'; // Example wallet
        console.log('Using mock wallet for testing:', walletAddress);
      } else {
        return NextResponse.json(
          { error: 'Not authenticated' },
          { status: 401 }
        );
      }
    }

    const connection = getSolanaConnection();
    const publicKey = new PublicKey(walletAddress);
    
    // Get dust threshold from query params (default: $0.01 equivalent or 0.0001 SOL worth)
    const dustThreshold = parseFloat(req.nextUrl.searchParams.get('dustThreshold') || '0.01');
    
    // Fetch all token accounts for the wallet (including zero balance) from both programs
    const [tokenAccounts, token2022Accounts] = await Promise.all([
      connection.getParsedTokenAccountsByOwner(publicKey, {
        programId: TOKEN_PROGRAM_ID
      }),
      connection.getParsedTokenAccountsByOwner(publicKey, {
        programId: TOKEN_2022_PROGRAM_ID
      })
    ]);
    
    // Combine accounts from both programs
    const allTokenAccounts = [
      ...tokenAccounts.value.map(a => ({ ...a, programId: 'TOKEN_PROGRAM' as const })),
      ...token2022Accounts.value.map(a => ({ ...a, programId: 'TOKEN_2022' as const }))
    ];
    
    // Get rent for token accounts (typically 0.00203928 SOL for a token account)
    const rentExemptMinimum = await connection.getMinimumBalanceForRentExemption(AccountLayout.span);
    const rentSOL = rentExemptMinimum / LAMPORTS_PER_SOL;
    
    const closableAccounts: ClosableAccount[] = [];
    const mints: string[] = [];
    
    // Process all token accounts
    for (const { pubkey, account } of allTokenAccounts) {
      const parsedInfo = account.data.parsed.info;
      const mint = parsedInfo.mint;
      const balance = parsedInfo.tokenAmount.amount;
      const decimals = parsedInfo.tokenAmount.decimals;
      const uiBalance = parsedInfo.tokenAmount.uiAmount || 0;
      const isFrozen = parsedInfo.state === 'frozen';
      
      mints.push(mint);
      
      // Detect account type
      const accountTypeInfo = await detectAccountType(mint, balance, uiBalance, connection);
      
      // Check if zero balance (immediately closable)
      const isZeroBalance = balance === '0' || uiBalance === 0;
      
      // Check if dust (very small amount, user might want to close anyway)
      // For now, consider anything with uiBalance < dustThreshold as dust
      const isDust = !isZeroBalance && uiBalance < dustThreshold;
      
      closableAccounts.push({
        pubkey: pubkey.toString(),
        mint,
        owner: walletAddress,
        balance,
        decimals,
        uiBalance,
        rentLamports: rentExemptMinimum,
        rentSOL,
        isZeroBalance,
        isDust,
        isFrozen,
        tokenUsdValue: 0,
        rentUsdValue: 0,
        economicLoss: 0,
        isProfitable: true,
        slippage: 0,
        riskLevel: 'low' as const,
        accountType: accountTypeInfo.accountType,
        isCompressed: accountTypeInfo.isCompressed,
        collectionName: accountTypeInfo.collectionName
      });
    }
    
    // Fetch metadata, prices, and gas info for all mints
    const [metadata, priceDataMap, solPrice, gasInfo] = await Promise.all([
      fetchTokenMetadata(mints),
      fetchTokenPrices(mints),
      fetchSolPrice(),
      fetchGasPriceInfo()
    ]);
    
    // Enrich accounts with metadata and economic calculations
    for (const account of closableAccounts) {
      const tokenMeta = metadata.get(account.mint);
      if (tokenMeta) {
        account.symbol = tokenMeta.symbol;
        account.name = tokenMeta.name;
        account.logoURI = tokenMeta.logoURI;
      } else {
        account.symbol = account.mint.slice(0, 4) + '...';
        account.name = 'Unknown Token';
      }
      
      // Calculate economic values
      const priceInfo = priceDataMap.get(account.mint);
      const tokenPrice = priceInfo?.price || 0;
      
      account.tokenUsdValue = account.uiBalance * tokenPrice;
      account.rentUsdValue = account.rentSOL * solPrice;
      account.economicLoss = account.tokenUsdValue - account.rentUsdValue;
      account.isProfitable = account.tokenUsdValue <= account.rentUsdValue;
      
      // Add price data and calculate slippage/risk
      if (priceInfo) {
        account.priceData = priceInfo;
        account.slippage = calculateSlippage(account.uiBalance, tokenPrice);
        account.riskLevel = calculateRiskLevel(account, priceInfo);
      }
    }
    
    // Sort: profitable first (zero balance), then by economic loss (smallest loss first)
    closableAccounts.sort((a, b) => {
      // Zero balance always first (most profitable)
      if (a.isZeroBalance && !b.isZeroBalance) return -1;
      if (!a.isZeroBalance && b.isZeroBalance) return 1;
      
      // Then sort by profitability
      if (a.isProfitable && !b.isProfitable) return -1;
      if (!a.isProfitable && b.isProfitable) return 1;
      
      // Within same profitability category, sort by economic loss (best trades first)
      return a.economicLoss - b.economicLoss;
    });
    
    const zeroBalanceAccounts = closableAccounts.filter(a => a.isZeroBalance);
    const dustAccounts = closableAccounts.filter(a => a.isDust);
    const totalRentReclaimable = zeroBalanceAccounts.length * rentSOL;
    
    // Calculate transaction costs and gas information
    const transactionCosts = calculateTransactionCosts(closableAccounts.length, gasInfo);
    
    // Calculate price accuracy and generate warnings
    const priceAccuracy = calculatePriceAccuracy(priceDataMap, mints.length);
    const warnings = generateWarnings(closableAccounts, priceAccuracy);
    
    // Add gas cost warnings if significant
    if (transactionCosts.totalUSD > 0.50) {
      warnings.push(`High transaction costs: ~$${transactionCosts.totalUSD.toFixed(3)} for closing all accounts`);
    }
    
    const response: ClosableAccountsResponse = {
      accounts: closableAccounts,
      totalRentReclaimable,
      totalAccounts: closableAccounts.length,
      zeroBalanceCount: zeroBalanceAccounts.length,
      dustCount: dustAccounts.length,
      priceAccuracy,
      warnings,
      gasInfo: {
        ...transactionCosts,
        solPrice: gasInfo.solPrice
      }
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Error fetching closable accounts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch closable accounts', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
