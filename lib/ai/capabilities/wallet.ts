import { PublicKey, Connection } from '@solana/web3.js';
import { CapabilityType, Message, Tool, ToolParams, ExecutionMode } from '../types';
import { walletPathFindingAction } from '@/components/ai/actions';
import { BaseCapability } from './base';
import { isValidSolanaAddress } from '@/lib/utils';

/**
 * Tools for wallet-related operations
 */
export class WalletCapability extends BaseCapability {
  type: CapabilityType = 'account'; // Use 'account' type since wallet operations are account-related
  executionMode = ExecutionMode.Sequential;
  private solanaConnection: Connection | null = null;

  tools: Tool[] = [
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

          // Validate wallet addresses using isValidSolanaAddress
          if (!this.validateWalletAddresses([walletA, walletB])) {
            return {
              error: 'Invalid Solana wallet address format detected. Please provide valid Base58 addresses.'
            };
          }

          // Execute the actual wallet path finding action
          const pathResult = await this.executeWalletPathFinding(walletA, walletB);

          return {
            result: pathResult
          };
        } catch (error) {
          console.error('Error in wallet path finding tool:', error);
          return {
            error: error instanceof Error ? error.message : String(error)
          };
        }
      }
    ),

    this.createToolExecutor(
      'validateWallet',
      'Validate Solana wallet address format and check if it exists on-chain',
      async (params: ToolParams) => {
        try {
          const { message } = params;
          const content = message.content.toLowerCase();

          // Extract wallet addresses from the message
          const walletAddresses = this.extractWalletAddresses(content);

          if (walletAddresses.length === 0) {
            return {
              result: 'Please provide a wallet address to validate.'
            };
          }

          const validationResults = await this.validateWalletsOnChain(walletAddresses);

          return {
            result: validationResults
          };
        } catch (error) {
          console.error('Error in wallet validation tool:', error);
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

  /**
   * Validate wallet addresses using isValidSolanaAddress
   * Uses the imported isValidSolanaAddress function for proper validation
   */
  private validateWalletAddresses(addresses: string[]): boolean {
    return addresses.every(address => {
      try {
        // Use the imported isValidSolanaAddress function
        const isValid = isValidSolanaAddress(address);
        console.log(`Validating address ${address}: ${isValid ? 'valid' : 'invalid'}`);
        return isValid;
      } catch (error) {
        console.warn(`Error validating address ${address}:`, error);
        return false;
      }
    });
  }

  /**
   * Execute wallet path finding using the imported walletPathFindingAction
   * Integrates with the AI action system for comprehensive path analysis
   */
  private async executeWalletPathFinding(walletA: string, walletB: string): Promise<any> {
    try {
      console.log(`Executing wallet path finding from ${walletA} to ${walletB}`);

      let resultData: any = null;
      let streamMessages: string[] = [];

      // Use the imported walletPathFindingAction object's execute method
      const pathResult = await walletPathFindingAction.execute({
        params: {
          walletA,
          walletB,
          maxDepth: 42 // Default max depth for path finding
        },
        streamResponse: (message: string) => {
          console.log(`Path finding progress: ${message}`);
          streamMessages.push(message);
        },
        response: (data: any) => {
          console.log(`Path finding response received:`, data);
          resultData = data;
        }
      });

      console.log(`Path finding completed between ${walletA} and ${walletB}`);
      return {
        actionName: 'wallet_path_finding',
        params: { walletA, walletB },
        result: pathResult,
        resultData,
        streamMessages,
        summary: `Wallet path finding executed between ${walletA.slice(0, 8)}...${walletA.slice(-4)} and ${walletB.slice(0, 8)}...${walletB.slice(-4)}`
      };
    } catch (error) {
      console.error(`Error executing wallet path finding:`, error);
      return {
        actionName: 'wallet_path_finding',
        params: { walletA, walletB },
        error: error instanceof Error ? error.message : String(error),
        summary: 'Failed to find paths between wallets'
      };
    }
  }

  /**
   * Initialize Connection for on-chain operations
   * Uses the imported Connection class for Solana RPC communication
   */
  private getSolanaConnection(): Connection {
    if (!this.solanaConnection) {
      // Use Connection import for Solana RPC communication
      const rpcEndpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
      this.solanaConnection = new Connection(rpcEndpoint, 'confirmed');
      console.log(`Initialized Solana connection to ${rpcEndpoint}`);
    }
    return this.solanaConnection;
  }

  /**
   * Validate wallets on-chain using PublicKey and Connection
   * Uses Solana web3.js imports for comprehensive on-chain validation
   */
  private async validateWalletsOnChain(addresses: string[]): Promise<any[]> {
    const results = [];
    const connection = this.getSolanaConnection();

    for (const address of addresses) {
      try {
        // Use PublicKey import for address validation and conversion
        const publicKey = new PublicKey(address);
        console.log(`Validating on-chain existence for ${address}`);

        // Use Connection import for actual on-chain validation
        let accountInfo = null;
        let isOnChain = false;

        try {
          accountInfo = await connection.getAccountInfo(publicKey);
          isOnChain = accountInfo !== null;
          console.log(`On-chain check for ${address}: ${isOnChain ? 'exists' : 'not found'}`);
        } catch (rpcError) {
          console.warn(`RPC error checking ${address}:`, rpcError);
        }

        const validationResult = {
          address,
          isValidFormat: true,
          publicKey: publicKey.toString(),
          isBase58: true,
          length: address.length,
          isOnChain,
          accountInfo: accountInfo ? {
            lamports: accountInfo.lamports,
            owner: accountInfo.owner.toString(),
            executable: accountInfo.executable,
            rentEpoch: accountInfo.rentEpoch
          } : null,
          summary: `Address ${address} has valid format${isOnChain ? ' and exists on-chain' : ' but not found on-chain'}`
        };

        results.push(validationResult);
        console.log(`Validation completed for ${address}: valid format, on-chain: ${isOnChain}`);
      } catch (error) {
        console.warn(`Validation failed for ${address}:`, error);
        results.push({
          address,
          isValidFormat: false,
          error: error instanceof Error ? error.message : String(error),
          summary: `Address ${address} has invalid format`
        });
      }
    }

    return results;
  }

  canHandle(message: Message): boolean {
    // Check if this capability can handle the message
    const content = message.content.toLowerCase();

    // Check for wallet-related keywords
    const walletKeywords = [
      'wallet', 'find path', 'token transfer', 'token trail',
      'validate address', 'check wallet', 'wallet connection',
      'solana address', 'public key', 'base58'
    ];

    const hasWalletKeywords = walletKeywords.some(keyword => content.includes(keyword));

    // Check if message contains potential wallet addresses
    const extractedAddresses = this.extractWalletAddresses(content);
    const hasWalletAddresses = extractedAddresses.length > 0;

    // Check if any tools can handle the message
    const toolCanHandle = this.tools.some(tool => tool.matches?.(message));

    const canHandle = hasWalletKeywords || hasWalletAddresses || toolCanHandle;

    if (canHandle) {
      console.log(`WalletCapability can handle message: keywords=${hasWalletKeywords}, addresses=${hasWalletAddresses}, tools=${toolCanHandle}`);
    }

    return canHandle;
  }
}
