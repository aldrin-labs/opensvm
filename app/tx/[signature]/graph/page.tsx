import { Metadata } from 'next';
import GraphContent from './GraphContent';

interface PageProps {
  params: {
    signature: string;
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { signature } = params;
  
  return {
    title: `Transaction Graph: ${signature.slice(0, 8)}... | OpenSVM`,
    description: `Interactive visualization of transaction ${signature.slice(0, 8)}... and its related accounts and transactions.`,
  };
}

export default function TransactionGraphPage({ params }: PageProps) {
  const { signature } = params;
  
  return <GraphContent signature={signature} />;
}