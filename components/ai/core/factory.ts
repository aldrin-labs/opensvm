import { Connection } from '@solana/web3.js';
import { SolanaAgent } from './agent';
import type { AgentConfig } from '../types';
import { NetworkCapability } from '../capabilities/network';
import { TransactionCapability } from '../capabilities/transaction';
import { AccountCapability } from '../capabilities/account';
import { ProgramCapability } from '../capabilities/program';
import { ResearchCapability } from '../capabilities/research';

export function createSolanaAgent(_connection: Connection): SolanaAgent {
  const config: AgentConfig = {
    capabilities: [
      new NetworkCapability(_connection),
      new TransactionCapability(_connection),
      new AccountCapability(_connection),
      new ProgramCapability(_connection),
      new ResearchCapability(_connection)
    ],
    systemPrompt: 'I am an AI assistant specialized in analyzing Solana blockchain data.',
    maxContextSize: 4000,
    temperature: 0.7
  };
  return new SolanaAgent(config);
}
