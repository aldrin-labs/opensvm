export interface TokenMarketData {
  address: string;
  symbol: string;
  name: string;
  icon?: string;
  price?: number;
  priceChange24h?: number;
  priceChangePercentage24h?: number;
  marketCap?: number;
  volume24h?: number;
  decimals: number;
  supply?: number;
  createdAt?: string;
  isNew?: boolean;
  rank?: number;
}

export interface TokenGainerData extends TokenMarketData {
  priceChange24h: number;
  priceChangePercentage24h: number;
}

export interface NewTokenData extends TokenMarketData {
  createdAt: string;
  isNew: true;
  daysOld: number;
}

export interface TokenListResponse {
  tokens: TokenMarketData[];
  hasMore: boolean;
  cursor?: string;
  total?: number;
}