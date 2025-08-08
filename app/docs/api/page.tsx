'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { useSettings } from '@/lib/settings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Book, Code, Play, Download, Copy, ExternalLink, ChevronDown,
  ChevronRight, Zap, Database, Network, Search, Activity,
  FileText, Globe, Shield, Clock, CheckCircle, AlertTriangle
} from 'lucide-react';
import { OpenAPISpec } from '@/lib/api/openapi-generator';
import logger from '@/lib/logging/logger';

interface APIEndpoint {
  path: string;
  method: string;
  summary: string;
  description?: string;
  tags: string[];
  parameters?: any[];
  requestBody?: any;
  responses: Record<string, any>;
  operationId: string;
}

interface APIExample {
  request: {
    method: string;
    url: string;
    headers?: Record<string, string>;
    body?: any;
  };
  response: {
    status: number;
    headers?: Record<string, string>;
    body: any;
  };
}

function EndpointCard({ 
  endpoint, 
  onTryOut 
}: { 
  endpoint: APIEndpoint;
  onTryOut: (endpoint: APIEndpoint) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getMethodColor = (method: string) => {
    switch (method.toUpperCase()) {
      case 'GET': return 'bg-green-100 text-green-800 border-green-200';
      case 'POST': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'PUT': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'DELETE': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getTagIcon = (tag: string) => {
    switch (tag) {
      case 'Transactions': return <Database className="h-3 w-3" />;
      case 'Accounts': return <Shield className="h-3 w-3" />;
      case 'Search': return <Search className="h-3 w-3" />;
      case 'AI': return <Zap className="h-3 w-3" />;
      case 'Monitoring': return <Activity className="h-3 w-3" />;
      default: return <Globe className="h-3 w-3" />;
    }
  };

  return (
    <Card className="border-l-4 border-l-blue-500"
          {...({ settings } as any)}
        >
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger className="w-full">
          <CardHeader className="hover:bg-gray-50">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center space-x-3">
                <Badge className={`font-mono ${getMethodColor(endpoint.method)}`}>
                  {endpoint.method}
                </Badge>
                <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                  {endpoint.path}
                </code>
                <ChevronRight 
                  className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} 
                />
              </div>
              <div className="flex items-center space-x-2">
                {endpoint.tags.map(tag => (
                  <Badge key={tag} variant="outline" className="text-xs flex items-center space-x-1">
                    {getTagIcon(tag)}
                    <span>{tag}</span>
                  </Badge>
                ))}
              </div>
            </div>
            <div className="text-left">
              <CardTitle className="text-base font-medium">{endpoint.summary}</CardTitle>
              {endpoint.description && (
                <p className="text-sm text-gray-600 mt-1">{endpoint.description}</p>
              )}
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0">
            <div className="space-y-4">
              {/* Parameters */}
              {endpoint.parameters && endpoint.parameters.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Parameters</h4>
                  <div className="space-y-2">
                    {endpoint.parameters.map((param: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <div className="flex items-center space-x-2">
                          <code className="text-sm">{param.name}</code>
                          <Badge variant="outline" className="text-xs">
                            {param.in}
                          </Badge>
                          {param.required && (
                            <Badge variant="destructive" className="text-xs">Required</Badge>
                          )}
                        </div>
                        <div className="text-sm text-gray-600">
                          {param.description}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Request Body */}
              {endpoint.requestBody && (
                <div>
                  <h4 className="font-medium mb-2">Request Body</h4>
                  <div className="bg-gray-900 text-gray-100 p-3 rounded text-sm overflow-x-auto">
                    <pre>{JSON.stringify(endpoint.requestBody, null, 2)}</pre>
                  </div>
                </div>
              )}

              {/* Responses */}
              <div>
                <h4 className="font-medium mb-2">Responses</h4>
                <div className="space-y-2">
                  {Object.entries(endpoint.responses).map(([status, response]: [string, any]) => (
                    <div key={status} className="border rounded p-3">
                      <div className="flex items-center space-x-2 mb-2">
                        <Badge 
                          variant={status.startsWith('2') ? 'default' : 'destructive'}
                          className="font-mono"
                        >
                          {status}
                        </Badge>
                        <span className="text-sm">{response.description}</span>
                      </div>
                      {response.content && (
                        <div className="bg-gray-900 text-gray-100 p-2 rounded text-xs overflow-x-auto">
                          <pre>{JSON.stringify(response.content, null, 2)}</pre>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Try It Out Button */}
              <div className="flex space-x-2 pt-4 border-t">
                <Button 
                  onClick={() => onTryOut(endpoint)}
                  className="flex items-center space-x-2"
                >
                  <Play className="h-4 w-4" />
                  <span>Try It Out</span>
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => {
                    const curlCommand = generateCurlCommand(endpoint);
                    navigator.clipboard.writeText(curlCommand);
                  }}
                  className="flex items-center space-x-2"
                >
                  <Copy className="h-4 w-4" />
                  <span>Copy cURL</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function APITryOut({ 
  endpoint, 
  onClose 
}: { 
  endpoint: APIEndpoint;
  onClose: () => void;
}) {
  const [parameters, setParameters] = useState<Record<string, any>>({});
  const [requestBody, setRequestBody] = useState('');
  const [response, setResponse] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const executeRequest = async () => {
    setLoading(true);
    const startTime = performance.now();

    try {
      logger.info('Executing API request from documentation', {
        component: 'APIDocumentation',
        metadata: { 
          endpoint: endpoint.path,
          method: endpoint.method,
          parameters
        }
      });

      // Build URL with parameters
      let url = endpoint.path;
      const queryParams = new URLSearchParams();

      // Replace path parameters and build query parameters
      if (endpoint.parameters) {
        for (const param of endpoint.parameters) {
          const value = parameters[param.name];
          if (value) {
            if (param.in === 'path') {
              url = url.replace(`{${param.name}}`, encodeURIComponent(value));
            } else if (param.in === 'query') {
              queryParams.append(param.name, value);
            }
          }
        }
      }

      if (queryParams.toString()) {
        url += '?' + queryParams.toString();
      }

      // Prepare request options
      const options: RequestInit = {
        method: endpoint.method,
        headers: {
          'Content-Type': 'application/json',
        },
      };

      if (endpoint.method !== 'GET' && requestBody) {
        try {
          options.body = JSON.stringify(JSON.parse(requestBody));
        } catch (error) {
          throw new Error('Invalid JSON in request body');
        }
      }

      // Make the request
      const apiResponse = await fetch(`/api${url}`, options);
      const responseData = await apiResponse.json();

      const endTime = performance.now();
      const duration = endTime - startTime;

      setResponse({
        status: apiResponse.status,
        statusText: apiResponse.statusText,
        headers: Object.fromEntries(apiResponse.headers.entries()),
        data: responseData,
        duration
      });

      logger.info('API request completed from documentation', {
        component: 'APIDocumentation',
        metadata: { 
          endpoint: endpoint.path,
          method: endpoint.method,
          status: apiResponse.status,
          duration
        }
      });

    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;

      const errorResponse = {
        status: 0,
        statusText: 'Request Failed',
        headers: {},
        data: {
          error: error instanceof Error ? error.message : 'Unknown error',
          code: 'REQUEST_FAILED'
        },
        duration
      };

      setResponse(errorResponse);

      logger.error('API request failed from documentation', {
        component: 'APIDocumentation',
        metadata: { 
          endpoint: endpoint.path,
          method: endpoint.method,
          error: error instanceof Error ? error.message : 'Unknown error',
          duration
        }
      });

    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Play className="h-5 w-5" />
              <span>Try {endpoint.method} {endpoint.path}</span>
            </CardTitle>
            <Button variant="outline" onClick={onClose}>
              ×
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          <ScrollArea className="h-[70vh]">
            <div className="space-y-6">
              {/* Parameters Input */}
              {endpoint.parameters && endpoint.parameters.length > 0 && (
                <div>
                  <h3 className="font-medium mb-3">Parameters</h3>
                  <div className="space-y-3">
                    {endpoint.parameters.map((param: any, index: number) => (
                      <div key={index} className="grid grid-cols-3 gap-3 items-center">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">{param.name}</span>
                          <Badge variant="outline" className="text-xs">{param.in}</Badge>
                          {param.required && (
                            <Badge variant="destructive" className="text-xs">Required</Badge>
                          )}
                        </div>
                        <Input
                          placeholder={param.description || `Enter ${param.name}`}
                          value={parameters[param.name] || ''}
                          onChange={(e) => setParameters(prev => ({
                            ...prev,
                            [param.name]: e.target.value
                          }))}
                        />
                        <span className="text-sm text-gray-600">{param.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Request Body Input */}
              {endpoint.method !== 'GET' && (
                <div>
                  <h3 className="font-medium mb-3">Request Body</h3>
                  <Textarea
                    placeholder="Enter JSON request body..."
                    value={requestBody}
                    onChange={(e) => setRequestBody(e.target.value)}
                    className="font-mono text-sm"
                    rows={8}
                  />
                </div>
              )}

              {/* Execute Button */}
              <Button 
                onClick={executeRequest}
                disabled={loading}
                className="w-full"
              >
                {loading ? 'Executing...' : 'Execute Request'}
              </Button>

              {/* Response */}
              {response && (
                <div>
                  <h3 className="font-medium mb-3">Response</h3>
                  <div className="space-y-3">
                    {/* Response Status */}
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                      <div className="flex items-center space-x-3">
                        <Badge 
                          variant={response.status >= 200 && response.status < 300 ? 'default' : 'destructive'}
                          className="font-mono"
                        >
                          {response.status}
                        </Badge>
                        <span className="font-medium">{response.statusText}</span>
                        {response.status >= 200 && response.status < 300 ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-red-600" />
                        )}
                      </div>
                      <div className="flex items-center space-x-2 text-sm text-gray-600">
                        <Clock className="h-4 w-4" />
                        <span>{response.duration.toFixed(0)}ms</span>
                      </div>
                    </div>

                    {/* Response Body */}
                    <div>
                      <h4 className="font-medium mb-2">Response Body</h4>
                      <div className="bg-gray-900 text-gray-100 p-3 rounded overflow-auto">
                        <pre className="text-sm">
                          {JSON.stringify(response.data, null, 2)}
                        </pre>
                      </div>
                    </div>

                    {/* Response Headers */}
                    {Object.keys(response.headers).length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2">Response Headers</h4>
                        <div className="bg-gray-50 p-3 rounded">
                          {Object.entries(response.headers).map(([key, value]) => (
                            <div key={key} className="flex justify-between text-sm">
                              <span className="font-medium">{key}:</span>
                              <span className="font-mono">{String(value)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

function generateCurlCommand(endpoint: APIEndpoint): string {
  let curl = `curl -X ${endpoint.method} 'http://localhost:3000/api${endpoint.path}'`;
  
  if (endpoint.method !== 'GET') {
    curl += ` \\\n  -H 'Content-Type: application/json'`;
    curl += ` \\\n  -d '{"example": "data"}'`;
  }
  
  return curl;
}

export default function APIDocumentationPage() {
  const settings = useSettings();
  const [spec, setSpec] = useState<OpenAPISpec | null>(null);
  const [endpoints, setEndpoints] = useState<APIEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [tryingEndpoint, setTryingEndpoint] = useState<APIEndpoint | null>(null);

  useEffect(() => {
    const fetchSpec = async () => {
      try {
        logger.info('Loading API documentation', {
          component: 'APIDocumentation'
        });

        const response = await fetch('/api/docs/openapi');
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const specData = await response.json();
        setSpec(specData);

        // Convert spec to endpoint list
        const endpointList: APIEndpoint[] = [];
        for (const [path, methods] of Object.entries(specData.paths)) {
          for (const [method, details] of Object.entries(methods as any)) {
            endpointList.push({
              path,
              method: method.toUpperCase(),
              ...(details as any)
            });
          }
        }

        setEndpoints(endpointList);

        logger.info('API documentation loaded', {
          component: 'APIDocumentation',
          metadata: {
            endpointCount: endpointList.length,
            tagCount: specData.tags?.length || 0
          }
        });

      } catch (error) {
        logger.error('Failed to load API documentation', {
          component: 'APIDocumentation',
          metadata: {
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        });
      } finally {
        setLoading(false);
      }
    };

    fetchSpec();
  }, []);

  const filteredEndpoints = endpoints.filter(endpoint => {
    const matchesTag = selectedTag === 'all' || endpoint.tags.includes(selectedTag);
    const matchesSearch = searchQuery === '' || 
      endpoint.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
      endpoint.summary.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesTag && matchesSearch;
  });

  const uniqueTags = [...new Set(endpoints.flatMap(e => e.tags))].sort();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Activity className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading API documentation...</p>
        </div>
      </div>
    );
  }

  if (!spec) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Alert className="max-w-md">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Failed to load API documentation. Please try again later.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <Book className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-3xl font-bold">{spec.info.title} Documentation</h1>
                <p className="text-gray-600">{spec.info.description}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant="outline">v{spec.info.version}</Badge>
              <Button variant="outline" asChild>
                <a href="/api/docs/openapi?download=true" target="_blank">
                  <Download className="h-4 w-4 mr-2" />
                  Download OpenAPI Spec
                </a>
              </Button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center space-x-4 mb-6">
            <div className="flex-1">
              <Input
                placeholder="Search endpoints..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="max-w-md"
              />
            </div>
            <select
              value={selectedTag}
              onChange={(e) => setSelectedTag(e.target.value)}
              className="px-3 py-2 border rounded-md"
            >
              <option value="all">All Tags</option>
              {uniqueTags.map(tag => (
                <option key={tag} value={tag}>{tag}</option>
              ))}
            </select>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-blue-600">{endpoints.length}</div>
                <div className="text-sm text-gray-600">Total Endpoints</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-green-600">{uniqueTags.length}</div>
                <div className="text-sm text-gray-600">API Categories</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {Object.keys(spec.components.schemas).length}
                </div>
                <div className="text-sm text-gray-600">Data Schemas</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-orange-600">{spec.servers.length}</div>
                <div className="text-sm text-gray-600">Servers</div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Endpoints */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">
              API Endpoints ({filteredEndpoints.length})
            </h2>
            {filteredEndpoints.length === 0 && (
              <p className="text-gray-500">No endpoints match your filters</p>
            )}
          </div>

          {filteredEndpoints.map((endpoint, index) => (
            <EndpointCard
              key={`${endpoint.method}-${endpoint.path}-${index}`}
              endpoint={endpoint}
              onTryOut={setTryingEndpoint}
            />
          ))}
        </div>
      </div>

      {/* Try Out Modal */}
      {tryingEndpoint && (
        <APITryOut
          endpoint={tryingEndpoint}
          onClose={() => setTryingEndpoint(null)}
        />
      )}
    </div>
  );
}