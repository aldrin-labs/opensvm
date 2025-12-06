'use client';

import { useState, useCallback, useRef } from 'react';
import cytoscape from 'cytoscape';

interface EnrichedData {
  address: string;
  label?: string;
  type: 'wallet' | 'cex' | 'dex' | 'bridge' | 'program' | 'nft' | 'scam' | 'whale' | 'unknown';
  name?: string;
  icon?: string;
  isWhale?: boolean;
  balance?: number;
  socialLinks?: {
    twitter?: string;
    discord?: string;
    website?: string;
  };
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  tags: string[];
  lastActivity?: Date;
  firstActivity?: Date;
  notes?: string;
}

// Known addresses database (would be expanded in production)
const KNOWN_ADDRESSES: Record<string, Partial<EnrichedData>> = {
  // CEX Hot Wallets
  '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1': {
    label: 'Binance Hot Wallet',
    type: 'cex',
    name: 'Binance',
    riskLevel: 'low',
    tags: ['cex', 'binance', 'verified']
  },
  'FWznbcNXWQuHTawe9RxvQ2LdCENssh12dsznf4RiouN5': {
    label: 'Coinbase Hot Wallet',
    type: 'cex',
    name: 'Coinbase',
    riskLevel: 'low',
    tags: ['cex', 'coinbase', 'verified']
  },
  // DEXes
  '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8': {
    label: 'Raydium AMM',
    type: 'dex',
    name: 'Raydium',
    riskLevel: 'low',
    tags: ['dex', 'amm', 'raydium']
  },
  'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4': {
    label: 'Jupiter Aggregator',
    type: 'dex',
    name: 'Jupiter',
    riskLevel: 'low',
    tags: ['dex', 'aggregator', 'jupiter']
  },
  // Bridges
  'wormDTUJ6AWPNvk59vGQbDvGJmqbDTdgWgAqcLBCgUb': {
    label: 'Wormhole Bridge',
    type: 'bridge',
    name: 'Wormhole',
    riskLevel: 'medium',
    tags: ['bridge', 'wormhole', 'cross-chain']
  },
  // System Programs
  '11111111111111111111111111111111': {
    label: 'System Program',
    type: 'program',
    name: 'Solana System',
    riskLevel: 'low',
    tags: ['system', 'native']
  },
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA': {
    label: 'Token Program',
    type: 'program',
    name: 'SPL Token',
    riskLevel: 'low',
    tags: ['system', 'token', 'spl']
  }
};

// Known scam addresses (would be populated from API)
const SCAM_ADDRESSES = new Set<string>([
  // Add known scammer addresses
]);

// Whale threshold in SOL
const WHALE_THRESHOLD = 10000;

/**
 * Hook for enriching graph data with labels, entity info, and risk scores
 */
