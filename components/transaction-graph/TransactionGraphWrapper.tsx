'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { TransactionGraphProps } from './types';

// Dynamically import the components to avoid SSR issues
const TransactionGraph = dynamic(
  () => import('./TransactionGraph'),
  { ssr: false }
);

const EChartsTransactionGraph = dynamic(
  () => import('./EChartsTransactionGraph'),
  { ssr: false }
);

/**
 * TransactionGraphWrapper component that can switch between Cytoscape and ECharts renderers
 */
function TransactionGraphWrapper(props: TransactionGraphProps) {
  // State to track which renderer to use
  const [useECharts, setUseECharts] = useState<boolean>(false);
  
  return (
    <div className="transaction-graph-container relative w-full h-full">
      {/* Renderer toggle */}
      <div className="absolute top-4 left-4 z-10 bg-background/90 p-2 rounded-md shadow-md backdrop-blur-sm border border-border">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium">Renderer</label>
          <select 
            className="text-xs bg-background border border-border rounded-md p-1"
            value={useECharts ? 'echarts' : 'cytoscape'}
            onChange={(e) => setUseECharts(e.target.value === 'echarts')}
          >
            <option value="cytoscape">Cytoscape (Default)</option>
            <option value="echarts">ECharts GL (Better for large graphs)</option>
          </select>
        </div>
      </div>
      
      {/* Render the appropriate component based on the selected renderer */}
      {useECharts ? (
        <EChartsTransactionGraph {...props} />
      ) : (
        <TransactionGraph {...props} />
      )}
    </div>
  );
}

export default TransactionGraphWrapper;