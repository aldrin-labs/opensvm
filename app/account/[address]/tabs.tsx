"use client";

import TabContainer from './components/TabContainer';

export interface Tab {
  id: string;
  label: string;
}

export const tabs: Tab[] = [
  { id: 'tokens', label: 'Tokens' },
  { id: 'sol-transfers', label: 'SOL Transfers' },
  { id: 'token-transfers', label: 'Token Transfers' },
  { id: 'all-transfers', label: 'All Transfers' },
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
