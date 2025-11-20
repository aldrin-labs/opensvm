'use client';

import React, { useState, useMemo } from 'react';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  InfoIcon,
  AlertTriangleIcon,
  ShieldCheckIcon,
  CopyIcon,
  CheckIcon,
  ExternalLinkIcon,
  CodeIcon
} from 'lucide-react';
import Link from 'next/link';
import {
  useAccessibility
} from '@/lib/ui/accessibility-utils';
import {
  useMobileDetection,
  MobileEventUtils
} from '@/lib/ui/mobile-utils';
import type { DetailedTransactionInfo } from '@/lib/solana/solana';

interface MobileInstructionDisplayProps {
  transaction: DetailedTransactionInfo;
  onInstructionClick?: (instruction: any, index: number) => void;
}

interface MobileInstructionItem {
  index: number;
  program: string;
  programId: string;
  type: string;
  description: string;
  category: string;
  riskLevel: 'low' | 'medium' | 'high';
  accounts: number;
  computeUnits?: number;
  isExpanded: boolean;
}

const MobileInstructionDisplay: React.FC<MobileInstructionDisplayProps> = ({
  transaction,
  onInstructionClick
}) => {
  const [expandedInstructions, setExpandedInstructions] = useState<Set<number>>(new Set());
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Accessibility and mobile hooks
  const { announceToScreenReader } = useAccessibility();
  const { isMobile } = useMobileDetection();

  // Process instructions for mobile display
  const mobileInstructions = useMemo(() => {
    if (!transaction.details?.instructions) return [];

    return transaction.details.instructions.map((instruction, index) => ({
      index,
      program: getKnownProgramName(instruction.programId) || 'Unknown',
      programId: instruction.programId,
      type: ('parsed' in instruction && instruction.parsed?.type) || 'unknown',
      description: generateMobileDescription(instruction),
      category: getProgramCategory(instruction.programId),
      riskLevel: assessInstructionRisk(instruction) as 'low' | 'medium' | 'high',
      accounts: instruction.accounts?.length || 0,
      computeUnits: instruction.computeUnits,
      isExpanded: expandedInstructions.has(index)
    }));
  }, [transaction, expandedInstructions]);

  const toggleInstruction = (index: number) => {
    const newExpanded = new Set(expandedInstructions);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
      announceToScreenReader(`Instruction ${index + 1} collapsed`);
    } else {
      newExpanded.add(index);
      announceToScreenReader(`Instruction ${index + 1} expanded`);
    }
    setExpandedInstructions(newExpanded);
    onInstructionClick?.(mobileInstructions[index], index);
  };

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      announceToScreenReader(`${field} copied to clipboard`);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const getRiskIcon = (level: 'low' | 'medium' | 'high') => {
    switch (level) {
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

  if (!mobileInstructions.length) {
    return (
      <div className="bg-background rounded-lg border border-border p-6">
        <h2 className="text-lg font-semibold mb-4 text-foreground">Instructions</h2>
        <div className="text-center py-8">
          <CodeIcon className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">No instructions found in this transaction.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background rounded-lg border border-border">
      {/* Mobile Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            Instructions ({mobileInstructions.length})
          </h2>
          <div className="text-xs text-muted-foreground">
            Tap to expand
          </div>
        </div>
      </div>

      {/* Mobile Instruction Cards */}
      <div className="divide-y divide-border">
        {mobileInstructions.map((instruction) => (
          <MobileInstructionCard
            key={instruction.index}
            instruction={instruction}
            transaction={transaction}
            onToggle={() => toggleInstruction(instruction.index)}
            onCopy={copyToClipboard}
            copiedField={copiedField}
            getRiskIcon={getRiskIcon}
            getCategoryColor={getCategoryColor}
          />
        ))}
      </div>

      {/* Mobile Navigation Hint */}
      {isMobile && (
        <div className="p-3 bg-muted/10 border-t border-border">
          <div className="text-xs text-muted-foreground text-center">
            💡 Swipe left/right to navigate • Tap to expand details
          </div>
        </div>
      )}
    </div>
  );
};

// Mobile Instruction Card Component
interface MobileInstructionCardProps {
  instruction: MobileInstructionItem;
  transaction: DetailedTransactionInfo;
  onToggle: () => void;
  onCopy: (text: string, field: string) => void;
  copiedField: string | null;
  getRiskIcon: (level: 'low' | 'medium' | 'high') => React.ReactNode;
  getCategoryColor: (category: string) => string;
}

const MobileInstructionCard: React.FC<MobileInstructionCardProps> = ({
  instruction,
  transaction: _transaction,
  onToggle,
  onCopy,
  copiedField,
  getRiskIcon,
  getCategoryColor
}) => {
  const { isTouchDevice } = useAccessibility();

  const handleCardClick = MobileEventUtils.createTouchFriendlyClickHandler(onToggle, {
    preventDefault: true
  });

  return (
    <div className="instruction-card-mobile">
      {/* Card Header - Always Visible */}
      <div
        className={`p-4 cursor-pointer transition-colors hover:bg-muted/20 ${isTouchDevice ? 'touch-target' : ''}`}
        onClick={handleCardClick}
        role="button"
        tabIndex={0}
        aria-expanded={instruction.isExpanded}
        aria-controls={`mobile-instruction-${instruction.index}`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
          }
        }}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-2">
            {instruction.isExpanded ? (
              <ChevronDownIcon className="w-5 h-5 text-muted-foreground flex-shrink-0" />
            ) : (
              <ChevronRightIcon className="w-5 h-5 text-muted-foreground flex-shrink-0" />
            )}
            <span className="font-medium text-sm text-muted-foreground">
              #{instruction.index + 1}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            {getRiskIcon(instruction.riskLevel)}
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(instruction.category)}`}>
              {instruction.category}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground text-base truncate">
              {instruction.program}
            </h3>
            <span className="text-xs text-muted-foreground capitalize ml-2 flex-shrink-0">
              {instruction.type}
            </span>
          </div>

          <p className="text-sm text-muted-foreground line-clamp-2">
            {instruction.description}
          </p>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center space-x-4">
              <span className="flex items-center space-x-1">
                <span>{instruction.accounts} accounts</span>
              </span>
              {instruction.computeUnits && (
                <span className="flex items-center space-x-1">
                  <span>{instruction.computeUnits.toLocaleString()} CU</span>
                </span>
              )}
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onCopy(instruction.programId, `program-${instruction.index}`);
              }}
              className="p-1 hover:bg-muted rounded transition-colors"
              title="Copy program ID"
              aria-label="Copy program ID"
            >
              {copiedField === `program-${instruction.index}` ? (
                <CheckIcon className="w-3 h-3 text-green-500" />
              ) : (
                <CopyIcon className="w-3 h-3" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Expanded Details */}
      {instruction.isExpanded && (
        <div
          id={`mobile-instruction-${instruction.index}`}
          className="px-4 pb-4 space-y-4 bg-muted/5"
          role="region"
          aria-label={`Details for instruction ${instruction.index + 1}`}
        >
          {/* Program Information */}
          <div className="bg-background rounded-lg p-3 border border-border">
            <h4 className="font-medium text-foreground mb-2 text-sm">Program Details</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Program ID:</span>
                <div className="flex items-center space-x-2">
                  <Link
                    href={`/program/${instruction.programId}`}
                    className="font-mono text-xs text-primary hover:underline truncate max-w-[120px]"
                  >
                    {instruction.programId}
                  </Link>
                  <ExternalLinkIcon className="w-3 h-3 text-muted-foreground" />
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Type:</span>
                <span className="capitalize">{instruction.type}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Risk Level:</span>
                <div className="flex items-center space-x-1">
                  {getRiskIcon(instruction.riskLevel)}
                  <span className="capitalize">{instruction.riskLevel}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-background rounded-lg p-3 border border-border text-center">
              <div className="text-lg font-semibold text-foreground">{instruction.accounts}</div>
              <div className="text-xs text-muted-foreground">Accounts</div>
            </div>
            {instruction.computeUnits && (
              <div className="bg-background rounded-lg p-3 border border-border text-center">
                <div className="text-lg font-semibold text-foreground">
                  {(instruction.computeUnits / 1000).toFixed(1)}K
                </div>
                <div className="text-xs text-muted-foreground">Compute Units</div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-2">
            <Link
              href={`/program/${instruction.programId}`}
              className="flex-1 bg-primary text-primary-foreground rounded-lg py-3 px-4 text-center text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              View Program
            </Link>
            <button
              onClick={() => onCopy(instruction.programId, `full-program-${instruction.index}`)}
              className="bg-muted text-muted-foreground rounded-lg py-3 px-4 text-sm font-medium hover:bg-muted/80 transition-colors"
            >
              {copiedField === `full-program-${instruction.index}` ? 'Copied!' : 'Copy ID'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper functions (simplified for mobile)
function getKnownProgramName(programId: string): string | undefined {
  const knownPrograms: Record<string, string> = {
    '11111111111111111111111111111111': 'System',
    'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA': 'SPL Token',
    'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL': 'Associated Token',
    'ComputeBudget111111111111111111111111111111': 'Compute Budget',
    'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4': 'Jupiter',
    '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8': 'Raydium',
    'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s': 'Metaplex'
  };
  return knownPrograms[programId];
}

function generateMobileDescription(instruction: any): string {
  if (instruction.parsed?.type) {
    const type = instruction.parsed.type;
    const info = instruction.parsed.info || {};

    switch (type) {
      case 'transfer':
        if (info.lamports) {
          return `Transfer ${(info.lamports / 1e9).toFixed(2)} SOL`;
        } else if (info.amount) {
          return `Transfer ${info.amount} tokens`;
        }
        return 'Transfer operation';
      case 'transferChecked':
        const amount = info.tokenAmount?.uiAmount || info.amount || 0;
        return `Transfer ${amount} tokens (verified)`;
      case 'createAccount':
        return `Create new account`;
      case 'initializeAccount':
        return 'Initialize token account';
      case 'initializeMint':
        return 'Create new token';
      default:
        return `${type.replace(/([A-Z])/g, ' $1').toLowerCase()} operation`;
    }
  }

  const programName = getKnownProgramName(instruction.programId);
  return programName ? `${programName} instruction` : 'Program instruction';
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
  if (!getKnownProgramName(instruction.programId)) {
    return 'medium';
  }

  return 'low';
}

export default MobileInstructionDisplay;