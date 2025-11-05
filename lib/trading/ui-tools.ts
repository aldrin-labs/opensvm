/**
 * UI Tool Wrappers for AI Agent
 * Provides programmatic access to trading terminal UI components
 */

import { EventEmitter } from 'events';

// Tool result interfaces
export interface ChartAnalysisResult {
  currentPrice: number;
  trend: 'bullish' | 'bearish' | 'neutral';
  support: number[];
  resistance: number[];
  patterns: string[];
  indicators: {
    rsi?: number;
    macd?: { value: number; signal: number; histogram: number };
    volume?: number;
    volatility?: number;
  };
  priceAction: {
    high24h: number;
    low24h: number;
    change24h: number;
    changePercent24h: number;
  };
}

export interface OrderBookAnalysisResult {
  spread: number;
  spreadPercent: number;
  bidDepth: number;
  askDepth: number;
  imbalance: 'bullish' | 'bearish' | 'neutral';
  topBids: Array<{ price: number; amount: number; total: number }>;
  topAsks: Array<{ price: number; amount: number; total: number }>;
  liquidityZones: Array<{ price: number; volume: number; side: 'bid' | 'ask' }>;
}

export interface TradeAnalysisResult {
  recentTrades: Array<{
    price: number;
    amount: number;
    side: 'buy' | 'sell';
    timestamp: number;
  }>;
  buyVolume: number;
  sellVolume: number;
  volumeRatio: number;
  avgPrice: number;
  momentum: 'positive' | 'negative' | 'neutral';
  largeOrders: Array<{ price: number; amount: number; side: 'buy' | 'sell' }>;
}

export interface MarketSearchResult {
  markets: Array<{
    symbol: string;
    baseToken: string;
    quoteToken: string;
    price: number;
    volume24h: number;
    change24h: number;
  }>;
  selected?: string;
}

export interface OrderExecutionResult {
  orderId: string;
  status: 'pending' | 'filled' | 'partial' | 'cancelled' | 'failed';
  type: 'market' | 'limit';
  side: 'buy' | 'sell';
  amount: number;
  price?: number;
  executedAmount?: number;
  executedPrice?: number;
  timestamp: number;
}

export interface PositionInfo {
  symbol: string;
  side: 'long' | 'short';
  amount: number;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
  stopLoss?: number;
  takeProfit?: number;
}

/**
 * Base UI Tool class
 */
abstract class UITool extends EventEmitter {
  protected elementId: string;
  protected isHighlighted: boolean = false;
  
  constructor(elementId: string) {
    super();
    this.elementId = elementId;
  }
  
  /**
   * Highlight the UI element with animation
   */
  public highlight(type: 'analyzing' | 'executing' | 'success' | 'error' = 'analyzing', duration: number = 2000): void {
    const element = this.getElement();
    if (!element) return;
    
    // Map highlight types to CSS classes
    const classMap = {
      analyzing: 'agent-highlight',
      executing: 'agent-executing',
      success: 'agent-success',
      error: 'agent-error'
    };
    
    // Add the appropriate CSS class
    const cssClass = classMap[type];
    element.classList.add(cssClass);
    
    this.isHighlighted = true;
    this.emit('highlighted', { elementId: this.elementId, type });
    
    // Remove highlight after duration
    setTimeout(() => {
      element.classList.remove(cssClass);
      this.isHighlighted = false;
      this.emit('unhighlighted', { elementId: this.elementId });
    }, duration);
  }
  
  /**
   * Add scanning animation
   */
  public addScanningEffect(): void {
    const element = this.getElement();
    if (element) {
      element.classList.add('agent-scanning');
      this.emit('scanningStarted', { elementId: this.elementId });
    }
  }
  
  /**
   * Remove scanning animation
   */
  public removeScanningEffect(): void {
    const element = this.getElement();
    if (element) {
      element.classList.remove('agent-scanning');
      this.emit('scanningStopped', { elementId: this.elementId });
    }
  }
  
  /**
   * Add focus ring
   */
  public addFocusRing(): void {
    const element = this.getElement();
    if (element) {
      element.classList.add('agent-focus');
    }
  }
  
  /**
   * Remove focus ring
   */
  public removeFocusRing(): void {
    const element = this.getElement();
    if (element) {
      element.classList.remove('agent-focus');
    }
  }
  
