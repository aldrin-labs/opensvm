export interface TokenAccount {
  mint: string;
  balance: number;
}

export interface Transfer {
  timestamp: string;
  type: string;
  amount: number;
  token: string;
  from: string;
  to: string;
  mint?: string;
  signature: string;
  tokenName?: string;
  tokenSymbol?: string;
  usdValue?: number;
  currentUsdValue?: number;
}

export type Tab = 'transfers' | 'activity' | 'tokens' | 'nfts' | 'transactions';

export interface TabContainerProps {
  address: string;
  solBalance: number;
  tokenBalances: TokenAccount[];
}