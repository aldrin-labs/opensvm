'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { TransactionGraphProps } from './types';

// Dynamically import the ECharts component to avoid SSR issues
const EChartsTransactionGraph = dynamic(
  () => import('./EChartsTransactionGraph'),
  { ssr: false }
);

/**
 * TransactionGraphWrapper component that uses ECharts renderer
 */
function TransactionGraphWrapper(props: TransactionGraphProps) {
  return <EChartsTransactionGraph {...props} />;
}

export default TransactionGraphWrapper;