  /**
   * Add thought bubble
   */
  public showThought(message: string, duration: number = 3000): void {
    const element = this.getElement();
    if (!element) return;
    
    // Create thought bubble element
    const bubble = document.createElement('div');
    bubble.className = 'agent-thought-bubble';
    bubble.textContent = message;
    
    // Position relative to element
    element.style.position = 'relative';
    element.appendChild(bubble);
    
    // Remove after duration
    setTimeout(() => {
      bubble.remove();
    }, duration);
  }
  
  /**
   * Scroll element into view
   */
  public scrollIntoView(): void {
    const element = this.getElement();
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
  
  /**
   * Get the DOM element
   */
  protected getElement(): HTMLElement | null {
    if (typeof document === 'undefined') return null;
    
    // First try data-tile-id
    let element = document.querySelector(`[data-tile-id="${this.elementId}"]`) as HTMLElement;
    
    // Fallback to data-ai-widget for compatibility
    if (!element) {
      element = document.querySelector(`[data-ai-widget*="${this.elementId}"]`) as HTMLElement;
    }
    
    // Final fallback to class-based selection
    if (!element) {
      const classMap: Record<string, string> = {
        'chart': '.chart-section',
        'orderbook': '.orderbook-section',
        'trades': '.trades-section',
        'positions': '.positions-section',
        'controls': '[data-ai-widget="trading-controls"]',
        'screener': '[data-ai-widget="market-screener"]',
        'aichat': '.ai-chat-section'
      };
      element = document.querySelector(classMap[this.elementId]) as HTMLElement;
    }
    
    return element;
  }
  
  /**
   * Simulate user interaction
   */
  protected simulateClick(selector: string): void {
    const element = this.getElement();
    if (!element) return;
    
    const target = element.querySelector(selector) as HTMLElement;
    if (target) {
      target.click();
      this.emit('interaction', { type: 'click', selector });
    }
  }
  
  /**
   * Extract data from element
   */
  protected extractData(selector: string): string | null {
    const element = this.getElement();
    if (!element) return null;
    
    const target = element.querySelector(selector) as HTMLElement;
    return target ? target.textContent : null;
  }
}

/**
 * Chart Analysis Tool
 */
export class ChartTool extends UITool {
  constructor() {
    super('chart');
  }
  
  /**
   * Analyze chart data
   */
  public async analyze(): Promise<ChartAnalysisResult> {
    this.highlight('analyzing');
    this.scrollIntoView();
    this.showThought('Analyzing chart patterns...');
    
    // Simulate chart analysis
    await this.wait(1000);
    
    // In real implementation, this would extract actual chart data
    const result: ChartAnalysisResult = {
      currentPrice: 148.75,
      trend: 'bullish',
      support: [145.50, 142.00, 138.25],
      resistance: [152.30, 155.00, 158.50],
      patterns: ['ascending_triangle', 'bullish_flag'],
      indicators: {
        rsi: 62,
        macd: { value: 0.45, signal: 0.32, histogram: 0.13 },
        volume: 2500000,
        volatility: 0.025
      },
      priceAction: {
        high24h: 151.20,
        low24h: 145.30,
        change24h: 3.45,
        changePercent24h: 2.37
      }
    };
    
    this.emit('analyzed', result);
    return result;
  }
  
  /**
   * Change timeframe
   */
  public changeTimeframe(timeframe: '1m' | '5m' | '15m' | '1h' | '4h' | '1d'): void {
    // Simulate clicking timeframe button
    this.simulateClick(`[data-timeframe="${timeframe}"]`);
    this.emit('timeframeChanged', timeframe);
  }
  
  /**
   * Add indicator
   */
  public addIndicator(indicator: string): void {
    this.emit('indicatorAdded', indicator);
  }
  
  /**
   * Draw annotation
   */
  public drawAnnotation(type: 'line' | 'arrow' | 'text', params: any): void {
    this.emit('annotationDrawn', { type, params });
  }
  
  private wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Order Book Tool
 */
export class OrderBookTool extends UITool {
  constructor() {
    super('orderbook');
  }
  
