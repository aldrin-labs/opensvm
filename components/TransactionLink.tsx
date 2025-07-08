'use client';

import { useRouter } from 'next/navigation';
import { isValidTransactionSignature } from '@/lib/validators';

interface TransactionLinkProps {
  signature: string;
  className?: string;
  children?: React.ReactNode;
}

export default function TransactionLink({ signature, className, children }: TransactionLinkProps) {
  const router = useRouter();
  
  // Don't render as link if signature is invalid
  if (!signature || !isValidTransactionSignature(signature)) {
    return <span className={className}>{children || signature}</span>;
  }

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    // Double-check validation before navigation
    if (isValidTransactionSignature(signature)) {
      router.push(`/tx/${signature}`);
    }
  };

  return (
    <a href={`/tx/${signature}`} onClick={handleClick} className={className}>
      {children || signature}
    </a>
  );
}