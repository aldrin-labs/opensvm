import { PublicKey, ParsedTransactionWithMeta, ParsedInstruction } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';

/**
 * Validate if a string is a valid Solana address
 */
export function validateSolanaAddress(address: string): boolean {
    try {
        new PublicKey(address);
        return true;
    } catch {
        return false;
    }
}

/**
 * Shorten a Solana address for display purposes
 */
export function shortenSolanaAddress(address: string, chars: number = 4): string {
    if (!validateSolanaAddress(address)) {
        return address;
    }
    return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

/**
 * Format Solana amount with proper decimal places
 */
export function formatSolanaAmount(amount: number, decimals: number = 9): string {
    return (amount / Math.pow(10, decimals)).toFixed(decimals);
}

/**
 * Parse Solana amount from raw value
 */
export function parseSolanaAmount(rawAmount: string | number, decimals: number = 9): number {
    const amount = typeof rawAmount === 'string' ? parseFloat(rawAmount) : rawAmount;
    return amount / Math.pow(10, decimals);
}

/**
 * Convert amount to raw Solana format
 */
export function toRawSolanaAmount(amount: number, decimals: number = 9): number {
    return Math.floor(amount * Math.pow(10, decimals));
}

/**
 * Check if two Solana addresses are equal
 */
export function addressesEqual(address1: string, address2: string): boolean {
    try {
        const pubkey1 = new PublicKey(address1);
        const pubkey2 = new PublicKey(address2);
        return pubkey1.equals(pubkey2);
    } catch {
        return false;
    }
}

/**
 * Extract token transfer information from a parsed transaction
 */
export interface TokenTransfer {
    from: string;
    to: string;
    amount: number;
    mint: string;
    authority: string;
    decimals: number;
}

export function parseTokenTransfer(
    transaction: ParsedTransactionWithMeta,
    targetMint?: string,
    targetDestination?: string
): TokenTransfer[] {
    const transfers: TokenTransfer[] = [];

    if (!transaction.transaction.message.instructions) {
        return transfers;
    }

    for (const instruction of transaction.transaction.message.instructions) {
        const parsedInstruction = instruction as ParsedInstruction;

        // Look for SPL token transfer instructions
        if (parsedInstruction.program === 'spl-token') {
            const parsed = parsedInstruction.parsed;

            if (parsed?.type === 'transfer' || parsed?.type === 'transferChecked') {
                const info = parsed.info;

                // Filter by target mint if specified
                if (targetMint && info.mint !== targetMint) {
                    continue;
                }

                // Filter by target destination if specified
                if (targetDestination && info.destination !== targetDestination) {
                    continue;
                }

                transfers.push({
                    from: info.source,
                    to: info.destination,
                    amount: parsed.type === 'transferChecked'
                        ? parseFloat(info.tokenAmount?.uiAmount || '0')
                        : parseFloat(info.amount || '0'),
                    mint: info.mint || '',
                    authority: info.authority || '',
                    decimals: parsed.type === 'transferChecked'
                        ? info.tokenAmount?.decimals || 0
                        : 0,
                });
            }
        }
    }

    return transfers;
}

/**
 * Get the associated token account address for a mint and owner
 */
export async function getTokenAccountAddress(
    mint: string,
    owner: string
): Promise<string> {
    try {
        const mintPubkey = new PublicKey(mint);
        const ownerPubkey = new PublicKey(owner);
        const associatedTokenAccount = await getAssociatedTokenAddress(mintPubkey, ownerPubkey);
        return associatedTokenAccount.toString();
    } catch (error) {
        throw new Error(`Failed to get token account address: ${error}`);
    }
}

/**
 * Extract all account addresses from a transaction
 */
export function extractAccountAddresses(transaction: ParsedTransactionWithMeta): string[] {
    const addresses = new Set<string>();

    // Add all account keys
    if (transaction.transaction.message.accountKeys) {
        for (const account of transaction.transaction.message.accountKeys) {
            if (typeof account === 'string') {
                addresses.add(account);
            } else if (account.pubkey) {
                addresses.add(account.pubkey.toString());
            }
        }
    }

    return Array.from(addresses);
}

/**
 * Check if an address is involved in a transaction
 */
export function isAddressInTransaction(
    transaction: ParsedTransactionWithMeta,
    targetAddress: string
): boolean {
    const addresses = extractAccountAddresses(transaction);
    return addresses.some(addr => addressesEqual(addr, targetAddress));
}

/**
 * Get transaction fee from a parsed transaction
 */
export function getTransactionFee(transaction: ParsedTransactionWithMeta): number {
    return transaction.meta?.fee || 0;
}

/**
 * Check if a transaction was successful
 */
export function isTransactionSuccessful(transaction: ParsedTransactionWithMeta): boolean {
    return transaction.meta?.err === null;
}

/**
 * Extract error information from a failed transaction
 */
export function getTransactionError(transaction: ParsedTransactionWithMeta): string | null {
    if (transaction.meta?.err) {
        return JSON.stringify(transaction.meta.err);
    }
    return null;
}

/**
 * Get account balance changes from a transaction
 */
export interface BalanceChange {
    account: string;
    before: number;
    after: number;
    change: number;
}

export function getBalanceChanges(transaction: ParsedTransactionWithMeta): BalanceChange[] {
    const changes: BalanceChange[] = [];

    if (!transaction.meta?.preBalances || !transaction.meta?.postBalances) {
        return changes;
    }

    const accountKeys = transaction.transaction.message.accountKeys || [];

    for (let i = 0; i < accountKeys.length; i++) {
        const account = (() => {
            const key = accountKeys[i];
            if (typeof key === 'string') {
                return key;
            }
            // Handle ParsedMessageAccount case with explicit unknown conversion
            const unknownKey = key as unknown;
            if (unknownKey && typeof unknownKey === 'object' && 'pubkey' in unknownKey) {
                const pubkeyObj = (unknownKey as { pubkey: { toString(): string } }).pubkey;
                return pubkeyObj?.toString() || '';
            }
            return String(unknownKey || '');
        })();

        const before = transaction.meta.preBalances[i] || 0;
        const after = transaction.meta.postBalances[i] || 0;
        const change = after - before;

        if (change !== 0) {
            changes.push({
                account,
                before,
                after,
                change,
            });
        }
    }

    return changes;
}

/**
 * Get token balance changes from a transaction
 */
export interface TokenBalanceChange {
    account: string;
    mint: string;
    owner: string;
    before: number;
    after: number;
    change: number;
    decimals: number;
}

export function getTokenBalanceChanges(transaction: ParsedTransactionWithMeta): TokenBalanceChange[] {
    const changes: TokenBalanceChange[] = [];

    const preTokenBalances = transaction.meta?.preTokenBalances || [];
    const postTokenBalances = transaction.meta?.postTokenBalances || [];

    // Create a map of account -> token balance info
    const preBalanceMap = new Map();
    const postBalanceMap = new Map();

    for (const balance of preTokenBalances) {
        const key = `${balance.accountIndex}-${balance.mint}`;
        preBalanceMap.set(key, balance);
    }

    for (const balance of postTokenBalances) {
        const key = `${balance.accountIndex}-${balance.mint}`;
        postBalanceMap.set(key, balance);
    }

    // Find all unique account-mint combinations
    const allKeys = new Set([...preBalanceMap.keys(), ...postBalanceMap.keys()]);

    for (const key of allKeys) {
        const preBalance = preBalanceMap.get(key);
        const postBalance = postBalanceMap.get(key);

        const before = preBalance?.uiTokenAmount?.uiAmount || 0;
        const after = postBalance?.uiTokenAmount?.uiAmount || 0;
        const change = after - before;

        if (change !== 0) {
            const accountKeys = transaction.transaction.message.accountKeys || [];
            const accountIndex = preBalance?.accountIndex || postBalance?.accountIndex || 0;
            const account = typeof accountKeys[accountIndex] === 'string'
                ? accountKeys[accountIndex]
                : accountKeys[accountIndex]?.pubkey?.toString() || '';

            changes.push({
                account,
                mint: preBalance?.mint || postBalance?.mint || '',
                owner: preBalance?.owner || postBalance?.owner || '',
                before,
                after,
                change,
                decimals: preBalance?.uiTokenAmount?.decimals || postBalance?.uiTokenAmount?.decimals || 0,
            });
        }
    }

    return changes;
}

/**
 * Generate a deterministic user ID from a Solana address
 * This can be used when you want consistent user mapping
 */
export function generateUserIdFromAddress(address: string, salt: string = ''): string {
    // Simple hash function - in production, use a proper cryptographic hash
    const combined = address + salt;
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
        const char = combined.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return `user_${Math.abs(hash).toString(36)}`;
}

/**
 * Validate token mint address format
 */
export function validateTokenMint(mint: string): boolean {
    return validateSolanaAddress(mint);
}

/**
 * Format transaction signature for display
 */
export function formatTransactionSignature(signature: string, length: number = 8): string {
    if (signature.length <= length * 2) {
        return signature;
    }
    return `${signature.slice(0, length)}...${signature.slice(-length)}`;
}

/**
 * Convert Unix timestamp to Date
 */
export function unixTimestampToDate(timestamp: number): Date {
    return new Date(timestamp * 1000);
}

/**
 * Get human-readable time since transaction
 */
export function getTimeSinceTransaction(blockTime: number): string {
    const now = Date.now() / 1000;
    const diff = now - blockTime;

    if (diff < 60) {
        return `${Math.floor(diff)} seconds ago`;
    } else if (diff < 3600) {
        return `${Math.floor(diff / 60)} minutes ago`;
    } else if (diff < 86400) {
        return `${Math.floor(diff / 3600)} hours ago`;
    } else {
        return `${Math.floor(diff / 86400)} days ago`;
    }
}

/**
 * Constants for common Solana addresses and values
 */
export const SOLANA_CONSTANTS = {
    SYSTEM_PROGRAM_ID: '11111111111111111111111111111111',
    TOKEN_PROGRAM_ID: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
    ASSOCIATED_TOKEN_PROGRAM_ID: 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
    SYSVAR_RENT_PUBKEY: 'SysvarRent111111111111111111111111111111111',
    SOL_DECIMALS: 9,
    TYPICAL_TOKEN_DECIMALS: 6,
    LAMPORTS_PER_SOL: 1000000000,
} as const; 