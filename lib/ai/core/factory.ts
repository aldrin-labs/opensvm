import { Connection } from '@solana/web3.js';
import { SolanaAgent } from './agent';
import { TransactionCapability } from '../capabilities/transaction';
import { AccountCapability } from '../capabilities/account';
import { NetworkCapability } from '../capabilities/network';
import { TokenEstimationCapability } from '../capabilities/token-estimation';
import { WalletCapability } from '../capabilities/wallet';
import { AnomalyDetectionCapability } from '../capabilities/anomaly-detection';
import type { AgentConfig } from '../types';
import { SonicCapability } from '../capabilities/sonic';
import { SolanaAgentKitCapability } from '../capabilities/solana-agent-kit';

const DEFAULT_SYSTEM_PROMPT = `I am an AI assistant specialized in analyzing Solana blockchain data.
I can help you understand transactions, account activities, and network performance. 
I have access to real-time blockchain data and can provide detailed analysis.

Some things I can help with:
- Analyzing transactions and their effects
- Checking account balances and activity
- Monitoring network performance metrics (TPS, block time, etc.)
- Tracking validator status and performance
- Explaining complex blockchain operations in simple terms
- Estimating token usage for AI models
- Finding paths between wallets by tracking token transfers
- Interacting with Sonic protocols
- Trading tokens, launching new tokens, and other Solana operations
- Real-time anomaly detection and alerting for suspicious activities

For network performance queries:
- Use analyzeNetworkLoad to get current TPS and load metrics
- Use getNetworkStatus for general network health
- Use getValidatorInfo for validator statistics

For anomaly detection:
- Use analyzeEvent to check blockchain events for suspicious patterns
- Use getAnomalyAlerts to see recent security alerts
- Use getAnomalyStats for anomaly detection statistics

Please provide transaction signatures, account addresses, or ask about network metrics, 
and I'll help you understand what's happening on the Solana blockchain.`;

export interface AgentOptions {
  systemPrompt?: string;
  maxContextSize?: number;
  temperature?: number;
  enableSonicKit?: boolean;
  enableSolanaAgentKit?: boolean;
  enableWalletPathFinding?: boolean;
  enableAnomalyDetection?: boolean;
}

export function createSolanaAgent(
  connection: Connection, 
  options: AgentOptions = {}
): SolanaAgent {
  const capabilities = [
    new TransactionCapability(connection),
    new AccountCapability(connection),
    new NetworkCapability(connection),
    new TokenEstimationCapability()
  ];
  
  // Add optional capabilities based on options
  if (options.enableSonicKit !== false) {
    capabilities.push(new SonicCapability(connection));
  }
  
  if (options.enableSolanaAgentKit !== false) {
    capabilities.push(new SolanaAgentKitCapability(connection));
  }
  
  // Add wallet path finding capability
  if (options.enableWalletPathFinding !== false) {
    capabilities.push(new WalletCapability(connection));
  }
  
  // Add anomaly detection capability
  if (options.enableAnomalyDetection !== false) {
    capabilities.push(new AnomalyDetectionCapability(connection));
  }
  
  const config: AgentConfig = {
    capabilities,
    systemPrompt: options.systemPrompt || DEFAULT_SYSTEM_PROMPT,
    maxContextSize: options.maxContextSize,
    temperature: options.temperature
  };

  return new SolanaAgent(config);
}

export function createAgentConfig(options: AgentOptions = {}): AgentConfig {
  // This function creates the config but doesn't instantiate the agent
  // Useful for testing and configuration
  return {
    capabilities: [], // Will be populated by createSolanaAgent
    systemPrompt: options.systemPrompt || DEFAULT_SYSTEM_PROMPT,
    maxContextSize: options.maxContextSize,
    temperature: options.temperature
  };
}
