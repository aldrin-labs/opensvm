// @ts-nocheck

"use client";

export const dynamic = 'force-dynamic'

import { useEffect, useState } from "react";
import { Connection, SystemProgram } from "@solana/web3.js";

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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 p-2">
      <div className="p-3 bg-white rounded-md shadow">
        <h2 className="text-lg font-semibold mb-2">SOL Supply Stats</h2>
        {loading ? (
          <p>Loading...</p>
        ) : (
          <div className="space-y-1">
            <p>Circulating Supply: {supplyStats?.circulating.toFixed(2)} SOL</p>
            <p>Non-circulating Supply: {supplyStats?.nonCirculating.toFixed(2)} SOL</p>
          </div>
        )}
      </div>

      <div className="p-3 bg-white rounded-md shadow">
        <h2 className="text-lg font-semibold mb-2">Network Stats</h2>
        {loading ? (
          <p>Loading...</p>
        ) : (
          <div className="space-y-1">
            <p>Current TPS: {networkStats?.tps}</p>
            <p>Block Height: {networkStats?.blockHeight}</p>
          </div>
        )}
      </div>

      <div className="p-3 bg-white rounded-md shadow col-span-full mt-2">
        <h2 className="text-lg font-semibold mb-2">Latest Transactions</h2>
        {loading ? (
          <p>Loading...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr>
                  <th className="px-3 py-1 border text-left">Signature</th>
                  <th className="px-3 py-1 border text-left">Timestamp</th>
                  <th className="px-3 py-1 border text-left">Block</th>
                  <th className="px-3 py-1 border text-left">Type</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-3 py-1 border">{tx.signature}</td>
                    <td className="px-3 py-1 border">{tx.timestamp}</td>
                    <td className="px-3 py-1 border">{tx.block}</td>
                    <td className="px-3 py-1 border">{tx.type}</td>
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
