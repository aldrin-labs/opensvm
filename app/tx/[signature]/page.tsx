'use client';

export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { useSettings } from '@/app/providers/SettingsProvider';

interface Props {
  params: Promise<{ [key: string]: string }>
}

export default function TransactionPage({ params }: Props) {
  const settings = useSettings();
  // Await the params in the server component
  const { signature } = params;

  // Always redirect to overview tab - client-side preference handling happens there
  redirect(`/tx/${signature}/overview`);
}
