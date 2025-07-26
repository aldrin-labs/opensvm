import React from 'react';
import { TourConfig } from '@/components/help/GuidedTour';
import { 
  FileTextIcon, 
  ZapIcon, 
  TrendingUpIcon, 
  NetworkIcon,
  BarChart3Icon,
  BrainIcon,
  GitBranchIcon,
  SettingsIcon
} from 'lucide-react';

export const transactionExplorerTour: TourConfig = {
  id: 'transaction-explorer-tour',
  title: 'Transaction Explorer Tour',
  description: 'Learn how to analyze Solana transactions with our enhanced explorer',
  autoStart: false,
  showProgress: true,
  allowSkip: true,
  steps: [
    {
      id: 'welcome',
      title: 'Welcome to Transaction Explorer',
      content: (
        <div className="space-y-3">
          <p>
            Welcome to the enhanced Transaction Explorer! This tour will guide you through 
            all the powerful features available for analyzing Solana transactions.
          </p>
          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md">
            <div className="flex items-center space-x-2 text-blue-800 dark:text-blue-200">
              <FileTextIcon className="w-4 h-4" />
              <span className="font-medium">What you'll learn:</span>
            </div>
            <ul className="text-sm mt-2 space-y-1 text-blue-700 dark:text-blue-300">
              <li>• How to read transaction details</li>
              <li>• Understanding instruction parsing</li>
              <li>• Analyzing account changes</li>
              <li>• Using AI-powered explanations</li>
              <li>• Exploring transaction relationships</li>
            </ul>
          </div>
        </div>
      ),
      targetSelector: 'body',
      position: 'center'
    },
    {
      id: 'transaction-header',
      title: 'Transaction Overview',
      content: (
        <div className="space-y-3">
          <p>
            The transaction header shows key information including the signature, 
            status, timestamp, and fee details.
          </p>
          <div className="bg-muted/20 p-3 rounded-md">
            <h4 className="font-medium mb-2">Key Elements:</h4>
            <ul className="text-sm space-y-1">
              <li>• <strong>Signature:</strong> Unique transaction identifier</li>
              <li>• <strong>Status:</strong> Confirmation level (processed/confirmed/finalized)</li>
              <li>• <strong>Slot:</strong> Block number where transaction was included</li>
              <li>• <strong>Fee:</strong> Total cost paid for processing</li>
            </ul>
          </div>
        </div>
      ),
      targetSelector: '[data-tour="transaction-header"]',
      position: 'bottom'
    },
    {
      id: 'instructions-section',
      title: 'Instruction Breakdown',
      content: (
        <div className="space-y-3">
          <div className="flex items-center space-x-2 mb-2">
            <ZapIcon className="w-4 h-4 text-yellow-500" />
            <span className="font-medium">Instructions are the heart of transactions</span>
          </div>
          <p>
            Each instruction represents a specific operation. Our parser converts 
            raw instruction data into human-readable descriptions.
          </p>
          <div className="text-sm text-muted-foreground">
            💡 <strong>Tip:</strong> Click on any instruction to expand and see detailed information 
            including accounts, parameters, and risk assessment.
          </div>
        </div>
      ),
      targetSelector: '[data-tour="instructions"]',
      position: 'right',
      action: 'scroll'
    },
    {
      id: 'instruction-details',
      title: 'Instruction Details',
      content: (
        <div className="space-y-3">
          <p>
            When you expand an instruction, you can see:
          </p>
          <ul className="text-sm space-y-1">
            <li>• <strong>Program Information:</strong> Which program is being called</li>
            <li>• <strong>Account Roles:</strong> How each account is used</li>
            <li>• <strong>Parameters:</strong> Data passed to the instruction</li>
            <li>• <strong>Risk Assessment:</strong> Automated security analysis</li>
            <li>• <strong>Compute Units:</strong> Computational resources used</li>
          </ul>
          <div className="text-sm text-muted-foreground">
            Try expanding the first instruction to see these details!
          </div>
        </div>
      ),
      targetSelector: '[data-tour="instruction-item"]:first-child',
      position: 'right',
      action: 'click',
      actionDelay: 500
    },
    {
      id: 'account-changes',
      title: 'Account Changes Analysis',
      content: (
        <div className="space-y-3">
          <div className="flex items-center space-x-2 mb-2">
            <TrendingUpIcon className="w-4 h-4 text-green-500" />
            <span className="font-medium">Track how accounts are affected</span>
          </div>
          <p>
            The account changes section shows before/after states for all accounts 
            modified by this transaction.
          </p>
          <div className="bg-muted/20 p-3 rounded-md">
            <h4 className="font-medium mb-2">What you can see:</h4>
            <ul className="text-sm space-y-1">
              <li>• SOL balance changes</li>
              <li>• Token balance modifications</li>
              <li>• Account data updates</li>
              <li>• Ownership transfers</li>
              <li>• Risk assessment</li>
            </ul>
          </div>
        </div>
      ),
      targetSelector: '[data-tour="account-changes"]',
      position: 'left',
      action: 'scroll'
    },
    {
      id: 'ai-analysis',
      title: 'AI-Powered Analysis',
      content: (
        <div className="space-y-3">
          <div className="flex items-center space-x-2 mb-2">
            <BrainIcon className="w-4 h-4 text-purple-500" />
            <span className="font-medium">Let AI explain what happened</span>
          </div>
          <p>
            Our AI system analyzes the transaction and provides natural language 
            explanations of what it accomplishes and any potential risks.
          </p>
          <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-md">
            <h4 className="font-medium mb-2 text-purple-800 dark:text-purple-200">AI Features:</h4>
            <ul className="text-sm space-y-1 text-purple-700 dark:text-purple-300">
              <li>• Plain English explanations</li>
              <li>• Risk factor identification</li>
              <li>• Financial impact analysis</li>
              <li>• Security recommendations</li>
            </ul>
          </div>
        </div>
      ),
      targetSelector: '[data-tour="ai-analysis"]',
      position: 'top',
      action: 'scroll'
    },
    {
      id: 'related-transactions',
      title: 'Related Transactions',
      content: (
        <div className="space-y-3">
          <div className="flex items-center space-x-2 mb-2">
            <GitBranchIcon className="w-4 h-4 text-blue-500" />
            <span className="font-medium">Discover transaction relationships</span>
          </div>
          <p>
            Find transactions related to this one through shared accounts, 
            programs, or temporal proximity.
          </p>
          <div className="bg-muted/20 p-3 rounded-md">
            <h4 className="font-medium mb-2">Relationship Types:</h4>
            <ul className="text-sm space-y-1">
              <li>• Same account interactions</li>
              <li>• Same program usage</li>
              <li>• Token flow connections</li>
              <li>• Time-based clustering</li>
            </ul>
          </div>
        </div>
      ),
      targetSelector: '[data-tour="related-transactions"]',
      position: 'top',
      action: 'scroll'
    },
    {
      id: 'transaction-graph',
      title: 'Transaction Graph Visualization',
      content: (
        <div className="space-y-3">
          <div className="flex items-center space-x-2 mb-2">
            <NetworkIcon className="w-4 h-4 text-green-500" />
            <span className="font-medium">Visualize transaction flows</span>
          </div>
          <p>
            The interactive graph shows accounts, programs, and their relationships 
            as nodes and edges.
          </p>
          <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-md">
            <h4 className="font-medium mb-2 text-green-800 dark:text-green-200">Graph Controls:</h4>
            <ul className="text-sm space-y-1 text-green-700 dark:text-green-300">
              <li>• Zoom and pan to explore</li>
              <li>• Click nodes for details</li>
              <li>• Filter by type</li>
              <li>• Export as image</li>
            </ul>
          </div>
        </div>
      ),
      targetSelector: '[data-tour="transaction-graph"]',
      position: 'top',
      action: 'scroll'
    },
    {
      id: 'transaction-metrics',
      title: 'Performance Metrics',
      content: (
        <div className="space-y-3">
          <div className="flex items-center space-x-2 mb-2">
            <BarChart3Icon className="w-4 h-4 text-orange-500" />
            <span className="font-medium">Analyze transaction performance</span>
          </div>
          <p>
            Detailed metrics help you understand the cost, efficiency, and 
            performance characteristics of this transaction.
          </p>
          <div className="bg-muted/20 p-3 rounded-md">
            <h4 className="font-medium mb-2">Available Metrics:</h4>
            <ul className="text-sm space-y-1">
              <li>• Fee breakdown analysis</li>
              <li>• Compute unit usage</li>
              <li>• Efficiency scoring</li>
              <li>• Size and complexity</li>
              <li>• Comparative analysis</li>
            </ul>
          </div>
        </div>
      ),
      targetSelector: '[data-tour="transaction-metrics"]',
      position: 'top',
      action: 'scroll'
    },
    {
      id: 'help-system',
      title: 'Getting Help',
      content: (
        <div className="space-y-3">
          <div className="flex items-center space-x-2 mb-2">
            <SettingsIcon className="w-4 h-4 text-gray-500" />
            <span className="font-medium">Help is always available</span>
          </div>
          <p>
            Look for help icons (?) throughout the interface for contextual 
            explanations and technical definitions.
          </p>
          <div className="bg-muted/20 p-3 rounded-md">
            <h4 className="font-medium mb-2">Help Features:</h4>
            <ul className="text-sm space-y-1">
              <li>• Hover tooltips for quick info</li>
              <li>• Detailed help panels</li>
              <li>• Technical term definitions</li>
              <li>• Related topic suggestions</li>
              <li>• External documentation links</li>
            </ul>
          </div>
          <div className="text-sm text-muted-foreground">
            You can restart this tour anytime by clicking the help button!
          </div>
        </div>
      ),
      targetSelector: '[data-tour="help-button"]',
      position: 'bottom'
    },
    {
      id: 'completion',
      title: 'Tour Complete!',
      content: (
        <div className="space-y-3">
          <div className="text-center">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <FileTextIcon className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="font-semibold text-foreground mb-2">Congratulations!</h3>
            <p className="text-muted-foreground">
              You've completed the Transaction Explorer tour. You now know how to:
            </p>
          </div>
          <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-md">
            <ul className="text-sm space-y-1 text-green-700 dark:text-green-300">
              <li>✓ Read transaction details and status</li>
              <li>✓ Understand instruction parsing</li>
              <li>✓ Analyze account changes</li>
              <li>✓ Use AI-powered explanations</li>
              <li>✓ Explore transaction relationships</li>
              <li>✓ Navigate the graph visualization</li>
              <li>✓ Access help and documentation</li>
            </ul>
          </div>
          <div className="text-center text-sm text-muted-foreground">
            Happy exploring! 🚀
          </div>
        </div>
      ),
      targetSelector: 'body',
      position: 'center'
    }
  ],
  onComplete: () => {
    localStorage.setItem('transaction-explorer-tour-completed', 'true');
  },
  onSkip: () => {
    localStorage.setItem('transaction-explorer-tour-skipped', 'true');
  }
};

