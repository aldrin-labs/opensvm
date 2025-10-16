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
    date: '2024-10-15',
    category: 'Product',
    tags: ['launch', 'product', 'announcement'],
    readTime: '5 min read'
  },
  {
    id: '2',
    title: 'AI-Powered Transaction Analysis: How It Works',
    excerpt: 'Deep dive into our AI-powered transaction analysis feature. Discover how we use machine learning to provide insights into Solana transactions.',
    author: 'Engineering Team',
    date: '2024-10-10',
    category: 'Technology',
    tags: ['AI', 'technology', 'features'],
    readTime: '8 min read'
  },
  {
    id: '3',
    title: 'Building for Performance: Our Architecture Choices',
    excerpt: 'An inside look at the technical decisions behind OpenSVM\'s blazing-fast performance and scalability.',
    author: 'Architecture Team',
    date: '2024-10-05',
    category: 'Engineering',
    tags: ['architecture', 'performance', 'engineering'],
    readTime: '10 min read'
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
