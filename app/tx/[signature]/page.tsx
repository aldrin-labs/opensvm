import { redirect } from 'next/navigation';

interface Props {
  params: Promise<{ signature: string }>;
}

export default async function TransactionPage({ params }: Props) {
  // Await the params in the server component
  const { signature } = await params;

  // Always redirect to overview tab - client-side preference handling happens there
  redirect(`/tx/${signature}/overview`);
}
