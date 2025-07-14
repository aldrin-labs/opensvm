import { setup, fromPromise } from "xstate";
import { isValidSolanaAddress } from "@/lib/utils";

// Maximum depth for the BFS search
const MAX_SEARCH_DEPTH = 42;

interface WalletNode {
  address: string;
  parent?: WalletNode;
  transactionId?: string;
  depth: number;
}

interface Transfer {
  txId: string;
  from: string;
  to: string;
  transferType: 'IN' | 'OUT';
  // Other fields omitted for brevity
}

/**
 * Fetch transfers for a wallet address
 */
async function fetchWalletTransfers(wallet: string): Promise<Transfer[]> {
  try {
    const response = await fetch(`/api/account-transfers/${wallet}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch transfers: ${response.statusText}`);
    }
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error(`Error fetching transfers for wallet ${wallet}:`, error);
    return [];
  }
}

/**
 * Convert a wallet node path to an array of wallet addresses
 */
function reconstructPath(node: WalletNode | undefined): { path: string[], txIds: string[] } {
  const path: string[] = [];
  const txIds: string[] = [];
  
  let current: WalletNode | undefined = node;
  while (current) {
    path.unshift(current.address);
    if (current.transactionId) {
      txIds.unshift(current.transactionId);
    }
    current = current.parent;
  }
  
  return { path, txIds };
}

/**
 * Create the wallet path finding state machine
 */
