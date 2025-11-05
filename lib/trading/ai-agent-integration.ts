/**
 * AI Agent Integration Layer
 * Connects the AI agent core with UI tools and API endpoints
 */

import { AITradingAgent, AgentAction, ActionType, TradingPlan } from './ai-agent-core';
import { uiToolsManager } from './ui-tools';
import { marketDataClient, MarketData } from './market-data-client';
import type { 
  ChartAnalysisResult, 
  OrderBookAnalysisResult, 
  TradeAnalysisResult,
  OrderExecutionResult 
} from './ui-tools';

/**
 * Enhanced AI Agent with real tool integration
 */
export class IntegratedAIAgent extends AITradingAgent {
  private uiTools = uiToolsManager;
  private apiEndpoint = '/api/getAnswer';
  private tradingApiEndpoint = '/api/trading/chat';
  private marketClient = marketDataClient;
  private currentMarketData: MarketData | null = null;
  
  constructor() {
    super({
      simulationMode: false, // Use real trading when ready
      verbosity: 'detailed',
      riskTolerance: 'moderate'
    });
    
    this.setupToolIntegration();
    this.setupMarketDataConnection();
  }
  
  /**
   * Setup integration with UI tools
   */
  private setupToolIntegration(): void {
    // Override the base action implementations with real ones
    this.on('actionStart', (action: AgentAction) => {
      this.visualizeAction(action);
    });
    
    this.on('actionCompleted', (action: AgentAction) => {
      this.updateUIAfterAction(action);
    });
  }
  
  /**
   * Setup market data connection
   */
  private setupMarketDataConnection(): void {
    // Connect to market data
    this.marketClient.connect();
    
    // Listen for real-time updates
    this.marketClient.on('data', (data: MarketData) => {
      this.currentMarketData = data;
      this.emit('marketDataUpdate', data);
    });
    
    this.marketClient.on('price_update', (priceData) => {
      this.emit('priceUpdate', priceData);
    });
    
    this.marketClient.on('orderbook_update', (orderBookData) => {
      this.emit('orderBookUpdate', orderBookData);
    });
    
    this.marketClient.on('trades_update', (tradesData) => {
      this.emit('tradesUpdate', tradesData);
    });
    
    this.marketClient.on('error', (error) => {
      console.error('Market data error:', error);
      this.emit('marketDataError', error);
    });
  }
  
  /**
   * Visualize action in the UI
   */
  private visualizeAction(action: AgentAction): void {
    if (action.uiTarget) {
      const tool = this.uiTools.getTool(action.uiTarget);
      if (tool) {
        // Map action types to highlight types
        const highlightType = action.type === ActionType.ANALYZE_CHART || 
                            action.type === ActionType.ANALYZE_ORDERBOOK ||
                            action.type === ActionType.ANALYZE_TRADES ? 'analyzing' :
                            action.type === ActionType.PLACE_ORDER ? 'executing' :
                            'analyzing';
        tool.highlight(highlightType, 2000);
      }
    }
  }
  
  /**
   * Update UI after action completion
   */
  private updateUIAfterAction(action: AgentAction): void {
    // Emit UI update events based on action type
    if (action.type === ActionType.PLACE_ORDER && action.result) {
      this.emit('orderPlaced', action.result);
    }
  }
  
  /**
   * Override chart analysis with real implementation
   */
  protected async analyzeChart(params: any): Promise<ChartAnalysisResult> {
    // Get real market data
    const marketData = await this.marketClient.getSnapshot();
    
    // Use the real chart tool
    const chartTool = this.uiTools.chart;
    const uiResult = await chartTool.analyze();
    
    // Merge real market data with UI analysis
    const result: ChartAnalysisResult = {
      ...uiResult,
      currentPrice: marketData.price,
      priceAction: {
        high24h: marketData.high24h,
        low24h: marketData.low24h,
        change24h: marketData.change24h,
        changePercent24h: (marketData.change24h / marketData.price) * 100
      },
      indicators: {
        ...uiResult.indicators,
        volume: marketData.volume24h
      }
    };
    
    // Enhance with AI analysis
    const aiEnhancement = await this.getAIAnalysis('chart', result);
    
    return {
      ...result,
      ...aiEnhancement
    };
  }
  
