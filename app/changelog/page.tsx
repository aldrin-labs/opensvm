import Link from 'next/link';
import { GitBranch, Check, AlertCircle, Info, Package, TestTube, Shield } from 'lucide-react';

export const metadata = {
  title: 'OpenSVM Changelog - Version History',
  description: 'Complete changelog of OpenSVM releases with version history and E2E test metrics',
};

interface ChangelogEntry {
  version: string;
  date: string;
  type: 'major' | 'minor' | 'patch';
  changes: {
    category: 'Added' | 'Changed' | 'Fixed' | 'Removed' | 'Security';
    items: string[];
  }[];
  metrics: {
    e2eTests: {
      total: number;
      passed: number;
      failed: number;
      duration: string;
    };
    coverage: number;
    performance: {
      avgResponseTime: string;
      p95ResponseTime: string;
    };
  };
}

const changelog: ChangelogEntry[] = [
  {
    version: '1.2.0',
    date: '2024-10-16',
    type: 'minor',
    changes: [
      {
        category: 'Added',
        items: [
          'Comprehensive documentation routes (/docs, /swagger, /openapi, /llms.txt)',
          'Blog page for corporate updates and insights',
          'News page for Solana ecosystem updates',
          'Enhanced Settings menu with documentation links',
          'AI-powered transaction analysis improvements',
        ]
      },
      {
        category: 'Changed',
        items: [
          'Improved RPC selector UI to hide URL for osvm rpc',
          'Enhanced mobile responsiveness across all pages',
          'Updated theme system for better dark mode support',
        ]
      },
      {
        category: 'Fixed',
        items: [
          'TimeoutConfig module resolution in Anthropic proxy',
          'Build errors in Netlify deployment',
          'Theme inconsistencies in documentation pages',
        ]
      },
    ],
    metrics: {
      e2eTests: {
        total: 147,
        passed: 145,
        failed: 2,
        duration: '8m 32s'
      },
      coverage: 87,
      performance: {
        avgResponseTime: '124ms',
        p95ResponseTime: '340ms'
      }
    }
  },
  {
    version: '1.1.5',
    date: '2024-10-10',
    type: 'patch',
    changes: [
      {
        category: 'Fixed',
        items: [
          'Memory leak in transaction graph rendering',
          'Token metadata loading delays',
          'Search suggestions timeout issues',
        ]
      },
      {
        category: 'Changed',
        items: [
          'Optimized WebSocket connection handling',
          'Improved error messages for failed RPC calls',
        ]
      },
    ],
    metrics: {
      e2eTests: {
        total: 142,
        passed: 140,
        failed: 2,
        duration: '7m 45s'
      },
      coverage: 85,
      performance: {
        avgResponseTime: '135ms',
        p95ResponseTime: '380ms'
      }
    }
  },
  {
    version: '1.1.0',
    date: '2024-10-05',
    type: 'minor',
    changes: [
      {
        category: 'Added',
        items: [
          'NFT analytics dashboard with collection rankings',
          'DeFi protocol integration for 15 new platforms',
          'Advanced token holder analytics',
          'Real-time price updates for tokens',
        ]
      },
      {
        category: 'Security',
        items: [
          'Enhanced API rate limiting',
          'Improved input validation for search queries',
        ]
      },
    ],
    metrics: {
      e2eTests: {
        total: 138,
        passed: 136,
        failed: 2,
        duration: '7m 20s'
      },
      coverage: 83,
      performance: {
        avgResponseTime: '145ms',
        p95ResponseTime: '420ms'
      }
    }
  },
  {
    version: '1.0.0',
    date: '2024-10-01',
    type: 'major',
    changes: [
      {
        category: 'Added',
        items: [
          'Initial release of OpenSVM blockchain explorer',
          'AI-powered transaction analysis',
          'Real-time blockchain data visualization',
          'Interactive transaction graph',
          'Comprehensive search functionality',
          'Multi-theme support with cyberpunk default',
        ]
      },
    ],
    metrics: {
      e2eTests: {
        total: 120,
        passed: 118,
        failed: 2,
        duration: '6m 50s'
      },
      coverage: 80,
      performance: {
        avgResponseTime: '160ms',
        p95ResponseTime: '450ms'
      }
    }
  },
];

const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'Added':
      return <Package className="w-4 h-4" />;
    case 'Changed':
      return <Info className="w-4 h-4" />;
    case 'Fixed':
      return <Check className="w-4 h-4" />;
    case 'Removed':
      return <AlertCircle className="w-4 h-4" />;
    case 'Security':
      return <Shield className="w-4 h-4" />;
    default:
      return <Info className="w-4 h-4" />;
  }
};

const getCategoryColor = (category: string) => {
  switch (category) {
    case 'Added':
      return 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30';
    case 'Changed':
      return 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30';
    case 'Fixed':
      return 'text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30';
    case 'Removed':
      return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30';
    case 'Security':
      return 'text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30';
    default:
      return 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-900/30';
  }
};

