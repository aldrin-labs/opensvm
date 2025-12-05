/**
 * MCP Tool Marketplace API
 *
 * GET /api/mcp/marketplace - Search and browse tools
 * GET /api/mcp/marketplace?featured=true - Get featured tools
 * GET /api/mcp/marketplace?trending=true - Get trending tools
 * POST /api/mcp/marketplace - Submit a new tool
 */

import { NextRequest, NextResponse } from 'next/server';

// Types
type ToolCategory = 'blockchain' | 'defi' | 'nft' | 'analytics' | 'security' | 'trading' | 'governance' | 'infrastructure' | 'ai' | 'other';

interface MarketplaceTool {
  id: string;
  name: string;
  displayName: string;
  description: string;
  category: ToolCategory;
  tags: string[];
  author: { name: string; verified: boolean };
  version: string;
  downloads: number;
  weeklyDownloads: number;
  rating: { average: number; count: number };
  featured: boolean;
  verified: boolean;
  installCommand: string;
  repository: string;
  tools: { name: string; description: string }[];
  updatedAt: string;
}

// Sample marketplace data
const MARKETPLACE_TOOLS: MarketplaceTool[] = [
  {
    id: 'solana-token-analyzer',
    name: 'solana-token-analyzer',
    displayName: 'Solana Token Analyzer',
    description: 'Advanced token analysis with holder distribution, whale tracking, and liquidity metrics.',
    category: 'defi',
    tags: ['token', 'analysis', 'defi', 'holders', 'liquidity'],
    author: { name: 'OpenSVM Labs', verified: true },
    version: '1.2.0',
    downloads: 12500,
    weeklyDownloads: 890,
    rating: { average: 4.7, count: 45 },
    featured: true,
    verified: true,
    installCommand: 'npx @opensvm/token-analyzer',
    repository: 'https://github.com/opensvm/token-analyzer',
    tools: [
      { name: 'analyze_token', description: 'Full token analysis with all metrics' },
      { name: 'get_holders', description: 'Get top holders with balances' },
      { name: 'track_whales', description: 'Monitor whale wallet movements' },
      { name: 'get_liquidity', description: 'Get DEX liquidity metrics' },
    ],
    updatedAt: '2024-12-01T00:00:00Z',
  },
  {
    id: 'nft-rarity-checker',
    name: 'nft-rarity-checker',
    displayName: 'NFT Rarity Checker',
    description: 'Calculate and compare NFT rarity scores across Solana collections.',
    category: 'nft',
    tags: ['nft', 'rarity', 'collections', 'metaplex'],
    author: { name: 'NFT Tools', verified: true },
    version: '2.0.0',
    downloads: 8900,
    weeklyDownloads: 450,
    rating: { average: 4.5, count: 32 },
    featured: false,
    verified: true,
    installCommand: 'npx @nft-tools/rarity-checker',
    repository: 'https://github.com/nft-tools/rarity-checker',
    tools: [
      { name: 'get_rarity', description: 'Get rarity score for an NFT' },
      { name: 'compare_nfts', description: 'Compare rarity of multiple NFTs' },
      { name: 'get_collection_stats', description: 'Get collection rarity distribution' },
    ],
    updatedAt: '2024-11-01T00:00:00Z',
  },
  {
    id: 'wallet-security-scanner',
    name: 'wallet-security-scanner',
    displayName: 'Wallet Security Scanner',
    description: 'Scan wallets for security risks, suspicious approvals, and potential drains.',
    category: 'security',
    tags: ['security', 'wallet', 'approvals', 'audit'],
    author: { name: 'SecureSol', verified: true },
    version: '1.5.0',
    downloads: 6700,
    weeklyDownloads: 340,
    rating: { average: 4.8, count: 28 },
    featured: true,
    verified: true,
    installCommand: 'npx @securesol/wallet-scanner',
    repository: 'https://github.com/securesol/wallet-scanner',
    tools: [
      { name: 'scan_wallet', description: 'Full security scan of a wallet' },
      { name: 'check_approvals', description: 'Check token approvals and risks' },
      { name: 'detect_phishing', description: 'Check if address is known phishing' },
    ],
    updatedAt: '2024-11-15T00:00:00Z',
  },
  {
    id: 'defi-yield-optimizer',
    name: 'defi-yield-optimizer',
    displayName: 'DeFi Yield Optimizer',
    description: 'Find and compare yield opportunities across Solana DeFi protocols.',
    category: 'defi',
    tags: ['defi', 'yield', 'farming', 'staking', 'lending'],
    author: { name: 'Yield Labs', verified: true },
    version: '3.1.0',
    downloads: 9800,
    weeklyDownloads: 560,
    rating: { average: 4.6, count: 52 },
    featured: true,
    verified: true,
    installCommand: 'npx @yield-labs/defi-optimizer',
    repository: 'https://github.com/yield-labs/defi-optimizer',
    tools: [
      { name: 'find_yields', description: 'Find best yield opportunities' },
      { name: 'compare_protocols', description: 'Compare yields across protocols' },
      { name: 'calculate_apy', description: 'Calculate real APY including fees' },
      { name: 'assess_risk', description: 'Risk assessment for yield strategies' },
    ],
    updatedAt: '2024-12-01T00:00:00Z',
  },
  {
    id: 'governance-tracker',
    name: 'governance-tracker',
    displayName: 'Governance Tracker',
    description: 'Track and analyze governance proposals across Solana DAOs.',
    category: 'governance',
    tags: ['governance', 'dao', 'voting', 'realms', 'proposals'],
    author: { name: 'DAO Tools', verified: true },
    version: '1.0.0',
    downloads: 4200,
    weeklyDownloads: 180,
    rating: { average: 4.3, count: 18 },
    featured: false,
    verified: true,
    installCommand: 'npx @dao-tools/governance-tracker',
    repository: 'https://github.com/dao-tools/governance-tracker',
    tools: [
      { name: 'get_proposals', description: 'Get active governance proposals' },
      { name: 'analyze_votes', description: 'Analyze voting patterns' },
      { name: 'get_dao_stats', description: 'Get DAO participation stats' },
    ],
    updatedAt: '2024-09-01T00:00:00Z',
  },
  {
    id: 'transaction-decoder',
    name: 'transaction-decoder',
    displayName: 'Transaction Decoder',
    description: 'Decode and explain Solana transactions in human-readable format.',
    category: 'blockchain',
    tags: ['transaction', 'decoder', 'parser', 'analysis'],
    author: { name: 'SolDev', verified: true },
    version: '2.1.0',
    downloads: 7600,
    weeklyDownloads: 410,
    rating: { average: 4.4, count: 36 },
    featured: false,
    verified: true,
    installCommand: 'npx @soldev/tx-decoder',
    repository: 'https://github.com/soldev/tx-decoder',
    tools: [
      { name: 'decode_tx', description: 'Decode a transaction signature' },
      { name: 'explain_tx', description: 'Get human-readable explanation' },
      { name: 'parse_instructions', description: 'Parse individual instructions' },
    ],
    updatedAt: '2024-10-15T00:00:00Z',
  },
];

