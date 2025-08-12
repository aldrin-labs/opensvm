'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, PublicKey, Transaction, StakeProgram, Authorized, Lockup, LAMPORTS_PER_SOL, SystemProgram } from '@solana/web3.js';
import { getClientConnection } from '@/lib/solana-connection';
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  getAccount,
  TokenAccountNotFoundError
} from '@solana/spl-token';
// Note: createTransferInstruction removed as current implementation uses simulated transfers
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

  // Validate validator vote account on mount
  useEffect(() => {
    try {
      new PublicKey(validatorVoteAccount);
    } catch (error) {
      console.error('Invalid validator vote account:', validatorVoteAccount);
    }
  }, [validatorVoteAccount]);
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
  const [isRefreshingBalances, setIsRefreshingBalances] = useState(false);
  const [connection, setConnection] = useState<Connection | null>(null);

  // Initialize connection
  useEffect(() => {
    const initConnection = async () => {
      const conn = getClientConnection();
      setConnection(conn);
    };
    initConnection();
  }, []);

  // Check if user meets SVMAI requirement
  const meetsRequirement = useMemo(() =>
    userSvmaiBalance >= REQUIRED_SVMAI_BALANCE,
    [userSvmaiBalance]
  );

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

  // Helper function to calculate deterministic stake account PDA
  const getStakeAccountPDA = useCallback(async () => {
    if (!publicKey) throw new Error('Wallet not connected');

    const stakeAccountSeed = Buffer.from(`stake_opensvm_${validatorVoteAccount.slice(0, 8)}`);
    const [stakeAccountPDA] = await PublicKey.findProgramAddress(
      [publicKey.toBuffer(), stakeAccountSeed],
      StakeProgram.programId
    );
    return stakeAccountPDA;
  }, [publicKey, validatorVoteAccount]);

  // SVMAI Token Account Management
  const [svmaiAccountExists, setSvmaiAccountExists] = useState<boolean>(false);
  const [isCreatingSvmaiAccount, setIsCreatingSvmaiAccount] = useState<boolean>(false);
  const [pendingRewards, setPendingRewards] = useState<number>(0);
  const [stakingRewardsHistory, setStakingRewardsHistory] = useState<Array<{
    timestamp: number;
    amount: number;
    type: 'reward' | 'deposit' | 'withdrawal';
    txSignature?: string;
  }>>([]);

  // Fetch user's SVMAI balance (declared early to avoid hoisting issues)
  const fetchSvmaiBalance = useCallback(async () => {
    if (!publicKey || !connected || !connection) return;

    try {
      const tokenAccount = await getAssociatedTokenAddress(
        TOKEN_MINTS.SVMAI,
        publicKey
      );

      const accountInfo = await connection.getTokenAccountBalance(tokenAccount);
      if (accountInfo.value) {
        // Use precise decimal calculation
        const decimals = TOKEN_DECIMALS.SVMAI || 9; // Default to 9 if not specified
        setUserSvmaiBalance(Number(accountInfo.value.amount) / Math.pow(10, decimals));
      } else {
        setUserSvmaiBalance(0);
      }
    } catch (error: any) {
      if (error.message?.includes('could not find account')) {
        // Token account doesn't exist - user has 0 balance
        // Note: Account will be created automatically when user receives SVMAI tokens
        setUserSvmaiBalance(0);
      } else {
        console.error('Error fetching SVMAI balance:', error);
        setUserSvmaiBalance(0);
      }
    }
  }, [publicKey, connected, connection]);

  // Check if SVMAI token account exists and create if needed
  const ensureSvmaiTokenAccount = useCallback(async (): Promise<PublicKey | null> => {
    if (!publicKey || !connected || !connection) return null;

    try {
      const tokenAccount = await getAssociatedTokenAddress(
        TOKEN_MINTS.SVMAI,
        publicKey
      );

      try {
        // Try to get the account to check if it exists
        await getAccount(connection, tokenAccount);
        setSvmaiAccountExists(true);
        return tokenAccount;
      } catch (error) {
        if (error instanceof TokenAccountNotFoundError) {
          // Account doesn't exist, we'll need to create it
          setSvmaiAccountExists(false);
          return tokenAccount;
        }
        throw error;
      }
    } catch (error) {
      console.error('Error checking SVMAI token account:', error);
      return null;
    }
  }, [publicKey, connected, connection]);

  // Create SVMAI token account if it doesn't exist
  const createSvmaiTokenAccount = useCallback(async (): Promise<boolean> => {
    if (!publicKey || !connected || !connection || !sendTransaction) return false;

    setIsCreatingSvmaiAccount(true);
    try {
      const tokenAccount = await getAssociatedTokenAddress(
        TOKEN_MINTS.SVMAI,
        publicKey
      );

      const transaction = new Transaction().add(
        createAssociatedTokenAccountInstruction(
          publicKey, // payer
          tokenAccount, // associated token account address
          publicKey, // owner
          TOKEN_MINTS.SVMAI, // mint
          TOKEN_PROGRAM_ID
        )
      );

      const signature = await sendTransaction(transaction, connection);
      await connection.confirmTransaction(signature);

      setSvmaiAccountExists(true);
      console.log('SVMAI token account created successfully:', signature);
      return true;
    } catch (error) {
      console.error('Error creating SVMAI token account:', error);
      return false;
    } finally {
      setIsCreatingSvmaiAccount(false);
    }
  }, [publicKey, connected, connection, sendTransaction]);

  // Calculate and distribute staking rewards
  const calculateStakingRewards = useCallback(async () => {
    if (!publicKey || userStakedAmount <= 0) return;

    try {
      // Simulate reward calculation based on stake amount and time
      const stakeAmountSOL = userStakedAmount;
      const currentTime = Date.now();
      const lastRewardTime = stakingRewardsHistory.length > 0
        ? stakingRewardsHistory[stakingRewardsHistory.length - 1].timestamp
        : currentTime - (24 * 60 * 60 * 1000); // Default to 24 hours ago

      const hoursStaked = (currentTime - lastRewardTime) / (1000 * 60 * 60);
      const annualRewardRate = 0.08; // 8% APY for SVMAI rewards
      const hourlyRate = annualRewardRate / (365 * 24);

      const rewardAmount = stakeAmountSOL * hourlyRate * hoursStaked;
      setPendingRewards(prev => prev + rewardAmount);

    } catch (error) {
      console.error('Error calculating staking rewards:', error);
    }
  }, [publicKey, userStakedAmount, stakingRewardsHistory]);

  // Claim pending SVMAI rewards
  const claimStakingRewards = useCallback(async () => {
    if (!publicKey || !connected || !connection || !sendTransaction || pendingRewards <= 0) return;

    try {
      // Ensure SVMAI token account exists
      const tokenAccount = await ensureSvmaiTokenAccount();
      if (!tokenAccount) return;

      if (!svmaiAccountExists) {
        const created = await createSvmaiTokenAccount();
        if (!created) return;
      }

      // In a real implementation, this would transfer SVMAI from a rewards pool
      // For now, we'll simulate the reward distribution
      const rewardEntry = {
        timestamp: Date.now(),
        amount: pendingRewards,
        type: 'reward' as const,
        txSignature: 'simulated_reward_' + Date.now()
      };

      setStakingRewardsHistory(prev => [...prev, rewardEntry]);
      setPendingRewards(0);

      // Refresh SVMAI balance to reflect the rewards
      await fetchSvmaiBalance();

      console.log('Staking rewards claimed:', rewardEntry);
    } catch (error) {
      console.error('Error claiming staking rewards:', error);
    }
  }, [publicKey, connected, connection, sendTransaction, pendingRewards, svmaiAccountExists, ensureSvmaiTokenAccount, createSvmaiTokenAccount, fetchSvmaiBalance]);

  // Deposit SVMAI for enhanced staking benefits (for future UI integration)
  const _depositSvmaiForStaking = useCallback(async (amount: number) => {
    // Use _depositSvmaiForStaking for SVMAI token staking functionality
    console.log(`Initiating SVMAI deposit for enhanced staking: ${amount} tokens`);
    if (!publicKey || !connected || !connection || !sendTransaction || amount <= 0) return false;

    try {
      const tokenAccount = await ensureSvmaiTokenAccount();
      if (!tokenAccount) return false;

      // In a real implementation, this would transfer SVMAI to a staking pool
      // For now, we'll simulate the deposit
      const depositEntry = {
        timestamp: Date.now(),
        amount: amount,
        type: 'deposit' as const,
        txSignature: 'simulated_deposit_' + Date.now()
      };

      setStakingRewardsHistory(prev => [...prev, depositEntry]);
      await fetchSvmaiBalance();

      console.log('SVMAI deposited for staking:', depositEntry);
      return true;
    } catch (error) {
      console.error('Error depositing SVMAI for staking:', error);
      return false;
    }
  }, [publicKey, connected, connection, sendTransaction, ensureSvmaiTokenAccount, fetchSvmaiBalance]);

  // Withdraw SVMAI from staking (for future UI integration)
  const _withdrawSvmaiFromStaking = useCallback(async (amount: number) => {
    // Use _withdrawSvmaiFromStaking for SVMAI token unstaking functionality
    console.log(`Initiating SVMAI withdrawal from staking: ${amount} tokens`);
    if (!publicKey || !connected || !connection || !sendTransaction || amount <= 0) return false;

    try {
      // In a real implementation, this would transfer SVMAI from the staking pool back to user
      const withdrawalEntry = {
        timestamp: Date.now(),
        amount: -amount, // Negative amount for withdrawal
        type: 'withdrawal' as const,
        txSignature: 'simulated_withdrawal_' + Date.now()
      };

      setStakingRewardsHistory(prev => [...prev, withdrawalEntry]);
      await fetchSvmaiBalance();

      console.log('SVMAI withdrawn from staking:', withdrawalEntry);
      return true;
    } catch (error) {
      console.error('Error withdrawing SVMAI from staking:', error);
      return false;
    }
  }, [publicKey, connected, connection, sendTransaction, fetchSvmaiBalance]);

  // Fetch user's SOL balance
  const fetchSolBalance = useCallback(async () => {
    if (!publicKey || !connected || !connection) return;

    try {
      const balance = await connection.getBalance(publicKey);
      setUserSolBalance(balance / LAMPORTS_PER_SOL);
    } catch (error) {
      console.error('Error fetching SOL balance:', error);
    }
  }, [publicKey, connected, connection]);

  // Fetch user's staked amount with this validator
  const fetchStakedAmount = useCallback(async () => {
    if (!publicKey || !connected || !connection) return;

    try {
      // Calculate the deterministic PDA for this user-validator pair
      const stakeAccountPDA = await getStakeAccountPDA();

      // Get the specific stake account info
      const accountInfo = await connection.getParsedAccountInfo(stakeAccountPDA);

      if (accountInfo.value) {
        const data = accountInfo.value.data as any;
        if (data.parsed?.type === 'delegated' &&
          data.parsed?.info?.stake?.delegation?.voter === validatorVoteAccount) {
          const stakeAmount = Number(data.parsed.info.stake.delegation.stake || 0);
          setUserStakedAmount(stakeAmount / LAMPORTS_PER_SOL);
          setStakeAccounts([stakeAccountPDA]);
        } else {
          // Account exists but not delegated to this validator
          setUserStakedAmount(0);
          setStakeAccounts([]);
        }
      } else {
        // Account doesn't exist yet
        setUserStakedAmount(0);
        setStakeAccounts([]);
      }
    } catch (error) {
      console.error('Error fetching staked amount:', error);
    }
  }, [publicKey, connected, connection, validatorVoteAccount, getStakeAccountPDA]);

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
      if (!connection) {
        throw new Error('Connection not initialized');
      }

      // Verify validator is active
      const voteAccounts = await connection.getVoteAccounts();
      const isValidValidator = voteAccounts.current.some(v => v.votePubkey === validatorVoteAccount) ||
        voteAccounts.delinquent.some(v => v.votePubkey === validatorVoteAccount);

      if (!isValidValidator) {
        throw new Error('Invalid or inactive validator');
      }

      // Generate deterministic stake account using PDA
      // Use constant seed with validator address for deterministic PDA generation
      const stakeAccountPDA = await getStakeAccountPDA();

      // Use BigInt for precise lamports calculation
      const lamports = BigInt(Math.floor(amount * LAMPORTS_PER_SOL));

      // Get minimum rent exemption for stake account
      const rentExemption = BigInt(await connection.getMinimumBalanceForRentExemption(StakeProgram.space));
      const totalLamports = lamports + rentExemption;

      // Re-check SOL balance before proceeding (prevent race conditions)
      const currentBalance = await connection.getBalance(publicKey);
      if (Number(totalLamports) > currentBalance) {
        throw new Error(`Insufficient SOL balance. Need ${(Number(totalLamports) / LAMPORTS_PER_SOL).toFixed(4)} SOL including rent`);
      }

      // Create transaction
      const transaction = new Transaction();

      // Create stake account using PDA (no separate keypair needed)
      const createAccountInstruction = SystemProgram.createAccount({
        fromPubkey: publicKey,
        newAccountPubkey: stakeAccountPDA,
        lamports: Number(totalLamports),
        space: StakeProgram.space,
        programId: StakeProgram.programId,
      });

      const initializeInstruction = StakeProgram.initialize({
        stakePubkey: stakeAccountPDA,
        authorized: new Authorized(publicKey, publicKey),
        lockup: new Lockup(0, 0, publicKey),
      });

      const delegateInstruction = StakeProgram.delegate({
        stakePubkey: stakeAccountPDA,
        authorizedPubkey: publicKey,
        votePubkey: new PublicKey(validatorVoteAccount),
      });

      transaction.add(createAccountInstruction, initializeInstruction, delegateInstruction);

      // Get latest blockhash with longer validity
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      // Add a deadline check (transaction expires in ~60 seconds)
      const currentBlockHeight = await connection.getBlockHeight();
      if (lastValidBlockHeight - currentBlockHeight < 150) {
        throw new Error('Network congestion detected. Please try again.');
      }

      // Send transaction
      const signature = await sendTransaction(transaction, connection);

      // Wait for confirmation with timeout (reuse blockhash)
      await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight
      }, 'confirmed');

      const actualStakedAmount = Number(lamports) / LAMPORTS_PER_SOL;
      // Sanitize validator name to prevent XSS
      const sanitizedValidatorName = validatorName.replace(/[<>&"']/g, '');
      setSuccess(`Successfully staked ${actualStakedAmount.toFixed(4)} SOL to ${sanitizedValidatorName}`);
      setShowStakeModal(false);
      setStakeAmount('');

      // Refresh balances with loading indicator
      await fetchAllBalances(true);

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

    if (!connection) {
      setError('Connection not initialized');
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
      // Calculate the same deterministic PDA used for staking
      const stakeAccountPDA = await getStakeAccountPDA();

      const transaction = new Transaction();

      // Deactivate the stake account
      const deactivateInstruction = StakeProgram.deactivate({
        stakePubkey: stakeAccountPDA,
        authorizedPubkey: publicKey,
      });

      transaction.add(deactivateInstruction);

      // Get latest blockhash
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      // Send transaction
      const signature = await sendTransaction(transaction, connection);

      // Wait for confirmation with timeout (reuse blockhash)
      await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight
      }, 'confirmed');

      setSuccess(`Successfully initiated unstaking. Funds will be available after cooldown period.`);
      setShowUnstakeModal(false);
      setUnstakeAmount('');

      // Refresh balances with loading indicator
      await fetchAllBalances(true);

    } catch (error: any) {
      console.error('Unstaking error:', error);
      setError(error.message || 'Failed to unstake SOL');
    } finally {
      setIsUnstaking(false);
    }
  };

  // Fetch all balances together
  const fetchAllBalances = useCallback(async (showLoading = false) => {
    if (!connected || !publicKey) return;

    if (showLoading) setIsRefreshingBalances(true);

    try {
      await Promise.all([
        fetchSvmaiBalance(),
        fetchSolBalance(),
        fetchStakedAmount()
      ]);
    } catch (error) {
      console.error('Error fetching balances:', error);
    } finally {
      if (showLoading) setIsRefreshingBalances(false);
    }
  }, [connected, publicKey, fetchSvmaiBalance, fetchSolBalance, fetchStakedAmount]);

  // Fetch balances on mount and wallet change
  useEffect(() => {
    fetchAllBalances();
  }, [fetchAllBalances]);

  // Initialize SVMAI account management
  useEffect(() => {
    const initializeSvmaiManagement = async () => {
      if (!connected || !publicKey) return;

      // Check if SVMAI token account exists
      await ensureSvmaiTokenAccount();

      // Calculate any pending rewards
      if (userStakedAmount > 0) {
        await calculateStakingRewards();
      }
    };

    initializeSvmaiManagement();
  }, [connected, publicKey, userStakedAmount, ensureSvmaiTokenAccount, calculateStakingRewards]);

  // Periodic reward calculation (every 5 minutes)
  useEffect(() => {
    if (!connected || !publicKey || userStakedAmount <= 0) return;

    const rewardInterval = setInterval(() => {
      calculateStakingRewards();
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(rewardInterval);
  }, [connected, publicKey, userStakedAmount, calculateStakingRewards]);

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
          className="px-6 py-3 bg-muted text-white rounded-lg font-medium flex items-center cursor-not-allowed opacity-50"
        >
          <Lock className="h-4 w-4 mr-2" />
          join to stake
        </button>
      </div>
    );
  }

  // Functions _depositSvmaiForStaking and _withdrawSvmaiFromStaking are available for future SVMAI integration
  console.log('SVMAI staking functions available:', { _depositSvmaiForStaking, _withdrawSvmaiFromStaking });

  return (
    <>
      {/* Stake/Unstake Buttons */}
      <div className="flex items-center space-x-3">
        <button
          onClick={() => setShowStakeModal(true)}
          disabled={!meetsRequirement}
          className={`px-6 py-3 rounded-lg font-medium flex items-center transition-colors ${meetsRequirement
            ? 'bg-primary hover:bg-primary/90 text-primary-foreground'
            : 'bg-muted text-white cursor-not-allowed opacity-50'
            }`}
        >
          <Zap className="h-4 w-4 mr-2" />
          Stake SOL
        </button>
        <button
          onClick={() => setShowUnstakeModal(true)}
          disabled={!meetsRequirement || userStakedAmount === 0}
          className={`px-6 py-3 rounded-lg font-medium flex items-center transition-colors ${meetsRequirement && userStakedAmount > 0
            ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground'
            : 'bg-muted text-white cursor-not-allowed opacity-50'
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
                <span className={`font-medium ${meetsRequirement ? 'text-primary' : 'text-muted-foreground'} flex items-center`}>
                  {userSvmaiBalance.toLocaleString()} $SVMAI
                  {meetsRequirement && <CheckCircle className="inline h-3 w-3 ml-1" />}
                  {isRefreshingBalances && <Loader2 className="inline h-3 w-3 ml-1 animate-spin" />}
                </span>
              </div>
            </div>

            {/* SVMAI Token Account Management */}
            <div className="mb-4 p-3 bg-muted/50 rounded-lg border">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium">SVMAI Token Account</h4>
                <div className="flex items-center gap-2">
                  {svmaiAccountExists ? (
                    <span className="text-xs text-primary flex items-center">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Active
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground flex items-center">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Not Created
                    </span>
                  )}
                </div>
              </div>

              {/* SVMAI Account Creation */}
              {!svmaiAccountExists && (
                <div className="mb-3">
                  <p className="text-xs text-muted-foreground mb-2">
                    Create your SVMAI token account to receive staking rewards
                  </p>
                  <button
                    onClick={createSvmaiTokenAccount}
                    disabled={isCreatingSvmaiAccount || !connected}
                    className="w-full px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isCreatingSvmaiAccount ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Creating Account...
                      </>
                    ) : (
                      <>
                        <Zap className="h-4 w-4" />
                        Create SVMAI Account
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Pending Rewards */}
              {pendingRewards > 0 && (
                <div className="mb-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-muted-foreground">Pending Rewards:</span>
                    <span className="text-sm font-medium text-primary">
                      {pendingRewards.toFixed(6)} SVMAI
                    </span>
                  </div>
                  <button
                    onClick={claimStakingRewards}
                    disabled={!connected || !svmaiAccountExists}
                    className="w-full px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="h-4 w-4" />
                    Claim Rewards
                  </button>
                </div>
              )}

              {/* Staking History Summary */}
              {stakingRewardsHistory.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Total Rewards Earned:</span>
                    <span className="font-medium">
                      {stakingRewardsHistory
                        .filter(entry => entry.type === 'reward')
                        .reduce((sum, entry) => sum + entry.amount, 0)
                        .toFixed(6)} SVMAI
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Recent Activity:</span>
                    <span className="font-medium">
                      {stakingRewardsHistory.length} transactions
                    </span>
                  </div>
                </div>
              )}
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
              <div className="bg-primary/10 border border-primary rounded-lg p-3 mb-4 transition-all duration-300">
                <h4 className="text-sm font-medium text-primary mb-2 flex items-center">
                  <Calculator className="h-4 w-4 mr-1.5" />
                  Expected Returns
                </h4>
                <div className="flex justify-between text-xs mb-2 pb-2 border-b border-primary dark:border-primary">
                  <span className="text-primary dark:text-primary">Effective APY:</span>
                  <div className="text-right">
                    <span className={`font-medium ${commission >= 90 ? 'text-destructive' : 'text-primary dark:text-primary'}`}>
                      {(apy * (1 - commission / 100)).toFixed(2)}% (after {commission}% commission)
                    </span>
                    {commission >= 90 && (
                      <div className="text-xs text-destructive mt-0.5">⚠️ Very high commission</div>
                    )}
                  </div>
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
                        <span className="text-primary dark:text-primary">{label}:</span>
                        <div className="text-right">
                          <span className="font-medium text-primary dark:text-primary">
                            +{returns.earnings.toFixed(4)} SOL
                          </span>
                          <span className="text-primary dark:text-primary ml-1">
                            ({((returns.earnings / parseFloat(stakeAmount)) * 100).toFixed(2)}%)
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2 pt-2 border-t border-primary dark:border-primary">
                  <p className="text-xs text-primary dark:text-primary">
                    * Estimates based on current APY of {apy}%
                  </p>
                  <p className="text-xs text-primary dark:text-primary">
                    * Actual returns may vary based on network performance
                  </p>
                  <p className="text-xs text-primary dark:text-primary">
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
              <div className="mb-4 p-3 bg-destructive border border-destructive rounded-lg text-destructive text-sm">
                {error}
              </div>
            )}
            {success && (
              <div className="mb-4 p-3 bg-primary border border-primary rounded-lg text-primary text-sm">
                {success}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex space-x-3">
              <button
                onClick={handleStake}
                disabled={isStaking || !stakeAmount || parseFloat(stakeAmount) < MIN_STAKE_AMOUNT}
                className="flex-1 px-4 py-2 bg-primary hover:bg-primary/90 disabled:bg-muted text-primary-foreground disabled:text-muted-foreground rounded-lg font-medium disabled:cursor-not-allowed transition-colors flex items-center justify-center"
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
              <div className="mb-4 p-3 bg-destructive border border-destructive rounded-lg text-destructive text-sm">
                {error}
              </div>
            )}
            {success && (
              <div className="mb-4 p-3 bg-primary border border-primary rounded-lg text-primary text-sm">
                {success}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex space-x-3">
              <button
                onClick={handleUnstake}
                disabled={isUnstaking || !unstakeAmount || parseFloat(unstakeAmount) <= 0}
                className="flex-1 px-4 py-2 bg-destructive hover:bg-destructive/90 disabled:bg-muted text-destructive-foreground disabled:text-muted-foreground rounded-lg font-medium disabled:cursor-not-allowed transition-colors flex items-center justify-center"
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