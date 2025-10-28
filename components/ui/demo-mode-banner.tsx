"use client";

import { AlertTriangle, RefreshCw, HelpCircle } from "lucide-react";

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
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            <span 
              className="text-sm font-medium text-yellow-500 cursor-help"
              title="You are viewing simulated market data. Real trading is not available in demo mode."
            >
              DEMO MODE - Using Simulated Market Data
            </span>
            <span 
              className="text-xs text-muted-foreground cursor-help"
              title={`Data source: ${dataSource}`}
            >
              ({dataSource})
            </span>
          </div>
          <a
            href="/docs/demo-mode"
            className="flex items-center gap-1 text-xs text-yellow-500 hover:text-yellow-400 transition-colors cursor-pointer"
            title="Learn more about demo mode and how to connect real data"
            target="_blank"
            rel="noopener noreferrer"
          >
            <HelpCircle className="h-3 w-3" />
            <span className="hidden sm:inline">Learn More</span>
          </a>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="flex items-center gap-1 text-xs px-3 py-1 bg-yellow-500/20 hover:bg-yellow-500/30 rounded transition-colors duration-150"
            aria-label="Retry connection to real market data"
            title="Attempt to reconnect to live market data"
          >
            <RefreshCw className="h-3 w-3" />
            <span className="hidden sm:inline">Retry Connection</span>
            <span className="sm:hidden">Retry</span>
          </button>
        )}
      </div>
    </div>
  );
}
