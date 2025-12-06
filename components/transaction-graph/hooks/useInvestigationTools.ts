'use client';

import { useState, useCallback } from 'react';
import cytoscape from 'cytoscape';

interface WalletProfile {
  address: string;
  age: number; // Days since first transaction
  totalVolume: number;
  transactionCount: number;
  uniqueCounterparties: number;
  avgTransactionSize: number;
  maxTransaction: number;
  minTransaction: number;
  activityScore: number; // 0-100
  riskScore: number; // 0-100
  patterns: string[];
  firstSeen?: Date;
  lastSeen?: Date;
  topCounterparties: Array<{
    address: string;
    volume: number;
    count: number;
  }>;
  tokenBreakdown: Array<{
    symbol: string;
    volume: number;
    percentage: number;
  }>;
}

interface WashTradingIndicator {
  cycleAddresses: string[];
  cycleLength: number;
  volume: number;
  frequency: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

interface MEVIndicator {
  type: 'sandwich' | 'frontrun' | 'backrun' | 'arbitrage';
  transactions: string[];
  profit: number;
  victim?: string;
}

interface FirstFunderResult {
  originalFunder: string;
  fundingChain: Array<{
    from: string;
    to: string;
    amount: number;
    timestamp?: number;
  }>;
  chainLength: number;
}

interface CommonAncestorResult {
  commonAncestors: string[];
  pathsFromAncestor: Map<string, string[][]>;
}

/**
 * Hook for advanced investigation tools
 */
export function useInvestigationTools() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [walletProfiles, setWalletProfiles] = useState<Map<string, WalletProfile>>(new Map());
  const [washTradingIndicators, setWashTradingIndicators] = useState<WashTradingIndicator[]>([]);
  const [mevIndicators, setMevIndicators] = useState<MEVIndicator[]>([]);

