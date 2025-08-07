'use client';

export const dynamic = 'force-dynamic';

import { TransfersTable } from '@/components/TransfersTable';
import { useSettings } from '@/app/providers/SettingsProvider';
import { useSearchParams } from 'next/navigation';

const DEFAULT_ADDRESS = 'DfiQz1pkh3FhKz4ZqHyBQHrKR5HRMhMFYgUZS8h6yRet';

export default function TransfersTestPage() {
  const settings = useSettings();
  const searchParams = useSearchParams();
  const address = searchParams.get('address') || DEFAULT_ADDRESS;

  if (!address) {
    return <div>No address provided</div>;
  }

  return (
    <div className="min-h-screen bg-black p-4">
      <div className="container mx-auto">
        <h1 className="text-2xl font-bold text-white mb-4">
          Transfers Table Test Page
        </h1>
        <div className="bg-neutral-900 rounded-lg p-4">
          <TransfersTable address={address} />
        </div>
      </div>
    </div>
  );
}