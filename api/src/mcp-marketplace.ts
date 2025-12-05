/**
 * MCP Tool Marketplace
 *
 * Platform for third-party developers to publish MCP tools
 * that integrate with OpenSVM blockchain data.
 */

// ============================================================================
// Types
// ============================================================================

export type ToolCategory =
  | 'blockchain'
  | 'defi'
  | 'nft'
  | 'analytics'
  | 'security'
  | 'trading'
  | 'governance'
  | 'infrastructure'
  | 'ai'
  | 'other';

export type ToolStatus = 'pending' | 'approved' | 'rejected' | 'deprecated';

export type LicenseType = 'MIT' | 'Apache-2.0' | 'GPL-3.0' | 'BSD-3-Clause' | 'proprietary';

export interface ToolAuthor {
  id: string;
  name: string;
  email?: string;
  github?: string;
  twitter?: string;
  website?: string;
  verified: boolean;
  publishedTools: number;
  totalDownloads: number;
  joinedAt: string;
}

export interface ToolVersion {
  version: string;
  releaseNotes: string;
  publishedAt: string;
  downloads: number;
  minMCPVersion?: string;
  breaking?: boolean;
  deprecated?: boolean;
}

export interface ToolDependency {
  name: string;
  version: string;
  optional?: boolean;
}

export interface ToolRating {
  average: number;
  count: number;
  distribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
}

