import Link from 'next/link';
import { Calendar, User, Tag, ArrowRight } from 'lucide-react';

export const metadata = {
  title: 'OpenSVM Blog - Corporate Updates and Insights',
  description: 'Official OpenSVM blog with company updates, product announcements, and technical insights',
};

interface BlogPost {
  id: string;
  title: string;
  excerpt: string;
  author: string;
  date: string;
  category: string;
  tags: string[];
  readTime: string;
}

const blogPosts: BlogPost[] = [
  {
    id: '1',
    title: 'Introducing OpenSVM: A New Era of Solana Blockchain Exploration',
    excerpt: 'We\'re excited to announce the launch of OpenSVM, a comprehensive Solana blockchain explorer powered by AI. Learn about our vision and the features that set us apart.',
    author: 'OpenSVM Team',
    date: '2025-01-15',
    category: 'Product',
    tags: ['launch', 'product', 'announcement'],
    readTime: '5 min read'
  },
  {
    id: '2',
    title: 'Solana Firedancer: The Next Generation Validator Client',
    excerpt: 'Explore how Jump Crypto\'s Firedancer validator client is revolutionizing Solana\'s performance with C-based implementation targeting 1M+ TPS. Learn about its architecture and what it means for the ecosystem.',
    author: 'Technical Research Team',
    date: '2025-01-12',
    category: 'Technology',
    tags: ['Solana', 'Firedancer', 'performance', 'validators'],
    readTime: '12 min read'
  },
  {
    id: '3',
    title: 'AI-Powered Transaction Analysis: How It Works',
    excerpt: 'Deep dive into our AI-powered transaction analysis feature. Discover how we use machine learning to provide insights into Solana transactions with natural language processing.',
    author: 'Engineering Team',
    date: '2025-01-10',
    category: 'Technology',
    tags: ['AI', 'technology', 'features'],
    readTime: '8 min read'
  },
  {
    id: '4',
    title: 'Understanding Solana Program Derived Addresses (PDAs)',
    excerpt: 'A comprehensive guide to PDAs on Solana - how they work, why they\'re essential for program development, and best practices for implementation.',
    author: 'Developer Relations',
    date: '2025-01-08',
    category: 'Engineering',
    tags: ['Solana', 'PDAs', 'development', 'tutorial'],
    readTime: '15 min read'
  },
  {
    id: '5',
    title: 'Building for Performance: Our Architecture Choices',
    excerpt: 'An inside look at the technical decisions behind OpenSVM\'s blazing-fast performance and scalability. From WebGL rendering to optimized data structures.',
    author: 'Architecture Team',
    date: '2025-01-05',
    category: 'Engineering',
    tags: ['architecture', 'performance', 'engineering'],
    readTime: '10 min read'
  },
  {
    id: '6',
    title: 'Solana Token Extensions: New Possibilities for SPL Tokens',
    excerpt: 'Discover the new Token Extensions program that enables confidential transfers, transfer hooks, permanent delegates, and more advanced token functionality on Solana.',
    author: 'Product Team',
    date: '2025-01-03',
    category: 'Technology',
    tags: ['Solana', 'tokens', 'SPL', 'Token Extensions'],
    readTime: '9 min read'
  },
  {
    id: '7',
    title: 'The Rise of Solana DeFi in 2025',
    excerpt: 'Analyzing the explosive growth of DeFi on Solana - from Jupiter\'s record-breaking volumes to innovative new protocols pushing the boundaries of on-chain finance.',
    author: 'Market Analysis Team',
    date: '2025-01-01',
    category: 'Product',
    tags: ['DeFi', 'Solana', 'Jupiter', 'market analysis'],
    readTime: '11 min read'
  },
  {
    id: '8',
    title: 'Solana State Compression: Scaling NFTs to Millions',
    excerpt: 'Learn how Solana\'s state compression technology enables minting millions of NFTs at a fraction of the cost using Merkle trees and concurrent updates.',
    author: 'Technical Research Team',
    date: '2024-12-28',
    category: 'Technology',
    tags: ['Solana', 'NFTs', 'compression', 'scaling'],
    readTime: '10 min read'
  },
  {
    id: '9',
    title: 'Memecoins on Solana: The Cultural Phenomenon Driving Innovation',
    excerpt: 'Exploring the memecoin revolution on Solana - from $BONK to $WIF and beyond. How community-driven tokens are pushing the boundaries of DeFi, creating new use cases, and onboarding millions to crypto.',
    author: 'Community Team',
    date: '2025-01-18',
    category: 'Culture',
    tags: ['memecoins', 'Solana', 'community', '$BONK', '$WIF'],
    readTime: '8 min read'
  },
  {
    id: '10',
    title: 'AI x Crypto: The Convergence of Artificial Intelligence and Blockchain',
    excerpt: 'A comprehensive overview of how AI and crypto are merging to create new paradigms. From AI-powered trading bots to decentralized AI compute networks, explore the intersection reshaping both industries.',
    author: 'Research Team',
    date: '2025-01-20',
    category: 'AI & Crypto',
    tags: ['AI', 'crypto', 'machine learning', 'blockchain'],
    readTime: '14 min read'
  },
  {
    id: '11',
    title: 'On-Chain AI Agents: Autonomous Programs on Solana',
    excerpt: 'Deep dive into autonomous AI agents operating on-chain. Learn how intelligent programs can execute trades, manage portfolios, and interact with DeFi protocols without human intervention.',
    author: 'AI Research Team',
    date: '2025-01-22',
    category: 'AI & Crypto',
    tags: ['AI agents', 'autonomous', 'on-chain', 'Solana', 'DeFi'],
    readTime: '16 min read'
  },
  {
    id: '12',
    title: 'Building Your First On-Chain AI Agent: A Developer\'s Guide',
    excerpt: 'Step-by-step tutorial for building autonomous AI agents on Solana. From setting up your development environment to deploying intelligent programs that interact with DeFi protocols.',
    author: 'Developer Relations',
    date: '2025-01-25',
    category: 'Tutorial',
    tags: ['AI agents', 'tutorial', 'development', 'Solana', 'coding'],
    readTime: '20 min read'
  },
  {
    id: '13',
    title: 'Training Your Own AI Model for Crypto: A Practical Guide',
    excerpt: 'Learn how to develop custom AI models for cryptocurrency analysis. Covers data collection, preprocessing, model architecture selection, and training pipelines for market prediction and sentiment analysis.',
    author: 'ML Engineering Team',
    date: '2025-01-28',
    category: 'AI & Tutorial',
    tags: ['AI', 'machine learning', 'training', 'models', 'crypto'],
    readTime: '18 min read'
  },
  {
    id: '14',
    title: 'Fine-Tuning LLMs for Blockchain Applications',
    excerpt: 'Comprehensive guide to fine-tuning large language models for crypto-specific tasks. Learn about dataset creation, PEFT techniques, LoRA, and deploying fine-tuned models for on-chain analysis.',
    author: 'AI Research Team',
    date: '2025-01-30',
    category: 'AI & Tutorial',
    tags: ['LLM', 'fine-tuning', 'AI', 'blockchain', 'tutorial'],
    readTime: '22 min read'
  },
  {
    id: '15',
    title: 'Decentralized AI Compute on Solana: The Future of Model Training',
    excerpt: 'Explore how Solana\'s high throughput enables decentralized AI compute networks. Learn about distributed training, tokenized GPU resources, and the economic models powering this revolution.',
    author: 'Infrastructure Team',
    date: '2025-02-01',
    category: 'AI & Crypto',
    tags: ['AI compute', 'decentralized', 'Solana', 'GPU', 'infrastructure'],
    readTime: '12 min read'
  },
  {
    id: '16',
    title: 'AI Trading Bots: From Simple Scripts to Advanced Strategies',
    excerpt: 'Complete guide to building AI-powered trading bots on Solana. Covers market making, arbitrage, sentiment analysis integration, risk management, and backtesting strategies.',
    author: 'Quantitative Team',
    date: '2025-02-03',
    category: 'Tutorial',
    tags: ['trading bots', 'AI', 'DeFi', 'strategies', 'automation'],
    readTime: '25 min read'
  },
  {
    id: '17',
    title: 'The Memecoin Playbook: Launch, Marketing, and Community Building',
    excerpt: 'Insider\'s guide to launching successful memecoins on Solana. Learn about tokenomics, fair launches, building engaged communities, and creating lasting value beyond the hype.',
    author: 'Community & Marketing',
    date: '2025-02-05',
    category: 'Culture',
    tags: ['memecoins', 'launch', 'marketing', 'community', 'tokenomics'],
    readTime: '11 min read'
  },
  {
    id: '18',
    title: 'Multi-Agent Systems: Coordinating AI Agents for Complex DeFi Strategies',
    excerpt: 'Advanced exploration of multi-agent AI systems on Solana. Learn how multiple autonomous agents can coordinate, compete, and collaborate to execute sophisticated DeFi strategies.',
    author: 'AI Research Team',
    date: '2025-02-08',
    category: 'AI & Crypto',
    tags: ['multi-agent', 'AI', 'coordination', 'DeFi', 'advanced'],
    readTime: '19 min read'
  },
  {
    id: '9',
    title: 'Building Real-Time Analytics with OpenSVM',
    excerpt: 'How we process and visualize millions of Solana transactions in real-time using advanced data streaming and WebGL-powered graphics.',
    author: 'Engineering Team',
    date: '2024-12-25',
    category: 'Engineering',
    tags: ['analytics', 'real-time', 'WebGL', 'visualization'],
    readTime: '13 min read'
  },
];

