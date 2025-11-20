'use client';

import { useState } from 'react';
import { type BaseTransactionInfo, type AccountData } from '@/lib/solana/solana';
import TransactionTable from './TransactionTable';
import AccountOverview from './AccountOverview';

interface AddressViewProps {
  transactions: BaseTransactionInfo[];
  accountData: AccountData;
  address: string;
}

export default function AddressView({
  transactions: initialTransactions,
  accountData,
  address
}: AddressViewProps) {
  const [transactions] = useState(initialTransactions);
  const [loading] = useState(false);

  return (
    <div className="p-4 space-y-6">
      <AccountOverview
        address={address}
        solBalance={accountData.lamports / 1e9}
        tokenAccounts={accountData.tokenAccounts}
        isSystemProgram={accountData.isSystemProgram}
        parsedOwner={accountData.owner}
      />
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <TransactionTable
          transactions={transactions}
          isLoading={loading}
          hasMore={false}
          onLoadMore={() => {}}
        />
      </div>
    </div>
  );
}
