'use client';

import React, { useState } from 'react';
import { getAllCategories, getMethodsByCategory } from '@/lib/api-presets';
import { Play, Copy, ChevronDown, ChevronUp, FileJson } from 'lucide-react';
import { ApiSchemaViewer } from '@/components/ApiSchemaViewer';
import { getSchemaForEndpoint } from '@/lib/api-response-schemas';

export const ApiTester: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>('Blockchain Core');
  const [expandedMethods, setExpandedMethods] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, any>>({});
  const [copiedPreset, setCopiedPreset] = useState<string | null>(null);

  const categories = getAllCategories();
  const categoryMethods = getMethodsByCategory(selectedCategory);

  const toggleMethod = (methodId: string) => {
    const newExpanded = new Set(expandedMethods);
    if (newExpanded.has(methodId)) {
      newExpanded.delete(methodId);
    } else {
      newExpanded.add(methodId);
    }
    setExpandedMethods(newExpanded);
  };

  const executePreset = async (methodId: string, presetPath: string, method: string, body?: any) => {
    const resultKey = `${methodId}-${presetPath}`;
    setLoading(resultKey);

    try {
      const options: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
      };

      if (body) {
        options.body = JSON.stringify(body);
      }

      const startTime = Date.now();
      const response = await fetch(presetPath, options);
      const duration = Date.now() - startTime;
      const data = await response.json();

      setResults(prev => ({
        ...prev,
        [resultKey]: {
          status: response.status,
          statusText: response.statusText,
          duration,
          headers: {
            'Content-Type': response.headers.get('content-type') || 'application/json',
            'X-RateLimit-Limit': response.headers.get('X-RateLimit-Limit'),
            'X-RateLimit-Remaining': response.headers.get('X-RateLimit-Remaining'),
          },
          data,
          endpoint: presetPath,
          method,
        }
      }));
    } catch (error: any) {
      setResults(prev => ({
        ...prev,
        [resultKey]: {
          error: error.message,
          status: 'error',
          endpoint: presetPath,
          method,
        }
      }));
    } finally {
      setLoading(null);
    }
  };

  const copyToClipboard = (text: string, presetId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPreset(presetId);
    setTimeout(() => setCopiedPreset(null), 2000);
  };

  const renderResult = (resultKey: string, result: any) => {
    return (
      <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
          <div>
            <p className="text-xs text-gray-600 dark:text-gray-400">Status</p>
            <p className={`font-semibold ${result.status >= 200 && result.status < 300 ? 'text-green-600' : 'text-red-600'}`}>
              {result.status} {result.statusText}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-600 dark:text-gray-400">Duration</p>
            <p className="font-semibold">{result.duration}ms</p>
          </div>
          <div>
            <p className="text-xs text-gray-600 dark:text-gray-400">Method</p>
            <p className="font-semibold text-blue-600">{result.method}</p>
          </div>
          <div>
            <p className="text-xs text-gray-600 dark:text-gray-400">Endpoint</p>
            <p className="font-semibold text-xs truncate">{result.endpoint.split('?')[0]}</p>
          </div>
        </div>

        {result.error ? (
          <div className="p-3 bg-red-100 dark:bg-red-900 border border-red-300 dark:border-red-700 rounded text-red-800 dark:text-red-200">
            <p className="font-semibold">Error:</p>
            <p className="text-sm mt-1">{result.error}</p>
          </div>
        ) : (
          <div>
            <div className="mb-3">
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Response Headers</p>
              <pre className="bg-gray-800 text-gray-100 p-2 rounded text-xs overflow-x-auto max-h-24">
                {JSON.stringify(result.headers, null, 2)}
              </pre>
            </div>
            <div>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Response Body</p>
              <pre className="bg-gray-800 text-gray-100 p-2 rounded text-xs overflow-x-auto max-h-48">
                {typeof result.data === 'string' ? result.data : JSON.stringify(result.data, null, 2)}
              </pre>
            </div>
          </div>
        )}

        <button
          onClick={() => copyToClipboard(JSON.stringify(result, null, 2), resultKey)}
          className="mt-2 px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded flex items-center gap-1"
        >
          <Copy className="w-4 h-4" />
          {copiedPreset === resultKey ? 'Copied!' : 'Copy'}
        </button>
      </div>
    );
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-4">
      {/* Category Selector */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-3">API Categories</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {categories.map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 rounded-lg transition-all ${
                selectedCategory === category
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* Methods */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold mb-4">
          Methods in {selectedCategory}
        </h2>

        {categoryMethods.map(method => {
          const isExpanded = expandedMethods.has(method.id);

          return (
            <div key={method.id} className="border rounded-lg overflow-hidden bg-white dark:bg-gray-800">
              {/* Method Header */}
              <button
                onClick={() => toggleMethod(method.id)}
                className="w-full p-4 flex items-start justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="text-left flex-1">
                  <h3 className="font-semibold text-lg">{method.name}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{method.description}</p>
                  <div className="flex gap-2 mt-2">
                    <span className={`px-2 py-1 text-xs rounded font-mono font-bold ${
                      method.method === 'GET' ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200' :
                      method.method === 'POST' ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' :
                      'bg-gray-100 dark:bg-gray-700'
                    }`}>
                      {method.method}
                    </span>
                    <span className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-600 rounded font-mono text-gray-700 dark:text-gray-300">
                      {method.endpoint}
                    </span>
                  </div>
                </div>
                <div className="ml-4 flex-shrink-0">
                  {isExpanded ? <ChevronUp /> : <ChevronDown />}
                </div>
              </button>

              {/* Method Details */}
              {isExpanded && (
                <div className="border-t p-4 bg-gray-50 dark:bg-gray-900">
                  {/* Response Schema Section */}
                  <div className="mb-6">
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <FileJson className="w-5 h-5 text-blue-600" />
                      Response Schema
                    </h4>
                    {(() => {
                      const schema = getSchemaForEndpoint(method.endpoint);
                      if (schema && schema.success) {
                        return (
                          <div className="space-y-4">
                            <ApiSchemaViewer schema={schema.success} title="✓ Success Response (200)" />
                            {schema.error && (
                              <ApiSchemaViewer schema={schema.error} title="✗ Error Response (4xx/5xx)" />
                            )}
                          </div>
                        );
                      }
                      return (
                        <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700">
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Schema documentation not yet available for this endpoint.
                          </p>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="mb-4">
                    <h4 className="font-semibold mb-3">Test Presets ({method.presets.length})</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {method.presets.map((preset, idx) => {
                        const presetKey = `${method.id}-${idx}`;
                        const isLoading = loading === presetKey;
                        const presetResult = results[presetKey];

                        return (
                          <div key={idx} className="border rounded p-3 bg-white dark:bg-gray-800">
                            <div className="mb-2">
                              <p className="font-semibold text-sm">{preset.name}</p>
                              <p className="text-xs text-gray-600 dark:text-gray-400">{preset.description}</p>
                            </div>

                            <div className="flex gap-2 mb-3">
                              <button
                                onClick={() => executePreset(method.id, preset.path, preset.method, preset.body)}
                                disabled={isLoading}
                                className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded text-sm transition-colors"
                              >
                                <Play className="w-4 h-4" />
                                {isLoading ? 'Testing...' : 'Test'}
                              </button>
                              <button
                                onClick={() => copyToClipboard(preset.path, presetKey)}
                                className="px-3 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded text-sm transition-colors"
                              >
                                <Copy className="w-4 h-4" />
                              </button>
                            </div>

                            {presetResult && renderResult(presetKey, presetResult)}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {categoryMethods.length === 0 && (
        <div className="text-center p-8 text-gray-500 dark:text-gray-400">
          <p>No methods found in this category</p>
        </div>
      )}
    </div>
  );
};

export default ApiTester;
