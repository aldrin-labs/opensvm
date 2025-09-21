import { z } from 'zod';

const TokenMarketDataSchema = z.object({
  coinId: z.string().describe('The CoinGecko coin ID. Common mappings: "opensvm-com" for SVMAI/SOL AI, "solana" for SOL, "bonk" for BONK, "dogwifcoin" for WIF'),
});

export const tokenMarketDataTool = {
  name: 'tokenMarketData',
  description: 'Fetches current market data for a cryptocurrency token from CoinGecko API including price, market cap, trading volume, and price changes. Use this for getting real-time token prices, market capitalization, and 24h volume data.',
  parameters: TokenMarketDataSchema,
  execute: async ({ coinId }: { coinId: string }) => {
    // Shared headers and simple retry helper to reduce transient failures / rate limits
    const headers: Record<string, string> = {
      accept: 'application/json',
      'user-agent': 'opensvm/1.0 (+https://github.com/aldrin-labs/opensvm)'
    };

    async function fetchWithRetry(url: string, retries = 1, delayMs = 1200) {
      let lastRes: Response | null = null;
      for (let attempt = 0; attempt <= retries; attempt++) {
        const res = await fetch(url, { headers });
        if (res.ok) return res;
        lastRes = res;
        // Retry on rate limits or transient server errors
        if ([429, 500, 502, 503, 504].includes(res.status) && attempt < retries) {
          await new Promise(r => setTimeout(r, delayMs));
          continue;
        }
        break;
      }
      // If never ok, return the last response
      // @ts-ignore
      return lastRes as Response;
    }

    async function fetchCoin(id: string) {
      const url = `https://api.coingecko.com/api/v3/coins/${id}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false`;
      return fetchWithRetry(url, 1);
    }

    // Simpler markets endpoint fallback (sometimes more reliable/heavily cached)
    async function fetchMarkets(id: string) {
      const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${encodeURIComponent(id)}`;
      return fetchWithRetry(url, 1);
    }

    try {
      let id = coinId;
      let response = await fetchCoin(id);

      // If direct fetch fails (common when plan passes a symbol like "ray"), try CoinGecko search to resolve the correct coin ID.
      if (!response.ok) {
        try {
          const searchRes = await fetch(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(coinId)}`);
          if (searchRes.ok) {
            const searchData = await searchRes.json();
            const coins = Array.isArray(searchData.coins) ? searchData.coins : [];
            // Prefer exact symbol match (e.g., "ray" -> "raydium")
            const exactSymbol = coins.find((c: any) => c?.symbol?.toLowerCase() === coinId.toLowerCase());
            // Fallback to fuzzy id/name contains query
            const candidate = exactSymbol || coins.find((c: any) =>
              c?.id?.toLowerCase().includes(coinId.toLowerCase()) ||
              c?.name?.toLowerCase().includes(coinId.toLowerCase())
            );
            if (candidate?.id) {
              id = candidate.id;
              response = await fetchCoin(id);
            }
          }
        } catch {
          // ignore search fallback errors and let the normal error handler run
        }
      }

      if (!response.ok) {
        // Try simpler markets endpoint fallback before failing
        try {
          const marketsRes = await fetchMarkets(id);
          if (marketsRes.ok) {
            const arr = await marketsRes.json();
            if (Array.isArray(arr) && arr.length > 0) {
              const m = arr[0];
              return {
                success: true,
                data: {
                  name: m.name,
                  symbol: (m.symbol || '').toUpperCase(),
                  current_price: {
                    usd: m.current_price ?? 0,
                  },
                  market_cap: {
                    usd: m.market_cap ?? 0,
                  },
                  trading_volume: {
                    usd: m.total_volume ?? 0,
                    h24: m.total_volume ?? 0,
                  },
                  price_change_24h: m.price_change_percentage_24h ?? 0,
                  market_cap_rank: m.market_cap_rank ?? null,
                  last_updated: m.last_updated || new Date().toISOString(),
                },
                source: 'coingecko:markets',
                resolved_id: id,
              };
            }
          }
        } catch {
          // ignore and fall through to error
        }
        throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const marketData = data.market_data;

      return {
        success: true,
        data: {
          name: data.name,
          symbol: data.symbol?.toUpperCase() || 'UNKNOWN',
          current_price: {
            usd: marketData.current_price?.usd || 0,
          },
          market_cap: {
            usd: marketData.market_cap?.usd || 0,
          },
          trading_volume: {
            usd: marketData.total_volume?.usd || 0,
            h24: marketData.total_volume?.usd || 0,
          },
          price_change_24h: marketData.price_change_percentage_24h || 0,
          market_cap_rank: marketData.market_cap_rank || null,
          last_updated: marketData.last_updated || new Date().toISOString(),
        },
        source: 'coingecko',
        resolved_id: id,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  },
};
