'use client';

export const dynamic = 'force-dynamic';

import { LiveEventMonitor } from '@/components/LiveEventMonitor';
import { useSettings } from '@/lib/settings';

export default function MonitoringPage() {
  const settings = useSettings();
  return (
    <div className="container mx-auto px-4 py-6">
      <LiveEventMonitor {...({ settings } as any)} />
    </div>
  );
}