  /**
   * Generate comprehensive wallet profile
   */
  const generateWalletProfile = useCallback(async (
    cy: cytoscape.Core,
    address: string
  ): Promise<WalletProfile> => {
    const node = cy.getElementById(address);
    if (node.length === 0) {
      throw new Error('Address not found in graph');
    }

    const connectedEdges = node.connectedEdges();
    const neighbors = node.neighborhood('node[type="account"]');

    // Calculate metrics
    let totalVolume = 0;
    let maxTx = 0;
    let minTx = Infinity;
    let firstTime: number | undefined;
    let lastTime: number | undefined;

    const counterpartyVolume = new Map<string, { volume: number; count: number }>();
    const tokenVolumes = new Map<string, number>();

    connectedEdges.forEach(edge => {
      const amount = edge.data('amount') || 0;
      totalVolume += amount;
      maxTx = Math.max(maxTx, amount);
      minTx = Math.min(minTx, amount);

      // Track timestamps
      const timestamp = edge.data('timestamp') || edge.data('blockTime');
      if (timestamp) {
        const time = typeof timestamp === 'number' ? timestamp * 1000 : new Date(timestamp).getTime();
        if (!firstTime || time < firstTime) firstTime = time;
        if (!lastTime || time > lastTime) lastTime = time;
      }

      // Track counterparties
      const source = edge.data('source');
      const target = edge.data('target');
      const counterparty = source === address ? target : source;

      const existing = counterpartyVolume.get(counterparty) || { volume: 0, count: 0 };
      existing.volume += amount;
      existing.count++;
      counterpartyVolume.set(counterparty, existing);

      // Track tokens
      const symbol = edge.data('tokenSymbol') || 'SOL';
      tokenVolumes.set(symbol, (tokenVolumes.get(symbol) || 0) + amount);
    });

    // Calculate patterns
    const patterns: string[] = [];
    const txCount = connectedEdges.length;
    const avgSize = txCount > 0 ? totalVolume / txCount : 0;

    if (txCount > 100) patterns.push('High activity');
    if (avgSize > 1000) patterns.push('Large transactions');
    if (neighbors.length === 1) patterns.push('Single counterparty');
    if (minTx < 0.001) patterns.push('Dust transactions');

    // Check for round numbers (potential bot)
    let roundNumberCount = 0;
    connectedEdges.forEach(edge => {
      const amount = edge.data('amount') || 0;
      if (amount > 0 && amount === Math.round(amount)) {
        roundNumberCount++;
      }
    });
    if (roundNumberCount > txCount * 0.5) {
      patterns.push('Round number pattern');
    }

    // Calculate scores
    const age = firstTime ? Math.floor((Date.now() - firstTime) / (1000 * 60 * 60 * 24)) : 0;
    const activityScore = Math.min(100, Math.floor(Math.sqrt(txCount) * 10));

    let riskScore = 0;
    if (patterns.includes('Single counterparty')) riskScore += 20;
    if (patterns.includes('Dust transactions')) riskScore += 15;
    if (patterns.includes('Round number pattern')) riskScore += 25;
    if (age < 7 && totalVolume > 10000) riskScore += 30; // New wallet, high volume

    // Top counterparties
    const topCounterparties = Array.from(counterpartyVolume.entries())
      .sort((a, b) => b[1].volume - a[1].volume)
      .slice(0, 5)
      .map(([addr, data]) => ({
        address: addr,
        volume: data.volume,
        count: data.count
      }));

    // Token breakdown
    const totalTokenVolume = Array.from(tokenVolumes.values()).reduce((a, b) => a + b, 0);
    const tokenBreakdown = Array.from(tokenVolumes.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([symbol, volume]) => ({
        symbol,
        volume,
        percentage: Math.round((volume / totalTokenVolume) * 100)
      }));

    const profile: WalletProfile = {
      address,
      age,
      totalVolume,
      transactionCount: txCount,
      uniqueCounterparties: neighbors.length,
      avgTransactionSize: avgSize,
      maxTransaction: maxTx,
      minTransaction: minTx === Infinity ? 0 : minTx,
      activityScore,
      riskScore: Math.min(100, riskScore),
      patterns,
      firstSeen: firstTime ? new Date(firstTime) : undefined,
      lastSeen: lastTime ? new Date(lastTime) : undefined,
      topCounterparties,
      tokenBreakdown
    };

    setWalletProfiles(prev => new Map(prev).set(address, profile));
    return profile;
  }, []);

