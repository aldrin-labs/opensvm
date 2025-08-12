interface ActionCallbacks {
  streamResponse?: (text: string) => void;
  response?: (text: string) => void;
}

export async function executeAction(
  actionName: string,
  params: any,
  callbacks: ActionCallbacks
): Promise<void> {
  switch (actionName) {
    case 'wallet_path_finding':
      await executeWalletPathFinding(params, callbacks);
      break;
    case 'logs_subscribe_program':
      await executeLogsSubscribeProgram(params, callbacks);
      break;
    case 'block_subscribe':
      await executeBlockSubscribe(params, callbacks);
      break;
    default:
      throw new Error(`Unknown action: ${actionName}`);
  }
}

async function executeWalletPathFinding(
  params: { walletA: string; walletB: string; maxDepth: number },
  callbacks: ActionCallbacks
): Promise<void> {
  const { walletA, walletB, maxDepth } = params;

  // Simulate path finding process
  if (callbacks.streamResponse) {
    callbacks.streamResponse(`🔍 Analyzing wallet ${walletA}...`);
  }

  // Simulate processing time
  await new Promise(resolve => setTimeout(resolve, 1000));

  if (callbacks.streamResponse) {
    callbacks.streamResponse(`🔍 Analyzing wallet ${walletB}...`);
  }

  await new Promise(resolve => setTimeout(resolve, 1000));

  if (callbacks.streamResponse) {
    callbacks.streamResponse(`📊 Searching for connections (max depth: ${maxDepth})...`);
  }

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Simulate final response
  const finalResponse = `
**Wallet Path Analysis Complete**

🔗 **Path between wallets:**
- Source: \`${walletA.slice(0, 8)}...${walletA.slice(-4)}\`
- Target: \`${walletB.slice(0, 8)}...${walletB.slice(-4)}\`

📈 **Analysis Results:**
- Maximum search depth: ${maxDepth} levels
- Direct connections: Not found
- Indirect connections: Analysis complete

*Note: This is a simulated path finding result. In a real implementation, this would analyze on-chain transaction data to find actual connection paths between wallets.*
  `;

  if (callbacks.response) {
    callbacks.response(finalResponse);
  }
}

// --- Streaming actions ---
import { PublicKey } from '@solana/web3.js';
import { getClientConnection } from '@/lib/solana-connection';

async function executeLogsSubscribeProgram(
  params: { programId: string; commitment?: 'processed' | 'confirmed' | 'finalized'; durationMs?: number },
  callbacks: ActionCallbacks
): Promise<void> {
  const { programId, commitment = 'confirmed', durationMs = 60000 } = params || {};
  if (!programId) throw new Error('programId is required for logs_subscribe_program');

  const connection = getClientConnection();
  const pubkey = new PublicKey(programId);

  callbacks.response?.(`Started logs subscription for program ${programId} (${commitment}) for ${Math.round(durationMs / 1000)}s...`);

  const listenerId = await connection.onLogs(pubkey, (logInfo) => {
    const slot = (logInfo as any)?.slot ?? 'unknown';
    const logs = (logInfo as any)?.logs ?? [];
    const sig = (logInfo as any)?.signature ?? '';
    const formatted = typeof logs?.join === 'function' ? logs.join('\n') : JSON.stringify(logs);
    callbacks.streamResponse?.(`slot ${slot} ${sig ? `sig ${sig}` : ''}\n${formatted}`);
  }, commitment);

  setTimeout(async () => {
    try {
      await connection.removeOnLogsListener(listenerId);
      callbacks.response?.(`Logs subscription ended for program ${programId}.`);
    } catch { }
  }, durationMs);
}

async function executeBlockSubscribe(
  params: { durationMs?: number },
  callbacks: ActionCallbacks
): Promise<void> {
  const { durationMs = 60000 } = params || {};
  const connection = getClientConnection();

  callbacks.response?.(`Started block (slot) subscription for ${Math.round(durationMs / 1000)}s...`);

  const listenerId = await connection.onSlotChange((e: any) => {
    const { slot, parent, type } = e || {};
    callbacks.streamResponse?.(`slot=${slot} parent=${parent} type=${type}`);
  });

  setTimeout(async () => {
    try {
      await connection.removeSlotChangeListener(listenerId);
      callbacks.response?.('Block subscription ended.');
    } catch { }
  }, durationMs);
}