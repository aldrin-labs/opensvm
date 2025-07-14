import { Connection } from '@solana/web3.js';
import { SolanaAgent } from './agent';
import { WalletCapability } from '../capabilities/wallet';
import type { AgentConfig, AgentCapability, Message } from '../types';

const DEFAULT_SYSTEM_PROMPT = `I am an AI assistant specialized in analyzing Solana blockchain data.
I can help you understand transactions, account activities, and network performance. 
I have access to real-time blockchain data and can provide detailed analysis.

Some things I can help with:
- Analyzing transactions and their effects
- Checking account balances and token holdings
- Monitoring network performance metrics (TPS, block time, etc.)
- Tracking validator status and performance
- Explaining complex blockchain operations in simple terms
- Estimating token usage for AI models
- Finding paths between wallets by tracking token transfers
- Trading tokens, launching new tokens, and other Solana operations

Please provide transaction signatures, account addresses, or ask about network metrics, 
and I'll help you understand what's happening on the Solana blockchain.`;

export interface AgentOptions {
  systemPrompt?: string;
  maxContextSize?: number;
  temperature?: number;
  enableWalletPathFinding?: boolean;
}

// Simple general conversation capability
class GeneralCapability implements AgentCapability {
  type = 'general' as const;
  
  canHandle(message: Message): boolean {
    // Handle any message that doesn't match other capabilities
    return true;
  }
  
  tools = [{
    name: 'generalConversation',
    description: 'Handle general conversation and Solana blockchain questions',
    execute: async ({ message }: { message: Message }) => {
      // For general questions about Solana, provide helpful responses
      const content = message.content.toLowerCase();
      
      if (content.includes('solana') || content.includes('blockchain')) {
        return {
          message: `Solana is a high-performance blockchain designed for decentralized applications and crypto-currencies. It uses a unique Proof of History (PoH) consensus mechanism combined with Proof of Stake (PoS) to achieve fast transaction speeds and low costs.

Key features of Solana:
- **Speed**: Can process up to 65,000 transactions per second
- **Low Cost**: Transaction fees are typically less than $0.01
- **Energy Efficient**: Uses significantly less energy than Bitcoin
- **Developer Friendly**: Supports smart contracts written in Rust, C, and C++
- **Ecosystem**: Home to many DeFi protocols, NFT marketplaces, and Web3 applications

The native token SOL is used for staking, transaction fees, and governance. Popular applications include Serum (DEX), Magic Eden (NFT marketplace), and many DeFi protocols.

How can I help you explore the Solana blockchain today?`
        };
      }
      
      if (content.includes('help') || content.includes('what can you do')) {
        return {
          message: `I'm your Solana blockchain assistant! Here's what I can help you with:

**🔍 Transaction Analysis**
- Get detailed transaction information
- Analyze smart contract interactions
- Track token transfers

**💰 Account & Balance Checking**
- Check SOL and token balances
- View account history
- Monitor wallet activity

**📊 Network Monitoring**
- Current TPS (transactions per second)
- Network performance metrics
- Validator status

**🔗 Wallet Path Finding**
- Find connections between wallets
- Track token flows between addresses

**🚀 DeFi & Trading**
- Monitor pump.fun tokens
- Track bonding curves
- Execute trades

Just ask me about any Solana address, transaction, or tell me what you'd like to explore!`
        };
      }
      
      return {
        message: `I'm here to help with Solana blockchain questions! You can ask me about:

- Transaction details (provide a signature)
- Account balances (provide an address) 
- Network performance
- DeFi protocols and tokens
- How Solana works

What would you like to know about the Solana blockchain?`
      };
    }
  }];
}

export function createSolanaAgent(
  connection: Connection, 
  options: AgentOptions = {}
): SolanaAgent {
  const capabilities = [];
  
  // Add wallet path finding capability
  if (options.enableWalletPathFinding !== false) {
    capabilities.push(new WalletCapability(connection));
  }
  
  // Add general conversation capability as fallback
  capabilities.push(new GeneralCapability());
  
  const config: AgentConfig = {
    capabilities,
    systemPrompt: options.systemPrompt || DEFAULT_SYSTEM_PROMPT,
    maxContextSize: options.maxContextSize,
    temperature: options.temperature
  };

  return new SolanaAgent(config);
}
