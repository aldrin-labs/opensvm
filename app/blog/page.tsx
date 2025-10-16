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