const CATEGORIES = [
  { category: 'blockchain', count: 1, description: 'Core blockchain data and transaction tools' },
  { category: 'defi', count: 2, description: 'DeFi protocols, yields, and trading' },
  { category: 'nft', count: 1, description: 'NFT collections, rarity, and metadata' },
  { category: 'security', count: 1, description: 'Security scanning and auditing' },
  { category: 'governance', count: 1, description: 'DAO governance and voting' },
  { category: 'analytics', count: 0, description: 'Data analysis and visualization' },
  { category: 'trading', count: 0, description: 'Trading bots and signals' },
  { category: 'infrastructure', count: 0, description: 'Developer tools and infrastructure' },
  { category: 'ai', count: 0, description: 'AI/ML powered tools' },
];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const featured = searchParams.get('featured') === 'true';
  const trending = searchParams.get('trending') === 'true';
  const recent = searchParams.get('recent') === 'true';
  const categories = searchParams.get('categories') === 'true';
  const stats = searchParams.get('stats') === 'true';
  const query = searchParams.get('query');
  const category = searchParams.get('category');
  const page = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('pageSize') || '20');

  try {
    // Get single tool by ID
    if (id) {
      const tool = MARKETPLACE_TOOLS.find(t => t.id === id);
      if (!tool) {
        return NextResponse.json({ error: 'Tool not found' }, { status: 404 });
      }
      return NextResponse.json(tool);
    }

    // Get categories
    if (categories) {
      return NextResponse.json({ categories: CATEGORIES });
    }

    // Get marketplace stats
    if (stats) {
      return NextResponse.json({
        totalTools: MARKETPLACE_TOOLS.length,
        totalAuthors: new Set(MARKETPLACE_TOOLS.map(t => t.author.name)).size,
        totalDownloads: MARKETPLACE_TOOLS.reduce((sum, t) => sum + t.downloads, 0),
        avgRating: MARKETPLACE_TOOLS.reduce((sum, t) => sum + t.rating.average, 0) / MARKETPLACE_TOOLS.length,
        categories: CATEGORIES.filter(c => c.count > 0).length,
      });
    }

    // Get featured tools
    if (featured) {
      const featuredTools = MARKETPLACE_TOOLS
        .filter(t => t.featured)
        .sort((a, b) => b.downloads - a.downloads);
      return NextResponse.json({ tools: featuredTools });
    }

    // Get trending tools
    if (trending) {
      const trendingTools = [...MARKETPLACE_TOOLS]
        .sort((a, b) => b.weeklyDownloads - a.weeklyDownloads)
        .slice(0, 10);
      return NextResponse.json({ tools: trendingTools });
    }

    // Get recent tools
    if (recent) {
      const recentTools = [...MARKETPLACE_TOOLS]
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 10);
      return NextResponse.json({ tools: recentTools });
    }

    // Search and filter
    let results = [...MARKETPLACE_TOOLS];

    if (query) {
      const q = query.toLowerCase();
      results = results.filter(t =>
        t.name.toLowerCase().includes(q) ||
        t.displayName.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.tags.some(tag => tag.toLowerCase().includes(q))
      );
    }

    if (category) {
      results = results.filter(t => t.category === category);
    }

    // Pagination
    const total = results.length;
    const start = (page - 1) * pageSize;
    const paginatedResults = results.slice(start, start + pageSize);

    // Facets
    const tagCounts = new Map<string, number>();
    for (const tool of MARKETPLACE_TOOLS) {
      for (const tag of tool.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }

    return NextResponse.json({
      tools: paginatedResults,
      total,
      page,
      pageSize,
      facets: {
        categories: CATEGORIES.filter(c => c.count > 0),
        tags: Array.from(tagCounts.entries())
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 15),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validate required fields
    const { name, displayName, description, category, repository } = body;
    if (!name || !displayName || !description || !category || !repository) {
      return NextResponse.json(
        { error: 'Missing required fields: name, displayName, description, category, repository' },
        { status: 400 }
      );
    }

    // In production, this would:
    // 1. Validate the repository exists
    // 2. Fetch and validate server.json from the repo
    // 3. Run security checks
    // 4. Queue for manual review
    // 5. Store in database

    const submissionId = `submission-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    return NextResponse.json({
      success: true,
      submissionId,
      status: 'pending',
      message: 'Your tool has been submitted for review. You will be notified when it is approved.',
      estimatedReviewTime: '1-3 business days',
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export const runtime = 'edge';
