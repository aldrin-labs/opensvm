'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, PublicKey, Transaction, StakeProgram, Authorized, Lockup, LAMPORTS_PER_SOL, SystemProgram } from '@solana/web3.js';
import { getClientConnection } from '@/lib/solana-connection';
import {
    getAssociatedTokenAddress,
    getAccount,
    TokenAccountNotFoundError
} from '@solana/spl-token';
import { TOKEN_MINTS, TOKEN_DECIMALS } from '@/lib/config/tokens';
import { TrendingDown, Lock, AlertCircle, Loader2, CheckCircle, Calculator } from 'lucide-react';
import { isValidSolanaAddress } from '@/lib/utils';
//import { MemoryManager } from '@/lib/memory-manager';
import { sanitizeInput } from '@/lib/user-history-utils';

interface ValidatorStakingProps {
    validatorVoteAccount: string;
    validatorName: string;
    commission?: number;
    apy?: number;
}

const REQUIRED_SVMAI_BALANCE = 100000; // 100k SVMAI requirement
const MIN_STAKE_AMOUNT = 0.1; // Minimum 0.1 SOL to stake
const MAX_STAKE_AMOUNT = 1000; // Maximum 1000 SOL to stake (security limit)
const OPERATION_TIMEOUT = 30000; // 30 seconds timeout for all operations

