'use client';

import React from 'react';
import type { DetailedTransactionInfo } from '@/lib/solana';
import { useEffect, useRef, useMemo, useCallback } from 'react';
import * as d3 from 'd3';

interface ParsedInstruction {
  program: string;
  accounts: number[];
}

interface UnparsedInstruction {
  programId: { toString(): string };
  accounts: number[];
}

interface TransactionAccount {
  pubkey: { toString(): string };
  signer: boolean;
}

type InstructionWithAccounts = ParsedInstruction | UnparsedInstruction;

interface EnhancedTransactionVisualizerProps {
  tx: DetailedTransactionInfo;
}

interface Node {
  id: string;
  type: 'instruction' | 'program' | 'account' | 'signer';
  data?: any;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

interface Link {
  source: string | Node;
  target: string | Node;
  type: 'execution' | 'interaction';
}

function isParsedInstruction(ix: InstructionWithAccounts): ix is ParsedInstruction {
  return 'program' in ix;
}

function isValidAccount(account: any): account is TransactionAccount {
  return account && typeof account === 'object' && 'pubkey' in account && 'signer' in account;
}

// Memoize the component to prevent unnecessary re-renders
const EnhancedTransactionVisualizer = function({ tx }: EnhancedTransactionVisualizerProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<Node, undefined> | null>(null);

  // Memoize helper functions
  const getNodeRadius = useCallback((node: Node): number => {
    switch (node.type) {
      case 'instruction': return 15;
      case 'program': return 12;
      case 'signer': return 10;
      default: return 8;
    }
  }, []);

  const getNodeColor = useCallback((node: Node): string => {
    switch (node.type) {
      case 'instruction': return '#FF9800';
      case 'program': return '#2196F3';
      case 'signer': return '#4CAF50';
      default: return '#9E9E9E';
    }
  }, []);

  const getNodeLabel = useCallback((node: Node): string => {
    if (node.type === 'instruction') {
      return `IX ${node.id.split('-')[1]}`;
    }
    return `${node.id.slice(0, 4)}...`;
  }, []);

  const getNodeTooltip = useCallback((node: Node): string => {
    switch (node.type) {
      case 'instruction': {
        const instruction = node.data;
        if (isParsedInstruction(instruction)) {
          return `Instruction ${node.id.split('-')[1]}: ${instruction.program}`;
        } else {
          return `Instruction ${node.id.split('-')[1]}: ${instruction.programId.toString().slice(0, 8)}...`;
        }
      }
      case 'program':
        return `Program: ${node.id}`;
      case 'signer':
        return `Signer: ${node.id}`;
      default:
        return `Account: ${node.id}`;
    }
  }, []);

  // Memoize drag functions to prevent recreation on each render
  const dragstarted = useCallback((event: d3.D3DragEvent<SVGGElement, Node, Node>) => {
    if (!event.active && simulationRef.current) simulationRef.current.alphaTarget(0.3).restart();
    event.subject.fx = event.subject.x;
    event.subject.fy = event.subject.y;
  }, []);

  const dragged = useCallback((event: d3.D3DragEvent<SVGGElement, Node, Node>) => {
    event.subject.fx = event.x;
    event.subject.fy = event.y;
  }, []);

  const dragended = useCallback((event: d3.D3DragEvent<SVGGElement, Node, Node>) => {
    if (!event.active && simulationRef.current) simulationRef.current.alphaTarget(0);
    event.subject.fx = null;
    event.subject.fy = null;
  }, []);

  useEffect(() => {
    if (!svgRef.current) return;
    if (!tx.details?.instructions || !tx.details.accounts) {
      console.warn('Transaction details are missing');
      return;
    }

    // Clear previous content
    d3.select(svgRef.current).selectAll('*').remove();

    // Prepare data structures
    const nodes: Node[] = [];
    const links: Link[] = [];

    // Add instruction nodes
    const details = tx.details; // Store in local variable to avoid non-null assertions
    details.instructions.forEach((ix: InstructionWithAccounts, index: number) => {
      const instructionId = `instruction-${index}`;
      nodes.push({
        id: instructionId,
        type: 'instruction',
        data: ix
      });

      // Link instruction to program
      links.push({
        source: instructionId,
        target: isParsedInstruction(ix) ? ix.program : ix.programId.toString(),
        type: 'execution'
      });

      // Link instruction to accounts
      ix.accounts.forEach((accountIndex: number) => {
        if (accountIndex < details.accounts.length) {
          const account = details.accounts[accountIndex];
          if (isValidAccount(account)) {
            links.push({
              source: instructionId,
              target: account.pubkey.toString(),
              type: 'interaction'
            });
          }
        }
      });
    });

    // Add program nodes
    const programs = new Set(details.instructions.map(ix => 
      isParsedInstruction(ix) ? ix.program : ix.programId.toString()
    ));
    programs.forEach(programId => {
      nodes.push({
        id: programId,
        type: 'program'
      });
    });

    // Add account nodes
    details.accounts.forEach(account => {
      if (isValidAccount(account)) {
        nodes.push({
          id: account.pubkey.toString(),
          type: account.signer ? 'signer' : 'account',
          data: account
        });
      }
    });

    // Setup SVG
    const width = 800;
    const height = 600;
    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', [-width / 2, -height / 2, width, height]);

    // Define arrow marker
    svg.append('defs').append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 20)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#666');

    // Create force simulation with optimized parameters for top-to-bottom layout
    const simulation = d3.forceSimulation<Node>(nodes)
      .force('link', d3.forceLink<Node, Link>(links).id(d => d.id).distance(80))
      .force('charge', d3.forceManyBody().strength(-150))
      .force('center', d3.forceCenter(0, 0))
      // Add vertical positioning bias for top-to-bottom flow
      .force('y', d3.forceY(d => {
        // Position instructions at top, programs in middle, accounts at bottom
        if (d.type === 'instruction') return -height/4;
        if (d.type === 'program') return 0;
        return height/4;
      }).strength(0.3))
      .force('x', d3.forceX().strength(0.1)) // Weak horizontal centering
      .force('collision', d3.forceCollide().radius(d => getNodeRadius(d) + 8))
      // Reduce alpha decay for faster stabilization
      .alphaDecay(0.05)
      .alphaMin(0.001);

    // Store simulation in ref to ensure proper cleanup
    simulationRef.current = simulation;

    // Draw links
    const link = svg.append('g')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', d => d.type === 'execution' ? '#4CAF50' : '#666')
      .attr('stroke-width', d => d.type === 'execution' ? 2 : 1)
      .attr('marker-end', 'url(#arrowhead)');

    // Draw nodes
    const node = svg.append('g')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .call(d3.drag<SVGGElement, Node>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended) as any);

    // Add circles to nodes
    node.append('circle')
      .attr('r', d => getNodeRadius(d))
      .attr('fill', d => getNodeColor(d));

    // Add labels to nodes
    node.append('text')
      .attr('x', 0)
      .attr('y', d => getNodeRadius(d) + 12)
      .attr('text-anchor', 'middle')
      .attr('fill', '#9E9E9E')
      .attr('font-size', '10px')
      .text(d => getNodeLabel(d));

    // Add tooltips
    node.append('title')
      .text(d => getNodeTooltip(d));

    // Update positions on simulation tick
    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => (d.source as Node).x || 0)
        .attr('y1', (d: any) => (d.source as Node).y || 0)
        .attr('x2', (d: any) => (d.target as Node).x || 0)
        .attr('y2', (d: any) => (d.target as Node).y || 0);

      node
        .attr('transform', (d: any) => `translate(${d.x || 0},${d.y || 0})`);
    });

    // Cleanup function to prevent memory leaks
    return () => {
      // Stop and cleanup D3 simulation
      if (simulationRef.current) {
        simulationRef.current.stop();
        simulationRef.current = null;
      }
      
      // Clear all SVG content and event listeners
      if (svgRef.current) {
        const svg = d3.select(svgRef.current);
        svg.selectAll('*').remove();
        svg.on('.drag', null);
      }
    };
  }, [tx]);

  return (
    <div className="w-full h-[600px] bg-neutral-900 rounded-lg overflow-hidden">
      <svg ref={svgRef} className="w-full h-full" style={{ willChange: 'transform' }} />
    </div>
  );
};

// Export memoized component to prevent unnecessary re-renders
export default React.memo(EnhancedTransactionVisualizer);