const categories = ['All', 'Product', 'Technology', 'Engineering', 'Company'];

export default function BlogPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              OpenSVM Blog
            </h1>
            <p className="text-xl text-muted-foreground">
              Insights, updates, and stories from the OpenSVM team
            </p>
          </div>
        </div>
      </div>

      {/* Categories */}
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

      {/* Blog Posts */}
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {blogPosts.map((post) => (
              <article
                key={post.id}
                className="border rounded-lg overflow-hidden hover:shadow-lg transition-shadow bg-card"
              >
                <div className="p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="px-3 py-1 text-xs font-medium rounded-full bg-primary/10 text-primary border border-primary/20">
                      {post.category}
                    </span>
                    <span className="text-xs text-muted-foreground">{post.readTime}</span>
                  </div>
                  
                  <h2 className="text-xl font-bold mb-3 line-clamp-2 hover:text-primary transition-colors">
                    {post.title}
                  </h2>
                  
                  <p className="text-muted-foreground mb-4 line-clamp-3">
                    {post.excerpt}
                  </p>
                  
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                    <div className="flex items-center gap-1">
                      <User className="w-4 h-4" />
                      <span>{post.author}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      <span>{new Date(post.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 mb-4">
                    {post.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-muted text-muted-foreground"
                      >
                        <Tag className="w-3 h-3" />
                        {tag}
                      </span>
                    ))}
                  </div>
                  
                  <Link
                    href={`/blog/${post.id}`}
                    className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                  >
                    Read more
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </article>
            ))}
          </div>

          {/* Empty State for future posts */}
          <div className="mt-12 text-center p-12 border rounded-lg bg-card/50">
            <h3 className="text-xl font-semibold mb-2">More posts coming soon!</h3>
            <p className="text-muted-foreground mb-6">
              We're working on bringing you more insights and updates. Stay tuned!
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              Back to Explorer
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
