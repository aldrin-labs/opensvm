import { z } from 'zod';

const TokenMarketDataSchema = z.object({
  coinId: z.string().describe('The CoinGecko coin ID. Common mappings: "opensvm-com" for SVMAI/SOL AI, "solana" for SOL, "bonk" for BONK, "dogwifcoin" for WIF'),
});

export const tokenMarketDataTool = {
  name: 'tokenMarketData',
  description: 'Fetches current market data for a cryptocurrency token from CoinGecko API including price, market cap, trading volume, and price changes. Use this for getting real-time token prices, market capitalization, and 24h volume data.',
  parameters: TokenMarketDataSchema,
  execute: async ({ coinId }: { coinId: string }) => {
    try {
      const response = await fetch(
        `https://api.coingecko.com/api/v3/coins/${coinId}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false`
      );

      if (!response.ok) {
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
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  },
};
