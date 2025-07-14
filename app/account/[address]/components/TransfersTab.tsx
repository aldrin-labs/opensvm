"use client";

import { memo } from 'react';
import { TransfersTable } from '@/components/TransfersTable';

interface Props {
  address: string;
  transferType?: 'SOL' | 'TOKEN' | 'ALL';
}

function TransfersTabComponent({ address, transferType = 'ALL' }: Props) {
  return (
    <div className="w-full h-full">
      <TransfersTable key={`${address}-${transferType}`} address={address} transferType={transferType} />
    </div>
  );
}

export default memo(TransfersTabComponent);
