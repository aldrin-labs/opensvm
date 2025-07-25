'use client';

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { 
  FocusManager, 
  ScreenReaderUtils, 
  useKeyboardNavigation, 
  useAccessibility,
  KEYBOARD_KEYS 
} from '@/lib/accessibility-utils';
import { 
  useMobileDetection, 
  useSwipeGestures,
  MobileComponentUtils,
  MobileModalUtils 
} from '@/lib/mobile-utils';
import { 
  ChevronDownIcon, 
  ChevronRightIcon, 
  InfoIcon, 
  AlertTriangleIcon, 
  ShieldCheckIcon,
  SearchIcon,
  FilterIcon,
  CopyIcon,
  CheckIcon,
  XIcon,
  EyeIcon,
  ZapIcon,
  HelpCircleIcon
} from 'lucide-react';
import Link from 'next/link';
import type { DetailedTransactionInfo } from '@/lib/solana';
import InstructionTooltip from './InstructionTooltip';
import InstructionDetailModal from './InstructionDetailModal';
import InstructionActions from './InstructionActions';

interface InstructionBreakdownProps {
  transaction: DetailedTransactionInfo;
  onInstructionClick?: (instruction: any, index: number) => void;
}

interface ParsedInstructionDisplay {
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
  innerInstructions: ParsedInstructionDisplay[];
  logs: string[];
  computeUnits?: number;
}

