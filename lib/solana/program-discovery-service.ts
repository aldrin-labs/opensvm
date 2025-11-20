/**
 * Program Metadata Discovery and Caching Service
 * 
 * This service automatically discovers and caches program metadata when
 * programs are encountered in transactions, RPC responses, or account owners.
 * All caching operations are performed asynchronously to avoid blocking requests.
 */

import { getProgramInfoWithQdrantCache, batchGetProgramInfoWithQdrantCache } from './program-metadata-cache';

interface DiscoveryContext {
    source: 'transaction' | 'rpc_response' | 'account_owner' | 'manual';
    transactionSignature?: string;
    accountAddress?: string;
    timestamp: number;
}

/**
 * Discovers and caches a single program metadata asynchronously.
 * This function is designed to be fire-and-forget - it won't block the calling code.
 */
export function discoverProgramMetadataAsync(
    programId: string,
    context?: DiscoveryContext
): void {
    // Only run on server side
    if (typeof window !== 'undefined') {
        return;
    }

    // Fire and forget - don't block the caller
    setImmediate(async () => {
        try {
            const metadata = await getProgramInfoWithQdrantCache(programId);

            if (metadata) {
                console.log(`[Program Discovery] Cached metadata for ${programId} (${metadata.name}) from ${context?.source || 'unknown'}`);
            } else {
                console.log(`[Program Discovery] No metadata found for unknown program ${programId} from ${context?.source || 'unknown'}`);

                // TODO: In the future, this could trigger external metadata discovery
                // For now, we just log that an unknown program was encountered
                await logUnknownProgram(programId, context);
            }
        } catch (error) {
            console.error(`[Program Discovery] Failed to discover metadata for ${programId}:`, error);
        }
    });
}

/**
 * Batch version for discovering multiple programs at once.
 * Also asynchronous and non-blocking.
 */
export function batchDiscoverProgramMetadataAsync(
    programIds: string[],
    context?: DiscoveryContext
): void {
    // Only run on server side
    if (typeof window !== 'undefined') {
        return;
    }

    if (programIds.length === 0) {
        return;
    }

    // Fire and forget - don't block the caller
    setImmediate(async () => {
        try {
            const metadataMap = await batchGetProgramInfoWithQdrantCache(programIds);

            const foundCount = metadataMap.size;
            const unknownPrograms = programIds.filter(id => !metadataMap.has(id));

            console.log(`[Program Discovery] Batch processed ${programIds.length} programs: ${foundCount} found, ${unknownPrograms.length} unknown from ${context?.source || 'unknown'}`);

            if (unknownPrograms.length > 0) {
                // Log unknown programs for future analysis
                await Promise.all(unknownPrograms.map(programId =>
                    logUnknownProgram(programId, context)
                ));
            }
        } catch (error) {
            console.error(`[Program Discovery] Failed to batch discover metadata for ${programIds.length} programs:`, error);
        }
    });
}

/**
 * Helper function to extract program IDs from various data structures
 */
export function extractProgramIdsFromTransaction(transaction: any): string[] {
    const programIds: Set<string> = new Set();

    try {
        // Extract from instructions
        if (transaction.transaction?.message?.instructions) {
            for (const instruction of transaction.transaction.message.instructions) {
                if (instruction.programIdIndex !== undefined && transaction.transaction?.message?.accountKeys) {
                    const programKey = transaction.transaction.message.accountKeys[instruction.programIdIndex];
                    if (programKey) {
                        programIds.add(typeof programKey === 'string' ? programKey : programKey.pubkey);
                    }
                }
            }
        }

        // Extract from inner instructions
        if (transaction.meta?.innerInstructions) {
            for (const innerInstruction of transaction.meta.innerInstructions) {
                if (innerInstruction.instructions) {
                    for (const instruction of innerInstruction.instructions) {
                        if (instruction.programIdIndex !== undefined && transaction.transaction?.message?.accountKeys) {
                            const programKey = transaction.transaction.message.accountKeys[instruction.programIdIndex];
                            if (programKey) {
                                programIds.add(typeof programKey === 'string' ? programKey : programKey.pubkey);
                            }
                        }
                    }
                }
            }
        }

        // Extract from parsed instructions (if available)
        if (transaction.transaction?.message?.instructions) {
            for (const instruction of transaction.transaction.message.instructions) {
                if (instruction.programId) {
                    programIds.add(instruction.programId);
                }
            }
        }

    } catch (error) {
        console.warn('Error extracting program IDs from transaction:', error);
    }

    return Array.from(programIds);
}

/**
 * Helper function to extract program IDs from account owners
 */
export function extractProgramIdsFromAccounts(accounts: any[]): string[] {
    const programIds: Set<string> = new Set();

    try {
        for (const account of accounts) {
            if (account.owner) {
                programIds.add(typeof account.owner === 'string' ? account.owner : account.owner.toBase58());
            }
            if (account.data?.program) {
                programIds.add(account.data.program);
            }
        }
    } catch (error) {
        console.warn('Error extracting program IDs from accounts:', error);
    }

    return Array.from(programIds);
}

/**
 * Log unknown programs for future analysis and potential external discovery
 */
async function logUnknownProgram(programId: string, context?: DiscoveryContext): Promise<void> {
    try {
        // For now, just console log. In the future, this could:
        // 1. Store in a separate "unknown_programs" collection in Qdrant
        // 2. Trigger external API calls to fetch metadata
        // 3. Add to a queue for manual review
        // 4. Attempt to fetch IDL from well-known sources

        console.log(`[Unknown Program] ${programId} encountered from ${context?.source || 'unknown'} at ${new Date().toISOString()}`);

        // TODO: Future enhancements
        // - Check GitHub/Anchor registry
        // - Check program-registry.com API
        // - Check SolanaFM API
        // - Check HelloMoon API
        // - Attempt to parse IDL from on-chain data

    } catch (error) {
        console.warn(`Failed to log unknown program ${programId}:`, error);
    }
}

/**
 * Integration helpers for common use cases
 */
export const ProgramDiscoveryIntegration = {
    /**
     * Call this when processing a transaction
     */
    onTransactionProcessed: (transaction: any, signature?: string) => {
        const programIds = extractProgramIdsFromTransaction(transaction);
        if (programIds.length > 0) {
            batchDiscoverProgramMetadataAsync(programIds, {
                source: 'transaction',
                transactionSignature: signature,
                timestamp: Date.now()
            });
        }
    },

    /**
     * Call this when processing RPC responses with account data
     */
    onAccountsReceived: (accounts: any[], sourceAccountAddress?: string) => {
        const programIds = extractProgramIdsFromAccounts(accounts);
        if (programIds.length > 0) {
            batchDiscoverProgramMetadataAsync(programIds, {
                source: 'rpc_response',
                accountAddress: sourceAccountAddress,
                timestamp: Date.now()
            });
        }
    },

    /**
     * Call this when a specific program is encountered
     */
    onProgramEncountered: (programId: string, source: DiscoveryContext['source'], metadata?: any) => {
        discoverProgramMetadataAsync(programId, {
            source,
            timestamp: Date.now(),
            ...metadata
        });
    }
};
