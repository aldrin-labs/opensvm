'use client';

import { useState } from 'react';
import EnhancedSearchBar from '@/components/EnhancedSearchBar';

export default function TestSearchPage() {
  const [currentDemo, setCurrentDemo] = useState<'empty' | 'search'>('empty');

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12">
      <div className="max-w-4xl mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Intelligent Search Interface Demo
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Hover over the search field to see contextual suggestions with three distinct sections:
            Recent Prompts, Latest Items, and Popular Searches.
          </p>
          
          <div className="flex justify-center gap-4 mb-8">
            <button
              onClick={() => setCurrentDemo('empty')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                currentDemo === 'empty' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-600'
              }`}
            >
              Show Empty State
            </button>
            <button
              onClick={() => setCurrentDemo('search')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                currentDemo === 'search' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-600'
              }`}
            >
              Show Search Mode
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
              {currentDemo === 'empty' ? 'Empty State - Hover to see contextual suggestions' : 'Search Mode - Type to see search results'}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              {currentDemo === 'empty' 
                ? 'The empty state displays three sections: Recent Prompts (user\'s 5 most recent searches), Latest Items (5 most recently accessed content), and Popular Searches (5 most frequently searched terms).'
                : 'Type 3+ characters to see search suggestions based on addresses, transactions, tokens, and programs.'
              }
            </p>
          </div>

          <div className="max-w-2xl mx-auto">
            <EnhancedSearchBar key={currentDemo} />
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center mb-3">
              <span className="text-2xl mr-3">🕐</span>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Recent Prompts</h3>
            </div>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Shows your 5 most recently used search queries with usage counts and timestamps.
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center mb-3">
              <span className="text-2xl mr-3">⚡</span>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Latest Items</h3>
            </div>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Displays 5 most recently accessed or viewed content pieces including transactions, tokens, addresses, and programs.
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center mb-3">
              <span className="text-2xl mr-3">🔥</span>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Popular Searches</h3>
            </div>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Features 5 most frequently searched terms across the platform with trending indicators.
            </p>
          </div>
        </div>

        <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6">
          <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Key Features</h3>
          <ul className="text-blue-800 dark:text-blue-200 text-sm space-y-1">
            <li>• <strong>Contextual Suggestions:</strong> Immediately displays relevant suggestions on focus</li>
            <li>• <strong>Visual Indicators:</strong> Icons and badges for each category type</li>
            <li>• <strong>Click to Search:</strong> Each suggestion is clickable to populate and trigger search</li>
            <li>• <strong>Dynamic Updates:</strong> Suggestions update based on user interaction patterns</li>
            <li>• <strong>Enhanced UX:</strong> Improves search discoverability and user engagement</li>
          </ul>
        </div>
      </div>
    </div>
  );
}