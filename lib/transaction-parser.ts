import { Connection, ParsedTransactionWithMeta, PublicKey } from '@solana/web3.js';
import { SolanaParser, idl } from '@debridge-finance/solana-transaction-parser';
import { Idl } from '@coral-xyz/anchor';

export interface ParsedAccount {
  name?: string;
  isSigner: boolean;
  isWritable: boolean;
  pubkey: PublicKey;
  preBalance?: number;
  postBalance?: number;
}

export interface ParsedInstruction {
  name: string;
  programId: PublicKey;
  programName?: string;
  args: Record<string, any>;
  accounts: ParsedAccount[];
}


// Common program IDs for parsing
const COMMON_PROGRAM_IDS = {
  SYSTEM: '11111111111111111111111111111111',
  TOKEN: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  ASSOCIATED_TOKEN: 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
  COMPUTE_BUDGET: 'ComputeBudget111111111111111111111111111111',
  TOKEN_2022: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb',
  TOKEN_METADATA: 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s'
};

export async function parseTransaction(
  connection: Connection,
  signature: string
): Promise<{
  parsedInstructions: ParsedInstruction[];
  logs: string[];
  parsedTransaction?: ParsedTransactionWithMeta;
}> {
  try {
    // Get transaction details with full metadata
    const tx: ParsedTransactionWithMeta | null = await connection.getParsedTransaction(signature, {
      maxSupportedTransactionVersion: 0,
      commitment: 'confirmed'
    });

    if (!tx) {
      throw new Error('Transaction not found');
    }

    console.log(`Parsing transaction ${signature} with ${tx.transaction.message.instructions.length} instructions`);

    // Create proper IDL definitions for better parsing
    // Use the imported idl if available, otherwise create basic ones
    console.log('Using IDL-based parsing with', idl ? 'external IDL' : 'built-in IDL definitions');

    // Use type assertion to bypass strict typing for IDL creation
    const systemIdl = {
      version: "0.1.0",
      name: "system",
      instructions: [
        {
          name: "createAccount",
          accounts: [
            { name: "from", isMut: true, isSigner: true, docs: ["Funding account"] },
            { name: "to", isMut: true, isSigner: true, docs: ["New account"] }
          ],
          args: [
            { name: "lamports", type: "u64" },
            { name: "space", type: "u64" },
            { name: "owner", type: "pubkey" }
          ]
        },
        {
          name: "transfer",
          accounts: [
            { name: "from", isMut: true, isSigner: true, docs: ["Funding account"] },
            { name: "to", isMut: true, isSigner: false, docs: ["Recipient account"] }
          ],
          args: [{ name: "lamports", type: "u64" }]
        }
      ],
      metadata: {
        name: "system",
        version: "0.1.0",
        spec: "0.1.0"
      }
    } as unknown as Idl;

    const tokenIdl = {
      version: "0.1.0",
      name: "token",
      instructions: [
        {
          name: "transfer",
          accounts: [
            { name: "source", isMut: true, isSigner: false, docs: ["Source token account"] },
            { name: "destination", isMut: true, isSigner: false, docs: ["Destination token account"] },
            { name: "authority", isMut: false, isSigner: true, docs: ["Transfer authority"] }
          ],
          args: [{ name: "amount", type: "u64" }]
        },
        {
          name: "mintTo",
          accounts: [
            { name: "mint", isMut: true, isSigner: false, docs: ["Token mint"] },
            { name: "to", isMut: true, isSigner: false, docs: ["Destination token account"] },
            { name: "authority", isMut: false, isSigner: true, docs: ["Mint authority"] }
          ],
          args: [{ name: "amount", type: "u64" }]
        }
      ],
      metadata: {
        name: "token",
        version: "0.1.0",
        spec: "0.1.0"
      }
    } as unknown as Idl;

    // Initialize parser with proper IDL definitions
    const parser = new SolanaParser([
      { programId: COMMON_PROGRAM_IDS.SYSTEM, idl: systemIdl },
      { programId: COMMON_PROGRAM_IDS.TOKEN, idl: tokenIdl },
      { programId: COMMON_PROGRAM_IDS.ASSOCIATED_TOKEN, idl: tokenIdl },
      { programId: COMMON_PROGRAM_IDS.COMPUTE_BUDGET, idl: systemIdl },
      { programId: COMMON_PROGRAM_IDS.TOKEN_2022, idl: tokenIdl },
      { programId: COMMON_PROGRAM_IDS.TOKEN_METADATA, idl: tokenIdl }
    ]);

    // Parse using solana-tx-parser with retry logic
    let retries = 3;
    let rawInstructions: any[] | null = null;
    while (retries > 0) {
      try {
        rawInstructions = await parser.parseTransactionByHash(connection, signature);
        break;
      } catch (error) {
        console.warn(`Parse attempt failed, ${retries - 1} retries remaining:`, error);
        retries--;
        if (retries === 0) {
          console.error('All parse attempts failed, falling back to basic parsing');
          // Fallback to basic parsing without advanced IDL
          rawInstructions = parseTransactionBasic(tx);
        } else {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, 3 - retries) * 100));
        }
      }
    }

    // Ensure rawInstructions is not null before processing
    if (!rawInstructions || !Array.isArray(rawInstructions)) {
      console.warn('No instructions parsed, falling back to basic parsing');
      rawInstructions = parseTransactionBasic(tx);
    }

    // Transform instructions to match our interface
    const parsedInstructions: ParsedInstruction[] = rawInstructions.map(ix => ({
      name: ix.name || 'unknown',
      programId: ix.programId || new PublicKey('11111111111111111111111111111111'),
      programName: getProgramName((ix.programId || new PublicKey('11111111111111111111111111111111')).toString()),
      args: ix.args || {},
      accounts: (ix.accounts || []).map((acc: any) => ({
        name: acc.name,
        isSigner: acc.isSigner || false,
        isWritable: acc.isWritable || false,
        pubkey: acc.pubkey || new PublicKey('11111111111111111111111111111111'),
        preBalance: getAccountBalance(tx, acc.pubkey, 'pre'),
        postBalance: getAccountBalance(tx, acc.pubkey, 'post')
      }))
    }));

    console.log(`Successfully parsed ${parsedInstructions.length} instructions for transaction ${signature}`);

    return {
      parsedInstructions,
      logs: tx.meta?.logMessages || [],
      parsedTransaction: tx
    };
  } catch (error) {
    console.error('Error parsing transaction:', error);
    throw error;
  }
}

