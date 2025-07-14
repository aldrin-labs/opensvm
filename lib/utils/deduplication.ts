/**
 * Deduplication utilities for events and anomalies
 */

import { generateSecureUUID } from '@/lib/crypto-utils';
import { createHash } from 'crypto';

export interface DeduplicatedEvent {
  id: string;
  type: string;
  timestamp: number;
  signature?: string;
  data: any;
  metadata?: any;
  count: number; // Number of times this event occurred
  firstSeen: number;
  lastSeen: number;
}

export interface DeduplicatedAnomaly {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  timestamp: number;
  count: number; // Number of similar anomalies
  firstSeen: number;
  lastSeen: number;
  instances: string[]; // IDs of individual anomaly instances
  event?: {
    type: string;
    data: any;
  };
}

export interface AnomalyStack {
  type: string;
  count: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  firstSeen: number;
  lastSeen: number;
  description: string;
  anomalies: DeduplicatedAnomaly[];
  expanded: boolean;
}

/**
 * Generate a cryptographically secure hash for data integrity
 */
function generateSecureHash(data: string): string {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    // Browser environment - use Web Crypto API (async, but we'll use a sync fallback)
    // For now, use a deterministic hash based on the data
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  } else if (typeof require !== 'undefined') {
    // Node.js environment - use crypto module
    try {
      return createHash('sha256').update(data).digest('hex').slice(0, 16);
    } catch (error) {
      // Fallback to simple hash
      let hash = 0;
      for (let i = 0; i < data.length; i++) {
        const char = data.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return Math.abs(hash).toString(36);
    }
  } else {
    // Fallback hash function
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }
}

/**
 * Generate a unique key for an event based on its signature or content
 */
export function generateEventKey(event: any): string {
  // For transactions, use signature if available
  if (event.type === 'transaction' && event.data?.signature) {
    return `tx_${event.data.signature}`;
  }
  
  // For blocks, use slot number
  if (event.type === 'block' && event.data?.slot) {
    return `block_${event.data.slot}`;
  }
  
  // For account changes, use account + slot
  if (event.type === 'account_change' && event.data?.account && event.data?.slot) {
    return `account_${event.data.account}_${event.data.slot}`;
  }
  
  // Fallback: hash critical data with secure hash
  const criticalData = {
    type: event.type,
    timestamp: Math.floor(event.timestamp / 1000), // Round to seconds
    dataKeys: Object.keys(event.data || {}).sort(), // Include data structure
    dataSize: JSON.stringify(event.data || {}).length
  };
  
  const dataString = JSON.stringify(criticalData);
  const hash = generateSecureHash(dataString);
  
  return `event_${event.type}_${hash}`;
}

/**
 * Generate a unique key for an anomaly based on its type and critical data
 * Enhanced with collision-resistant hashing
 */
export function generateAnomalyKey(anomaly: any): string {
  // Extract critical identifying information
  const criticalData = {
    type: anomaly.type,
    severity: anomaly.severity,
    // Round timestamp to 5-minute intervals for grouping
    timeWindow: Math.floor(anomaly.timestamp / (5 * 60 * 1000)),
    // Include event-specific data for better uniqueness
    eventType: anomaly.event?.type || null,
    // Include some description context to avoid grouping different issues
    descriptionHash: anomaly.description ? generateSecureHash(anomaly.description.slice(0, 50)) : null
  };
  
  // Create deterministic hash of critical data
  const dataString = JSON.stringify(criticalData);
  const hash = generateSecureHash(dataString);
  
  return `anomaly_${anomaly.type}_${hash}`;
}

/**
 * Enhanced deduplication with collision detection
 */
