import { QdrantClient } from '@qdrant/js-client-rest';

export const COLLECTIONS = {
  TRANSACTIONS: 'transactions',
  ACCOUNTS: 'accounts',
  PROGRAMS: 'programs'
} as const;

export const VECTOR_SIZE = 1536;

const qdrantClient = new QdrantClient({
  url: process.env.QDRANT_SERVER || 'http://localhost:6333'
});

// Generate vector representation for a transaction
function generateTransactionVector(tx: any): number[] {
  const vector = new Array(VECTOR_SIZE).fill(0);

  // Hash-based feature extraction
  const features = [
    tx.signature,
    tx.type,
    tx.success ? '1' : '0',
    tx.symbol || '',
    tx.mint || '',
    ...(tx.details?.accounts?.map((acc: any) => acc.pubkey) || []),
    ...(tx.details?.instructions?.map((inst: any) => inst.programId) || [])
  ].join('|');

  // Simple hash-based vector generation
  for (let i = 0; i < VECTOR_SIZE; i++) {
    const hash = features.split('').reduce((acc, char) => {
      return ((acc << 5) - acc + char.charCodeAt(0)) & 0xffffffff;
    }, i);
    vector[i] = (hash % 1000) / 1000; // Normalize to 0-1
  }

  return vector;
}

export async function storeGraph(transactions: any[]) {
  try {
    // Store transaction vectors in Qdrant
    const vectors = transactions.map(tx => ({
      id: tx.signature,
      vector: generateTransactionVector(tx),
      payload: {
        signature: tx.signature,
        timestamp: tx.timestamp,
        slot: tx.slot,
        success: tx.success,
        type: tx.type,
        accounts: tx.details?.accounts?.map((acc: any) => acc.pubkey) || [],
        programIds: tx.details?.instructions?.map((inst: any) => inst.programId) || [],
        amount: tx.amount,
        symbol: tx.symbol,
        mint: tx.mint
      }
    }));

    await client.upsert(COLLECTIONS.TRANSACTIONS, {
      points: vectors
    });

    console.log(`Stored ${vectors.length} transaction vectors in Qdrant`);
  } catch (error) {
    console.error('Error storing graph in Qdrant:', error);
    throw error;
  }
}

export async function findRelatedTransactions(signature: string) {
  try {
    // Search for similar transactions using vector similarity
    const searchResult = await client.search(COLLECTIONS.TRANSACTIONS, {
      vector: generateTransactionVector({ signature }), // Generate vector for search
      limit: 10,
      with_payload: true,
      with_vector: false
    });

    // Filter out the target transaction and map to DetailedTransactionInfo format
    const relatedTransactions = searchResult
      .filter(result => result.id !== signature && result.payload)
      .map(result => ({
        signature: result.payload?.signature || '',
        timestamp: result.payload?.timestamp || 0,
        slot: result.payload?.slot || 0,
        success: result.payload?.success || false,
        type: result.payload?.type || 'unknown',
        amount: result.payload?.amount,
        symbol: result.payload?.symbol,
        mint: result.payload?.mint,
        details: {
          accounts: Array.isArray(result.payload?.accounts)
            ? result.payload.accounts.map((pubkey: string) => ({
              pubkey,
              signer: false,
              writable: false
            }))
            : [],
          instructions: Array.isArray(result.payload?.programIds)
            ? result.payload.programIds.map((programId: string) => ({
              programId,
              accounts: [],
              data: ''
            }))
            : []
        }
      }));

    console.log(`Found ${relatedTransactions.length} related transactions for ${signature}`);
    return relatedTransactions;
  } catch (error) {
    console.error('Error finding related transactions:', error);
    return [];
  }
}

export function buildTransactionGraph(transactions: any[]) {
  const nodes = new Map();
  const edges = new Map();
  const chunks: any[] = [];

  // Build nodes from transactions
  transactions.forEach(tx => {
    nodes.set(tx.signature, {
      id: tx.signature,
      type: 'transaction',
      data: tx
    });
  });

  // Build edges based on shared accounts
  for (let i = 0; i < transactions.length; i++) {
    const tx1 = transactions[i];
    for (let j = i + 1; j < transactions.length; j++) {
      const tx2 = transactions[j];

      const sharedAccounts = tx1.details?.accounts?.filter((acc1: any) =>
        tx2.details?.accounts?.some((acc2: any) => acc2.pubkey === acc1.pubkey)
      ) || [];

      if (sharedAccounts.length > 0) {
        const edgeId = `${tx1.signature}-${tx2.signature}`;
        edges.set(edgeId, {
          source: tx1.signature,
          target: tx2.signature,
          type: 'shared_accounts',
          weight: sharedAccounts.length
        });
      }
    }
  }

  // Create chunks for processing
  chunks.push({
    nodes: Array.from(nodes.values()),
    edges: Array.from(edges.values())
  });

  return chunks;
}
