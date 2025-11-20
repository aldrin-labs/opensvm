/**
 * Interactive transaction flow visualization component using D3.js
 * 
 * This component renders a force-directed graph visualization of Solana transactions,
 * showing relationships between accounts, programs, and signers.
 * 
 * @see docs/architecture/components.md#transaction-components
 * @see docs/architecture/adr/002-frontend-framework-choice.md
 * @see docs/architecture/system-overview.md#data-visualization-system
 */

'use client';

import type { DetailedTransactionInfo } from '@/lib/solana/solana';
import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface TransactionFlowChartProps {
  tx: DetailedTransactionInfo;
}

interface Node {
  id: string;
  type: 'signer' | 'account' | 'program';
  index: number;
  x?: number;
  y?: number;
}

interface Link {
  source: string | Node;
  target: string | Node;
}

/**
 * TransactionFlowChart renders interactive transaction flow visualizations
 * 
 * Features:
 * - Force-directed graph layout using D3.js
 * - Interactive node dragging and zooming
 * - Color-coded node types (signer, account, program)
 * - Dynamic relationship visualization
 * 
 * @param tx - Detailed transaction information from Solana RPC
 * @returns React component with SVG-based transaction visualization
 */
export default function TransactionFlowChart({ tx }: TransactionFlowChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !tx.details?.accounts || !tx.details?.instructions) {
      return;
    }

    // Clear previous content
    d3.select(svgRef.current).selectAll('*').remove();

    // Extract nodes and links
    const nodes: Node[] = [];
    const links: Link[] = [];

    // Add account nodes
    tx.details?.accounts.forEach((account: any, i: number) => {
      nodes.push({
        id: account.pubkey.toString(),
        type: account.signer ? 'signer' : 'account',
        index: i
      });
    });

    // Add program nodes and links
    tx.details?.instructions.forEach((ix: any) => {
      const programId = ix.programId.toString();
      if (!nodes.some(n => n.id === programId)) {
        nodes.push({
          id: programId,
          type: 'program',
          index: nodes.length
        });
      }

      // Link program to accounts
      ix.accounts.forEach((accountIndex: number) => {
        links.push({
          source: programId,
          target: tx.details?.accounts?.[accountIndex]?.pubkey.toString() || ''
        });
      });
    });

    // Setup SVG
    const width = 600;
    const height = 400;
    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height);

    // Create force simulation
    const simulation = d3.forceSimulation<Node>(nodes)
      .force('link', d3.forceLink<Node, Link>(links)
        .id(d => d.id)
        .distance(50))
      .force('charge', d3.forceManyBody().strength(-100))
      .force('center', d3.forceCenter(width / 2, height / 2));

    // Draw links
    const link = svg.append('g')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', '#666')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', 1);

    // Draw nodes
    const node = svg.append('g')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .call(d3.drag<any, Node>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended));

    // Add circles to nodes
    node.append('circle')
      .attr('r', d => d.type === 'program' ? 8 : 5)
      .attr('fill', d => {
        switch (d.type) {
          case 'signer': return '#4CAF50';
          case 'program': return '#2196F3';
          default: return '#9E9E9E';
        }
      });

    // Add labels
    node.append('text')
      .attr('x', 8)
      .attr('y', '.31em')
      .attr('fill', '#E0E0E0')
      .text(d => d.id.slice(0, 4) + '...');

    // Add tooltips
    node.append('title')
      .text(d => `${d.type}: ${d.id}`);

    // Update positions on simulation tick
    simulation.on('tick', () => {
      link
        .attr('x1', d => (d.source as Node).x || 0)
        .attr('y1', d => (d.source as Node).y || 0)
        .attr('x2', d => (d.target as Node).x || 0)
        .attr('y2', d => (d.target as Node).y || 0);

      node
        .attr('transform', d => `translate(${d.x || 0},${d.y || 0})`);
    });

    // Drag functions
    function dragstarted(event: d3.D3DragEvent<SVGGElement, Node, Node>) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.x = event.x;
      event.subject.y = event.y;
    }

    function dragged(event: d3.D3DragEvent<SVGGElement, Node, Node>) {
      event.subject.x = event.x;
      event.subject.y = event.y;
    }

    function dragended(event: d3.D3DragEvent<SVGGElement, Node, Node>) {
      if (!event.active) simulation.alphaTarget(0);
    }

    // Cleanup
    return () => {
      simulation.stop();
    };
  }, [tx]);

  return (
    <div className="w-full h-[400px] bg-neutral-900 rounded-lg overflow-hidden">
      <svg ref={svgRef} className="w-full h-full" />
    </div>
  );
}
