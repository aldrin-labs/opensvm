import { Connection } from '@solana/web3.js';
import { SolanaAgent } from '../../components/ai/core/agent';
import {
  AccountCapability,
  AnomalyDetectionCapability,
  GenerativeCapability,
  NetworkCapability,
  PlanningCapability,
  SolanaAgentKitCapability,
  SonicCapability,
  TokenEstimationCapability,
  TransactionCapability,
  WalletCapability,
} from './capabilities';
import {
  ACCOUNT_TOOLS,
  TRANSACTION_TOOLS,
  VALIDATOR_TOOLS,
  SYSTEM_TOOLS,
} from './tools';

const MAINNET_RPC_URL = process.env.RPC_URL || 'https://api.mainnet-beta.solana.com';

export function createAgent() {
  const connection = new Connection(MAINNET_RPC_URL);

  const capabilities = [
    new AccountCapability(connection, ACCOUNT_TOOLS),
    new AnomalyDetectionCapability(connection),
    new GenerativeCapability(),
    new NetworkCapability(connection, VALIDATOR_TOOLS),
    new PlanningCapability(),
    new SolanaAgentKitCapability(),
    new SonicCapability(SYSTEM_TOOLS),
    new TokenEstimationCapability(),
    new TransactionCapability(connection, TRANSACTION_TOOLS),
    new WalletCapability(connection),
  ];

  const agent = new SolanaAgent({
    capabilities,
    systemPrompt: 'You are a helpful Solana expert.',
  });

  return agent;
}
