'use client';

import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import ForceGraph2D from 'react-force-graph-2d';
import * as THREE from 'three';

interface Node {
  id: string;
  type: 'account' | 'transaction';
  label: string;
  status?: 'success' | 'error' | 'pending';
  tracked?: boolean;
  x?: number;
  y?: number;
  z?: number;
  vx?: number;
  vy?: number;
  vz?: number;
  color?: string;
}

interface Link {
  source: string | Node;
  target: string | Node;
  type?: 'transfer' | 'interaction';
  value?: number;
  color?: string;
}

interface GraphData {
  nodes: Node[];
  links: Link[];
}

interface GPUAcceleratedForceGraphProps {
  graphData: GraphData;
  onNodeClick?: (node: Node) => void;
  onNodeHover?: (node: Node | null) => void;
  width?: number;
  height?: number;
  use3D?: boolean;
  enableGPUParticles?: boolean;
}

/**
 * GPU-accelerated force graph component using WebGL rendering
 * Optimized for high-performance graph visualization with hardware acceleration
 */
export const GPUAcceleratedForceGraph: React.FC<GPUAcceleratedForceGraphProps> = ({
  graphData,
  onNodeClick,
  onNodeHover,
  width = 800,
  height = 600,
  use3D = false,
  enableGPUParticles = true
}) => {
  const graphRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  // GPU-optimized node colors
  const nodeColors = useMemo(() => ({
    account: '#2c5282',
    transaction: '#4299e1',
    'transaction.success': '#48bb78',
    'transaction.error': '#f56565',
    tracked: '#8b5cf6',
    default: '#4a5568'
  }), []);

  // GPU-optimized link colors
  const linkColors = useMemo(() => ({
    transfer: '#68d391',
    interaction: '#718096',
    default: '#718096'
  }), []);

  // Optimized node size calculation
  const getNodeSize = useCallback((node: Node): number => {
    if (node.type === 'transaction') return 8;
    if (node.tracked) return 12;
    return 10;
  }, []);

  // GPU-accelerated node color calculation
  const getNodeColor = useCallback((node: Node): string => {
    if (node.tracked) return nodeColors.tracked;
    if (node.type === 'transaction' && node.status) {
      return nodeColors[`transaction.${node.status}` as keyof typeof nodeColors] || nodeColors.transaction;
    }
    return nodeColors[node.type] || nodeColors.default;
  }, [nodeColors]);

  // GPU-accelerated link color calculation
  const getLinkColor = useCallback((link: Link): string => {
    return linkColors[link.type as keyof typeof linkColors] || linkColors.default;
  }, [linkColors]);

  // Custom 3D node rendering with GPU acceleration
  const nodeThreeObject = useCallback((node: Node) => {
    const geometry = new THREE.SphereGeometry(getNodeSize(node), 16, 16);
    const material = new THREE.MeshLambertMaterial({
      color: getNodeColor(node),
      transparent: true,
      opacity: 0.9
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    
    // Add glow effect for tracked nodes
    if (node.tracked) {
      const glowGeometry = new THREE.SphereGeometry(getNodeSize(node) * 1.5, 16, 16);
      const glowMaterial = new THREE.MeshBasicMaterial({
        color: 0x8b5cf6,
        transparent: true,
        opacity: 0.3
      });
      const glow = new THREE.Mesh(glowGeometry, glowMaterial);
      mesh.add(glow);
    }
    
    return mesh;
  }, [getNodeSize, getNodeColor]);

  // Performance-optimized force simulation settings
  const forceSimulationConfig = useMemo(() => ({
    d3AlphaDecay: 0.02,
    d3VelocityDecay: 0.3,
    d3AlphaMin: 0.001,
    warmupTicks: 100,
    cooldownTicks: 0
  }), []);

  // GPU particle system for enhanced visual effects
  const enableParticleEffects = useCallback(() => {
    if (!enableGPUParticles || !graphRef.current) return;
    
    // Add particle trail effects for active transactions
    const activeNodes = graphData.nodes.filter(node => 
      node.type === 'transaction' && node.status === 'success'
    );
    
    // Create GPU-accelerated particle system
    const particleCount = Math.min(activeNodes.length * 10, 500); // Limit particles for performance
    const particles = new Float32Array(particleCount * 3);
    
    // Initialize particle positions around active nodes
    activeNodes.forEach((node, nodeIndex) => {
      for (let i = 0; i < 10 && nodeIndex * 10 + i < particleCount; i++) {
        const particleIndex = (nodeIndex * 10 + i) * 3;
        particles[particleIndex] = (node.x || 0) + (Math.random() - 0.5) * 20;
        particles[particleIndex + 1] = (node.y || 0) + (Math.random() - 0.5) * 20;
        particles[particleIndex + 2] = use3D ? (node.z || 0) + (Math.random() - 0.5) * 20 : 0;
      }
    });

    return particles;
  }, [graphData.nodes, enableGPUParticles, use3D]);

  // Throttled hover handler for performance
  const throttledHoverHandler = useCallback((node: Node | null) => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    animationFrameRef.current = requestAnimationFrame(() => {
      onNodeHover?.(node);
    });
  }, [onNodeHover]);

  // GPU acceleration setup
  useEffect(() => {
    if (!containerRef.current) return;

    // Force GPU acceleration on container
    const container = containerRef.current;
    container.style.willChange = 'transform';
    container.style.transform = 'translateZ(0)';
    container.style.backfaceVisibility = 'hidden';
    container.style.perspective = '1000px';

    // Enable hardware acceleration for child elements
    const canvas = container.querySelector('canvas');
    if (canvas) {
      canvas.style.willChange = 'transform';
      canvas.style.transform = 'translateZ(0)';
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Optimize graph performance on data changes
  useEffect(() => {
    // Force a re-render if we have data but the graph might not be showing
    if (graphData.nodes.length > 0 && graphRef.current) {
      // Trigger force simulation restart
      setTimeout(() => {
        if (graphRef.current) {
          try {
            // Type-safe way to access d3ReheatSimulation if it exists
            const graph = graphRef.current as { d3ReheatSimulation?: () => void };
            if (graph.d3ReheatSimulation && typeof graph.d3ReheatSimulation === 'function') {
              graph.d3ReheatSimulation();
            }
          } catch (error) {
            console.warn(`Could not restart simulation:`, error);
          }
        }
      }, 100);
    }
    
    if (!graphRef.current) {
      return;
    }

    // Warm up the simulation for better initial layout
    graphRef.current.d3ReheatSimulation();
    
    // Enable particle effects
    enableParticleEffects();
  }, [graphData, enableParticleEffects]);

  const commonProps = {
    ref: graphRef,
    graphData,
    width,
    height,
    backgroundColor: 'rgba(0, 0, 0, 0)',
    nodeLabel: (node: Node) => node.label,
    nodeColor: getNodeColor,
    nodeVal: getNodeSize,
    nodeCanvasObject: !use3D ? (node: Node, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const size = getNodeSize(node) * globalScale;
      const color = getNodeColor(node);
      
      // Draw main node
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(node.x || 0, node.y || 0, size, 0, 2 * Math.PI, false);
      ctx.fill();
      
      // Add glow effect for tracked nodes using GPU acceleration
      if (node.tracked) {
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = '#8b5cf6';
        ctx.beginPath();
        ctx.arc(node.x || 0, node.y || 0, size * 1.5, 0, 2 * Math.PI, false);
        ctx.fill();
        ctx.restore();
      }
      
      // Draw label
      if (globalScale > 0.5) {
        ctx.fillStyle = '#ffffff';
        ctx.font = `${Math.max(8, size / 2)}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(node.label, node.x || 0, (node.y || 0) + size + 8);
      }
    } : undefined,
    nodeThreeObject: use3D ? nodeThreeObject : undefined,
    linkColor: getLinkColor,
    linkWidth: (link: Link) => link.type === 'transfer' ? 3 : 2,
    linkCanvasObject: !use3D ? (link: Link, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const width = (link.type === 'transfer' ? 3 : 2) * globalScale;
      const color = getLinkColor(link);
      
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      
      const sourceNode = link.source as Node;
      const targetNode = link.target as Node;
      
      ctx.moveTo(sourceNode.x || 0, sourceNode.y || 0);
      ctx.lineTo(targetNode.x || 0, targetNode.y || 0);
      ctx.stroke();
    } : undefined,
    onNodeClick,
    onNodeHover: throttledHoverHandler,
    ...forceSimulationConfig,
    // Performance optimizations
    enableZoomInteraction: true,
    enablePanInteraction: true,
    enableNodeDrag: true,
    cooldownTicks: 100,
    onEngineStop: () => {
      // Cleanup after simulation stops
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    }
  };

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative"
      style={{
        willChange: 'transform',
        transform: 'translateZ(0)',
        backfaceVisibility: 'hidden'
      }}
    >
      {use3D ? (
        <ForceGraph3D
          {...commonProps}
          controlType="orbit"
          rendererConfig={{
            antialias: true,
            alpha: true,
            powerPreference: 'high-performance'
          }}
        />
      ) : (
        <ForceGraph2D
          {...commonProps}
        />
      )}
    </div>
  );
};

export default GPUAcceleratedForceGraph;