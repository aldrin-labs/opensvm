/**
 * Trading Database - Persistent storage for orders and trades
 *
 * Uses JSON file persistence similar to launchpad database.
 * In production, this would be replaced with PostgreSQL/MongoDB.
 */

import { writeFile, readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

// ============= Types =============

export interface DBOrder {
  id: string;
  orderId: number;
  clientOrderId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT' | 'LIMIT_MAKER' | 'STOP_LOSS' | 'STOP_LOSS_LIMIT' | 'TAKE_PROFIT' | 'TAKE_PROFIT_LIMIT';
  timeInForce: 'GTC' | 'IOC' | 'FOK';
  status: 'NEW' | 'PARTIALLY_FILLED' | 'FILLED' | 'CANCELED' | 'PENDING_CANCEL' | 'REJECTED' | 'EXPIRED';
  price: string;
  origQty: string;
  executedQty: string;
  cummulativeQuoteQty: string;
  stopPrice?: string;
  walletAddress: string;
  slippageBps: number;
  txSignature?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DBTrade {
  id: string;
  tradeId: number;
  orderId: number;
  symbol: string;
  price: string;
  qty: string;
  quoteQty: string;
  commission: string;
  commissionAsset: string;
  isBuyer: boolean;
  isMaker: boolean;
  walletAddress: string;
  txSignature?: string;
  createdAt: string;
}

export interface DBOrderFill {
  id: string;
  orderId: number;
  tradeId: number;
  price: string;
  qty: string;
  commission: string;
  commissionAsset: string;
  createdAt: string;
}

export interface DBQuoteCache {
  id: string;
  symbol: string;
  inputMint: string;
  outputMint: string;
  inputAmount: string;
  outputAmount: string;
  priceImpact: string;
  route: string; // JSON stringified route
  expiresAt: string;
  createdAt: string;
}

// ============= Database Setup =============

const DATA_DIR = join(process.cwd(), '.data', 'trading');

// In-memory stores
const stores = {
  orders: new Map<string, DBOrder>(),
  trades: new Map<string, DBTrade>(),
  orderFills: new Map<string, DBOrderFill>(),
  quoteCache: new Map<string, DBQuoteCache>(),
};

// Counters for auto-increment IDs
let nextOrderId = 1;
let nextTradeId = 1;
let initialized = false;

/**
 * Initialize database - load from disk if available
 */
export async function initTradingDatabase(): Promise<void> {
  if (initialized) return;

  try {
    // Create data directory if it doesn't exist
    if (!existsSync(DATA_DIR)) {
      await mkdir(DATA_DIR, { recursive: true });
    }

    // Load each store from disk
    await Promise.all(
      Object.keys(stores).map(async (storeName) => {
        const filePath = join(DATA_DIR, `${storeName}.json`);
        if (existsSync(filePath)) {
          try {
            const data = await readFile(filePath, 'utf-8');
            const items = JSON.parse(data);
            const store = stores[storeName as keyof typeof stores] as Map<string, any>;
            items.forEach((item: any) => {
              store.set(item.id, item);

              // Track max IDs for auto-increment
              if (storeName === 'orders' && item.orderId >= nextOrderId) {
                nextOrderId = item.orderId + 1;
              }
              if (storeName === 'trades' && item.tradeId >= nextTradeId) {
                nextTradeId = item.tradeId + 1;
              }
            });
          } catch (error) {
            console.error(`Error loading ${storeName}:`, error);
          }
        }
      })
    );

    initialized = true;
    console.log(`Trading database initialized. Orders: ${stores.orders.size}, Trades: ${stores.trades.size}`);
  } catch (error) {
    console.error('Error initializing trading database:', error);
    throw error;
  }
}

/**
 * Persist a store to disk
 */
async function persistStore(storeName: keyof typeof stores): Promise<void> {
  try {
    const store = stores[storeName];
    const items = Array.from(store.values());
    const filePath = join(DATA_DIR, `${storeName}.json`);
    await writeFile(filePath, JSON.stringify(items, null, 2));
  } catch (error) {
    console.error(`Error persisting ${storeName}:`, error);
  }
}

/**
 * Get next order ID
 */
export function getNextOrderId(): number {
  return nextOrderId++;
}

/**
 * Get next trade ID
 */
export function getNextTradeId(): number {
  return nextTradeId++;
}

// ============= Order Operations =============

export async function createOrder(order: Omit<DBOrder, 'id' | 'createdAt' | 'updatedAt'>): Promise<DBOrder> {
  await initTradingDatabase();

  const now = new Date().toISOString();
  const dbOrder: DBOrder = {
    ...order,
    id: `order_${order.orderId}`,
    createdAt: now,
    updatedAt: now,
  };

  stores.orders.set(dbOrder.id, dbOrder);
  await persistStore('orders');
  return dbOrder;
}

export async function getOrder(orderId: number): Promise<DBOrder | undefined> {
  await initTradingDatabase();
  return stores.orders.get(`order_${orderId}`);
}

export async function getOrderByClientId(clientOrderId: string): Promise<DBOrder | undefined> {
  await initTradingDatabase();
  return Array.from(stores.orders.values()).find(o => o.clientOrderId === clientOrderId);
}

export async function updateOrder(orderId: number, updates: Partial<DBOrder>): Promise<DBOrder | undefined> {
  await initTradingDatabase();
  const id = `order_${orderId}`;
  const order = stores.orders.get(id);
  if (!order) return undefined;

  const updated: DBOrder = {
    ...order,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  stores.orders.set(id, updated);
  await persistStore('orders');
  return updated;
}

export async function listOrders(filters?: {
  symbol?: string;
  walletAddress?: string;
  status?: string;
  limit?: number;
}): Promise<DBOrder[]> {
  await initTradingDatabase();
  let orders = Array.from(stores.orders.values());

  if (filters?.symbol) {
    orders = orders.filter(o => o.symbol === filters.symbol);
  }
  if (filters?.walletAddress) {
    orders = orders.filter(o => o.walletAddress === filters.walletAddress);
  }
  if (filters?.status) {
    orders = orders.filter(o => o.status === filters.status);
  }

  // Sort by creation time descending
  orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (filters?.limit) {
    orders = orders.slice(0, filters.limit);
  }

  return orders;
}

export async function listOpenOrders(filters?: {
  symbol?: string;
  walletAddress?: string;
}): Promise<DBOrder[]> {
  return listOrders({
    ...filters,
    status: undefined, // We'll filter for open statuses manually
  }).then(orders =>
    orders.filter(o => o.status === 'NEW' || o.status === 'PARTIALLY_FILLED')
  );
}

// ============= Trade Operations =============

export async function createTrade(trade: Omit<DBTrade, 'id' | 'createdAt'>): Promise<DBTrade> {
  await initTradingDatabase();

  const dbTrade: DBTrade = {
    ...trade,
    id: `trade_${trade.tradeId}`,
    createdAt: new Date().toISOString(),
  };

  stores.trades.set(dbTrade.id, dbTrade);
  await persistStore('trades');
  return dbTrade;
}

export async function getTrade(tradeId: number): Promise<DBTrade | undefined> {
  await initTradingDatabase();
  return stores.trades.get(`trade_${tradeId}`);
}

export async function listTrades(filters?: {
  symbol?: string;
  walletAddress?: string;
  orderId?: number;
  limit?: number;
}): Promise<DBTrade[]> {
  await initTradingDatabase();
  let trades = Array.from(stores.trades.values());

  if (filters?.symbol) {
    trades = trades.filter(t => t.symbol === filters.symbol);
  }
  if (filters?.walletAddress) {
    trades = trades.filter(t => t.walletAddress === filters.walletAddress);
  }
  if (filters?.orderId) {
    trades = trades.filter(t => t.orderId === filters.orderId);
  }

  // Sort by creation time descending
  trades.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (filters?.limit) {
    trades = trades.slice(0, filters.limit);
  }

  return trades;
}

// ============= Order Fill Operations =============

export async function createOrderFill(fill: Omit<DBOrderFill, 'id' | 'createdAt'>): Promise<DBOrderFill> {
  await initTradingDatabase();

  const dbFill: DBOrderFill = {
    ...fill,
    id: `fill_${fill.orderId}_${fill.tradeId}`,
    createdAt: new Date().toISOString(),
  };

  stores.orderFills.set(dbFill.id, dbFill);
  await persistStore('orderFills');
  return dbFill;
}

export async function listOrderFills(orderId: number): Promise<DBOrderFill[]> {
  await initTradingDatabase();
  return Array.from(stores.orderFills.values())
    .filter(f => f.orderId === orderId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

// ============= Quote Cache Operations =============

export async function cacheQuote(quote: Omit<DBQuoteCache, 'id' | 'createdAt'>): Promise<DBQuoteCache> {
  await initTradingDatabase();

  const dbQuote: DBQuoteCache = {
    ...quote,
    id: `quote_${quote.symbol}_${Date.now()}`,
    createdAt: new Date().toISOString(),
  };

  stores.quoteCache.set(dbQuote.id, dbQuote);

  // Clean expired quotes
  const now = new Date();
  for (const [id, cached] of stores.quoteCache.entries()) {
    if (new Date(cached.expiresAt) < now) {
      stores.quoteCache.delete(id);
    }
  }

  await persistStore('quoteCache');
  return dbQuote;
}

export async function getLatestQuote(symbol: string): Promise<DBQuoteCache | undefined> {
  await initTradingDatabase();

  const now = new Date();
  const quotes = Array.from(stores.quoteCache.values())
    .filter(q => q.symbol === symbol && new Date(q.expiresAt) > now)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return quotes[0];
}

// ============= Statistics =============

export async function getOrderStats(walletAddress?: string): Promise<{
  totalOrders: number;
  openOrders: number;
  filledOrders: number;
  cancelledOrders: number;
  totalTrades: number;
  totalVolume: string;
}> {
  await initTradingDatabase();

  let orders = Array.from(stores.orders.values());
  let trades = Array.from(stores.trades.values());

  if (walletAddress) {
    orders = orders.filter(o => o.walletAddress === walletAddress);
    trades = trades.filter(t => t.walletAddress === walletAddress);
  }

  const totalVolume = trades.reduce((sum, t) => sum + parseFloat(t.quoteQty || '0'), 0);

  return {
    totalOrders: orders.length,
    openOrders: orders.filter(o => o.status === 'NEW' || o.status === 'PARTIALLY_FILLED').length,
    filledOrders: orders.filter(o => o.status === 'FILLED').length,
    cancelledOrders: orders.filter(o => o.status === 'CANCELED').length,
    totalTrades: trades.length,
    totalVolume: totalVolume.toFixed(2),
  };
}

// ============= Export all =============

export default {
  initTradingDatabase,
  getNextOrderId,
  getNextTradeId,
  createOrder,
  getOrder,
  getOrderByClientId,
  updateOrder,
  listOrders,
  listOpenOrders,
  createTrade,
  getTrade,
  listTrades,
  createOrderFill,
  listOrderFills,
  cacheQuote,
  getLatestQuote,
  getOrderStats,
};
