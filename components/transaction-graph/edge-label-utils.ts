/**
 * Utility functions for formatting edge labels in the transaction graph
 */

export interface EdgeLabelData {
    amount?: number;
    tokenSymbol?: string;
    txType?: string;
    isFunding?: boolean;
}

/**
 * Format an edge label based on transaction data
 * @param data Edge label data
 * @returns Formatted label string
 */
export function formatEdgeLabel(data: EdgeLabelData): string {
    if (!data.amount && !data.tokenSymbol) {
        return data.txType || 'tx';
    }

    if (data.tokenSymbol && data.amount) {
        // Token transfer
        const formattedAmount = formatTokenAmount(data.amount);
        return `${data.tokenSymbol} ${formattedAmount}`;
    } else if (data.amount) {
        // SOL transfer
        const formattedAmount = formatSolAmount(data.amount);
        return `SOL ${formattedAmount}`;
    }

    return data.tokenSymbol || data.txType || 'tx';
}

/**
 * Format token amount for display
 * @param amount Token amount
 * @returns Formatted amount string
 */
function formatTokenAmount(amount: number): string {
    if (amount >= 1000000) {
        return `${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
        return `${(amount / 1000).toFixed(1)}K`;
    } else if (amount >= 1) {
        return amount.toFixed(1);
    } else {
        return amount.toFixed(4);
    }
}

/**
 * Format SOL amount for display
 * @param amount SOL amount in lamports
 * @returns Formatted SOL amount string
 */
function formatSolAmount(amount: number): string {
    const solAmount = amount / 1000000000; // Convert from lamports to SOL

    if (solAmount >= 1000) {
        return `${(solAmount / 1000).toFixed(1)}K`;
    } else if (solAmount >= 1) {
        return solAmount.toFixed(2);
    } else if (solAmount >= 0.001) {
        return solAmount.toFixed(4);
    } else {
        return solAmount.toFixed(6);
    }
}

/**
 * Get edge thickness based on transaction amount
 * @param amount Transaction amount
 * @returns Edge width in pixels
 */
export function getEdgeThickness(amount?: number): number {
    if (!amount) return 2;

    if (amount >= 1000000) return 5;
    if (amount >= 100000) return 4.5;
    if (amount >= 10000) return 4;
    if (amount >= 1000) return 3.5;
    if (amount >= 100) return 3;
    if (amount >= 10) return 2.5;
    return 2;
}
