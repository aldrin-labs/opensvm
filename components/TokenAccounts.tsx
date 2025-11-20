import type { AccountInfo } from '@solana/web3.js';
import { PublicKey } from '@solana/web3.js';
import { AccountLayout } from '@solana/spl-token';
import { getClientConnection as getConnection } from '@/lib/solana/solana-connection';
import { useEffect, useState } from 'react';

interface TokenAccount {
  mint: string;
  owner: string;
  amount: number;
  decimals: number;
}

interface TokenAccountsProps {
  accounts: Array<{
    pubkey: PublicKey;
    account: AccountInfo<Buffer>;
  }>;
}

export default function TokenAccounts({ accounts }: TokenAccountsProps) {
  const [tokenAccounts, setTokenAccounts] = useState<TokenAccount[]>([]);

  useEffect(() => {
    const parseAccounts = async () => {
      const connection = getConnection();
      const parsedAccounts = accounts.map((acc) => {
        const data = AccountLayout.decode(acc.account.data);
        return {
          mint: new PublicKey(data.mint).toString(),
          owner: new PublicKey(data.owner).toString(),
          amount: Number(data.amount),
          decimals: 0, // We'll fetch this separately
        };
      });

      // Fetch token metadata for each account
      const accountsWithMetadata = await Promise.all(
        parsedAccounts.map(async (account) => {
          try {
            const mintInfo = await connection.getParsedAccountInfo(new PublicKey(account.mint));
            const data = (mintInfo.value?.data as any)?.parsed?.info;
            return {
              ...account,
              decimals: data?.decimals || 0,
            };
          } catch (error) {
            console.error('Error fetching token metadata:', error);
            return account;
          }
        })
      );

      setTokenAccounts(accountsWithMetadata);
    };

    parseAccounts();
  }, [accounts]);

  if (!accounts.length) {
    return <div className="text-gray-400">No token accounts found</div>;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold">Token Accounts</h3>
      <div className="grid gap-4">
        {tokenAccounts.map((account, index) => (
          <div
            key={index}
            className="rounded-lg border border-gray-700 p-4"
          >
            <div className="mb-2">
              <span className="font-semibold">Token:</span>{' '}
              <span className="font-mono">{account.mint}</span>
            </div>
            <div className="mb-2">
              <span className="font-semibold">Balance:</span>{' '}
              {account.amount / Math.pow(10, account.decimals)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
