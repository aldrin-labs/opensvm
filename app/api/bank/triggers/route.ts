import { NextRequest, NextResponse } from 'next/server';
import { qdrantClient } from '@/lib/search/qdrant';
import { getSessionFromCookie } from '@/lib/api-auth/auth-server';
import { v4 as uuidv4 } from 'uuid';
import { getTokenInfo, getTokenPrice } from '@/lib/bank/jupiter-swap';

const WALLETS_COLLECTION = 'svm_bank_wallets';
const TRIGGERS_COLLECTION = 'svm_bank_triggers';

// Ensure collection exists
async function ensureCollection() {
  try {
    const collections = await qdrantClient.getCollections();
    const exists = collections.collections.some(c => c.name === TRIGGERS_COLLECTION);

    if (!exists) {
      await qdrantClient.createCollection(TRIGGERS_COLLECTION, {
        vectors: { size: 4, distance: 'Cosine' }
      });
      console.log('Created triggers collection');
    }
  } catch (error) {
    console.error('Error ensuring collection:', error);
  }
}

export type TriggerType =
  | 'price_above'
  | 'price_below'
  | 'price_change_percent'
  | 'balance_above'
  | 'balance_below'
  | 'time_window'
  | 'external_signal';

export type ActionType =
  | 'transfer'
  | 'swap'
  | 'notification'
  | 'webhook';

export interface TriggerCondition {
  type: TriggerType;
  // For price triggers
  tokenMint?: string;
  tokenSymbol?: string;
  priceThreshold?: number;
  percentChange?: number;
  timeWindowMinutes?: number;
  // For balance triggers
  walletId?: string;
  balanceThreshold?: number;
  // For time window
  startHour?: number;
  endHour?: number;
  daysOfWeek?: number[];
  // For external signal
  signalEndpoint?: string;
  signalKey?: string;
}

export interface TriggerAction {
  type: ActionType;
  // For transfer
  fromWalletId?: string;
  toAddress?: string;
  amount?: number;
  tokenMint?: string;
  // For swap
  inputMint?: string;
  outputMint?: string;
  inputAmount?: number;
  slippageBps?: number;
  // For webhook
  webhookUrl?: string;
  webhookHeaders?: Record<string, string>;
  // For notification
  notificationMethod?: 'email' | 'webhook';
  notificationTarget?: string;
  message?: string;
}

export interface Trigger {
  id: string;
  userWallet: string;
  name: string;
  description?: string;
  // Conditions (AND logic - all must be true)
  conditions: TriggerCondition[];
  // Actions to execute when triggered
  actions: TriggerAction[];
  // Execution settings
  executeOnce: boolean; // If true, deactivate after first execution
  cooldownMinutes: number; // Minimum time between executions
  maxExecutions?: number;
  // State
  status: 'active' | 'paused' | 'completed' | 'failed';
  executionCount: number;
  lastExecutedAt?: number;
  lastCheckAt?: number;
  lastConditionValues?: Record<string, any>;
  // Metadata
  createdAt: number;
  updatedAt: number;
}

interface CreateTriggerRequest {
  name: string;
  description?: string;
  conditions: TriggerCondition[];
  actions: TriggerAction[];
  executeOnce?: boolean;
  cooldownMinutes?: number;
  maxExecutions?: number;
}

interface WalletPayload {
  id: string;
  userWallet: string;
  address: string;
  name: string;
  requiresHardwareSignature?: boolean;
}

/**
 * Validate trigger conditions
 */
async function validateConditions(
  conditions: TriggerCondition[],
  userWallet: string
): Promise<{ valid: boolean; error?: string }> {
  for (const condition of conditions) {
    switch (condition.type) {
      case 'price_above':
      case 'price_below':
        if (!condition.tokenMint || !condition.priceThreshold) {
          return { valid: false, error: 'Price triggers require tokenMint and priceThreshold' };
        }
        const tokenInfo = await getTokenInfo(condition.tokenMint);
        if (!tokenInfo) {
          return { valid: false, error: `Invalid token mint: ${condition.tokenMint}` };
        }
        break;

      case 'price_change_percent':
        if (!condition.tokenMint || !condition.percentChange || !condition.timeWindowMinutes) {
          return { valid: false, error: 'Price change triggers require tokenMint, percentChange, and timeWindowMinutes' };
        }
        break;

      case 'balance_above':
      case 'balance_below':
        if (!condition.walletId || condition.balanceThreshold === undefined) {
          return { valid: false, error: 'Balance triggers require walletId and balanceThreshold' };
        }
        // Verify wallet ownership
        const walletResult = await qdrantClient.retrieve(WALLETS_COLLECTION, {
          ids: [condition.walletId],
          with_payload: true
        });
        if (walletResult.length === 0) {
          return { valid: false, error: 'Wallet not found' };
        }
        const wallet = walletResult[0].payload as WalletPayload;
        if (wallet.userWallet !== userWallet) {
          return { valid: false, error: 'Not authorized to monitor this wallet' };
        }
        break;

      case 'time_window':
        if (condition.startHour === undefined || condition.endHour === undefined) {
          return { valid: false, error: 'Time window triggers require startHour and endHour' };
        }
        break;

      case 'external_signal':
        if (!condition.signalEndpoint) {
          return { valid: false, error: 'External signal triggers require signalEndpoint' };
        }
        break;
    }
  }

  return { valid: true };
}