  /**
   * Detect wash trading patterns
   */
  const detectWashTrading = useCallback((cy: cytoscape.Core): WashTradingIndicator[] => {
    setIsAnalyzing(true);

    try {
      const indicators: WashTradingIndicator[] = [];
      const visited = new Set<string>();

      // Find cycles using DFS
      const findCycles = (
        start: string,
        current: string,
        path: string[],
        volume: number,
        depth: number
      ) => {
        if (depth > 6) return; // Max cycle length

        if (path.length > 2 && current === start) {
          // Found a cycle
          const cycleKey = [...path].sort().join('-');
          if (!visited.has(cycleKey)) {
            visited.add(cycleKey);

            let frequency = 0;
            // Count how many times this cycle appears
            for (let i = 0; i < path.length; i++) {
              const from = path[i];
              const to = path[(i + 1) % path.length];
              const edges = cy.edges(`[source="${from}"][target="${to}"], [source="${to}"][target="${from}"]`);
              frequency += edges.length;
            }

            let riskLevel: WashTradingIndicator['riskLevel'] = 'low';
            if (path.length <= 3 && frequency > 5) riskLevel = 'critical';
            else if (frequency > 10) riskLevel = 'high';
            else if (frequency > 3) riskLevel = 'medium';

            indicators.push({
              cycleAddresses: path,
              cycleLength: path.length,
              volume,
              frequency,
              riskLevel
            });
          }
          return;
        }

        if (path.includes(current) && current !== start) return;

        const node = cy.getElementById(current);
        node.neighborhood('node[type="account"]').forEach(neighbor => {
          const neighborId = neighbor.id();
          const edge = cy.edges(`[source="${current}"][target="${neighborId}"], [source="${neighborId}"][target="${current}"]`).first();
          const edgeAmount = edge?.data('amount') || 0;

          findCycles(
            start,
            neighborId,
            [...path, current],
            volume + edgeAmount,
            depth + 1
          );
        });
      };

      // Start from each account node
      cy.nodes('[type="account"]').forEach(node => {
        findCycles(node.id(), node.id(), [], 0, 0);
      });

      // Sort by risk level
      const riskOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      indicators.sort((a, b) => riskOrder[a.riskLevel] - riskOrder[b.riskLevel]);

      setWashTradingIndicators(indicators);
      return indicators;

    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  /**
   * Detect MEV patterns
   */
  const detectMEV = useCallback((cy: cytoscape.Core): MEVIndicator[] => {
    const indicators: MEVIndicator[] = [];

    // This would require block-level timing data
    // Simplified detection based on patterns

    cy.edges().forEach(edge => {
      const txType = edge.data('txType') || edge.data('type');

      // Look for swap patterns that might indicate arbitrage
      if (txType === 'swap' || txType === 'trade') {
        const source = edge.data('source');
        const target = edge.data('target');

        // Check if there's a return path within short time
        const returnEdges = cy.edges(`[source="${target}"][target="${source}"]`);
        if (returnEdges.length > 0) {
          const amount = edge.data('amount') || 0;
          const returnAmount = returnEdges.first()?.data('amount') || 0;

          if (returnAmount > amount * 1.001) { // Profitable round trip
            indicators.push({
              type: 'arbitrage',
              transactions: [edge.data('fullSignature'), returnEdges.first()?.data('fullSignature')].filter(Boolean),
              profit: returnAmount - amount
            });
          }
        }
      }
    });

    setMevIndicators(indicators);
    return indicators;
  }, []);

  /**
   * Trace first funder of an address
   */
  const traceFirstFunder = useCallback((
    cy: cytoscape.Core,
    address: string,
    maxDepth: number = 10
  ): FirstFunderResult | null => {
    const chain: FirstFunderResult['fundingChain'] = [];
    const visited = new Set<string>();
    let current = address;
    let depth = 0;

    while (depth < maxDepth) {
      visited.add(current);

      // Find incoming edges (funding)
      const incomingEdges = cy.edges(`[target="${current}"]`);
      if (incomingEdges.length === 0) {
        // No more incoming edges - this is the original funder
        break;
      }

      // Find the first/earliest incoming edge
      let earliestEdge: cytoscape.EdgeSingular | null = null;
      let earliestTime = Infinity;

      incomingEdges.forEach(edge => {
        const timestamp = edge.data('timestamp') || edge.data('blockTime');
        if (timestamp) {
          const time = typeof timestamp === 'number' ? timestamp : new Date(timestamp).getTime() / 1000;
          if (time < earliestTime) {
            earliestTime = time;
            earliestEdge = edge;
          }
        }
      });

      if (!earliestEdge) {
        // Use first edge if no timestamps
        earliestEdge = incomingEdges.first();
      }

      const source = earliestEdge.data('source');
      if (visited.has(source)) {
        // Circular funding detected
        break;
      }

      chain.push({
        from: source,
        to: current,
        amount: earliestEdge.data('amount') || 0,
        timestamp: earliestTime !== Infinity ? earliestTime : undefined
      });

      current = source;
      depth++;
    }

    if (chain.length === 0) {
      return null;
    }

    return {
      originalFunder: current,
      fundingChain: chain.reverse(),
      chainLength: chain.length
    };
  }, []);

  /**
   * Find common ancestors between addresses
   */
  const findCommonAncestors = useCallback((
    cy: cytoscape.Core,
    addresses: string[],
    maxDepth: number = 5
  ): CommonAncestorResult => {
    const ancestorSets: Map<string, Set<string>> = new Map();

    // For each address, find all ancestors up to maxDepth
    addresses.forEach(address => {
      const ancestors = new Set<string>();
      const queue: Array<{ node: string; depth: number }> = [{ node: address, depth: 0 }];
      const visited = new Set<string>();

      while (queue.length > 0) {
        const { node, depth } = queue.shift()!;
        if (depth > maxDepth || visited.has(node)) continue;
        visited.add(node);

        // Get incoming edges (funders/sources)
        cy.edges(`[target="${node}"]`).forEach(edge => {
          const source = edge.data('source');
          if (source !== address) {
            ancestors.add(source);
            queue.push({ node: source, depth: depth + 1 });
          }
        });
      }

      ancestorSets.set(address, ancestors);
    });

    // Find common ancestors
    const commonAncestors: string[] = [];
    if (addresses.length > 1) {
      const firstSet = ancestorSets.get(addresses[0]) || new Set();
      firstSet.forEach(ancestor => {
        const isCommon = addresses.slice(1).every(addr => {
          const set = ancestorSets.get(addr);
          return set?.has(ancestor);
        });
        if (isCommon) {
          commonAncestors.push(ancestor);
        }
      });
    }

    return {
      commonAncestors,
      pathsFromAncestor: new Map() // Would need path reconstruction
    };
  }, []);

  /**
   * Generate investigation report
   */
  const generateReport = useCallback((
    address: string,
    profile: WalletProfile | null,
    washIndicators: WashTradingIndicator[],
    mevIndicators: MEVIndicator[],
    firstFunder: FirstFunderResult | null
  ): string => {
    const lines: string[] = [];

    lines.push(`# Investigation Report`);
    lines.push(`## Address: ${address}`);
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push('');

    if (profile) {
      lines.push(`## Wallet Profile`);
      lines.push(`- Age: ${profile.age} days`);
      lines.push(`- Total Volume: ${profile.totalVolume.toFixed(2)} SOL`);
      lines.push(`- Transactions: ${profile.transactionCount}`);
      lines.push(`- Unique Counterparties: ${profile.uniqueCounterparties}`);
      lines.push(`- Risk Score: ${profile.riskScore}/100`);
      lines.push(`- Activity Score: ${profile.activityScore}/100`);
      lines.push('');

      if (profile.patterns.length > 0) {
        lines.push(`### Detected Patterns`);
        profile.patterns.forEach(p => lines.push(`- ${p}`));
        lines.push('');
      }

      if (profile.topCounterparties.length > 0) {
        lines.push(`### Top Counterparties`);
        profile.topCounterparties.forEach((c, i) => {
          lines.push(`${i + 1}. ${c.address.slice(0, 8)}... - ${c.volume.toFixed(2)} SOL (${c.count} tx)`);
        });
        lines.push('');
      }
    }

    const relevantWash = washIndicators.filter(w =>
      w.cycleAddresses.includes(address)
    );
    if (relevantWash.length > 0) {
      lines.push(`## Wash Trading Indicators`);
      relevantWash.forEach((w, i) => {
        lines.push(`${i + 1}. Cycle of ${w.cycleLength} addresses - Risk: ${w.riskLevel.toUpperCase()}`);
        lines.push(`   Volume: ${w.volume.toFixed(2)} SOL, Frequency: ${w.frequency}`);
      });
      lines.push('');
    }

    if (firstFunder) {
      lines.push(`## Funding Chain`);
      lines.push(`Original Funder: ${firstFunder.originalFunder}`);
      lines.push(`Chain Length: ${firstFunder.chainLength} hops`);
      firstFunder.fundingChain.forEach((step, i) => {
        lines.push(`${i + 1}. ${step.from.slice(0, 8)}... -> ${step.to.slice(0, 8)}... (${step.amount.toFixed(2)} SOL)`);
      });
    }

    return lines.join('\n');
  }, []);

  return {
    // State
    isAnalyzing,
    walletProfiles,
    washTradingIndicators,
    mevIndicators,

    // Actions
    generateWalletProfile,
    detectWashTrading,
    detectMEV,
    traceFirstFunder,
    findCommonAncestors,
    generateReport
  };
}

export default useInvestigationTools;
