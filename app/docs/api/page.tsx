'use client';

import React from 'react';
import { Zap, Heart } from 'lucide-react';
import ApiTester from '@/components/ApiTester';

export default function ApiTestPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="border-b backdrop-blur-sm bg-white/50 dark:bg-gray-800/50">
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-4xl mx-auto text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Zap className="w-8 h-8 text-blue-600" />
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                API Interactive Tester
              </h1>
            </div>
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-4">
              Test all OpenSVM API methods with pre-configured examples
            </p>
            <div className="flex flex-wrap gap-2 justify-center text-sm">
              <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full">
                200+ Endpoints
              </span>
              <span className="px-3 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full">
                5 Presets Each
              </span>
              <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded-full">
                Live Testing
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold mb-2">1. Select Category</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Choose an API category to view available methods
              </p>
            </div>
            <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold mb-2">2. Expand Method</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Click on any method to reveal pre-configured preset examples
              </p>
            </div>
            <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold mb-2">3. Click Test</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Hit the Test button to execute the API call and view results
              </p>
            </div>
          </div>

          {/* Features */}
          <div className="mb-8 p-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <h2 className="text-lg font-semibold mb-3">Features</h2>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              <li className="flex gap-2">
                <span className="text-blue-600 font-bold">✓</span>
                <span>Live API testing without external tools</span>
              </li>
              <li className="flex gap-2">
                <span className="text-blue-600 font-bold">✓</span>
                <span>Pre-configured examples for each method</span>
              </li>
              <li className="flex gap-2">
                <span className="text-blue-600 font-bold">✓</span>
                <span>Response headers and body display</span>
              </li>
              <li className="flex gap-2">
                <span className="text-blue-600 font-bold">✓</span>
                <span>Request/response timing metrics</span>
              </li>
              <li className="flex gap-2">
                <span className="text-blue-600 font-bold">✓</span>
                <span>Copy endpoint paths to clipboard</span>
              </li>
              <li className="flex gap-2">
                <span className="text-blue-600 font-bold">✓</span>
                <span>Rate limit information in responses</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* API Tester Component */}
      <div className="container mx-auto px-4 pb-12">
        <div className="max-w-6xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
          <ApiTester />
        </div>
      </div>

      {/* Footer Tips */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="p-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <div className="flex gap-3">
              <Heart className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold mb-2">Tips</h3>
                <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                  <li>• Use the Copy button to get endpoint paths for use in your application</li>
                  <li>• Check rate limit headers in responses to understand your quota</li>
                  <li>• Some endpoints require authentication - check the full API documentation</li>
                  <li>• Preset examples use real Solana addresses and data</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Documentation Link */}
      <div className="container mx-auto px-4 py-8 border-t">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Need more details? Check out the comprehensive API documentation
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <a
              href="/docs/api-reference"
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Full API Reference
            </a>
            <a
              href="/docs/quick-reference-guide"
              className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Quick Start Guide
            </a>
            <a
              href="/llms.txt"
              className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              LLM Reference
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
