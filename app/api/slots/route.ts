import { NextResponse } from 'next/server';
import { getConnection } from '@/lib/solana-connection-server';
import { slotsCache, cache } from '@/lib/cache';

interface SlotInfo {
    slot: number;
    blockTime: number | null;
    blockHeight: number;
    parentSlot: number;
    transactionCount: number;
    leader: string;
    skipRate: number;
    producedBy?: string;
    timestamp: number;
}

interface SlotMetrics {
    averageBlockTime: number;
    skippedSlots: number;
    totalSlots: number;
    skipRate: number;
    slotsPerSecond: number;
    epochProgress: number;
}

// Batch size for parallel fetching
const BATCH_SIZE = 10;

// Cache TTL for slot data
const SLOT_CACHE_TTL = 60; // 60 seconds for slot data

/**
 * Fetch slot details with caching
 */
async function getCachedSlotDetails(slot: number, connection: any): Promise<SlotInfo | null> {
    const cacheKey = `slot:detail:${slot}`;
    
    // Try to get from cache first
    const cached = await cache.get<SlotInfo>(cacheKey);
    if (cached) {
        return cached;
    }
    
    try {
        // Use Promise.allSettled to handle failures gracefully
        const [blockResult, blockTimeResult] = await Promise.allSettled([
            connection.getBlock(slot, { 
                maxSupportedTransactionVersion: 0,
                commitment: 'finalized'
            }),
            connection.getBlockTime(slot)
        ]);
        
        const block = blockResult.status === 'fulfilled' ? blockResult.value : null;
        const blockTime = blockTimeResult.status === 'fulfilled' ? blockTimeResult.value : null;
        
        const slotInfo: SlotInfo = {
            slot,
            blockTime,
            blockHeight: slot,
            parentSlot: block?.parentSlot || slot - 1,
            transactionCount: block?.transactions?.length || 0,
            leader: block?.rewards?.[0]?.pubkey || 'Unknown',
            skipRate: 0,
            timestamp: blockTime ? blockTime * 1000 : Date.now()
        };
        
        // Cache the result
        await cache.set(cacheKey, slotInfo, SLOT_CACHE_TTL);
        
        return slotInfo;
    } catch (error) {
        console.warn(`Failed to fetch slot ${slot} details:`, error);
        return null;
    }
}

/**
 * Fetch multiple slot details in parallel
 */
