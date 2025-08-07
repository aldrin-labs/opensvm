'use client';

export const dynamic = 'force-dynamic';

import React from 'react';
import { useSettings } from '@/app/providers/SettingsProvider';

export default function TransactionPage() {
  const settings = useSettings();
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-background rounded-lg p-6 shadow-lg border border-border">
        <h1 className="text-2xl font-semibold mb-4 text-foreground">Transaction Explorer</h1>
        <p className="text-muted-foreground">
          Enter a transaction signature in the URL to view its details.
        </p>
      </div>
    </div>
  );
}