const InstructionBreakdown: React.FC<InstructionBreakdownProps> = ({
  transaction,
  onInstructionClick
}) => {
  const [expandedInstructions, setExpandedInstructions] = useState<Set<number>>(new Set([0]));
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['accounts', 'parameters']));
  const [selectedInstruction, setSelectedInstruction] = useState<ParsedInstructionDisplay | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Accessibility hooks
  const { highContrast, announceToScreenReader, isTouchDevice } = useAccessibility();
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Mobile detection
  const { isMobile, isTablet, viewportSize } = useMobileDetection();
  
  // Swipe gestures for mobile navigation
  useSwipeGestures(containerRef, {
    onSwipeLeft: () => {
      if (isMobile && expandedInstructions.size > 0) {
        // Collapse all instructions on swipe left
        setExpandedInstructions(new Set());
        announceToScreenReader('All instructions collapsed');
      }
    },
    onSwipeRight: () => {
      if (isMobile && expandedInstructions.size === 0) {
        // Expand first instruction on swipe right
        setExpandedInstructions(new Set([0]));
        announceToScreenReader('First instruction expanded');
      }
    }
  });
  
  // Keyboard navigation
  useKeyboardNavigation(containerRef, {
    onEscape: () => {
      if (isModalOpen) {
        handleCloseModal();
      }
    },
    roving: true
  });

  const handleShowInstructionDetails = (instruction: ParsedInstructionDisplay) => {
    setSelectedInstruction(instruction);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedInstruction(null);
  };

  // Parse and enhance instructions with additional metadata
  const enhancedInstructions = useMemo(() => {
    if (!transaction.details?.instructions) return [];

    return transaction.details.instructions.map((instruction, index) => {
      // Extract program information
      const program = instruction.program || getKnownProgramName(instruction.programId) || 'Unknown Program';
      const instructionType = instruction.parsed?.type || 'unknown';
      
      // Generate description
      const description = generateInstructionDescription(instruction);
      
      // Determine category and risk level
      const category = getProgramCategory(instruction.programId);
      const riskLevel = assessInstructionRisk(instruction);
      
      // Parse accounts with roles
      const accounts = parseAccountRoles(instruction, transaction.details?.accounts || []);
      
      // Extract parameters
      const parameters = extractInstructionParameters(instruction);
      
      // Get relevant logs
      const logs = getInstructionLogs(transaction.details?.logs || [], index);
      
      // Parse inner instructions
      const innerInstructions = parseInnerInstructions(
        transaction.details?.innerInstructions || [],
        index
      );

      return {
        index,
        program,
        programId: instruction.programId,
        instructionType,
        description,
        category,
        riskLevel,
        accounts,
        parameters,
        innerInstructions,
        logs,
        computeUnits: instruction.computeUnits
      } as ParsedInstructionDisplay;
    });
  }, [transaction]);

  const toggleInstruction = (index: number) => {
    const newExpanded = new Set(expandedInstructions);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedInstructions(newExpanded);
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

  if (!enhancedInstructions.length) {
    return (
      <div className="bg-background rounded-lg p-6 shadow-lg border border-border">
        <h2 className="text-xl font-semibold mb-4 text-foreground">Instructions</h2>
        <p className="text-muted-foreground">No instructions found in this transaction.</p>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className={`bg-background rounded-lg p-6 shadow-lg border border-border ${highContrast ? 'high-contrast-mode' : ''}`}
      role="region"
      aria-labelledby="instructions-heading"
    >
      <div className="flex items-center justify-between mb-6">
        <h2 
          id="instructions-heading"
          className="text-xl font-semibold text-foreground"
        >
          Instructions ({enhancedInstructions.length})
        </h2>
        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
          <span>Use Enter or Space to expand, Arrow keys to navigate</span>
        </div>
      </div>

      <div 
        className="space-y-4"
        role="list"
        aria-label="Transaction instructions"
      >
        {enhancedInstructions.map((instruction) => (
          <div
            key={instruction.index}
            className={`instruction-item border border-border rounded-lg overflow-hidden transition-all duration-200 hover:shadow-md ${expandedInstructions.has(instruction.index) ? 'expanded' : ''}`}
            role="listitem"
          >
            {/* Instruction Header */}
            <div className="instruction-header flex items-center justify-between p-4 bg-muted/30 hover:bg-muted/50 transition-colors">
              <button
                className={`flex items-center space-x-3 flex-1 text-left ${isTouchDevice ? 'min-h-[44px] p-3' : 'p-2'} focus-visible rounded`}
                onClick={() => {
                  const wasExpanded = expandedInstructions.has(instruction.index);
                  toggleInstruction(instruction.index);
                  onInstructionClick?.(instruction, instruction.index);
                  announceToScreenReader(
                    `Instruction ${instruction.index + 1} ${wasExpanded ? 'collapsed' : 'expanded'}: ${instruction.program} ${instruction.instructionType}`
                  );
                }}
                onKeyDown={(e) => {
                  if (e.key === KEYBOARD_KEYS.ENTER || e.key === KEYBOARD_KEYS.SPACE) {
                    e.preventDefault();
                    const wasExpanded = expandedInstructions.has(instruction.index);
                    toggleInstruction(instruction.index);
                    onInstructionClick?.(instruction, instruction.index);
                    announceToScreenReader(
                      `Instruction ${instruction.index + 1} ${wasExpanded ? 'collapsed' : 'expanded'}`
                    );
                  }
                }}
                aria-expanded={expandedInstructions.has(instruction.index)}
                aria-controls={`instruction-details-${instruction.index}`}
                aria-describedby={`instruction-summary-${instruction.index}`}
                type="button"
              >
                <div className="flex items-center space-x-2">
                  {expandedInstructions.has(instruction.index) ? (
                    <ChevronDownIcon className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <ChevronRightIcon className="w-5 h-5 text-muted-foreground" />
                  )}
                  <span className="font-medium text-foreground">
                    #{instruction.index + 1}
                  </span>
                </div>
                
                <InstructionTooltip instruction={instruction}>
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-foreground hover:text-primary transition-colors">
                      {instruction.program}
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(instruction.category)}`}>
                      {instruction.category}
                    </span>
                    {getRiskIcon(instruction.riskLevel)}
                  </div>
                </InstructionTooltip>
              </div>

              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                  <span className="capitalize">{instruction.instructionType}</span>
                  {instruction.computeUnits && (
                    <span className="bg-muted px-2 py-1 rounded text-xs">
                      {instruction.computeUnits.toLocaleString()} CU
                    </span>
                  )}
                </div>
                
                <InstructionActions
                  instruction={instruction}
                  transactionSignature={transaction.signature}
                  onShowDetails={() => handleShowInstructionDetails(instruction)}
                  compact={true}
                />
              </div>
            </div>

            {/* Instruction Details */}
            {expandedInstructions.has(instruction.index) && (
              <div 
                id={`instruction-details-${instruction.index}`}
                className="p-4 space-y-4 bg-background"
                role="region"
                aria-labelledby={`instruction-summary-${instruction.index}`}
              >
                {/* Description */}
                <div className="bg-muted/20 p-3 rounded-md">
                  <p className="text-foreground font-medium mb-1">Description</p>
                  <p className="text-muted-foreground">{instruction.description}</p>
                </div>

                {/* Program Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-foreground mb-1">Program</p>
                    <Link
                      href={`/program/${instruction.programId}`}
                      className="text-primary hover:underline text-sm break-all"
                    >
                      {instruction.programId}
                    </Link>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground mb-1">Instruction Type</p>
                    <p className="text-sm text-muted-foreground capitalize">
                      {instruction.instructionType}
                    </p>
                  </div>
                </div>

                {/* Accounts Section */}
                {instruction.accounts.length > 0 && (
                  <div>
                    <div
                      className="flex items-center justify-between cursor-pointer py-2"
                      onClick={() => toggleSection(`accounts-${instruction.index}`)}
                    >
                      <h4 className="font-medium text-foreground flex items-center space-x-2">
                        <span>Accounts ({instruction.accounts.length})</span>
                        {expandedSections.has(`accounts-${instruction.index}`) ? (
                          <ChevronDownIcon className="w-4 h-4" />
                        ) : (
                          <ChevronRightIcon className="w-4 h-4" />
                        )}
                      </h4>
                    </div>
                    
                    {expandedSections.has(`accounts-${instruction.index}`) && (
                      <div className="space-y-2">
                        {instruction.accounts.map((account, accountIndex) => (
                          <div
                            key={accountIndex}
                            className="bg-muted/20 p-3 rounded-md flex items-center justify-between"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-2 mb-1">
                                <Link
                                  href={`/account/${account.pubkey}`}
                                  className="text-primary hover:underline font-mono text-sm truncate"
                                >
                                  {account.pubkey}
                                </Link>
                                <div className="flex items-center space-x-1">
                                  {account.isSigner && (
                                    <span className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-1 py-0.5 rounded text-xs">
                                      Signer
                                    </span>
                                  )}
                                  {account.isWritable && (
                                    <span className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 px-1 py-0.5 rounded text-xs">
                                      Writable
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                <span className="font-medium capitalize">{account.role}</span>
                                {account.description && (
                                  <span> • {account.description}</span>
                                )}
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
                  <div>
                    <div
                      className="flex items-center justify-between cursor-pointer py-2"
                      onClick={() => toggleSection(`parameters-${instruction.index}`)}
                    >
                      <h4 className="font-medium text-foreground flex items-center space-x-2">
                        <span>Parameters ({instruction.parameters.length})</span>
                        {expandedSections.has(`parameters-${instruction.index}`) ? (
                          <ChevronDownIcon className="w-4 h-4" />
                        ) : (
                          <ChevronRightIcon className="w-4 h-4" />
                        )}
                      </h4>
                    </div>
                    
                    {expandedSections.has(`parameters-${instruction.index}`) && (
                      <div className="space-y-2">
                        {instruction.parameters.map((param, paramIndex) => (
                          <div
                            key={paramIndex}
                            className="bg-muted/20 p-3 rounded-md"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium text-foreground">{param.name}</span>
                              <span className="text-xs bg-muted px-2 py-1 rounded text-muted-foreground">
                                {param.type}
                              </span>
                            </div>
                            <div className="text-sm text-muted-foreground mb-1">
                              {param.description}
                            </div>
                            <div className="font-mono text-sm bg-background p-2 rounded border">
                              {formatParameterValue(param.value, param.type)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Inner Instructions */}
                {instruction.innerInstructions.length > 0 && (
                  <div>
                    <h4 className="font-medium text-foreground mb-2">
                      Inner Instructions ({instruction.innerInstructions.length})
                    </h4>
                    <div className="space-y-2 pl-4 border-l-2 border-muted">
                      {instruction.innerInstructions.map((innerIx, innerIndex) => (
                        <div key={innerIndex} className="bg-muted/10 p-3 rounded-md">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-foreground">
                              {innerIx.program}
                            </span>
                            <span className="text-sm text-muted-foreground capitalize">
                              {innerIx.instructionType}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {innerIx.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Logs */}
                {instruction.logs.length > 0 && (
                  <div>
                    <div
                      className="flex items-center justify-between cursor-pointer py-2"
                      onClick={() => toggleSection(`logs-${instruction.index}`)}
                    >
                      <h4 className="font-medium text-foreground flex items-center space-x-2">
                        <span>Logs ({instruction.logs.length})</span>
                        {expandedSections.has(`logs-${instruction.index}`) ? (
                          <ChevronDownIcon className="w-4 h-4" />
                        ) : (
                          <ChevronRightIcon className="w-4 h-4" />
                        )}
                      </h4>
                    </div>
                    
                    {expandedSections.has(`logs-${instruction.index}`) && (
                      <div className="bg-muted/10 p-3 rounded-md">
                        <div className="space-y-1 font-mono text-sm">
                          {instruction.logs.map((log, logIndex) => (
                            <div key={logIndex} className="text-muted-foreground">
                              {log}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Instruction Actions */}
                <div className="pt-4 border-t border-border">
                  <h4 className="font-medium text-foreground mb-3">Actions</h4>
                  <InstructionActions
                    instruction={instruction}
                    transactionSignature={transaction.signature}
                    onShowDetails={() => handleShowInstructionDetails(instruction)}
                    compact={false}
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Instruction Detail Modal */}
      {selectedInstruction && (
        <InstructionDetailModal
          instruction={selectedInstruction}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          transactionSignature={transaction.signature}
        />
      )}
    </div>
  );
};

// Helper functions
function getKnownProgramName(programId: string): string | undefined {
  const knownPrograms: Record<string, string> = {
    '11111111111111111111111111111111': 'System Program',
    'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA': 'SPL Token',
    'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL': 'Associated Token Account',
    'ComputeBudget111111111111111111111111111111': 'Compute Budget',
    'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4': 'Jupiter Aggregator',
    '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8': 'Raydium AMM',
    'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s': 'Metaplex Token Metadata'
  };
  return knownPrograms[programId];
}

function generateInstructionDescription(instruction: any): string {
  if (instruction.parsed?.type) {
    const type = instruction.parsed.type;
    const info = instruction.parsed.info || {};
    
    switch (type) {
      case 'transfer':
        if (info.lamports) {
          return `Transfer ${(info.lamports / 1e9).toFixed(4)} SOL`;
        } else if (info.amount) {
          return `Transfer ${info.amount} tokens`;
        }
        return 'Transfer operation';
      case 'transferChecked':
        const amount = info.tokenAmount?.uiAmount || info.amount || 0;
        return `Transfer ${amount} tokens (with verification)`;
      case 'createAccount':
        return `Create account with ${info.space || 0} bytes`;
      case 'initializeAccount':
        return 'Initialize token account';
      case 'initializeMint':
        return 'Initialize token mint';
      default:
        return `${type} operation`;
    }
  }
  
  return `${getKnownProgramName(instruction.programId) || 'Unknown program'} instruction`;
}

function getProgramCategory(programId: string): string {
  const categories: Record<string, string> = {
    '11111111111111111111111111111111': 'system',
    'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA': 'token',
    'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL': 'token',
    'ComputeBudget111111111111111111111111111111': 'system',
    'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4': 'defi',
    '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8': 'defi',
    'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s': 'nft'
  };
  return categories[programId] || 'unknown';
}

function assessInstructionRisk(instruction: any): 'low' | 'medium' | 'high' {
  const programId = instruction.programId;
  const type = instruction.parsed?.type;
  
  // High-risk operations
  if (type === 'closeAccount' || type === 'burn' || type === 'setAuthority') {
    return 'high';
  }
  
  // Medium-risk operations
  if (type === 'mintTo' || type === 'createAccount' || type === 'initializeMint') {
    return 'medium';
  }
  
  // Unknown programs are medium risk
  if (!getKnownProgramName(programId)) {
    return 'medium';
  }
  
  return 'low';
}

function parseAccountRoles(instruction: any, allAccounts: any[]) {
  const accounts = instruction.accounts || [];
  
  return accounts.map((accountRef: any, index: number) => {
    let pubkey: string;
    let isSigner = false;
    let isWritable = false;
    
    if (typeof accountRef === 'number') {
      // Account reference by index
      const account = allAccounts[accountRef];
      pubkey = account?.pubkey || '';
      isSigner = account?.signer || false;
      isWritable = account?.writable || false;
    } else {
      // Direct account address
      pubkey = accountRef;
    }
    
    // Determine role based on instruction type and position
    let role = 'unknown';
    let description = `Account ${index + 1}`;
    
    const type = instruction.parsed?.type;
    if (type === 'transfer') {
      if (index === 0) {
        role = 'source';
        description = 'Source account';
      } else if (index === 1) {
        role = 'destination';
        description = 'Destination account';
      } else if (index === 2) {
        role = 'authority';
        description = 'Transfer authority';
      }
    } else if (type === 'createAccount') {
      if (index === 0) {
        role = 'payer';
        description = 'Funding account';
      } else if (index === 1) {
        role = 'new_account';
        description = 'New account';
      }
    }
    
    return {
      pubkey,
      role,
      description,
      isSigner,
      isWritable
    };
  });
}

function extractInstructionParameters(instruction: any) {
  const parameters = [];
  const info = instruction.parsed?.info || {};
  
  for (const [key, value] of Object.entries(info)) {
    if (typeof value === 'object' && value !== null) {
      if ('uiAmount' in value) {
        parameters.push({
          name: key,
          value: value.uiAmount,
          type: 'amount',
          description: `${key} amount`
        });
      } else {
        parameters.push({
          name: key,
          value: JSON.stringify(value),
          type: 'object',
          description: `${key} data`
        });
      }
    } else {
      parameters.push({
        name: key,
        value,
        type: typeof value,
        description: `${key} parameter`
      });
    }
  }
  
  return parameters;
}

function getInstructionLogs(allLogs: string[], instructionIndex: number): string[] {
  // Filter logs that are relevant to this instruction
  // This is a simplified implementation - in practice, you'd need more sophisticated log parsing
  return allLogs.filter(log => 
    log.includes(`invoke [${instructionIndex + 1}]`) || 
    log.includes('Program log:')
  );
}

function parseInnerInstructions(innerInstructions: any[], instructionIndex: number): ParsedInstructionDisplay[] {
  const relevantInner = innerInstructions.find(inner => inner.index === instructionIndex);
  if (!relevantInner) return [];
  
  return relevantInner.instructions.map((innerIx: any, index: number) => ({
    index,
    program: getKnownProgramName(innerIx.programId) || 'Unknown Program',
    programId: innerIx.programId,
    instructionType: innerIx.parsed?.type || 'unknown',
    description: generateInstructionDescription(innerIx),
    category: getProgramCategory(innerIx.programId),
    riskLevel: assessInstructionRisk(innerIx),
    accounts: [],
    parameters: extractInstructionParameters(innerIx),
    innerInstructions: [],
    logs: [],
    computeUnits: innerIx.computeUnits
  }));
}

function formatParameterValue(value: any, type: string): string {
  if (type === 'amount' && typeof value === 'number') {
    return value.toLocaleString();
  }
  if (typeof value === 'string' && value.length > 50) {
    return value.substring(0, 50) + '...';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
}

export default InstructionBreakdown;