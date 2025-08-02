import { Connection } from '@solana/web3.js';
import { SolanaAgent } from './agent';
import type { AgentConfig } from '../types';

export function createSolanaAgent(_connection: Connection): SolanaAgent {
  const config: AgentConfig = {
    capabilities: [],
    systemPrompt: 'I am an AI assistant specialized in analyzing Solana blockchain data.',
    maxContextSize: 4000,
    temperature: 0.7
  };
  return new SolanaAgent(config);
}
