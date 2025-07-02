// @ts-nocheck

"use client";

import { useEffect, useState } from "react";
import { Connection, SystemProgram } from "@solana/web3.js";
import { TrendingTokens } from "@/components/TrendingTokens";
import { DEXAnalytics } from "@/components/DEXAnalytics";

const HELIUS_RPC = "https://mainnet.helius-rpc.com/?api-key=2eb1ae21-40d0-4b6d-adde-ccb3d56ad570";

export default function SolanaExplorer() {
  const [supplyStats, setSupplyStats] = useState<{
    circulating: number;
    nonCirculating: number;
  } | null>(null);
  const [networkStats, setNetworkStats] = useState<{
    tps: number;
    blockHeight: number;
  } | null>(null);
  const [transactions, setTransactions] = useState<Array<{
    signature: string;
    timestamp: string;
    block: number;
    type: string;
  }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const connection = new Connection(HELIUS_RPC);

    const fetchData = async () => {
      try {
        // Fetch supply stats
        const supply = await connection.getSupply();
        setSupplyStats({
          circulating: supply.value.circulating / 1e9,
          nonCirculating: supply.value.nonCirculating / 1e9,
        });

        // Fetch network stats
        const [slot, performance] = await Promise.all([
          connection.getSlot(),
          connection.getRecentPerformanceSamples(1),
        ]);
        
        setNetworkStats({
          tps: Math.round(performance[0]?.numTransactions / performance[0]?.samplePeriodSecs || 0),
          blockHeight: slot,
        });

        // Fetch recent transactions
        const signatures = await connection.getSignaturesForAddress(
          SystemProgram.programId,
          { limit: 5 }
        );

        const txData = signatures.map(sig => ({
          signature: sig.signature,
          timestamp: new Date(sig.blockTime! * 1000).toLocaleString(),
          block: sig.slot,
          type: sig.memo || "Transaction",
        }));

        setTransactions(txData);
        setLoading(false);
        setError(null);
      } catch (err) {
        console.error("Error fetching data:", err);
        setError("Failed to fetch blockchain data.");
        setLoading(false);
      }
    };

    fetchData();
  }, []); // Only fetch once on mount

  if (error) {
    return (
      <div className="p-4 bg-white rounded-lg shadow">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      {/* Network Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">SOL Supply Stats</h2>
          {loading ? (
            <p className="text-gray-600 dark:text-gray-400">Loading...</p>
          ) : (
            <div className="space-y-2">
              <p className="text-gray-700 dark:text-gray-300">
                Circulating Supply: <span className="font-mono">{supplyStats?.circulating.toFixed(2)} SOL</span>
              </p>
              <p className="text-gray-700 dark:text-gray-300">
                Non-circulating Supply: <span className="font-mono">{supplyStats?.nonCirculating.toFixed(2)} SOL</span>
              </p>
            </div>
          )}
        </div>

        <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">Network Stats</h2>
          {loading ? (
            <p className="text-gray-600 dark:text-gray-400">Loading...</p>
          ) : (
            <div className="space-y-2">
              <p className="text-gray-700 dark:text-gray-300">
                Current TPS: <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{networkStats?.tps}</span>
              </p>
              <p className="text-gray-700 dark:text-gray-300">
                Block Height: <span className="font-mono">{networkStats?.blockHeight?.toLocaleString()}</span>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* DEX Analytics */}
      <DEXAnalytics />

      {/* Trending Tokens */}
      <TrendingTokens />

      {/* Recent Transactions */}
      <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
        <h2 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">Latest Transactions</h2>
        {loading ? (
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="px-4 py-2 text-left text-gray-900 dark:text-gray-100">Signature</th>
                  <th className="px-4 py-2 text-left text-gray-900 dark:text-gray-100">Timestamp</th>
                  <th className="px-4 py-2 text-left text-gray-900 dark:text-gray-100">Block</th>
                  <th className="px-4 py-2 text-left text-gray-900 dark:text-gray-100">Type</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx, index) => (
                  <tr key={index} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-2 font-mono text-sm text-gray-700 dark:text-gray-300 truncate max-w-xs">
                      {tx.signature}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">{tx.timestamp}</td>
                    <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">{tx.block.toLocaleString()}</td>
                    <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">{tx.type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