async function fetchSlotsBatch(
    slots: number[], 
    connection: any,
    confirmedBlocks: number[]
): Promise<SlotInfo[]> {
    const promises = slots.map(async (slot) => {
        const isConfirmed = confirmedBlocks.includes(slot);
        
        if (!isConfirmed) {
            // Skipped slot
            return {
                slot,
                blockTime: null,
                blockHeight: slot,
                parentSlot: slot - 1,
                transactionCount: 0,
                leader: 'Skipped',
                skipRate: 1,
                timestamp: Date.now()
            };
        }
        
        // Try to get cached or fresh slot details
        const details = await getCachedSlotDetails(slot, connection);
        
        if (details) {
            return details;
        }
        
        // Fallback if fetch failed
        return {
            slot,
            blockTime: null,
            blockHeight: slot,
            parentSlot: slot - 1,
            transactionCount: 0,
            leader: 'Unknown',
            skipRate: 0,
            timestamp: Date.now()
        };
    });
    
    return Promise.all(promises);
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        // Reduced default limit for better performance
        const limit = Math.min(parseInt(searchParams.get('limit') || '30'), 50);
        const fromSlot = searchParams.get('fromSlot') ? parseInt(searchParams.get('fromSlot')!) : undefined;

        // Create cache key based on parameters
        const cacheKey = `slots:${limit}-${fromSlot || 'current'}`;
        const cached = await cache.get<any>(cacheKey);
        
        if (cached) {
            console.log('✅ Returning cached slots data');
            return NextResponse.json(cached, {
                headers: {
                    'Cache-Control': 'public, max-age=30',
                    'Content-Type': 'application/json',
                    'X-Cache': 'HIT'
                }
            });
        }
        console.log('📊 Cache miss, fetching fresh slots data...');

        const connection = await getConnection();

        // Get current slot and epoch info in parallel
        const [currentSlot, epochInfo] = await Promise.all([
            connection.getSlot(),
            connection.getEpochInfo()
        ]);

        const startSlot = fromSlot || currentSlot;
        const endSlot = Math.max(0, startSlot - limit);

        // Get confirmed blocks with reduced timeout
        const blockFetchPromise = connection.getBlocks(endSlot, startSlot, 'finalized');
        const blockTimeout = new Promise<number[]>((resolve) => {
            setTimeout(() => {
                console.warn('getBlocks timeout, using empty array');
                resolve([]);
            }, 3000); // Reduced to 3s timeout
        });
        
        const confirmedBlocks = await Promise.race([blockFetchPromise, blockTimeout]);

        // Create array of all slots to check
        const allSlots = Array.from({ length: Math.min(limit, startSlot - endSlot + 1) }, (_, i) => startSlot - i);

        // Fetch slot details in parallel batches
        const slots: SlotInfo[] = [];
        
        for (let i = 0; i < allSlots.length; i += BATCH_SIZE) {
            const batchSlots = allSlots.slice(i, i + BATCH_SIZE);
            const batchResults = await fetchSlotsBatch(batchSlots, connection, confirmedBlocks);
            slots.push(...batchResults);
        }

        // Calculate metrics using cached data where possible
        const metricsCacheKey = 'slots:metrics';
        let performanceSamples = await cache.get<any[]>(metricsCacheKey);
        
        if (!performanceSamples) {
            performanceSamples = await connection.getRecentPerformanceSamples(5).catch(() => []);
            if (performanceSamples.length > 0) {
                await cache.set(metricsCacheKey, performanceSamples, 30); // Cache for 30 seconds
            }
        }
        
        const avgBlockTime = performanceSamples.length > 0
            ? performanceSamples.reduce((sum: number, sample: any) => sum + sample.samplePeriodSecs, 0) / performanceSamples.length
            : 0.4; // Default Solana block time

        const skippedSlotsCount = slots.filter(s => s.skipRate === 1).length;
        const totalSlotsAnalyzed = slots.length;

        const metrics: SlotMetrics = {
            averageBlockTime: avgBlockTime,
            skippedSlots: skippedSlotsCount,
            totalSlots: totalSlotsAnalyzed,
            skipRate: totalSlotsAnalyzed > 0 ? (skippedSlotsCount / totalSlotsAnalyzed) * 100 : 0,
            slotsPerSecond: avgBlockTime > 0 ? 1 / avgBlockTime : 2.5,
            epochProgress: (epochInfo.slotIndex / epochInfo.slotsInEpoch) * 100
        };

        const response = {
            success: true,
            data: {
                slots: slots.sort((a, b) => b.slot - a.slot), // Sort by slot descending
                currentSlot,
                epochInfo: {
                    epoch: epochInfo.epoch,
                    slotIndex: epochInfo.slotIndex,
                    slotsInEpoch: epochInfo.slotsInEpoch,
                    absoluteSlot: epochInfo.absoluteSlot,
                    blockHeight: epochInfo.blockHeight || currentSlot,
                    transactionCount: epochInfo.transactionCount || 0
                },
                metrics,
                pagination: {
                    limit,
                    fromSlot: startSlot,
                    hasMore: endSlot > 0,
                    nextCursor: endSlot > 0 ? endSlot - 1 : null
                }
            },
            timestamp: Date.now()
        };

        // Cache the successful response
        await cache.set(cacheKey, response, 30); // Cache for 30 seconds
        console.log('✅ Slots data cached successfully');

        return NextResponse.json(response, {
            headers: {
                'Cache-Control': 'public, max-age=30',
                'Content-Type': 'application/json',
                'X-Cache': 'MISS'
            }
        });

    } catch (error) {
        console.error('Error fetching slot data:', error);

        // Try to return stale cache if available
        const staleCacheKey = `slots:stale`;
        const staleData = await cache.get<any>(staleCacheKey);
        if (staleData) {
            console.log('⚠️ Returning stale cached data due to error');
            return NextResponse.json(staleData, {
                headers: {
                    'Cache-Control': 'public, max-age=10',
                    'Content-Type': 'application/json',
                    'X-Cache': 'STALE'
                }
            });
        }

        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to fetch slot data',
            timestamp: Date.now()
        }, {
            status: 500,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }
}
