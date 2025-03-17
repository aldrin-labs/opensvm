import { Connection, PublicKey } from '@solana/web3.js';
import { BaseCapability } from './base';
import type { Message, ToolParams, CapabilityType } from '../types';
import { ExecutionMode } from '../types';

// Import the SolanaAgentKit from the solana-ai-agent package
// In a production environment, this would be:
// import { SolanaAgentKit } from 'solana-ai-agent';
// For now, we'll use a mock implementation

export class SolanaAIAgentCapability extends BaseCapability {
  type: CapabilityType = 'solana-ai';
  executionMode = ExecutionMode.Sequential;
  private solanaAIAgent: SolanaAgentKit;

  constructor(connection: Connection) {
    super(connection);
    try {
      // Initialize the actual SDK
      this.solanaAIAgent = new SolanaAgentKit({ connection });
    } catch (error) {
      console.error('Failed to initialize Solana AI Agent:', error);
      throw new Error('Failed to initialize Solana AI Agent. Real implementation is required.');
    }
  }

  tools = [
    this.createToolExecutor(
      'getWalletBalance',
      'Gets the balance of a wallet',
      async ({ message }: ToolParams) => {
        try {
          // Extract wallet address from the message
          const addressMatch = message.content.match(/(?:address|wallet|account)[\s:]*([\w\d]+)/i);
          const tokenMatch = message.content.match(/(?:token|for token|of token)[\s:]*([\w\d]+)/i);
          
          if (!addressMatch) {
            return 'Please specify a wallet address to check the balance.';
          }
          
          const walletAddress = addressMatch[1];
          const tokenAddress = tokenMatch ? tokenMatch[1] : undefined;
          
          // Use the real implementation to get wallet balance
          const result = await this.solanaAIAgent.getWalletBalance(walletAddress, tokenAddress);
          return JSON.stringify(result, null, 2);
        } catch (error) {
          console.error('Error getting wallet balance:', error);
          return 'Error getting wallet balance. Please try again later.';
        }
      }
    ),
    
    this.createToolExecutor(
      'getNetworkTPS',
      'Gets the current TPS of the Solana network',
      async () => {
        try {
          // Use the real implementation to get network TPS
          const result = await this.solanaAIAgent.getNetworkTPS();
          return JSON.stringify(result, null, 2);
        } catch (error) {
          console.error('Error getting network TPS:', error);
          return 'Error getting network TPS. Please try again later.';
        }
      }
    ),
    
    this.createToolExecutor(
      'getTokenPrice',
      'Gets the current price of a token',
      async ({ message }: ToolParams) => {
        try {
          // Extract token from the message
          const tokenMatch = message.content.match(/(?:token|price for|price of)[\s:]*([\w\d]+)/i);
          
          if (!tokenMatch) {
            return 'Please specify a token to get the price for.';
          }
          
          const token = tokenMatch[1];
          // Use the real implementation to get token price
          const result = await this.solanaAIAgent.getTokenPrice(token);
          return JSON.stringify(result, null, 2);
        } catch (error) {
          console.error('Error getting token price:', error);
          return 'Error getting token price. Please try again later.';
        }
      }
    ),
    
    this.createToolExecutor(
      'tradeTokens',
      'Executes a token swap/trade',
      async ({ message }: ToolParams) => {
        try {
          // Extract trading parameters from the message
          const fromTokenMatch = message.content.match(/from[\s:]*([\w\d]+)/i);
          const toTokenMatch = message.content.match(/to[\s:]*([\w\d]+)/i);
          const amountMatch = message.content.match(/amount[\s:]*(\d+(?:\.\d+)?)/i);
          const slippageMatch = message.content.match(/slippage[\s:]*(\d+(?:\.\d+)?)/i);
          
          if (!toTokenMatch || !amountMatch) {
            return 'Please specify to token and amount for trading.';
          }
          
          const params = {
            outputMint: toTokenMatch[1],
            inputAmount: parseFloat(amountMatch[1]),
            inputMint: fromTokenMatch ? fromTokenMatch[1] : undefined,
            slippage: slippageMatch ? parseFloat(slippageMatch[1]) / 100 : undefined
          };
          
          // Use the real implementation to trade tokens
          const result = await this.solanaAIAgent.tradeTokens(params);
          return JSON.stringify(result, null, 2);
        } catch (error) {
          console.error('Error executing token trade:', error);
          return 'Error executing token trade. Please try again later.';
        }
      }
    ),
    
    this.createToolExecutor(
      'openPerpTradeLong',
      'Opens a long position in a perpetual market',
      async ({ message }: ToolParams) => {
        try {
          // Extract parameters from the message
          const marketMatch = message.content.match(/market[\s:]*([\w\d-]+)/i);
          const sizeMatch = message.content.match(/size[\s:]*(\d+(?:\.\d+)?)/i);
          const priceMatch = message.content.match(/price[\s:]*(\d+(?:\.\d+)?)/i);
          const leverageMatch = message.content.match(/leverage[\s:]*(\d+(?:\.\d+)?)/i);
          
          if (!marketMatch || !sizeMatch) {
            return 'Please specify market and size for the trade.';
          }
          
          const args = {
            market: marketMatch[1],
            size: parseFloat(sizeMatch[1]),
            price: priceMatch ? parseFloat(priceMatch[1]) : undefined,
            leverage: leverageMatch ? parseFloat(leverageMatch[1]) : undefined
          };
          
          // Use the real implementation to open a perp trade
          const result = await this.solanaAIAgent.openPerpTradeLong(args);
          return JSON.stringify(result, null, 2);
        } catch (error) {
          console.error('Error opening perpetual trade:', error);
          return 'Error opening perpetual trade. Please try again later.';
        }
      }
    ),
    
    this.createToolExecutor(
      'getPerpMarketFundingRate',
      'Gets the funding rate for a perpetual market',
      async ({ message }: ToolParams) => {
        try {
          // Extract parameters from the message
          const marketMatch = message.content.match(/market[\s:]*([\w\d-]+)/i);
          const periodMatch = message.content.match(/period[\s:]*(year|hour)/i);
          
          if (!marketMatch) {
            return 'Please specify a market to get the funding rate for.';
          }
          
          const market = marketMatch[1];
          const period = periodMatch ? periodMatch[1] : 'year';
          
          // Use the real implementation to get funding rate
          const result = await this.solanaAIAgent.getPerpMarketFundingRate(market, period);
          return JSON.stringify(result, null, 2);
        } catch (error) {
          console.error('Error getting funding rate:', error);
          return 'Error getting funding rate. Please try again later.';
        }
      }
    )
  ];

  canHandle(message: Message): boolean {
    const content = message.content.toLowerCase();
    return content.includes('solana') ||
           content.includes('wallet balance') ||
           content.includes('token price') ||
           content.includes('trade token') ||
           content.includes('network tps') ||
           content.includes('perpetual') ||
           content.includes('perp trade') ||
           content.includes('funding rate') ||
           false;
  }
}