'use client';

import type { DetailedTransactionInfo, InstructionWithAccounts } from '@/lib/solana/solana';
import { useEffect, useState } from 'react';
import AccountLink from './AccountLink';

interface TransactionAnalysisProps {
  tx: DetailedTransactionInfo;
}

interface ProgramStats {
  name: string;
  count: number;
  totalAccounts: number;
  totalDataSize: number;
}

interface AccountStats {
  address: string;
  type: string;
  writeCount: number;
  readCount: number;
}

interface AnalysisResult {
  programStats: ProgramStats[];
  accountStats: AccountStats[];
  totalInstructions: number;
  totalDataSize: number;
}

export default function TransactionAnalysis({ tx }: TransactionAnalysisProps) {
  const [analysis, setAnalysis] = useState<AnalysisResult>({
    programStats: [],
    accountStats: [],
    totalInstructions: 0,
    totalDataSize: 0
  });

  useEffect(() => {
    if (!tx.details || !tx.details.accounts) {
      return;
    }

    // Analyze program stats
    const programMap = new Map<string, ProgramStats>();
    const accountMap = new Map<string, AccountStats>();

    let totalDataSize = 0;

    // Process main instructions
    tx.details?.instructions?.forEach((ix: InstructionWithAccounts) => {
      const programId = String('parsed' in ix ? ix.program : ix.programId);
      
      // Update program stats
      const programStats = programMap.get(programId) || {
        name: programId,
        count: 0,
        totalAccounts: 0,
        totalDataSize: 0
      };
      programStats.count++;
      programStats.totalAccounts += ix.accounts.length;
      programStats.totalDataSize += ix.data?.length || 0;
      programMap.set(programId, programStats);

      // Update account stats
      ix.accounts.forEach((accountIndex: number) => {
        const account = tx.details?.accounts?.[accountIndex];
        if (!account) return;
        const address = String(account.pubkey);
        const accountStats = accountMap.get(address) || {
          address,
          type: account.signer ? 'Signer' : 'Regular Account',
          writeCount: 0,
          readCount: 0
        };
        if (account.writable) {
          accountStats.writeCount++;
        } else {
          accountStats.readCount++;
        }
        accountMap.set(address, accountStats);
      });

      totalDataSize += ix.data?.length || 0;
    });

    // Process inner instructions
    tx.details?.innerInstructions?.forEach(inner => {
      inner.instructions.forEach((ix: InstructionWithAccounts) => {
        const programId = String('parsed' in ix ? ix.program : ix.programId);
        
        // Update program stats
        const programStats = programMap.get(programId) || {
          name: programId,
          count: 0,
          totalAccounts: 0,
          totalDataSize: 0
        };
        programStats.count++;
        programStats.totalAccounts += ix.accounts.length;
        programStats.totalDataSize += ix.data?.length || 0;
        programMap.set(programId, programStats);

        // Update account stats
        ix.accounts.forEach((accountIndex: number) => {
          const account = tx.details?.accounts?.[accountIndex];
        if (!account) return;
          const address = String(account.pubkey);
          const accountStats = accountMap.get(address) || {
            address,
            type: account.signer ? 'Signer' : 'Regular Account',
            writeCount: 0,
            readCount: 0
          };
          if (account.writable) {
            accountStats.writeCount++;
          } else {
            accountStats.readCount++;
          }
          accountMap.set(address, accountStats);
        });

        totalDataSize += ix.data?.length || 0;
      });
    });

    setAnalysis({
      programStats: Array.from(programMap.values())
        .sort((a, b) => b.count - a.count),
      accountStats: Array.from(accountMap.values())
        .sort((a, b) => (b.writeCount + b.readCount) - (a.writeCount + a.readCount)),
      totalInstructions: tx.details?.instructions?.length || 0 + 
        (tx.details?.innerInstructions?.reduce((sum, inner) => sum + inner.instructions.length, 0) || 0),
      totalDataSize
    });
  }, [tx]);

  return (
    <div className="space-y-6">
      {/* Program Stats */}
      <div>
        <h3 className="text-lg font-medium mb-2">Program Activity</h3>
        <div className="space-y-2">
          {analysis.programStats.map((program, i) => (
            <div key={i} className="bg-neutral-900 rounded p-3">
              <div className="flex justify-between items-center">
                <AccountLink 
                  address={program.name}
                  className="font-mono text-sm text-neutral-400 hover:text-neutral-200 transition-colors"
                >
                  {program.name.slice(0, 4)}...{program.name.slice(-4)}
                  <span className="sr-only">{program.name}</span>
                </AccountLink>
                <div className="flex gap-4 text-sm">
                  <span className="text-neutral-300">{program.count} calls</span>
                  <span className="text-neutral-500">{program.totalAccounts} accounts</span>
                  <span className="text-neutral-500">{program.totalDataSize} bytes</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Account Stats */}
      <div>
        <h3 className="text-lg font-medium mb-2">Account Activity</h3>
        <div className="space-y-2">
          {analysis.accountStats.map((account, i) => (
            <div key={i} className="bg-neutral-900 rounded p-3">
              <div className="flex justify-between items-center">
                <AccountLink 
                  address={account.address}
                  className="font-mono text-sm text-neutral-400 hover:text-neutral-200 transition-colors"
                >
                  {account.address.slice(0, 4)}...{account.address.slice(-4)}
                  <span className="sr-only">{account.address}</span>
                </AccountLink>
                <div className="flex gap-4 text-sm">
                  <span className="text-green-500">{account.writeCount} writes</span>
                  <span className="text-blue-500">{account.readCount} reads</span>
                  <span className="text-neutral-500">{account.type}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="pt-4 border-t border-neutral-800">
        <div className="flex justify-between items-center">
          <div className="space-y-1">
            <div className="flex gap-4">
              <span className="text-neutral-400">Total Instructions</span>
              <span className="text-xl font-semibold">{analysis.totalInstructions}</span>
            </div>
            <div className="flex gap-4">
              <span className="text-neutral-400">Total Data Size</span>
              <span className="text-neutral-300">{analysis.totalDataSize} bytes</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
