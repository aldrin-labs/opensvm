'use client';

export const dynamic = 'force-dynamic';

import React from 'react';
import { useSettings } from '@/lib/settings';
import TradingTerminalView from './components/TradingTerminalView';

export default function TradingTerminalPage() {
  const settings = useSettings();

  return (
    <div className="ai-trading-terminal-page-wrapper min-h-screen bg-background">
      <TradingTerminalView settings={settings} />
    </div>
  );
}