  /**
   * Override order book analysis with real implementation
   */
  protected async analyzeOrderBook(params: any): Promise<OrderBookAnalysisResult> {
    // Get real market data
    const marketData = await this.marketClient.getSnapshot();
    
    const orderBookTool = this.uiTools.orderBook;
    const uiResult = await orderBookTool.analyze();
    
    // Use real order book data if available
    const result: OrderBookAnalysisResult = marketData.orderBook ? {
      ...uiResult,
      spread: marketData.orderBook.spread,
      spreadPercent: marketData.orderBook.spreadPercent,
      topBids: marketData.orderBook.bids.slice(0, 3).map(b => ({
        price: b.price,
        amount: b.amount,
        total: b.price * b.amount
      })),
      topAsks: marketData.orderBook.asks.slice(0, 3).map(a => ({
        price: a.price,
        amount: a.amount,
        total: a.price * a.amount
      }))
    } : uiResult;
    
    // Enhance with AI insights
    const aiEnhancement = await this.getAIAnalysis('orderbook', result);
    
    return {
      ...result,
      ...aiEnhancement
    };
  }
  
  /**
   * Override trades analysis with real implementation
   */
  protected async analyzeTrades(params: any): Promise<TradeAnalysisResult> {
    // Get real market data
    const marketData = await this.marketClient.getSnapshot();
    
    const tradesTool = this.uiTools.trades;
    const uiResult = await tradesTool.analyze(params.limit || 50);
    
    // Use real trades data if available
    const result: TradeAnalysisResult = marketData.recentTrades ? {
      ...uiResult,
      recentTrades: marketData.recentTrades.slice(0, 10),
      buyVolume: marketData.recentTrades
        .filter(t => t.side === 'buy')
        .reduce((sum, t) => sum + t.amount, 0),
      sellVolume: marketData.recentTrades
        .filter(t => t.side === 'sell')
        .reduce((sum, t) => sum + t.amount, 0),
      avgPrice: marketData.recentTrades
        .reduce((sum, t) => sum + t.price, 0) / marketData.recentTrades.length
    } : uiResult;
    
    // Enhance with AI pattern recognition
    const aiEnhancement = await this.getAIAnalysis('trades', result);
    
    return {
      ...result,
      ...aiEnhancement
    };
  }
  
  /**
   * Override order placement with real implementation
   */
  protected async placeOrder(params: any): Promise<OrderExecutionResult> {
    const controlsTool = this.uiTools.controls;
    
    // Calculate actual price if needed
    if (params.price === 'calculated' || params.price === 'support_level') {
      const chartAnalysis = await this.analyzeChart({});
      params.price = this.calculateOptimalPrice(params, chartAnalysis);
    }
    
    // Place the order through UI controls
    const result = await controlsTool.placeOrder(params);
    
    // Update agent memory
    this.updateContext({
      pendingOrders: [...this.getMemory().context.pendingOrders, result]
    });
    
    return result;
  }
  
  /**
   * Calculate optimal price based on strategy
   */
  private calculateOptimalPrice(params: any, chartAnalysis: ChartAnalysisResult): number {
    const currentPrice = chartAnalysis.currentPrice;
    const marketData = this.currentMarketData;
    
    if (params.side === 'buy') {
      // Use real order book data for optimal pricing
      if (marketData?.orderBook) {
        // Place order at best bid + small premium for quick fill
        const bestBid = marketData.orderBook.bids[0]?.price || currentPrice;
        return bestBid + (marketData.orderBook.spread * 0.1);
      }
      // Fallback: place slightly below current price
      return currentPrice - 0.05;
    } else {
      // For sell orders
      if (marketData?.orderBook) {
        // Place order at best ask - small discount for quick fill
        const bestAsk = marketData.orderBook.asks[0]?.price || currentPrice;
        return bestAsk - (marketData.orderBook.spread * 0.1);
      }
      // Fallback: place slightly above current price
      return currentPrice + 0.05;
    }
  }
  