export const instructionAnalysisTour: TourConfig = {
  id: 'instruction-analysis-tour',
  title: 'Instruction Analysis Deep Dive',
  description: 'Learn advanced instruction analysis features',
  autoStart: false,
  showProgress: true,
  allowSkip: true,
  steps: [
    {
      id: 'instruction-overview',
      title: 'Understanding Instructions',
      content: (
        <div className="space-y-3">
          <p>
            Instructions are the building blocks of Solana transactions. Each instruction 
            tells a program what to do with specific accounts and data.
          </p>
          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md">
            <h4 className="font-medium mb-2 text-blue-800 dark:text-blue-200">Instruction Components:</h4>
            <ul className="text-sm space-y-1 text-blue-700 dark:text-blue-300">
              <li>• <strong>Program ID:</strong> Which program to call</li>
              <li>• <strong>Accounts:</strong> Which accounts to use</li>
              <li>• <strong>Data:</strong> Parameters for the operation</li>
            </ul>
          </div>
        </div>
      ),
      targetSelector: '[data-tour="instructions"]',
      position: 'right'
    },
    {
      id: 'program-identification',
      title: 'Program Identification',
      content: (
        <div className="space-y-3">
          <p>
            We identify programs and categorize them to help you understand 
            what type of operation is being performed.
          </p>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <span className="text-sm"><strong>System:</strong> Core Solana operations</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-sm"><strong>Token:</strong> SPL token operations</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
              <span className="text-sm"><strong>DeFi:</strong> Decentralized finance</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-pink-500 rounded-full"></div>
              <span className="text-sm"><strong>NFT:</strong> Non-fungible tokens</span>
            </div>
          </div>
        </div>
      ),
      targetSelector: '[data-tour="instruction-program"]',
      position: 'right'
    },
    {
      id: 'risk-assessment',
      title: 'Risk Assessment',
      content: (
        <div className="space-y-3">
          <p>
            Each instruction is automatically analyzed for potential risks 
            based on the operation type and program reputation.
          </p>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-sm text-green-600"><strong>Low Risk:</strong> Standard, safe operations</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <span className="text-sm text-yellow-600"><strong>Medium Risk:</strong> Requires attention</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <span className="text-sm text-red-600"><strong>High Risk:</strong> Potentially dangerous</span>
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            ⚠️ Always verify high-risk operations before signing transactions.
          </div>
        </div>
      ),
      targetSelector: '[data-tour="instruction-risk"]',
      position: 'left'
    },
    {
      id: 'account-roles',
      title: 'Account Roles',
      content: (
        <div className="space-y-3">
          <p>
            We analyze how each account is used in the instruction and assign 
            roles to help you understand the operation flow.
          </p>
          <div className="bg-muted/20 p-3 rounded-md">
            <h4 className="font-medium mb-2">Common Roles:</h4>
            <ul className="text-sm space-y-1">
              <li>• <strong>Payer:</strong> Account paying fees</li>
              <li>• <strong>Source:</strong> Account sending tokens/SOL</li>
              <li>• <strong>Destination:</strong> Account receiving tokens/SOL</li>
              <li>• <strong>Authority:</strong> Account with permission to act</li>
              <li>• <strong>Program:</strong> Program being invoked</li>
            </ul>
          </div>
        </div>
      ),
      targetSelector: '[data-tour="instruction-accounts"]',
      position: 'right'
    },
    {
      id: 'compute-units',
      title: 'Compute Units',
      content: (
        <div className="space-y-3">
          <p>
            Compute Units (CU) measure the computational work required. 
            Each transaction has a limit of 1.4 million CU.
          </p>
          <div className="bg-muted/20 p-3 rounded-md">
            <h4 className="font-medium mb-2">Typical Usage:</h4>
            <ul className="text-sm space-y-1">
              <li>• Simple transfer: ~150 CU</li>
              <li>• Token transfer: ~2,000 CU</li>
              <li>• DeFi swap: ~50,000 CU</li>
              <li>• Complex operations: 100,000+ CU</li>
            </ul>
          </div>
          <div className="text-sm text-muted-foreground">
            💡 Higher CU usage may require priority fees for faster processing.
          </div>
        </div>
      ),
      targetSelector: '[data-tour="compute-units"]',
      position: 'left'
    }
  ]
};

