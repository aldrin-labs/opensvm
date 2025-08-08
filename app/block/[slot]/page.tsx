'use client';

export const dynamic = 'force-dynamic';

import { useParams } from 'next/navigation';
import { useSettings } from '@/lib/settings';
import BlockDetails from '@/components/BlockDetails';

export default function BlockPage() {
  const settings = useSettings();
  const params = useParams();
  const slot = params?.slot as string;

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Block Details</h1>
      <BlockDetails slot={slot} />
    </div>
  );
}