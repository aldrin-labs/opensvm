import React from 'react';

interface TrackingStats {
  totalTransactions: number;
  splTransfers: number;
  filteredSplTransfers: number;
  topVolumeByAddress: Array<{
    address: string;
    volume: number;
    tokenSymbol: string;
  }>;
  topVolumeByToken: Array<{
    token: string;
    volume: number;
    transactionCount: number;
  }>;
  lastUpdate: number;
  isTracking: boolean;
  trackedAddress: string | null;
}

interface TrackingStatsPanelProps {
  stats: TrackingStats | null;
  onStopTracking: () => void;
}

export const TrackingStatsPanel: React.FC<TrackingStatsPanelProps> = ({
  stats,
  onStopTracking
}) => {
  if (!stats || !stats.isTracking) return null;

  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  };

  return (
    <div className="fixed top-4 right-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 w-80 z-50 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Live Tracking
          </h3>
        </div>
        <button
          onClick={onStopTracking}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          title="Stop tracking"
        >
          ✕
        </button>
      </div>

      <div className="mb-3">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Address: <span className="font-mono">{formatAddress(stats.trackedAddress || '')}</span>
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Updated {formatTime(stats.lastUpdate)}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="text-center">
          <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
            {stats.totalTransactions}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400">
            Total TXs
          </div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-green-600 dark:text-green-400">
            {stats.splTransfers}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400">
            SPL Transfers
          </div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
            {stats.filteredSplTransfers}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400">
            Filtered
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
            Top 5 Volume by Address
          </h4>
          <div className="space-y-1">
            {stats.topVolumeByAddress.slice(0, 5).map((item, index) => (
              <div key={item.address} className="flex justify-between text-xs">
                <span className="font-mono text-gray-600 dark:text-gray-400">
                  {formatAddress(item.address)}
                </span>
                <span className="font-semibold">
                  {item.volume.toLocaleString()} {item.tokenSymbol}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
            Top 5 Volume by Token
          </h4>
          <div className="space-y-1">
            {stats.topVolumeByToken.slice(0, 5).map((item, index) => (
              <div key={item.token} className="flex justify-between text-xs">
                <span className="text-gray-600 dark:text-gray-400">
                  {item.token}
                </span>
                <div className="text-right">
                  <div className="font-semibold">
                    {item.volume.toLocaleString()}
                  </div>
                  <div className="text-gray-500">
                    {item.transactionCount} txs
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};