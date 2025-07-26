'use client';

import React, { useState } from 'react';
import { Copy, Check, Share2, Download, ExternalLink, BookOpen } from 'lucide-react';
import Link from 'next/link';

interface InstructionActionsProps {
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
    computeUnits?: number;
  };
  transactionSignature?: string;
  onShowDetails?: () => void;
  compact?: boolean;
}

const InstructionActions: React.FC<InstructionActionsProps> = ({
  instruction,
  transactionSignature,
  onShowDetails,
  compact = false
}) => {
  const [copiedAction, setCopiedAction] = useState<string | null>(null);

  const copyToClipboard = async (text: string, action: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedAction(action);
      setTimeout(() => setCopiedAction(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const copyInstructionSummary = () => {
    const summary = `Instruction #${instruction.index + 1}: ${instruction.program}\n` +
      `Type: ${instruction.instructionType}\n` +
      `Description: ${instruction.description}\n` +
      `Category: ${instruction.category}\n` +
      `Risk Level: ${instruction.riskLevel}\n` +
      `Accounts: ${instruction.accounts.length}\n` +
      `Parameters: ${instruction.parameters.length}\n` +
      (instruction.computeUnits ? `Compute Units: ${instruction.computeUnits.toLocaleString()}\n` : '') +
      (transactionSignature ? `Transaction: ${transactionSignature}` : '');
    
    copyToClipboard(summary, 'summary');
  };

  const copyInstructionData = () => {
    const data = {
      index: instruction.index,
      program: instruction.program,
      programId: instruction.programId,
      instructionType: instruction.instructionType,
      description: instruction.description,
      category: instruction.category,
      riskLevel: instruction.riskLevel,
      accounts: instruction.accounts,
      parameters: instruction.parameters,
      computeUnits: instruction.computeUnits,
      transactionSignature
    };
    
    copyToClipboard(JSON.stringify(data, null, 2), 'data');
  };

  const shareInstruction = async () => {
    const shareData = {
      title: `${instruction.program} Instruction`,
      text: `${instruction.description} - ${instruction.category} instruction with ${instruction.riskLevel} risk level`,
      url: transactionSignature ? `${window.location.origin}/tx/${transactionSignature}` : window.location.href
    };

    if (navigator.share && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.error('Failed to share:', err);
        // Fallback to copying URL
        copyToClipboard(shareData.url || window.location.href, 'share');
      }
    } else {
      // Fallback to copying URL
      copyToClipboard(shareData.url || window.location.href, 'share');
    }
  };

  const downloadInstructionData = () => {
    const data = {
      instruction: {
        index: instruction.index,
        program: instruction.program,
        programId: instruction.programId,
        instructionType: instruction.instructionType,
        description: instruction.description,
        category: instruction.category,
        riskLevel: instruction.riskLevel,
        accounts: instruction.accounts,
        parameters: instruction.parameters,
        computeUnits: instruction.computeUnits
      },
      transactionSignature,
      exportedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `instruction-${instruction.index + 1}-${instruction.program.replace(/\s+/g, '-').toLowerCase()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getProgramDocumentationUrl = (programId: string) => {
    const docUrls: Record<string, string> = {
      '11111111111111111111111111111111': 'https://docs.solana.com/developing/runtime-facilities/programs#system-program',
      'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA': 'https://spl.solana.com/token',
      'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL': 'https://spl.solana.com/associated-token-account',
      'ComputeBudget111111111111111111111111111111': 'https://docs.solana.com/developing/programming-model/runtime#compute-budget',
      'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4': 'https://docs.jup.ag/',
      '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8': 'https://docs.raydium.io/',
      'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s': 'https://docs.metaplex.com/'
    };
    return docUrls[programId];
  };

  if (compact) {
    return (
      <div className="flex items-center space-x-1">
        <button
          onClick={copyInstructionSummary}
          className="p-1 text-muted-foreground hover:text-foreground transition-colors"
          title="Copy instruction summary"
        >
          {copiedAction === 'summary' ? (
            <Check className="w-4 h-4 text-green-500" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </button>
        
        <button
          onClick={shareInstruction}
          className="p-1 text-muted-foreground hover:text-foreground transition-colors"
          title="Share instruction"
        >
          {copiedAction === 'share' ? (
            <Check className="w-4 h-4 text-green-500" />
          ) : (
            <Share2 className="w-4 h-4" />
          )}
        </button>
        
        {onShowDetails && (
          <button
            onClick={onShowDetails}
            className="p-1 text-muted-foreground hover:text-foreground transition-colors"
            title="Show instruction details"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Copy Summary */}
      <button
        onClick={copyInstructionSummary}
        className="flex items-center space-x-2 px-3 py-2 bg-muted hover:bg-muted/80 rounded-md transition-colors text-sm"
        title="Copy instruction summary"
      >
        {copiedAction === 'summary' ? (
          <Check className="w-4 h-4 text-green-500" />
        ) : (
          <Copy className="w-4 h-4" />
        )}
        <span>Copy Summary</span>
      </button>

      {/* Copy JSON Data */}
      <button
        onClick={copyInstructionData}
        className="flex items-center space-x-2 px-3 py-2 bg-muted hover:bg-muted/80 rounded-md transition-colors text-sm"
        title="Copy instruction data as JSON"
      >
        {copiedAction === 'data' ? (
          <Check className="w-4 h-4 text-green-500" />
        ) : (
          <Copy className="w-4 h-4" />
        )}
        <span>Copy JSON</span>
      </button>

      {/* Share */}
      <button
        onClick={shareInstruction}
        className="flex items-center space-x-2 px-3 py-2 bg-muted hover:bg-muted/80 rounded-md transition-colors text-sm"
        title="Share instruction"
      >
        {copiedAction === 'share' ? (
          <Check className="w-4 h-4 text-green-500" />
        ) : (
          <Share2 className="w-4 h-4" />
        )}
        <span>Share</span>
      </button>

      {/* Download */}
      <button
        onClick={downloadInstructionData}
        className="flex items-center space-x-2 px-3 py-2 bg-muted hover:bg-muted/80 rounded-md transition-colors text-sm"
        title="Download instruction data"
      >
        <Download className="w-4 h-4" />
        <span>Download</span>
      </button>

      {/* Program Explorer */}
      <Link
        href={`/program/${instruction.programId}`}
        className="flex items-center space-x-2 px-3 py-2 bg-muted hover:bg-muted/80 rounded-md transition-colors text-sm"
        title="View program details"
      >
        <ExternalLink className="w-4 h-4" />
        <span>Program</span>
      </Link>

      {/* Documentation */}
      {getProgramDocumentationUrl(instruction.programId) && (
        <Link
          href={getProgramDocumentationUrl(instruction.programId)!}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center space-x-2 px-3 py-2 bg-muted hover:bg-muted/80 rounded-md transition-colors text-sm"
          title="View program documentation"
        >
          <BookOpen className="w-4 h-4" />
          <span>Docs</span>
        </Link>
      )}

      {/* Show Details */}
      {onShowDetails && (
        <button
          onClick={onShowDetails}
          className="flex items-center space-x-2 px-3 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md transition-colors text-sm"
          title="Show detailed instruction information"
        >
          <ExternalLink className="w-4 h-4" />
          <span>Details</span>
        </button>
      )}
    </div>
  );
};

export default InstructionActions;