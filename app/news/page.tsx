import Link from 'next/link';
import { Newspaper, ExternalLink, Clock, TrendingUp } from 'lucide-react';

export const metadata = {
  title: 'OpenSVM News - Solana Ecosystem Updates',
  description: 'Latest news and updates about OpenSVM and the Solana ecosystem',
};

interface NewsItem {
  id: string;
  title: string;
  summary: string;
  date: string;
  source: string;
  category: 'OpenSVM' | 'Solana' | 'Ecosystem' | 'Integration';
  isExternal?: boolean;
  externalUrl?: string;
  isFeatured?: boolean;
}

const newsItems: NewsItem[] = [
  {
    id: '1',
    title: 'OpenSVM Launches AI-Powered Blockchain Explorer',
    summary: 'OpenSVM introduces revolutionary AI features for analyzing Solana transactions with natural language processing and intelligent insights. The explorer combines cutting-edge visualization with Claude AI integration.',
    date: '2025-01-16',
    source: 'OpenSVM Official',
    category: 'OpenSVM',
    isFeatured: true,
  },
  {
    id: '2',
    title: 'Firedancer Validator Client Enters Public Testnet',
    summary: 'Jump Crypto\'s Firedancer reaches major milestone with public testnet launch, demonstrating 1M+ TPS capability and positioning Solana for unprecedented scale.',
    date: '2025-01-15',
    source: 'Jump Crypto',
    category: 'Solana',
    isExternal: true,
    externalUrl: '#',
    isFeatured: true,
  },
  {
    id: '3',
    title: 'Solana Breaks All-Time High Transaction Volume',
    summary: 'Solana network processes record 98 million transactions in 24 hours, showcasing robust infrastructure and growing adoption across DeFi and NFT sectors.',
    date: '2025-01-14',
    source: 'Solana Foundation',
    category: 'Solana',
    isExternal: true,
    externalUrl: '#',
  },
  {
    id: '4',
    title: 'Jupiter Surpasses $100B in Trading Volume',
    summary: 'Jupiter Exchange achieves remarkable milestone of $100 billion in cumulative trading volume, solidifying its position as Solana\'s leading DEX aggregator.',
    date: '2025-01-13',
    source: 'Jupiter',
    category: 'Ecosystem',
    isExternal: true,
    externalUrl: '#',
  },
  {
    id: '5',
    title: 'New DeFi Protocols Integrated',
    summary: 'OpenSVM adds support for 20+ new DeFi protocols including Kamino, Drift Protocol, and MarginFi, expanding comprehensive coverage of the Solana ecosystem.',
    date: '2025-01-12',
    source: 'OpenSVM Team',
    category: 'Integration',
  },
  {
    id: '6',
    title: 'Solana Token Extensions Go Live on Mainnet',
    summary: 'Token Extensions program launches on Solana mainnet, enabling confidential transfers, transfer hooks, and advanced token functionality for developers.',
    date: '2025-01-11',
    source: 'Solana Labs',
    category: 'Solana',
    isExternal: true,
    externalUrl: '#',
  },
  {
    id: '7',
    title: 'Token Metadata Enhancement Update',
    summary: 'Enhanced token metadata display with real-time price updates, comprehensive holder analytics, and integration with Birdeye and DexScreener APIs.',
    date: '2025-01-10',
    source: 'Product Updates',
    category: 'OpenSVM',
  },
  {
    id: '8',
    title: 'Solana Saga Phone Chapter 2 Announced',
    summary: 'Solana Mobile announces next generation Saga phone with improved hardware, enhanced dApp store, and deeper Web3 integration.',
    date: '2025-01-09',
    source: 'Solana Mobile',
    category: 'Ecosystem',
    isExternal: true,
    externalUrl: '#',
  },
  {
    id: '9',
    title: 'NFT Analytics Dashboard Released',
    summary: 'Comprehensive NFT analytics now available on OpenSVM, including collection rankings, floor prices, trading volumes, and holder distribution analysis.',
    date: '2025-01-08',
    source: 'OpenSVM Team',
    category: 'OpenSVM',
  },
  {
    id: '10',
    title: 'Solana Validator Count Reaches New High',
    summary: 'Solana network achieves record 3,000+ active validators, demonstrating continued decentralization and network security improvements.',
    date: '2025-01-07',
    source: 'Solana Foundation',
    category: 'Solana',
    isExternal: true,
    externalUrl: '#',
  },
  {
    id: '11',
    title: 'State Compression Enables Millions of NFTs',
    summary: 'Solana\'s state compression technology sees massive adoption, with projects minting millions of compressed NFTs at fraction of traditional costs.',
    date: '2025-01-06',
    source: 'Metaplex',
    category: 'Ecosystem',
    isExternal: true,
    externalUrl: '#',
  },
  {
    id: '12',
    title: 'Real-Time Transaction Graph Visualization Upgrade',
    summary: 'OpenSVM introduces WebGL-powered transaction graph with 60 FPS rendering, supporting visualization of 10,000+ nodes simultaneously.',
    date: '2025-01-05',
    source: 'Engineering Team',
    category: 'OpenSVM',
  },
];

