/**
 * Stacked Anomaly Alerts Component
 * 
 * Groups anomalies by type and provides expandable stacks
 */

'use client';

import React, { useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { ChevronDown, ChevronRight, AlertTriangle, Clock, Eye } from 'lucide-react';
import { AnomalyStack, DeduplicatedAnomaly } from '@/lib/utils/deduplication';

interface StackedAnomalyAlertsProps {
  stacks: AnomalyStack[];
  onAnomalyClick?: (anomaly: DeduplicatedAnomaly) => void;
  onStackToggle?: (type: string, expanded: boolean) => void;
}

export const StackedAnomalyAlerts = React.memo(function StackedAnomalyAlerts({
  stacks,
  onAnomalyClick,
  onStackToggle
}: StackedAnomalyAlertsProps) {
  const [expandedStacks, setExpandedStacks] = useState<Set<string>>(new Set());

  const getSeverityColor = useCallback((severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500 text-white border-red-600';
      case 'high': return 'bg-orange-500 text-white border-orange-600';
      case 'medium': return 'bg-yellow-500 text-black border-yellow-600';
      case 'low': return 'bg-blue-500 text-white border-blue-600';
      default: return 'bg-gray-500 text-white border-gray-600';
    }
  }, []);

  const getSeverityIcon = useCallback((severity: string) => {
    const iconClass = "w-4 h-4";
    switch (severity) {
      case 'critical': return <AlertTriangle className={`${iconClass} text-red-500`} />;
      case 'high': return <AlertTriangle className={`${iconClass} text-orange-500`} />;
      case 'medium': return <AlertTriangle className={`${iconClass} text-yellow-500`} />;
      case 'low': return <AlertTriangle className={`${iconClass} text-blue-500`} />;
      default: return <AlertTriangle className={`${iconClass} text-gray-500`} />;
    }
  }, []);

  const toggleStack = useCallback((type: string) => {
    setExpandedStacks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(type)) {
        newSet.delete(type);
      } else {
        newSet.add(type);
      }
      onStackToggle?.(type, newSet.has(type));
      return newSet;
    });
  }, [onStackToggle]);

  const formatTimeAgo = useCallback((timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  }, []);

  const formatTypeDisplay = useCallback((type: string) => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }, []);

  if (stacks.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No anomalies detected</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto space-y-2">
      {stacks.map((stack) => {
        const isExpanded = expandedStacks.has(stack.type);
        
        return (
          <Card key={stack.type} className="border-l-4 border-l-transparent hover:border-l-blue-500 transition-colors">
            {/* Stack Header */}
            <div 
              className="p-3 cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => toggleStack(stack.type)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  )}
                  
                  {getSeverityIcon(stack.severity)}
                  
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-sm">
                        {formatTypeDisplay(stack.type)}
                      </span>
                      <span className={`px-2 py-1 text-xs rounded-full ${getSeverityColor(stack.severity)}`}>
                        {stack.severity.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {stack.description}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                  <div className="flex items-center space-x-1">
                    <span className="font-medium text-foreground">{stack.count}</span>
                    <span>instances</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Clock className="w-3 h-3" />
                    <span>{formatTimeAgo(stack.lastSeen)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Expanded Stack Content */}
            {isExpanded && (
              <div className="border-t border-border">
                <div className="p-3 space-y-2">
                  {stack.anomalies.map((anomaly) => (
                    <div
                      key={anomaly.id}
                      className="p-2 bg-muted/30 rounded border-l-2 border-l-muted hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => onAnomalyClick?.(anomaly)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className={`w-2 h-2 rounded-full ${getSeverityColor(anomaly.severity).split(' ')[0]}`} />
                          <span className="text-sm font-medium">
                            {anomaly.count > 1 ? `${anomaly.count}x ` : ''}
                            {anomaly.description}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                          <div className="flex items-center space-x-1">
                            <Eye className="w-3 h-3" />
                            <span>View</span>
                          </div>
                          <span>{formatTimeAgo(anomaly.timestamp)}</span>
                        </div>
                      </div>
                      
                      {anomaly.count > 1 && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          First seen: {formatTimeAgo(anomaly.firstSeen)} • 
                          Last seen: {formatTimeAgo(anomaly.lastSeen)}
                        </div>
                      )}
                      
                      {anomaly.event?.data && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          Related to: {anomaly.event.type} event
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
});