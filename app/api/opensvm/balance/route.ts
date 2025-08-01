import { NextRequest, NextResponse } from 'next/server';
import { SVMAIBalanceManager } from '../../../../lib/anthropic-proxy/billing/SVMAIBalanceManager';
import { JWTAuth } from '../../../../lib/anthropic-proxy/auth/JWTAuth';
import { globalTransactionHistory } from '../../../../lib/anthropic-proxy/billing/TransactionHistory';

const balanceManager = new SVMAIBalanceManager();
const jwtAuth = new JWTAuth();

// Enhanced user authentication with JWT support
function authenticateUser(request: NextRequest): { isValid: boolean; userId?: string; error?: string } {
    const authHeader = request.headers.get('Authorization');

    // Try JWT authentication first
    const jwtResult = jwtAuth.requireAuth(authHeader);
    if (jwtResult.isValid) {
        return {
            isValid: true,
            userId: jwtResult.userId
        };
    }

    // Fallback to X-User-ID for testing/development
    const userIdHeader = request.headers.get('X-User-ID');
    if (userIdHeader && process.env.NODE_ENV !== 'production') {
        console.warn('Using fallback X-User-ID authentication in non-production environment');
        return {
            isValid: true,
            userId: userIdHeader
        };
    }

    return {
        isValid: false,
        error: jwtResult.error || 'Authentication required'
    };
}

export async function GET(request: NextRequest) {
    try {
        const authResult = authenticateUser(request);
        if (!authResult.isValid) {
            return NextResponse.json(
                { error: authResult.error || 'Authentication required' },
                { status: 401 }
            );
        }

        const userId = authResult.userId;
        if (!userId) {
            return NextResponse.json(
                { error: 'Authentication failed' },
                { status: 500 }
            );
        }

        // Get comprehensive balance information
        const balance = await balanceManager.getBalance(authResult.userId!);
        const hasSufficientBalance = await balanceManager.hasSufficientBalance(authResult.userId!, 100); // Check for 100 SVMAI

        // Handle case where balance might be undefined/null
        const safeBalance = balance || 0;
        const safeSufficientBalance = hasSufficientBalance !== undefined ? hasSufficientBalance : false;

        // Get real transaction history
        const recentTransactions = await globalTransactionHistory.getRecentTransactions(authResult.userId!);
        const transactionSummary = await globalTransactionHistory.getTransactionSummary(authResult.userId!);

        // Calculate dynamic usage statistics from transaction history
        const usageStats = {
            totalSpent: transactionSummary.totalDeductions,
            averageCostPerRequest: transactionSummary.averageTransactionAmount,
            requestsThisMonth: await getMonthlyRequestCount(authResult.userId!),
            tokensThisMonth: await getMonthlyTokenCount(authResult.userId!)
        };

        return NextResponse.json({
            balance: {
                current: safeBalance,
                reserved: 0, // Would need to track reserved balance
                available: safeBalance
            },
            hasSufficientBalance: safeSufficientBalance,
            usageStats,
            recentTransactions: recentTransactions.map(txn => ({
                id: txn.id,
                type: txn.type,
                amount: txn.amount,
                description: txn.description,
                timestamp: txn.timestamp.toISOString(),
                status: txn.status
            })),
            transactionSummary: {
                totalDeposits: transactionSummary.totalDeposits,
                totalSpent: transactionSummary.totalDeductions,
                netBalance: transactionSummary.netBalance,
                transactionCount: transactionSummary.transactionCount
            },
            deposit: {
                multisigAddress: process.env.SOLANA_MULTISIG_ADDRESS || 'placeholder-address',
                tokenMint: process.env.SVMAI_TOKEN_MINT || 'placeholder-mint',
                minimumAmount: 100
            }
        });

    } catch (error) {
        console.error('Error fetching balance:', error);
        return NextResponse.json(
            { error: 'Failed to fetch balance information' },
            { status: 500 }
        );
    }
}

export async function OPTIONS(_request: NextRequest) {
    return new NextResponse(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-ID',
            'Access-Control-Max-Age': '86400'
        }
    });
}

// Helper functions for monthly statistics
async function getMonthlyRequestCount(userId: string): Promise<number> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const transactions = await globalTransactionHistory.getTransactions({
        userId,
        type: 'deduction',
        startDate: startOfMonth,
        limit: 1000
    });

    return transactions.length;
}

async function getMonthlyTokenCount(userId: string): Promise<number> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const transactions = await globalTransactionHistory.getTransactions({
        userId,
        type: 'deduction',
        startDate: startOfMonth,
        limit: 1000
    });

    return transactions.reduce((total, txn) => {
        if (txn.metadata?.tokens) {
            return total + txn.metadata.tokens.input + txn.metadata.tokens.output;
        }
        return total;
    }, 0);
} 