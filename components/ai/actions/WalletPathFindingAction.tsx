'use client';

import { isValidSolanaAddress } from '@/lib/utils';
import { WalletPathCache } from '@/lib/wallet-path-cache';

interface WalletPathFindingProps {
  walletA: string;
  walletB: string;
  maxDepth?: number;
  onProgress?: (progress: any) => void;
  onResult?: (result: any) => void;
  onError?: (error: string) => void;
}

/**
 * Wallet Path Finding implementation
 * Finds paths between two wallets using the wallet-path-finding API
 */
export const findWalletPath = async (
  { walletA, walletB, maxDepth = 42, onProgress, onResult, onError }: WalletPathFindingProps
): Promise<any> => {
  try {
    // Validate inputs
    if (!walletA || !isValidSolanaAddress(walletA)) {
      throw new Error(`Invalid source wallet address: ${walletA}`);
    }
    
    if (!walletB || !isValidSolanaAddress(walletB)) {
      throw new Error(`Invalid target wallet address: ${walletB}`);
    }
    
    // Check cache first
    const cachedResult = WalletPathCache.getPathResult(walletA, walletB);
    if (cachedResult) {
      onResult?.({
        ...cachedResult,
        cached: true
      });
      return cachedResult;
    }
    
    // Notify progress start
    onProgress?.({
      type: 'info',
      message: `Starting wallet path search from ${walletA} to ${walletB}...`,
      visitedCount: 0,
      queueSize: 0
    });
    
    // Make the API request
    const response = await fetch('/api/wallet-path-finding', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sourceWallet: walletA,
        targetWallet: walletB,
        maxDepth
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to search wallet path');
    }
    
    // For non-streaming responses
    if (!response.body) {
      const data = await response.json();
      onResult?.(data);
      return data;
    }
    
    // Handle streaming response
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let streamBuffer = '';
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      // Decode the received chunk and add to buffer
      const chunk = decoder.decode(value, { stream: true });
      streamBuffer += chunk;
      
      // Process complete JSON objects
      const lines = streamBuffer.split('\n');
      streamBuffer = lines.pop() || '';
      
      for (const line of lines) {
        if (!line.trim()) continue;
        
        try {
          const data = JSON.parse(line);
          
          // Handle different response types
          if (data.type === 'progress') {
            onProgress?.(data);
          } else if (data.type === 'result') {
            onResult?.(data);
            
            // Return the successful result
            if (data.found) {
              return {
                found: true,
                path: data.path,
                transferIds: data.transferIds,
                visitedCount: data.visitedCount,
                depth: data.depth
              };
            }
          } else if (data.type === 'error') {
            onError?.(data.message);
            throw new Error(data.message);
          }
        } catch (e) {
          console.error('Error parsing streaming response:', e, 'Line:', line);
        }
      }
    }
    
    return {
      found: false,
      message: 'No path found between the wallets'
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    onError?.(errorMessage);
    return {
      found: false,
      error: errorMessage
    };
  }
};

/**
 * Format wallet addresses for display
 */
export const formatWalletAddress = (address: string): string => {
  if (!address || address.length < 10) return address;
  return `${address.substring(0, 4)}...${address.substring(address.length - 4)}`;
};

/**
 * Generate a markdown representation of the wallet path
 */
export const renderWalletPathMarkdown = (result: any): string => {
  if (!result) return 'No result data available';
  
  if (result.cached) {
    return `### Wallet Path (Cached Result)\n\n` +
      renderPathDetails(result);
  }
  
  if (!result.found) {
    return `### No Path Found\n\n` +
      `No path was found between ${formatWalletAddress(result.sourceWallet)} and ${formatWalletAddress(result.targetWallet)}.\n\n` +
      `* Wallets visited: ${result.visitedCount || 0}\n` +
      `* Maximum depth searched: ${result.depth || 0}`;
  }
  
  return `### Wallet Path Found\n\n` +
    renderPathDetails(result);
};

/**
 * Render the details of a path
 */
const renderPathDetails = (result: any): string => {
  if (!result || !result.path || result.path.length === 0) {
    return 'Path information not available';
  }
  
  let markdown = `Found a path from ${formatWalletAddress(result.sourceWallet)} to ${formatWalletAddress(result.targetWallet)}.\n\n`;
  
  markdown += `**Path length**: ${result.path.length - 1} hops\n`;
  markdown += `**Wallets visited during search**: ${result.visitedCount || 0}\n\n`;
  
  markdown += '**Path**:\n\n';
  
  // Create a formatted path representation
  for (let i = 0; i < result.path.length; i++) {
    const wallet = result.path[i];
    
    if (i === 0) {
      markdown += `1. **Start**: ${wallet} (${formatWalletAddress(wallet)})\n`;
    } else if (i === result.path.length - 1) {
      markdown += `${i + 1}. **End**: ${wallet} (${formatWalletAddress(wallet)})\n`;
    } else {
      markdown += `${i + 1}. ${wallet} (${formatWalletAddress(wallet)})\n`;
    }
    
    // Add transaction details if available
    if (result.transferIds && i < result.path.length - 1) {
      const txId = result.transferIds[i];
      if (txId) {
        markdown += `   ↓ Transaction: [${formatWalletAddress(txId)}](/tx/${txId})\n`;
      } else {
        markdown += `   ↓\n`;
      }
    }
  }
  
  return markdown;
};

/**
 * WalletPathFindingAction object for AI system integration
 * This is the main export that conforms to the AI action interface
 */
export const WalletPathFindingAction = {
  name: 'wallet_path_finding',
  description: 'Find a path between two wallet addresses by tracking token transfers',
  execute: async ({ params, streamResponse, response }: any) => {
    try {
      const { walletA, walletB, maxDepth } = params;
      
      // Stream progress updates
      const result = await findWalletPath({
        walletA,
        walletB,
        maxDepth: maxDepth || 42,
        onProgress: (progress) => {
          if (streamResponse) {
            streamResponse(`Searching wallet path... Visited ${progress.visitedCount} wallets. Queue size: ${progress.queueSize || 0}`);
          }
        },
        onResult: (data) => {
          if (response) {
            if (data.found) {
              response(renderWalletPathMarkdown(data));
            } else {
              response(`No path found between ${formatWalletAddress(walletA)} and ${formatWalletAddress(walletB)} after visiting ${data.visitedCount} wallets.`);
            }
          }
        },
        onError: (errorMessage) => {
          if (response) {
            response(`Error finding wallet path: ${errorMessage}`);
          }
        }
      });
      
      return result;
    } catch (error) {
      console.error('Error executing wallet path finding action:', error);
      throw error;
    }
  }
};