export const createWalletPathFindingMachine = () => {
  return setup({
    types: {
      context: {} as {
        found: boolean;
        walletQueue: WalletNode[];
        visitedWallets: Set<string>;
        targetWallet: string;
        currentWallet: WalletNode | null;
        transfers: Transfer[];
        result: {
          path: string[];
          transferIds: string[];
          found: boolean;
          visitedCount: number;
          depth: number;
        };
        error: string | null;
        maxDepth: number;
      },
      events: {} as 
        | { type: "start"; walletA: string; walletB: string; maxDepth?: number }
        | { type: "reset" },
      input: {} as {
        wallet: string;
      }
    },
    actors: {
      fetchTransfersByWallet: fromPromise(async ({ input }: { input: { wallet: string } }) => {
        if (!input.wallet || !isValidSolanaAddress(input.wallet)) {
          throw new Error(`Invalid wallet address: ${input.wallet}`);
        }
        return await fetchWalletTransfers(input.wallet);
      }),
    },
  }).createMachine({
    id: "walletPathSearch",
    initial: "idle",
    context: {
      found: false,
      walletQueue: [],
      visitedWallets: new Set<string>(),
      targetWallet: "",
      currentWallet: null,
      transfers: [],
      result: {
        path: [],
        transferIds: [],
        found: false,
        visitedCount: 0,
        depth: 0
      },
      error: null,
      maxDepth: MAX_SEARCH_DEPTH
    },
    states: {
      idle: {
        on: {
          start: {
            target: "initializing",
            actions: ({ context, event }) => {
              // Reset the context
              context.found = false;
              context.walletQueue = [];
              context.visitedWallets = new Set<string>();
              context.transfers = [];
              context.error = null;
              context.result = {
                path: [],
                transferIds: [],
                found: false,
                visitedCount: 0,
                depth: 0
              };
              
              // Set up the search parameters
              context.targetWallet = event.walletB;
              context.maxDepth = event.maxDepth || MAX_SEARCH_DEPTH;
              
              // Initialize the queue with the source wallet
              const initialNode: WalletNode = {
                address: event.walletA,
                depth: 0
              };
              context.currentWallet = initialNode;
              context.walletQueue.push(initialNode);
            },
          },
          reset: {
            target: "idle",
            actions: ({ context }) => {
              // Reset the context
              context.found = false;
              context.walletQueue = [];
              context.visitedWallets = new Set<string>();
              context.targetWallet = "";
              context.currentWallet = null;
              context.transfers = [];
              context.error = null;
              context.result = {
                path: [],
                transferIds: [],
                found: false,
                visitedCount: 0,
                depth: 0
              };
            },
          },
        },
        description:
          "The machine is in a resting state, waiting to start the search process.",
      },
      initializing: {
        always: {
          target: "searchingWallet",
          actions: ({ context }) => {
            if (context.currentWallet) {
              // Mark the initial wallet as visited
              context.visitedWallets.add(context.currentWallet.address);
              
              // Direct match check - in case source and target are the same
              if (context.currentWallet.address === context.targetWallet) {
                context.found = true;
                const { path, txIds } = reconstructPath(context.currentWallet);
                context.result = {
                  path,
                  transferIds: txIds,
                  found: true,
                  visitedCount: context.visitedWallets.size,
                  depth: context.currentWallet.depth
                };
              }
            }
          },
        },
        description:
          "The machine is setting up initial parameters for the BFS process.",
      },
      searchingWallet: {
        invoke: {
          id: "walletPathSearch.searching:invocation",
          input: ({ context }) => ({
            wallet: context.currentWallet?.address || ""
          }),
          onDone: {
            target: "processingResults",
            actions: ({ context, event }) => {
              context.transfers = event.output;
            },
          },
          onError: {
            target: "failure",
            actions: ({ context, event }) => {
              context.error = `Failed to fetch transfers: ${event.error}`;
              console.error(context.error);
            },
          },
          src: "fetchTransfersByWallet",
        },
        description:
          "The machine is actively performing BFS by querying /transfersByWallet for the current wallet.",
      },
      processingResults: {
        always: [
          // Check if we already found the target (in initializing)
          {
            target: "success",
            guard: ({ context }) => context.found
          },
          // Check if current transfers include the target wallet
          {
            target: "success",
            actions: ({ context }) => {
              const targetTransfer = context.transfers.find(t => {
                return (t.transferType === 'OUT' && t.to === context.targetWallet) || 
                       (t.transferType === 'IN' && t.from === context.targetWallet);
              });
              
              if (targetTransfer) {
                context.found = true;
                
                // Create the target node
                const targetNode: WalletNode = {
                  address: context.targetWallet,
                  parent: context.currentWallet || undefined,
                  transactionId: targetTransfer.txId,
                  depth: (context.currentWallet?.depth || 0) + 1
                };
                
                // Reconstruct the path
                const { path, txIds } = reconstructPath(targetNode);
                context.result = {
                  path,
                  transferIds: txIds,
                  found: true,
                  visitedCount: context.visitedWallets.size,
                  depth: targetNode.depth
                };
              }
            },
            guard: ({ context }) => {
              return context.transfers.some(t => {
                return (t.transferType === 'OUT' && t.to === context.targetWallet) || 
                       (t.transferType === 'IN' && t.from === context.targetWallet);
              });
            }
          },
          // No direct path, continue searching
          {
            target: "enqueueWallets"
          }
        ],
        description:
          "The machine processes the results from /transfersByWallet to determine the next steps.",
      },
      enqueueWallets: {
        always: [
          {
            target: "checkingQueue",
            actions: ({ context }) => {
              // Process OUT transfers - where current wallet sent tokens
              context.transfers
                .filter(t => t.transferType === 'OUT')
                .forEach(transfer => {
                  if (!context.visitedWallets.has(transfer.to)) {
                    // Create a new node for this wallet
                    const node: WalletNode = {
                      address: transfer.to,
                      parent: context.currentWallet || undefined,
                      transactionId: transfer.txId,
                      depth: (context.currentWallet?.depth || 0) + 1
                    };
                    
                    // Only enqueue if we haven't reached max depth
                    if (node.depth <= context.maxDepth) {
                      context.walletQueue.push(node);
                      context.visitedWallets.add(transfer.to);
                    }
                  }
                });
              
              // Process IN transfers - where current wallet received tokens
              context.transfers
                .filter(t => t.transferType === 'IN')
                .forEach(transfer => {
                  if (!context.visitedWallets.has(transfer.from)) {
                    // Create a new node for this wallet
                    const node: WalletNode = {
                      address: transfer.from,
                      parent: context.currentWallet || undefined,
                      transactionId: transfer.txId,
                      depth: (context.currentWallet?.depth || 0) + 1
                    };
                    
                    // Only enqueue if we haven't reached max depth
                    if (node.depth <= context.maxDepth) {
                      context.walletQueue.push(node);
                      context.visitedWallets.add(transfer.from);
                    }
                  }
                });
            },
          }
        ],
        description:
          "The machine enqueues new wallets for future BFS exploration.",
      },
      checkingQueue: {
        always: [
          {
            target: "searchingWallet",
            actions: ({ context }) => {
              // Get the next wallet from the queue
              context.currentWallet = context.walletQueue.shift() || null;
            },
            guard: ({ context }) => context.walletQueue.length > 0
          },
          {
            target: "failure",
            actions: ({ context }) => {
              // No path found
              context.result = {
                path: [],
                transferIds: [],
                found: false,
                visitedCount: context.visitedWallets.size,
                depth: context.currentWallet?.depth || 0
              };
            }
          }
        ],
        description:
          "The machine checks the queue for the next wallet to explore.",
      },
      failure: {
        type: "final",
        description:
          "The machine has failed to find a path to the target wallet and the queue is exhausted.",
      },
      success: {
        type: "final",
        description:
          "The machine has successfully found a path to the target wallet.",
      },
    },
  });
};
