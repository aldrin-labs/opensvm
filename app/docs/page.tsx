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
      { slug: 'API-SCHEMA-REFERENCE', title: 'API Schema Reference', description: 'Complete TypeScript schemas for all 193 endpoints' },
      { slug: 'API_REFERENCE', title: 'Complete API Reference', description: 'Auto-generated documentation for all 193 endpoints with parameters and types' },
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900">
      {/* Header */}
      <div className="border-b-2 border-slate-200 dark:border-slate-800 backdrop-blur-sm bg-gradient-to-br from-white/90 via-slate-50/90 to-blue-50/90 dark:from-slate-900/90 dark:via-slate-900/90 dark:to-slate-800/90 shadow-sm">
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm font-medium mb-6 shadow-sm">
              <Book className="w-4 h-4" />
              Complete Documentation Hub
            </div>
            <h1 className="text-6xl font-bold mb-6 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 dark:from-blue-400 dark:via-purple-400 dark:to-pink-400 bg-clip-text text-transparent leading-tight">
              OpenSVM Documentation
            </h1>
            <p className="text-xl text-slate-600 dark:text-slate-400 mb-10 leading-relaxed">
              Comprehensive guides, API references, and tutorials for the Solana blockchain explorer
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <Link 
                href="/swagger" 
                className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl font-semibold"
              >
                <FileText className="w-5 h-5" />
                Interactive API
              </Link>
              <Link 
                href="/docs/README" 
                className="inline-flex items-center gap-2 px-8 py-4 border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl transition-all shadow-md hover:shadow-lg font-semibold"
              >
                <Zap className="w-5 h-5" />
                Quick Start
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="container mx-auto px-4 py-10 bg-transparent">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
            <Link 
              href="/swagger"
              className="p-8 border-2 border-slate-200 dark:border-slate-700 rounded-2xl hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-2xl transition-all duration-300 group bg-white dark:bg-slate-800 transform hover:-translate-y-1"
            >
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg">
                <FileText className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">Interactive API</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">Explore and test 98 API endpoints with live Swagger UI documentation</p>
            </Link>
            <Link 
              href="/openapi"
              className="p-8 border-2 border-slate-200 dark:border-slate-700 rounded-2xl hover:border-purple-400 dark:hover:border-purple-600 hover:shadow-2xl transition-all duration-300 group bg-white dark:bg-slate-800 transform hover:-translate-y-1"
            >
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg">
                <FileText className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-slate-900 dark:text-slate-100 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">OpenAPI Spec</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">Download complete OpenAPI 3.0 specification in JSON format</p>
            </Link>
            <Link 
              href="/llms.txt"
              className="p-8 border-2 border-slate-200 dark:border-slate-700 rounded-2xl hover:border-green-400 dark:hover:border-green-600 hover:shadow-2xl transition-all duration-300 group bg-white dark:bg-slate-800 transform hover:-translate-y-1"
            >
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg">
                <HelpCircle className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-slate-900 dark:text-slate-100 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">LLM Documentation</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">AI-optimized documentation for language models and agents</p>
            </Link>
          </div>

          {/* Documentation Categories */}
          <div className="space-y-16">
            {docCategories.map((category, idx) => (
              <div key={idx} className="bg-white dark:bg-slate-800 rounded-2xl p-8 border-2 border-slate-200 dark:border-slate-700 shadow-lg">
                <div className="flex items-center gap-4 mb-8 pb-4 border-b-2 border-slate-200 dark:border-slate-700">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-md">
                    <span className="text-white">{category.icon}</span>
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100">{category.title}</h2>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{category.description}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {category.docs.map((doc) => (
                    <Link
                      key={doc.slug}
                      href={`/docs/${doc.slug}`}
                      className="group p-6 border-2 border-slate-100 dark:border-slate-700 rounded-xl hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-lg transition-all duration-200 bg-slate-50/50 dark:bg-slate-900/30 transform hover:-translate-y-0.5"
                    >
                      <h3 className="font-bold text-slate-900 dark:text-slate-100 mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{doc.title}</h3>
                      <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{doc.description}</p>
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
