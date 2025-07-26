'use client';

import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, PublicKey, Transaction, StakeProgram, Authorized, Lockup, LAMPORTS_PER_SOL, SystemProgram, Keypair } from '@solana/web3.js';
import * as web3 from '@solana/web3.js';
import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { TOKEN_MINTS, TOKEN_DECIMALS } from '@/lib/config/tokens';
import { Zap, TrendingDown, Lock, AlertCircle, Loader2, CheckCircle, Calculator } from 'lucide-react';

interface ValidatorStakingProps {
  validatorVoteAccount: string;
  validatorName: string;
  commission?: number;
  apy?: number;
}

const REQUIRED_SVMAI_BALANCE = 100000; // 100k SVMAI requirement
const MIN_STAKE_AMOUNT = 0.1; // Minimum 0.1 SOL to stake

export function ValidatorStaking({ validatorVoteAccount, validatorName, commission = 0, apy = 7.5 }: ValidatorStakingProps) {
  const { publicKey, connected, sendTransaction } = useWallet();
  const [userSvmaiBalance, setUserSvmaiBalance] = useState<number>(0);
  const [userSolBalance, setUserSolBalance] = useState<number>(0);
  const [userStakedAmount, setUserStakedAmount] = useState<number>(0);
  const [stakeAmount, setStakeAmount] = useState<string>('');
  const [unstakeAmount, setUnstakeAmount] = useState<string>('');
  const [isStaking, setIsStaking] = useState(false);
  const [isUnstaking, setIsUnstaking] = useState(false);
  const [showStakeModal, setShowStakeModal] = useState(false);
  const [showUnstakeModal, setShowUnstakeModal] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [stakeAccounts, setStakeAccounts] = useState<PublicKey[]>([]);

  const connection = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com');

  // Check if user meets SVMAI requirement
  const meetsRequirement = userSvmaiBalance >= REQUIRED_SVMAI_BALANCE;

  // Calculate expected returns with compound interest
  const calculateExpectedReturns = (amount: number, days: number): { gross: number; net: number; earnings: number } => {
    if (!amount || amount <= 0) return { gross: 0, net: 0, earnings: 0 };
    
    // Convert APY to daily rate for compound interest
    const dailyRate = Math.pow(1 + apy / 100, 1 / 365) - 1;
    
    // Calculate gross returns with compound interest
    const grossReturns = amount * Math.pow(1 + dailyRate, days);
    const grossEarnings = grossReturns - amount;
    
    // Calculate commission
    const commissionAmount = grossEarnings * (commission / 100);
    
    // Calculate net returns (after commission)
    const netEarnings = grossEarnings - commissionAmount;
    const netReturns = amount + netEarnings;
    
    return {
      gross: grossReturns,
      net: netReturns,
      earnings: netEarnings
    };
  };

  // Fetch user's SVMAI balance
  const fetchSvmaiBalance = async () => {
    if (!publicKey || !connected) return;

    try {
      const tokenAccount = await getAssociatedTokenAddress(
        TOKEN_MINTS.SVMAI,
        publicKey
      );

      const accountInfo = await connection.getTokenAccountBalance(tokenAccount);
      if (accountInfo.value) {
        setUserSvmaiBalance(Number(accountInfo.value.amount) / Math.pow(10, TOKEN_DECIMALS.SVMAI));
      } else {
        setUserSvmaiBalance(0);
      }
    } catch (error: any) {
      if (error.message?.includes('could not find account')) {
        setUserSvmaiBalance(0);
      } else {
        console.error('Error fetching SVMAI balance:', error);
      }
    }
  };

  // Fetch user's SOL balance
  const fetchSolBalance = async () => {
    if (!publicKey || !connected) return;

    try {
      const balance = await connection.getBalance(publicKey);
      setUserSolBalance(balance / LAMPORTS_PER_SOL);
    } catch (error) {
      console.error('Error fetching SOL balance:', error);
    }
  };

  // Fetch user's staked amount with this validator
  const fetchStakedAmount = async () => {
    if (!publicKey || !connected) return;

    try {
      // Get all stake accounts for the user
      const stakeAccountInfos = await connection.getParsedProgramAccounts(
        StakeProgram.programId,
        {
          commitment: 'confirmed'
        }
      );

      let totalStaked = 0;
      const validatorStakeAccounts: PublicKey[] = [];

      // Filter accounts where user is the authorized staker
      for (const account of stakeAccountInfos) {
        const data = account.account.data as any;
        if (data.parsed?.type === 'delegated' && 
            data.parsed?.info?.meta?.authorized?.staker === publicKey.toBase58() &&
            data.parsed?.info?.stake?.delegation?.voter === validatorVoteAccount) {
          const stakeAmount = Number(data.parsed.info.stake.delegation.stake || 0);
          totalStaked += stakeAmount / LAMPORTS_PER_SOL;
          validatorStakeAccounts.push(account.pubkey);
        }
      }

      setUserStakedAmount(totalStaked);
      setStakeAccounts(validatorStakeAccounts);
    } catch (error) {
      console.error('Error fetching staked amount:', error);
    }
  };

  // Create stake account and delegate to validator
  const handleStake = async () => {
    if (!publicKey || !connected || !sendTransaction) {
      setError('Please connect your wallet');
      return;
    }

    if (!meetsRequirement) {
      setError(`You need at least ${REQUIRED_SVMAI_BALANCE.toLocaleString()} $SVMAI to stake`);
      return;
    }

    const amount = parseFloat(stakeAmount);
    if (isNaN(amount) || amount < MIN_STAKE_AMOUNT) {
      setError(`Minimum stake amount is ${MIN_STAKE_AMOUNT} SOL`);
      return;
    }

    if (amount > userSolBalance) {
      setError('Insufficient SOL balance');
      return;
    }

    setIsStaking(true);
    setError('');
    setSuccess('');

    try {
      // Verify validator is active
      const voteAccounts = await connection.getVoteAccounts();
      const isValidValidator = voteAccounts.current.some(v => v.votePubkey === validatorVoteAccount) ||
                              voteAccounts.delinquent.some(v => v.votePubkey === validatorVoteAccount);
      
      if (!isValidValidator) {
        throw new Error('Invalid or inactive validator');
      }

      // Create a new stake account keypair
      const stakeAccount = web3.Keypair.generate();

      const lamports = Math.floor(amount * LAMPORTS_PER_SOL);
      
      // Get minimum rent exemption for stake account
      const rentExemption = await connection.getMinimumBalanceForRentExemption(StakeProgram.space);
      const totalLamports = lamports + rentExemption;

      // Create transaction
      const transaction = new Transaction();

      // Create and initialize stake account with rent exemption
      const createAccountInstruction = SystemProgram.createAccount({
        fromPubkey: publicKey,
        newAccountPubkey: stakeAccount.publicKey,
        lamports: totalLamports,
        space: StakeProgram.space,
        programId: StakeProgram.programId,
      });

      const initializeInstruction = StakeProgram.initialize({
        stakePubkey: stakeAccount.publicKey,
        authorized: new Authorized(publicKey, publicKey),
        lockup: new Lockup(0, 0, publicKey),
      });

      const delegateInstruction = StakeProgram.delegate({
        stakePubkey: stakeAccount.publicKey,
        authorizedPubkey: publicKey,
        votePubkey: new PublicKey(validatorVoteAccount),
      });

      transaction.add(createAccountInstruction, initializeInstruction, delegateInstruction);
      
      // The stake account needs to sign the transaction
      transaction.partialSign(stakeAccount);

      // Get latest blockhash
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      // Send transaction
      const signature = await sendTransaction(transaction, connection);
      
      // Wait for confirmation with timeout
      const latestBlockhash = await connection.getLatestBlockhash();
      await connection.confirmTransaction({
        signature,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
      }, 'confirmed');

      const actualStakedAmount = lamports / LAMPORTS_PER_SOL;
      setSuccess(`Successfully staked ${actualStakedAmount.toFixed(4)} SOL to ${validatorName}`);
      setShowStakeModal(false);
      setStakeAmount('');

      // Refresh balances
      await Promise.all([fetchSolBalance(), fetchStakedAmount()]);

    } catch (error: any) {
      console.error('Staking error:', error);
      setError(error.message || 'Failed to stake SOL');
    } finally {
      setIsStaking(false);
    }
  };

  // Unstake (deactivate stake account)
  const handleUnstake = async () => {
    if (!publicKey || !connected || !sendTransaction) {
      setError('Please connect your wallet');
      return;
    }

    if (!meetsRequirement) {
      setError(`You need at least ${REQUIRED_SVMAI_BALANCE.toLocaleString()} $SVMAI to unstake`);
      return;
    }

    const amount = parseFloat(unstakeAmount);
    if (isNaN(amount) || amount <= 0) {
      setError('Invalid unstake amount');
      return;
    }

    if (amount > userStakedAmount) {
      setError('Cannot unstake more than staked amount');
      return;
    }

    setIsUnstaking(true);
    setError('');
    setSuccess('');

    try {
      // For simplicity, we'll deactivate the first stake account
      // In production, you'd want to let users select which account or handle partial unstaking
      if (stakeAccounts.length === 0) {
        throw new Error('No stake accounts found');
      }

      const transaction = new Transaction();

      // Deactivate the stake account
      const deactivateInstruction = StakeProgram.deactivate({
        stakePubkey: stakeAccounts[0],
        authorizedPubkey: publicKey,
      });

      transaction.add(deactivateInstruction);

      // Get latest blockhash
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      // Send transaction
      const signature = await sendTransaction(transaction, connection);
      
      // Wait for confirmation with timeout
      const latestBlockhash = await connection.getLatestBlockhash();
      await connection.confirmTransaction({
        signature,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
      }, 'confirmed');

      setSuccess(`Successfully initiated unstaking. Funds will be available after cooldown period.`);
      setShowUnstakeModal(false);
      setUnstakeAmount('');

      // Refresh staked amount
      await fetchStakedAmount();

    } catch (error: any) {
      console.error('Unstaking error:', error);
      setError(error.message || 'Failed to unstake SOL');
    } finally {
      setIsUnstaking(false);
    }
  };

  // Fetch all balances together
  const fetchAllBalances = async () => {
    if (!connected || !publicKey) return;
    
    try {
      await Promise.all([
        fetchSvmaiBalance(),
        fetchSolBalance(),
        fetchStakedAmount()
      ]);
    } catch (error) {
      console.error('Error fetching balances:', error);
    }
  };

  // Fetch balances on mount and wallet change
  useEffect(() => {
    fetchAllBalances();
  }, [connected, publicKey]);

  // Clear messages after 5 seconds
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError('');
        setSuccess('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  if (!connected) {
    return (
      <div className="flex items-center space-x-3">
        <button
          disabled
          className="px-6 py-3 bg-gray-400 text-white rounded-lg font-medium flex items-center cursor-not-allowed opacity-50"
        >
          <Lock className="h-4 w-4 mr-2" />
          Connect Wallet to Stake
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Stake/Unstake Buttons */}
      <div className="flex items-center space-x-3">
        <button
          onClick={() => setShowStakeModal(true)}
          disabled={!meetsRequirement}
          className={`px-6 py-3 rounded-lg font-medium flex items-center transition-colors ${
            meetsRequirement
              ? 'bg-green-600 hover:bg-green-700 text-white'
              : 'bg-gray-400 text-white cursor-not-allowed opacity-50'
          }`}
        >
          <Zap className="h-4 w-4 mr-2" />
          Stake SOL
        </button>
        <button
          onClick={() => setShowUnstakeModal(true)}
          disabled={!meetsRequirement || userStakedAmount === 0}
          className={`px-6 py-3 rounded-lg font-medium flex items-center transition-colors ${
            meetsRequirement && userStakedAmount > 0
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-gray-400 text-white cursor-not-allowed opacity-50'
          }`}
        >
          <TrendingDown className="h-4 w-4 mr-2" />
          Unstake
        </button>
      </div>

      {/* SVMAI Balance Indicator */}
      {!meetsRequirement && (
        <div className="mt-2 flex items-center text-sm text-amber-600">
          <AlertCircle className="h-4 w-4 mr-1" />
          <span>
            {userSvmaiBalance.toLocaleString()} / {REQUIRED_SVMAI_BALANCE.toLocaleString()} $SVMAI required
          </span>
        </div>
      )}

      {/* Stake Modal */}
      {showStakeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background border rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-semibold mb-4">Stake SOL to {validatorName}</h2>
            
            {/* Balance Info */}
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Available SOL:</span>
                <span className="font-medium">{userSolBalance.toFixed(4)} SOL</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Currently Staked:</span>
                <span className="font-medium">{userStakedAmount.toFixed(4)} SOL</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">$SVMAI Balance:</span>
                <span className={`font-medium ${meetsRequirement ? 'text-green-600' : 'text-amber-600'}`}>
                  {userSvmaiBalance.toLocaleString()} $SVMAI
                  {meetsRequirement && <CheckCircle className="inline h-3 w-3 ml-1" />}
                </span>
              </div>
            </div>

            {/* Stake Amount Input */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Amount to Stake</label>
              <div className="relative">
                <input
                  type="number"
                  value={stakeAmount}
                  onChange={(e) => setStakeAmount(e.target.value)}
                  placeholder="0.0"
                  step="0.1"
                  min={MIN_STAKE_AMOUNT}
                  max={userSolBalance}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <span className="absolute right-3 top-2.5 text-muted-foreground">SOL</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Minimum: {MIN_STAKE_AMOUNT} SOL
              </p>
            </div>

            {/* Expected Returns */}
            {stakeAmount && parseFloat(stakeAmount) > 0 && (
              <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-3 mb-4 transition-all duration-300">
                <h4 className="text-sm font-medium text-green-900 dark:text-green-100 mb-2 flex items-center">
                  <Calculator className="h-4 w-4 mr-1.5" />
                  Expected Returns
                </h4>
                <div className="flex justify-between text-xs mb-2 pb-2 border-b border-green-200 dark:border-green-800">
                  <span className="text-green-700 dark:text-green-300">Effective APY:</span>
                  <span className="font-medium text-green-900 dark:text-green-100">
                    {(apy * (1 - commission / 100)).toFixed(2)}% (after {commission}% commission)
                  </span>
                </div>
                <div className="space-y-1.5">
                  {[
                    { days: 7, label: '7 days' },
                    { days: 30, label: '30 days' },
                    { days: 90, label: '90 days' },
                    { days: 180, label: '180 days' },
                    { days: 365, label: '1 year' }
                  ].map(({ days, label }) => {
                    const returns = calculateExpectedReturns(parseFloat(stakeAmount), days);
                    return (
                      <div key={days} className="flex justify-between text-xs">
                        <span className="text-green-700 dark:text-green-300">{label}:</span>
                        <div className="text-right">
                          <span className="font-medium text-green-900 dark:text-green-100">
                            +{returns.earnings.toFixed(4)} SOL
                          </span>
                          <span className="text-green-600 dark:text-green-400 ml-1">
                            ({((returns.earnings / parseFloat(stakeAmount)) * 100).toFixed(2)}%)
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2 pt-2 border-t border-green-200 dark:border-green-800">
                  <p className="text-xs text-green-600 dark:text-green-400">
                    * Estimates based on current APY of {apy}%
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-400">
                    * Actual returns may vary based on network performance
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-400">
                    * Commission of {commission}% is deducted from rewards
                  </p>
                </div>
              </div>
            )}

            {/* Important Info */}
            <div className="bg-muted/50 rounded-lg p-3 mb-4">
              <h4 className="text-sm font-medium mb-1">Important:</h4>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Staked SOL will be locked until you unstake</li>
                <li>• Unstaking has a ~2-3 day cooldown period</li>
                <li>• You'll earn staking rewards based on validator performance</li>
                <li>• Commission: {commission}% fee on rewards</li>
              </ul>
            </div>

            {/* Error/Success Messages */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}
            {success && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
                {success}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex space-x-3">
              <button
                onClick={handleStake}
                disabled={isStaking || !stakeAmount || parseFloat(stakeAmount) < MIN_STAKE_AMOUNT}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg font-medium disabled:cursor-not-allowed transition-colors flex items-center justify-center"
              >
                {isStaking ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Staking...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-2" />
                    Confirm Stake
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setShowStakeModal(false);
                  setStakeAmount('');
                  setError('');
                }}
                disabled={isStaking}
                className="flex-1 px-4 py-2 border hover:bg-muted rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unstake Modal */}
      {showUnstakeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background border rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-semibold mb-4">Unstake SOL from {validatorName}</h2>
            
            {/* Balance Info */}
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Currently Staked:</span>
                <span className="font-medium">{userStakedAmount.toFixed(4)} SOL</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Stake Accounts:</span>
                <span className="font-medium">{stakeAccounts.length}</span>
              </div>
            </div>

            {/* Unstake Amount Input */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Amount to Unstake</label>
              <div className="relative">
                <input
                  type="number"
                  value={unstakeAmount}
                  onChange={(e) => setUnstakeAmount(e.target.value)}
                  placeholder="0.0"
                  step="0.1"
                  min="0"
                  max={userStakedAmount}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <span className="absolute right-3 top-2.5 text-muted-foreground">SOL</span>
              </div>
              <button
                onClick={() => setUnstakeAmount(userStakedAmount.toString())}
                className="text-xs text-primary hover:underline mt-1"
              >
                Unstake all
              </button>
            </div>

            {/* Warning */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
              <h4 className="text-sm font-medium text-amber-800 mb-1">⚠️ Unstaking Notice</h4>
              <ul className="text-xs text-amber-700 space-y-1">
                <li>• Unstaking initiates a cooldown period of ~2-3 days</li>
                <li>• During cooldown, your SOL won't earn rewards</li>
                <li>• After cooldown, you can withdraw your SOL</li>
                <li>• This action cannot be reversed</li>
              </ul>
            </div>

            {/* Error/Success Messages */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}
            {success && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
                {success}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex space-x-3">
              <button
                onClick={handleUnstake}
                disabled={isUnstaking || !unstakeAmount || parseFloat(unstakeAmount) <= 0}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded-lg font-medium disabled:cursor-not-allowed transition-colors flex items-center justify-center"
              >
                {isUnstaking ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Unstaking...
                  </>
                ) : (
                  <>
                    <TrendingDown className="h-4 w-4 mr-2" />
                    Confirm Unstake
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setShowUnstakeModal(false);
                  setUnstakeAmount('');
                  setError('');
                }}
                disabled={isUnstaking}
                className="flex-1 px-4 py-2 border hover:bg-muted rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}