import { AnomalyProfilePage } from '@/components/AnomalyProfilePage';

interface AnomalyPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function AnomalyPage({ params }: AnomalyPageProps) {
  const { id } = await params;
  return <AnomalyProfilePage anomalyId={id} />;
}