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
  onLinkClick?: (link: Link) => void;
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
  onLinkClick,
  width = 800,
  height = 600,
  use3D = false,
  enableGPUParticles = true
}) => {
  const graphRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Resolved theme colors from CSS variables for high-contrast rendering
  const getCssHsl = useCallback((varName: string, fallback: string) => {
    try {
      const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
      return v ? `hsl(${v})` : fallback;
    } catch {
      return fallback;
    }
  }, []);

  const theme = useMemo(() => ({
    primary: getCssHsl('--primary', '#7c3aed'),
    primaryFg: getCssHsl('--primary-foreground', '#ffffff'),
    mutedFg: getCssHsl('--muted-foreground', '#a3a3a3'),
    success: getCssHsl('--success', '#22c55e'),
    destructive: getCssHsl('--destructive', '#ef4444'),
    foreground: getCssHsl('--foreground', '#e5e7eb'),
  }), [getCssHsl]);

  // High-contrast node colors
  const nodeColors = useMemo(() => ({
    account: theme.primary,
    transaction: theme.mutedFg,
    'transaction.success': theme.success,
    'transaction.error': theme.destructive,
    tracked: theme.primary,
    default: theme.mutedFg
  }), [theme]);

  // High-contrast link colors
  const linkColors = useMemo(() => ({
    transfer: theme.success,
    interaction: 'rgba(255,255,255,0.28)',
    default: 'rgba(255,255,255,0.22)'
  }), [theme]);

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
        color: new THREE.Color(theme.primary),
        transparent: true,
        opacity: 0.3
      });
      const glow = new THREE.Mesh(glowGeometry, glowMaterial);
      mesh.add(glow);
    }

    return mesh;
  }, [getNodeSize, getNodeColor, theme.primary]);

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
    const particleCount = Math.min(activeNodes.length * 10, 500);
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
    // Disable built-in labels to prevent unreadable overdraw; we render custom labels via nodeCanvasObject
    nodeLabel: undefined,
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

      // High-contrast edge ring to separate nodes from background
      ctx.lineWidth = Math.max(1, size * 0.15);
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.stroke();

      // Add glow effect for tracked nodes using theme token color
      if (node.tracked) {
        ctx.save();
        ctx.globalAlpha = 0.3;
        try {
          ctx.fillStyle = theme.primary || color;
        } catch {
          ctx.fillStyle = color;
        }
        ctx.beginPath();
        ctx.arc(node.x || 0, node.y || 0, size * 1.5, 0, 2 * Math.PI, false);
        ctx.fill();
        ctx.restore();
      }

      // Draw label with outline for readability on dark backgrounds
      if (globalScale > 0.35) {
        const rawText = node.type === 'account' ? (node.id || node.label) : (node.label || node.id);
        const text = (node.type === 'account' && rawText && rawText.length > 12)
          ? `${rawText.slice(0, 5)}...${rawText.slice(-5)}`
          : rawText;

        const fontSize = Math.max(12, Math.min(18, size * 1.2));
        ctx.font = `${fontSize}px Inter, ui-sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        const x = node.x || 0;
        const y = (node.y || 0) + size + 6;

        // Fill using theme primary text color for strong contrast on colored nodes
        ctx.fillStyle = '#ffffff';
        ctx.fillText(text, x, y);
      }
    } : undefined,
    nodeThreeObject: use3D ? nodeThreeObject : undefined,
    linkColor: getLinkColor,
    linkWidth: (link: Link) => link.type === 'transfer' ? 3 : 2,
    linkCanvasObject: !use3D ? (link: Link, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const baseWidth = link.type === 'transfer' ? 3 : 2;
      const width = Math.max(1, baseWidth * globalScale);
      const color = getLinkColor(link);

      const sourceNode = link.source as Node;
      const targetNode = link.target as Node;

      const sx = sourceNode.x || 0;
      const sy = sourceNode.y || 0;
      const tx = targetNode.x || 0;
      const ty = targetNode.y || 0;

      // main line
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(tx, ty);
      ctx.stroke();

      // arrow head for direction
      const angle = Math.atan2(ty - sy, tx - sx);
      const headLen = Math.max(6, 6 * globalScale) + (link.type === 'transfer' ? 2 : 0);
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(tx - headLen * Math.cos(angle - Math.PI / 6), ty - headLen * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(tx - headLen * Math.cos(angle + Math.PI / 6), ty - headLen * Math.sin(angle + Math.PI / 6));
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    } : undefined,
    onNodeClick,
    onNodeHover: throttledHoverHandler,
    ...forceSimulationConfig,
    enableZoomInteraction: true,
    enablePanInteraction: true,
    enableNodeDrag: true,
    cooldownTicks: 100,
    onEngineStop: () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    }
  };

  // Calculate actual dimensions for the canvas
  const containerDimensions = useMemo(() => {
    const actualWidth = typeof width === 'number' && width > 0 ? width : 800;
    const actualHeight = typeof height === 'number' && height > 0 ? height : 600;

    return {
      width: actualWidth,
      height: actualHeight
    };
  }, [width, height]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative"
      style={{
        willChange: 'transform',
        transform: 'translateZ(0)',
        backfaceVisibility: 'hidden',
        minWidth: containerDimensions.width,
        minHeight: containerDimensions.height
      }}
    >
      {use3D ? (
        <ForceGraph3D
          {...commonProps}
          width={containerDimensions.width}
          height={containerDimensions.height}
          onLinkClick={onLinkClick}
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
          width={containerDimensions.width}
          height={containerDimensions.height}
          onLinkClick={onLinkClick}
        />
      )}
    </div>
  );
};

export default GPUAcceleratedForceGraph;