export function useDataEnrichment() {
  const [enrichedData, setEnrichedData] = useState<Map<string, EnrichedData>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [whaleAddresses, setWhaleAddresses] = useState<string[]>([]);
  const cacheRef = useRef<Map<string, EnrichedData>>(new Map());

  /**
   * Enrich a single address
   */
  const enrichAddress = useCallback(async (address: string): Promise<EnrichedData> => {
    // Check cache first
    if (cacheRef.current.has(address)) {
      return cacheRef.current.get(address)!;
    }

    // Check known addresses
    const known = KNOWN_ADDRESSES[address];

    // Check scam list
    const isScam = SCAM_ADDRESSES.has(address);

    let data: EnrichedData = {
      address,
      type: 'unknown',
      riskLevel: 'low',
      tags: []
    };

    if (known) {
      data = {
        ...data,
        ...known,
        tags: known.tags || []
      };
    }

    if (isScam) {
      data.type = 'scam';
      data.riskLevel = 'critical';
      data.tags.push('scam', 'flagged');
      data.label = 'SCAM - Known Scammer';
    }

    // Try to fetch additional data from API
    try {
      const response = await fetch(`/api/account-info/${address}`, {
        signal: AbortSignal.timeout(5000)
      });

      if (response.ok) {
        const apiData = await response.json();

        // Check if whale
        const balance = apiData.balance || apiData.lamports / 1e9 || 0;
        if (balance > WHALE_THRESHOLD) {
          data.isWhale = true;
          data.balance = balance;
          data.tags.push('whale');
        }

        // Apply any labels from API
        if (apiData.label) {
          data.label = apiData.label;
        }
      }
    } catch (error) {
      // API fetch failed, continue with basic data
    }

    // Cache the result
    cacheRef.current.set(address, data);

    return data;
  }, []);

  /**
   * Enrich all addresses in the graph
   */
  const enrichGraph = useCallback(async (cy: cytoscape.Core) => {
    setIsLoading(true);

    try {
      const nodes = cy.nodes('[type="account"]');
      const addresses = nodes.map(n => n.id());
      const enriched = new Map<string, EnrichedData>();
      const whales: string[] = [];

      // Batch process (limit concurrent requests)
      const batchSize = 10;
      for (let i = 0; i < addresses.length; i += batchSize) {
        const batch = addresses.slice(i, i + batchSize);
        const results = await Promise.all(batch.map(addr => enrichAddress(addr)));

        results.forEach((data, idx) => {
          enriched.set(batch[idx], data);
          if (data.isWhale) {
            whales.push(batch[idx]);
          }
        });
      }

      setEnrichedData(enriched);
      setWhaleAddresses(whales);

      // Apply visual enrichment
      applyEnrichmentToGraph(cy, enriched);

      return enriched;

    } finally {
      setIsLoading(false);
    }
  }, [enrichAddress]);

  /**
   * Apply enrichment data to graph visuals
   */
  const applyEnrichmentToGraph = useCallback((
    cy: cytoscape.Core,
    data: Map<string, EnrichedData>
  ) => {
    cy.nodes('[type="account"]').forEach(node => {
      const enriched = data.get(node.id());
      if (!enriched) return;

      // Update node data
      node.data('enriched', enriched);
      node.data('label', enriched.label || node.data('label'));

      // Apply styles based on type
      switch (enriched.type) {
        case 'cex':
          node.style({
            'background-color': 'hsl(210, 70%, 50%)',
            'border-width': 3,
            'border-color': 'hsl(210, 70%, 30%)'
          });
          node.addClass('enriched-cex');
          break;

        case 'dex':
          node.style({
            'background-color': 'hsl(160, 70%, 50%)',
            'border-width': 3,
            'border-color': 'hsl(160, 70%, 30%)'
          });
          node.addClass('enriched-dex');
          break;

        case 'bridge':
          node.style({
            'background-color': 'hsl(280, 70%, 50%)',
            'border-width': 3,
            'border-color': 'hsl(280, 70%, 30%)'
          });
          node.addClass('enriched-bridge');
          break;

        case 'scam':
          node.style({
            'background-color': 'hsl(0, 80%, 50%)',
            'border-width': 4,
            'border-color': 'hsl(0, 80%, 30%)',
            'border-style': 'dashed'
          });
          node.addClass('enriched-scam');
          break;

        case 'whale':
          node.style({
            'width': 50,
            'height': 50,
            'border-width': 3,
            'border-color': 'hsl(45, 100%, 50%)'
          });
          node.addClass('enriched-whale');
          break;

        case 'program':
          node.style({
            'shape': 'diamond',
            'background-color': 'hsl(var(--muted))'
          });
          node.addClass('enriched-program');
          break;
      }

      // Apply risk level indicator
      switch (enriched.riskLevel) {
        case 'high':
          node.style('border-color', 'hsl(30, 100%, 50%)');
          break;
        case 'critical':
          node.style('border-color', 'hsl(0, 100%, 50%)');
          break;
      }

      // Apply whale indicator
      if (enriched.isWhale && enriched.type !== 'whale') {
        node.style({
          'width': Math.max(node.width(), 40),
          'height': Math.max(node.height(), 40)
        });
        node.addClass('is-whale');
      }
    });
  }, []);

  /**
   * Get entity legend for the graph
   */
  const getEntityLegend = useCallback(() => {
    return [
      { type: 'cex', label: 'CEX Hot Wallet', color: 'hsl(210, 70%, 50%)' },
      { type: 'dex', label: 'DEX/AMM', color: 'hsl(160, 70%, 50%)' },
      { type: 'bridge', label: 'Bridge', color: 'hsl(280, 70%, 50%)' },
      { type: 'scam', label: 'Flagged/Scam', color: 'hsl(0, 80%, 50%)' },
      { type: 'whale', label: 'Whale (>10K SOL)', color: 'hsl(45, 100%, 50%)', isOutline: true },
      { type: 'program', label: 'Program', color: 'hsl(var(--muted))', shape: 'diamond' }
    ];
  }, []);

  /**
   * Add custom label to address
   */
  const addCustomLabel = useCallback((address: string, label: string, tags: string[] = []) => {
    const existing = enrichedData.get(address) || {
      address,
      type: 'unknown' as const,
      riskLevel: 'low' as const,
      tags: []
    };

    const updated: EnrichedData = {
      ...existing,
      label,
      tags: [...existing.tags, ...tags]
    };

    setEnrichedData(prev => new Map(prev).set(address, updated));
    cacheRef.current.set(address, updated);

    return updated;
  }, [enrichedData]);

  /**
   * Flag address as suspicious
   */
  const flagAsSuspicious = useCallback((address: string, reason: string) => {
    const existing = enrichedData.get(address) || {
      address,
      type: 'unknown' as const,
      riskLevel: 'low' as const,
      tags: []
    };

    const updated: EnrichedData = {
      ...existing,
      riskLevel: 'high',
      tags: [...existing.tags, 'suspicious', reason],
      notes: `Flagged: ${reason}`
    };

    setEnrichedData(prev => new Map(prev).set(address, updated));
    cacheRef.current.set(address, updated);

    return updated;
  }, [enrichedData]);

  /**
   * Get addresses by type
   */
  const getAddressesByType = useCallback((type: EnrichedData['type']) => {
    const addresses: string[] = [];
    enrichedData.forEach((data, address) => {
      if (data.type === type) {
        addresses.push(address);
      }
    });
    return addresses;
  }, [enrichedData]);

  /**
   * Get addresses by risk level
   */
  const getAddressesByRisk = useCallback((level: EnrichedData['riskLevel']) => {
    const addresses: string[] = [];
    enrichedData.forEach((data, address) => {
      if (data.riskLevel === level) {
        addresses.push(address);
      }
    });
    return addresses;
  }, [enrichedData]);

  /**
   * Clear all enrichment data
   */
  const clearEnrichment = useCallback((cy: cytoscape.Core) => {
    setEnrichedData(new Map());
    setWhaleAddresses([]);

    // Reset node styles
    cy.nodes('[type="account"]').removeStyle();
    cy.nodes('[type="account"]').removeClass(
      'enriched-cex enriched-dex enriched-bridge enriched-scam enriched-whale enriched-program is-whale'
    );
  }, []);

  return {
    // State
    enrichedData,
    isLoading,
    whaleAddresses,

    // Actions
    enrichAddress,
    enrichGraph,
    applyEnrichmentToGraph,
    addCustomLabel,
    flagAsSuspicious,
    clearEnrichment,

    // Queries
    getAddressesByType,
    getAddressesByRisk,
    getEntityLegend
  };
}

export default useDataEnrichment;
