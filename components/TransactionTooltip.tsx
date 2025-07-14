/**
 * Tooltip component for displaying transaction details on hover
 * Fetches additional data from APIs when needed
 */

'use client';

import React, { useState } from 'react';
import { BlockchainEvent } from './LiveEventMonitor';

interface TransactionTooltipProps {
  event: BlockchainEvent;
  children: React.ReactNode;
}

interface TransactionDetails {
  signature: string;
  slot: number;
  blockTime?: number;
  fee: number;
  status: string;
  computeUnitsConsumed?: number;
  accounts: string[];
  instructions: number;
  logs: string[];
}

export function TransactionTooltip({ event, children }: TransactionTooltipProps) {
  const [details, setDetails] = useState<TransactionDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  const fetchTransactionDetails = async (signature: string) => {
    if (!signature || isLoading || details) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/transaction?signature=${signature}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.transaction) {
          setDetails({
            signature: data.transaction.signature,
            slot: data.transaction.slot,
            blockTime: data.transaction.blockTime,
            fee: data.transaction.fee,
            status: data.transaction.confirmationStatus || 'confirmed',
            computeUnitsConsumed: data.transaction.meta?.computeUnitsConsumed,
            accounts: data.transaction.transaction?.message?.accountKeys?.slice(0, 5) || [],
            instructions: data.transaction.transaction?.message?.instructions?.length || 0,
            logs: data.transaction.meta?.logMessages?.slice(0, 3) || []
          });
        }
      }
    } catch (error) {
      console.error('Failed to fetch transaction details:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMouseEnter = () => {
    setShowTooltip(true);
    if (event.type === 'transaction' && event.data?.signature) {
      fetchTransactionDetails(event.data.signature);
    }
  };

  const handleMouseLeave = () => {
    setShowTooltip(false);
  };

  if (event.type !== 'transaction' || !event.data?.signature) {
    return <>{children}</>;
  }

  return (
    <div 
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      
      {showTooltip && (
        <div className="absolute z-50 bg-black text-white text-xs rounded p-3 shadow-lg min-w-72 max-w-96 left-0 top-full mt-2 border">
          {isLoading ? (
            <div className="flex items-center space-x-2">
              <div className="animate-spin w-3 h-3 border border-white border-t-transparent rounded-full"></div>
              <span>Loading transaction details...</span>
            </div>
          ) : details ? (
            <div className="space-y-2">
              <div className="font-semibold border-b border-gray-600 pb-1 mb-2">
                Transaction Details
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-gray-300">Signature:</span>
                  <div className="font-mono text-white truncate">
                    {details.signature.substring(0, 16)}...
                  </div>
                </div>
                
                <div>
                  <span className="text-gray-300">Slot:</span>
                  <div className="text-white">{details.slot.toLocaleString()}</div>
                </div>
                
                <div>
                  <span className="text-gray-300">Fee:</span>
                  <div className="text-white">{(details.fee / 1e9).toFixed(6)} SOL</div>
                </div>
                
                <div>
                  <span className="text-gray-300">Status:</span>
                  <div className="text-green-400">{details.status}</div>
                </div>
                
                {details.computeUnitsConsumed && (
                  <>
                    <div>
                      <span className="text-gray-300">Compute:</span>
                      <div className="text-white">{details.computeUnitsConsumed.toLocaleString()}</div>
                    </div>
                  </>
                )}
                
                <div>
                  <span className="text-gray-300">Instructions:</span>
                  <div className="text-white">{details.instructions}</div>
                </div>
              </div>
              
              {details.accounts.length > 0 && (
                <div className="mt-3 pt-2 border-t border-gray-600">
                  <div className="text-gray-300 mb-1">Accounts:</div>
                  {details.accounts.slice(0, 3).map((account, idx) => (
                    <div key={idx} className="font-mono text-xs text-blue-300 truncate">
                      {account.substring(0, 8)}...{account.substring(account.length - 4)}
                    </div>
                  ))}
                  {details.accounts.length > 3 && (
                    <div className="text-gray-400 text-xs">
                      +{details.accounts.length - 3} more...
                    </div>
                  )}
                </div>
              )}
              
              {details.logs.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-600">
                  <div className="text-gray-300 mb-1">Logs:</div>
                  {details.logs.map((log, idx) => (
                    <div key={idx} className="text-xs text-yellow-300 truncate">
                      {log.substring(0, 40)}...
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              <div className="font-semibold">Transaction Info</div>
              <div>Signature: {event.data.signature.substring(0, 16)}...</div>
              <div>Fee: {event.data.fee ? `${(event.data.fee / 1e9).toFixed(6)} SOL` : 'N/A'}</div>
              <div>Status: {event.data.err ? 'Failed' : 'Success'}</div>
              <div className="text-gray-300 text-xs mt-2">
                Hover longer for more details...
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}