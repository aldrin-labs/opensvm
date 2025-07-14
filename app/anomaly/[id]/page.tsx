import { AnomalyProfilePage } from '@/components/AnomalyProfilePage';

interface AnomalyPageProps {
  params: {
    id: string;
  };
}

export default function AnomalyPage({ params }: AnomalyPageProps) {
  return <AnomalyProfilePage anomalyId={params.id} />;
}