// Helper function to get human-readable program names
function getProgramName(programId: string): string {
  const KNOWN_PROGRAMS: Record<string, string> = {
    '11111111111111111111111111111111': 'System Program',
    'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA': 'Token Program',
    'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL': 'Associated Token Program',
    'ComputeBudget111111111111111111111111111111': 'Compute Budget Program',
    'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb': 'Token-2022 Program',
    'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s': 'Token Metadata Program',
    // Add more known programs as needed
  };

  return KNOWN_PROGRAMS[programId] || 'Unknown Program';
}

// Fallback parsing function for when advanced parsing fails
function parseTransactionBasic(tx: ParsedTransactionWithMeta): any[] {
  console.log('Using basic transaction parsing fallback');

  const instructions = tx.transaction.message.instructions || [];

  return instructions.map((instruction: any, index: number) => {
    const programId = instruction.programId || new PublicKey('11111111111111111111111111111111');

    return {
      name: `instruction_${index}`,
      programId: typeof programId === 'string' ? new PublicKey(programId) : programId,
      args: instruction.parsed || {},
      accounts: instruction.accounts || []
    };
  });
}

// Helper function to get account balance from transaction metadata
function getAccountBalance(
  tx: ParsedTransactionWithMeta,
  pubkey: PublicKey | string,
  type: 'pre' | 'post'
): number | undefined {
  if (!tx.meta || !pubkey) return undefined;

  try {
    const pubkeyStr = typeof pubkey === 'string' ? pubkey : pubkey.toString();
    const accountKeys = tx.transaction.message.accountKeys;

    // Find account index
    let accountIndex = -1;
    for (let i = 0; i < accountKeys.length; i++) {
      const key = accountKeys[i];
      const keyStr = typeof key === 'string' ? key : key.pubkey?.toString() || key.toString();
      if (keyStr === pubkeyStr) {
        accountIndex = i;
        break;
      }
    }

    if (accountIndex === -1) return undefined;

    // Get balance from metadata
    const balances = type === 'pre' ? tx.meta.preBalances : tx.meta.postBalances;
    if (!balances || accountIndex >= balances.length) {
      console.warn(`Balance array missing or too short for account index ${accountIndex}`);
      return undefined;
    }
    return balances[accountIndex];
  } catch (error) {
    console.warn(`Error getting ${type} balance for account:`, error);
    return undefined;
  }
}