export interface ToolReview {
  id: string;
  userId: string;
  userName: string;
  rating: number;
  title: string;
  content: string;
  helpful: number;
  verified: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface MarketplaceTool {
  // Identity
  id: string;
  name: string;
  displayName: string;
  description: string;
  longDescription?: string;

  // Metadata
  category: ToolCategory;
  tags: string[];
  author: ToolAuthor;
  license: LicenseType;

  // Versioning
  version: string;
  versions: ToolVersion[];

  // Package info
  repository: string;
  homepage?: string;
  documentation?: string;
  package: {
    registry: 'npm' | 'pypi' | 'github';
    identifier: string;
    installCommand: string;
  };

  // MCP info
  mcpServer: {
    name: string;
    transport: 'stdio' | 'http' | 'sse';
    tools: {
      name: string;
      description: string;
    }[];
    prompts?: {
      name: string;
      description: string;
    }[];
    resources?: {
      uri: string;
      description: string;
    }[];
  };

  // Stats
  downloads: number;
  weeklyDownloads: number;
  stars: number;
  rating: ToolRating;
  reviews: ToolReview[];

  // Status
  status: ToolStatus;
  featured: boolean;
  verified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MarketplaceSearchResult {
  tools: MarketplaceTool[];
  total: number;
  page: number;
  pageSize: number;
  facets: {
    categories: { name: ToolCategory; count: number }[];
    tags: { name: string; count: number }[];
    authors: { name: string; count: number }[];
  };
}

export interface ToolSubmission {
  name: string;
  displayName: string;
  description: string;
  longDescription?: string;
  category: ToolCategory;
  tags: string[];
  license: LicenseType;
  repository: string;
  homepage?: string;
  documentation?: string;
  package: {
    registry: 'npm' | 'pypi' | 'github';
    identifier: string;
  };
  mcpServer: {
    name: string;
    transport: 'stdio' | 'http' | 'sse';
  };
}

// ============================================================================
// Sample Marketplace Data
// ============================================================================

const SAMPLE_TOOLS: MarketplaceTool[] = [
  {
    id: 'solana-token-analyzer',
    name: 'solana-token-analyzer',
    displayName: 'Solana Token Analyzer',
    description: 'Advanced token analysis with holder distribution, whale tracking, and liquidity metrics.',
    longDescription: `
# Solana Token Analyzer

Comprehensive token analysis toolkit for Solana tokens. This MCP server provides deep insights into:

- **Holder Distribution**: Analyze token concentration and distribution patterns
- **Whale Tracking**: Monitor large holder movements and accumulation
- **Liquidity Metrics**: Track DEX liquidity across Raydium, Orca, and Jupiter
- **Price Impact Analysis**: Estimate slippage for large trades
- **Social Signals**: Aggregate sentiment from Twitter and Discord

## Installation

\`\`\`bash
npx @opensvm/token-analyzer
\`\`\`

## Usage with Claude Desktop

Add to your config:
\`\`\`json
{
  "mcpServers": {
    "token-analyzer": {
      "command": "npx",
      "args": ["@opensvm/token-analyzer"]
    }
  }
}
\`\`\`
    `,
    category: 'defi',
    tags: ['token', 'analysis', 'defi', 'holders', 'liquidity'],
    author: {
      id: 'author-1',
      name: 'OpenSVM Labs',
      github: 'opensvm',
      verified: true,
      publishedTools: 5,
      totalDownloads: 12500,
      joinedAt: '2024-01-15T00:00:00Z',
    },
    license: 'MIT',
    version: '1.2.0',
    versions: [
      { version: '1.2.0', releaseNotes: 'Added Jupiter DEX support', publishedAt: '2024-12-01T00:00:00Z', downloads: 2340 },
      { version: '1.1.0', releaseNotes: 'Whale tracking improvements', publishedAt: '2024-11-15T00:00:00Z', downloads: 4560 },
      { version: '1.0.0', releaseNotes: 'Initial release', publishedAt: '2024-10-01T00:00:00Z', downloads: 5600 },
    ],
    repository: 'https://github.com/opensvm/token-analyzer',
    homepage: 'https://osvm.ai/tools/token-analyzer',
    documentation: 'https://osvm.ai/docs/token-analyzer',
    package: {
      registry: 'npm',
      identifier: '@opensvm/token-analyzer',
      installCommand: 'npx @opensvm/token-analyzer',
    },
    mcpServer: {
      name: 'token-analyzer',
      transport: 'stdio',
      tools: [
        { name: 'analyze_token', description: 'Full token analysis with all metrics' },
        { name: 'get_holders', description: 'Get top holders with balances' },
        { name: 'track_whales', description: 'Monitor whale wallet movements' },
        { name: 'get_liquidity', description: 'Get DEX liquidity metrics' },
        { name: 'estimate_impact', description: 'Estimate price impact for trades' },
      ],
    },
    downloads: 12500,
    weeklyDownloads: 890,
    stars: 234,
    rating: {
      average: 4.7,
      count: 45,
      distribution: { 1: 1, 2: 2, 3: 3, 4: 10, 5: 29 },
    },
    reviews: [
      {
        id: 'review-1',
        userId: 'user-1',
        userName: 'defi_dev',
        rating: 5,
        title: 'Essential for token research',
        content: 'This tool has become essential in my workflow. The whale tracking is particularly useful.',
        helpful: 23,
        verified: true,
        createdAt: '2024-11-20T00:00:00Z',
      },
    ],
    status: 'approved',
    featured: true,
    verified: true,
    createdAt: '2024-10-01T00:00:00Z',
    updatedAt: '2024-12-01T00:00:00Z',
  },
  {
    id: 'nft-rarity-checker',
    name: 'nft-rarity-checker',
    displayName: 'NFT Rarity Checker',
    description: 'Calculate and compare NFT rarity scores across Solana collections.',
    category: 'nft',
    tags: ['nft', 'rarity', 'collections', 'metaplex'],
    author: {
      id: 'author-2',
      name: 'NFT Tools',
      github: 'nft-tools',
      verified: true,
      publishedTools: 3,
      totalDownloads: 8900,
      joinedAt: '2024-02-01T00:00:00Z',
    },
    license: 'MIT',
    version: '2.0.0',
    versions: [
      { version: '2.0.0', releaseNotes: 'Support for compressed NFTs', publishedAt: '2024-11-01T00:00:00Z', downloads: 3400 },
      { version: '1.0.0', releaseNotes: 'Initial release', publishedAt: '2024-06-01T00:00:00Z', downloads: 5500 },
    ],
    repository: 'https://github.com/nft-tools/rarity-checker',
    package: {
      registry: 'npm',
      identifier: '@nft-tools/rarity-checker',
      installCommand: 'npx @nft-tools/rarity-checker',
    },
    mcpServer: {
      name: 'nft-rarity',
      transport: 'stdio',
      tools: [
        { name: 'get_rarity', description: 'Get rarity score for an NFT' },
        { name: 'compare_nfts', description: 'Compare rarity of multiple NFTs' },
        { name: 'get_collection_stats', description: 'Get collection rarity distribution' },
      ],
    },
    downloads: 8900,
    weeklyDownloads: 450,
    stars: 156,
    rating: {
      average: 4.5,
      count: 32,
      distribution: { 1: 0, 2: 1, 3: 4, 4: 8, 5: 19 },
    },
    reviews: [],
    status: 'approved',
    featured: false,
    verified: true,
    createdAt: '2024-06-01T00:00:00Z',
    updatedAt: '2024-11-01T00:00:00Z',
  },
  {
    id: 'wallet-security-scanner',
    name: 'wallet-security-scanner',
    displayName: 'Wallet Security Scanner',
    description: 'Scan wallets for security risks, suspicious approvals, and potential drains.',
    category: 'security',
    tags: ['security', 'wallet', 'approvals', 'audit'],
    author: {
      id: 'author-3',
      name: 'SecureSol',
      github: 'securesol',
      verified: true,
      publishedTools: 2,
      totalDownloads: 6700,
      joinedAt: '2024-03-01T00:00:00Z',
    },
    license: 'Apache-2.0',
    version: '1.5.0',
    versions: [
      { version: '1.5.0', releaseNotes: 'Added phishing detection', publishedAt: '2024-11-15T00:00:00Z', downloads: 2100 },
      { version: '1.0.0', releaseNotes: 'Initial release', publishedAt: '2024-07-01T00:00:00Z', downloads: 4600 },
    ],
    repository: 'https://github.com/securesol/wallet-scanner',
    package: {
      registry: 'npm',
      identifier: '@securesol/wallet-scanner',
      installCommand: 'npx @securesol/wallet-scanner',
    },
    mcpServer: {
      name: 'wallet-security',
      transport: 'stdio',
      tools: [
        { name: 'scan_wallet', description: 'Full security scan of a wallet' },
        { name: 'check_approvals', description: 'Check token approvals and risks' },
        { name: 'detect_phishing', description: 'Check if address is known phishing' },
        { name: 'audit_transactions', description: 'Audit recent transactions for risks' },
      ],
    },
    downloads: 6700,
    weeklyDownloads: 340,
    stars: 189,
    rating: {
      average: 4.8,
      count: 28,
      distribution: { 1: 0, 2: 0, 3: 2, 4: 4, 5: 22 },
    },
    reviews: [],
    status: 'approved',
    featured: true,
    verified: true,
    createdAt: '2024-07-01T00:00:00Z',
    updatedAt: '2024-11-15T00:00:00Z',
  },
  {
    id: 'defi-yield-optimizer',
    name: 'defi-yield-optimizer',
    displayName: 'DeFi Yield Optimizer',
    description: 'Find and compare yield opportunities across Solana DeFi protocols.',
    category: 'defi',
    tags: ['defi', 'yield', 'farming', 'staking', 'lending'],
    author: {
      id: 'author-4',
      name: 'Yield Labs',
      github: 'yield-labs',
      verified: true,
      publishedTools: 4,
      totalDownloads: 9800,
      joinedAt: '2024-01-20T00:00:00Z',
    },
    license: 'MIT',
    version: '3.1.0',
    versions: [
      { version: '3.1.0', releaseNotes: 'Added Kamino support', publishedAt: '2024-12-01T00:00:00Z', downloads: 1200 },
      { version: '3.0.0', releaseNotes: 'Major refactor with risk scoring', publishedAt: '2024-10-01T00:00:00Z', downloads: 3400 },
      { version: '2.0.0', releaseNotes: 'Added lending protocols', publishedAt: '2024-07-01T00:00:00Z', downloads: 5200 },
    ],
    repository: 'https://github.com/yield-labs/defi-optimizer',
    package: {
      registry: 'npm',
      identifier: '@yield-labs/defi-optimizer',
      installCommand: 'npx @yield-labs/defi-optimizer',
    },
    mcpServer: {
      name: 'yield-optimizer',
      transport: 'stdio',
      tools: [
        { name: 'find_yields', description: 'Find best yield opportunities' },
        { name: 'compare_protocols', description: 'Compare yields across protocols' },
        { name: 'calculate_apy', description: 'Calculate real APY including fees' },
        { name: 'assess_risk', description: 'Risk assessment for yield strategies' },
        { name: 'simulate_position', description: 'Simulate yield position over time' },
      ],
    },
    downloads: 9800,
    weeklyDownloads: 560,
    stars: 267,
    rating: {
      average: 4.6,
      count: 52,
      distribution: { 1: 1, 2: 2, 3: 5, 4: 12, 5: 32 },
    },
    reviews: [],
    status: 'approved',
    featured: true,
    verified: true,
    createdAt: '2024-04-01T00:00:00Z',
    updatedAt: '2024-12-01T00:00:00Z',
  },
  {
    id: 'governance-tracker',
    name: 'governance-tracker',
    displayName: 'Governance Tracker',
    description: 'Track and analyze governance proposals across Solana DAOs.',
    category: 'governance',
    tags: ['governance', 'dao', 'voting', 'realms', 'proposals'],
    author: {
      id: 'author-5',
      name: 'DAO Tools',
      github: 'dao-tools',
      verified: true,
      publishedTools: 2,
      totalDownloads: 4200,
      joinedAt: '2024-04-01T00:00:00Z',
    },
    license: 'MIT',
    version: '1.0.0',
    versions: [
      { version: '1.0.0', releaseNotes: 'Initial release', publishedAt: '2024-09-01T00:00:00Z', downloads: 4200 },
    ],
    repository: 'https://github.com/dao-tools/governance-tracker',
    package: {
      registry: 'npm',
      identifier: '@dao-tools/governance-tracker',
      installCommand: 'npx @dao-tools/governance-tracker',
    },
    mcpServer: {
      name: 'governance-tracker',
      transport: 'stdio',
      tools: [
        { name: 'get_proposals', description: 'Get active governance proposals' },
        { name: 'analyze_votes', description: 'Analyze voting patterns' },
        { name: 'get_dao_stats', description: 'Get DAO participation stats' },
      ],
    },
    downloads: 4200,
    weeklyDownloads: 180,
    stars: 89,
    rating: {
      average: 4.3,
      count: 18,
      distribution: { 1: 0, 2: 1, 3: 3, 4: 5, 5: 9 },
    },
    reviews: [],
    status: 'approved',
    featured: false,
    verified: true,
    createdAt: '2024-09-01T00:00:00Z',
    updatedAt: '2024-09-01T00:00:00Z',
  },
];

// ============================================================================
// Marketplace Manager
// ============================================================================

export class MCPMarketplace {
  private tools: Map<string, MarketplaceTool> = new Map();
  private pendingSubmissions: Map<string, ToolSubmission> = new Map();

  constructor() {
    // Load sample tools
    for (const tool of SAMPLE_TOOLS) {
      this.tools.set(tool.id, tool);
    }
  }

  /**
   * Search for tools in the marketplace
   */
  search(params: {
    query?: string;
    category?: ToolCategory;
    tags?: string[];
    author?: string;
    sortBy?: 'downloads' | 'rating' | 'updated' | 'created';
    page?: number;
    pageSize?: number;
  }): MarketplaceSearchResult {
    let results = Array.from(this.tools.values());

    // Filter by status (only approved)
    results = results.filter(t => t.status === 'approved');

    // Search query
    if (params.query) {
      const query = params.query.toLowerCase();
      results = results.filter(t =>
        t.name.toLowerCase().includes(query) ||
        t.displayName.toLowerCase().includes(query) ||
        t.description.toLowerCase().includes(query) ||
        t.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Filter by category
    if (params.category) {
      results = results.filter(t => t.category === params.category);
    }

    // Filter by tags
    if (params.tags && params.tags.length > 0) {
      results = results.filter(t =>
        params.tags!.some(tag => t.tags.includes(tag))
      );
    }

    // Filter by author
    if (params.author) {
      results = results.filter(t => t.author.id === params.author);
    }

    // Sort
    switch (params.sortBy) {
      case 'downloads':
        results.sort((a, b) => b.downloads - a.downloads);
        break;
      case 'rating':
        results.sort((a, b) => b.rating.average - a.rating.average);
        break;
      case 'created':
        results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case 'updated':
      default:
        results.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }

    // Pagination
    const page = params.page || 1;
    const pageSize = params.pageSize || 20;
    const start = (page - 1) * pageSize;
    const paginatedResults = results.slice(start, start + pageSize);

    // Compute facets
    const allResults = Array.from(this.tools.values()).filter(t => t.status === 'approved');

    const categoryCount = new Map<ToolCategory, number>();
    const tagCount = new Map<string, number>();
    const authorCount = new Map<string, number>();

    for (const tool of allResults) {
      categoryCount.set(tool.category, (categoryCount.get(tool.category) || 0) + 1);
      for (const tag of tool.tags) {
        tagCount.set(tag, (tagCount.get(tag) || 0) + 1);
      }
      authorCount.set(tool.author.name, (authorCount.get(tool.author.name) || 0) + 1);
    }

    return {
      tools: paginatedResults,
      total: results.length,
      page,
      pageSize,
      facets: {
        categories: Array.from(categoryCount.entries())
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count),
        tags: Array.from(tagCount.entries())
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 20),
        authors: Array.from(authorCount.entries())
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10),
      },
    };
  }

  /**
   * Get a specific tool by ID
   */
  getTool(id: string): MarketplaceTool | undefined {
    return this.tools.get(id);
  }

  /**
   * Get featured tools
   */
  getFeatured(): MarketplaceTool[] {
    return Array.from(this.tools.values())
      .filter(t => t.featured && t.status === 'approved')
      .sort((a, b) => b.downloads - a.downloads)
      .slice(0, 6);
  }

  /**
   * Get trending tools (most weekly downloads)
   */
  getTrending(): MarketplaceTool[] {
    return Array.from(this.tools.values())
      .filter(t => t.status === 'approved')
      .sort((a, b) => b.weeklyDownloads - a.weeklyDownloads)
      .slice(0, 10);
  }

  /**
   * Get recently added tools
   */
  getRecent(): MarketplaceTool[] {
    return Array.from(this.tools.values())
      .filter(t => t.status === 'approved')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10);
  }

