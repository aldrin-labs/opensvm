import { Connection, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';

const getAccountInfo = {
  name: 'getAccountInfo',
  description: 'Get complete account details including balance, owner, executable status, and raw data',
  execute: async ({ account, connection }: { account: string; connection: Connection }) => {
    const publicKey = new PublicKey(account);
    const accountInfo = await connection.getAccountInfo(publicKey);
    return accountInfo;
  },
};

const getBalance = {
  name: 'getBalance',
  description: 'Get SOL balance in lamports for any address',
  execute: async ({ account, connection }: { account: string; connection: Connection }) => {
    const publicKey = new PublicKey(account);
    const balance = await connection.getBalance(publicKey);
    return { lamports: balance, sol: balance / LAMPORTS_PER_SOL };
  },
};

const getMultipleAccounts = {
  name: 'getMultipleAccounts',
  description: 'Efficiently batch query up to 100 accounts simultaneously',
  execute: async ({ accounts, connection }: { accounts: string[]; connection: Connection }) => {
    const publicKeys = accounts.map(account => new PublicKey(account));
    const accountsInfo = await connection.getMultipleAccountsInfo(publicKeys);
    return accountsInfo;
  },
};

const getProgramAccounts = {
  name: 'getProgramAccounts',
  description: 'Get all accounts owned by a specific program with advanced filtering options',
  execute: async ({ programId, connection }: { programId: string; connection: Connection }) => {
    const publicKey = new PublicKey(programId);
    const accounts = await connection.getProgramAccounts(publicKey);
    return accounts;
  },
};

const getTransaction = {
  name: 'getTransaction',
  description: 'Get complete transaction details with metadata, logs, account changes, and instruction breakdown',
  execute: async ({ signature, connection }: { signature: string; connection: Connection }) => {
    const transaction = await connection.getTransaction(signature, { maxSupportedTransactionVersion: 0 });
    return transaction;
  },
};

const getSignaturesForAddress = {
  name: 'getSignaturesForAddress',
  description: 'Get comprehensive transaction history for any address with pagination support',
  execute: async ({ account, connection }: { account: string; connection: Connection }) => {
    const publicKey = new PublicKey(account);
    const signatures = await connection.getSignaturesForAddress(publicKey);
    return signatures;
  },
};

const simulateTransaction = {
  name: 'simulateTransaction',
  description: 'Test transaction execution before sending to predict outcomes and compute usage',
  execute: async ({ transaction, connection }: { transaction: any; connection: Connection }) => {
    const simulationResult = await connection.simulateTransaction(transaction);
    return simulationResult;
  },
};

const getSignatureStatuses = {
  name: 'getSignatureStatuses',
  description: 'Check confirmation status and finality of multiple transactions',
  execute: async ({ signatures, connection }: { signatures: string[]; connection: Connection }) => {
    const statuses = await connection.getSignatureStatuses(signatures);
    return statuses;
  },
};

const getEpochInfo = {
  name: 'getEpochInfo',
  description: 'Current epoch information, slot numbers, block height, and network timing',
  execute: async ({ connection }: { connection: Connection }) => {
    const epochInfo = await connection.getEpochInfo();
    return epochInfo;
  },
};

const getSlot = {
  name: 'getSlot',
  description: 'Current slot number at specified commitment level',
  execute: async ({ connection }: { connection: Connection }) => {
    const slot = await connection.getSlot();
    return slot;
  },
};

const getBlockHeight = {
  name: 'getBlockHeight',
  description: 'Current block height of the blockchain',
  execute: async ({ connection }: { connection: Connection }) => {
    const blockHeight = await connection.getBlockHeight();
    return blockHeight;
  },
};

const getRecentPerformanceSamples = {
  name: 'getRecentPerformanceSamples',
  description: 'Network TPS, transaction throughput, and performance metrics over time',
  execute: async ({ connection }: { connection: Connection }) => {
    const samples = await connection.getRecentPerformanceSamples(5);
    return samples;
  },
};

const getVoteAccounts = {
  name: 'getVoteAccounts',
  description: 'Comprehensive validator information, stake distribution, and voting status',
  execute: async ({ connection }: { connection: Connection }) => {
    const voteAccounts = await connection.getVoteAccounts();
    return voteAccounts;
  },
};

const getVersion = {
  name: 'getVersion',
  description: 'Solana node version and supported feature set',
  execute: async ({ connection }: { connection: Connection }) => {
    const version = await connection.getVersion();
    return version;
  },
};

const getBlock = {
  name: 'getBlock',
  description: 'Complete block information with all transactions, metadata, and rewards',
  execute: async ({ slot, connection }: { slot: number; connection: Connection }) => {
    const block = await connection.getBlock(slot, { maxSupportedTransactionVersion: 0 });
    return block;
  },
};

const getBlocks = {
  name: 'getBlocks',
  description: 'List confirmed blocks in a specified range with pagination',
  execute: async ({ startSlot, endSlot, connection }: { startSlot: number; endSlot: number; connection: Connection }) => {
    const blocks = await connection.getBlocks(startSlot, endSlot);
    return blocks;
  },
};

const getTokenAccountBalance = {
  name: 'getTokenAccountBalance',
  description: 'Get SPL token balance for any token account',
  execute: async ({ tokenAccount, connection }: { tokenAccount: string; connection: Connection }) => {
    const publicKey = new PublicKey(tokenAccount);
    const balance = await connection.getTokenAccountBalance(publicKey);
    return balance;
  },
};

const getTokenAccountsByOwner = {
  name: 'getTokenAccountsByOwner',
  description: 'Get all SPL tokens owned by an address with optional mint filtering',
  execute: async ({ owner, connection }: { owner: string; connection: Connection }) => {
    const ownerPublicKey = new PublicKey(owner);
    const accounts = await connection.getParsedTokenAccountsByOwner(ownerPublicKey, { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') });
    return accounts;
  },
};

const getTokenLargestAccounts = {
  name: 'getTokenLargestAccounts',
  description: 'Get top holders of any SPL token for whale analysis',
  execute: async ({ mint, connection }: { mint: string; connection: Connection }) => {
    const mintPublicKey = new PublicKey(mint);
    const largestAccounts = await connection.getTokenLargestAccounts(mintPublicKey);
    return largestAccounts;
  },
};

const getTokenSupply = {
  name: 'getTokenSupply',
  description: 'Get total supply and circulation data for any SPL token',
  execute: async ({ mint, connection }: { mint: string; connection: Connection }) => {
    const mintPublicKey = new PublicKey(mint);
    const supply = await connection.getTokenSupply(mintPublicKey);
    return supply;
  },
};

const getLeaderSchedule = {
  name: 'getLeaderSchedule',
  description: 'Get validator leader schedule for block production',
  execute: async ({ connection }: { connection: Connection }) => {
    const schedule = await connection.getLeaderSchedule();
    return schedule;
  },
};

const getInflationGovernor = {
  name: 'getInflationGovernor',
  description: 'Get network inflation parameters and governance settings',
  execute: async ({ connection }: { connection: Connection }) => {
    const governor = await connection.getInflationGovernor();
    return governor;
  },
};

const getInflationRate = {
  name: 'getInflationRate',
  description: 'Get current epoch inflation rates',
  execute: async ({ connection }: { connection: Connection }) => {
    const rate = await connection.getInflationRate();
    return rate;
  },
};

const getInflationReward = {
  name: 'getInflationReward',
  description: 'Get staking rewards for validators and delegators',
  execute: async ({ addresses, connection }: { addresses: string[]; connection: Connection }) => {
    const publicKeys = addresses.map(address => new PublicKey(address));
    const rewards = await connection.getInflationReward(publicKeys);
    return rewards;
  },
};

const getTokenAccountsByDelegate = {
  name: 'getTokenAccountsByDelegate',
  description: 'Get tokens accessible by delegate authority',
  execute: async ({ delegate, connection }: { delegate: string; connection: Connection }) => {
    const delegatePublicKey = new PublicKey(delegate);
    const accounts = await connection.getParsedTokenAccountsByOwner(delegatePublicKey, { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') });
    return accounts;
  },
};

export const ACCOUNT_TOOLS = [getAccountInfo, getBalance, getMultipleAccounts, getProgramAccounts, getSignaturesForAddress, getTokenAccountBalance, getTokenAccountsByOwner, getTokenLargestAccounts, getTokenSupply, getTokenAccountsByDelegate];
export const TRANSACTION_TOOLS = [getTransaction, simulateTransaction, getSignatureStatuses];
export const VALIDATOR_TOOLS = [getVoteAccounts, getLeaderSchedule];
export const SYSTEM_TOOLS = [getEpochInfo, getSlot, getBlockHeight, getRecentPerformanceSamples, getVersion, getBlock, getBlocks, getInflationGovernor, getInflationRate, getInflationReward];
