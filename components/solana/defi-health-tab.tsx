'use client';

import React, { useState, useEffect } from 'react';
import { Loader2, Shield, AlertTriangle, TrendingUp, TrendingDown, DollarSign, Activity, Zap, Heart } from 'lucide-react';

interface DeFiHealthData {
  protocols: Array<{
    protocol: string;
    category: 'dex' | 'lending' | 'yield' | 'derivatives' | 'insurance';
    tvl: number;
    tvlChange24h: number;
    tvlChange7d: number;
    riskScore: number;
    healthScore: number;
    exploitAlerts: Array<{
      severity: 'critical' | 'high' | 'medium' | 'low';
      type: string;
      description: string;
      affectedAmount: number;
      timestamp: number;
    }>;
    treasuryHealth: {
      treasuryValue: number;
      runwayMonths: number;
      sustainabilityRisk: 'low' | 'medium' | 'high' | 'critical';
    };
  }>;
  alerts: Array<{
    severity: 'critical' | 'high' | 'medium' | 'low';
    type: string;
    description: string;
    affectedAmount: number;
    protocolsAffected: string[];
    timestamp: number;
  }>;
  rankings: Array<{
    protocol: string;
    tvl: number;
    healthScore: number;
    riskScore: number;
  }>;
  ecosystem: {
    totalTvl: number;
    avgHealthScore: number;
    avgRiskScore: number;
    criticalAlerts: number;
    protocolCount: number;
  };
  health: {
    isHealthy: boolean;
    lastUpdate: number;
    monitoredProtocols: number;
    activeAlerts: number;
  };
}

