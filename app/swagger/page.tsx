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

  // Helper function to resolve $ref recursively
  const resolveRef = (schema: any, visited = new Set<string>()): any => {
    if (!schema) return schema;
    
    if (schema.$ref) {
      const refPath = schema.$ref;
      
      // Prevent circular references
      if (visited.has(refPath)) {
        return { type: 'object', description: `Circular reference to ${refPath.split('/').pop()}` };
      }
      
      visited.add(refPath);
      
      // Extract schema name from $ref path like "#/components/schemas/TransactionListResponse"
      const schemaName = refPath.split('/').pop();
      const resolvedSchema = spec?.components?.schemas?.[schemaName];
      
      if (resolvedSchema) {
        return resolveRef(resolvedSchema, visited);
      }
      
      return schema;
    }
    
    // Handle arrays
    if (schema.type === 'array' && schema.items) {
      return {
        ...schema,
        items: resolveRef(schema.items, visited)
      };
    }
    
    // Handle objects with properties
    if (schema.properties) {
      const resolvedProperties: any = {};
      for (const [key, value] of Object.entries(schema.properties)) {
        resolvedProperties[key] = resolveRef(value as any, new Set(visited));
      }
      return {
        ...schema,
        properties: resolvedProperties
      };
    }
    
    return schema;
  };

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
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      {/* Header */}
      <div className="border-b bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-sm">
        <div className="container mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
                  <FileText className="w-6 h-6 text-white" />
                </div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  OpenSVM API
                </h1>
              </div>
              <p className="text-slate-600 dark:text-slate-400 text-lg ml-14">
                Complete REST API reference with 98 endpoints
              </p>
            </div>
            <div className="flex gap-3">
              <Link
                href="/api/docs/openapi"
                target="_blank"
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl transition-all shadow-sm hover:shadow-md"
              >
                <Download className="w-4 h-4" />
                Download Spec
              </Link>
              <Link
                href="/docs"
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl transition-all shadow-sm hover:shadow-md"
              >
                <FileText className="w-4 h-4" />
                User Docs
              </Link>
              <Link
                href="/llms.txt"
                target="_blank"
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 rounded-xl transition-all shadow-md hover:shadow-lg"
              >
                <ExternalLink className="w-4 h-4" />
                LLM Docs
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 border-b border-blue-200/50 dark:border-blue-800/50">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-start gap-4">
            <div className="p-2.5 bg-blue-500/10 dark:bg-blue-500/20 rounded-lg">
              <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-lg text-blue-900 dark:text-blue-100 mb-2">
                Complete API Reference with TypeScript Schemas
              </h3>
              <p className="text-sm text-blue-800/90 dark:text-blue-300/90 mb-3 leading-relaxed">
                Explore all <strong className="font-bold">98 API endpoints</strong> with detailed TypeScript response schemas,
                request parameters, and ready-to-use cURL examples. Click any endpoint to see full documentation.
              </p>
              <div className="flex flex-wrap gap-2.5 mt-4">
                <span className="px-3 py-1.5 text-xs font-semibold bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 rounded-lg border border-blue-200 dark:border-blue-800">
                  50+ Response Schemas
                </span>
                <span className="px-3 py-1.5 text-xs font-semibold bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200 rounded-lg border border-green-200 dark:border-green-800">
                  98 API Endpoints
                </span>
                <span className="px-3 py-1.5 text-xs font-semibold bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-200 rounded-lg border border-purple-200 dark:border-purple-800">
                  Full TypeScript Types
                </span>
                <span className="px-3 py-1.5 text-xs font-semibold bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 rounded-lg border border-amber-200 dark:border-amber-800">
                  OpenAPI 3.0.3
                </span>
                <span className="px-3 py-1.5 text-xs font-semibold bg-pink-100 dark:bg-pink-900/50 text-pink-800 dark:text-pink-200 rounded-lg border border-pink-200 dark:border-pink-800">
                  Copy-Ready cURL Examples
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-6 py-10">
        {isLoading ? (
          <div className="flex items-center justify-center py-32">
            <div className="text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200 border-t-blue-600 mx-auto mb-6"></div>
              <p className="text-slate-600 dark:text-slate-400 font-medium text-lg">Loading API documentation...</p>
            </div>
          </div>
        ) : error ? (
          <div className="max-w-2xl mx-auto">
            <div className="border-2 border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/30 rounded-2xl p-8 shadow-lg">
              <h3 className="text-xl font-bold text-red-900 dark:text-red-100 mb-3">
                Error Loading Documentation
              </h3>
              <p className="text-red-700 dark:text-red-300 mb-6">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl transition-colors shadow-md hover:shadow-lg"
              >
                Retry
              </button>
            </div>
          </div>
        ) : spec ? (
          <div className="max-w-7xl mx-auto">
            {/* API Info */}
            <div className="mb-10 p-8 border-2 border-slate-200 dark:border-slate-700 rounded-2xl bg-white dark:bg-slate-800 shadow-lg">
              <h2 className="text-3xl font-bold mb-3 bg-gradient-to-r from-slate-900 to-slate-600 dark:from-slate-100 dark:to-slate-300 bg-clip-text text-transparent">
                {spec.info?.title}
              </h2>
              <p className="text-slate-600 dark:text-slate-400 mb-6 text-lg leading-relaxed">{spec.info?.description}</p>
              <div className="flex gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 dark:text-slate-400">Version:</span>
                  <span className="font-mono font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-3 py-1 rounded-lg">
                    {spec.info?.version}
                  </span>
                </div>
                {spec.info?.contact?.email && (
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 dark:text-slate-400">Contact:</span>
                    <a 
                      href={`mailto:${spec.info.contact.email}`} 
                      className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                    >
                      {spec.info.contact.email}
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Endpoints by Tag */}
            {spec.tags?.map((tag: any) => {
              const tagPaths = Object.entries(spec.paths || {}).filter(([, methods]: any) =>
                Object.values(methods).some((method: any) => method.tags?.includes(tag.name))
              );

              if (tagPaths.length === 0) return null;

              return (
                <div key={tag.name} className="mb-10">
                  <div className="mb-5 pb-3 border-b-2 border-slate-200 dark:border-slate-700">
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{tag.name}</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{tag.description}</p>
                  </div>
                  <div className="space-y-3">
                    {tagPaths.map(([path, methods]: any) =>
                      Object.entries(methods)
                        .filter(([method]) => ['get', 'post', 'put', 'delete', 'patch'].includes(method))
                        .map(([method, details]: any) => {
                          const key = `${method}-${path}`;
                          const isExpanded = expandedPaths.has(key);

                          return (
                            <div key={key} className="border-2 border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-800 shadow-sm hover:shadow-md transition-all">
                              <button
                                onClick={() => togglePath(key)}
                                className="w-full p-5 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left group"
                              >
                                <span className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide shadow-sm ${getMethodColor(method)}`}>
                                  {method}
                                </span>
                                <code className="font-mono text-sm flex-1 text-slate-900 dark:text-slate-100 font-medium">{path}</code>
                                <span className="text-sm text-slate-600 dark:text-slate-400 hidden md:block">{details.summary}</span>
                                {isExpanded ? (
                                  <ChevronDown className="w-5 h-5 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors" />
                                ) : (
                                  <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors" />
                                )}
                              </button>
                              {isExpanded && (
                                <div className="border-t-2 border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 p-6">
                                  {details.description && (
                                    <p className="mb-6 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{details.description}</p>
                                  )}

                                  {/* cURL Example */}
                                  {details['x-code-samples'] && details['x-code-samples'].length > 0 && (
                                    <div className="mb-6">
                                      <h4 className="font-bold mb-3 text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                        <span className="w-1 h-5 bg-gradient-to-b from-blue-500 to-purple-600 rounded-full"></span>
                                        Example Request
                                      </h4>
                                      <div className="bg-slate-950 dark:bg-black rounded-xl p-5 border-2 border-slate-800 shadow-lg">
                                        <div className="flex items-center justify-between mb-3">
                                          <span className="text-xs text-slate-400 font-mono uppercase tracking-wider">cURL</span>
                                          <button
                                            onClick={() => {
                                              navigator.clipboard.writeText(details['x-code-samples'][0].source);
                                            }}
                                            className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors font-medium shadow-sm"
                                          >
                                            Copy
                                          </button>
                                        </div>
                                        <pre className="text-sm text-slate-100 overflow-x-auto font-mono leading-relaxed">
                                          <code>{details['x-code-samples'][0].source}</code>
                                        </pre>
                                      </div>
                                    </div>
                                  )}
                                  
                                  {details.parameters && details.parameters.length > 0 && (
                                    <div className="mb-6">
                                      <h4 className="font-bold mb-3 text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                        <span className="w-1 h-5 bg-gradient-to-b from-green-500 to-emerald-600 rounded-full"></span>
                                        Parameters
                                      </h4>
                                      <div className="space-y-3 bg-white dark:bg-slate-800 rounded-xl p-5 border-2 border-slate-200 dark:border-slate-700 shadow-sm">
                                        {details.parameters.map((param: any, idx: number) => (
                                          <div key={idx} className="p-4 border-2 border-slate-100 dark:border-slate-700 rounded-lg hover:border-slate-300 dark:hover:border-slate-600 transition-colors bg-slate-50/50 dark:bg-slate-900/30">
                                            <div className="flex items-start justify-between gap-3 mb-2">
                                              <div className="flex items-center gap-2 flex-1">
                                                <code className="font-mono text-sm font-bold text-blue-600 dark:text-blue-400">{param.name}</code>
                                                <span className="px-2 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded text-xs font-medium">
                                                  {param.in}
                                                </span>
                                                {param.schema?.type && (
                                                  <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded text-xs font-mono">
                                                    {param.schema.type}
                                                  </span>
                                                )}
                                              </div>
                                              {param.required && (
                                                <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded text-xs font-bold uppercase tracking-wide">
                                                  Required
                                                </span>
                                              )}
                                            </div>
                                            {param.description && (
                                              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{param.description}</p>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {details.responses && (
                                    <div>
                                      <h4 className="font-bold mb-3 text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                        <span className="w-1 h-5 bg-gradient-to-b from-amber-500 to-orange-600 rounded-full"></span>
                                        Responses
                                      </h4>
                                      <div className="space-y-3">
                                        {Object.entries(details.responses).map(([status, response]: any) => (
                                          <div key={status} className="p-5 bg-white dark:bg-slate-800 rounded-xl border-2 border-slate-200 dark:border-slate-700 shadow-sm">
                                            <div className="flex items-center gap-3 mb-3">
                                              <span className={`px-3 py-1.5 rounded-lg text-sm font-bold shadow-sm ${
                                                status.startsWith('2') 
                                                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' 
                                                  : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                                              }`}>
                                                {status}
                                              </span>
                                              <span className="text-slate-700 dark:text-slate-300 font-medium">{response.description}</span>
                                            </div>
                                            {response.content?.['application/json']?.schema && (
                                              <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border-2 border-slate-100 dark:border-slate-700">
                                                <div className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-3 uppercase tracking-wider">Response Schema:</div>
                                                {response.content['application/json'].schema.$ref ? (
                                                  <div>
                                                    <code className="text-sm font-mono text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 px-2 py-1 rounded">
                                                      {response.content['application/json'].schema.$ref.split('/').pop()}
                                                    </code>
                                                    <div className="mt-3">
                                                      <details className="cursor-pointer group">
                                                        <summary className="font-semibold text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors select-none flex items-center gap-2">
                                                          <ChevronRight className="w-4 h-4 transition-transform group-open:rotate-90" />
                                                          View Full Schema
                                                        </summary>
                                                        <pre className="mt-3 p-4 bg-slate-950 dark:bg-black text-slate-100 rounded-lg overflow-auto max-h-96 text-xs font-mono leading-relaxed border-2 border-slate-800 shadow-inner">
                                                          {JSON.stringify(
                                                            resolveRef(response.content['application/json'].schema),
                                                            null,
                                                            2
                                                          )}
                                                        </pre>
                                                      </details>
                                                    </div>
                                                  </div>
                                                ) : (
                                                  <pre className="text-xs font-mono overflow-auto bg-slate-950 dark:bg-black text-slate-100 p-4 rounded-lg border-2 border-slate-800 leading-relaxed">
                                                    {JSON.stringify(response.content['application/json'].schema, null, 2)}
                                                  </pre>
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