export const accountChangesTour: TourConfig = {
  id: 'account-changes-tour',
  title: 'Account Changes Analysis',
  description: 'Learn how to analyze account state changes',
  autoStart: false,
  showProgress: true,
  allowSkip: true,
  steps: [
    {
      id: 'changes-overview',
      title: 'Account Changes Overview',
      content: (
        <div className="space-y-3">
          <p>
            Account changes show how transaction execution affected each account's 
            state, including balance changes, data modifications, and ownership transfers.
          </p>
          <div className="bg-muted/20 p-3 rounded-md">
            <h4 className="font-medium mb-2">Types of Changes:</h4>
            <ul className="text-sm space-y-1">
              <li>• SOL balance increases/decreases</li>
              <li>• Token balance modifications</li>
              <li>• Account data updates</li>
              <li>• Ownership changes</li>
              <li>• Rent exemption status</li>
            </ul>
          </div>
        </div>
      ),
      targetSelector: '[data-tour="account-changes"]',
      position: 'right'
    },
    {
      id: 'balance-changes',
      title: 'Balance Changes',
      content: (
        <div className="space-y-3">
          <p>
            Balance changes show SOL movements between accounts, including 
            transfers, fee payments, and rent deposits.
          </p>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-sm text-green-600">Positive: Account received SOL</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <span className="text-sm text-red-600">Negative: Account sent SOL or paid fees</span>
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            All amounts are shown in SOL (1 SOL = 1,000,000,000 lamports).
          </div>
        </div>
      ),
      targetSelector: '[data-tour="balance-changes"]',
      position: 'left'
    },
    {
      id: 'token-changes',
      title: 'Token Changes',
      content: (
        <div className="space-y-3">
          <p>
            Token changes track SPL token balance modifications, including 
            transfers, mints, burns, and other token operations.
          </p>
          <div className="bg-muted/20 p-3 rounded-md">
            <h4 className="font-medium mb-2">Change Significance:</h4>
            <ul className="text-sm space-y-1">
              <li>• <strong>High:</strong> Large amounts or critical operations</li>
              <li>• <strong>Medium:</strong> Moderate amounts or standard operations</li>
              <li>• <strong>Low:</strong> Small amounts or routine operations</li>
            </ul>
          </div>
        </div>
      ),
      targetSelector: '[data-tour="token-changes"]',
      position: 'right'
    },
    {
      id: 'risk-assessment',
      title: 'Risk Assessment',
      content: (
        <div className="space-y-3">
          <p>
            We analyze all account changes to identify potential risks and 
            provide security recommendations.
          </p>
          <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-md border border-yellow-200 dark:border-yellow-800">
            <h4 className="font-medium mb-2 text-yellow-800 dark:text-yellow-200">Risk Factors:</h4>
            <ul className="text-sm space-y-1 text-yellow-700 dark:text-yellow-300">
              <li>• Large balance changes</li>
              <li>• Unknown token interactions</li>
              <li>• Authority transfers</li>
              <li>• Account closures</li>
              <li>• Unusual patterns</li>
            </ul>
          </div>
        </div>
      ),
      targetSelector: '[data-tour="risk-assessment"]',
      position: 'top'
    }
  ]
};

// Helper function to get tour by ID
export const getTourById = (id: string): TourConfig | undefined => {
  const tours = [transactionExplorerTour, instructionAnalysisTour, accountChangesTour];
  return tours.find(tour => tour.id === id);
};

// Helper function to check if tour was completed
export const isTourCompleted = (tourId: string): boolean => {
  return localStorage.getItem(`${tourId}-completed`) === 'true';
};

// Helper function to check if tour was skipped
export const isTourSkipped = (tourId: string): boolean => {
  return localStorage.getItem(`${tourId}-skipped`) === 'true';
};

// Helper function to reset tour status
export const resetTourStatus = (tourId: string): void => {
  localStorage.removeItem(`${tourId}-completed`);
  localStorage.removeItem(`${tourId}-skipped`);
};