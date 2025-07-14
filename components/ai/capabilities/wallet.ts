import { CapabilityType, Message, ToolParams, ExecutionMode } from '../types';
import { BaseCapability } from './base';

/**
 * Tools for wallet-related operations
 */
export class WalletCapability extends BaseCapability {
  type: CapabilityType = 'account'; // Use 'account' type since wallet operations are account-related
  executionMode = ExecutionMode.Sequential;
  
  tools = [
    this.createToolExecutor(
      'findWalletPath',
      'Find a path between two wallets by tracking token transfers',
      async (params: ToolParams) => {
        try {
          const { message } = params;
          const content = message.content.toLowerCase();
          
          // Extract wallet addresses from the message
          const walletAddresses = this.extractWalletAddresses(content);
          
          if (walletAddresses.length < 2) {
            return {
              result: 'Please provide both source and target wallet addresses to find a path between them.'
            };
          }
          
          // Use the first two addresses as source and target
          const [walletA, walletB] = walletAddresses;
          
          return {
            result: {
              actionName: 'wallet_path_finding',
              params: {
                walletA,
                walletB,
                maxDepth: 42 // Default max depth
              }
            }
          };
        } catch (error) {
          console.error('Error in wallet path finding tool:', error);
          return {
            error: error instanceof Error ? error.message : String(error)
          };
        }
      }
    )
  ];

  /**
   * Attempt to extract wallet addresses from message content
   */
  private extractWalletAddresses(content: string): string[] {
    // Regular expression to match Solana wallet addresses (Base58 format)
    const walletRegex = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g;
    return [...content.matchAll(walletRegex)].map(match => match[0]);
  }
  
  canHandle(message: Message): boolean {
    // Check if this capability can handle the message
    const content = message.content.toLowerCase();
    return (
      content.includes('wallet') ||
      content.includes('find path') ||
      content.includes('token transfer') ||
      content.includes('token trail') ||
      this.tools.some(tool => tool.matches?.(message))
    );
  }
}
