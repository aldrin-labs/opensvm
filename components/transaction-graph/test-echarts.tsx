'use client';

import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import 'echarts-gl';
import { initializeECharts, formatGraphData, updateGraphData } from './echarts-renderer';

// Sample data for testing
const sampleNodes = [
  { data: { id: 'tx1', label: 'Transaction 1', type: 'transaction', success: true } },
  { data: { id: 'tx2', label: 'Transaction 2', type: 'transaction', success: false } },
  { data: { id: 'acc1', label: 'Account 1', type: 'account' } },
  { data: { id: 'acc2', label: 'Account 2', type: 'account' } }
];

const sampleEdges = [
  { data: { id: 'e1', source: 'tx1', target: 'acc1', type: 'connection' } },
  { data: { id: 'e2', source: 'tx2', target: 'acc2', type: 'connection' } },
  { data: { id: 'e3', source: 'acc1', target: 'acc2', type: 'transfer', label: '100 SOL' } }
];

export default function TestECharts() {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    
    // Initialize ECharts
    const chart = initializeECharts(containerRef.current);
    chartRef.current = chart;
    
    // Update with sample data
    updateGraphData(chart, sampleNodes, sampleEdges);
    
    // Clean up on unmount
    return () => {
      if (chartRef.current) {
        chartRef.current.dispose();
      }
    };
  }, []);

  return (
    <div className="flex flex-col h-screen">
      <h1 className="text-2xl font-bold p-4">ECharts GL Test</h1>
      <div 
        ref={containerRef} 
        className="flex-1 bg-muted/50 rounded-lg border border-border"
      />
    </div>
  );
}