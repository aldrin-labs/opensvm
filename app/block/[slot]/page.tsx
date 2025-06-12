import { notFound } from 'next/navigation';
import BlockDetails from '@/components/BlockDetails';

interface Props {
  params: Promise<{ slot: string }>;
}

export default async function BlockPage({ params }: Props) {
  const { slot } = await params;

  // Validate slot parameter
  if (!slot) {
    notFound();
  }

  // Validate that slot is a positive integer
  const slotNumber = parseInt(slot, 10);
  if (isNaN(slotNumber) || slotNumber < 0 || !Number.isInteger(slotNumber)) {
    notFound();
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Block Details</h1>
      <BlockDetails slot={slot} />
    </div>
  );
}