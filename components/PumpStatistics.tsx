/**
 * Pump Detection Statistics Panel
 * Analyzes events for patterns that might indicate pump and dump schemes
 */

'use client';

import React, { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { BlockchainEvent } from './LiveEventMonitor';

interface PumpStatisticsProps {
  events: BlockchainEvent[];
}

interface PumpMetrics {
  suspiciousTokens: Array<{
    token: string;
    activity: number;
    riskScore: number;
    pattern: string;
  }>;
  rapidTradePatterns: Array<{
    account: string;
    txCount: number;
    timeWindow: string;
    volume?: number;
  }>;
  feeSpikes: Array<{
    signature: string;
    fee: number;
    multiplier: number;
    timestamp: number;
  }>;
  programHotspots: Array<{
    program: string;
    txCount: number;
    uniqueUsers: number;
    avgFee: number;
  }>;
  overallRiskLevel: 'low' | 'medium' | 'high' | 'critical';
  eventChains: Array<{
    id: string;
    events: BlockchainEvent[];
    pattern: string;
    riskScore: number;
  }>;
}

export function PumpStatistics({ events }: PumpStatisticsProps) {
  const metrics = useMemo((): PumpMetrics => {
    const now = Date.now();
    const recentEvents = events.filter(e => now - e.timestamp < 300000); // Last 5 minutes
    
    // Analyze for pump patterns
    const suspiciousTokens: PumpMetrics['suspiciousTokens'] = [];
    const rapidTradePatterns: PumpMetrics['rapidTradePatterns'] = [];
    const feeSpikes: PumpMetrics['feeSpikes'] = [];
    const programHotspots: Map<string, { txCount: number; uniqueUsers: Set<string>; totalFees: number }> = new Map();
    
    // Track average fee for spike detection
    const fees = recentEvents
      .filter(e => e.type === 'transaction' && e.data?.fee)
      .map(e => e.data.fee);
    const avgFee = fees.length > 0 ? fees.reduce((a, b) => a + b, 0) / fees.length : 0;
    
    // Analyze transactions for patterns
    const accountActivity = new Map<string, number>();
    const timeWindows = new Map<string, BlockchainEvent[]>();
    
    recentEvents.forEach(event => {
      if (event.type !== 'transaction') return;
      
      const { data } = event;
      if (!data) return;
      
      // Track fee spikes (5x+ average)
      if (data.fee && avgFee > 0 && data.fee > avgFee * 5) {
        feeSpikes.push({
          signature: data.signature || 'unknown',
          fee: data.fee,
          multiplier: data.fee / avgFee,
          timestamp: event.timestamp
        });
      }
      
      // Track program activity
      if (data.accountKeys) {
        data.accountKeys.forEach((key: string) => {
          if (!key.includes('111111111111111111111')) { // Skip system programs
            const current = programHotspots.get(key) || { txCount: 0, uniqueUsers: new Set(), totalFees: 0 };
            current.txCount++;
            if (data.accountKeys[0]) current.uniqueUsers.add(data.accountKeys[0]);
            if (data.fee) current.totalFees += data.fee;
            programHotspots.set(key, current);
          }
        });
      }
      
      // Track account activity for rapid trading
      if (data.accountKeys?.[0]) {
        const account = data.accountKeys[0];
        accountActivity.set(account, (accountActivity.get(account) || 0) + 1);
      }
      
      // Group events by 1-minute windows for pattern detection
      const windowKey = Math.floor(event.timestamp / 60000).toString();
      if (!timeWindows.has(windowKey)) {
        timeWindows.set(windowKey, []);
      }
      timeWindows.get(windowKey)!.push(event);
    });
    
    // Detect rapid trading patterns (5+ tx per account in 5 minutes)
    accountActivity.forEach((count, account) => {
      if (count >= 5) {
        rapidTradePatterns.push({
          account: account.substring(0, 8) + '...',
          txCount: count,
          timeWindow: '5 min'
        });
      }
    });
    
    // Convert program hotspots to array
    const programHotspotsArray: PumpMetrics['programHotspots'] = [];
    programHotspots.forEach((data, program) => {
      if (data.txCount >= 3) { // Only show programs with 3+ transactions
        programHotspotsArray.push({
          program: program.substring(0, 8) + '...',
          txCount: data.txCount,
          uniqueUsers: data.uniqueUsers.size,
          avgFee: data.totalFees / data.txCount
        });
      }
    });
    
    // Detect suspicious tokens (ending with *pump or *chan)
    const tokenPatterns = [/pump$/, /chan$/, /moon$/, /gem$/];
    recentEvents.forEach(event => {
      if (event.type === 'transaction' && event.data?.logs) {
        event.data.logs.forEach((log: string) => {
          tokenPatterns.forEach(pattern => {
            if (pattern.test(log.toLowerCase())) {
              const existing = suspiciousTokens.find(t => t.token === log.substring(0, 20));
              if (existing) {
                existing.activity++;
                existing.riskScore = Math.min(100, existing.riskScore + 10);
              } else {
                suspiciousTokens.push({
                  token: log.substring(0, 20) + '...',
                  activity: 1,
                  riskScore: 25,
                  pattern: pattern.source
                });
              }
            }
          });
        });
      }
    });
    
    // Detect event chains that might indicate coordinated activity
    const eventChains: PumpMetrics['eventChains'] = [];
    timeWindows.forEach((windowEvents, window) => {
      if (windowEvents.length >= 10) { // 10+ events in 1 minute window
        const uniqueAccounts = new Set(
          windowEvents.map(e => e.data?.accountKeys?.[0]).filter(Boolean)
        );
        
        if (uniqueAccounts.size >= 5) { // From 5+ different accounts
          eventChains.push({
            id: `chain_${window}`,
            events: windowEvents.slice(0, 5), // Show first 5 events
            pattern: 'Coordinated Activity',
            riskScore: Math.min(100, windowEvents.length * 2)
          });
        }
      }
    });
    
    // Calculate overall risk level
    let overallRiskLevel: PumpMetrics['overallRiskLevel'] = 'low';
    const totalRiskFactors = feeSpikes.length + suspiciousTokens.length + rapidTradePatterns.length + eventChains.length;
    
    if (totalRiskFactors >= 10) overallRiskLevel = 'critical';
    else if (totalRiskFactors >= 6) overallRiskLevel = 'high';
    else if (totalRiskFactors >= 3) overallRiskLevel = 'medium';
    
    return {
      suspiciousTokens: suspiciousTokens.slice(0, 5),
      rapidTradePatterns: rapidTradePatterns.slice(0, 5),
      feeSpikes: feeSpikes.slice(0, 5),
      programHotspots: programHotspotsArray.slice(0, 5),
      overallRiskLevel,
      eventChains: eventChains.slice(0, 3)
    };
  }, [events]);
  
  const getRiskColor = (level: string) => {
    switch (level) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      default: return 'text-green-600 bg-green-50 border-green-200';
    }
  };
  
  return (
    <div className="space-y-4">
      {/* Overall Risk Level */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-3">Pump Detection Analysis</h3>
        <div className={`p-3 rounded-lg border-2 ${getRiskColor(metrics.overallRiskLevel)}`}>
          <div className="text-sm font-medium">Overall Risk Level</div>
          <div className="text-2xl font-bold capitalize">{metrics.overallRiskLevel}</div>
        </div>
      </Card>
      
      {/* Fee Spikes */}
      {metrics.feeSpikes.length > 0 && (
        <Card className="p-4">
          <h4 className="font-semibold mb-2 text-red-600">⚠️ Suspicious Fee Spikes</h4>
          <div className="space-y-2">
            {metrics.feeSpikes.map((spike, idx) => (
              <div key={idx} className="text-xs bg-red-50 p-2 rounded">
                <div>TX: {spike.signature.substring(0, 12)}...</div>
                <div>Fee: {(spike.fee / 1e9).toFixed(6)} SOL ({spike.multiplier.toFixed(1)}x avg)</div>
              </div>
            ))}
          </div>
        </Card>
      )}
      
      {/* Rapid Trading Patterns */}
      {metrics.rapidTradePatterns.length > 0 && (
        <Card className="p-4">
          <h4 className="font-semibold mb-2 text-orange-600">⚡ Rapid Trading</h4>
          <div className="space-y-2">
            {metrics.rapidTradePatterns.map((pattern, idx) => (
              <div key={idx} className="text-xs bg-orange-50 p-2 rounded">
                <div>Account: {pattern.account}</div>
                <div>{pattern.txCount} transactions in {pattern.timeWindow}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
      
      {/* Suspicious Tokens */}
      {metrics.suspiciousTokens.length > 0 && (
        <Card className="p-4">
          <h4 className="font-semibold mb-2 text-purple-600">🎯 Suspicious Tokens</h4>
          <div className="space-y-2">
            {metrics.suspiciousTokens.map((token, idx) => (
              <div key={idx} className="text-xs bg-purple-50 p-2 rounded">
                <div>Token: {token.token}</div>
                <div>Activity: {token.activity} | Risk: {token.riskScore}/100</div>
                <div className="text-purple-600">Pattern: {token.pattern}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
      
      {/* Program Hotspots */}
      {metrics.programHotspots.length > 0 && (
        <Card className="p-4">
          <h4 className="font-semibold mb-2 text-blue-600">🔥 Program Hotspots</h4>
          <div className="space-y-2">
            {metrics.programHotspots.map((program, idx) => (
              <div key={idx} className="text-xs bg-blue-50 p-2 rounded">
                <div>Program: {program.program}</div>
                <div>{program.txCount} txs from {program.uniqueUsers} users</div>
                <div>Avg Fee: {(program.avgFee / 1e9).toFixed(6)} SOL</div>
              </div>
            ))}
          </div>
        </Card>
      )}
      
      {/* Event Chains */}
      {metrics.eventChains.length > 0 && (
        <Card className="p-4">
          <h4 className="font-semibold mb-2 text-yellow-600">🔗 Event Chains</h4>
          <div className="space-y-2">
            {metrics.eventChains.map((chain, idx) => (
              <div key={idx} className="text-xs bg-yellow-50 p-2 rounded">
                <div>Pattern: {chain.pattern}</div>
                <div>{chain.events.length} events | Risk: {chain.riskScore}/100</div>
              </div>
            ))}
          </div>
        </Card>
      )}
      
      {/* Summary Stats */}
      <Card className="p-4">
        <h4 className="font-semibold mb-2">📊 Summary</h4>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>Fee Spikes: {metrics.feeSpikes.length}</div>
          <div>Rapid Trades: {metrics.rapidTradePatterns.length}</div>
          <div>Suspicious Tokens: {metrics.suspiciousTokens.length}</div>
          <div>Hot Programs: {metrics.programHotspots.length}</div>
          <div>Event Chains: {metrics.eventChains.length}</div>
          <div>Total Events: {events.length}</div>
        </div>
      </Card>
    </div>
  );
}