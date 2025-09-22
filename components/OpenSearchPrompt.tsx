'use client';

import React, { useState, useEffect } from 'react';
import { X, Search, Plus } from 'lucide-react';

interface OpenSearchPromptProps {
  onClose?: () => void;
}

const OpenSearchPrompt: React.FC<OpenSearchPromptProps> = ({ onClose }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Check if user has already dismissed this prompt
    const dismissed = localStorage.getItem('opensearch-prompt-dismissed');
    if (dismissed === 'true') {
      setIsDismissed(true);
      return;
    }

    // Check if user chose "remind me later" and if 24 hours have passed
    const remindLater = localStorage.getItem('opensearch-remind-later');
    if (remindLater) {
      const remindTime = new Date(remindLater);
      if (new Date() < remindTime) {
        setIsDismissed(true);
        return;
      } else {
        // 24 hours have passed, remove the remind later flag
        localStorage.removeItem('opensearch-remind-later');
      }
    }

    // Check if OpenSearch is supported by the browser (more permissive check)
    const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
    const isSupported = isChrome || 'external' in window.navigator || 'addSearchProvider' in window.external;
    
    // Show prompt after a delay if supported and not dismissed
    if (isSupported) {
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 2000); // Show after 2 seconds (reduced from 3)

      return () => clearTimeout(timer);
    }
  }, []);

  const handleAddSearchEngine = () => {
    try {
      // For Chrome and modern browsers
      if ('external' in window.navigator && 'AddSearchProvider' in (window.external as any)) {
        (window.external as any).AddSearchProvider('/opensearch.xml');
      } else {
        // Fallback: Open Chrome settings page
        window.open('chrome://settings/searchEngines', '_blank');
      }
    } catch (error) {
      console.error('Error adding search provider:', error);
      // Fallback: show instructions
      alert('To add OpenSVM as a search engine:\n1. Go to Chrome Settings\n2. Navigate to Search Engine\n3. Click "Add" next to "Site search"\n4. OpenSVM should appear in the list');
    }
    handleDismiss();
  };

  const handleDismiss = () => {
    setIsVisible(false);
    setIsDismissed(true);
    localStorage.setItem('opensearch-prompt-dismissed', 'true');
    onClose?.();
  };

  const handleRemindLater = () => {
    setIsVisible(false);
    // Set a temporary dismissal for 24 hours
    const tomorrow = new Date();
    tomorrow.setHours(tomorrow.getHours() + 24);
    localStorage.setItem('opensearch-remind-later', tomorrow.toISOString());
  };

  if (isDismissed || !isVisible) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60000] flex items-center justify-center p-4"
      onClick={handleRemindLater}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md w-full border border-gray-200 dark:border-gray-700 animate-in fade-in-0 zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/30">
              <Search className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Add OpenSVM Search
            </h3>
          </div>
          <button
            onClick={handleDismiss}
            className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            Add OpenSVM as a search engine in Chrome to quickly search Solana accounts, transactions, and tokens directly from your address bar.
          </p>
          
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-4">
            <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
              What you'll get:
            </h4>
            <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
              <li>• Quick blockchain searches from Chrome's address bar</li>
              <li>• Smart suggestions for addresses and tokens</li>
              <li>• AI-powered search results</li>
              <li>• Instant access to Solana data</li>
            </ul>
          </div>

          <div className="text-xs text-gray-500 dark:text-gray-400 mb-6">
            <strong>How to use:</strong> Type "osvm.ai" in Chrome's address bar, press Tab, then type your search query.
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleAddSearchEngine}
            className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <Plus className="h-4 w-4" />
            Add Search Engine
          </button>
          <div className="flex gap-2">
            <button
              onClick={handleRemindLater}
              className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            >
              Later
            </button>
            <button
              onClick={handleDismiss}
              className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            >
              Don't Ask Again
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OpenSearchPrompt;
