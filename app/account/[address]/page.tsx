'use client';

import { getConnection } from '@/lib/solana-connection';
import { PublicKey } from '@solana/web3.js';
import { validateSolanaAddress, getAccountInfo as getSolanaAccountInfo } from '@/lib/solana';
import AccountInfo from '@/components/AccountInfo';
import AccountOverview from '@/components/AccountOverview';
import TransactionGraph from '@/components/transaction-graph/TransactionGraph';
import AccountTabs from './tabs';
import { useEffect, useState } from 'react';

interface AccountData {
  address: string;
  isSystemProgram: boolean;
  parsedOwner: string;
  solBalance: number;
  tokenBalances: {
    mint: string;
    balance: number;
  }[];
  tokenAccounts: any[]; // For AccountOverview component compatibility
}

async function getAccountData(address: string): Promise<AccountData> {
  const connection = await getConnection();

  try {
    const pubkey = validateSolanaAddress(address);
    const accountInfo = await getSolanaAccountInfo(address);
    const balance = await connection.getBalance(pubkey);
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(pubkey, {
      programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
    });

    const tokenBalances = tokenAccounts.value.map(account => ({
      mint: account.account.data.parsed.info.mint,
      balance: account.account.data.parsed.info.tokenAmount.uiAmount,
    }));

    // Convert token balances to token accounts format for AccountOverview
    const tokenAccountsForOverview = tokenAccounts.value.map(account => ({
      mint: account.account.data.parsed.info.mint,
      uiAmount: account.account.data.parsed.info.tokenAmount.uiAmount,
      symbol: 'UNK', // Default symbol - would be fetched from token registry in real app
    }));

    return {
      address,
      isSystemProgram: !accountInfo?.owner || accountInfo.owner.equals(PublicKey.default),
      parsedOwner: accountInfo?.owner?.toBase58() || PublicKey.default.toBase58(),
      solBalance: balance / 1e9,
      tokenBalances,
      tokenAccounts: tokenAccountsForOverview,
    };
  } catch (error) {
    console.error('Error fetching account info:', error);
    return {
      address,
      isSystemProgram: true,
      parsedOwner: PublicKey.default.toBase58(),
      solBalance: 0,
      tokenBalances: [],
      tokenAccounts: [],
    };
  }
}

interface PageProps {
  params: Promise<{ address: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default function AccountPage({ params, searchParams }: PageProps) {
  const [accountInfo, setAccountInfo] = useState<AccountData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('tokens');

  useEffect(() => {
    const initializeComponent = async () => {
      try {
        const { address: rawAddress } = await params;
        const resolvedSearchParams = await searchParams;
        const { tab } = resolvedSearchParams;

        setActiveTab(tab as string || 'tokens');

        // Basic validation
        if (!rawAddress) {
          throw new Error('Address is required');
        }

        // Clean up the address
        let cleanAddress = rawAddress;
        try {
          cleanAddress = decodeURIComponent(rawAddress);
        } catch (e) {
          // Address was likely already decoded
        }
        cleanAddress = cleanAddress.trim();

        // Basic format validation
        if (!/^[1-9A-HJ-NP-Za-km-z]+$/.test(cleanAddress)) {
          throw new Error('Invalid characters in address. Solana addresses can only contain base58 characters.');
        }

        if (cleanAddress.length < 32 || cleanAddress.length > 44) {
          throw new Error('Invalid address length. Solana addresses must be between 32 and 44 characters.');
        }


        // Fetch account info
        const accountData = await getAccountData(cleanAddress);
        setAccountInfo(accountData);

      } catch (err) {
        console.error('Error initializing account page:', err);
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    initializeComponent();
  }, [params, searchParams]);

  if (loading) {
    return (
      <div className="w-full px-4 py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading account information...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full px-4 py-8">
        <div className="rounded-lg border border-red-500 bg-red-50 p-4">
          <h2 className="text-xl font-semibold text-red-700">Error</h2>
          <p className="text-red-600">{error}</p>
          <p className="mt-2 text-sm text-red-500">Please check the address and try again</p>
        </div>
      </div>
    );
  }

  if (!accountInfo) {
    return (
      <div className="w-full px-4 py-8">
        <div className="rounded-lg border border-red-500 bg-red-50 p-4">
          <h2 className="text-xl font-semibold text-red-700">Error</h2>
          <p className="text-red-600">Account not found</p>
          <p className="mt-2 text-sm text-red-500">Please provide a valid Solana address</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-4 py-8">
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Main Content - Left Side */}
        <div className="xl:col-span-2 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AccountOverview
              address={accountInfo.address}
              solBalance={accountInfo.solBalance}
              tokenAccounts={accountInfo.tokenAccounts}
              isSystemProgram={accountInfo.isSystemProgram}
              parsedOwner={accountInfo.parsedOwner}
            />
            <TransactionGraph
              initialSignature=""
              onTransactionSelect={() => { }}
            />
          </div>
        </div>
        {/* Sidebar - Right Side: Account Info */}
        <div className="xl:col-span-2 space-y-6">
          <AccountInfo
            address={accountInfo.address}
            isSystemProgram={accountInfo.isSystemProgram}
            parsedOwner={accountInfo.parsedOwner}
          />
        </div>
      </div>
      {/* Full-width tabs and table */}
      <div className="mt-6 w-full">
        <AccountTabs
          address={accountInfo.address}
          solBalance={accountInfo.solBalance}
          tokenBalances={accountInfo.tokenBalances}
          activeTab={activeTab as string}
        />
      </div>
    </div>
  );
}