export function DeFiHealthTab() {
  const [data, setData] = useState<DeFiHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDeFiHealthData = async () => {
    try {
      const response = await fetch('/api/analytics/defi-health');
      const result = await response.json();
      
      if (result.success) {
        setData(result.data);
        setError(null);
      } else {
        setError(result.error || 'Failed to fetch DeFi health data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  };



  useEffect(() => {
    fetchDeFiHealthData();
    const interval = setInterval(fetchDeFiHealthData, 45000); // Refresh every 45 seconds
    return () => clearInterval(interval);
  }, []);

  const formatCurrency = (value: number | undefined | null) => {
    if (value == null || isNaN(value)) return '$0.00';
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
    return `$${value.toFixed(2)}`;
  };

  const formatPercent = (value: number | undefined | null, isAlreadyPercent: boolean = false) => {
    if (value == null || isNaN(value)) return '0.00%';
    
    // If value is already a percentage (0-100), don't multiply by 100
    const percent = isAlreadyPercent ? value : value * 100;
    
    // Ensure percentage doesn't exceed reasonable bounds 
    const clampedPercent = Math.min(Math.max(percent, -100), 100);
    const formatted = clampedPercent.toFixed(2);
    
    return clampedPercent >= 0 ? `+${formatted}%` : `${formatted}%`;
  };

  const getHealthScoreColor = (score: number) => {
    if (score >= 0.8) return 'text-accent';
    if (score >= 0.6) return 'text-secondary';
    if (score >= 0.4) return 'text-muted-foreground';
    return 'text-destructive';
  };

  const getRiskScoreColor = (score: number) => {
    if (score <= 0.2) return 'text-accent';
    if (score <= 0.4) return 'text-secondary';
    if (score <= 0.6) return 'text-muted-foreground';
    return 'text-destructive';
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-destructive/10 text-destructive';
      case 'high': return 'bg-secondary/20 text-secondary-foreground';
      case 'medium': return 'bg-accent/20 text-accent-foreground';
      case 'low': return 'bg-primary/10 text-primary';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'dex': return 'bg-primary/10 text-primary';
      case 'lending': return 'bg-secondary/50 text-secondary-foreground';
      case 'yield': return 'bg-accent/20 text-accent-foreground';
      case 'derivatives': return 'bg-muted text-muted-foreground';
      case 'insurance': return 'bg-muted text-muted-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading DeFi health data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-destructive">
        <AlertTriangle className="h-8 w-8 mr-2" />
        <span>Error: {error}</span>
        <button
          onClick={fetchDeFiHealthData}
          className="ml-4 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <span>No data available</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">DeFi Protocol Health Monitor</h2>
          <p className="text-muted-foreground">Real-time protocol health scores, exploit detection, and risk assessment</p>
        </div>
      </div>

      {/* Ecosystem Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-background border p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total TVL</p>
              <p className="text-2xl font-bold">{formatCurrency(data.ecosystem.totalTvl)}</p>
            </div>
            <DollarSign className="h-8 w-8 text-accent" />
          </div>
        </div>

        <div className="bg-background border p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Avg Health</p>
              <p className={`text-2xl font-bold ${getHealthScoreColor(data.ecosystem.avgHealthScore)}`}>
                {data.ecosystem.avgHealthScore ? (data.ecosystem.avgHealthScore * 100).toFixed(0) : '0'}%
              </p>
            </div>
            <Heart className="h-8 w-8 text-pink-600" />
          </div>
        </div>

        <div className="bg-background border p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Avg Risk</p>
              <p className={`text-2xl font-bold ${getRiskScoreColor(data.ecosystem.avgRiskScore)}`}>
                {data.ecosystem.avgRiskScore ? (data.ecosystem.avgRiskScore * 100).toFixed(0) : '0'}%
              </p>
            </div>
            <Shield className="h-8 w-8 text-primary" />
          </div>
        </div>

        <div className="bg-background border p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Protocols</p>
              <p className="text-2xl font-bold">{data.ecosystem.protocolCount}</p>
            </div>
            <Activity className="h-8 w-8 text-accent" />
          </div>
        </div>

        <div className="bg-background border p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Critical Alerts</p>
              <p className="text-2xl font-bold text-destructive">{data.ecosystem.criticalAlerts}</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
        </div>
      </div>

      {/* Active Alerts */}
      {data.alerts.length > 0 && (
        <div className="bg-background border rounded-lg shadow">
          <div className="p-6 border-b">
            <h3 className="text-lg font-semibold text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Active Security Alerts
            </h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {data.alerts.map((alert, index) => (
                <div key={index} className="border rounded-lg p-4 border-destructive/20 bg-destructive/5">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getSeverityColor(alert.severity)}`}>
                        {alert.severity.toUpperCase()}
                      </span>
                      <span className="text-sm font-medium">{alert.type}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {new Date(alert.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{alert.description}</p>
                  <div className="flex justify-between items-center text-sm">
                    <span>Affected Amount: <span className="font-medium">{formatCurrency(alert.affectedAmount)}</span></span>
                    <span>Protocols: <span className="font-medium">{alert.protocolsAffected.join(', ')}</span></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Protocol Health Rankings */}
      <div className="bg-background border rounded-lg shadow">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold">Protocol Health Rankings</h3>
        </div>
        <div className="p-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left border-b">
                  <th className="pb-3 font-medium">Rank</th>
                  <th className="pb-3 font-medium">Protocol</th>
                  <th className="pb-3 font-medium">Category</th>
                  <th className="pb-3 font-medium">TVL</th>
                  <th className="pb-3 font-medium">24h Change</th>
                  <th className="pb-3 font-medium">Health Score</th>
                  <th className="pb-3 font-medium">Risk Score</th>
                  <th className="pb-3 font-medium">Treasury</th>
                  <th className="pb-3 font-medium">Alerts</th>
                </tr>
              </thead>
              <tbody>
                {data.protocols.slice(0, 15).map((protocol, index) => (
                  <tr key={protocol.protocol} className="border-b hover:bg-muted/50">
                    <td className="py-3 font-medium">#{index + 1}</td>
                    <td className="py-3 font-medium">{protocol.protocol}</td>
                    <td className="py-3">
                      <span className={`px-2 py-1 rounded text-sm font-medium ${getCategoryColor(protocol.category)}`}>
                        {protocol.category}
                      </span>
                    </td>
                    <td className="py-3">{formatCurrency(protocol.tvl)}</td>
                    <td className="py-3">
                      <div className={`flex items-center gap-1 ${
                        protocol.tvlChange24h >= 0 ? 'text-accent' : 'text-destructive'
                      }`}>
                        {protocol.tvlChange24h >= 0 ? (
                          <TrendingUp className="h-4 w-4" />
                        ) : (
                          <TrendingDown className="h-4 w-4" />
                        )}
                        {formatPercent(protocol.tvlChange24h)}
                      </div>
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-border rounded-full h-2">
                          <div
                            className="bg-accent h-2 rounded-full"
                            style={{ width: `${protocol.healthScore * 100}%` }}
                          />
                        </div>
                        <span className={`text-sm font-medium ${getHealthScoreColor(protocol.healthScore)}`}>
                          {protocol.healthScore ? (protocol.healthScore * 100).toFixed(0) : '0'}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3">
                      <span className={`text-sm font-medium ${getRiskScoreColor(protocol.riskScore)}`}>
                        {protocol.riskScore ? (protocol.riskScore * 100).toFixed(0) : '0'}%
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="text-sm">
                        <div>{formatCurrency(protocol.treasuryHealth.treasuryValue)}</div>
                        <div className="text-muted-foreground">{protocol.treasuryHealth.runwayMonths ? protocol.treasuryHealth.runwayMonths.toFixed(0) : '0'}mo runway</div>
                      </div>
                    </td>
                    <td className="py-3">
                      {protocol.exploitAlerts.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          {protocol.exploitAlerts.slice(0, 2).map((alert, i) => (
                            <span key={i} className={`px-2 py-1 rounded text-xs ${getSeverityColor(alert.severity)}`}>
                              {alert.severity}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-accent text-sm">✓ Clean</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Risk Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-background border rounded-lg shadow">
          <div className="p-6 border-b">
            <h3 className="text-lg font-semibold">Health Score Distribution</h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {[
                { range: '80-100%', color: 'bg-accent', count: data.protocols.filter(p => p.healthScore >= 0.8).length },
                { range: '60-79%', color: 'bg-secondary', count: data.protocols.filter(p => p.healthScore >= 0.6 && p.healthScore < 0.8).length },
                { range: '40-59%', color: 'bg-muted', count: data.protocols.filter(p => p.healthScore >= 0.4 && p.healthScore < 0.6).length },
                { range: '0-39%', color: 'bg-destructive', count: data.protocols.filter(p => p.healthScore < 0.4).length }
              ].map((item, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-4 h-4 rounded ${item.color}`} />
                    <span className="text-sm font-medium">{item.range}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">{item.count} protocols</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-background border rounded-lg shadow">
          <div className="p-6 border-b">
            <h3 className="text-lg font-semibold">Category Breakdown</h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {Object.entries(
                data.protocols.reduce((acc, protocol) => {
                  acc[protocol.category] = (acc[protocol.category] || 0) + 1;
                  return acc;
                }, {} as Record<string, number>)
              ).map(([category, count]) => (
                <div key={category} className="flex items-center justify-between">
                  <span className={`px-2 py-1 rounded text-sm font-medium ${getCategoryColor(category)}`}>
                    {category}
                  </span>
                  <span className="text-sm text-muted-foreground">{count} protocols</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}