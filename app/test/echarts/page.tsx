'use client';

import dynamic from 'next/dynamic';

// Dynamically import the TestECharts component to avoid SSR issues
const TestECharts = dynamic(
  () => import('@/components/transaction-graph/test-echarts'),
  { ssr: false }
);

export default function EChartsTestPage() {
  return <TestECharts />;
}