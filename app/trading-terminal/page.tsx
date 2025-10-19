'use client';

export const dynamic = 'force-dynamic';

import React from 'react';
import TradingTerminalView from './components/TradingTerminalView';

export default function TradingTerminalPage() {
  return (
    <div className="ai-trading-terminal-page-wrapper min-h-screen bg-background">
      <TradingTerminalView />
    </div>
  );
}
