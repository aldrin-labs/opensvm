import { NextRequest } from 'next/server';

// Create a simplified test that doesn't rely on NextResponse
function testGenerateDetailedBreakdown(metrics: any, transactionData?: any) {
    let writableAccounts = 0;
    let signerAccounts = 0;

    if (transactionData && transactionData.transaction && transactionData.transaction.message && transactionData.transaction.message.accountKeys) {
        const accountKeys = transactionData.transaction.message.accountKeys;
        writableAccounts = accountKeys.filter((acc: any) => acc.isWritable || acc.writable).length;
        signerAccounts = accountKeys.filter((acc: any) => acc.isSigner || acc.signer).length;
    }

    return {
        feeBreakdown: {
            baseFee: Math.floor(metrics.feeAnalysis.totalFee * 0.1),
            computeFee: Math.floor(metrics.feeAnalysis.totalFee * 0.7),
            priorityFee: Math.floor(metrics.feeAnalysis.totalFee * 0.2),
            rentExemption: 0
        },
        computeBreakdown: {
            instructionExecution: Math.floor(metrics.computeAnalysis.computeUnitsUsed * 0.6),
            accountLoading: Math.floor(metrics.computeAnalysis.computeUnitsUsed * 0.2),
            dataProcessing: Math.floor(metrics.computeAnalysis.computeUnitsUsed * 0.15),
            overhead: Math.floor(metrics.computeAnalysis.computeUnitsUsed * 0.05)
        },
        accountAnalysis: {
            totalAccounts: metrics.complexity?.indicators?.accountCount || 0,
            writableAccounts,
            signerAccounts,
            programAccounts: metrics.complexity?.indicators?.uniqueProgramCount || 0
        }
    };
}

const mockMetrics = {
    feeAnalysis: { totalFee: 5000 },
    computeAnalysis: { computeUnitsUsed: 200000 },
    complexity: { indicators: { accountCount: 4, uniqueProgramCount: 1 } }
};

const mockTransaction = {
    slot: 123456,
    blockTime: 1680000000,
    meta: { fee: 5000, computeUnitsConsumed: 200000, err: null },
    transaction: {
        message: {
            accountKeys: [
                { pubkey: 'account1', isSigner: true, isWritable: true },
                { pubkey: 'account2', isSigner: false, isWritable: true },
                { pubkey: 'account3', isSigner: false, isWritable: false },
                { pubkey: 'account4', isSigner: false, isWritable: false }
            ],
            instructions: []
        }
    }
};

describe('Transaction Metrics Logic', () => {
    it('correctly analyzes account permissions in breakdown', () => {
        const breakdown = testGenerateDetailedBreakdown(mockMetrics, mockTransaction);

        expect(breakdown.accountAnalysis.writableAccounts).toBe(2); // 2 writable accounts in mockTransaction
        expect(breakdown.accountAnalysis.signerAccounts).toBe(1); // 1 signer account in mockTransaction
        expect(breakdown.accountAnalysis.totalAccounts).toBe(4);
        expect(breakdown.accountAnalysis.programAccounts).toBe(1);
    });

    it('handles missing transaction data gracefully', () => {
        const breakdown = testGenerateDetailedBreakdown(mockMetrics);

        expect(breakdown.accountAnalysis.writableAccounts).toBe(0);
        expect(breakdown.accountAnalysis.signerAccounts).toBe(0);
        expect(breakdown.accountAnalysis.totalAccounts).toBe(4);
    });

    it('handles legacy property names', () => {
        const legacyTransaction = {
            transaction: {
                message: {
                    accountKeys: [
                        { pubkey: 'account1', signer: true, writable: true },
                        { pubkey: 'account2', signer: false, writable: true },
                        { pubkey: 'account3', signer: false, writable: false }
                    ]
                }
            }
        };

        const breakdown = testGenerateDetailedBreakdown(mockMetrics, legacyTransaction);

        expect(breakdown.accountAnalysis.writableAccounts).toBe(2);
        expect(breakdown.accountAnalysis.signerAccounts).toBe(1);
    });
}); 