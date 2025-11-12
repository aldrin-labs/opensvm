'use client';

import { useEffect, useState } from 'react';
import { FileText, Download, ExternalLink, ChevronDown, ChevronRight } from 'lucide-react';
import Link from 'next/link';

interface OpenAPIEndpoint {
  path: string;
  method: string;
  summary: string;
  description?: string;
  parameters?: any[];
  responses?: any;
}

export default function SwaggerPage() {
  const [spec, setSpec] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Fetch OpenAPI spec
    fetch('/api/docs/openapi')
      .then(res => res.json())
      .then(data => {
        setSpec(data);
        setIsLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setIsLoading(false);
      });
  }, []);

  const togglePath = (key: string) => {
    const newExpanded = new Set(expandedPaths);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedPaths(newExpanded);
  };

  const getMethodColor = (method: string) => {
    const colors: Record<string, string> = {
      GET: 'bg-blue-500 text-white',
      POST: 'bg-green-500 text-white',
      PUT: 'bg-orange-500 text-white',
      DELETE: 'bg-red-500 text-white',
      PATCH: 'bg-purple-500 text-white',
    };
    return colors[method.toUpperCase()] || 'bg-gray-500 text-white';
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">OpenSVM API Documentation</h1>
              <p className="text-muted-foreground">
                Interactive API documentation and OpenAPI specification
              </p>
            </div>
            <div className="flex gap-3">
              <Link
                href="/api/docs/openapi"
                target="_blank"
                className="inline-flex items-center gap-2 px-4 py-2 text-sm border border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" />
                Download Spec
              </Link>
              <Link
                href="/docs"
                className="inline-flex items-center gap-2 px-4 py-2 text-sm border border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-lg transition-colors"
              >
                <FileText className="w-4 h-4" />
                User Docs
              </Link>
              <Link
                href="/llms.txt"
                target="_blank"
                className="inline-flex items-center gap-2 px-4 py-2 text-sm border border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-lg transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                LLM Docs
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 dark:bg-blue-950/30 border-b border-blue-200 dark:border-blue-800">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-start gap-3">
            <div className="text-blue-600 dark:text-blue-400 mt-1">
              <FileText className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                Complete API Reference with TypeScript Schemas
              </h3>
              <p className="text-sm text-blue-700 dark:text-blue-300 mb-2">
                Explore all <strong>98 API endpoints</strong> below. Every endpoint includes detailed TypeScript response schemas,
                request parameters, and examples. Click any endpoint to see full documentation.
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                <span className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
                  22 Response Schemas
                </span>
                <span className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded">
                  60+ Documented Paths
                </span>
                <span className="px-2 py-1 text-xs bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded">
                  Full TypeScript Types
                </span>
                <span className="px-2 py-1 text-xs bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 rounded">
                  OpenAPI 3.0.3
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading API documentation...</p>
            </div>
          </div>
        ) : error ? (
          <div className="max-w-2xl mx-auto">
            <div className="border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-2">
                Error Loading Documentation
              </h3>
              <p className="text-red-700 dark:text-red-300 mb-4">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        ) : spec ? (
          <div className="max-w-6xl mx-auto">
            {/* API Info */}
            <div className="mb-8 p-6 border rounded-lg bg-card">
              <h2 className="text-2xl font-bold mb-2">{spec.info?.title}</h2>
              <p className="text-muted-foreground mb-4">{spec.info?.description}</p>
              <div className="flex gap-4 text-sm">
                <span className="text-muted-foreground">Version: <span className="font-mono text-foreground">{spec.info?.version}</span></span>
                {spec.info?.contact?.email && (
                  <span className="text-muted-foreground">
                    Contact: <a href={`mailto:${spec.info.contact.email}`} className="text-primary hover:underline">{spec.info.contact.email}</a>
                  </span>
                )}
              </div>
            </div>

            {/* Endpoints by Tag */}
            {spec.tags?.map((tag: any) => {
              const tagPaths = Object.entries(spec.paths || {}).filter(([path, methods]: any) =>
                Object.values(methods).some((method: any) => method.tags?.includes(tag.name))
              );

              if (tagPaths.length === 0) return null;

              return (
                <div key={tag.name} className="mb-8">
                  <div className="mb-4">
                    <h3 className="text-xl font-bold">{tag.name}</h3>
                    <p className="text-sm text-muted-foreground">{tag.description}</p>
                  </div>
                  <div className="space-y-2">
                    {tagPaths.map(([path, methods]: any) =>
                      Object.entries(methods)
                        .filter(([method]) => ['get', 'post', 'put', 'delete', 'patch'].includes(method))
                        .map(([method, details]: any) => {
                          const key = `${method}-${path}`;
                          const isExpanded = expandedPaths.has(key);

                          return (
                            <div key={key} className="border rounded-lg overflow-hidden">
                              <button
                                onClick={() => togglePath(key)}
                                className="w-full p-4 flex items-center gap-3 hover:bg-accent/50 transition-colors text-left"
                              >
                                <span className={`px-3 py-1 rounded text-xs font-bold uppercase ${getMethodColor(method)}`}>
                                  {method}
                                </span>
                                <code className="font-mono text-sm flex-1">{path}</code>
                                <span className="text-sm text-muted-foreground">{details.summary}</span>
                                {isExpanded ? (
                                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                                )}
                              </button>
                              {isExpanded && (
                                <div className="border-t bg-muted/30 p-6">
                                  {details.description && (
                                    <p className="mb-4 text-sm">{details.description}</p>
                                  )}

                                  {/* cURL Example */}
                                  {details['x-code-samples'] && details['x-code-samples'].length > 0 && (
                                    <div className="mb-4">
                                      <h4 className="font-semibold mb-2">Example Request</h4>
                                      <div className="bg-slate-900 dark:bg-slate-950 rounded-lg p-4 border border-slate-700">
                                        <div className="flex items-center justify-between mb-2">
                                          <span className="text-xs text-slate-400 font-mono">cURL</span>
                                          <button
                                            onClick={() => {
                                              navigator.clipboard.writeText(details['x-code-samples'][0].source);
                                              // Could add a toast notification here
                                            }}
                                            className="text-xs px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition-colors"
                                          >
                                            Copy
                                          </button>
                                        </div>
                                        <pre className="text-xs text-slate-100 overflow-x-auto">
                                          <code>{details['x-code-samples'][0].source}</code>
                                        </pre>
                                      </div>
                                    </div>
                                  )}
                                  
                                  {details.parameters && details.parameters.length > 0 && (
                                    <div className="mb-4">
                                      <h4 className="font-semibold mb-2">Parameters</h4>
                                      <div className="space-y-2">
                                        {details.parameters.map((param: any, idx: number) => (
                                          <div key={idx} className="text-sm p-3 bg-background rounded border">
                                            <div className="flex items-center gap-2 mb-1">
                                              <code className="font-mono text-primary">{param.name}</code>
                                              <span className="text-xs px-2 py-0.5 bg-muted rounded">{param.in}</span>
                                              {param.required && (
                                                <span className="text-xs px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded">
                                                  required
                                                </span>
                                              )}
                                            </div>
                                            {param.description && (
                                              <p className="text-muted-foreground">{param.description}</p>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {details.responses && (
                                    <div>
                                      <h4 className="font-semibold mb-2">Responses</h4>
                                      <div className="space-y-2">
                                        {Object.entries(details.responses).map(([status, response]: any) => (
                                          <div key={status} className="text-sm p-3 bg-background rounded border">
                                            <div className="flex items-center gap-2 mb-2">
                                              <span className={`font-bold ${status.startsWith('2') ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                                {status}
                                              </span>
                                              <span>{response.description}</span>
                                            </div>
                                            {response.content?.['application/json']?.schema && (
                                              <div className="mt-2 p-2 bg-muted/50 rounded">
                                                <div className="text-xs font-semibold text-muted-foreground mb-1">Response Schema:</div>
                                                {response.content['application/json'].schema.$ref ? (
                                                  <code className="text-xs text-primary">
                                                    {response.content['application/json'].schema.$ref.split('/').pop()}
                                                  </code>
                                                ) : (
                                                  <pre className="text-xs overflow-auto">
                                                    {JSON.stringify(response.content['application/json'].schema, null, 2)}
                                                  </pre>
                                                )}
                                                {response.content['application/json'].schema.$ref && spec.components?.schemas && (
                                                  <div className="mt-2 text-xs">
                                                    <details className="cursor-pointer">
                                                      <summary className="font-semibold text-primary hover:underline">
                                                        View Schema Details
                                                      </summary>
                                                      <pre className="mt-2 p-2 bg-background rounded overflow-auto max-h-96">
                                                        {JSON.stringify(
                                                          spec.components.schemas[response.content['application/json'].schema.$ref.split('/').pop()],
                                                          null,
                                                          2
                                                        )}
                                                      </pre>
                                                    </details>
                                                  </div>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
