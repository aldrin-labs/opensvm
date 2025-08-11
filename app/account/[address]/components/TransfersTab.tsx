"use client";

import { memo } from 'react';
import { TransfersTable } from '@/components/TransfersTable';

// Transaction category types
type TransactionCategory =
  | 'account-transfers'
  | 'all-txs'
  | 'trading-txs'
  | 'defi-txs'
  | 'nft-txs'
  | 'staking-txs'
  | 'utility-txs'
  | 'suspicious-txs'
  | 'custom-program-txs';

interface Props {
  address: string;
  transactionCategory?: TransactionCategory;
}

function TransfersTabComponent({ address, transactionCategory = 'account-transfers' }: Props) {
  return (
    <div className="w-full h-full flex flex-col">
      <TransfersTable
        key={`${address}-${transactionCategory}`}
        address={address}
        transactionCategory={transactionCategory}
      />
    </div>
  );
}

export default memo(TransfersTabComponent);