/**
 * Validate trigger actions
 */
async function validateActions(
  actions: TriggerAction[],
  userWallet: string
): Promise<{ valid: boolean; error?: string }> {
  for (const action of actions) {
    switch (action.type) {
      case 'transfer':
        if (!action.fromWalletId || !action.toAddress || !action.amount) {
          return { valid: false, error: 'Transfer actions require fromWalletId, toAddress, and amount' };
        }
        // Verify wallet ownership
        const walletResult = await qdrantClient.retrieve(WALLETS_COLLECTION, {
          ids: [action.fromWalletId],
          with_payload: true
        });
        if (walletResult.length === 0) {
          return { valid: false, error: 'Wallet not found' };
        }
        const wallet = walletResult[0].payload as WalletPayload;
        if (wallet.userWallet !== userWallet) {
          return { valid: false, error: 'Not authorized to transfer from this wallet' };
        }
        if (wallet.requiresHardwareSignature) {
          return { valid: false, error: 'Cannot use hardware-protected wallets in triggers' };
        }
        break;

      case 'swap':
        if (!action.fromWalletId || !action.inputMint || !action.outputMint || !action.inputAmount) {
          return { valid: false, error: 'Swap actions require fromWalletId, inputMint, outputMint, and inputAmount' };
        }
        break;

      case 'webhook':
        if (!action.webhookUrl) {
          return { valid: false, error: 'Webhook actions require webhookUrl' };
        }
        // Validate URL
        try {
          new URL(action.webhookUrl);
        } catch {
          return { valid: false, error: 'Invalid webhook URL' };
        }
        break;

      case 'notification':
        if (!action.notificationMethod || !action.notificationTarget) {
          return { valid: false, error: 'Notification actions require method and target' };
        }
        break;
    }
  }

  return { valid: true };
}

/**
 * GET /api/bank/triggers
 * List all triggers for the authenticated user
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromCookie();
    if (!session?.walletAddress) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    await ensureCollection();
    const userWallet = session.walletAddress;

    const results = await qdrantClient.scroll(TRIGGERS_COLLECTION, {
      filter: {
        must: [{ key: 'userWallet', match: { value: userWallet } }]
      },
      limit: 100,
      with_payload: true
    });

    const triggers = results.points.map((point: any) => ({
      ...point.payload,
      id: point.id
    })) as Trigger[];

    const active = triggers.filter(t => t.status === 'active' || t.status === 'paused');
    const completed = triggers.filter(t => t.status === 'completed' || t.status === 'failed');

    return NextResponse.json({
      triggers: active,
      completedTriggers: completed,
      total: triggers.length,
      activeCount: active.filter(t => t.status === 'active').length
    });

  } catch (error) {
    console.error('Error fetching triggers:', error);
    return NextResponse.json({ error: 'Failed to fetch triggers' }, { status: 500 });
  }
}

/**
 * POST /api/bank/triggers
 * Create a new conditional trigger
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromCookie();
    if (!session?.walletAddress) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    await ensureCollection();
    const userWallet = session.walletAddress;
    const body: CreateTriggerRequest = await req.json();

    const {
      name,
      description,
      conditions,
      actions,
      executeOnce = false,
      cooldownMinutes = 60,
      maxExecutions
    } = body;

    // Validate required fields
    if (!name || !conditions || conditions.length === 0 || !actions || actions.length === 0) {
      return NextResponse.json(
        { error: 'Name, conditions, and actions are required' },
        { status: 400 }
      );
    }

    // Validate conditions
    const conditionValidation = await validateConditions(conditions, userWallet);
    if (!conditionValidation.valid) {
      return NextResponse.json(
        { error: conditionValidation.error },
        { status: 400 }
      );
    }

    // Validate actions
    const actionValidation = await validateActions(actions, userWallet);
    if (!actionValidation.valid) {
      return NextResponse.json(
        { error: actionValidation.error },
        { status: 400 }
      );
    }

    // Enrich conditions with token symbols
    for (const condition of conditions) {
      if (condition.tokenMint && !condition.tokenSymbol) {
        const token = await getTokenInfo(condition.tokenMint);
        if (token) {
          condition.tokenSymbol = token.symbol;
        }
      }
    }

    // Create trigger
    const id = uuidv4();
    const now = Date.now();

    const trigger: Trigger = {
      id,
      userWallet,
      name,
      description,
      conditions,
      actions,
      executeOnce,
      cooldownMinutes,
      maxExecutions,
      status: 'active',
      executionCount: 0,
      createdAt: now,
      updatedAt: now
    };

    await qdrantClient.upsert(TRIGGERS_COLLECTION, {
      points: [
        {
          id,
          vector: [0.1, 0.1, 0.1, 0.1],
          payload: trigger
        }
      ]
    });

    console.log(`Created trigger ${id} for user ${userWallet}: ${name}`);

    return NextResponse.json({
      success: true,
      trigger
    });

  } catch (error) {
    console.error('Error creating trigger:', error);
    return NextResponse.json(
      { error: 'Failed to create trigger', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
