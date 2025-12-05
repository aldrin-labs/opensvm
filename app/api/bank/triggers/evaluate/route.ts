import { NextRequest, NextResponse } from 'next/server';
import { qdrantClient } from '@/lib/search/qdrant';
import { decryptPrivateKey } from '@/lib/bank/encryption';
import {
  Connection,
  PublicKey,
  Keypair,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction
} from '@solana/web3.js';
import {
  getTokenPrice,
  getTokenPrices,
  getSwapQuote,
  executeSwap,
  getTokenInfo
} from '@/lib/bank/jupiter-swap';
import type { TriggerCondition, TriggerAction, Trigger } from '../route';

const WALLETS_COLLECTION = 'svm_bank_wallets';
const TRIGGERS_COLLECTION = 'svm_bank_triggers';

const CRON_SECRET = process.env.CRON_SECRET || process.env.API_KEY_ENCRYPTION_SECRET;

// Price history cache for change detection
const priceHistory = new Map<string, { price: number; timestamp: number }[]>();
const MAX_HISTORY_SIZE = 1000;

interface WalletPayload {
  id: string;
  userWallet: string;
  address: string;
  encryptedPrivateKey: string;
  name: string;
}

function getConnection(): Connection {
  const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
                 process.env.SOLANA_RPC_URL ||
                 'https://api.mainnet-beta.solana.com';
  return new Connection(rpcUrl, 'confirmed');
}

/**
 * Store price in history for change detection
 */
function recordPrice(mint: string, price: number): void {
  if (!priceHistory.has(mint)) {
    priceHistory.set(mint, []);
  }

  const history = priceHistory.get(mint)!;
  history.push({ price, timestamp: Date.now() });

  // Keep only recent history
  while (history.length > MAX_HISTORY_SIZE) {
    history.shift();
  }
}

/**
 * Get price change over time window
 */
function getPriceChange(mint: string, minutes: number): number | null {
  const history = priceHistory.get(mint);
  if (!history || history.length < 2) return null;

  const now = Date.now();
  const windowStart = now - minutes * 60 * 1000;

  // Find oldest price within window
  const oldestInWindow = history.find(h => h.timestamp >= windowStart);
  if (!oldestInWindow) return null;

  const currentPrice = history[history.length - 1].price;
  const changePercent = ((currentPrice - oldestInWindow.price) / oldestInWindow.price) * 100;

  return changePercent;
}

/**
 * Evaluate a single condition
 */
async function evaluateCondition(
  condition: TriggerCondition,
  prices: Map<string, number>
): Promise<{ met: boolean; value: any }> {
  const connection = getConnection();

  switch (condition.type) {
    case 'price_above': {
      const price = prices.get(condition.tokenMint!);
      if (price === undefined) return { met: false, value: null };
      return { met: price > condition.priceThreshold!, value: price };
    }

    case 'price_below': {
      const price = prices.get(condition.tokenMint!);
      if (price === undefined) return { met: false, value: null };
      return { met: price < condition.priceThreshold!, value: price };
    }

    case 'price_change_percent': {
      const change = getPriceChange(condition.tokenMint!, condition.timeWindowMinutes!);
      if (change === null) return { met: false, value: null };
      const met = condition.percentChange! > 0
        ? change >= condition.percentChange!
        : change <= condition.percentChange!;
      return { met, value: change };
    }

    case 'balance_above':
    case 'balance_below': {
      try {
        const walletResult = await qdrantClient.retrieve(WALLETS_COLLECTION, {
          ids: [condition.walletId!],
          with_payload: true
        });

        if (walletResult.length === 0) return { met: false, value: null };

        const wallet = walletResult[0].payload as WalletPayload;
        const balance = await connection.getBalance(new PublicKey(wallet.address));
        const solBalance = balance / LAMPORTS_PER_SOL;

        const met = condition.type === 'balance_above'
          ? solBalance > condition.balanceThreshold!
          : solBalance < condition.balanceThreshold!;

        return { met, value: solBalance };
      } catch {
        return { met: false, value: null };
      }
    }

    case 'time_window': {
      const now = new Date();
      const hour = now.getHours();
      const day = now.getDay();

      let inTimeRange = false;
      if (condition.startHour! <= condition.endHour!) {
        inTimeRange = hour >= condition.startHour! && hour < condition.endHour!;
      } else {
        // Overnight range (e.g., 22-6)
        inTimeRange = hour >= condition.startHour! || hour < condition.endHour!;
      }

      const inDayRange = !condition.daysOfWeek ||
                         condition.daysOfWeek.length === 0 ||
                         condition.daysOfWeek.includes(day);

      return { met: inTimeRange && inDayRange, value: { hour, day } };
    }

    case 'external_signal': {
      try {
        const response = await fetch(condition.signalEndpoint!, {
          headers: condition.signalKey
            ? { 'Authorization': `Bearer ${condition.signalKey}` }
            : {},
          signal: AbortSignal.timeout(5000)
        });

        if (!response.ok) return { met: false, value: null };

        const data = await response.json();
        // Expect { signal: true/false } format
        return { met: !!data.signal, value: data };
      } catch {
        return { met: false, value: null };
      }
    }

    default:
      return { met: false, value: null };
  }
}

