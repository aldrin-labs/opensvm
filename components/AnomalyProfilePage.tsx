/**
 * Anomaly Profile Page Component
 * 
 * Full-page view of an anomaly with rich data visualization and comprehensive analysis
 */

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { useRouter } from 'next/navigation';

interface AnomalyProfilePageProps {
  anomalyId: string;
}

interface AnomalyData {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  timestamp: number;
  event?: {
    type: string;
    data: any;
  };
  metrics?: {
    affectedAccounts: number;
    transactionCount: number;
    totalValue: number;
    timeSpan: number;
  };
}

export const AnomalyProfilePage = React.memo(function AnomalyProfilePage({ 
  anomalyId 
}: AnomalyProfilePageProps) {
  const [anomalyData, setAnomalyData] = useState<AnomalyData | null>(null);
  const [relatedEvents, setRelatedEvents] = useState<any[]>([]);
  const [similarAlerts, setSimilarAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchAnomalyData = async () => {
      try {
        setLoading(true);
        
        // Mock data for now - in production this would fetch from API
        const mockAnomaly: AnomalyData = {
          id: anomalyId,
          type: 'suspicious_fee_spike',
          severity: 'high',
          description: 'Transaction fees spiked to 5.2x normal levels with unusual timing patterns',
          timestamp: Date.now() - 3600000,
          metrics: {
            affectedAccounts: 127,
            transactionCount: 1834,
            totalValue: 45.7,
            timeSpan: 1800 // 30 minutes
          },
          event: {
            type: 'transaction',
            data: {
              signature: 'mock_signature_for_demo',
              fee: 0.025,
              accountKeys: [
                '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
                '8CvRVcu24b2PqpGQ8PCH6qQ3B45n7S1r1uV7K8kJXQ3s',
                '7JnN2x1ZgzQw9FVJ9dR3v8B2qN5uK7w6C4eG3tH9sL2x'
              ]
            }
          }
        };

        setAnomalyData(mockAnomaly);

        // Fetch related data
        const [relatedResponse, similarResponse] = await Promise.all([
          fetch(`/api/anomaly/related?alertId=${anomalyId}&accounts=${mockAnomaly.event?.data?.accountKeys?.join(',') || ''}`),
          fetch(`/api/anomaly/similar?alertId=${anomalyId}&type=${mockAnomaly.type}`)
        ]);

        if (relatedResponse.ok) {
          const relatedData = await relatedResponse.json();
          setRelatedEvents(relatedData.data?.events || []);
        }

        if (similarResponse.ok) {
          const similarData = await similarResponse.json();
          setSimilarAlerts(similarData.data?.alerts || []);
        }

      } catch (err) {
        setError('Failed to load anomaly data');
        console.error('Error fetching anomaly data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAnomalyData();
  }, [anomalyId]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-yellow-500 text-black';
      case 'low': return 'bg-blue-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const timelineData = useMemo(() => {
    if (!anomalyData) return [];
    
    // Generate mock timeline data for visualization
    const baseTime = anomalyData.timestamp - (anomalyData.metrics?.timeSpan || 0) * 1000;
    return Array.from({ length: 20 }, (_, i) => ({
      time: baseTime + (i * (anomalyData.metrics?.timeSpan || 1800) * 1000 / 20),
      value: Math.random() * 100 + (i > 10 && i < 16 ? 200 : 0), // Spike in the middle
      normal: Math.random() * 30 + 20
    }));
  }, [anomalyData]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg text-muted-foreground">Loading anomaly profile...</div>
        </div>
      </div>
    );
  }

  if (error || !anomalyData) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg text-red-500">{error || 'Anomaly not found'}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Anomaly Profile</h1>
          <p className="text-muted-foreground">Detailed analysis of blockchain anomaly #{anomalyId}</p>
        </div>
        <button
          onClick={() => router.back()}
          className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
        >
          ← Back
        </button>
      </div>

      {/* Alert Summary */}
      <Card className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 text-sm rounded ${getSeverityColor(anomalyData.severity)}`}>
                {anomalyData.severity.toUpperCase()}
              </span>
              <span className="text-sm text-muted-foreground">
                {new Date(anomalyData.timestamp).toLocaleString()}
              </span>
            </div>
            <h2 className="text-xl font-semibold">
              {anomalyData.type.replace(/_/g, ' ').toUpperCase()}
            </h2>
            <p className="text-muted-foreground max-w-2xl">
              {anomalyData.description}
            </p>
          </div>
          <div className="text-right space-y-2">
            <div className="text-2xl font-bold text-primary">
              {anomalyData.metrics?.affectedAccounts || 0}
            </div>
            <div className="text-sm text-muted-foreground">Affected Accounts</div>
          </div>
        </div>
      </Card>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-2xl font-bold text-primary">
            {anomalyData.metrics?.transactionCount?.toLocaleString() || '0'}
          </div>
          <div className="text-sm text-muted-foreground">Transactions</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-primary">
            {anomalyData.metrics?.totalValue?.toFixed(1) || '0'} SOL
          </div>
          <div className="text-sm text-muted-foreground">Total Value</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-primary">
            {Math.floor((anomalyData.metrics?.timeSpan || 0) / 60)}m
          </div>
          <div className="text-sm text-muted-foreground">Duration</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-primary">
            5.2x
          </div>
          <div className="text-sm text-muted-foreground">Above Normal</div>
        </Card>
      </div>

      {/* Timeline Visualization */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Activity Timeline</h3>
        <div className="h-64 relative">
          <svg className="w-full h-full">
            {/* Grid lines */}
            {Array.from({ length: 5 }, (_, i) => (
              <line
                key={i}
                x1="0"
                y1={`${(i + 1) * 20}%`}
                x2="100%"
                y2={`${(i + 1) * 20}%`}
                stroke="currentColor"
                strokeOpacity="0.1"
              />
            ))}
            
            {/* Normal baseline */}
            <polyline
              fill="none"
              stroke="hsl(var(--muted-foreground))"
              strokeWidth="2"
              strokeOpacity="0.5"
              points={timelineData.map((point, i) => 
                `${(i / (timelineData.length - 1)) * 100},${100 - (point.normal / 300) * 100}`
              ).join(' ')}
            />
            
            {/* Anomaly line */}
            <polyline
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="3"
              points={timelineData.map((point, i) => 
                `${(i / (timelineData.length - 1)) * 100},${100 - (point.value / 300) * 100}`
              ).join(' ')}
            />
          </svg>
          <div className="absolute bottom-0 left-0 text-xs text-muted-foreground">
            {new Date(anomalyData.timestamp - (anomalyData.metrics?.timeSpan || 0) * 1000).toLocaleTimeString()}
          </div>
          <div className="absolute bottom-0 right-0 text-xs text-muted-foreground">
            {new Date(anomalyData.timestamp).toLocaleTimeString()}
          </div>
        </div>
      </Card>

      {/* Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Involved Accounts */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Involved Accounts</h3>
          <div className="space-y-2">
            {anomalyData.event?.data?.accountKeys?.map((account: string, index: number) => (
              <button
                key={index}
                onClick={() => window.open(`/account/${account}`, '_blank', 'noopener,noreferrer')}
                className="block w-full text-left p-2 border rounded hover:bg-accent text-primary hover:underline font-mono text-sm"
              >
                {account}
              </button>
            )) || (
              <div className="text-muted-foreground text-sm">No accounts identified</div>
            )}
          </div>
        </Card>

        {/* Related Events */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Related Events</h3>
          <div className="space-y-2">
            {relatedEvents.map((event, index) => (
              <button
                key={index}
                onClick={() => window.open(`/tx/${event.signature}`, '_blank', 'noopener,noreferrer')}
                className="block w-full text-left p-2 border rounded hover:bg-accent"
              >
                <div className="text-primary hover:underline font-mono text-sm">
                  {event.signature}
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(event.timestamp).toLocaleString()} • {event.fee} SOL
                </div>
              </button>
            ))}
            {relatedEvents.length === 0 && (
              <div className="text-muted-foreground text-sm">No related events found</div>
            )}
          </div>
        </Card>

        {/* Analysis */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Analysis</h3>
          <div className="space-y-3 text-sm">
            <div>
              <strong>Detection Method:</strong> AI pattern recognition comparing real-time metrics against baseline behavior
            </div>
            <div>
              <strong>Risk Level:</strong> {anomalyData.severity === 'critical' ? 'Immediate attention required' : 
                                            anomalyData.severity === 'high' ? 'Monitor closely' :
                                            anomalyData.severity === 'medium' ? 'Investigate when possible' : 'Low priority review'}
            </div>
            <div>
              <strong>Confidence:</strong> 94% (High confidence based on multiple indicators)
            </div>
            <div>
              <strong>False Positive Probability:</strong> 6%
            </div>
          </div>
        </Card>

        {/* Similar Alerts */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Similar Historical Alerts</h3>
          <div className="space-y-2">
            {similarAlerts.map((alert, index) => (
              <button
                key={index}
                onClick={() => router.push(`/anomaly/${alert.id}`)}
                className="block w-full text-left p-2 border rounded hover:bg-accent"
              >
                <div className="flex items-center justify-between">
                  <span className={`px-2 py-1 text-xs rounded ${getSeverityColor(alert.severity)}`}>
                    {alert.severity.toUpperCase()}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(alert.timestamp).toLocaleString()}
                  </span>
                </div>
                <div className="text-sm mt-1">{alert.description}</div>
              </button>
            ))}
            {similarAlerts.length === 0 && (
              <div className="text-muted-foreground text-sm">No similar alerts found</div>
            )}
          </div>
        </Card>
      </div>

      {/* Action Buttons */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Actions</h3>
            <p className="text-sm text-muted-foreground">Take action on this anomaly</p>
          </div>
          <div className="flex space-x-3">
            <button className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600">
              Mark as False Positive
            </button>
            <button className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600">
              Investigate Further
            </button>
            <button className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600">
              Escalate Alert
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
});