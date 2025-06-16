import { notFound } from 'next/navigation';
import BlockDetails from '@/components/BlockDetails';
import { isValidSlot } from '@/lib/validators';

interface Props {
  params: Promise<{ slot: string }>;
}

export default async function BlockPage({ params }: Props) {
  const { slot } = await params;

  // Validate slot parameter using shared validation
  if (!slot || !isValidSlot(slot)) {
    notFound();
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Block Details</h1>
      <BlockDetails slot={slot} />
    </div>
  );
}