  /**
   * Analyze order book
   */
  public async analyze(): Promise<OrderBookAnalysisResult> {
    this.highlight('analyzing');
    this.scrollIntoView();
    this.showThought('Checking order flow...');
    
    await this.wait(500);
    
    const result: OrderBookAnalysisResult = {
      spread: 0.05,
      spreadPercent: 0.034,
      bidDepth: 50000,
      askDepth: 45000,
      imbalance: 'bullish',
      topBids: [
        { price: 148.70, amount: 500, total: 74350 },
        { price: 148.65, amount: 750, total: 111487.5 },
        { price: 148.60, amount: 1000, total: 148600 }
      ],
      topAsks: [
        { price: 148.75, amount: 450, total: 66937.5 },
        { price: 148.80, amount: 600, total: 89280 },
        { price: 148.85, amount: 800, total: 119080 }
      ],
      liquidityZones: [
        { price: 148.50, volume: 5000, side: 'bid' },
        { price: 149.00, volume: 4500, side: 'ask' }
      ]
    };
    
    this.emit('analyzed', result);
    return result;
  }
  
  /**
   * Monitor spread changes
   */
  public monitorSpread(callback: (spread: number) => void): void {
    const interval = setInterval(() => {
      const spread = Math.random() * 0.1; // Simulated
      callback(spread);
    }, 1000);
    
    this.emit('monitoringStarted', { type: 'spread' });
    
    // Store interval for cleanup
    this.on('stopMonitoring', () => clearInterval(interval));
  }
  
  private wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Trade History Tool
 */
export class TradesTool extends UITool {
  constructor() {
    super('trades');
  }
  
  /**
   * Analyze recent trades
   */
  public async analyze(limit: number = 50): Promise<TradeAnalysisResult> {
    this.highlight('analyzing');
    this.scrollIntoView();
    this.showThought('Examining trade flow...');
    
    await this.wait(500);
    
    // Generate simulated trades
    const trades = this.generateSimulatedTrades(limit);
    
    const buyVolume = trades
      .filter(t => t.side === 'buy')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const sellVolume = trades
      .filter(t => t.side === 'sell')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const avgPrice = trades.reduce((sum, t) => sum + t.price, 0) / trades.length;
    
    const result: TradeAnalysisResult = {
      recentTrades: trades.slice(0, 10),
      buyVolume,
      sellVolume,
      volumeRatio: buyVolume / (buyVolume + sellVolume),
      avgPrice,
      momentum: buyVolume > sellVolume ? 'positive' : 'negative',
      largeOrders: trades
        .filter(t => t.amount > 100)
        .slice(0, 5)
        .map(t => ({ price: t.price, amount: t.amount, side: t.side }))
    };
    
    this.emit('analyzed', result);
    return result;
  }
  
  private generateSimulatedTrades(limit: number): Array<{
    price: number;
    amount: number;
    side: 'buy' | 'sell';
    timestamp: number;
  }> {
    const trades: Array<{
      price: number;
      amount: number;
      side: 'buy' | 'sell';
      timestamp: number;
    }> = [];
    const basePrice = 148.75;
    const now = Date.now();
    
    for (let i = 0; i < limit; i++) {
      trades.push({
        price: basePrice + (Math.random() - 0.5) * 2,
        amount: Math.random() * 200,
        side: Math.random() > 0.5 ? 'buy' : 'sell' as 'buy' | 'sell',
        timestamp: now - i * 1000
      });
    }
    
    return trades;
  }
  
  private wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Market Screener Tool
 */
export class MarketScreenerTool extends UITool {
  constructor() {
    super('screener');
  }
  
  /**
   * Search markets
   */
  public async search(query: string): Promise<MarketSearchResult> {
    this.highlight('analyzing');
    this.scrollIntoView();
    this.showThought(`Searching for ${query}...`);
    
    // Simulate typing in search
    await this.wait(300);
    
    const result: MarketSearchResult = {
      markets: [
        {
          symbol: 'SOL/USDC',
          baseToken: 'SOL',
          quoteToken: 'USDC',
          price: 148.75,
          volume24h: 5000000,
          change24h: 2.37
        },
        {
          symbol: 'SOL/USDT',
          baseToken: 'SOL',
          quoteToken: 'USDT',
          price: 148.80,
          volume24h: 3000000,
          change24h: 2.41
        }
      ],
      selected: query
    };
    
    this.emit('searched', result);
    return result;
  }
  
  /**
   * Select market
   */
  public selectMarket(symbol: string): void {
    this.simulateClick(`[data-market="${symbol}"]`);
    this.emit('marketSelected', symbol);
  }
  
  private wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Trading Controls Tool
 */
export class TradingControlsTool extends UITool {
  constructor() {
    super('controls');
  }
  