  /**
   * Submit a new tool for review
   */
  submitTool(authorId: string, submission: ToolSubmission): { id: string; status: 'pending' } {
    const id = `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    this.pendingSubmissions.set(id, submission);
    return { id, status: 'pending' };
  }

  /**
   * Get categories with counts
   */
  getCategories(): { category: ToolCategory; count: number; description: string }[] {
    const descriptions: Record<ToolCategory, string> = {
      blockchain: 'Core blockchain data and transaction tools',
      defi: 'DeFi protocols, yields, and trading',
      nft: 'NFT collections, rarity, and metadata',
      analytics: 'Data analysis and visualization',
      security: 'Security scanning and auditing',
      trading: 'Trading bots and signals',
      governance: 'DAO governance and voting',
      infrastructure: 'Developer tools and infrastructure',
      ai: 'AI/ML powered tools',
      other: 'Other tools',
    };

    const counts = new Map<ToolCategory, number>();
    for (const tool of this.tools.values()) {
      if (tool.status === 'approved') {
        counts.set(tool.category, (counts.get(tool.category) || 0) + 1);
      }
    }

    return Object.entries(descriptions).map(([category, description]) => ({
      category: category as ToolCategory,
      count: counts.get(category as ToolCategory) || 0,
      description,
    }));
  }

  /**
   * Get marketplace statistics
   */
  getStats(): {
    totalTools: number;
    totalAuthors: number;
    totalDownloads: number;
    avgRating: number;
    categories: number;
  } {
    const approved = Array.from(this.tools.values()).filter(t => t.status === 'approved');
    const authors = new Set(approved.map(t => t.author.id));

    return {
      totalTools: approved.length,
      totalAuthors: authors.size,
      totalDownloads: approved.reduce((sum, t) => sum + t.downloads, 0),
      avgRating: approved.reduce((sum, t) => sum + t.rating.average, 0) / Math.max(1, approved.length),
      categories: new Set(approved.map(t => t.category)).size,
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const marketplace = new MCPMarketplace();

// ============================================================================
// Exports
// ============================================================================

export default {
  MCPMarketplace,
  marketplace,
  SAMPLE_TOOLS,
};
