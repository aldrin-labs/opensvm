import { NextResponse } from 'next/server';
import { getConnection } from '@/lib/solana-connection-server';

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

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
        const fromSlot = searchParams.get('fromSlot') ? parseInt(searchParams.get('fromSlot')!) : undefined;

        const connection = await getConnection();

        // Get current slot and epoch info
        const [currentSlot, epochInfo] = await Promise.all([
            connection.getSlot(),
            connection.getEpochInfo()
        ]);

        const startSlot = fromSlot || currentSlot;
        const endSlot = Math.max(0, startSlot - limit);

        // Get blocks in the slot range
        const confirmedBlocks = await connection.getBlocks(endSlot, startSlot);

        // Create slot information including skipped slots
        const slots: SlotInfo[] = [];
        const allSlots = Array.from({ length: startSlot - endSlot + 1 }, (_, i) => startSlot - i);

        for (const slot of allSlots) {
            if (slots.length >= limit) break;

            const isConfirmed = confirmedBlocks.includes(slot);
            let slotInfo: SlotInfo;

            if (isConfirmed) {
                try {
                    // Get block details for confirmed slots
                    const [block, blockTime] = await Promise.all([
                        connection.getBlock(slot, { maxSupportedTransactionVersion: 0 }).catch(() => null),
                        connection.getBlockTime(slot).catch(() => null)
                    ]);

                    slotInfo = {
                        slot,
                        blockTime,
                        blockHeight: slot, // Approximation - actual block height may differ
                        parentSlot: block?.parentSlot || slot - 1,
                        transactionCount: block?.transactions?.length || 0,
                        leader: block?.rewards?.[0]?.pubkey || 'Unknown',
                        skipRate: 0, // Confirmed blocks are not skipped
                        timestamp: blockTime ? blockTime * 1000 : Date.now()
                    };
                } catch (error) {
                    // Fallback for blocks that can't be fetched
                    slotInfo = {
                        slot,
                        blockTime: null,
                        blockHeight: slot,
                        parentSlot: slot - 1,
                        transactionCount: 0,
                        leader: 'Unknown',
                        skipRate: 0,
                        timestamp: Date.now()
                    };
                }
            } else {
                // Skipped slot
                slotInfo = {
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

            slots.push(slotInfo);
        }

        // Calculate metrics
        const skippedSlotsCount = slots.filter(s => s.skipRate === 1).length;
        const totalSlotsAnalyzed = slots.length;        // Calculate average block time from recent performance samples
        const performanceSamples = await connection.getRecentPerformanceSamples(5).catch(() => []);
        const avgBlockTime = performanceSamples.length > 0
            ? performanceSamples.reduce((sum, sample) => sum + sample.samplePeriodSecs, 0) / performanceSamples.length
            : 0.4; // Default Solana block time

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

        return NextResponse.json(response, {
            headers: {
                'Cache-Control': 'no-store, max-age=0',
                'Content-Type': 'application/json'
            }
        });

    } catch (error) {
        console.error('Error fetching slot data:', error);

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