/**
 * Execute a trigger action
 */
async function executeAction(
  action: TriggerAction,
  trigger: Trigger,
  conditionValues: Record<string, any>
): Promise<{ success: boolean; result?: any; error?: string }> {
  const connection = getConnection();

  try {
    switch (action.type) {
      case 'transfer': {
        // Fetch wallet
        const walletResult = await qdrantClient.retrieve(WALLETS_COLLECTION, {
          ids: [action.fromWalletId!],
          with_payload: true
        });

        if (walletResult.length === 0) {
          throw new Error('Wallet not found');
        }

        const wallet = walletResult[0].payload as WalletPayload;

        // Decrypt and create keypair
        const privateKeyBytes = decryptPrivateKey(wallet.encryptedPrivateKey, trigger.userWallet);
        const keypair = Keypair.fromSecretKey(privateKeyBytes);
        const sourcePubkey = new PublicKey(wallet.address);
        const destPubkey = new PublicKey(action.toAddress!);

        // Build transfer transaction
        const lamports = Math.floor(action.amount! * LAMPORTS_PER_SOL);

        const transaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: sourcePubkey,
            toPubkey: destPubkey,
            lamports
          })
        );

        const signature = await sendAndConfirmTransaction(
          connection,
          transaction,
          [keypair],
          { commitment: 'confirmed' }
        );

        return { success: true, result: { signature, amount: action.amount } };
      }

      case 'swap': {
        // Fetch wallet
        const walletResult = await qdrantClient.retrieve(WALLETS_COLLECTION, {
          ids: [action.fromWalletId!],
          with_payload: true
        });

        if (walletResult.length === 0) {
          throw new Error('Wallet not found');
        }

        const wallet = walletResult[0].payload as WalletPayload;

        // Get token info
        const inputToken = await getTokenInfo(action.inputMint!);
        if (!inputToken) throw new Error('Invalid input token');

        // Get quote
        const quote = await getSwapQuote(
          action.inputMint!,
          action.outputMint!,
          action.inputAmount!,
          inputToken.decimals,
          action.slippageBps || 100
        );

        if (!quote) throw new Error('Failed to get swap quote');

        // Execute swap
        const privateKeyBytes = decryptPrivateKey(wallet.encryptedPrivateKey, trigger.userWallet);
        const keypair = Keypair.fromSecretKey(privateKeyBytes);
        const publicKey = new PublicKey(wallet.address);

        const result = await executeSwap(quote, publicKey, keypair);

        if (!result.success) {
          throw new Error(result.error || 'Swap failed');
        }

        return { success: true, result };
      }

      case 'webhook': {
        const response = await fetch(action.webhookUrl!, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...action.webhookHeaders
          },
          body: JSON.stringify({
            triggerId: trigger.id,
            triggerName: trigger.name,
            conditionValues,
            timestamp: Date.now()
          }),
          signal: AbortSignal.timeout(10000)
        });

        return {
          success: response.ok,
          result: { status: response.status }
        };
      }

      case 'notification': {
        // For now, just log - would integrate with notification service
        console.log(`Notification [${action.notificationMethod}]: ${action.message || trigger.name}`);
        return { success: true, result: { method: action.notificationMethod } };
      }

      default:
        return { success: false, error: 'Unknown action type' };
    }
  } catch (error) {
    console.error('Action execution error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * POST /api/bank/triggers/evaluate
 * Evaluate and execute active triggers (called by cron job)
 */
export async function POST(req: NextRequest) {
  try {
    // Verify cron authentication
    const authHeader = req.headers.get('authorization');
    const cronKey = authHeader?.replace('Bearer ', '');

    if (!CRON_SECRET || cronKey !== CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = Date.now();
    const results: Array<{
      triggerId: string;
      triggerName: string;
      conditionsMet: boolean;
      actionsExecuted: number;
      errors: string[];
    }> = [];

    // Fetch active triggers
    const activeTriggers = await qdrantClient.scroll(TRIGGERS_COLLECTION, {
      filter: {
        must: [{ key: 'status', match: { value: 'active' } }]
      },
      limit: 100,
      with_payload: true
    });

    console.log(`Evaluating ${activeTriggers.points.length} active triggers`);

    // Collect all token mints for batch price fetch
    const allMints = new Set<string>();
    for (const point of activeTriggers.points) {
      const trigger = point.payload as Trigger;
      for (const condition of trigger.conditions) {
        if (condition.tokenMint) {
          allMints.add(condition.tokenMint);
        }
      }
    }

    // Batch fetch prices
    const prices = await getTokenPrices(Array.from(allMints));

    // Record prices for change detection
    for (const [mint, price] of prices.entries()) {
      recordPrice(mint, price);
    }

    // Evaluate each trigger
    for (const point of activeTriggers.points) {
      const trigger = point.payload as Trigger;
      const triggerId = point.id as string;

      // Check cooldown
      if (trigger.lastExecutedAt) {
        const cooldownMs = trigger.cooldownMinutes * 60 * 1000;
        if (now - trigger.lastExecutedAt < cooldownMs) {
          continue; // Still in cooldown
        }
      }

      // Evaluate all conditions (AND logic)
      const conditionValues: Record<string, any> = {};
      let allConditionsMet = true;

      for (let i = 0; i < trigger.conditions.length; i++) {
        const { met, value } = await evaluateCondition(trigger.conditions[i], prices);
        conditionValues[`condition_${i}`] = value;
        if (!met) {
          allConditionsMet = false;
          break;
        }
      }

      const result = {
        triggerId,
        triggerName: trigger.name,
        conditionsMet: allConditionsMet,
        actionsExecuted: 0,
        errors: [] as string[]
      };

      // Execute actions if all conditions met
      if (allConditionsMet) {
        for (const action of trigger.actions) {
          const actionResult = await executeAction(action, trigger, conditionValues);
          if (actionResult.success) {
            result.actionsExecuted++;
          } else if (actionResult.error) {
            result.errors.push(actionResult.error);
          }
        }

        // Update trigger state
        const newExecutionCount = trigger.executionCount + 1;
        let newStatus: Trigger['status'] = trigger.status;

        if (trigger.executeOnce) {
          newStatus = 'completed';
        } else if (trigger.maxExecutions && newExecutionCount >= trigger.maxExecutions) {
          newStatus = 'completed';
        }

        if (result.errors.length > 0 && result.actionsExecuted === 0) {
          newStatus = 'failed';
        }

        await qdrantClient.setPayload(TRIGGERS_COLLECTION, {
          payload: {
            ...trigger,
            executionCount: newExecutionCount,
            lastExecutedAt: now,
            lastCheckAt: now,
            lastConditionValues: conditionValues,
            status: newStatus,
            updatedAt: now
          },
          points: [triggerId]
        });
      } else {
        // Just update check time
        await qdrantClient.setPayload(TRIGGERS_COLLECTION, {
          payload: {
            ...trigger,
            lastCheckAt: now,
            lastConditionValues: conditionValues,
            updatedAt: now
          },
          points: [triggerId]
        });
      }

      results.push(result);
    }

    const triggeredCount = results.filter(r => r.conditionsMet).length;
    const executedCount = results.filter(r => r.actionsExecuted > 0).length;

    return NextResponse.json({
      success: true,
      evaluated: results.length,
      triggered: triggeredCount,
      executed: executedCount,
      results
    });

  } catch (error) {
    console.error('Trigger evaluation error:', error);
    return NextResponse.json(
      { error: 'Evaluation failed', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/bank/triggers/evaluate
 * Get trigger evaluation status (for monitoring)
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const cronKey = authHeader?.replace('Bearer ', '');

    if (!CRON_SECRET || cronKey !== CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const activeTriggers = await qdrantClient.scroll(TRIGGERS_COLLECTION, {
      filter: {
        must: [{ key: 'status', match: { value: 'active' } }]
      },
      limit: 100,
      with_payload: true
    });

    const triggers = activeTriggers.points.map((p: any) => ({
      id: p.id,
      name: p.payload.name,
      conditionCount: p.payload.conditions.length,
      actionCount: p.payload.actions.length,
      executionCount: p.payload.executionCount,
      lastCheckedAt: p.payload.lastCheckAt
        ? new Date(p.payload.lastCheckAt).toISOString()
        : null,
      lastExecutedAt: p.payload.lastExecutedAt
        ? new Date(p.payload.lastExecutedAt).toISOString()
        : null
    }));

    return NextResponse.json({
      activeCount: triggers.length,
      triggers,
      priceHistoryTokens: Array.from(priceHistory.keys()).length
    });

  } catch (error) {
    console.error('Error getting trigger status:', error);
    return NextResponse.json({ error: 'Failed to get status' }, { status: 500 });
  }
}
