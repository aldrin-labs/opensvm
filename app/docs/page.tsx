import { promises as fs } from 'fs';
import path from 'path';
import Link from 'next/link';
import { Book, FileText, Search, Zap, HelpCircle, Keyboard } from 'lucide-react';

export const metadata = {
  title: 'OpenSVM Documentation - Comprehensive Guide',
  description: 'Complete documentation for OpenSVM - Solana blockchain explorer with AI-powered analytics',
};

interface DocCategory {
  title: string;
  description: string;
  icon: React.ReactNode;
  docs: { slug: string; title: string; description: string }[];
}

const docCategories: DocCategory[] = [
  {
    title: 'Getting Started',
    description: 'Learn the basics of OpenSVM',
    icon: <Zap className="w-6 h-6" />,
    docs: [
      { slug: 'introduction', title: 'Introduction', description: 'Overview of OpenSVM features and capabilities' },
      { slug: 'README', title: 'Quick Start', description: 'Get started with OpenSVM quickly' },
      { slug: 'FEATURES', title: 'Features', description: 'Complete list of OpenSVM features' },
      { slug: 'DEVELOPMENT', title: 'Development', description: 'Setup and development guide' },
    ]
  },
  {
    title: 'Architecture',
    description: 'Technical architecture and design',
    icon: <Book className="w-6 h-6" />,
    docs: [
      { slug: 'ARCHITECTURE', title: 'Architecture', description: 'System architecture and design patterns' },
      { slug: 'DIAGRAMS', title: 'Diagrams', description: 'System diagrams and visualizations' },
      { slug: 'PERFORMANCE_MONITORING', title: 'Performance Monitoring', description: 'Performance tracking and optimization' },
    ]
  },
  {
    title: 'API Documentation',
    description: 'REST API and integration guides',
    icon: <FileText className="w-6 h-6" />,
    docs: [
      { slug: 'API', title: 'API Reference', description: 'Complete API documentation' },
      { slug: 'API-SCHEMA-REFERENCE', title: 'API Schema Reference', description: 'Complete TypeScript schemas for all 98 endpoints' },
      { slug: 'MARKET_DATA_API_GUIDE', title: 'Market Data API Guide', description: 'User-friendly guide to the DEX Aggregator API with examples' },
      { slug: 'swagger', title: 'OpenAPI/Swagger Docs', description: 'Interactive API explorer with live testing' },
      { slug: 'DEX_API_TESTS', title: 'DEX Aggregator API', description: 'Market data, pools, OHLCV, and technical indicators' },
      { slug: 'TESTING', title: 'Testing Guide', description: 'API testing documentation and examples' },
      { slug: 'api/api-health-summary', title: 'API Health Check', description: 'Latest API health status and performance metrics' },
      { slug: 'api/health-check-report', title: 'Health Report', description: 'Detailed health check report for all endpoints' },
      { slug: 'AUTHENTICATION', title: 'Authentication', description: 'Authentication and authorization guide' },
      { slug: 'anthropic-sdk-integration-guide', title: 'Anthropic SDK', description: 'AI integration guide' },
    ]
  },
  {
    title: 'Testing & Security',
    description: 'Testing strategies and security',
    icon: <Search className="w-6 h-6" />,
    docs: [
      { slug: 'INTEGRATION_TESTING', title: 'Integration Testing', description: 'Testing guide and best practices' },
      { slug: 'SECURITY_IMPROVEMENTS', title: 'Security', description: 'Security features and improvements' },
      { slug: 'TOKEN_GATING_TESTING', title: 'Token Gating', description: 'Token gating and access control' },
    ]
  },
  {
    title: 'Additional Resources',
    description: 'Shortcuts and help resources',
    icon: <Keyboard className="w-6 h-6" />,
    docs: [
      { slug: 'keyboard-shortcuts', title: 'Keyboard Shortcuts', description: 'Power user shortcuts for efficient navigation' },
      { slug: 'FAQ', title: 'FAQ', description: 'Frequently asked questions' },
    ]
  },
];

