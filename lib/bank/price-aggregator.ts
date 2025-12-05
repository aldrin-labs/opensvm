/**
 * Multi-oracle price aggregation system for SVM Bank
 * Aggregates prices from Jupiter, CoinGecko, Birdeye, and DexScreener
 */

export interface PriceData {
  price: number;
  source: string;
  timestamp: number;
  confidence: number;
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
        signal: AbortSignal.timeout(5000)
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
                confidence: 96
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
          signal: AbortSignal.timeout(8000)
        });

        if (response.ok) {
          const data = await response.json();

          for (const [mint, coinId] of Object.entries(coinIds)) {
            if (data[coinId]?.usd) {
              const change24h = data[coinId]?.usd_24h_change || 0;
              const confidence = Math.max(75, 95 - Math.abs(change24h) * 10);

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
      const promises = mints.slice(0, 10).map(async (mint) => {
        try {
          const response = await fetch(`https://public-api.birdeye.so/defi/price?address=${mint}`, {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(6000)
          });

          if (response.ok) {
            const data = await response.json();
            if (data.success && data.data?.value) {
              const price = parseFloat(data.data.value);
              const volume = parseFloat(data.data?.volume24h || '0');
              const confidence = volume > 10000 ? 88 : volume > 1000 ? 82 : 75;

              prices.set(mint, {
                price,
                source: this.name,
                timestamp: Date.now(),
                confidence
              });
            }
          }
        } catch (error) {
          // Silent fail for individual tokens
        }
      });

      await Promise.allSettled(promises);
    } catch (error) {
      console.error('Birdeye oracle error:', error);
    }

    return prices;
  }

  getReliabilityScore(): number {
    return 82;
  }
}

class DexScreenerOracle implements PriceOracle {
  name = 'DexScreener';

  async fetchPrices(mints: string[]): Promise<Map<string, PriceData>> {
    const prices = new Map<string, PriceData>();

    try {
      // DexScreener batch API
      const mintsParam = mints.slice(0, 30).join(',');
      const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mintsParam}`, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(7000)
      });

      if (response.ok) {
        const data = await response.json();
        if (data.pairs) {
          // Group pairs by token address
          const pairsByToken = new Map<string, any[]>();
          for (const pair of data.pairs) {
            const tokenAddress = pair.baseToken?.address;
            if (tokenAddress && mints.includes(tokenAddress)) {
              if (!pairsByToken.has(tokenAddress)) {
                pairsByToken.set(tokenAddress, []);
              }
              pairsByToken.get(tokenAddress)!.push(pair);
            }
          }

          // Take best pair (highest liquidity) for each token
          for (const [mint, pairs] of pairsByToken.entries()) {
            const bestPair = pairs.sort((a, b) =>
              (parseFloat(b.liquidity?.usd || '0') - parseFloat(a.liquidity?.usd || '0'))
            )[0];

            if (bestPair?.priceUsd) {
              const price = parseFloat(bestPair.priceUsd);
              const liquidity = parseFloat(bestPair.liquidity?.usd || '0');
              const confidence = liquidity > 100000 ? 90 : liquidity > 10000 ? 85 : 78;

              prices.set(mint, {
                price,
                source: this.name,
                timestamp: Date.now(),
                confidence
              });
            }
          }
        }
      }
    } catch (error) {
      console.error('DexScreener oracle error:', error);
    }

    return prices;
  }

  getReliabilityScore(): number {
    return 80;
  }
}

export class PriceAggregator {
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
          confidence: Math.min(95, avgConfidence + 5)
        });
      }
    }

    return finalPrices;
  }

  async fetchSolPrice(): Promise<number> {
    const SOL_MINT = 'So11111111111111111111111111111111111112';
    const prices = await this.fetchReliablePrices([SOL_MINT]);
    return prices.get(SOL_MINT)?.price || 50;
  }
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
export async function fetchTokenMetadata(mints: string[]): Promise<Map<string, { symbol: string; name: string; logoURI?: string }>> {
  const metadata = new Map<string, { symbol: string; name: string; logoURI?: string }>();

  try {
    const response = await fetch('https://token.jup.ag/all', {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 3600 }
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
