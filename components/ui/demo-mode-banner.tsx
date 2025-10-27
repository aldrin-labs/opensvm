"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";

interface DemoModeBannerProps {
  isDemo: boolean;
  dataSource?: string;
  onRetry?: () => void;
}

export function DemoModeBanner({ 
  isDemo, 
  dataSource = "Unknown", 
  onRetry 
}: DemoModeBannerProps) {
  if (!isDemo) return null;
  
  return (
    <div className="bg-yellow-500/10 border-b border-yellow-500/30 px-4 py-2">
      <div className="flex items-center justify-between max-w-screen-2xl mx-auto">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-yellow-500" />
          <span className="text-sm font-medium text-yellow-500">
            DEMO MODE - Using Simulated Market Data
          </span>
          <span className="text-xs text-muted-foreground">
            ({dataSource})
          </span>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="flex items-center gap-1 text-xs px-3 py-1 bg-yellow-500/20 hover:bg-yellow-500/30 rounded transition-colors"
            aria-label="Retry connection to real market data"
          >
            <RefreshCw className="h-3 w-3" />
            Retry Connection
          </button>
        )}
      </div>
    </div>
  );
}
