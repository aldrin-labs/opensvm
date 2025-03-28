'use client';

import type { DetailedTransactionInfo, InstructionWithAccounts } from '@/lib/solana';
import { useState } from 'react';
import AccountLink from './AccountLink';
import JsonTree from './JsonTree';
// Custom tooltip implementation to avoid dependency issues
const Tooltip = ({ content, children }: { content: string, children: React.ReactNode }) => (
  <div className="relative group inline-block">
    {children}
    <div className="absolute opacity-0 group-hover:opacity-100 transition-opacity duration-300 bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1 bg-primary text-primary-foreground text-xs rounded-md whitespace-nowrap z-10">
      {content}
    </div>
  </div>
);

interface TransactionNodeDetailsProps {
  tx: DetailedTransactionInfo;
}

export default function TransactionNodeDetails({ tx }: TransactionNodeDetailsProps) {
  const [selectedInstruction, setSelectedInstruction] = useState<number>(0);

  if (!tx.details) return null;

  const instruction = tx.details?.instructions?.[selectedInstruction] as InstructionWithAccounts;
  if (!instruction) return null;

  // Process program ID once
  const programId = String('parsed' in instruction ? instruction.program : instruction.programId);

  // Calculate CU efficiency
  const cuEfficiency = instruction.computeUnitsConsumed && instruction.computeUnits
    ? Math.round((instruction.computeUnitsConsumed / instruction.computeUnits) * 100)
    : null;

  // Calculate potential CU savings
  const cuSavings = instruction.computeUnits && instruction.computeUnitsConsumed
    ? instruction.computeUnits - instruction.computeUnitsConsumed
    : null;

  // Parse instruction data if it's a string, otherwise use it as is
  const parseInstructionData = (data: any) => {
    if (typeof data === 'string') {
      try {
        return JSON.parse(data);
      } catch (e) {
        return data;
      }
    }
    return data;
  };

  return (
    <div className="space-y-6">
      {/* Instruction Selector */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {tx.details?.instructions?.map((_, index) => (
          <button
            key={index}
            onClick={() => setSelectedInstruction(index)}
            className={`px-3 py-1.5 rounded-md text-xs sm:text-sm transition-colors ${
              selectedInstruction === index
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {index === 0 
              ? "TX Overview" 
              : `IX ${index}`
            }
          </button>
        ))}
      </div>

      {/* Program Info */}
      <div>
        <h3 className="text-lg font-medium mb-2 text-foreground">Program</h3>
        <div className="bg-muted rounded-md p-3 border border-border">
          <AccountLink 
            address={programId}
            className="font-mono text-sm break-all text-muted-foreground hover:text-foreground transition-colors"
          />
        </div>
      </div>

      {/* Account List */}
      <div>
        <h3 className="text-lg font-medium mb-2 text-foreground">Accounts</h3>
        <div className="space-y-2">
          {instruction.accounts.map((accountIndex: number, i: number) => {
            const account = tx.details?.accounts?.[accountIndex];
            if (!account?.pubkey) return null;
            
            const address = account.pubkey.toString();
            return (
              <div key={i} className="bg-muted rounded-md p-3 border border-border">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
                  <AccountLink 
                    address={address}
                    className="font-mono text-xs sm:text-sm break-all text-muted-foreground hover:text-foreground transition-colors"
                  />
                  <div className="flex gap-2">
                    {account?.signer && (
                      <span className="px-2 py-0.5 text-xs rounded-md bg-green-700/20 text-green-500 border border-green-700/30">
                        Signer
                      </span>
                    )}
                    {account?.writable && (
                      <span className="px-2 py-0.5 text-xs rounded-md bg-blue-700/20 text-blue-500 border border-blue-700/30">
                        Writable
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Compute Units */}
      {(instruction.computeUnits || instruction.computeUnitsConsumed) && (
        <div>
          <h3 className="text-lg font-medium mb-2 text-foreground">Compute Units</h3>
          <div className="bg-muted rounded-md p-3 border border-border">
            <div className="flex justify-between items-center mb-2">
              <span className="text-muted-foreground">Allocated</span>
              <span className="text-foreground">{instruction.computeUnits?.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-muted-foreground">Consumed</span>
              <span className="text-foreground">{instruction.computeUnitsConsumed?.toLocaleString()}</span>
            </div>
            {cuEfficiency !== null && (
              <div className="flex justify-between items-center mb-2">
                <span className="text-muted-foreground">Efficiency</span>
                <Tooltip content="Lower efficiency means higher potential for CU optimization">
                  <span className={`${
                    cuEfficiency < 50 ? 'text-red-400' :
                    cuEfficiency < 75 ? 'text-yellow-400' :
                    'text-green-400'
                  }`}>
                    {cuEfficiency}%
                  </span>
                </Tooltip>
              </div>
            )}
            {cuSavings && cuSavings > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Potential Savings</span>
                <Tooltip content="CUs that could be saved with optimization">
                  <span className="text-blue-400">{cuSavings.toLocaleString()} CU</span>
                </Tooltip>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Data */}
      {instruction.data && (
        <div>
          <h3 className="text-lg font-medium mb-2 text-foreground">Instruction Data</h3>
          <div className="bg-muted rounded-md p-3 border border-border">
            <JsonTree 
              data={parseInstructionData(instruction.data)}
              expanded={false}
            />
          </div>
        </div>
      )}

      {/* Inner Instructions */}
      {tx.details?.innerInstructions && tx.details.innerInstructions.length > 0 && (
        <div>
          <h3 className="text-lg font-medium mb-2 text-foreground">Inner Instructions</h3>
          <div className="space-y-2">
            {tx.details?.innerInstructions
              .filter(inner => inner.index === selectedInstruction)
              .map((inner, i) => (
                <div key={i} className="bg-muted rounded-md p-3 border border-border">
                  <div className="text-sm text-muted-foreground">
                    {inner.instructions.length} instruction{inner.instructions.length !== 1 ? 's' : ''} executed
                  </div>
                  <div className="mt-2 text-xs text-neutral-500">
                    Programs: {Array.from(new Set(inner.instructions.map(ix => 
                      String('parsed' in ix ? ix.program : ix.programId)
                    ))).map((id, idx, arr) => (
                      <span key={id}>
                        <AccountLink 
                          address={id}
                          className="hover:text-foreground transition-colors"
                        >
                          {`${id.slice(0, 4)}...${id.slice(-4)}`}
                        </AccountLink>
                        {idx < arr.length - 1 ? ', ' : ''}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