export default async function DocsPage() {
  const docsDir = path.join(process.cwd(), 'docs');
  
  // Verify directory exists
  let filesExist = true;
  try {
    await fs.access(docsDir);
  } catch (error) {
    filesExist = false;
  }

  if (!filesExist) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl font-bold mb-4">Documentation</h1>
            <p className="text-muted-foreground">Documentation files are being loaded...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b backdrop-blur-sm bg-gradient-to-br from-background via-background to-primary/5">
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
              OpenSVM Documentation
            </h1>
            <p className="text-xl text-muted-foreground mb-8">
              Comprehensive guides and API references for the Solana blockchain explorer
            </p>
            <div className="flex gap-4 justify-center">
              <Link 
                href="/swagger" 
                className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                <FileText className="w-5 h-5" />
                API Reference
              </Link>
              <Link 
                href="/docs/README" 
                className="inline-flex items-center gap-2 px-6 py-3 border border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-lg transition-colors"
              >
                <Book className="w-5 h-5" />
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="container mx-auto px-4 py-8 bg-background">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
            <Link 
              href="/swagger"
              className="p-6 border rounded-lg hover:border-primary hover:shadow-lg transition-all group bg-card"
            >
              <FileText className="w-8 h-8 mb-3 text-primary" />
              <h3 className="text-lg font-semibold mb-2 group-hover:text-primary">Interactive API</h3>
              <p className="text-sm text-muted-foreground">Explore and test API endpoints with Swagger UI</p>
            </Link>
            <Link 
              href="/openapi"
              className="p-6 border rounded-lg hover:border-primary hover:shadow-lg transition-all group bg-card"
            >
              <FileText className="w-8 h-8 mb-3 text-primary" />
              <h3 className="text-lg font-semibold mb-2 group-hover:text-primary">OpenAPI Spec</h3>
              <p className="text-sm text-muted-foreground">Download OpenAPI specification in JSON format</p>
            </Link>
            <Link 
              href="/llms.txt"
              className="p-6 border rounded-lg hover:border-primary hover:shadow-lg transition-all group bg-card"
            >
              <HelpCircle className="w-8 h-8 mb-3 text-primary" />
              <h3 className="text-lg font-semibold mb-2 group-hover:text-primary">LLM Documentation</h3>
              <p className="text-sm text-muted-foreground">AI-optimized documentation for agents</p>
            </Link>
          </div>

          {/* Documentation Categories */}
          <div className="space-y-12">
            {docCategories.map((category, idx) => (
              <div key={idx}>
                <div className="flex items-center gap-3 mb-6">
                  <div className="text-primary">{category.icon}</div>
                  <div>
                    <h2 className="text-2xl font-bold">{category.title}</h2>
                    <p className="text-sm text-muted-foreground">{category.description}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {category.docs.map((doc) => (
                    <Link
                      key={doc.slug}
                      href={`/docs/${doc.slug}`}
                      className="group p-6 border rounded-lg hover:border-primary hover:shadow-md transition-all bg-card"
                    >
                      <h3 className="font-semibold mb-2 group-hover:text-primary">{doc.title}</h3>
                      <p className="text-sm text-muted-foreground">{doc.description}</p>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Additional Resources */}
          <div className="mt-16 p-8 border rounded-lg bg-card/50">
            <h2 className="text-2xl font-bold mb-4">Additional Resources</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <Keyboard className="w-5 h-5 text-primary" />
                  Keyboard Shortcuts
                </h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li><code className="px-2 py-1 bg-muted rounded">Cmd/Ctrl + K</code> - Quick search</li>
                  <li><code className="px-2 py-1 bg-muted rounded">Cmd/Ctrl + /</code> - Toggle AI chat</li>
                  <li><code className="px-2 py-1 bg-muted rounded">Esc</code> - Close modals</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-primary" />
                  Need Help?
                </h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Join our community for support</li>
                  <li>• Check GitHub issues for known problems</li>
                  <li>• Contact support@opensvm.com</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
