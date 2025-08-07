'use client';

export const dynamic = 'force-dynamic';

import { AnomalyProfilePage } from '@/components/AnomalyProfilePage';
import { useSettings } from '@/app/providers/SettingsProvider';

interface AnomalyPageProps {
  params: Promise<{ [key: string]: string }>
}

export default function AnomalyPage({ params }: AnomalyPageProps) {
  const settings = useSettings();
  const { id } = params;
  return <AnomalyProfilePage anomalyId={id} />;
}