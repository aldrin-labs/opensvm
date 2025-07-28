'use client';

import dynamic from 'next/dynamic';
import LoadingSpinner from '@/components/LoadingSpinner';

// Dynamically import the main TransactionContent component on the client side only
const TransactionContent = dynamic(
    () => import('./TransactionContent'),
    { ssr: false, loading: () => <LoadingSpinner /> }
);

interface Props {
    signature: string;
}

export default function TransactionContentWrapper({ signature }: Props) {
    return <TransactionContent signature={signature} />;
} 