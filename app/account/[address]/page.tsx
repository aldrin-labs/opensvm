'use client';

import { getConnection } from '@/lib/solana-connection';
import { PublicKey } from '@solana/web3.js';
import { validateSolanaAddress, getAccountInfo as getSolanaAccountInfo } from '@/lib/solana';
import AccountInfo from '@/components/AccountInfo';
import AccountOverview from '@/components/AccountOverview';
import TransactionGraph from '@/components/TransactionGraph';
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
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading account information...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
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
      <div className="container mx-auto px-4 py-8">
        <div className="rounded-lg border border-red-500 bg-red-50 p-4">
          <h2 className="text-xl font-semibold text-red-700">Error</h2>
          <p className="text-red-600">Account not found</p>
          <p className="mt-2 text-sm text-red-500">Please provide a valid Solana address</p>
        </div>
      </div>
    );
  }

  return (
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
            {/* Main Content - Left Side */}
            <div className="xl:col-span-3 space-y-6">
              <AccountInfo
                address={accountInfo.address}
                isSystemProgram={accountInfo.isSystemProgram}
                parsedOwner={accountInfo.parsedOwner}
              />
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <AccountOverview
                  address={accountInfo.address}
                  solBalance={accountInfo.solBalance}
                  tokenAccounts={accountInfo.tokenAccounts}
                  isSystemProgram={accountInfo.isSystemProgram}
                  parsedOwner={accountInfo.parsedOwner}
                />
                
                {/* Transaction Graph Explorer */}
                <TransactionGraph address={accountInfo.address} />
              </div>

              <AccountTabs
                address={accountInfo.address}
                solBalance={accountInfo.solBalance}
                tokenBalances={accountInfo.tokenBalances}
                activeTab={activeTab as string}
              />
            </div>

            {/* Sidebar - Right Side */}
            <div className="xl:col-span-1 space-y-6">
              {/* Ad Banner 1 */}
              <div className="rounded-lg border bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-950 dark:to-indigo-900 p-4">
                <div className="text-center">
                  <h4 className="font-semibold text-sm mb-2">🚀 OpenSVM Premium</h4>
                  <p className="text-xs text-muted-foreground mb-3">Get advanced analytics, real-time alerts, and more!</p>
                  <button
                    className="w-full bg-primary text-primary-foreground text-xs py-2 px-3 rounded-md hover:bg-primary/90 transition-colors"
                    onClick={() => {
                      // Track ad interaction
                      import('@/lib/qdrant').then(({ storeAdInteraction }) => {
                        storeAdInteraction({
                          id: `ad-click-${Date.now()}-${Math.random()}`,
                          adId: 'opensvm-premium',
                          adType: 'sidebar-banner',
                          walletAddress: accountInfo.address,
                          action: 'click',
                          timestamp: Date.now(),
                          metadata: { campaign: 'premium-upgrade', position: 'sidebar-1' }
                        }).catch(console.error);
                      });
                      // Navigate to upgrade page
                      window.open('/upgrade', '_blank');
                    }}
                  >
                    Upgrade Now
                  </button>
                </div>
              </div>

              {/* Ad Banner 2 */}
              <div className="rounded-lg border bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-950 dark:to-emerald-900 p-4">
                <div className="text-center">
                  <h4 className="font-semibold text-sm mb-2">📊 Portfolio Tracker</h4>
                  <p className="text-xs text-muted-foreground mb-3">Track your Solana portfolio across all wallets</p>
                  <button
                    className="w-full bg-green-600 text-white text-xs py-2 px-3 rounded-md hover:bg-green-700 transition-colors"
                    onClick={() => {
                      // Track ad interaction
                      import('@/lib/qdrant').then(({ storeAdInteraction }) => {
                        storeAdInteraction({
                          id: `ad-click-${Date.now()}-${Math.random()}`,
                          adId: 'portfolio-tracker',
                          adType: 'sidebar-banner',
                          walletAddress: accountInfo.address,
                          action: 'click',
                          timestamp: Date.now(),
                          metadata: { campaign: 'portfolio-free-trial', position: 'sidebar-2' }
                        }).catch(console.error);
                      });
                      // Navigate to portfolio tracker
                      window.open('/portfolio', '_blank');
                    }}
                  >
                    Try Free
                  </button>
                </div>
              </div>

              {/* Ad Banner 3 */}
              <div className="rounded-lg border bg-gradient-to-br from-purple-50 to-violet-100 dark:from-purple-950 dark:to-violet-900 p-4">
                <div className="text-center">
                  <h4 className="font-semibold text-sm mb-2">⚡ DeFi Alerts</h4>
                  <p className="text-xs text-muted-foreground mb-3">Get notified of large transactions and yield opportunities</p>
                  <button
                    className="w-full bg-purple-600 text-white text-xs py-2 px-3 rounded-md hover:bg-purple-700 transition-colors"
                    onClick={() => {
                      // Track ad interaction
                      import('@/lib/qdrant').then(({ storeAdInteraction }) => {
                        storeAdInteraction({
                          id: `ad-click-${Date.now()}-${Math.random()}`,
                          adId: 'defi-alerts',
                          adType: 'sidebar-banner',
                          walletAddress: accountInfo.address,
                          action: 'click',
                          timestamp: Date.now(),
                          metadata: { campaign: 'alert-setup', position: 'sidebar-3' }
                        }).catch(console.error);
                      });
                      // Navigate to alerts setup
                      window.open('/alerts', '_blank');
                    }}
                  >
                    Setup Alerts
                  </button>
                </div>
              </div>

              {/* Ad Banner 4 */}
              <div className="rounded-lg border bg-gradient-to-br from-orange-50 to-red-100 dark:from-orange-950 dark:to-red-900 p-4">
                <div className="text-center">
                  <h4 className="font-semibold text-sm mb-2">🔥 Hot Tokens</h4>
                  <p className="text-xs text-muted-foreground mb-3">Discover trending tokens before they moon</p>
                  <button
                    className="w-full bg-orange-600 text-white text-xs py-2 px-3 rounded-md hover:bg-orange-700 transition-colors"
                    onClick={() => {
                      // Track ad interaction
                      import('@/lib/qdrant').then(({ storeAdInteraction }) => {
                        storeAdInteraction({
                          id: `ad-click-${Date.now()}-${Math.random()}`,
                          adId: 'hot-tokens',
                          adType: 'sidebar-banner',
                          walletAddress: accountInfo.address,
                          action: 'click',
                          timestamp: Date.now(),
                          metadata: { campaign: 'trending-discovery', position: 'sidebar-4' }
                        }).catch(console.error);
                      });
                      // Navigate to trending tokens
                      window.open('/trending', '_blank');
                    }}
                  >
                    View Trending
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
}
