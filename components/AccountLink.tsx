'use client';

import { useRouter } from 'next/navigation';
import { isValidSolanaAddress } from '@/lib/utils';

interface AccountLinkProps {
  address: string;
  className?: string;
  children?: React.ReactNode;
}

export default function AccountLink({ address, className, children }: AccountLinkProps) {
  const router = useRouter();
  
  // Don't render if address is invalid
  if (!address || !isValidSolanaAddress(address)) {
    return <span className={className}>{children || address}</span>;
  }

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    // Double-check validation before navigation
    if (isValidSolanaAddress(address)) {
      router.push(`/account/${address}`);
    }
  };

  return (
    <a href={`/account/${address}`} onClick={handleClick} className={className}>
      {children || address}
    </a>
  );
}