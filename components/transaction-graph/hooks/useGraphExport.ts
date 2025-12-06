'use client';

import { useCallback } from 'react';
import cytoscape from 'cytoscape';

interface ExportOptions {
  filename?: string;
  scale?: number;
  backgroundColor?: string;
  includeMetadata?: boolean;
}

/**
 * Hook for exporting graph in various formats
 */
export function useGraphExport() {
  /**
   * Export graph as PNG image
   */
  const exportAsPNG = useCallback((
    cy: cytoscape.Core,
    options: ExportOptions = {}
  ) => {
    const {
      filename = `graph-export-${Date.now()}`,
      scale = 2,
      backgroundColor = '#ffffff'
    } = options;

    const png = cy.png({
      output: 'blob',
      bg: backgroundColor,
      scale,
      full: true
    });

    const link = document.createElement('a');
    link.href = URL.createObjectURL(png);
    link.download = `${filename}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);

    return true;
  }, []);

  /**
   * Export graph as SVG
   */
  const exportAsSVG = useCallback((
    cy: cytoscape.Core,
    options: ExportOptions = {}
  ) => {
    const { filename = `graph-export-${Date.now()}` } = options;

    const svg = cy.svg({
      full: true,
      scale: 1,
      bg: 'transparent'
    });

    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);

    return true;
  }, []);

  /**
   * Export graph as JSON (nodes, edges, positions, metadata)
   */
  const exportAsJSON = useCallback((
    cy: cytoscape.Core,
    options: ExportOptions = {}
  ) => {
    const {
      filename = `graph-export-${Date.now()}`,
      includeMetadata = true
    } = options;

    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      viewport: {
        zoom: cy.zoom(),
        pan: cy.pan()
      },
      nodes: cy.nodes().map(node => ({
        id: node.id(),
        data: node.data(),
        position: node.position(),
        classes: node.classes()
      })),
      edges: cy.edges().map(edge => ({
        id: edge.id(),
        data: edge.data(),
        classes: edge.classes()
      })),
      ...(includeMetadata && {
        metadata: {
          nodeCount: cy.nodes().length,
          edgeCount: cy.edges().length,
          accountNodes: cy.nodes('[type="account"]').length,
          transactionNodes: cy.nodes('[type="transaction"]').length
        }
      })
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);

    return exportData;
  }, []);

  /**
   * Import graph from JSON
   */
  const importFromJSON = useCallback((
    cy: cytoscape.Core,
    jsonData: any,
    options: { clearExisting?: boolean; animate?: boolean } = {}
  ) => {
    const { clearExisting = true, animate = true } = options;

    if (clearExisting) {
      cy.elements().remove();
    }

    // Add nodes
    jsonData.nodes?.forEach((node: any) => {
      cy.add({
        group: 'nodes',
        data: node.data,
        position: node.position,
        classes: node.classes?.join(' ') || ''
      });
    });

    // Add edges
    jsonData.edges?.forEach((edge: any) => {
      cy.add({
        group: 'edges',
        data: edge.data,
        classes: edge.classes?.join(' ') || ''
      });
    });

    // Restore viewport
    if (jsonData.viewport) {
      if (animate) {
        cy.animate({
          zoom: jsonData.viewport.zoom,
          pan: jsonData.viewport.pan,
          duration: 500
        });
      } else {
        cy.viewport(jsonData.viewport);
      }
    }

    return true;
  }, []);

  /**
   * Copy graph data to clipboard
   */
  const copyToClipboard = useCallback(async (
    cy: cytoscape.Core,
    format: 'json' | 'addresses' | 'signatures' = 'addresses'
  ) => {
    let text = '';

    switch (format) {
      case 'json':
        const exportData = {
          nodes: cy.nodes().map(n => ({ id: n.id(), type: n.data('type') })),
          edges: cy.edges().map(e => ({ source: e.data('source'), target: e.data('target') }))
        };
        text = JSON.stringify(exportData, null, 2);
        break;

      case 'addresses':
        text = cy.nodes('[type="account"]')
          .map(n => n.id())
          .join('\n');
        break;

      case 'signatures':
        text = cy.nodes('[type="transaction"]')
          .map(n => n.id())
          .join('\n');
        break;
    }

    await navigator.clipboard.writeText(text);
    return true;
  }, []);

  /**
   * Generate shareable URL with graph state
   */
  const generateShareableURL = useCallback((
    cy: cytoscape.Core,
    baseUrl: string
  ) => {
    const state = {
      accounts: cy.nodes('[type="account"]').map(n => n.id()).slice(0, 10),
      zoom: Math.round(cy.zoom() * 100) / 100,
      pan: {
        x: Math.round(cy.pan().x),
        y: Math.round(cy.pan().y)
      }
    };

    const encoded = btoa(JSON.stringify(state));
    return `${baseUrl}?graph=${encoded}`;
  }, []);

  return {
    exportAsPNG,
    exportAsSVG,
    exportAsJSON,
    importFromJSON,
    copyToClipboard,
    generateShareableURL
  };
}

export default useGraphExport;