  /**
   * Place an order using the real execution API
   */
  public async placeOrder(params: {
    type: 'market' | 'limit';
    side: 'buy' | 'sell';
    amount: number;
    price?: number;
    market?: string;
    stopLoss?: number;
    takeProfit?: number;
  }): Promise<OrderExecutionResult> {
    this.highlight('executing');
    this.scrollIntoView();
    this.showThought(`Placing ${params.side} order...`);
    
    try {
      // Call the real execution API
      const response = await fetch('/api/trading/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: params.type,
          side: params.side,
          amount: params.amount,
          price: params.price,
          market: params.market || 'SOL/USDC',
          stopLoss: params.stopLoss,
          takeProfit: params.takeProfit
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Order execution failed');
      }
      
      const result = await response.json();
      
      // Update UI based on order status
      if (result.status === 'filled') {
        this.highlight('success', 2000);
        this.showThought(`Order filled at $${result.executedPrice?.toFixed(2)}!`);
      } else if (result.status === 'pending') {
        this.showThought('Order pending...');
      } else if (result.status === 'failed') {
        this.highlight('error', 2000);
        this.showThought('Order failed!');
      }
      
      this.emit('orderPlaced', result);
      return result;
      
    } catch (error) {
      console.error('Order placement error:', error);
      this.highlight('error', 2000);
      this.showThought('Failed to place order');
      
      // Return error result
      return {
        orderId: `error-${Date.now()}`,
        status: 'failed',
        type: params.type,
        side: params.side,
        amount: params.amount,
        price: params.price,
        timestamp: Date.now()
      };
    }
  }
  
