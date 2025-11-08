'use client';

import { useEffect, useState } from 'react';
import { getClientConnection as getConnection } from '@/lib/solana-connection';

interface Program {
  address: string;
  txCount: number;
}

export function TopPrograms() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchPrograms() {
      try {
        const connection = getConnection();
        const slot = await connection.getSlot();
        const blocks = await connection.getBlocks(Math.max(0, slot - 100), slot);

        // Get transactions from recent blocks
        const programCounts = new Map<string, number>();

        for (const blockSlot of blocks) {
          try {
            const block = await connection.getBlock(blockSlot, {
              maxSupportedTransactionVersion: 0
            });

            if (!block) continue;

            // Count program invocations from logs
            block.transactions.forEach(tx => {
              if (!tx.meta?.logMessages) return;

              tx.meta.logMessages
                .filter(log => log.includes('Program') && log.includes('invoke'))
                .forEach(log => {
                  const match = log.match(/Program (\w+) invoke/);
                  if (!match || !match[1]) return;

                  const program = match[1];
                  programCounts.set(program, (programCounts.get(program) || 0) + 1);
                });
            });
          } catch (error) {
            console.error(`Error fetching block ${blockSlot}:`, error);
          }
        }

        // Convert to array and sort by count
        const sortedPrograms = Array.from(programCounts.entries())
          .map(([address, txCount]) => ({ address, txCount }))
          .sort((a, b) => b.txCount - a.txCount)
          .slice(0, 10); // Get top 10

        setPrograms(sortedPrograms);
      } catch (error) {
        console.error('Error fetching programs:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchPrograms();
    const interval = setInterval(fetchPrograms, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <div className="rounded-lg bg-black/20 backdrop-blur-sm p-6 animate-pulse">
        <h2 className="text-xl font-semibold mb-4">Top Programs</h2>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-muted/50 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-black/20 backdrop-blur-sm p-6">
      <h2 className="text-xl font-semibold mb-4">Top Programs</h2>
      <div className="space-y-4">
        {programs.map((program) => (
          <div
            key={program.address}
            className="flex items-center justify-between p-3 rounded-lg bg-black/30"
          >
            <div className="flex items-center space-x-4">
              <div className="text-sm font-mono">
                <div className="text-foreground/80 truncate w-48">
                  {program.address}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-muted-foreground text-sm">
                {program.txCount.toLocaleString()} txs
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