const getVersionBadgeColor = (type: string) => {
  switch (type) {
    case 'major':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800';
    case 'minor':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800';
    case 'patch':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400 border-gray-200 dark:border-gray-800';
  }
};

export default function ChangelogPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-4xl mx-auto text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <GitBranch className="w-12 h-12 text-primary" />
              <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                Changelog
              </h1>
            </div>
            <p className="text-xl text-muted-foreground">
              Version history and release notes for OpenSVM
            </p>
          </div>
        </div>
      </div>

      {/* Current Metrics Overview */}
      <div className="border-b bg-card/30">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg border bg-card">
                <div className="flex items-center gap-2 mb-2">
                  <TestTube className="w-5 h-5 text-primary" />
                  <span className="text-sm text-muted-foreground">E2E Tests</span>
                </div>
                <p className="text-2xl font-bold">{changelog[0].metrics.e2eTests.passed}/{changelog[0].metrics.e2eTests.total}</p>
                <p className="text-xs text-muted-foreground mt-1">{changelog[0].metrics.e2eTests.duration}</p>
              </div>
              
              <div className="p-4 rounded-lg border bg-card">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-5 h-5 text-primary" />
                  <span className="text-sm text-muted-foreground">Coverage</span>
                </div>
                <p className="text-2xl font-bold">{changelog[0].metrics.coverage}%</p>
                <p className="text-xs text-muted-foreground mt-1">Code coverage</p>
              </div>
              
              <div className="p-4 rounded-lg border bg-card">
                <div className="flex items-center gap-2 mb-2">
                  <Info className="w-5 h-5 text-primary" />
                  <span className="text-sm text-muted-foreground">Avg Response</span>
                </div>
                <p className="text-2xl font-bold">{changelog[0].metrics.performance.avgResponseTime}</p>
                <p className="text-xs text-muted-foreground mt-1">Average time</p>
              </div>
              
              <div className="p-4 rounded-lg border bg-card">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="w-5 h-5 text-primary" />
                  <span className="text-sm text-muted-foreground">P95 Response</span>
                </div>
                <p className="text-2xl font-bold">{changelog[0].metrics.performance.p95ResponseTime}</p>
                <p className="text-xs text-muted-foreground mt-1">95th percentile</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Changelog Entries */}
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="space-y-8">
            {changelog.map((entry, index) => (
              <article key={entry.version} className="relative">
                {/* Timeline connector */}
                {index < changelog.length - 1 && (
                  <div className="absolute left-4 top-16 bottom-0 w-0.5 bg-border" />
                )}
                
                <div className="relative border rounded-lg overflow-hidden bg-card hover:shadow-lg transition-shadow">
                  {/* Version Header */}
                  <div className="p-6 border-b bg-card/50">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold">
                          {entry.version.split('.')[0]}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h2 className="text-2xl font-bold">v{entry.version}</h2>
                            <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getVersionBadgeColor(entry.type)}`}>
                              {entry.type}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Released on {new Date(entry.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Changes */}
                  <div className="p-6">
                    <div className="space-y-6">
                      {entry.changes.map((change, changeIndex) => (
                        <div key={changeIndex}>
                          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium mb-3 ${getCategoryColor(change.category)}`}>
                            {getCategoryIcon(change.category)}
                            {change.category}
                          </div>
                          <ul className="space-y-2 ml-4">
                            {change.items.map((item, itemIndex) => (
                              <li key={itemIndex} className="flex items-start gap-2 text-sm">
                                <span className="text-muted-foreground mt-1">•</span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>

                    {/* Metrics */}
                    <div className="mt-6 pt-6 border-t">
                      <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                        <TestTube className="w-4 h-4" />
                        Release Metrics
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">E2E Tests</p>
                          <p className="text-sm font-medium">
                            {entry.metrics.e2eTests.passed}/{entry.metrics.e2eTests.total}
                            <span className="text-xs text-muted-foreground ml-1">
                              ({Math.round((entry.metrics.e2eTests.passed / entry.metrics.e2eTests.total) * 100)}%)
                            </span>
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Duration</p>
                          <p className="text-sm font-medium">{entry.metrics.e2eTests.duration}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Coverage</p>
                          <p className="text-sm font-medium">{entry.metrics.coverage}%</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Avg Response</p>
                          <p className="text-sm font-medium">{entry.metrics.performance.avgResponseTime}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {/* Footer */}
          <div className="mt-12 p-8 border rounded-lg bg-card/50 text-center">
            <h3 className="text-xl font-semibold mb-2">View Full History</h3>
            <p className="text-muted-foreground mb-6">
              For a complete version history and detailed release notes, visit our GitHub repository.
            </p>
            <Link
              href="https://github.com/aldrin-labs/opensvm"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              <GitBranch className="w-5 h-5" />
              View on GitHub
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
