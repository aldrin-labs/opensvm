/**
 * History Entry Item Component
 * Extracted from UserHistoryDisplay for better maintainability
 */

'use client';

import { UserHistoryEntry } from '@/types/user-history';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Activity, 
  Calendar, 
  ExternalLink, 
  Search, 
  Clock,
  MousePointer,
  FileText,
  Coins,
  Server,
  Code,
  BarChart3,
  Globe,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Copy,
  Send
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'react-hot-toast';

const pageTypeIcons = {
  transaction: FileText,
  account: MousePointer,
  block: Calendar,
  program: Code,
  token: Coins,
  validator: Server,
  analytics: BarChart3,
  search: Search,
  'ai-chat': MessageSquare,
  other: Globe
};

const pageTypeColors = {
  transaction: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 data-[theme=dos]:bg-blue-200 data-[theme=dos]:text-blue-800',
  account: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 data-[theme=dos]:bg-green-200 data-[theme=dos]:text-green-800',
  block: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 data-[theme=dos]:bg-purple-200 data-[theme=dos]:text-purple-800',
  program: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300 data-[theme=dos]:bg-orange-200 data-[theme=dos]:text-orange-800',
  token: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300 data-[theme=dos]:bg-yellow-200 data-[theme=dos]:text-yellow-800',
  validator: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 data-[theme=dos]:bg-red-200 data-[theme=dos]:text-red-800',
  analytics: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300 data-[theme=dos]:bg-indigo-200 data-[theme=dos]:text-indigo-800',
  search: 'bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300 data-[theme=dos]:bg-pink-200 data-[theme=dos]:text-pink-800',
  'ai-chat': 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300 data-[theme=dos]:bg-cyan-200 data-[theme=dos]:text-cyan-800',
  other: 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300 data-[theme=dos]:bg-gray-200 data-[theme=dos]:text-gray-800'
};

interface HistoryEntryItemProps {
  entry: UserHistoryEntry;
}

export function HistoryEntryItem({ entry }: HistoryEntryItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const IconComponent = pageTypeIcons[entry.pageType];
  const pageTypeColor = pageTypeColors[entry.pageType];

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const copyToAssistant = () => {
    if (entry.metadata?.aiChatMessage) {
      // Find the AI chat input and populate it
      const input = document.querySelector('[data-ai-chat-input]') as HTMLTextAreaElement;
      if (input) {
        input.value = entry.metadata.aiChatMessage.content;
        input.focus();
        input.dispatchEvent(new Event('input', { bubbles: true }));
        toast.success('Copied to AI assistant');
      } else {
        // Fallback to clipboard
        copyToClipboard(entry.metadata.aiChatMessage.content);
      }
    }
  };

  // Special rendering for AI chat entries
  if (entry.pageType === 'ai-chat' && entry.metadata?.aiChatMessage) {
    const message = entry.metadata.aiChatMessage;
    const isLongMessage = message.content.length > 200;
    const displayContent = isExpanded || !isLongMessage 
      ? message.content 
      : message.content.slice(0, 200) + '...';

    return (
      <div className="group p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3 flex-1">
            <div className={`p-2 rounded-full ${pageTypeColor}`}>
              <IconComponent className="h-4 w-4" />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 mb-1">
                <h3 className="font-medium text-gray-900 dark:text-gray-100">
                  {message.role === 'user' ? 'You' : 'AI Assistant'}
                </h3>
                <Badge variant="secondary" className={pageTypeColor}>
                  {message.tabType || 'chat'}
                </Badge>
              </div>
              
              <div className="mt-2 space-y-2">
                <div className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                  {displayContent}
                </div>
                
                {isLongMessage && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="flex items-center space-x-1"
                  >
                    {isExpanded ? (
                      <>
                        <ChevronUp className="h-3 w-3" />
                        <span>Show less</span>
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-3 w-3" />
                        <span>Show more</span>
                      </>
                    )}
                  </Button>
                )}
              </div>
              
              <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400 mt-2">
                <div className="flex items-center space-x-1">
                  <Clock className="h-3 w-3" />
                  <span>{new Date(entry.timestamp).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => copyToClipboard(message.content)}
              title="Copy message"
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={copyToAssistant}
              title="Copy to AI assistant"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Default rendering for non-AI chat entries
  return (
    <div className="group p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3 flex-1">
          <div className={`p-2 rounded-full ${pageTypeColor}`}>
            <IconComponent className="h-4 w-4" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 mb-1">
              <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate">
                {entry.pageTitle}
              </h3>
              <Badge variant="secondary" className={pageTypeColor}>
                {entry.pageType}
              </Badge>
            </div>
            
            <p className="text-sm text-gray-600 dark:text-gray-400 truncate mb-2">
              {entry.path}
            </p>
            
            <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
              <div className="flex items-center space-x-1">
                <Clock className="h-3 w-3" />
                <span>{new Date(entry.timestamp).toLocaleString()}</span>
              </div>
              
              {entry.metadata?.searchQuery && (
                <div className="flex items-center space-x-1">
                  <Search className="h-3 w-3" />
                  <span className="truncate max-w-[100px]">
                    "{entry.metadata.searchQuery}"
                  </span>
                </div>
              )}
              
              {entry.metadata?.transactionId && (
                <div className="flex items-center space-x-1">
                  <Activity className="h-3 w-3" />
                  <span className="font-mono text-xs">
                    {entry.metadata.transactionId.slice(0, 8)}...
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
        
        <Link href={entry.path} target="_blank" rel="noopener noreferrer">
          <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
            <ExternalLink className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
