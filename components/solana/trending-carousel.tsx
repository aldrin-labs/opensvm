'use client';

import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, TrendingUp, Flame, Crown, Clock, ArrowUpRight } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { createBurnInstruction, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { TOKEN_MINTS, TOKEN_DECIMALS, TOKEN_MULTIPLIERS, MIN_BURN_AMOUNTS, MAX_BURN_AMOUNTS } from '@/lib/config/tokens';

interface TrendingValidator {
  voteAccount: string;
  name: string;
  commission: number;
  activatedStake: number;
  depositVolume24h: number;
  boostEndTime?: number;
  boostAmount?: number;
  trendingScore: number;
  trendingReason: 'volume' | 'boost';
  rank: number;
}

// Solana connection
const SOLANA_RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const connection = new Connection(SOLANA_RPC_URL);

interface TrendingCarouselProps {
  onValidatorClick?: (voteAccount: string) => void;
}

export function TrendingCarousel({ onValidatorClick }: TrendingCarouselProps) {
  const { publicKey, sendTransaction, connected } = useWallet();
  const [trendingValidators, setTrendingValidators] = useState<TrendingValidator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showBoostModal, setShowBoostModal] = useState(false);
  const [selectedValidator, setSelectedValidator] = useState<TrendingValidator | null>(null);
  const [burnAmount, setBurnAmount] = useState<number>(MIN_BURN_AMOUNTS.SVMAI);
  const [isProcessingBurn, setIsProcessingBurn] = useState(false);
  const [userSvmaiBalance, setUserSvmaiBalance] = useState<number>(0);
  const [modalError, setModalError] = useState<string>('');
  const [modalSuccess, setModalSuccess] = useState<string>('');

  const itemsPerView = 3; // Show 3 trending validators at once

  // Fetch user's SVMAI token balance
  const fetchSvmaiBalance = async () => {
    if (!publicKey || !connected) {
      setUserSvmaiBalance(0);
      return;
    }

    try {
      const tokenAccount = await getAssociatedTokenAddress(
        TOKEN_MINTS.SVMAI,
        publicKey
      );
      
      const accountInfo = await connection.getTokenAccountBalance(tokenAccount);
      if (accountInfo.value) {
        // Use precise multiplier instead of Math.pow
        setUserSvmaiBalance(Number(accountInfo.value.amount) / TOKEN_MULTIPLIERS.SVMAI);
      } else {
        setUserSvmaiBalance(0);
      }
    } catch (error: any) {
      // Check if error is due to missing token account
      if (error.message?.includes('could not find account') || 
          error.message?.includes('Invalid param') ||
          error.code === -32602) {
        // User doesn't have a token account for SVMAI
        console.log('User does not have SVMAI token account');
        setUserSvmaiBalance(0);
      } else {
        console.error('Error fetching SVMAI balance:', error);
        setUserSvmaiBalance(0);
      }
    }
  };

  // Create burn transaction for SVMAI tokens
  const createBurnTransaction = async (amount: number): Promise<Transaction> => {
    if (!publicKey) throw new Error('Wallet not connected');

    const tokenAccount = await getAssociatedTokenAddress(
      TOKEN_MINTS.SVMAI,
      publicKey
    );

    // Check if token account exists
    const tokenAccountInfo = await connection.getAccountInfo(tokenAccount);
    
    const transaction = new Transaction();
    
    // Create token account if it doesn't exist
    if (!tokenAccountInfo) {
      const createATAInstruction = createAssociatedTokenAccountInstruction(
        publicKey, // payer
        tokenAccount, // ata
        publicKey, // owner
        TOKEN_MINTS.SVMAI // mint
      );
      transaction.add(createATAInstruction);
    }

    // Use BigInt with proper precision for decimal amounts
    const burnAmountLamports = BigInt(Math.round(amount * TOKEN_MULTIPLIERS.SVMAI));
    
    const burnInstruction = createBurnInstruction(
      tokenAccount,
      TOKEN_MINTS.SVMAI,
      publicKey,
      burnAmountLamports
    );

    transaction.add(burnInstruction);
    
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = publicKey;

    return transaction;
  };

  const fetchTrendingValidators = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/analytics/trending-validators');
      const result = await response.json();
      
      if (result.success) {
        setTrendingValidators(result.data);
        setError(null);
      } else {
        setError(result.error || 'Failed to fetch trending validators');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrendingValidators();
    fetchSvmaiBalance();
    // Refresh every 2 minutes with error handling
    const interval = setInterval(async () => {
      try {
        await fetchTrendingValidators();
        if (connected && publicKey) {
          await fetchSvmaiBalance();
        }
      } catch (error) {
        console.error('Error in refresh interval:', error);
        // Don't clear interval on error, just log it
      }
    }, 120000);
    return () => clearInterval(interval);
  }, [publicKey, connected]);

  const formatSOL = (lamports: number) => {
    const sol = lamports / 1e9;
    if (sol >= 1e6) return `${(sol / 1e6).toFixed(2)}M SOL`;
    if (sol >= 1e3) return `${(sol / 1e3).toFixed(2)}K SOL`;
    return `${sol.toFixed(2)} SOL`;
  };

  const formatTimeRemaining = (endTime: number) => {
    const remaining = endTime - Date.now();
    if (remaining <= 0) return 'Expired';
    
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const nextSlide = () => {
    setCurrentIndex((prev) => 
      prev + itemsPerView >= trendingValidators.length ? 0 : prev + 1
    );
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => 
      prev === 0 ? Math.max(0, trendingValidators.length - itemsPerView) : prev - 1
    );
  };

  const handleBoostPurchase = async () => {
    setModalError('');
    setModalSuccess('');

    if (!selectedValidator || !publicKey || !connected) {
      setModalError('Please connect your wallet first');
      return;
    }

    if (burnAmount < MIN_BURN_AMOUNTS.SVMAI) {
      setModalError(`Minimum burn amount is ${MIN_BURN_AMOUNTS.SVMAI} $SVMAI`);
      return;
    }

    if (burnAmount > userSvmaiBalance) {
      setModalError(`Insufficient $SVMAI balance. You have ${userSvmaiBalance.toFixed(2)} $SVMAI`);
      return;
    }

    if (burnAmount > MAX_BURN_AMOUNTS.SVMAI) {
      setModalError(`Maximum burn amount is ${MAX_BURN_AMOUNTS.SVMAI.toLocaleString()} $SVMAI`);
      return;
    }

    // Check SOL balance for token account creation if needed
    const solBalance = await connection.getBalance(publicKey);
    const rentExemption = await connection.getMinimumBalanceForRentExemption(165); // ATA size
    if (solBalance < rentExemption) {
      setModalError(`Insufficient SOL for transaction fees. Need at least ${(rentExemption / 1e9).toFixed(4)} SOL`);
      return;
    }

    setIsProcessingBurn(true);

    try {
      // Create burn transaction
      const burnTransaction = await createBurnTransaction(burnAmount);
      
      // Send transaction through Phantom wallet
      const signature = await sendTransaction(burnTransaction, connection);
      
      // Wait for confirmation
      await connection.confirmTransaction(signature, 'confirmed');
      
      // Submit boost to backend with burn proof
      const response = await fetch('/api/analytics/trending-validators', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          voteAccount: selectedValidator.voteAccount,
          burnAmount: burnAmount,
          burnSignature: signature,
          burnerWallet: publicKey.toString()
        })
      });

      const result = await response.json();
      
      if (result.success) {
        setShowBoostModal(false);
        setSelectedValidator(null);
        setBurnAmount(MIN_BURN_AMOUNTS.SVMAI);
        // Refresh data
        fetchTrendingValidators();
        fetchSvmaiBalance();
        setModalSuccess(`🔥 Successfully burned ${burnAmount} $SVMAI! Boost activated for 24 hours.`);
        
        // Close modal after delay
        setTimeout(() => {
          setShowBoostModal(false);
          setModalSuccess('');
        }, 2000);
              } else {
          setModalError(`Error: ${result.error}`);
        }
          } catch (err) {
        console.error('Burn transaction failed:', err);
        setModalError(`Transaction failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      } finally {
        setIsProcessingBurn(false);
      }
  };

  if (loading) {
    return (
      <div className="bg-accent/10 border border-border rounded-lg p-6">
        <div className="flex items-center justify-center h-32">
          <div className="animate-pulse flex items-center">
            <Flame className="h-6 w-6 text-accent mr-2" />
            <span className="text-lg font-medium">Loading trending validators...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error || trendingValidators.length === 0) {
    return (
              <div className="bg-accent/10 border border-border rounded-lg p-6">
        <div className="flex items-center justify-center h-32">
          <div className="text-center">
            <Flame className="h-6 w-6 text-accent mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              {error || 'No trending validators available'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const visibleValidators = trendingValidators.slice(currentIndex, currentIndex + itemsPerView);

  return (
    <>
              <div className="bg-accent/10 border border-border rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <Flame className="h-6 w-6 text-accent mr-2" />
            <h3 className="text-lg font-semibold">Trending Validators</h3>
                          <TrendingUp className="h-4 w-4 text-accent ml-2" />
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={prevSlide}
              disabled={currentIndex === 0}
              className="p-2 rounded-full bg-background border hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="Previous trending validators"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={nextSlide}
              disabled={currentIndex + itemsPerView >= trendingValidators.length}
              className="p-2 rounded-full bg-background border hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="Next trending validators"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {visibleValidators.map((validator) => (
            <div
              key={validator.voteAccount}
              className="bg-background border rounded-lg p-4 hover:shadow-lg transition-all duration-200 cursor-pointer group"
              onClick={() => onValidatorClick?.(validator.voteAccount)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center">
                  <div className="flex items-center justify-center w-8 h-8 bg-accent rounded-full text-accent-foreground text-sm font-semibold mr-3">
                    #{validator.rank}
                  </div>
                  <div>
                    <h4 className="font-medium text-sm group-hover:text-primary transition-colors">
                      {validator.name || 'Unknown Validator'}
                    </h4>
                    <p className="text-xs text-muted-foreground truncate w-32">
                      {validator.voteAccount}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center">
                  {validator.trendingReason === 'boost' && validator.boostEndTime && (
                    <div className="flex items-center text-xs text-accent">
                      <Crown className="h-3 w-3 mr-1" />
                      <span>{formatTimeRemaining(validator.boostEndTime)}</span>
                    </div>
                  )}
                  {validator.trendingReason === 'volume' && (
                                          <div className="flex items-center text-xs text-primary">
                      <TrendingUp className="h-3 w-3 mr-1" />
                      <span>Volume</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Stake:</span>
                  <span className="font-medium">{formatSOL(validator.activatedStake)}</span>
                </div>
                
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">24h Deposits:</span>
                  <span className="font-medium text-primary">
                    {formatSOL(validator.depositVolume24h * 1e9)}
                  </span>
                </div>
                
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Commission:</span>
                  <span className="font-medium">{validator.commission}%</span>
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Trending Score:</span>
                  <span className="font-semibold text-accent">
                    {validator.trendingScore.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t">
                                 <button
                                     onClick={(e) => {
                    e.stopPropagation();
                    setSelectedValidator(validator);
                    setModalError('');
                    setModalSuccess('');
                    setShowBoostModal(true);
                  }}
                   className="w-full bg-accent hover:bg-accent/90 text-accent-foreground text-xs font-medium py-2 px-3 rounded-md transition-all duration-200 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-ring"
                 >
                   <Flame className="h-3 w-3 mr-1" />
                   Burn $SVMAI
                 </button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-center mt-4">
          <div className="flex space-x-1">
            {Array.from({ length: Math.ceil(trendingValidators.length / itemsPerView) }).map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index * itemsPerView)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  Math.floor(currentIndex / itemsPerView) === index
                    ? 'bg-accent'
                    : 'bg-muted-foreground/30'
                }`}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Boost Purchase Modal */}
      {showBoostModal && selectedValidator && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background border rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <Flame className="h-5 w-5 text-accent mr-2" />
                <h3 className="text-lg font-semibold">Burn $SVMAI for Boost</h3>
              </div>
              <button
                onClick={() => setShowBoostModal(false)}
                className="text-muted-foreground hover:text-foreground"
                disabled={isProcessingBurn}
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-2">Validator:</p>
                <p className="font-medium">{selectedValidator.name || 'Unknown Validator'}</p>
                <p className="text-xs text-muted-foreground truncate">{selectedValidator.voteAccount}</p>
              </div>

              {!connected && (
                <div className="bg-accent/10 border border-border rounded-md p-3">
                  <p className="text-sm text-accent-foreground">
                    Please connect your Phantom wallet to burn $SVMAI tokens.
                  </p>
                </div>
              )}

              {connected && (
                <div className="bg-muted/50 p-3 rounded-md">
                  <p className="text-sm">
                    <strong>Your $SVMAI Balance:</strong> {userSvmaiBalance.toFixed(2)} $SVMAI
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Connected wallet: {publicKey?.toString().slice(0, 8)}...{publicKey?.toString().slice(-8)}
                  </p>
                </div>
              )}

              <div>
                <label className="text-sm font-medium mb-2 block">Burn Amount ($SVMAI)</label>
                <input
                  type="number"
                  min={MIN_BURN_AMOUNTS.SVMAI}
                  max={Math.min(userSvmaiBalance, MAX_BURN_AMOUNTS.SVMAI)}
                  value={burnAmount}
                  onChange={(e) => setBurnAmount(Number(e.target.value))}
                  className="w-full p-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  disabled={!connected || isProcessingBurn}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Minimum: {MIN_BURN_AMOUNTS.SVMAI} $SVMAI | Maximum: {MAX_BURN_AMOUNTS.SVMAI.toLocaleString()} $SVMAI per boost
                </p>
                <p className="text-xs text-accent mt-1">
                  💡 Want to boost more? You can boost multiple times to increase your total!
                </p>
              </div>

              <div className="bg-gradient-to-r bg-accent/10 border border-border rounded-md p-3">
                <div className="flex items-start space-x-2">
                  <Flame className="h-4 w-4 text-accent mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Burn {burnAmount.toLocaleString()} $SVMAI</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      • Boost lasts 24 hours or until someone adds more
                      • Anyone can add to your boost (amounts stack up)
                      • Timer resets to 24h when someone adds to the boost
                      • Tokens will be permanently burned (destroyed)
                    </p>
                  </div>
                </div>
              </div>

              {/* Error/Success Messages */}
              {modalError && (
                <div className="p-3 bg-destructive/10 border border-destructive rounded-md text-destructive text-sm">
                  {modalError}
                </div>
              )}
              {modalSuccess && (
                <div className="p-3 bg-primary/10 border border-primary rounded-md text-primary text-sm">
                  {modalSuccess}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setShowBoostModal(false)}
                  className="flex-1 py-2 px-4 border rounded-md hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
                  disabled={isProcessingBurn}
                >
                  Cancel
                </button>
                <button
                  onClick={handleBoostPurchase}
                                      className="flex-1 py-2 px-4 bg-accent hover:bg-accent/90 text-accent-foreground rounded-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!connected || isProcessingBurn || burnAmount < MIN_BURN_AMOUNTS.SVMAI || burnAmount > userSvmaiBalance || burnAmount > MAX_BURN_AMOUNTS.SVMAI}
                >
                  {isProcessingBurn ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Burning...
                    </div>
                  ) : (
                    <div className="flex items-center justify-center">
                      <Flame className="h-4 w-4 mr-2" />
                      Burn $SVMAI
                    </div>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}