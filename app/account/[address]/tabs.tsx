"use client";

import TabContainer from './components/TabContainer';

export interface Tab {
  id: string;
  label: string;
}

export const tabs: Tab[] = [
  { id: 'tokens', label: 'Tokens' },
  { id: 'transfers', label: 'Transfers' },
  { id: 'nfts', label: 'NFTs' },
  { id: 'programs', label: 'Programs' },
  { id: 'search', label: 'Search Results' },
];

interface Props {
  address: string;
  solBalance: number;
  tokenBalances: { mint: string; balance: number; }[];
  activeTab: string;
}

export default function Tabs({ address, solBalance, tokenBalances, activeTab }: Props) {
  return (
    <div className="w-full">
      <TabContainer address={address} activeTab={activeTab} solBalance={solBalance} tokenBalances={tokenBalances} />
    </div>
  );
}