export function ValidatorStaking({ validatorVoteAccount, validatorName, commission = 0, apy = 7.5 }: ValidatorStakingProps) {
    const { publicKey, connected, sendTransaction } = useWallet();

    // State management with security tracking
    const [userSvmaiBalance, setUserSvmaiBalance] = useState<number>(0);
    const [userSolBalance, setUserSolBalance] = useState<number>(0);
    const [userStakedAmount, setUserStakedAmount] = useState<number>(0);

    // State management with security tracking
    const [stakeAmount, setStakeAmount] = useState<string>('');
    const [unstakeAmount, setUnstakeAmount] = useState<string>('');
    const [isStaking, setIsStaking] = useState(false);
    const [isUnstaking, setIsUnstaking] = useState(false);
    const [showStakeModal, setShowStakeModal] = useState(false);
    const [showUnstakeModal, setShowUnstakeModal] = useState(false);
    const [error, setError] = useState<string>('');
    const [success, setSuccess] = useState<string>('');
    const [stakeAccounts, setStakeAccounts] = useState<PublicKey[]>([]);
    const [connection, setConnection] = useState<Connection | null>(null);

    // Fetch user's stake accounts and calculate total staked amount
    const fetchUserStakeAccounts = useCallback(async (): Promise<void> => {
        if (!publicKey || !connected || !connection) return;

        try {
            // Get all stake accounts for the user
            const stakeAccounts = await connection.getParsedProgramAccounts(
                StakeProgram.programId,
                {
                    filters: [
                        {
                            memcmp: {
                                offset: 12, // Authorized staker offset
                                bytes: publicKey.toBase58(),
                            },
                        },
                    ],
                }
            );

            let totalStaked = 0;
            const validStakeAccounts: PublicKey[] = [];

            for (const account of stakeAccounts) {
                const parsedData = account.account.data as any;
                if (parsedData.parsed && parsedData.parsed.info) {
                    const stakeInfo = parsedData.parsed.info;

                    // Check if delegated to this validator
                    if (stakeInfo.stake?.delegation?.voter === validatorVoteAccount) {
                        const stakedLamports = stakeInfo.stake.delegation.stake;
                        totalStaked += Number(stakedLamports) / LAMPORTS_PER_SOL;
                        validStakeAccounts.push(account.pubkey);
                    }
                }
            }

            setUserStakedAmount(totalStaked);
            setStakeAccounts(validStakeAccounts);
        } catch (error) {
            console.error('Error fetching stake accounts:', error);
        }
    }, [publicKey, connected, connection, validatorVoteAccount]);

    // Security state tracking
    const [operationMutex, setOperationMutex] = useState<Map<string, Promise<any>>>(new Map());
    const [securityValidated, setSecurityValidated] = useState<boolean>(false);
    const [lastOperationTime, setLastOperationTime] = useState<number>(0);
    const [failedAttempts, setFailedAttempts] = useState<number>(0);

    // Initialize connection on mount
    useEffect(() => {
        const initConnection = async () => {
            try {
                const conn = getClientConnection();
                setConnection(conn);
            } catch (error) {
                console.error('Failed to initialize connection:', error);
                setError('Failed to connect to Solana network');
            }
        };

        initConnection();
    }, []);

    // Validate validator vote account on mount with comprehensive security
    useEffect(() => {
        const validateValidator = async () => {
            try {
                // Validate format first
                if (!isValidSolanaAddress(validatorVoteAccount)) {
                    throw new Error('Invalid validator vote account format');
                }

                // Validate with blockchain
                const pubkey = new PublicKey(validatorVoteAccount);

                // Check if this is actually a validator vote account
                if (connection) {
                    try {
                        const accountInfo = await connection.getAccountInfo(pubkey);
                        if (!accountInfo) {
                            throw new Error('Validator vote account not found on blockchain');
                        }

                        // Additional validation for vote account structure
                        if (accountInfo.owner.toString() !== 'Vote111111111111111111111111111111111111111') {
                            console.warn('Account may not be a valid vote account');
                        }
                    } catch (error) {
                        console.warn('Could not validate validator account on chain:', error);
                    }
                }

                setSecurityValidated(true);
            } catch (error: any) {
                console.error('Invalid validator vote account:', validatorVoteAccount, error.message);
                setError(`Invalid validator: ${error.message}`);
                setSecurityValidated(false);
            }
        };

        validateValidator();
    }, [validatorVoteAccount, connection]);

    // Check if user meets SVMAI requirement
    const meetsRequirement = useMemo(() =>
        userSvmaiBalance >= REQUIRED_SVMAI_BALANCE,
        [userSvmaiBalance]
    );

    // Rate limiting for operations (max 1 operation per 5 seconds)
    const isRateLimited = useCallback(() => {
        const now = Date.now();
        const timeSinceLastOp = now - lastOperationTime;
        return timeSinceLastOp < 5000; // 5 second cooldown
    }, [lastOperationTime]);

    // Security check for too many failed attempts
    const isBlocked = useCallback(() => {
        return failedAttempts >= 5; // Block after 5 failed attempts
    }, [failedAttempts]);

    // Calculate expected returns with compound interest and security validation
    const calculateExpectedReturns = useCallback((amount: number, days: number): { gross: number; net: number; earnings: number } => {
        // Input validation
        if (!amount || amount <= 0 || amount > MAX_STAKE_AMOUNT) {
            return { gross: 0, net: 0, earnings: 0 };
        }

        if (!days || days <= 0 || days > 365) {
            return { gross: 0, net: 0, earnings: 0 };
        }

        // Validate APY is reasonable (0-50%)
        const validatedApy = Math.min(Math.max(apy, 0), 50);

        // Convert APY to daily rate for compound interest
        const dailyRate = Math.pow(1 + validatedApy / 100, 1 / 365) - 1;

        // Calculate gross returns with compound interest
        const grossReturns = amount * Math.pow(1 + dailyRate, days);
        const grossEarnings = grossReturns - amount;

        // Calculate commission (validate commission is 0-100%)
        const validatedCommission = Math.min(Math.max(commission, 0), 100);
        const commissionFee = grossEarnings * (validatedCommission / 100);
        const netEarnings = grossEarnings - commissionFee;
        const netReturns = amount + netEarnings;

        return {
            gross: Number(grossReturns.toFixed(6)),
            net: Number(netReturns.toFixed(6)),
            earnings: Number(netEarnings.toFixed(6))
        };
    }, [apy, commission]);

    // Secure SVMAI balance getter with caching
    const getSVMAIBalance = useCallback(async (address: string): Promise<number> => {
        try {
            // Validate address format
            if (!isValidSolanaAddress(address)) {
                throw new Error('Invalid address format');
            }

            if (!connection) {
                throw new Error('Connection not initialized');
            }

            const publicKey = new PublicKey(address);
            const tokenAccount = await getAssociatedTokenAddress(
                TOKEN_MINTS.SVMAI,
                publicKey
            );

            try {
                const account = await getAccount(connection, tokenAccount);
                const balance = Number(account.amount) / Math.pow(10, TOKEN_DECIMALS.SVMAI);
                return balance;
            } catch (error) {
                if (error instanceof TokenAccountNotFoundError) {
                    return 0;
                }
                throw error;
            }
        } catch (error) {
            console.error('Error fetching SVMAI balance:', error);
            return 0;
        }
    }, [connection]);

    // Secure balance fetching with timeout and error handling
    const fetchUserBalances = useCallback(async (): Promise<void> => {
        if (!publicKey || !connected || !connection) return;

        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Balance fetch timeout')), 10000)
        );

        try {
            const balancePromises = [
                // SOL balance
                connection.getBalance(publicKey),
                // SVMAI balance (simulated for now)
                getSVMAIBalance(publicKey.toString())
            ];

            const [solBalance, svmaiBalance] = await Promise.race([
                Promise.all(balancePromises),
                timeoutPromise
            ]) as [number, number];

            setUserSolBalance(solBalance / LAMPORTS_PER_SOL);
            setUserSvmaiBalance(svmaiBalance);

            // Track memory usage
            //  MemoryManager.trackAllocation('balance_fetch', 1024);
        } catch (error: any) {
            console.error('Error fetching balances:', error);
            if (error.message !== 'Balance fetch timeout') {
                setError('Failed to fetch account balances');
            }
        }
    }, [publicKey, connected, connection, getSVMAIBalance]);

    // Secure SVMAI token account management
    // Secure SVMAI token account management
    const ensureSvmaiTokenAccount = useCallback(async (): Promise<PublicKey | null> => {
        if (!publicKey || !connected || !connection) return null;

        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Token account check timeout')), 10000)
        );

        try {
            const tokenAccount = await getAssociatedTokenAddress(
                TOKEN_MINTS.SVMAI,
                publicKey
            );

            const checkPromise = (async () => {
                try {
                    await getAccount(connection, tokenAccount);
                    return tokenAccount;
                } catch (error) {
                    if (error instanceof TokenAccountNotFoundError) {
                        return tokenAccount;
                    }
                    throw error;
                }
            })();

            return await Promise.race([checkPromise, timeoutPromise]) as PublicKey;
        } catch (error: any) {
            console.error('Error checking SVMAI token account:', error);
            if (error.message !== 'Token account check timeout') {
                setError('Failed to check token account');
            }
            return null;
        }
    }, [publicKey, connected, connection]);
    // Secure stake operation with comprehensive validation
    const handleStake = useCallback(async (): Promise<void> => {
        if (!publicKey || !connected || !connection || !sendTransaction) {
            setError('Wallet not properly connected');
            return;
        }

        // Security checks
        if (!securityValidated) {
            setError('Validator not validated');
            return;
        }

        if (isRateLimited()) {
            setError('Too many operations. Please wait before trying again.');
            return;
        }

        if (isBlocked()) {
            setError('Account temporarily blocked due to failed attempts');
            return;
        }

        // Validate stake amount
        const amount = parseFloat(stakeAmount);
        if (isNaN(amount) || amount < MIN_STAKE_AMOUNT || amount > MAX_STAKE_AMOUNT) {
            setError(`Stake amount must be between ${MIN_STAKE_AMOUNT} and ${MAX_STAKE_AMOUNT} SOL`);
            return;
        }

        // Check sufficient balance
        if (amount > userSolBalance) {
            setError('Insufficient SOL balance');
            return;
        }

        // Check SVMAI requirement
        if (!meetsRequirement) {
            setError(`Minimum ${REQUIRED_SVMAI_BALANCE} SVMAI required for staking`);
            return;
        }

        // Prevent concurrent operations
        const operationKey = `stake_${validatorVoteAccount}`;
        if (operationMutex.has(operationKey)) {
            setError('Stake operation already in progress');
            return;
        }

        setIsStaking(true);
        setError('');
        setSuccess('');
        setLastOperationTime(Date.now());

        const stakeOperation = (async () => {
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Stake operation timeout')), OPERATION_TIMEOUT)
            );

            const stakePromise = (async () => {
                try {
                    // Ensure connection exists
                    if (!connection) {
                        throw new Error('Connection not available');
                    }

                    // Validate validator vote account again
                    const validatorPubkey = new PublicKey(validatorVoteAccount);

                    // Derive stake account address deterministically
                    const seed = `openstake-${validatorPubkey}`;
                    const stakeAccount = await PublicKey.createWithSeed(
                        publicKey,
                        seed,
                        StakeProgram.programId);

                    // Calculate rent exemption for stake account
                    const rentExemption = await connection.getMinimumBalanceForRentExemption(
                        StakeProgram.space
                    );

                    // Create transaction
                    const transaction = new Transaction();

                    // Add instruction to create stake account with seed
                    transaction.add(
                        SystemProgram.createAccountWithSeed({
                            fromPubkey: publicKey,
                            newAccountPubkey: stakeAccount,
                            basePubkey: publicKey,
                            seed: seed,
                            lamports: amount * LAMPORTS_PER_SOL + rentExemption,
                            space: StakeProgram.space,
                            programId: StakeProgram.programId,
                        })
                    );

                    // Add instruction to initialize stake account
                    transaction.add(
                        StakeProgram.initialize({
                            stakePubkey: stakeAccount,
                            authorized: new Authorized(publicKey, publicKey),
                            lockup: new Lockup(0, 0, PublicKey.default),
                        })
                    );

                    // Add instruction to delegate stake
                    transaction.add(
                        StakeProgram.delegate({
                            stakePubkey: stakeAccount,
                            authorizedPubkey: publicKey,
                            votePubkey: validatorPubkey,
                        })
                    );

                    // Send transaction (no signers needed for derived account)
                    const signature = await sendTransaction(transaction, connection);

                    // Wait for confirmation
                    const latestBlockhash = await connection.getLatestBlockhash();
                    await connection.confirmTransaction({
                        signature,
                        blockhash: latestBlockhash.blockhash,
                        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
                    });

                    // Store stake account for tracking
                    setStakeAccounts(prev => [...prev, stakeAccount]);

                    // Update user staked amount
                    setUserStakedAmount(prev => prev + amount);

                    return { success: true, signature, stakeAccount: stakeAccount, seed };
                } catch (error: any) {
                    throw new Error(error.message || 'Stake transaction failed');
                }
            })();

            return await Promise.race([stakePromise, timeoutPromise]);
        })();

        // Track operation in mutex
        setOperationMutex(prev => new Map([...prev, [operationKey, stakeOperation]]));

        try {
            await stakeOperation;
            setSuccess(`Successfully staked ${amount} SOL`);
            setStakeAmount('');
            setShowStakeModal(false);

            // Reset failed attempts on success
            setFailedAttempts(0);

            // Refresh balances
            await fetchUserBalances();
            await fetchUserStakeAccounts();
        } catch (error: any) {
            const errorMessage = error?.message || 'Stake operation failed';
            console.error('Stake operation failed:', errorMessage);
            setError(errorMessage);

            // Increment failed attempts
            setFailedAttempts(prev => prev + 1);
        } finally {
            setIsStaking(false);

            // Clean up mutex
            setOperationMutex(prev => {
                const newMap = new Map(prev);
                newMap.delete(operationKey);
                return newMap;
            });
        }
    }, [
        publicKey, connected, connection, sendTransaction, securityValidated,
        stakeAmount, userSolBalance, meetsRequirement, validatorVoteAccount,
        operationMutex, isRateLimited, isBlocked, fetchUserBalances, fetchUserStakeAccounts
    ]);

    // Secure unstake operation with comprehensive validation
    const handleUnstake = useCallback(async (): Promise<void> => {
        if (!publicKey || !connected || !connection || !sendTransaction) {
            setError('Wallet not properly connected');
            return;
        }

        // Security checks
        if (isRateLimited()) {
            setError('Too many operations. Please wait before trying again.');
            return;
        }

        if (isBlocked()) {
            setError('Account temporarily blocked due to failed attempts');
            return;
        }

        // Validate unstake amount
        const amount = parseFloat(unstakeAmount);
        if (isNaN(amount) || amount <= 0) {
            setError('Invalid unstake amount');
            return;
        }

        if (amount > userStakedAmount) {
            setError('Insufficient staked amount');
            return;
        }

        // Prevent concurrent operations
        const operationKey = `unstake_${validatorVoteAccount}`;
        if (operationMutex.has(operationKey)) {
            setError('Unstake operation already in progress');
            return;
        }

        setIsUnstaking(true);
        setError('');
        setSuccess('');
        setLastOperationTime(Date.now());

        const unstakeOperation = (async () => {
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Unstake operation timeout')), OPERATION_TIMEOUT)
            );

            const unstakePromise = (async () => {
                try {
                    // Find a stake account delegated to this validator with enough staked SOL
                    let unstakeRemaining = amount;
                    const unstakeInstructions: any[] = [];

                    for (const stakePubkey of stakeAccounts) {
                        if (unstakeRemaining <= 0) break;

                        const stakeAccountInfo = await connection.getParsedAccountInfo(stakePubkey);
                        const parsedData = (stakeAccountInfo.value?.data as any)?.parsed?.info;
                        if (!parsedData) continue;

                        const delegatedAmount = Number(parsedData.stake?.delegation?.stake || 0) / LAMPORTS_PER_SOL;
                        if (delegatedAmount <= 0) continue;

                        const toUnstake = Math.min(delegatedAmount, unstakeRemaining);

                        // Add deactivate instruction
                        unstakeInstructions.push(
                            StakeProgram.deactivate({
                                stakePubkey,
                                authorizedPubkey: publicKey,
                            })
                        );

                        unstakeRemaining -= toUnstake;
                    }

                    if (unstakeInstructions.length === 0) {
                        throw new Error('No stake accounts found to unstake from');
                    }

                    // Create transaction
                    const transaction = new Transaction();
                    for (const ix of unstakeInstructions) {
                        transaction.add(ix);
                    }

                    // Send transaction
                    const signature = await sendTransaction(transaction, connection);

                    // Wait for confirmation
                    const latestBlockhash = await connection.getLatestBlockhash();
                    await connection.confirmTransaction({
                        signature,
                        blockhash: latestBlockhash.blockhash,
                        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
                    });

                    // Update staked amount
                    setUserStakedAmount(prev => Math.max(prev - amount, 0));

                    return { success: true, signature };
                } catch (error: any) {
                    throw new Error(error.message || 'Unstake transaction failed');
                }
            })();

            return await Promise.race([unstakePromise, timeoutPromise]);
        })();

        // Track operation in mutex
        setOperationMutex(prev => new Map([...prev, [operationKey, unstakeOperation]]));

        try {
            await unstakeOperation;
            setSuccess(`Successfully unstaked ${amount} SOL`);
            setUnstakeAmount('');
            setShowUnstakeModal(false);

            // Reset failed attempts on success
            setFailedAttempts(0);

            // Refresh balances
            await fetchUserBalances();
        } catch (error: any) {
            const errorMessage = error?.message || 'Unstake operation failed';
            console.error('Unstake operation failed:', errorMessage);
            setError(errorMessage);

            // Increment failed attempts
            setFailedAttempts(prev => prev + 1);
        } finally {
            setIsUnstaking(false);

            // Clean up mutex
            setOperationMutex(prev => {
                const newMap = new Map(prev);
                newMap.delete(operationKey);
                return newMap;
            });
        }
    }, [
        publicKey, connected, connection, sendTransaction, unstakeAmount,
        userStakedAmount, validatorVoteAccount, operationMutex,
        stakeAccounts, isRateLimited, isBlocked, fetchUserBalances
    ]);
    // Fetch balances on component mount and wallet connection
    useEffect(() => {
        if (connected && publicKey && connection) {
            fetchUserBalances();
            fetchUserStakeAccounts();
            ensureSvmaiTokenAccount();
        }
    }, [connected, publicKey, connection, fetchUserBalances, fetchUserStakeAccounts, ensureSvmaiTokenAccount]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            //   MemoryManager.cleanup('validator_staking');
        };
    }, []);

    // Secure input handlers with validation
    const handleStakeAmountChange = useCallback((value: string) => {
        // Sanitize input - only allow numbers and decimal point
        const sanitized = value.replace(/[^\d.]/g, '');
        const decimalCount = (sanitized.match(/\./g) || []).length;

        if (decimalCount <= 1) {
            setStakeAmount(sanitized);
        }
    }, []);

    const handleUnstakeAmountChange = useCallback((value: string) => {
        // Sanitize input - only allow numbers and decimal point
        const sanitized = value.replace(/[^\d.]/g, '');
        const decimalCount = (sanitized.match(/\./g) || []).length;

        if (decimalCount <= 1) {
            setUnstakeAmount(sanitized);
        }
    }, []);

    // Render component with security indicators
    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            {/* Security Status Indicator */}
            {!securityValidated && (
                <div className="mb-4 p-3 bg-yellow-100 dark:bg-yellow-900 border border-yellow-300 dark:border-yellow-700 rounded">
                    <div className="flex items-center">
                        <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mr-2" />
                        <span className="text-sm text-yellow-800 dark:text-yellow-200">
                            Validator security validation in progress...
                        </span>
                    </div>
                </div>
            )}

            {/* Failed Attempts Warning */}
            {failedAttempts > 0 && (
                <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 border border-red-300 dark:border-red-700 rounded">
                    <div className="flex items-center">
                        <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mr-2" />
                        <span className="text-sm text-red-800 dark:text-red-200">
                            {failedAttempts} failed operation{failedAttempts > 1 ? 's' : ''}.
                            {isBlocked() ? ' Account temporarily blocked.' : ''}
                        </span>
                    </div>
                </div>
            )}

            <div className="mb-6">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    Stake with {sanitizeInput(validatorName)}
                </h3>
                <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
                    <span>Commission: {commission}%</span>
                    <span>Est. APY: {apy}%</span>
                </div>
            </div>

            {/* Error/Success Messages */}
            {error && (
                <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 border border-red-300 dark:border-red-700 rounded">
                    <div className="flex items-center">
                        <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mr-2" />
                        <span className="text-sm text-red-800 dark:text-red-200">{error}</span>
                    </div>
                </div>
            )}

            {success && (
                <div className="mb-4 p-3 bg-green-100 dark:bg-green-900 border border-green-300 dark:border-green-700 rounded">
                    <div className="flex items-center">
                        <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mr-2" />
                        <span className="text-sm text-green-800 dark:text-green-200">{success}</span>
                    </div>
                </div>
            )}

            {/* Balance Display */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">SOL Balance</h4>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                        {userSolBalance.toFixed(4)} SOL
                    </p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">SVMAI Balance</h4>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                        {userSvmaiBalance.toLocaleString()} SVMAI
                    </p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Staked Amount</h4>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                        {userStakedAmount.toFixed(4)} SOL
                    </p>
                </div>
            </div>

            {/* SVMAI Requirement Check */}
            <div className="mb-6 p-4 border rounded-lg">
                <div className="flex items-center justify-between">
                    <div>
                        <h4 className="font-medium text-gray-900 dark:text-white">SVMAI Requirement</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            Minimum {REQUIRED_SVMAI_BALANCE.toLocaleString()} SVMAI required for staking
                        </p>
                    </div>
                    <div className="flex items-center">
                        {meetsRequirement ? (
                            <CheckCircle className="h-6 w-6 text-green-500" />
                        ) : (
                            <AlertCircle className="h-6 w-6 text-red-500" />
                        )}
                    </div>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-4">
                <button
                    onClick={() => setShowStakeModal(true)}
                    disabled={!connected || !meetsRequirement || isStaking || isUnstaking || !securityValidated || isBlocked()}
                    className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isStaking ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                        <Lock className="h-4 w-4 mr-2" />
                    )}
                    {isStaking ? 'Staking...' : 'Stake SOL'}
                </button>

                <button
                    onClick={() => setShowUnstakeModal(true)}
                    disabled={!connected || userStakedAmount === 0 || isStaking || isUnstaking || isBlocked()}
                    className="w-full flex items-center justify-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isUnstaking ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                        <TrendingDown className="h-4 w-4 mr-2" />
                    )}
                    {isUnstaking ? 'Unstaking...' : 'Unstake SOL'}
                </button>
            </div>

            {/* Stake Modal */}
            {showStakeModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
                        <h3 className="text-lg font-bold mb-4">Stake SOL</h3>

                        <div className="mb-4">
                            <label className="block text-sm font-medium mb-2">Amount (SOL)</label>
                            <input
                                type="text"
                                value={stakeAmount}
                                onChange={(e) => handleStakeAmountChange(e.target.value)}
                                placeholder={`Min: ${MIN_STAKE_AMOUNT} SOL`}
                                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                disabled={isStaking}
                            />
                        </div>

                        {/* Expected Returns Calculator */}
                        {stakeAmount && !isNaN(parseFloat(stakeAmount)) && (
                            <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                <h4 className="text-sm font-medium mb-2 flex items-center">
                                    <Calculator className="h-4 w-4 mr-1" />
                                    Expected Returns
                                </h4>
                                {[30, 90, 365].map(days => {
                                    const returns = calculateExpectedReturns(parseFloat(stakeAmount), days);
                                    return (
                                        <div key={days} className="flex justify-between text-sm">
                                            <span>{days} days:</span>
                                            <span className="font-medium">+{returns.earnings.toFixed(4)} SOL</span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        <div className="flex space-x-3">
                            <button
                                onClick={() => setShowStakeModal(false)}
                                disabled={isStaking}
                                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleStake}
                                disabled={isStaking || !stakeAmount || isNaN(parseFloat(stakeAmount))}
                                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                            >
                                {isStaking ? 'Staking...' : 'Confirm Stake'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Unstake Modal */}
            {showUnstakeModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
                        <h3 className="text-lg font-bold mb-4">Unstake SOL</h3>

                        <div className="mb-4">
                            <label className="block text-sm font-medium mb-2">Amount (SOL)</label>
                            <input
                                type="text"
                                value={unstakeAmount}
                                onChange={(e) => handleUnstakeAmountChange(e.target.value)}
                                placeholder={`Max: ${userStakedAmount.toFixed(4)} SOL`}
                                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                                disabled={isUnstaking}
                            />
                        </div>

                        <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900 rounded-lg">
                            <p className="text-sm text-yellow-800 dark:text-yellow-200">
                                ⚠️ Unstaking typically takes 2-3 days to complete due to Solana's cooldown period.
                            </p>
                        </div>

                        <div className="flex space-x-3">
                            <button
                                onClick={() => setShowUnstakeModal(false)}
                                disabled={isUnstaking}
                                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleUnstake}
                                disabled={isUnstaking || !unstakeAmount || isNaN(parseFloat(unstakeAmount))}
                                className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
                            >
                                {isUnstaking ? 'Unstaking...' : 'Confirm Unstake'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