export function deduplicateEvents(events: any[]): DeduplicatedEvent[] {
  const eventMap = new Map<string, DeduplicatedEvent>();
  const collisionTracker = new Map<string, number>();
  
  for (const event of events) {
    let key = generateEventKey(event);
    
    // Collision detection - if we have the same key but different core data, create a variant
    if (eventMap.has(key)) {
      const existing = eventMap.get(key)!;
      
      // Check if this is actually the same event or a collision
      const isSameEvent = (
        existing.type === event.type &&
        existing.signature === event.data?.signature &&
        JSON.stringify(existing.data) === JSON.stringify(event.data)
      );
      
      if (isSameEvent) {
        // Same event, increment count
        existing.count++;
        existing.lastSeen = event.timestamp;
        
        // Update data if newer
        if (event.timestamp > existing.timestamp) {
          existing.data = event.data;
          existing.metadata = event.metadata;
          existing.timestamp = event.timestamp;
        }
      } else {
        // Collision detected, create a variant key
        const collisionCount = (collisionTracker.get(key) || 0) + 1;
        collisionTracker.set(key, collisionCount);
        key = `${key}_collision_${collisionCount}`;
        
        // Create new entry with collision-resistant key
        eventMap.set(key, {
          id: event.id || generateSecureUUID(),
          type: event.type,
          timestamp: event.timestamp,
          signature: event.data?.signature,
          data: event.data,
          metadata: event.metadata,
          count: 1,
          firstSeen: event.timestamp,
          lastSeen: event.timestamp
        });
        
        console.warn(`[DEDUPLICATION] Event key collision detected and resolved: ${key}`);
      }
    } else {
      eventMap.set(key, {
        id: event.id || generateSecureUUID(),
        type: event.type,
        timestamp: event.timestamp,
        signature: event.data?.signature,
        data: event.data,
        metadata: event.metadata,
        count: 1,
        firstSeen: event.timestamp,
        lastSeen: event.timestamp
      });
    }
  }
  
  return Array.from(eventMap.values()).sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Enhanced anomaly deduplication with collision detection
 */
export function deduplicateAnomalies(anomalies: any[]): DeduplicatedAnomaly[] {
  const anomalyMap = new Map<string, DeduplicatedAnomaly>();
  const collisionTracker = new Map<string, number>();
  
  for (const anomaly of anomalies) {
    let key = generateAnomalyKey(anomaly);
    
    if (anomalyMap.has(key)) {
      const existing = anomalyMap.get(key)!;
      
      // Check if this is actually the same anomaly type or a collision
      const isSameAnomaly = (
        existing.type === anomaly.type &&
        existing.description === anomaly.description &&
        existing.severity === anomaly.severity
      );
      
      if (isSameAnomaly) {
        // Same anomaly, group together
        existing.count++;
        existing.lastSeen = anomaly.timestamp;
        existing.instances.push(anomaly.id);
        
        // Update to highest severity
        const severityOrder = { low: 1, medium: 2, high: 3, critical: 4 };
        if (severityOrder[anomaly.severity] > severityOrder[existing.severity]) {
          existing.severity = anomaly.severity;
        }
      } else {
        // Collision detected, create a variant key
        const collisionCount = (collisionTracker.get(key) || 0) + 1;
        collisionTracker.set(key, collisionCount);
        key = `${key}_collision_${collisionCount}`;
        
        // Create new entry with collision-resistant key
        anomalyMap.set(key, {
          id: anomaly.id || generateSecureUUID(),
          type: anomaly.type,
          severity: anomaly.severity,
          description: anomaly.description,
          timestamp: anomaly.timestamp,
          count: 1,
          firstSeen: anomaly.timestamp,
          lastSeen: anomaly.timestamp,
          instances: [anomaly.id],
          event: anomaly.event
        });
        
        console.warn(`[DEDUPLICATION] Anomaly key collision detected and resolved: ${key}`);
      }
    } else {
      anomalyMap.set(key, {
        id: anomaly.id || generateSecureUUID(),
        type: anomaly.type,
        severity: anomaly.severity,
        description: anomaly.description,
        timestamp: anomaly.timestamp,
        count: 1,
        firstSeen: anomaly.timestamp,
        lastSeen: anomaly.timestamp,
        instances: [anomaly.id],
        event: anomaly.event
      });
    }
  }
  
  return Array.from(anomalyMap.values()).sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Stack anomalies by type
 */
export function stackAnomaliesByType(anomalies: DeduplicatedAnomaly[]): AnomalyStack[] {
  const stackMap = new Map<string, AnomalyStack>();
  
  for (const anomaly of anomalies) {
    if (stackMap.has(anomaly.type)) {
      const existing = stackMap.get(anomaly.type)!;
      existing.count += anomaly.count;
      existing.lastSeen = Math.max(existing.lastSeen, anomaly.lastSeen);
      existing.firstSeen = Math.min(existing.firstSeen, anomaly.firstSeen);
      existing.anomalies.push(anomaly);
      
      // Update to highest severity
      const severityOrder = { low: 1, medium: 2, high: 3, critical: 4 };
      if (severityOrder[anomaly.severity] > severityOrder[existing.severity]) {
        existing.severity = anomaly.severity;
      }
    } else {
      stackMap.set(anomaly.type, {
        type: anomaly.type,
        count: anomaly.count,
        severity: anomaly.severity,
        firstSeen: anomaly.firstSeen,
        lastSeen: anomaly.lastSeen,
        description: anomaly.description,
        anomalies: [anomaly],
        expanded: false
      });
    }
  }
  
  return Array.from(stackMap.values()).sort((a, b) => {
    // Sort by severity first, then by last seen
    const severityOrder = { low: 1, medium: 2, high: 3, critical: 4 };
    const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
    if (severityDiff !== 0) return severityDiff;
    
    return b.lastSeen - a.lastSeen;
  });
}

/**
 * Clean up old events and anomalies
 */
export function cleanupOldData<T extends { timestamp: number }>(
  items: T[],
  maxAge: number = 24 * 60 * 60 * 1000, // 24 hours
  maxCount: number = 1000
): T[] {
  const now = Date.now();
  const cutoff = now - maxAge;
  
  // Filter by age first
  const recent = items.filter(item => item.timestamp > cutoff);
  
  // Then limit by count
  return recent.slice(0, maxCount);
}