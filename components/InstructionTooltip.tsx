'use client';

import React, { useState } from 'react';
import { InfoIcon, CopyIcon, CheckIcon, ExternalLinkIcon, AlertTriangleIcon, ShieldCheckIcon } from 'lucide-react';
import Link from 'next/link';

interface InstructionTooltipProps {
  instruction: {
    program: string;
    programId: string;
    instructionType: string;
    description: string;
    category: string;
    riskLevel: 'low' | 'medium' | 'high';
    accounts: Array<{
      pubkey: string;
      role: string;
      description: string;
      isSigner: boolean;
      isWritable: boolean;
    }>;
    parameters: Array<{
      name: string;
      value: any;
      type: string;
      description: string;
    }>;
    computeUnits?: number;
  };
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

const InstructionTooltip: React.FC<InstructionTooltipProps> = ({
  instruction,
  children,
  position = 'top'
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const getRiskIcon = (riskLevel: string) => {
    switch (riskLevel) {
      case 'low':
        return <ShieldCheckIcon className="w-4 h-4 text-green-500" />;
      case 'medium':
        return <InfoIcon className="w-4 h-4 text-yellow-500" />;
      case 'high':
        return <AlertTriangleIcon className="w-4 h-4 text-red-500" />;
      default:
        return <InfoIcon className="w-4 h-4 text-gray-500" />;
    }
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      system: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      token: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      defi: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      nft: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
      governance: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
      unknown: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
    };
    return colors[category as keyof typeof colors] || colors.unknown;
  };

  const getPositionClasses = () => {
    const baseClasses = 'absolute z-50 w-96 max-w-sm';
    switch (position) {
      case 'top':
        return `${baseClasses} bottom-full left-1/2 transform -translate-x-1/2 mb-2`;
      case 'bottom':
        return `${baseClasses} top-full left-1/2 transform -translate-x-1/2 mt-2`;
      case 'left':
        return `${baseClasses} right-full top-1/2 transform -translate-y-1/2 mr-2`;
      case 'right':
        return `${baseClasses} left-full top-1/2 transform -translate-y-1/2 ml-2`;
      default:
        return `${baseClasses} bottom-full left-1/2 transform -translate-x-1/2 mb-2`;
    }
  };

  return (
    <div 
      className="relative inline-block"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      
      {isVisible && (
        <div className={getPositionClasses()}>
          <div className="bg-background border border-border rounded-lg shadow-lg p-4 backdrop-blur-sm">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <span className="font-semibold text-foreground">{instruction.program}</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(instruction.category)}`}>
                  {instruction.category}
                </span>
                {getRiskIcon(instruction.riskLevel)}
              </div>
              <Link
                href={`/program/${instruction.programId}`}
                className="text-primary hover:text-primary/80 transition-colors"
                title="View program details"
              >
                <ExternalLinkIcon className="w-4 h-4" />
              </Link>
            </div>

            {/* Description */}
            <div className="mb-3">
              <p className="text-sm text-muted-foreground">{instruction.description}</p>
            </div>

            {/* Program ID */}
            <div className="mb-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-foreground">Program ID</span>
                <button
                  onClick={() => copyToClipboard(instruction.programId, 'programId')}
                  className="text-primary hover:text-primary/80 transition-colors"
                  title="Copy program ID"
                >
                  {copiedField === 'programId' ? (
                    <CheckIcon className="w-3 h-3" />
                  ) : (
                    <CopyIcon className="w-3 h-3" />
                  )}
                </button>
              </div>
              <p className="text-xs font-mono text-muted-foreground break-all">
                {instruction.programId}
              </p>
            </div>

            {/* Instruction Type */}
            <div className="mb-3">
              <span className="text-xs font-medium text-foreground">Type: </span>
              <span className="text-xs text-muted-foreground capitalize">
                {instruction.instructionType}
              </span>
            </div>

            {/* Compute Units */}
            {instruction.computeUnits && (
              <div className="mb-3">
                <span className="text-xs font-medium text-foreground">Compute Units: </span>
                <span className="text-xs text-muted-foreground">
                  {instruction.computeUnits.toLocaleString()}
                </span>
              </div>
            )}

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="bg-muted/20 p-2 rounded">
                <div className="text-xs font-medium text-foreground">Accounts</div>
                <div className="text-sm text-muted-foreground">{instruction.accounts.length}</div>
              </div>
              <div className="bg-muted/20 p-2 rounded">
                <div className="text-xs font-medium text-foreground">Parameters</div>
                <div className="text-sm text-muted-foreground">{instruction.parameters.length}</div>
              </div>
            </div>

            {/* Key Accounts */}
            {instruction.accounts.length > 0 && (
              <div className="mb-3">
                <div className="text-xs font-medium text-foreground mb-1">Key Accounts</div>
                <div className="space-y-1">
                  {instruction.accounts.slice(0, 3).map((account, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-mono text-muted-foreground truncate">
                          {account.pubkey.substring(0, 20)}...
                        </div>
                        <div className="text-xs text-muted-foreground capitalize">
                          {account.role}
                        </div>
                      </div>
                      <div className="flex items-center space-x-1 ml-2">
                        {account.isSigner && (
                          <span className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-1 py-0.5 rounded text-xs">
                            S
                          </span>
                        )}
                        {account.isWritable && (
                          <span className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 px-1 py-0.5 rounded text-xs">
                            W
                          </span>
                        )}
                        <button
                          onClick={() => copyToClipboard(account.pubkey, `account-${index}`)}
                          className="text-primary hover:text-primary/80 transition-colors"
                          title="Copy account address"
                        >
                          {copiedField === `account-${index}` ? (
                            <CheckIcon className="w-3 h-3" />
                          ) : (
                            <CopyIcon className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                  {instruction.accounts.length > 3 && (
                    <div className="text-xs text-muted-foreground">
                      +{instruction.accounts.length - 3} more accounts
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Key Parameters */}
            {instruction.parameters.length > 0 && (
              <div>
                <div className="text-xs font-medium text-foreground mb-1">Parameters</div>
                <div className="space-y-1">
                  {instruction.parameters.slice(0, 3).map((param, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-foreground">{param.name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {formatParameterValue(param.value, param.type)}
                        </div>
                      </div>
                      <span className="text-xs bg-muted px-1 py-0.5 rounded text-muted-foreground ml-2">
                        {param.type}
                      </span>
                    </div>
                  ))}
                  {instruction.parameters.length > 3 && (
                    <div className="text-xs text-muted-foreground">
                      +{instruction.parameters.length - 3} more parameters
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Arrow pointer */}
            <div className={`absolute w-2 h-2 bg-background border-border transform rotate-45 ${
              position === 'top' ? 'top-full left-1/2 -translate-x-1/2 -mt-1 border-b border-r' :
              position === 'bottom' ? 'bottom-full left-1/2 -translate-x-1/2 -mb-1 border-t border-l' :
              position === 'left' ? 'left-full top-1/2 -translate-y-1/2 -ml-1 border-t border-r' :
              'right-full top-1/2 -translate-y-1/2 -mr-1 border-b border-l'
            }`} />
          </div>
        </div>
      )}
    </div>
  );
};

// Helper function to format parameter values
function formatParameterValue(value: any, type: string): string {
  if (type === 'amount' && typeof value === 'number') {
    return value.toLocaleString();
  }
  if (typeof value === 'string' && value.length > 30) {
    return value.substring(0, 30) + '...';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value).substring(0, 30) + '...';
  }
  return String(value);
}

export default InstructionTooltip;