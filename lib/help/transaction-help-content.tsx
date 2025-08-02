import React from 'react';
import { HelpContent } from '@/components/help/ContextualHelp';
import {
  ZapIcon,
  CoinsIcon,
  UsersIcon,
  ShieldIcon,
  TrendingUpIcon,
  NetworkIcon,
  FileTextIcon,
  AlertTriangleIcon,
  InfoIcon,
  CheckCircleIcon
} from 'lucide-react';

export const transactionHelpContent: Record<string, HelpContent> = {
  // Transaction Overview
  'transaction-signature': {
    id: 'transaction-signature',
    title: 'Transaction Signature',
    description: 'A unique identifier for this transaction on the Solana blockchain',
    type: 'concept',
    content: (
      <div className="space-y-3">
        <p>
          The transaction signature is a cryptographic hash that uniquely identifies this transaction.
          It's generated when the transaction is signed and submitted to the network.
        </p>
        <div className="bg-muted/20 p-3 rounded-md">
          <h4 className="font-medium mb-2">Key Properties:</h4>
          <ul className="text-sm space-y-1">
            <li>• 88 characters long (Base58 encoded)</li>
            <li>• Globally unique across all Solana transactions</li>
            <li>• Used to query transaction status and details</li>
            <li>• Cannot be changed once created</li>
          </ul>
        </div>
      </div>
    ),
    relatedTopics: ['Transaction Status', 'Blockchain Finality', 'Digital Signatures'],
    externalLinks: [
      {
        title: 'Solana Transaction Structure',
        url: 'https://docs.solana.com/developing/programming-model/transactions',
        description: 'Official documentation on Solana transactions'
      }
    ]
  },

  'transaction-status': {
    id: 'transaction-status',
    title: 'Transaction Status',
    description: 'The current confirmation status of this transaction',
    type: 'info',
    content: (
      <div className="space-y-3">
        <p>
          Transaction status indicates how many confirmations the transaction has received
          and its level of finality on the blockchain.
        </p>
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
            <span className="font-medium">Processed:</span>
            <span className="text-sm">Transaction executed but not yet confirmed</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <span className="font-medium">Confirmed:</span>
            <span className="text-sm">Transaction has majority cluster confirmation</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span className="font-medium">Finalized:</span>
            <span className="text-sm">Transaction is permanently committed</span>
          </div>
        </div>
      </div>
    ),
    relatedTopics: ['Blockchain Confirmations', 'Network Consensus', 'Transaction Finality']
  },

  'transaction-fee': {
    id: 'transaction-fee',
    title: 'Transaction Fee',
    description: 'The cost paid to process this transaction on the Solana network',
    type: 'info',
    content: (
      <div className="space-y-3">
        <p>
          Transaction fees on Solana are paid in SOL and consist of a base fee plus
          priority fees for faster processing.
        </p>
        <div className="bg-muted/20 p-3 rounded-md">
          <h4 className="font-medium mb-2">Fee Components:</h4>
          <ul className="text-sm space-y-1">
            <li>• <strong>Base Fee:</strong> Fixed cost per signature (~0.000005 SOL)</li>
            <li>• <strong>Priority Fee:</strong> Optional fee for faster processing</li>
            <li>• <strong>Compute Fee:</strong> Based on computational resources used</li>
          </ul>
        </div>
        <div className="text-sm text-muted-foreground">
          💡 <strong>Tip:</strong> Higher priority fees can help your transaction get processed faster during network congestion.
        </div>
      </div>
    ),
    relatedTopics: ['Compute Units', 'Priority Fees', 'Network Congestion']
  },

  // Instructions
  'instruction-parsing': {
    id: 'instruction-parsing',
    title: 'Instruction Parsing',
    description: 'How transaction instructions are decoded and displayed',
    type: 'concept',
    content: (
      <div className="space-y-3">
        <p>
          Instructions are the individual operations within a transaction. Our system
          parses these instructions to show you what each one does in human-readable format.
        </p>
        <div className="bg-muted/20 p-3 rounded-md">
          <h4 className="font-medium mb-2">Parsing Process:</h4>
          <ol className="text-sm space-y-1 list-decimal list-inside">
            <li>Identify the program being called</li>
            <li>Decode the instruction data</li>
            <li>Map accounts to their roles</li>
            <li>Generate human-readable description</li>
          </ol>
        </div>
      </div>
    ),
    relatedTopics: ['Solana Programs', 'Instruction Data', 'Account Roles']
  },

  'instruction-risk': {
    id: 'instruction-risk',
    title: 'Risk Assessment',
    description: 'How we evaluate the risk level of transaction instructions',
    type: 'warning',
    content: (
      <div className="space-y-3">
        <p>
          We analyze each instruction to assess potential risks based on the operation type,
          program reputation, and account interactions.
        </p>
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <ShieldIcon className="w-4 h-4 text-green-500" />
            <span className="font-medium text-green-600">Low Risk:</span>
            <span className="text-sm">Standard operations with known programs</span>
          </div>
          <div className="flex items-center space-x-2">
            <InfoIcon className="w-4 h-4 text-yellow-500" />
            <span className="font-medium text-yellow-600">Medium Risk:</span>
            <span className="text-sm">Complex operations or unknown programs</span>
          </div>
          <div className="flex items-center space-x-2">
            <AlertTriangleIcon className="w-4 h-4 text-red-500" />
            <span className="font-medium text-red-600">High Risk:</span>
            <span className="text-sm">Potentially dangerous operations</span>
          </div>
        </div>
        <div className="text-sm text-muted-foreground">
          ⚠️ <strong>Note:</strong> Risk assessment is automated and should not be the only factor in your decision-making.
        </div>
      </div>
    ),
    relatedTopics: ['Security Best Practices', 'Program Verification', 'Transaction Safety']
  },

  'compute-units': {
    id: 'compute-units',
    title: 'Compute Units',
    description: 'Computational resources consumed by this instruction',
    type: 'info',
    content: (
      <div className="space-y-3">
        <p>
          Compute Units (CU) measure the computational work required to execute an instruction.
          Each transaction has a limit of 1.4 million CU.
        </p>
        <div className="bg-muted/20 p-3 rounded-md">
          <h4 className="font-medium mb-2 flex items-center gap-2">
            <ZapIcon className="w-4 h-4 text-yellow-500" />
            Understanding CU Usage:
          </h4>
          <ul className="text-sm space-y-1">
            <li>• Simple transfers: ~150-300 CU</li>
            <li>• Token operations: ~2,000-5,000 CU</li>
            <li>• Complex DeFi operations: ~50,000+ CU</li>
            <li>• Maximum per transaction: 1,400,000 CU</li>
          </ul>
        </div>
      </div>
    ),
    relatedTopics: ['Transaction Limits', 'Performance Optimization', 'Fee Calculation']
  },

  // Account Changes
  'account-changes': {
    id: 'account-changes',
    title: 'Account Changes',
    description: 'How account states are modified by this transaction',
    type: 'concept',
    content: (
      <div className="space-y-3">
        <p>
          Account changes show the before and after states of all accounts affected by this transaction,
          including balance changes, data modifications, and ownership transfers.
        </p>
        <div className="bg-muted/20 p-3 rounded-md">
          <h4 className="font-medium mb-2 flex items-center gap-2">
            <UsersIcon className="w-4 h-4 text-blue-500" />
            Types of Changes:
          </h4>
          <ul className="text-sm space-y-1">
            <li>• <strong>Balance Changes:</strong> SOL amount increases/decreases</li>
            <li>• <strong>Token Changes:</strong> SPL token balance modifications</li>
            <li>• <strong>Data Changes:</strong> Account data updates</li>
            <li>• <strong>Ownership Changes:</strong> Account owner modifications</li>
          </ul>
        </div>
      </div>
    ),
    relatedTopics: ['Account Model', 'State Transitions', 'Balance Tracking']
  },

  'balance-changes': {
    id: 'balance-changes',
    title: 'Balance Changes',
    description: 'SOL balance modifications for accounts in this transaction',
    type: 'info',
    content: (
      <div className="space-y-3">
        <p>
          Balance changes show how much SOL each account gained or lost during this transaction.
          This includes transfers, fees, and rent payments.
        </p>
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <TrendingUpIcon className="w-4 h-4 text-green-500" />
            <span className="text-green-600">Positive change:</span>
            <span className="text-sm">Account received SOL</span>
          </div>
          <div className="flex items-center space-x-2">
            <TrendingUpIcon className="w-4 h-4 text-red-500 rotate-180" />
            <span className="text-red-600">Negative change:</span>
            <span className="text-sm">Account sent SOL or paid fees</span>
          </div>
        </div>
        <div className="text-sm text-muted-foreground">
          💡 <strong>Note:</strong> All amounts are displayed in SOL (1 SOL = 1,000,000,000 lamports).
        </div>
      </div>
    ),
    relatedTopics: ['SOL Token', 'Lamports', 'Transaction Fees']
  },

  'token-changes': {
    id: 'token-changes',
    title: 'Token Changes',
    description: 'SPL token balance modifications in this transaction',
    type: 'info',
    content: (
      <div className="space-y-3">
        <p>
          Token changes show modifications to SPL token balances, including transfers,
          mints, burns, and other token operations.
        </p>
        <div className="bg-muted/20 p-3 rounded-md">
          <h4 className="font-medium mb-2 flex items-center gap-2">
            <CoinsIcon className="w-4 h-4 text-amber-500" />
            Change Significance:
          </h4>
          <ul className="text-sm space-y-1">
            <li>• <strong>High:</strong> Large amounts or critical operations</li>
            <li>• <strong>Medium:</strong> Moderate amounts or standard operations</li>
            <li>• <strong>Low:</strong> Small amounts or routine operations</li>
          </ul>
        </div>
      </div>
    ),
    relatedTopics: ['SPL Tokens', 'Token Accounts', 'Token Programs']
  },

  'rent-exemption': {
    id: 'rent-exemption',
    title: 'Rent Exemption',
    description: 'Account rent status and exemption requirements',
    type: 'concept',
    content: (
      <div className="space-y-3">
        <p>
          Solana accounts must maintain a minimum balance to be "rent-exempt" and avoid
          being garbage collected by the network.
        </p>
        <div className="bg-muted/20 p-3 rounded-md">
          <h4 className="font-medium mb-2">Rent System:</h4>
          <ul className="text-sm space-y-1">
            <li>• Accounts with sufficient balance are rent-exempt</li>
            <li>• Rent-exempt accounts are never deleted</li>
            <li>• Minimum balance depends on account size</li>
            <li>• System automatically calculates required amount</li>
          </ul>
        </div>
      </div>
    ),
    relatedTopics: ['Account Lifecycle', 'Storage Costs', 'Network Economics']
  },

  // AI Analysis
  'ai-analysis': {
    id: 'ai-analysis',
    title: 'AI Transaction Analysis',
    description: 'How our AI system analyzes and explains transactions',
    type: 'concept',
    content: (
      <div className="space-y-3">
        <p>
          Our AI system analyzes transaction data to provide natural language explanations,
          risk assessments, and insights about what the transaction accomplishes.
        </p>
        <div className="bg-muted/20 p-3 rounded-md">
          <h4 className="font-medium mb-2 flex items-center gap-2">
            <FileTextIcon className="w-4 h-4 text-indigo-500" />
            Analysis Components:
          </h4>
          <ul className="text-sm space-y-1">
            <li>• <strong>Purpose Identification:</strong> What the transaction does</li>
            <li>• <strong>Risk Assessment:</strong> Potential security concerns</li>
            <li>• <strong>Impact Analysis:</strong> Effects on accounts and tokens</li>
            <li>• <strong>Context Explanation:</strong> Why this transaction matters</li>
          </ul>
        </div>
        <div className="text-sm text-muted-foreground">
          🤖 <strong>Note:</strong> AI analysis is provided for educational purposes and should not be considered financial advice.
        </div>
      </div>
    ),
    relatedTopics: ['Machine Learning', 'Transaction Patterns', 'Automated Analysis']
  },

  'risk-factors': {
    id: 'risk-factors',
    title: 'Risk Factors',
    description: 'Potential security and financial risks identified in this transaction',
    type: 'warning',
    content: (
      <div className="space-y-3">
        <p>
          Our system identifies potential risks based on transaction patterns,
          program interactions, and known security vulnerabilities.
        </p>
        <div className="bg-muted/20 p-3 rounded-md">
          <h4 className="font-medium mb-2">Common Risk Factors:</h4>
          <ul className="text-sm space-y-1">
            <li>• Unknown or unverified programs</li>
            <li>• Large token transfers</li>
            <li>• Authority changes</li>
            <li>• Complex instruction sequences</li>
            <li>• Unusual account interactions</li>
          </ul>
        </div>
        <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 p-2 rounded">
          ⚠️ Always verify transaction details before signing, especially for high-risk operations.
        </div>
      </div>
    ),
    relatedTopics: ['Security Best Practices', 'Due Diligence', 'Transaction Verification']
  },

  // Related Transactions
  'related-transactions': {
    id: 'related-transactions',
    title: 'Related Transactions',
    description: 'How we find and rank transactions related to this one',
    type: 'concept',
    content: (
      <div className="space-y-3">
        <p>
          Related transactions are found by analyzing account interactions, program usage,
          and temporal proximity to help you understand transaction flows and patterns.
        </p>
        <div className="bg-muted/20 p-3 rounded-md">
          <h4 className="font-medium mb-2 flex items-center gap-2">
            <NetworkIcon className="w-4 h-4 text-purple-500" />
            Relationship Types:
          </h4>
          <ul className="text-sm space-y-1">
            <li>• <strong>Same Accounts:</strong> Transactions involving same accounts</li>
            <li>• <strong>Same Programs:</strong> Using identical programs</li>
            <li>• <strong>Token Flows:</strong> Following token transfers</li>
            <li>• <strong>Time Proximity:</strong> Occurring close in time</li>
            <li>• <strong>Authority Chains:</strong> Connected through authorities</li>
          </ul>
        </div>
      </div>
    ),
    relatedTopics: ['Transaction Flows', 'Pattern Analysis', 'Blockchain Forensics']
  },

  'relationship-strength': {
    id: 'relationship-strength',
    title: 'Relationship Strength',
    description: 'How we calculate the strength of relationships between transactions',
    type: 'info',
    content: (
      <div className="space-y-3">
        <p>
          Relationship strength is calculated based on multiple factors including shared accounts,
          programs, timing, and transaction patterns.
        </p>
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span className="font-medium text-green-600">Strong (80-100%):</span>
            <span className="text-sm">Direct relationships, shared critical accounts</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
            <span className="font-medium text-yellow-600">Medium (40-79%):</span>
            <span className="text-sm">Some shared elements, temporal proximity</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
            <span className="font-medium text-gray-600">Weak (1-39%):</span>
            <span className="text-sm">Minimal connections, distant relationships</span>
          </div>
        </div>
      </div>
    ),
    relatedTopics: ['Graph Analysis', 'Network Theory', 'Transaction Clustering']
  },

  // Transaction Graph
  'transaction-graph': {
    id: 'transaction-graph',
    title: 'Transaction Graph',
    description: 'Visual representation of transaction flows and account relationships',
    type: 'concept',
    content: (
      <div className="space-y-3">
        <p>
          The transaction graph visualizes how accounts, programs, and tokens interact
          within this transaction using nodes and edges to show relationships.
        </p>
        <div className="bg-muted/20 p-3 rounded-md">
          <h4 className="font-medium mb-2">Graph Elements:</h4>
          <ul className="text-sm space-y-1">
            <li>• <strong>Nodes:</strong> Accounts, programs, and tokens</li>
            <li>• <strong>Edges:</strong> Transfers, instructions, and interactions</li>
            <li>• <strong>Colors:</strong> Different types and roles</li>
            <li>• <strong>Size:</strong> Importance and activity level</li>
          </ul>
        </div>
        <div className="text-sm text-muted-foreground">
          💡 <strong>Tip:</strong> Use zoom and pan controls to explore complex transactions. Click nodes for detailed information.
        </div>
      </div>
    ),
    relatedTopics: ['Graph Theory', 'Network Visualization', 'Data Relationships']
  },

  'graph-controls': {
    id: 'graph-controls',
    title: 'Graph Controls',
    description: 'How to interact with and customize the transaction graph',
    type: 'tip',
    content: (
      <div className="space-y-3">
        <p>
          Use the graph controls to customize your view and interact with the visualization
          for better understanding of transaction flows.
        </p>
        <div className="bg-muted/20 p-3 rounded-md">
          <h4 className="font-medium mb-2">Available Controls:</h4>
          <ul className="text-sm space-y-1">
            <li>• <strong>Zoom In/Out:</strong> Adjust detail level</li>
            <li>• <strong>Reset View:</strong> Return to default position</li>
            <li>• <strong>Play/Pause:</strong> Control animation</li>
            <li>• <strong>Filters:</strong> Show/hide node and edge types</li>
            <li>• <strong>Search:</strong> Find specific accounts or programs</li>
            <li>• <strong>Export:</strong> Save graph as image</li>
          </ul>
        </div>
      </div>
    ),
    relatedTopics: ['User Interface', 'Visualization Tools', 'Data Export']
  },

  // Performance Metrics
  'transaction-metrics': {
    id: 'transaction-metrics',
    title: 'Transaction Metrics',
    description: 'Performance and efficiency measurements for this transaction',
    type: 'info',
    content: (
      <div className="space-y-3">
        <p>
          Transaction metrics help you understand the performance characteristics,
          costs, and efficiency of this transaction compared to similar operations.
        </p>
        <div className="bg-muted/20 p-3 rounded-md">
          <h4 className="font-medium mb-2">Key Metrics:</h4>
          <ul className="text-sm space-y-1">
            <li>• <strong>Total Fee:</strong> Complete cost including all components</li>
            <li>• <strong>Compute Units:</strong> Computational resources used</li>
            <li>• <strong>Efficiency Score:</strong> Cost-effectiveness rating</li>
            <li>• <strong>Size:</strong> Transaction data size in bytes</li>
            <li>• <strong>Accounts Modified:</strong> Number of accounts changed</li>
          </ul>
        </div>
      </div>
    ),
    relatedTopics: ['Performance Analysis', 'Cost Optimization', 'Efficiency Metrics']
  },

  'efficiency-score': {
    id: 'efficiency-score',
    title: 'Efficiency Score',
    description: 'How we calculate transaction efficiency and cost-effectiveness',
    type: 'info',
    content: (
      <div className="space-y-3">
        <p>
          The efficiency score rates how cost-effective this transaction is based on
          the work accomplished relative to the resources consumed.
        </p>
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <CheckCircleIcon className="w-4 h-4 text-green-500" />
            <span className="font-medium text-green-600">Excellent (90-100):</span>
            <span className="text-sm">Highly optimized, minimal waste</span>
          </div>
          <div className="flex items-center space-x-2">
            <InfoIcon className="w-4 h-4 text-blue-500" />
            <span className="font-medium text-blue-600">Good (70-89):</span>
            <span className="text-sm">Well-optimized, reasonable costs</span>
          </div>
          <div className="flex items-center space-x-2">
            <AlertTriangleIcon className="w-4 h-4 text-yellow-500" />
            <span className="font-medium text-yellow-600">Fair (50-69):</span>
            <span className="text-sm">Some inefficiencies, room for improvement</span>
          </div>
          <div className="flex items-center space-x-2">
            <AlertTriangleIcon className="w-4 h-4 text-red-500" />
            <span className="font-medium text-red-600">Poor (0-49):</span>
            <span className="text-sm">Inefficient, high costs for work done</span>
          </div>
        </div>
      </div>
    ),
    relatedTopics: ['Cost Analysis', 'Performance Optimization', 'Resource Management']
  }
};

// Helper function to get help content by ID
export const getHelpContent = (id: string): HelpContent | undefined => {
  return transactionHelpContent[id];
};

// Helper function to get all help content IDs
export const getAllHelpIds = (): string[] => {
  return Object.keys(transactionHelpContent);
};

// Helper function to search help content
export const searchHelpContent = (query: string): HelpContent[] => {
  const lowercaseQuery = query.toLowerCase();
  return Object.values(transactionHelpContent).filter(content =>
    content.title.toLowerCase().includes(lowercaseQuery) ||
    content.description.toLowerCase().includes(lowercaseQuery) ||
    content.relatedTopics?.some(topic => topic.toLowerCase().includes(lowercaseQuery))
  );
};