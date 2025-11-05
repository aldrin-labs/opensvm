// Client-side utilities for AI transaction analysis
// These can be safely imported in client components

export interface TransactionExplanation {
  summary: string;
  mainAction: {
    type: string;
    description: string;
    participants: string[];
    amounts: Array<{
      token: string;
      amount: string;
      usdValue?: number;
    }>;
  };
  secondaryEffects: Array<{
    type: string;
    description: string;
    significance: 'low' | 'medium' | 'high';
  }>;
  riskAssessment: {
    level: 'low' | 'medium' | 'high';
    score: number;
    factors: string[];
    recommendations: string[];
  };
  technicalDetails: {
    programsUsed: string[];
    instructionCount: number;
    accountsAffected: number;
    computeUnitsUsed?: number;
    fees: {
      total: number;
      breakdown: Array<{
        type: string;
        amount: number;
      }>;
    };
  };
  confidence: number; // 0-1 scale
  generatedAt: number;
}

export function formatConfidenceLevel(confidence: number): string {
  if (confidence >= 0.9) return 'Very High';
  if (confidence >= 0.7) return 'High';
  if (confidence >= 0.5) return 'Medium';
  if (confidence >= 0.3) return 'Low';
  return 'Very Low';
}

export function getActionTypeIcon(actionType: string): string {
  const icons: Record<string, string> = {
    transfer: '💸',
    swap: '🔄',
    mint: '🪙',
    burn: '🔥',
    stake: '🔒',
    vote: '🗳️',
    unknown: '❓'
  };
  return icons[actionType] || icons.unknown;
}

export function getRiskLevelColor(level: 'low' | 'medium' | 'high'): string {
  switch (level) {
    case 'low':
      return 'text-green-600 dark:text-green-400';
    case 'medium':
      return 'text-yellow-600 dark:text-yellow-400';
    case 'high':
      return 'text-red-600 dark:text-red-400';
    default:
      return 'text-muted-foreground';
  }
}

// API client functions
export async function analyzeTransaction(
  transaction: any,
  options?: {
    detailLevel?: 'basic' | 'detailed' | 'technical';
    focusAreas?: string[];
  }
): Promise<TransactionExplanation> {
  const response = await fetch('/api/ai-analyze-transaction', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ transaction, options }),
  });

  if (!response.ok) {
    throw new Error(`Failed to analyze transaction: ${response.statusText}`);
  }

  const data = await response.json();
  return data.explanation;
}

export async function getCachedExplanation(signature: string): Promise<TransactionExplanation | null> {
  try {
    const response = await fetch(`/api/ai-analyze-transaction?signature=${signature}`, {
      method: 'GET',
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      console.error('Failed to get cached explanation:', response.statusText);
      return null;
    }

    const data = await response.json();
    return data.explanation;
  } catch (error) {
    console.error('Error fetching cached explanation:', error);
    return null;
  }
}

export async function cacheExplanation(signature: string, _explanation: TransactionExplanation): Promise<void> {
  // Caching is handled server-side, this is just for compatibility
  console.log(`Explanation for ${signature} will be cached server-side`);
}
