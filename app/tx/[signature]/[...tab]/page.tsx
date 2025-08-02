import { redirect } from 'next/navigation';

interface Props {
  params: Promise<{ 
    signature: string;
    tab: string[];
  }>;
}

// Valid tab routes
const VALID_TABS = [
  'overview',
  'instructions', 
  'accounts',
  'graph',
  'ai',
  'metrics',
  'related',
  'failure'
];

export default async function InvalidTabRedirect({ params }: Props) {
  const { signature, tab } = await params;
  
  // Handle base URL case (empty tab array)
  if (!tab || tab.length === 0) {
    // This is the base URL /tx/signature - redirect to overview
    redirect(`/tx/${signature}/overview`);
  }
  
  // Handle single tab case
  const tabName = tab[0];
  
  if (!tabName || !VALID_TABS.includes(tabName)) {
    // Invalid tab - redirect to overview
    redirect(`/tx/${signature}/overview`);
  }
  
  // Valid tabs should be handled by their specific page files
  // But if we reach here, redirect to the specific tab
  redirect(`/tx/${signature}/${tabName}`);
}