  /**
   * Cancel an order using the real API
   */
  public async cancelOrder(orderId: string): Promise<boolean> {
    try {
      const response = await fetch(`/api/trading/execute?orderId=${orderId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to cancel order');
      }
      
      const result = await response.json();
      this.emit('orderCancelled', orderId);
      return result.success;
      
    } catch (error) {
      console.error('Order cancellation error:', error);
      return false;
    }
  }
  
  /**
   * Set stop loss
   */
  public setStopLoss(price: number): void {
    this.emit('stopLossSet', price);
  }
  
  /**
   * Set take profit
   */
  public setTakeProfit(price: number): void {
    this.emit('takeProfitSet', price);
  }
  
  private wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Positions Panel Tool
 */
export class PositionsTool extends UITool {
  constructor() {
    super('positions');
  }
  
  /**
   * Get current positions from real API
   */
  public async getPositions(status?: 'open' | 'closed'): Promise<PositionInfo[]> {
    this.highlight('analyzing');
    this.scrollIntoView();
    this.showThought('Checking positions...');
    
    try {
      const url = status 
        ? `/api/trading/positions?status=${status}`
        : '/api/trading/positions';
        
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Failed to fetch positions');
      }
      
      const data = await response.json();
      
      // Transform API response to PositionInfo format
      const positions: PositionInfo[] = data.positions.map((p: any) => ({
        symbol: p.symbol,
        side: p.side as 'long' | 'short',
        amount: p.amount,
        entryPrice: p.entryPrice,
        currentPrice: p.currentPrice,
        pnl: p.pnl,
        pnlPercent: p.pnlPercent,
        stopLoss: p.stopLoss,
        takeProfit: p.takeProfit
      }));
      
      // Show summary in thought bubble
      if (data.summary) {
        this.showThought(
          `${data.summary.openPositions} open positions, PnL: $${data.summary.totalPnL.toFixed(2)}`
        );
      }
      
      this.emit('positionsRetrieved', positions);
      return positions;
      
    } catch (error) {
      console.error('Error fetching positions:', error);
      
      // Return empty array on error
      this.highlight('error', 2000);
      this.showThought('Failed to load positions');
      return [];
    }
  }
  
  /**
   * Close a position using real API
   */
  public async closePosition(positionId: string): Promise<boolean> {
    this.highlight('executing');
    this.showThought('Closing position...');
    
    try {
      const response = await fetch(`/api/trading/positions?id=${positionId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to close position');
      }
      
      const result = await response.json();
      
      if (result.success) {
        this.highlight('success', 2000);
        this.showThought(
          `Position closed! PnL: $${result.finalPnL?.toFixed(2)} (${result.finalPnLPercent?.toFixed(2)}%)`
        );
        this.emit('positionClosed', positionId);
        return true;
      }
      
      return false;
      
    } catch (error) {
      console.error('Error closing position:', error);
      this.highlight('error', 2000);
      this.showThought('Failed to close position');
      return false;
    }
  }
  
  /**
   * Modify position using real API
   */
  public async modifyPosition(
    positionId: string, 
    updates: Partial<PositionInfo>
  ): Promise<boolean> {
    try {
      const response = await fetch(`/api/trading/positions?id=${positionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      
      if (!response.ok) {
        throw new Error('Failed to modify position');
      }
      
      const result = await response.json();
      
      if (result.success) {
        this.emit('positionModified', { positionId, updates });
        
        if (result.triggered) {
          this.showThought(`${result.triggered} triggered!`);
        }
        
        return true;
      }
      
      return false;
      
    } catch (error) {
      console.error('Error modifying position:', error);
      return false;
    }
  }
  
  /**
   * Create a new position
   */
  public async createPosition(position: {
    symbol: string;
    side: 'long' | 'short';
    amount: number;
    entryPrice: number;
    stopLoss?: number;
    takeProfit?: number;
  }): Promise<string | null> {
    try {
      const response = await fetch('/api/trading/positions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(position)
      });
      
      if (!response.ok) {
        throw new Error('Failed to create position');
      }
      
      const result = await response.json();
      
      if (result.success) {
        this.emit('positionCreated', result.position);
        return result.position.id;
      }
      
      return null;
      
    } catch (error) {
      console.error('Error creating position:', error);
      return null;
    }
  }
  
  private wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * UI Tools Manager
 * Manages all UI tools and coordinates between them
 */
export class UIToolsManager {
  private tools: Map<string, UITool>;
  
  constructor() {
    this.tools = new Map();
    this.initializeTools();
  }
  
  /**
   * Initialize all tools
   */
  private initializeTools(): void {
    this.tools.set('chart', new ChartTool());
    this.tools.set('orderbook', new OrderBookTool());
    this.tools.set('trades', new TradesTool());
    this.tools.set('screener', new MarketScreenerTool());
    this.tools.set('controls', new TradingControlsTool());
    this.tools.set('positions', new PositionsTool());
  }
  
  /**
   * Get a specific tool
   */
  public getTool<T extends UITool>(name: string): T | undefined {
    return this.tools.get(name) as T;
  }
  
  /**
   * Get chart tool
   */
  public get chart(): ChartTool {
    return this.tools.get('chart') as ChartTool;
  }
  
  /**
   * Get order book tool
   */
  public get orderBook(): OrderBookTool {
    return this.tools.get('orderbook') as OrderBookTool;
  }
  
  /**
   * Get trades tool
   */
  public get trades(): TradesTool {
    return this.tools.get('trades') as TradesTool;
  }
  
  /**
   * Get market screener tool
   */
  public get screener(): MarketScreenerTool {
    return this.tools.get('screener') as MarketScreenerTool;
  }
  
  /**
   * Get trading controls tool
   */
  public get controls(): TradingControlsTool {
    return this.tools.get('controls') as TradingControlsTool;
  }
  
  /**
   * Get positions tool
   */
  public get positions(): PositionsTool {
    return this.tools.get('positions') as PositionsTool;
  }
  
  /**
   * Highlight multiple tools in sequence
   */
  public async highlightSequence(
    tools: string[], 
    type: 'analyzing' | 'executing' | 'success' | 'error' = 'analyzing', 
    duration: number = 1000
  ): Promise<void> {
    for (const toolName of tools) {
      const tool = this.tools.get(toolName);
      if (tool) {
        tool.highlight(type, duration);
        await this.wait(duration + 500);
      }
    }
  }
  
  /**
   * Perform comprehensive market analysis
   */
  public async performMarketAnalysis(): Promise<{
    chart: ChartAnalysisResult;
    orderBook: OrderBookAnalysisResult;
    trades: TradeAnalysisResult;
  }> {
    // Highlight and analyze each component
    const chartAnalysis = await this.chart.analyze();
    await this.wait(500);
    
    const orderBookAnalysis = await this.orderBook.analyze();
    await this.wait(500);
    
    const tradesAnalysis = await this.trades.analyze();
    
    return {
      chart: chartAnalysis,
      orderBook: orderBookAnalysis,
      trades: tradesAnalysis
    };
  }
  
  private wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const uiToolsManager = new UIToolsManager();
