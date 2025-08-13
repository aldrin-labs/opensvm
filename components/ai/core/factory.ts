import { Connection } from '@solana/web3.js';
import { SolanaAgent } from './agent';
import type { AgentConfig } from '../types';
import { NetworkCapability } from '../capabilities/network';
import { TransactionCapability } from '../capabilities/transaction';
import { AccountCapability } from '../capabilities/account';
import { ProgramCapability } from '../capabilities/program';
import { ResearchCapability } from '../capabilities/research';
import { MockSolanaAgent } from './mockAgent';

function isE2eMockEnabled(): boolean {
  try {
    // Env toggle (build-time/public)
    if (process.env.NEXT_PUBLIC_AI_E2E_MOCK === '1' || process.env.NEXT_PUBLIC_AI_E2E_MOCK === 'true') return true;
  } catch { /* noop */ }
  if (typeof window !== 'undefined') {
    try {
      // Window flag for tests
      if ((window as any).__E2E_AI_MOCK__ === true) return true;
      // URL param toggle
      const params = new URLSearchParams(window.location.search);
      const v = params.get('aimock');
      if (v && (v === '1' || v.toLowerCase() === 'true' || v.toLowerCase() === 'yes')) return true;
    } catch { /* noop */ }
  }
  return false;
}

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
  if (isE2eMockEnabled()) {
    // Cast to SolanaAgent to satisfy callers; Mock implements the used surface (processMessage/clearContext)
    return new MockSolanaAgent(config) as unknown as SolanaAgent;
  }
  return new SolanaAgent(config);
}
