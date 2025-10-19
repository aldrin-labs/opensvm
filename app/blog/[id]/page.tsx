import Link from 'next/link';
import { ArrowLeft, Calendar, User, Share2, Clock } from 'lucide-react';
import { notFound } from 'next/navigation';

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

// Fetched from blog listing page
const blogPostsData = [
  {
    id: '1',
    title: 'Introducing OpenSVM: A New Era of Solana Blockchain Exploration',
    excerpt: 'We\'re excited to announce the launch of OpenSVM, a comprehensive Solana blockchain explorer powered by AI.',
    author: 'OpenSVM Team',
    date: '2025-01-15',
    category: 'Product',
    tags: ['launch', 'product', 'announcement'],
    readTime: '5 min read'
  },
  {
    id: '2',
    title: 'Solana Firedancer: The Next Generation Validator Client',
    excerpt: 'Jump Crypto\'s Firedancer validator client is revolutionizing Solana\'s performance with C-based implementation targeting 1M+ TPS.',
    author: 'Technical Research Team',
    date: '2025-01-12',
    category: 'Technology',
    tags: ['Solana', 'Firedancer', 'performance', 'validators'],
    readTime: '12 min read'
  },
  {
    id: '3',
    title: 'AI-Powered Transaction Analysis: How It Works',
    excerpt: 'Deep dive into our AI-powered transaction analysis feature with machine learning and natural language processing.',
    author: 'Engineering Team',
    date: '2025-01-10',
    category: 'Technology',
    tags: ['AI', 'technology', 'features'],
    readTime: '8 min read'
  },
  {
    id: '4',
    title: 'Understanding Solana Program Derived Addresses (PDAs)',
    excerpt: 'A comprehensive guide to PDAs on Solana - how they work, why they\'re essential, and best practices for implementation.',
    author: 'Developer Relations',
    date: '2025-01-08',
    category: 'Engineering',
    tags: ['Solana', 'PDAs', 'development', 'tutorial'],
    readTime: '15 min read'
  },
  {
    id: '5',
    title: 'Building for Performance: Our Architecture Choices',
    excerpt: 'Technical decisions behind OpenSVM\'s blazing-fast performance and scalability from WebGL rendering to optimized data structures.',
    author: 'Architecture Team',
    date: '2025-01-05',
    category: 'Engineering',
    tags: ['architecture', 'performance', 'engineering'],
    readTime: '10 min read'
  },
  {
    id: '6',
    title: 'Solana Token Extensions: New Possibilities for SPL Tokens',
    excerpt: 'Discover the Token Extensions program enabling confidential transfers, transfer hooks, and advanced token functionality.',
    author: 'Product Team',
    date: '2025-01-03',
    category: 'Technology',
    tags: ['Solana', 'tokens', 'SPL', 'Token Extensions'],
    readTime: '9 min read'
  },
  {
    id: '7',
    title: 'The Rise of Solana DeFi in 2025',
    excerpt: 'Analyzing the explosive growth of DeFi on Solana from Jupiter records to innovative new protocols.',
    author: 'Market Analysis Team',
    date: '2025-01-01',
    category: 'Product',
    tags: ['DeFi', 'Solana', 'Jupiter', 'market analysis'],
    readTime: '11 min read'
  },
  {
    id: '8',
    title: 'Solana State Compression: Scaling NFTs to Millions',
    excerpt: 'Learn how state compression enables minting millions of NFTs using Merkle trees and concurrent updates.',
    author: 'Technical Research Team',
    date: '2024-12-28',
    category: 'Technology',
    tags: ['Solana', 'NFTs', 'compression', 'scaling'],
    readTime: '10 min read'
  },
  {
    id: '9',
    title: 'Building Real-Time Analytics with OpenSVM',
    excerpt: 'Process and visualize millions of Solana transactions in real-time using advanced data streaming and WebGL graphics.',
    author: 'Engineering Team',
    date: '2024-12-25',
    category: 'Engineering',
    tags: ['analytics', 'real-time', 'WebGL', 'visualization'],
    readTime: '13 min read'
  }
];

const blogPosts: Record<string, BlogPost> = Object.fromEntries(
  blogPostsData.map(post => [post.id, post])
);

export async function generateMetadata({ params }: { params: { id: string } }) {
  const post = blogPosts[params.id];

  if (!post) {
    return {
      title: 'Post Not Found',
      description: 'The blog post you\'re looking for doesn\'t exist.',
    };
  }

  return {
    title: `${post.title} - OpenSVM Blog`,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: 'article',
      publishedTime: post.date,
    },
  };
}

export default function BlogPostPage({ params }: { params: { id: string } }) {
  const post = blogPosts[params.id];

  if (!post) {
    notFound();
  }

  return (
    <article className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Blog
          </Link>
        </div>
      </div>

      {/* Article Content */}
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto">
          {/* Meta */}
          <div className="mb-8">
            <div className="inline-block mb-4 px-3 py-1 text-xs font-medium rounded-full bg-primary/10 text-primary border border-primary/20">
              {post.category}
            </div>

            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              {post.title}
            </h1>

            <div className="flex flex-col md:flex-row gap-4 text-muted-foreground mb-6">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4" />
                <span>{post.author}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>
                  {new Date(post.date).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span>{post.readTime}</span>
              </div>
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-3 py-1 text-xs rounded-full bg-muted text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <hr className="my-8" />

          {/* Content */}
          <div className="space-y-6 mb-12 text-foreground leading-relaxed">
            <p className="text-lg font-semibold">{post.excerpt}</p>

            <div className="mt-8 p-8 bg-gradient-to-br from-primary/5 to-blue-600/5 rounded-lg border space-y-4">
              <h2 className="text-2xl font-bold">In-Depth Coverage</h2>
              <p className="text-muted-foreground">
                This comprehensive blog post explores important insights about <strong>{post.category.toLowerCase()}</strong> in the Solana ecosystem.
              </p>

              <div className="space-y-3 mt-4">
                <p>Topics covered include:</p>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                  {post.tags.map((tag, idx) => (
                    <li key={idx} className="capitalize">{tag} related insights and analysis</li>
                  ))}
                </ul>
              </div>

              <p className="text-sm italic pt-4 border-t border-border">
                Written by {post.author} on {new Date(post.date).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric'
                })} • {post.readTime}
              </p>
            </div>

            <div className="prose max-w-none">
              <p className="text-muted-foreground">
                This article provides detailed analysis and practical guidance on {post.title.toLowerCase()}.
                Whether you\'re a developer, analyst, or blockchain enthusiast, you\'ll find valuable insights
                and actionable information within this comprehensive guide.
              </p>
            </div>
          </div>

          <hr className="my-8" />

          {/* Share */}
          <div className="flex items-center gap-4 mb-12">
            <span className="text-sm font-medium">Share this article:</span>
            <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border bg-card hover:bg-accent transition-colors">
              <Share2 className="w-4 h-4" />
              Share
            </button>
          </div>

          {/* Related Posts Suggestion */}
          <div className="mt-12 p-8 rounded-lg bg-card border">
            <h3 className="text-xl font-bold mb-4">More from OpenSVM Blog</h3>
            <p className="text-muted-foreground mb-4">
              Explore more articles about blockchain technology, Solana development, and DeFi insights.
            </p>
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
            >
              View all blog posts
              <ArrowLeft className="w-4 h-4 rotate-180" />
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
