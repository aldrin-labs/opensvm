/**
 * Server-only program metadata caching using Qdrant
 * This file should never be imported on the client side
 */

import {
    storeProgramMetadata,
    getCachedProgramMetadata,
    batchGetCachedProgramMetadata,
    type ProgramMetadataEntry
} from '@/lib/search/qdrant';
import { getProgramDefinition } from './program-registry';

const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Fetches program metadata, first from Qdrant cache, then from static registry.
 * Caches the result in Qdrant if a static definition is found.
 * This function is designed to be called from other server-side modules.
 */
export async function getProgramInfoWithQdrantCache(
    programId: string
): Promise<ProgramMetadataEntry | null> {
    if (typeof window !== 'undefined') {
        throw new Error('getProgramInfoWithQdrantCache should not be called on the client side');
    }

    // 1. Check Qdrant cache
    try {
        const cachedMetadata = await getCachedProgramMetadata(programId);
        if (cachedMetadata) {
            return cachedMetadata;
        }
    } catch (error) {
        console.warn(`Qdrant cache lookup failed for program ${programId}:`, error);
    }

    // 2. If not in cache, check static registry
    const staticDefinition = getProgramDefinition(programId);

    if (staticDefinition) {
        // 3. If found in static registry, prepare and cache it in Qdrant
        const now = Date.now();
        const metadataToCache: ProgramMetadataEntry = {
            id: programId,
            programId: programId,
            name: staticDefinition.name,
            description: staticDefinition.description,
            websiteUrl: staticDefinition.website,
            docsUrl: staticDefinition.documentation,
            category: staticDefinition.category,
            verified: true, // Programs in our static registry are considered verified
            cached: true,
            lastUpdated: now,
            cacheExpiry: now + CACHE_DURATION,
            idl: staticDefinition.instructions as any, // Storing instructions as IDL for now
        };

        // Store in Qdrant asynchronously (non-blocking)
        storeProgramMetadata(metadataToCache).catch(error => {
            console.error(`Failed to cache program metadata for ${programId} in background:`, error);
        });

        return metadataToCache;
    }

    // 4. If not found anywhere, return null
    return null;
}

/**
 * Batch version of getProgramInfoWithQdrantCache
 */
export async function batchGetProgramInfoWithQdrantCache(
    programIds: string[]
): Promise<Map<string, ProgramMetadataEntry>> {
    if (typeof window !== 'undefined') {
        throw new Error('batchGetProgramInfoWithQdrantCache should not be called on the client side');
    }

    const results = new Map<string, ProgramMetadataEntry>();
    const needsFetching: string[] = [];

    // 1. Check Qdrant cache first
    try {
        const cachedResults = await batchGetCachedProgramMetadata(programIds);
        for (const programId of programIds) {
            if (cachedResults.has(programId)) {
                results.set(programId, cachedResults.get(programId)!);
            } else {
                needsFetching.push(programId);
            }
        }
    } catch (error) {
        console.warn('Batch Qdrant program cache lookup failed:', error);
        needsFetching.push(...programIds); // Fallback to fetching all
    }

    if (needsFetching.length === 0) {
        return results;
    }

    // 2. Fetch remaining from static registry and cache them
    const fetchPromises = needsFetching.map(async (programId) => {
        const programInfo = await getProgramInfoWithQdrantCache(programId);
        if (programInfo) {
            results.set(programId, programInfo);
        }
    });

    await Promise.all(fetchPromises);

    return results;
}
