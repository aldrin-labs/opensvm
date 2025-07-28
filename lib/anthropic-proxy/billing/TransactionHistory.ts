export interface Transaction {
    id: string;
    userId: string;
    type: 'deposit' | 'deduction' | 'refund' | 'adjustment';
    amount: number;
    balanceBefore: number;
    balanceAfter: number;
    description: string;
    metadata?: {
        apiKeyId?: string;
        requestId?: string;
        model?: string;
        tokens?: {
            input: number;
            output: number;
        };
        transactionSignature?: string; // For Solana deposits
    };
    timestamp: Date;
    status: 'pending' | 'completed' | 'failed' | 'cancelled';
}

export interface TransactionFilter {
    userId: string;
    type?: Transaction['type'];
    status?: Transaction['status'];
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
}

export interface TransactionSummary {
    totalDeposits: number;
    totalDeductions: number;
    totalRefunds: number;
    netBalance: number;
    transactionCount: number;
    averageTransactionAmount: number;
    lastTransactionDate?: Date;
}

export class TransactionHistory {
    private transactions: Map<string, Transaction> = new Map();
    private userTransactions: Map<string, string[]> = new Map();

    /**
     * Record a new transaction
     */
    async recordTransaction(transaction: Omit<Transaction, 'id' | 'timestamp'>): Promise<Transaction> {
        const id = this.generateTransactionId();
        const fullTransaction: Transaction = {
            ...transaction,
            id,
            timestamp: new Date()
        };

        // Store transaction
        this.transactions.set(id, fullTransaction);

        // Update user index
        const userTxns = this.userTransactions.get(transaction.userId) || [];
        userTxns.push(id);
        this.userTransactions.set(transaction.userId, userTxns);

        console.log(`Transaction recorded: ${id} for user ${transaction.userId} - ${transaction.type} ${transaction.amount} SVMAI`);

        return fullTransaction;
    }

    /**
     * Get transactions for a user with filtering
     */
    async getTransactions(filter: TransactionFilter): Promise<Transaction[]> {
        const userTxns = this.userTransactions.get(filter.userId) || [];
        let transactions = userTxns
            .map(id => this.transactions.get(id))
            .filter((txn): txn is Transaction => txn !== undefined);

        // Apply filters
        if (filter.type) {
            transactions = transactions.filter(txn => txn.type === filter.type);
        }

        if (filter.status) {
            transactions = transactions.filter(txn => txn.status === filter.status);
        }

        if (filter.startDate) {
            transactions = transactions.filter(txn => txn.timestamp >= filter.startDate!);
        }

        if (filter.endDate) {
            transactions = transactions.filter(txn => txn.timestamp <= filter.endDate!);
        }

        // Sort by timestamp (newest first)
        transactions.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

        // Apply pagination
        const offset = filter.offset || 0;
        const limit = filter.limit || 50;

        return transactions.slice(offset, offset + limit);
    }

    /**
     * Get recent transactions (last 10)
     */
    async getRecentTransactions(userId: string): Promise<Transaction[]> {
        return this.getTransactions({
            userId,
            limit: 10
        });
    }

    /**
     * Get transaction summary for a user
     */
    async getTransactionSummary(userId: string, startDate?: Date, endDate?: Date): Promise<TransactionSummary> {
        const transactions = await this.getTransactions({
            userId,
            startDate,
            endDate,
            limit: 1000 // Get all for summary
        });

        const summary: TransactionSummary = {
            totalDeposits: 0,
            totalDeductions: 0,
            totalRefunds: 0,
            netBalance: 0,
            transactionCount: transactions.length,
            averageTransactionAmount: 0,
            lastTransactionDate: transactions[0]?.timestamp
        };

        for (const txn of transactions) {
            switch (txn.type) {
                case 'deposit':
                    summary.totalDeposits += txn.amount;
                    break;
                case 'deduction':
                    summary.totalDeductions += Math.abs(txn.amount);
                    break;
                case 'refund':
                    summary.totalRefunds += txn.amount;
                    break;
            }
        }

        summary.netBalance = summary.totalDeposits - summary.totalDeductions + summary.totalRefunds;
        summary.averageTransactionAmount = transactions.length > 0
            ? Math.abs(summary.netBalance) / transactions.length
            : 0;

        return summary;
    }

    /**
     * Get transaction by ID
     */
    async getTransaction(transactionId: string): Promise<Transaction | null> {
        return this.transactions.get(transactionId) || null;
    }

    /**
     * Update transaction status
     */
    async updateTransactionStatus(transactionId: string, status: Transaction['status']): Promise<boolean> {
        const transaction = this.transactions.get(transactionId);
        if (!transaction) {
            return false;
        }

        transaction.status = status;
        this.transactions.set(transactionId, transaction);

        console.log(`Transaction ${transactionId} status updated to ${status}`);
        return true;
    }

    /**
     * Record API usage transaction
     */
    async recordAPIUsage(
        userId: string,
        apiKeyId: string,
        requestId: string,
        model: string,
        cost: number,
        tokens: { input: number; output: number },
        balanceBefore: number
    ): Promise<Transaction> {
        return this.recordTransaction({
            userId,
            type: 'deduction',
            amount: -cost, // Negative for deduction
            balanceBefore,
            balanceAfter: balanceBefore - cost,
            description: `API usage - ${model} (${tokens.input + tokens.output} tokens)`,
            metadata: {
                apiKeyId,
                requestId,
                model,
                tokens
            },
            status: 'completed'
        });
    }

    /**
     * Record deposit transaction
     */
    async recordDeposit(
        userId: string,
        amount: number,
        transactionSignature: string,
        balanceBefore: number
    ): Promise<Transaction> {
        return this.recordTransaction({
            userId,
            type: 'deposit',
            amount,
            balanceBefore,
            balanceAfter: balanceBefore + amount,
            description: `SVMAI deposit via Solana`,
            metadata: {
                transactionSignature
            },
            status: 'completed'
        });
    }

    /**
     * Generate unique transaction ID
     */
    private generateTransactionId(): string {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 8);
        return `txn_${timestamp}_${random}`;
    }

    /**
     * Get statistics for monitoring
     */
    getStats(): {
        totalTransactions: number;
        totalUsers: number;
        memoryUsage: number;
    } {
        return {
            totalTransactions: this.transactions.size,
            totalUsers: this.userTransactions.size,
            memoryUsage: JSON.stringify({
                transactions: Array.from(this.transactions.values()),
                userIndex: Array.from(this.userTransactions.entries())
            }).length
        };
    }
}

// Global transaction history instance
export const globalTransactionHistory = new TransactionHistory(); 