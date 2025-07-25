'use client';

import React, { useState } from 'react';
import { X, Copy, Check, ExternalLink, AlertTriangle, ShieldCheck, Info, ChevronDown, ChevronRight } from 'lucide-react';
import Link from 'next/link';

interface InstructionDetailModalProps {
  instruction: {
    index: number;
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
    innerInstructions: any[];
    logs: string[];
    computeUnits?: number;
  };
  isOpen: boolean;
  onClose: () => void;
  transactionSignature?: string;
}

const InstructionDetailModal: React.FC<InstructionDetailModalProps> = ({
  instruction,
  isOpen,
  onClose,
  transactionSignature
}) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['overview', 'accounts']));

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  const getRiskIcon = (riskLevel: string) => {
    switch (riskLevel) {
      case 'low':
        return <ShieldCheck className="w-5 h-5 text-green-500" />;
      case 'medium':
        return <Info className="w-5 h-5 text-yellow-500" />;
      case 'high':
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      default:
        return <Info className="w-5 h-5 text-gray-500" />;
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

  const getRiskDescription = (riskLevel: string) => {
    switch (riskLevel) {
      case 'low':
        return 'This instruction performs standard operations with minimal risk.';
      case 'medium':
        return 'This instruction requires attention and may involve asset changes.';
      case 'high':
        return 'This instruction involves significant operations that could affect your assets.';
      default:
        return 'Risk level unknown for this instruction.';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-background rounded-lg shadow-xl border border-border w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center space-x-3">
            <h2 className="text-xl font-semibold text-foreground">
              Instruction #{instruction.index + 1}
            </h2>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getCategoryColor(instruction.category)}`}>
              {instruction.category}
            </span>
            {getRiskIcon(instruction.riskLevel)}
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* Overview Section */}
          <div className="mb-6">
            <div
              className="flex items-center justify-between cursor-pointer py-2"
              onClick={() => toggleSection('overview')}
            >
              <h3 className="text-lg font-medium text-foreground flex items-center space-x-2">
                <span>Overview</span>
                {expandedSections.has('overview') ? (
                  <ChevronDown className="w-5 h-5" />
                ) : (
                  <ChevronRight className="w-5 h-5" />
                )}
              </h3>
            </div>
            
            {expandedSections.has('overview') && (
              <div className="space-y-4">
                {/* Program Information */}
                <div className="bg-muted/20 p-4 rounded-lg">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-foreground">Program</label>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-foreground font-semibold">{instruction.program}</span>
                        <Link
                          href={`/program/${instruction.programId}`}
                          className="text-primary hover:text-primary/80 transition-colors"
                          title="View program details"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Link>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-foreground">Instruction Type</label>
                      <p className="text-foreground capitalize mt-1">{instruction.instructionType}</p>
                    </div>
                  </div>
                  
                  <div className="mt-4">
                    <label className="text-sm font-medium text-foreground">Program ID</label>
                    <div className="flex items-center space-x-2 mt-1">
                      <code className="flex-1 bg-background p-2 rounded border font-mono text-sm break-all">
                        {instruction.programId}
                      </code>
                      <button
                        onClick={() => copyToClipboard(instruction.programId, 'programId')}
                        className="text-primary hover:text-primary/80 transition-colors p-2"
                        title="Copy program ID"
                      >
                        {copiedField === 'programId' ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div className="bg-muted/20 p-4 rounded-lg">
                  <label className="text-sm font-medium text-foreground">Description</label>
                  <p className="text-muted-foreground mt-1">{instruction.description}</p>
                </div>

                {/* Risk Assessment */}
                <div className="bg-muted/20 p-4 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <label className="text-sm font-medium text-foreground">Risk Assessment</label>
                    {getRiskIcon(instruction.riskLevel)}
                    <span className="capitalize font-medium">{instruction.riskLevel} Risk</span>
                  </div>
                  <p className="text-muted-foreground text-sm">{getRiskDescription(instruction.riskLevel)}</p>
                </div>

                {/* Compute Units */}
                {instruction.computeUnits && (
                  <div className="bg-muted/20 p-4 rounded-lg">
                    <label className="text-sm font-medium text-foreground">Compute Units</label>
                    <p className="text-foreground mt-1">{instruction.computeUnits.toLocaleString()}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Accounts Section */}
          {instruction.accounts.length > 0 && (
            <div className="mb-6">
              <div
                className="flex items-center justify-between cursor-pointer py-2"
                onClick={() => toggleSection('accounts')}
              >
                <h3 className="text-lg font-medium text-foreground flex items-center space-x-2">
                  <span>Accounts ({instruction.accounts.length})</span>
                  {expandedSections.has('accounts') ? (
                    <ChevronDown className="w-5 h-5" />
                  ) : (
                    <ChevronRight className="w-5 h-5" />
                  )}
                </h3>
              </div>
              
              {expandedSections.has('accounts') && (
                <div className="space-y-3">
                  {instruction.accounts.map((account, index) => (
                    <div key={index} className="bg-muted/20 p-4 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium text-foreground">Account {index + 1}</span>
                          <div className="flex items-center space-x-1">
                            {account.isSigner && (
                              <span className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-2 py-1 rounded text-xs">
                                Signer
                              </span>
                            )}
                            {account.isWritable && (
                              <span className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 px-2 py-1 rounded text-xs">
                                Writable
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Link
                            href={`/account/${account.pubkey}`}
                            className="text-primary hover:text-primary/80 transition-colors"
                            title="View account details"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Link>
                          <button
                            onClick={() => copyToClipboard(account.pubkey, `account-${index}`)}
                            className="text-primary hover:text-primary/80 transition-colors"
                            title="Copy account address"
                          >
                            {copiedField === `account-${index}` ? (
                              <Check className="w-4 h-4" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">Address</label>
                          <code className="block bg-background p-2 rounded border font-mono text-sm break-all mt-1">
                            {account.pubkey}
                          </code>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs font-medium text-muted-foreground">Role</label>
                            <p className="text-sm text-foreground capitalize mt-1">{account.role}</p>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-muted-foreground">Description</label>
                            <p className="text-sm text-foreground mt-1">{account.description}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Parameters Section */}
          {instruction.parameters.length > 0 && (
            <div className="mb-6">
              <div
                className="flex items-center justify-between cursor-pointer py-2"
                onClick={() => toggleSection('parameters')}
              >
                <h3 className="text-lg font-medium text-foreground flex items-center space-x-2">
                  <span>Parameters ({instruction.parameters.length})</span>
                  {expandedSections.has('parameters') ? (
                    <ChevronDown className="w-5 h-5" />
                  ) : (
                    <ChevronRight className="w-5 h-5" />
                  )}
                </h3>
              </div>
              
              {expandedSections.has('parameters') && (
                <div className="space-y-3">
                  {instruction.parameters.map((param, index) => (
                    <div key={index} className="bg-muted/20 p-4 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-foreground">{param.name}</span>
                        <span className="text-xs bg-muted px-2 py-1 rounded text-muted-foreground">
                          {param.type}
                        </span>
                      </div>
                      
                      <div className="space-y-2">
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">Description</label>
                          <p className="text-sm text-foreground mt-1">{param.description}</p>
                        </div>
                        
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">Value</label>
                          <div className="flex items-center space-x-2 mt-1">
                            <code className="flex-1 bg-background p-2 rounded border font-mono text-sm break-all">
                              {formatParameterValue(param.value, param.type)}
                            </code>
                            <button
                              onClick={() => copyToClipboard(String(param.value), `param-${index}`)}
                              className="text-primary hover:text-primary/80 transition-colors p-2"
                              title="Copy parameter value"
                            >
                              {copiedField === `param-${index}` ? (
                                <Check className="w-4 h-4" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Inner Instructions Section */}
          {instruction.innerInstructions.length > 0 && (
            <div className="mb-6">
              <div
                className="flex items-center justify-between cursor-pointer py-2"
                onClick={() => toggleSection('innerInstructions')}
              >
                <h3 className="text-lg font-medium text-foreground flex items-center space-x-2">
                  <span>Inner Instructions ({instruction.innerInstructions.length})</span>
                  {expandedSections.has('innerInstructions') ? (
                    <ChevronDown className="w-5 h-5" />
                  ) : (
                    <ChevronRight className="w-5 h-5" />
                  )}
                </h3>
              </div>
              
              {expandedSections.has('innerInstructions') && (
                <div className="space-y-3">
                  {instruction.innerInstructions.map((innerIx, index) => (
                    <div key={index} className="bg-muted/10 p-4 rounded-lg border-l-4 border-primary">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-foreground">{innerIx.program}</span>
                        <span className="text-sm text-muted-foreground capitalize">{innerIx.instructionType}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{innerIx.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Logs Section */}
          {instruction.logs.length > 0 && (
            <div className="mb-6">
              <div
                className="flex items-center justify-between cursor-pointer py-2"
                onClick={() => toggleSection('logs')}
              >
                <h3 className="text-lg font-medium text-foreground flex items-center space-x-2">
                  <span>Logs ({instruction.logs.length})</span>
                  {expandedSections.has('logs') ? (
                    <ChevronDown className="w-5 h-5" />
                  ) : (
                    <ChevronRight className="w-5 h-5" />
                  )}
                </h3>
              </div>
              
              {expandedSections.has('logs') && (
                <div className="bg-muted/10 p-4 rounded-lg">
                  <div className="space-y-1 font-mono text-sm">
                    {instruction.logs.map((log, index) => (
                      <div key={index} className="text-muted-foreground">
                        <span className="text-muted-foreground/60">{index + 1}.</span> {log}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-border bg-muted/20">
          <div className="text-sm text-muted-foreground">
            {transactionSignature && (
              <span>Transaction: {transactionSignature.substring(0, 20)}...</span>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// Helper function to format parameter values
function formatParameterValue(value: any, type: string): string {
  if (type === 'amount' && typeof value === 'number') {
    return value.toLocaleString();
  }
  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
}

export default InstructionDetailModal;