  /**
   * Get AI-enhanced analysis
   */
  private async getAIAnalysis(type: string, data: any): Promise<any> {
    try {
      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: `Analyze this ${type} data and provide trading insights`,
          context: data
        })
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const result = await response.text();
      return this.parseAIResponse(result);
    } catch (error) {
      console.error('AI analysis error:', error);
      return {};
    }
  }
  
  /**
   * Parse AI response into structured data
   */
  private parseAIResponse(response: string): any {
    // Extract key insights from AI response
    const insights: any = {};
    
    // Look for patterns in the response
    if (response.includes('bullish')) insights.sentiment = 'bullish';
    if (response.includes('bearish')) insights.sentiment = 'bearish';
    if (response.includes('support')) {
      const match = response.match(/support.*?(\d+\.?\d*)/i);
      if (match) insights.supportLevel = parseFloat(match[1]);
    }
    if (response.includes('resistance')) {
      const match = response.match(/resistance.*?(\d+\.?\d*)/i);
      if (match) insights.resistanceLevel = parseFloat(match[1]);
    }
    
    insights.rawAnalysis = response;
    return insights;
  }
  
  /**
   * Generate an enhanced trading plan with AI
   */
  public async generateEnhancedPlan(goal: string): Promise<TradingPlan> {
    // First, get market analysis
    const marketAnalysis = await this.uiTools.performMarketAnalysis();
    
    // Get AI recommendations
    const aiRecommendations = await this.getAIRecommendations(goal, marketAnalysis);
    
    // Generate plan with enhanced context
    const plan = await this.generatePlan(goal, {
      marketAnalysis,
      aiRecommendations
    });
    
    // Add AI reasoning to the plan
    if (aiRecommendations.reasoning) {
      plan.reasoning = [
        ...(plan.reasoning || []),
        ...aiRecommendations.reasoning
      ];
    }
    
    return plan;
  }
  
  /**
   * Get AI trading recommendations
   */
  private async getAIRecommendations(goal: string, marketData: any): Promise<any> {
    try {
      const response = await fetch(this.tradingApiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: goal,
          market: this.getMemory().context.currentMarket,
          walletConnected: true,
          marketData
        })
      });
      
      if (!response.ok) {
        throw new Error(`Trading API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      return {
        recommendation: data.message,
        tradeCommand: data.tradeCommand,
        reasoning: this.extractReasoning(data.message)
      };
    } catch (error) {
      console.error('AI recommendations error:', error);
      return {
        recommendation: 'Unable to get AI recommendations',
        reasoning: ['Proceeding with standard analysis']
      };
    }
  }
  
  /**
   * Extract reasoning from AI message
   */
  private extractReasoning(message: string): string[] {
    const reasoning: string[] = [];
    
    // Split by bullet points or numbered lists
    const lines = message.split('\n');
    for (const line of lines) {
      if (line.match(/^[•\-\*\d\.]/)) {
        reasoning.push(line.replace(/^[•\-\*\d\.]\s*/, '').trim());
      }
    }
    
    return reasoning;
  }
  
  /**
   * Execute plan with real-time UI updates
   */
  public async executeEnhancedPlan(plan: TradingPlan): Promise<void> {
    // Show plan visualization in UI
    this.visualizePlan(plan);
    
    // Execute with enhanced monitoring
    await this.executePlan(plan);
    
    // Show completion summary
    this.showPlanSummary(plan);
  }
  
  /**
   * Visualize the trading plan in UI
   */
  private visualizePlan(plan: TradingPlan): void {
    // Highlight all components that will be used
    const componentsToUse = new Set<string>();
    
    for (const step of plan.steps) {
      if (step.uiTarget) {
        componentsToUse.add(step.uiTarget);
      }
    }
    
    // Highlight them in sequence with success indicator
    this.uiTools.highlightSequence(Array.from(componentsToUse), 'analyzing', 1000);
  }
  
  /**
   * Show plan execution summary
   */
  private showPlanSummary(plan: TradingPlan): void {
    const summary = {
      goal: plan.goal,
      strategy: plan.strategy,
      status: plan.status,
      stepsCompleted: plan.steps.filter(s => s.status === 'completed').length,
      totalSteps: plan.steps.length,
      duration: plan.completedAt ? 
        (plan.completedAt.getTime() - plan.createdAt.getTime()) / 1000 : 0
    };
    
    this.emit('planSummary', summary);
  }
  
  /**
   * Monitor market conditions continuously
   */
  public startMarketMonitoring(callback: (alert: any) => void): void {
    // Monitor order book spread
    this.uiTools.orderBook.monitorSpread((spread: number) => {
      if (spread > 0.1) {
        callback({
          type: 'spread_alert',
          message: `High spread detected: ${spread.toFixed(4)}`,
          severity: 'warning'
        });
      }
    });
    
    // Set up periodic market analysis
    setInterval(async () => {
      const analysis = await this.uiTools.performMarketAnalysis();
      
      // Check for significant changes
      if (analysis.chart.trend === 'bearish' && analysis.trades.momentum === 'negative') {
        callback({
          type: 'market_alert',
          message: 'Bearish market conditions detected',
          severity: 'high',
          data: analysis
        });
      }
    }, 30000); // Every 30 seconds
  }
  
  /**
   * Get current market snapshot
   */
  public async getMarketSnapshot(): Promise<any> {
    // Get real market data
    const marketData = await this.marketClient.getSnapshot();
    
    const [chart, orderBook, trades, positions] = await Promise.all([
      this.analyzeChart({}),
      this.analyzeOrderBook({}),
      this.analyzeTrades({ limit: 50 }),
      this.uiTools.positions.getPositions()
    ]);
    
    return {
      timestamp: Date.now(),
      market: this.getMemory().context.currentMarket,
      realData: marketData,
      chart,
      orderBook,
      trades,
      positions,
      summary: this.generateMarketSummary({ chart, orderBook, trades })
    };
  }
  
  /**
   * Generate market summary
   */
  private generateMarketSummary(data: any): string {
    const { chart, orderBook, trades } = data;
    
    let summary = `Market ${chart.trend} with ${trades.momentum} momentum. `;
    summary += `Price: $${chart.currentPrice.toFixed(2)}, `;
    summary += `Spread: ${orderBook.spreadPercent.toFixed(3)}%, `;
    summary += `Volume ratio: ${(trades.volumeRatio * 100).toFixed(1)}% buy. `;
    
    if (orderBook.imbalance === 'bullish') {
      summary += 'Order book shows buying pressure.';
    } else if (orderBook.imbalance === 'bearish') {
      summary += 'Order book shows selling pressure.';
    }
    
    return summary;
  }
}

// Export singleton instance
export const integratedAgent = new IntegratedAIAgent();

/**
 * Agent Controller for high-level operations
 */
export class AgentController {
  private agent = integratedAgent;
  
  /**
   * Start autonomous trading
   */
  public async startAutonomousTrading(config: {
    strategy: 'scalping' | 'swing' | 'dca';
    riskLevel: 'low' | 'medium' | 'high';
    maxPositions: number;
    stopLossPercent: number;
    takeProfitPercent: number;
  }): Promise<void> {
    // Update agent configuration
    this.agent.updateConfig({
      riskTolerance: config.riskLevel === 'low' ? 'conservative' : 
                     config.riskLevel === 'high' ? 'aggressive' : 'moderate',
      strategies: [config.strategy]
    });
    
    // Start market monitoring
    this.agent.startMarketMonitoring((alert) => {
      console.log('Market Alert:', alert);
      
      // React to alerts
      if (alert.severity === 'high') {
        this.handleHighSeverityAlert(alert);
      }
    });
    
    // Main trading loop
    this.runTradingLoop(config);
  }
  
  /**
   * Run the main trading loop
   */
  private async runTradingLoop(config: any): Promise<void> {
    while (true) {
      try {
        // Get market snapshot
        const snapshot = await this.agent.getMarketSnapshot();
        
        // Check if we should trade
        if (this.shouldTrade(snapshot, config)) {
          // Generate and execute trading plan
          const goal = this.generateTradingGoal(snapshot, config);
          const plan = await this.agent.generateEnhancedPlan(goal);
          
          // Execute if confidence is high enough
          if (plan.metrics && plan.metrics.confidence && plan.metrics.confidence > 0.7) {
            await this.agent.executeEnhancedPlan(plan);
          }
        }
        
        // Wait before next iteration
        await this.wait(10000); // 10 seconds
      } catch (error) {
        console.error('Trading loop error:', error);
        await this.wait(5000); // Wait 5 seconds on error
      }
    }
  }
  
  /**
   * Determine if we should trade
   */
  private shouldTrade(snapshot: any, config: any): boolean {
    // Check if we have room for more positions
    if (snapshot.positions.length >= config.maxPositions) {
      return false;
    }
    
    // Check market conditions
    const { chart, orderBook, trades } = snapshot;
    
    // Look for trading opportunities based on strategy
    switch (config.strategy) {
      case 'scalping':
        // Look for tight spreads and high volume
        return orderBook.spreadPercent < 0.05 && trades.buyVolume > 10000;
      
      case 'swing':
        // Look for trend reversals
        return chart.trend === 'bullish' && 
               chart.currentPrice < chart.support[0] * 1.02;
      
      case 'dca':
        // Always true for DCA, but check if price dropped
        return true;
      
      default:
        return false;
    }
  }
  
  /**
   * Generate trading goal based on market conditions
   */
  private generateTradingGoal(snapshot: any, config: any): string {
    switch (config.strategy) {
      case 'scalping':
        return `Execute a scalp trade on ${snapshot.market} targeting ${config.takeProfitPercent}% profit`;
      
      case 'swing':
        return `Open a swing position on ${snapshot.market} with ${config.stopLossPercent}% stop loss`;
      
      case 'dca':
        return `Implement DCA strategy on ${snapshot.market} with 5 levels`;
      
      default:
        return `Analyze ${snapshot.market} for trading opportunities`;
    }
  }
  
  /**
   * Handle high severity alerts
   */
  private handleHighSeverityAlert(alert: any): void {
    // Implement risk management
    if (alert.type === 'market_alert' && alert.message.includes('Bearish')) {
      // Consider closing positions or tightening stops
      this.agent.emit('riskAlert', {
        action: 'tighten_stops',
        reason: alert.message
      });
    }
  }
  
  /**
   * Stop autonomous trading
   */
  public stopAutonomousTrading(): void {
    this.agent.stop();
    // Disconnect market data when stopping
    marketDataClient.disconnect();
  }
  
  private wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export controller instance
export const agentController = new AgentController();
