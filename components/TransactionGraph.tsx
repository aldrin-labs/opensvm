'use client';

import dynamic from 'next/dynamic';
import { TransactionGraphProps } from './transaction-graph/types';

// Dynamically import the ECharts component to avoid SSR issues
const EChartsTransactionGraph = dynamic(
  () => import('./transaction-graph/EChartsTransactionGraph'),
  { ssr: false }
);

export default EChartsTransactionGraph;
export * from './transaction-graph/types';