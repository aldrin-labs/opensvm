/**
 * Lightweight transaction classification utilities for graph visualization
 * - Classifies transactions (sol_transfer, spl_transfer, defi, nft, program_call, system)
 * - Detects potential funding transactions when possible
 * - Returns a confidence score for downstream styling
 */

export type TransactionType =
    | 'sol_transfer'
    | 'spl_transfer'
    | 'defi'
    | 'nft'
    | 'program_call'
    | 'system'
    | 'unknown';

export interface TransactionClassification {
    type: TransactionType;
    confidence: number; // 0.0 - 1.0
    tokenSymbol?: string;
    tokenMint?: string;
    amount?: number; // best-effort, raw (lamports for SOL, base units for tokens if available)
    isFunding: boolean;
    programId?: string; // primary detected program id (if any)
}

/**
 * Known program IDs used for transaction classification.
 * - SYSTEM_PROGRAM_ID: Solana's native system program for SOL transfers and account creation.
 * - SPL_TOKEN_PROGRAM_ID: SPL Token program for fungible token transfers.
 * - METAPLEX_METADATA_PROGRAM_ID: Metaplex's token metadata program, commonly used in NFT transactions.
 * 
 * These IDs are used to classify transactions into specific types. Unknown program IDs are handled
 * by the classifier as generic 'program_call' types, ensuring graceful fallback for unrecognized programs.
 */
const SYSTEM_PROGRAM_ID = '11111111111111111111111111111111';
const SPL_TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
// Metaplex Token Metadata program (commonly used in NFT flows)
const METAPLEX_METADATA_PROGRAM_ID = 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s';

// Optional mapping for known DeFi protocols (keep small, we also have a broader registry elsewhere)
const KNOWN_DEFI_PROGRAM_IDS: Set<string> = new Set([
    // Jupiter, Raydium, Serum examples seen elsewhere in the repo
    'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4', // Jupiter
    '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8', // Raydium AMM
    '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'  // Serum DEX
]);

/**
 * Best-effort extraction helpers that are resilient to missing fields
 */
function getInstructions(tx: any): any[] {
    const details = tx?.details || tx?.transaction || tx?.meta || {};
    // Common shapes: details.instructions, transaction.message.instructions
    if (Array.isArray(details.instructions)) return details.instructions;
    const message = details.message || tx?.transaction?.message;
    if (Array.isArray(message?.instructions)) return message.instructions;
    return [];
}

function getProgramIdsFromInstructions(instructions: any[]): string[] {
    const ids: string[] = [];
    for (const ix of instructions) {
        const pid = ix?.programId?.toString?.() || ix?.programId || ix?.programIdIndex || ix?.program;
        if (typeof pid === 'string') {
            ids.push(pid);
        }
    }
    return ids;
}

function isSystemCreateOrFunding(instructions: any[]): boolean {
    // Look for System Program createAccount/createAccountWithSeed or transfer to newly created account
    for (const ix of instructions) {
        const pid = ix?.programId?.toString?.() || ix?.programId || '';
        if (pid !== SYSTEM_PROGRAM_ID) continue;
        const parsedType = ix?.parsed?.type || ix?.type || '';
        if (parsedType === 'createAccount' || parsedType === 'createAccountWithSeed') {
            return true;
        }
        if (parsedType === 'transfer') {
            // Heuristic: system transfer could be funding if other instructions also create the account
            // We keep the signal low-confidence unless paired with create* above
            return false;
        }
    }
    return false;
}

function extractTokenTransferInfo(instructions: any[]): { amount?: number; mint?: string } | null {
    for (const ix of instructions) {
        const pid = ix?.programId?.toString?.() || ix?.programId || '';
        if (pid !== SPL_TOKEN_PROGRAM_ID) continue;
        const parsed = ix?.parsed?.info || ix?.info;
        const amountStr = parsed?.amount ?? parsed?.tokenAmount?.amount;
        const amount = amountStr != null ? Number(amountStr) : undefined;
        const mint = parsed?.mint || parsed?.tokenMint;
        return { amount, mint };
    }
    return null;
}

/**
 * Classify a transaction by inspecting its instructions and known program IDs.
 * Pure, no network calls.
 */
export function classifyTransactionType(tx: any): TransactionClassification {
    const instructions = getInstructions(tx);
    const programIds = new Set(getProgramIdsFromInstructions(instructions));

    // NFT flow via Metaplex metadata
    if (programIds.has(METAPLEX_METADATA_PROGRAM_ID)) {
        return { type: 'nft', confidence: 0.8, isFunding: false, programId: METAPLEX_METADATA_PROGRAM_ID };
    }

    // SPL token transfers
    if (programIds.has(SPL_TOKEN_PROGRAM_ID)) {
        const tokenInfo = extractTokenTransferInfo(instructions);
        return {
            type: 'spl_transfer',
            confidence: 0.9,
            tokenMint: tokenInfo?.mint,
            amount: tokenInfo?.amount,
            isFunding: false,
            programId: SPL_TOKEN_PROGRAM_ID
        };
    }

    // DeFi protocols
    for (const pid of programIds) {
        if (KNOWN_DEFI_PROGRAM_IDS.has(pid)) {
            return { type: 'defi', confidence: 0.7, isFunding: false, programId: pid };
        }
    }

    // System program: could be SOL transfer or account creation/funding
    if (programIds.has(SYSTEM_PROGRAM_ID)) {
        const isCreate = isSystemCreateOrFunding(instructions);
        return {
            type: isCreate ? 'system' : 'sol_transfer',
            confidence: isCreate ? 0.8 : 0.6,
            isFunding: isCreate
        };
    }

    // Fallback: generic program call if any program present
    if (programIds.size > 0) {
        // Choose a representative program id
        const [firstPid] = Array.from(programIds);
        return { type: 'program_call', confidence: 0.5, isFunding: false, programId: firstPid };
    }

    return { type: 'unknown', confidence: 0.2, isFunding: false };
}

/**
 * Heuristic to detect if a given transaction likely funded an account.
 * If an accountAddress is provided, we try to infer creation of that account.
 */
export function isFundingTransaction(tx: any, accountAddress?: string | null): boolean {
    const instructions = getInstructions(tx);
    // Strong signal: explicit createAccount
    if (isSystemCreateOrFunding(instructions)) {
        if (!accountAddress) return true;
        // If account is referenced as new account in parsed info
        for (const ix of instructions) {
            const parsed = ix?.parsed?.info || ix?.info;
            if (parsed?.newAccount === accountAddress || parsed?.newAccountPubkey === accountAddress) {
                return true;
            }
        }
        // Otherwise, still a likely funding but lower certainty
        return true;
    }
    return false;
}