const categories: Array<NewsItem['category'] | 'All'> = ['All', 'OpenSVM', 'Solana', 'Ecosystem', 'Integration'];

export default function NewsPage() {
  const featuredNews = newsItems.filter(item => item.isFeatured);
  const regularNews = newsItems.filter(item => !item.isFeatured);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-4xl mx-auto text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Newspaper className="w-12 h-12 text-primary" />
              <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                News
              </h1>
            </div>
            <p className="text-xl text-muted-foreground">
              Latest updates from OpenSVM and the Solana ecosystem
            </p>
          </div>
        </div>
      </div>

      {/* Category Filter */}
      <div className="border-b bg-card/30">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="flex gap-2 py-4 overflow-x-auto">
              {categories.map((category) => (
                <button
                  key={category}
                  className="px-4 py-2 rounded-lg border bg-background hover:bg-accent hover:text-accent-foreground transition-colors whitespace-nowrap"
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto">
          {/* Featured News */}
          {featuredNews.length > 0 && (
            <div className="mb-12">
              <div className="flex items-center gap-2 mb-6">
                <TrendingUp className="w-6 h-6 text-primary" />
                <h2 className="text-2xl font-bold">Featured</h2>
              </div>
              {featuredNews.map((item) => (
                <article
                  key={item.id}
                  className="border rounded-lg p-8 bg-card hover:shadow-lg transition-shadow bg-gradient-to-br from-primary/5 to-transparent"
                >
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <span className="px-3 py-1 text-xs font-medium rounded-full bg-primary text-primary-foreground">
                      {item.category}
                    </span>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      <span>{new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold mb-3 hover:text-primary transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-muted-foreground mb-4 text-lg">
                    {item.summary}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{item.source}</span>
                    <Link
                      href={item.isExternal && item.externalUrl ? item.externalUrl : `/news/${item.id}`}
                      className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                    >
                      Read more
                      {item.isExternal && <ExternalLink className="w-4 h-4" />}
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}

          {/* Regular News */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {regularNews.map((item) => (
              <article
                key={item.id}
                className="border rounded-lg p-6 bg-card hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <span className="px-3 py-1 text-xs font-medium rounded-full bg-primary/10 text-primary border border-primary/20">
                    {item.category}
                  </span>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    <span>{new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  </div>
                </div>
                
                <h3 className="text-xl font-bold mb-3 line-clamp-2 hover:text-primary transition-colors">
                  {item.title}
                </h3>
                
                <p className="text-muted-foreground mb-4 line-clamp-3">
                  {item.summary}
                </p>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{item.source}</span>
                  <Link
                    href={item.isExternal && item.externalUrl ? item.externalUrl : `/news/${item.id}`}
                    className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                  >
                    Read more
                    {item.isExternal && <ExternalLink className="w-4 h-4" />}
                  </Link>
                </div>
              </article>
            ))}
          </div>

          {/* Subscribe Section */}
          <div className="mt-12 p-8 border rounded-lg bg-card/50 text-center">
            <h3 className="text-2xl font-bold mb-2">Stay Updated</h3>
            <p className="text-muted-foreground mb-6">
              Get the latest news and updates about OpenSVM and the Solana ecosystem delivered to your inbox.
            </p>
            <div className="flex gap-2 max-w-md mx-auto">
              <input
                type="email"
                placeholder="Enter your email"
                className="flex-1 px-4 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
                Subscribe
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
