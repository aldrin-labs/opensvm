import { getConnection } from '@/lib/solana-connection';
import { PublicKey } from '@solana/web3.js';
import { notFound } from 'next/navigation';
import { validateSolanaAddress, getAccountInfo as getSolanaAccountInfo } from '@/lib/solana';
import { isValidSolanaAddress } from '@/lib/utils';
import AccountInfo from '@/components/AccountInfo';
import AccountTabs from './tabs';

interface AccountData {
  address: string;
  isSystemProgram: boolean;
  parsedOwner: string;
  solBalance: number;
  tokenBalances: {
    mint: string;
    balance: number;
  }[];
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

    return {
      address,
      isSystemProgram: !accountInfo?.owner || accountInfo.owner.equals(PublicKey.default),
      parsedOwner: accountInfo?.owner?.toBase58() || PublicKey.default.toBase58(),
      solBalance: balance / 1e9,
      tokenBalances,
    };
  } catch (error) {
    console.error('Error fetching account info:', error);
    return {
      address,
      isSystemProgram: true,
      parsedOwner: PublicKey.default.toBase58(),
      solBalance: 0,
      tokenBalances: [],
    };
  }
}

interface PageProps {
  params: Promise<{ address: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function AccountPage({ params, searchParams }: PageProps) {
  const { address: rawAddress } = await params;
  const resolvedSearchParams = await searchParams;
  const { tab } = resolvedSearchParams;
  const activeTab = tab || 'tokens';
  
  // Basic validation
  if (!rawAddress) {
    notFound();
  }

  // Clean up the address
  let address = rawAddress;
  try {
    address = decodeURIComponent(rawAddress);
  } catch (e) {
    // Address was likely already decoded
  }
  address = address.trim();

  // Validate address format before proceeding
  if (!isValidSolanaAddress(address)) {
    notFound();
  }

  try {
    // Fetch account info
    const accountInfo = await getAccountData(address);

    return (
      <div className="container mx-auto px-4 py-8">
        <AccountInfo
          address={accountInfo.address}
          isSystemProgram={accountInfo.isSystemProgram}
          parsedOwner={accountInfo.parsedOwner}
        />
        <AccountTabs
          address={accountInfo.address}
          solBalance={accountInfo.solBalance}
          tokenBalances={accountInfo.tokenBalances}
          activeTab={activeTab as string}
        />
      </div>
    );
  } catch (error) {
    console.error('Error fetching account info:', error);
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="rounded-lg border border-red-500 bg-red-50 p-4">
          <h2 className="text-xl font-semibold text-red-700">Error</h2>
          <p className="text-red-600">Account not found or invalid address format</p>
          <p className="mt-2 text-sm text-red-500">Please check the address and try again</p>
        </div>
      </div>
    );
  }
}
