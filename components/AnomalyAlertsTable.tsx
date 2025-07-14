/**
 * Anomaly Alerts Table Component
 * 
 * Displays all anomaly alerts with detail panel and full-screen anomaly profile functionality
 */

'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { CopyButton } from '@/components/CopyButton';

interface AnomalyAlert {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  timestamp: number;
  event?: {
    type: string;
    data: any;
  };
}

interface AnomalyAlertsTableProps {
  alerts: AnomalyAlert[];
}

export const AnomalyAlertsTable = React.memo(function AnomalyAlertsTable({ 
  alerts 
}: AnomalyAlertsTableProps) {
  const [selectedAlert, setSelectedAlert] = useState<AnomalyAlert | null>(null);
  const [relatedEvents, setRelatedEvents] = useState<any[]>([]);
  const [similarAlerts, setSimilarAlerts] = useState<AnomalyAlert[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const getSeverityColor = useCallback((severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-yellow-500 text-black';
      case 'low': return 'bg-blue-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  }, []);

  const getAccountsFromAlert = useCallback((alert: AnomalyAlert): string[] => {
    if (!alert.event?.data?.accountKeys) return [];
    return alert.event.data.accountKeys.filter((key: string) => key && key.length > 0);
  }, []);

  const getTransactionIdFromAlert = useCallback((alert: AnomalyAlert): string | null => {
    if (!alert.event?.data?.signature) return null;
    return alert.event.data.signature;
  }, []);

  const getTokenMintFromAlert = useCallback((alert: AnomalyAlert): string[] => {
    const mints: string[] = [];
    
    // Check tokenChanges for mint addresses
    if (alert.event?.data?.tokenChanges) {
      alert.event.data.tokenChanges.forEach((change: any) => {
        if (change.mint) {
          mints.push(change.mint);
        }
      });
    }
    
    // Check preTokenBalances for mint addresses
    if (alert.event?.data?.preTokenBalances) {
      alert.event.data.preTokenBalances.forEach((balance: any) => {
        if (balance.mint) {
          mints.push(balance.mint);
        }
      });
    }
    
    // Check postTokenBalances for mint addresses
    if (alert.event?.data?.postTokenBalances) {
      alert.event.data.postTokenBalances.forEach((balance: any) => {
        if (balance.mint) {
          mints.push(balance.mint);
        }
      });
    }
    
    // Remove duplicates
    return [...new Set(mints)];
  }, []);

  const isTokenRelatedAnomaly = useCallback((alert: AnomalyAlert): boolean => {
    const tokenTypes = [
      'token_spam',
      'token_spam_detection',
      'pump_token_spam',
      'pump_rapid_minting',
      'pump_liquidity_manipulation',
      'large_transfer',
      'rapid_trades',
      'wash_trading',
      'wash_trading_detection',
      'price_manipulation',
      'liquidity_drain',
      'arbitrage_bot',
      'arbitrage_bot_detection'
    ];
    return tokenTypes.includes(alert.type);
  }, []);

  const isFeeRelatedAnomaly = useCallback((alert: AnomalyAlert): boolean => {
    const feeTypes = [
      'suspicious_fee_spike',
      'fee_spike'
    ];
    return feeTypes.includes(alert.type);
  }, []);

  const handleAlertClick = useCallback(async (alert: AnomalyAlert) => {
    setSelectedAlert(alert);
    setLoadingDetails(true);
    
    try {
      // Fetch related events and similar alerts
      const [relatedEventsResponse, similarAlertsResponse] = await Promise.all([
        fetch(`/api/anomaly/related?alertId=${alert.id}&accounts=${getAccountsFromAlert(alert).join(',')}`),
        fetch(`/api/anomaly/similar?alertId=${alert.id}&type=${alert.type}`)
      ]);

      if (relatedEventsResponse.ok) {
        const relatedData = await relatedEventsResponse.json();
        setRelatedEvents(relatedData.events || []);
      }

      if (similarAlertsResponse.ok) {
        const similarData = await similarAlertsResponse.json();
        setSimilarAlerts(similarData.alerts || []);
      }
    } catch (error) {
      console.error('Failed to fetch alert details:', error);
    } finally {
      setLoadingDetails(false);
    }
  }, [getAccountsFromAlert]);

  const openFullAnomalyProfile = useCallback((alert: AnomalyAlert) => {
    const url = `/anomaly/${alert.id}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }, []);

  const sortedAlerts = useMemo(() => {
    return [...alerts].sort((a, b) => {
      // Sort by severity first, then by timestamp
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const aSeverity = severityOrder[a.severity] || 0;
      const bSeverity = severityOrder[b.severity] || 0;
      
      if (aSeverity !== bSeverity) {
        return bSeverity - aSeverity;
      }
      
      return b.timestamp - a.timestamp;
    });
  }, [alerts]);

  if (alerts.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-muted-foreground py-8">
          <div className="text-lg mb-2">🔒 No anomalies detected</div>
          <div className="text-sm">System is monitoring for suspicious activity</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Alerts List - Left Side */}
      <div className="flex-1 overflow-y-auto pr-4">
        <div className="space-y-2">
          {sortedAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`p-3 border rounded-lg cursor-pointer transition-all duration-200 hover:shadow-md ${
                selectedAlert?.id === alert.id ? 'border-primary bg-primary/5' : 'hover:bg-accent/50'
              }`}
              onClick={() => handleAlertClick(alert)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2 py-1 text-xs rounded ${getSeverityColor(alert.severity)}`}>
                      {alert.severity.toUpperCase()}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(alert.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-sm font-medium mb-1">
                    {alert.type.replace(/_/g, ' ').toUpperCase()}
                  </div>
                  <div className="text-xs text-muted-foreground line-clamp-2">
                    {alert.description}
                  </div>
                </div>
                <div className="ml-2 flex flex-col gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openFullAnomalyProfile(alert);
                    }}
                    className="text-xs text-primary hover:underline"
                  >
                    Open Full →
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Detail Panel - Right Side */}
      {selectedAlert && (
        <div className="w-1/3 pl-4 border-l">
          <Card className="p-4 h-full overflow-y-auto">
            <div className="space-y-4">
              {/* Alert Header */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold">Anomaly Details</h4>
                  <button
                    onClick={() => openFullAnomalyProfile(selectedAlert)}
                    className="text-xs text-primary hover:underline"
                  >
                    Open Full Profile →
                  </button>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 text-xs rounded ${getSeverityColor(selectedAlert.severity)}`}>
                      {selectedAlert.severity.toUpperCase()}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(selectedAlert.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-sm font-medium">
                    {selectedAlert.type.replace(/_/g, ' ').toUpperCase()}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {selectedAlert.description}
                  </div>
                </div>
              </div>

              {/* Why This Anomaly */}
              <div>
                <h5 className="text-xs font-semibold mb-2">Why This is Anomalous</h5>
                <div className="text-xs text-muted-foreground">
                  {getAnomalyExplanation(selectedAlert)}
                </div>
              </div>

              {/* Transaction ID for Fee Spikes */}
              {isFeeRelatedAnomaly(selectedAlert) && getTransactionIdFromAlert(selectedAlert) && (
                <div>
                  <h5 className="text-xs font-semibold mb-2">Transaction ID</h5>
                  <div className="flex items-center">
                    <button
                      onClick={() => window.open(`/tx/${getTransactionIdFromAlert(selectedAlert)}`, '_blank', 'noopener,noreferrer')}
                      className="text-xs text-primary hover:underline font-mono"
                    >
                      {(() => {
                        const txId = getTransactionIdFromAlert(selectedAlert);
                        return txId ? `${txId.substring(0, 8)}...${txId.substring(txId.length - 8)}` : 'N/A';
                      })()}
                    </button>
                    <CopyButton text={getTransactionIdFromAlert(selectedAlert)!} />
                  </div>
                </div>
              )}

              {/* Token Mint Addresses for Token-Related Anomalies */}
              {isTokenRelatedAnomaly(selectedAlert) && getTokenMintFromAlert(selectedAlert).length > 0 && (
                <div>
                  <h5 className="text-xs font-semibold mb-2">Token Mint Addresses</h5>
                  <div className="space-y-1">
                    {getTokenMintFromAlert(selectedAlert).map((mint, index) => (
                      <div key={index} className="flex items-center">
                        <button
                          onClick={() => window.open(`/token/${mint}`, '_blank', 'noopener,noreferrer')}
                          className="text-xs text-primary hover:underline font-mono"
                        >
                          {mint.substring(0, 8)}...{mint.substring(mint.length - 8)}
                        </button>
                        <CopyButton text={mint} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Involved Accounts */}
              <div>
                <h5 className="text-xs font-semibold mb-2">Involved Accounts</h5>
                <div className="space-y-1">
                  {getAccountsFromAlert(selectedAlert).map((account, index) => (
                    <button
                      key={index}
                      onClick={() => window.open(`/account/${account}`, '_blank', 'noopener,noreferrer')}
                      className="block text-xs text-primary hover:underline font-mono"
                    >
                      {account.substring(0, 8)}...{account.substring(account.length - 8)}
                    </button>
                  ))}
                  {getAccountsFromAlert(selectedAlert).length === 0 && (
                    <div className="text-xs text-muted-foreground">No accounts identified</div>
                  )}
                </div>
              </div>

              {/* Related Events */}
              <div>
                <h5 className="text-xs font-semibold mb-2">Related Events</h5>
                {loadingDetails ? (
                  <div className="text-xs text-muted-foreground">Loading...</div>
                ) : (
                  <div className="space-y-1">
                    {relatedEvents.slice(0, 3).map((event, index) => (
                      <button
                        key={index}
                        onClick={() => window.open(`/tx/${event.signature}`, '_blank', 'noopener,noreferrer')}
                        className="block text-xs text-primary hover:underline font-mono"
                      >
                        {event.signature?.substring(0, 8)}...
                      </button>
                    ))}
                    {relatedEvents.length === 0 && (
                      <div className="text-xs text-muted-foreground">No related events found</div>
                    )}
                  </div>
                )}
              </div>

              {/* Similar Alerts */}
              <div>
                <h5 className="text-xs font-semibold mb-2">Similar Alerts</h5>
                {loadingDetails ? (
                  <div className="text-xs text-muted-foreground">Loading...</div>
                ) : (
                  <div className="space-y-1">
                    {similarAlerts.slice(0, 3).map((similar) => (
                      <button
                        key={similar.id}
                        onClick={() => handleAlertClick(similar)}
                        className="block text-xs text-primary hover:underline"
                      >
                        {similar.type.replace(/_/g, ' ')} - {new Date(similar.timestamp).toLocaleTimeString()}
                      </button>
                    ))}
                    {similarAlerts.length === 0 && (
                      <div className="text-xs text-muted-foreground">No similar alerts found</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
});

// Helper function to explain why an anomaly is suspicious
function getAnomalyExplanation(alert: AnomalyAlert): string {
  switch (alert.type) {
    case 'high_failure_rate':
      return 'This account/program has an unusually high transaction failure rate, which could indicate spam attacks, faulty code, or malicious activity.';
    case 'suspicious_fee_spike':
      return 'Transaction fees are significantly higher than normal, which could indicate network congestion manipulation or priority fee attacks.';
    case 'rapid_transaction_burst':
      return 'Multiple transactions from the same address in a very short time period, which could indicate bot activity or spam attacks.';
    case 'unusual_program_activity':
      return 'A program is being called with unusual frequency or patterns, which could indicate exploitation or abnormal usage.';
    case 'account_drain_detection':
      return 'Rapid depletion of account balance detected, which could indicate account compromise, theft, or unauthorized access.';
    case 'flash_loan_attack_pattern':
      return 'Pattern consistent with flash loan attacks detected, involving rapid borrowing and repaying with potential exploitation.';
    case 'sandwich_attack_detection':
      return 'MEV sandwich attack pattern identified, where transactions are placed before and after target transactions to extract value.';
    case 'wash_trading_detection':
      return 'Potential wash trading activity detected, involving circular trading patterns to artificially inflate volume.';
    case 'token_spam_detection':
      return 'Spam token creation or distribution detected, which could indicate airdrop farming or token flooding attacks.';
    case 'arbitrage_bot_detection':
      return 'High-frequency arbitrage bot activity detected, which may impact market dynamics and transaction costs.';
    case 'price_manipulation':
      return 'Artificial price manipulation patterns detected, involving coordinated trading to influence token prices.';
    case 'phishing_signature':
      return 'Potential phishing contract interactions detected, which could indicate users being tricked into malicious transactions.';
    case 'liquidity_drain':
      return 'Liquidity pool drainage patterns detected, which could indicate rug pulls or protocol exploitation.';
    case 'governance_attack':
      return 'Potential governance manipulation detected, involving unusual voting patterns or proposal activities.';
    default:
      return 'This pattern deviates from normal blockchain behavior and requires investigation.';
  }
}