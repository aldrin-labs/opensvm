// Order Management System for Binance-compatible API
// Handles order lifecycle, persistence, and wallet integration

import { Connection, PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';
import {
  OrderResponse,
  OrderStatus,
  OrderType,
  OrderSide,
  TimeInForce,
  Fill,
  NewOrderRequest,
  Balance,
} from './binance-types';
import { DexAggregator, DexQuote, ExecutionResult } from './dex-aggregator';
import * as db from './database';

// Internal order representation (extends DB order with runtime data)
interface InternalOrder {
  orderId: number;
  clientOrderId: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  timeInForce: TimeInForce;
  origQty: string;
  price: string;
  stopPrice?: string;
  executedQty: string;
  cummulativeQuoteQty: string;
  status: OrderStatus;
  fills: Fill[];
  transactTime: number;
  createTime: number;
  updateTime: number;
  walletAddress: string;
  txSignature?: string;
  quote?: DexQuote;
  slippageBps: number;
}

// Order book for limit orders
interface OrderBookLevel {
  price: number;
  quantity: number;
  orders: InternalOrder[];
}

// Trade history entry
interface TradeEntry {
  id: number;
  orderId: number;
  symbol: string;
  price: string;
  qty: string;
  quoteQty: string;
  commission: string;
  commissionAsset: string;
  time: number;
  isBuyer: boolean;
  isMaker: boolean;
  isBestMatch: boolean;
}

export class OrderManager {
  private connection: Connection;
  private aggregator: DexAggregator;
  private initialized = false;

  // In-memory caches (synced with DB)
  private orders: Map<number, InternalOrder> = new Map();
  private ordersByClient: Map<string, number> = new Map();
  private ordersByWallet: Map<string, Set<number>> = new Map();
  private openOrders: Map<string, Set<number>> = new Map();
  private trades: TradeEntry[] = [];

  // Order books for limit orders (symbol -> side -> levels)
  private orderBooks: Map<string, { bids: OrderBookLevel[]; asks: OrderBookLevel[] }> = new Map();

  constructor(connection: Connection, aggregator: DexAggregator) {
    this.connection = connection;
    this.aggregator = aggregator;
  }

  // Initialize and load from database
  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    await db.initTradingDatabase();

    // Load orders from database
    const dbOrders = await db.listOrders({ limit: 10000 });
    for (const dbOrder of dbOrders) {
      const order = this.dbOrderToInternal(dbOrder);
      this.orders.set(order.orderId, order);
      this.ordersByClient.set(order.clientOrderId, order.orderId);

      if (order.walletAddress) {
        if (!this.ordersByWallet.has(order.walletAddress)) {
          this.ordersByWallet.set(order.walletAddress, new Set());
        }
        this.ordersByWallet.get(order.walletAddress)!.add(order.orderId);
      }

      if (order.status === 'NEW' || order.status === 'PARTIALLY_FILLED') {
        if (!this.openOrders.has(order.symbol)) {
          this.openOrders.set(order.symbol, new Set());
        }
        this.openOrders.get(order.symbol)!.add(order.orderId);
      }
    }

    // Load trades from database
    const dbTrades = await db.listTrades({ limit: 10000 });
    this.trades = dbTrades.map(t => ({
      id: t.tradeId,
      orderId: t.orderId,
      symbol: t.symbol,
      price: t.price,
      qty: t.qty,
      quoteQty: t.quoteQty,
      commission: t.commission,
      commissionAsset: t.commissionAsset,
      time: new Date(t.createdAt).getTime(),
      isBuyer: t.isBuyer,
      isMaker: t.isMaker,
      isBestMatch: true,
    }));

    this.initialized = true;
    console.log(`OrderManager initialized: ${this.orders.size} orders, ${this.trades.length} trades`);
  }

  // Convert DB order to internal format
  private dbOrderToInternal(dbOrder: db.DBOrder): InternalOrder {
    return {
      orderId: dbOrder.orderId,
      clientOrderId: dbOrder.clientOrderId,
      symbol: dbOrder.symbol,
      side: dbOrder.side,
      type: dbOrder.type as OrderType,
      timeInForce: dbOrder.timeInForce as TimeInForce,
      origQty: dbOrder.origQty,
      price: dbOrder.price,
      stopPrice: dbOrder.stopPrice,
      executedQty: dbOrder.executedQty,
      cummulativeQuoteQty: dbOrder.cummulativeQuoteQty,
      status: dbOrder.status,
      fills: [],
      transactTime: new Date(dbOrder.updatedAt).getTime(),
      createTime: new Date(dbOrder.createdAt).getTime(),
      updateTime: new Date(dbOrder.updatedAt).getTime(),
      walletAddress: dbOrder.walletAddress,
      txSignature: dbOrder.txSignature,
      slippageBps: dbOrder.slippageBps,
    };
  }

  // Create a new order
  async createOrder(
    request: NewOrderRequest,
    signTransaction?: (tx: Transaction | VersionedTransaction) => Promise<Transaction | VersionedTransaction>
  ): Promise<OrderResponse> {
    await this.ensureInitialized();

    const orderId = db.getNextOrderId();
    const clientOrderId = request.newClientOrderId || `order_${orderId}_${Date.now()}`;
    const now = Date.now();

    // Parse symbol (e.g., "SOLUSDC" -> base: SOL, quote: USDC)
    const { baseAsset, quoteAsset } = this.parseSymbol(request.symbol);

    // Create internal order
    const order: InternalOrder = {
      orderId,
      clientOrderId,
      symbol: request.symbol,
      side: request.side,
      type: request.type,
      timeInForce: request.timeInForce || 'GTC',
      origQty: request.quantity,
      price: request.price || '0',
      stopPrice: request.stopPrice,
      executedQty: '0',
      cummulativeQuoteQty: '0',
      status: 'NEW',
      fills: [],
      transactTime: now,
      createTime: now,
      updateTime: now,
      walletAddress: request.walletAddress || '',
      slippageBps: request.slippageBps || 50,
    };

    // Save to database
    await db.createOrder({
      orderId: order.orderId,
      clientOrderId: order.clientOrderId,
      symbol: order.symbol,
      side: order.side,
      type: order.type,
      timeInForce: order.timeInForce,
      status: order.status,
      price: order.price,
      origQty: order.origQty,
      executedQty: order.executedQty,
      cummulativeQuoteQty: order.cummulativeQuoteQty,
      stopPrice: order.stopPrice,
      walletAddress: order.walletAddress,
      slippageBps: order.slippageBps,
    });

    // Store in memory
    this.orders.set(orderId, order);
    this.ordersByClient.set(clientOrderId, orderId);

    if (request.walletAddress) {
      if (!this.ordersByWallet.has(request.walletAddress)) {
        this.ordersByWallet.set(request.walletAddress, new Set());
      }
      this.ordersByWallet.get(request.walletAddress)!.add(orderId);
    }

    // Handle different order types
    let executionResult: ExecutionResult | null = null;

    if (request.type === 'MARKET') {
      executionResult = await this.executeMarketOrder(order, baseAsset, quoteAsset, signTransaction);
    } else if (request.type === 'LIMIT') {
      executionResult = await this.processLimitOrder(order, baseAsset, quoteAsset, signTransaction);
    } else if (request.type === 'LIMIT_MAKER') {
      await this.addToOrderBook(order);
    }

    // Update order status based on execution
    if (executionResult) {
      await this.updateOrderFromExecution(order, executionResult);
    }

    // Track open orders
    if (order.status === 'NEW' || order.status === 'PARTIALLY_FILLED') {
      if (!this.openOrders.has(request.symbol)) {
        this.openOrders.set(request.symbol, new Set());
      }
      this.openOrders.get(request.symbol)!.add(orderId);
    }

    return this.toOrderResponse(order, request.newOrderRespType || 'FULL');
  }

  // Execute a market order through DEX aggregator
  private async executeMarketOrder(
    order: InternalOrder,
    baseAsset: string,
    quoteAsset: string,
    signTransaction?: (tx: Transaction | VersionedTransaction) => Promise<Transaction | VersionedTransaction>
  ): Promise<ExecutionResult> {
    try {
      const inputToken = order.side === 'BUY' ? quoteAsset : baseAsset;
      const outputToken = order.side === 'BUY' ? baseAsset : quoteAsset;

      const { quote } = await this.aggregator.getBestRoute(
        inputToken,
        outputToken,
        parseFloat(order.origQty),
        order.slippageBps
      );

      order.quote = quote;

      if (signTransaction && order.walletAddress) {
        return await this.aggregator.executeSwap(quote, signTransaction, order.walletAddress);
      }

      return {
        success: true,
        inputAmount: quote.inputAmount,
        outputAmount: quote.outputAmount,
        executedPrice: Number(quote.outputAmount) / Number(quote.inputAmount),
        priceImpact: quote.priceImpact,
        fees: {
          network: quote.estimatedGas,
          protocol: quote.fee,
          total: quote.estimatedGas + quote.fee,
        },
        route: quote.route,
      };
    } catch (error) {
      return {
        success: false,
        inputAmount: '0',
        outputAmount: '0',
        executedPrice: 0,
        priceImpact: 0,
        fees: { network: 0, protocol: 0, total: 0 },
        route: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Process a limit order
  private async processLimitOrder(
    order: InternalOrder,
    baseAsset: string,
    quoteAsset: string,
    signTransaction?: (tx: Transaction | VersionedTransaction) => Promise<Transaction | VersionedTransaction>
  ): Promise<ExecutionResult | null> {
    const limitPrice = parseFloat(order.price);
    const currentPrice = await this.aggregator.getPrice(baseAsset, quoteAsset);

    const canFillAtMarket =
      (order.side === 'BUY' && currentPrice <= limitPrice) ||
      (order.side === 'SELL' && currentPrice >= limitPrice);

    if (canFillAtMarket) {
      return this.executeMarketOrder(order, baseAsset, quoteAsset, signTransaction);
    }

    await this.addToOrderBook(order);
    return null;
  }

  // Add order to internal order book
  private async addToOrderBook(order: InternalOrder): Promise<void> {
    if (!this.orderBooks.has(order.symbol)) {
      this.orderBooks.set(order.symbol, { bids: [], asks: [] });
    }

    const book = this.orderBooks.get(order.symbol)!;
    const side = order.side === 'BUY' ? 'bids' : 'asks';
    const price = parseFloat(order.price);
    const quantity = parseFloat(order.origQty);

    let level = book[side].find(l => l.price === price);
    if (!level) {
      level = { price, quantity: 0, orders: [] };
      book[side].push(level);

      if (side === 'bids') {
        book.bids.sort((a, b) => b.price - a.price);
      } else {
        book.asks.sort((a, b) => a.price - b.price);
      }
    }

    level.quantity += quantity;
    level.orders.push(order);
  }

  // Update order from execution result
  private async updateOrderFromExecution(order: InternalOrder, result: ExecutionResult): Promise<void> {
    const now = Date.now();

    if (result.success) {
      const executedQty = order.side === 'BUY' ? result.outputAmount : result.inputAmount;
      const quoteQty = order.side === 'BUY' ? result.inputAmount : result.outputAmount;

      order.executedQty = executedQty;
      order.cummulativeQuoteQty = quoteQty;
      order.txSignature = result.txSignature;

      const origQty = parseFloat(order.origQty);
      const execQty = parseFloat(executedQty);

      if (execQty >= origQty * 0.99) {
        order.status = 'FILLED';
      } else if (execQty > 0) {
        order.status = 'PARTIALLY_FILLED';
      }

      // Create fill and trade records
      const tradeId = db.getNextTradeId();
      const fill: Fill = {
        price: result.executedPrice.toString(),
        qty: executedQty,
        commission: result.fees.total.toString(),
        commissionAsset: 'SOL',
        tradeId,
      };
      order.fills.push(fill);

      // Save trade to database
      await db.createTrade({
        tradeId,
        orderId: order.orderId,
        symbol: order.symbol,
        price: fill.price,
        qty: fill.qty,
        quoteQty,
        commission: fill.commission,
        commissionAsset: fill.commissionAsset,
        isBuyer: order.side === 'BUY',
        isMaker: order.type !== 'MARKET',
        walletAddress: order.walletAddress,
        txSignature: result.txSignature,
      });

      // Save fill to database
      await db.createOrderFill({
        orderId: order.orderId,
        tradeId,
        price: fill.price,
        qty: fill.qty,
        commission: fill.commission,
        commissionAsset: fill.commissionAsset,
      });

      // Update in-memory trades
      this.trades.push({
        id: tradeId,
        orderId: order.orderId,
        symbol: order.symbol,
        price: fill.price,
        qty: fill.qty,
        quoteQty,
        commission: fill.commission,
        commissionAsset: fill.commissionAsset,
        time: now,
        isBuyer: order.side === 'BUY',
        isMaker: order.type !== 'MARKET',
        isBestMatch: true,
      });

      if (order.status === 'FILLED') {
        this.openOrders.get(order.symbol)?.delete(order.orderId);
      }
    } else {
      order.status = 'REJECTED';
    }

    order.updateTime = now;
    order.transactTime = now;

    // Update order in database
    await db.updateOrder(order.orderId, {
      status: order.status,
      executedQty: order.executedQty,
      cummulativeQuoteQty: order.cummulativeQuoteQty,
      txSignature: order.txSignature,
    });
  }

  // Cancel an order
  async cancelOrder(
    symbol: string,
    orderId?: number,
    clientOrderId?: string
  ): Promise<OrderResponse | null> {
    await this.ensureInitialized();

    let order: InternalOrder | undefined;

    if (orderId) {
      order = this.orders.get(orderId);
    } else if (clientOrderId) {
      const id = this.ordersByClient.get(clientOrderId);
      if (id) {
        order = this.orders.get(id);
      }
    }

    if (!order || order.symbol !== symbol) {
      return null;
    }

    if (order.status !== 'NEW' && order.status !== 'PARTIALLY_FILLED') {
      return null;
    }

    order.status = 'CANCELED';
    order.updateTime = Date.now();

    // Update in database
    await db.updateOrder(order.orderId, { status: 'CANCELED' });

    this.openOrders.get(symbol)?.delete(order.orderId);
    this.removeFromOrderBook(order);

    return this.toOrderResponse(order, 'FULL');
  }

  // Remove order from order book
  private removeFromOrderBook(order: InternalOrder): void {
    const book = this.orderBooks.get(order.symbol);
    if (!book) return;

    const side = order.side === 'BUY' ? 'bids' : 'asks';
    const price = parseFloat(order.price);

    const levelIndex = book[side].findIndex(l => l.price === price);
    if (levelIndex >= 0) {
      const level = book[side][levelIndex];
      const orderIndex = level.orders.findIndex(o => o.orderId === order.orderId);
      if (orderIndex >= 0) {
        level.quantity -= parseFloat(order.origQty) - parseFloat(order.executedQty);
        level.orders.splice(orderIndex, 1);

        if (level.orders.length === 0) {
          book[side].splice(levelIndex, 1);
        }
      }
    }
  }

  // Get order by ID or client ID
  async getOrder(symbol: string, orderId?: number, clientOrderId?: string): Promise<OrderResponse | null> {
    await this.ensureInitialized();

    let order: InternalOrder | undefined;

    if (orderId) {
      order = this.orders.get(orderId);
    } else if (clientOrderId) {
      const id = this.ordersByClient.get(clientOrderId);
      if (id) {
        order = this.orders.get(id);
      }
    }

    if (!order || order.symbol !== symbol) {
      return null;
    }

    return this.toOrderResponse(order, 'FULL');
  }

  // Get all open orders
  async getOpenOrders(symbol?: string, walletAddress?: string): Promise<OrderResponse[]> {
    await this.ensureInitialized();

    const results: OrderResponse[] = [];

    if (walletAddress) {
      const orderIds = this.ordersByWallet.get(walletAddress);
      if (orderIds) {
        for (const orderId of orderIds) {
          const order = this.orders.get(orderId);
          if (order && (order.status === 'NEW' || order.status === 'PARTIALLY_FILLED')) {
            if (!symbol || order.symbol === symbol) {
              results.push(this.toOrderResponse(order, 'FULL'));
            }
          }
        }
      }
    } else if (symbol) {
      const orderIds = this.openOrders.get(symbol);
      if (orderIds) {
        for (const orderId of orderIds) {
          const order = this.orders.get(orderId);
          if (order && (order.status === 'NEW' || order.status === 'PARTIALLY_FILLED')) {
            results.push(this.toOrderResponse(order, 'FULL'));
          }
        }
      }
    } else {
      for (const [, orderIds] of this.openOrders) {
        for (const orderId of orderIds) {
          const order = this.orders.get(orderId);
          if (order && (order.status === 'NEW' || order.status === 'PARTIALLY_FILLED')) {
            results.push(this.toOrderResponse(order, 'FULL'));
          }
        }
      }
    }

    return results;
  }

  // Get all orders for a symbol
  async getAllOrders(symbol: string, limit: number = 500): Promise<OrderResponse[]> {
    await this.ensureInitialized();

    const results: OrderResponse[] = [];

    for (const [, order] of this.orders) {
      if (order.symbol === symbol) {
        results.push(this.toOrderResponse(order, 'FULL'));
      }
    }

    results.sort((a, b) => b.transactTime - a.transactTime);
    return results.slice(0, limit);
  }

  // Get trade history
  async getMyTrades(symbol: string, limit: number = 500): Promise<TradeEntry[]> {
    await this.ensureInitialized();

    return this.trades
      .filter(t => t.symbol === symbol)
      .sort((a, b) => b.time - a.time)
      .slice(0, limit);
  }

  // Get order book for a symbol
  getOrderBook(symbol: string, limit: number = 100): { bids: [string, string][]; asks: [string, string][] } {
    const book = this.orderBooks.get(symbol);
    if (!book) {
      return { bids: [], asks: [] };
    }

    const formatLevel = (level: OrderBookLevel): [string, string] => [
      level.price.toString(),
      level.quantity.toString(),
    ];

    return {
      bids: book.bids.slice(0, limit).map(formatLevel),
      asks: book.asks.slice(0, limit).map(formatLevel),
    };
  }

  // Parse symbol to base/quote assets
  private parseSymbol(symbol: string): { baseAsset: string; quoteAsset: string } {
    const quoteAssets = ['USDC', 'USDT', 'SOL', 'USD'];

    for (const quote of quoteAssets) {
      if (symbol.endsWith(quote)) {
        return {
          baseAsset: symbol.slice(0, -quote.length),
          quoteAsset: quote,
        };
      }
    }

    return {
      baseAsset: symbol.slice(0, -4),
      quoteAsset: symbol.slice(-4),
    };
  }

  // Convert internal order to response format
  private toOrderResponse(order: InternalOrder, respType: 'ACK' | 'RESULT' | 'FULL'): OrderResponse {
    const base: OrderResponse = {
      symbol: order.symbol,
      orderId: order.orderId,
      orderListId: -1,
      clientOrderId: order.clientOrderId,
      transactTime: order.transactTime,
      price: order.price,
      origQty: order.origQty,
      executedQty: order.executedQty,
      cummulativeQuoteQty: order.cummulativeQuoteQty,
      status: order.status,
      timeInForce: order.timeInForce,
      type: order.type,
      side: order.side,
      txSignature: order.txSignature,
    };

    if (respType === 'FULL') {
      base.fills = order.fills;
      if (order.quote) {
        base.route = order.quote.route.map(r => ({
          dex: r.dex,
          poolAddress: r.poolAddress,
          inputMint: r.inputMint,
          outputMint: r.outputMint,
          inputAmount: r.inputAmount,
          outputAmount: r.outputAmount,
        }));
        base.priceImpact = order.quote.priceImpact.toString();
      }
    }

    return base;
  }

  // Get wallet balances (requires RPC call)
  async getAccountBalances(walletAddress: string): Promise<Balance[]> {
    const balances: Balance[] = [];

    try {
      const publicKey = new PublicKey(walletAddress);

      const solBalance = await this.connection.getBalance(publicKey);
      balances.push({
        asset: 'SOL',
        free: (solBalance / 1e9).toString(),
        locked: '0',
        mint: 'So11111111111111111111111111111111111111112',
      });

      const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(publicKey, {
        programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
      });

      for (const { account } of tokenAccounts.value) {
        const parsed = account.data.parsed;
        if (parsed.type === 'account') {
          const info = parsed.info;
          balances.push({
            asset: info.mint.slice(0, 4).toUpperCase(),
            free: info.tokenAmount.uiAmountString || '0',
            locked: '0',
            mint: info.mint,
          });
        }
      }
    } catch (error) {
      console.error('Failed to fetch balances:', error);
    }

    return balances;
  }

  // Get order statistics
  async getStats(walletAddress?: string): Promise<{
    totalOrders: number;
    openOrders: number;
    filledOrders: number;
    cancelledOrders: number;
    totalTrades: number;
    totalVolume: string;
  }> {
    await this.ensureInitialized();
    return db.getOrderStats(walletAddress);
  }
}

// Singleton instance
let orderManagerInstance: OrderManager | null = null;

export function getOrderManager(connection: Connection, aggregator: DexAggregator): OrderManager {
  if (!orderManagerInstance) {
    orderManagerInstance = new OrderManager(connection, aggregator);
  }
  return orderManagerInstance;
}

export default OrderManager;
