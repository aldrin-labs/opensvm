'use client';

import React, { useState, useMemo } from 'react';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  CopyIcon,
  CheckIcon,
  AlertTriangleIcon,
  InfoIcon,
  ShieldCheckIcon,
  CodeIcon,
  DatabaseIcon,
  FileTextIcon,
  HexagonIcon
} from 'lucide-react';

interface AccountDataDiffProps {
  dataChange: {
    hasChanged: boolean;
    preData?: string;
    postData?: string;
    dataSize: number;
    sizeChange?: number;
    significance: 'low' | 'medium' | 'high';
    dataType?: string;
  };
  accountAddress: string;
  className?: string;
}

const AccountDataDiff: React.FC<AccountDataDiffProps> = ({
  dataChange,
  accountAddress: _accountAddress,
  className = ''
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [viewMode, setViewMode] = useState<'diff' | 'raw' | 'parsed'>('diff');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = async (text: string, field: string) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      }
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Parse and analyze the data differences
  const dataDiff = useMemo(() => {
    if (!dataChange.hasChanged || !dataChange.preData || !dataChange.postData) {
      return null;
    }

    const preLines = dataChange.preData.split(':');
    const postLines = dataChange.postData.split(':');
    const maxLines = Math.max(preLines.length, postLines.length);

    const differences = [];
    for (let i = 0; i < maxLines; i++) {
      const preLine = preLines[i] || '';
      const postLine = postLines[i] || '';

      if (preLine !== postLine) {
        differences.push({
          index: i,
          before: preLine,
          after: postLine,
          type: preLine === '' ? 'added' : postLine === '' ? 'removed' : 'modified'
        });
      }
    }

    return differences;
  }, [dataChange]);

  const getDataTypeIcon = (dataType?: string) => {
    switch (dataType) {
      case 'program':
        return <CodeIcon className="w-4 h-4 text-blue-500" />;
      case 'token_account':
      case 'associated_token_account':
        return <HexagonIcon className="w-4 h-4 text-green-500" />;
      case 'token_mint':
        return <DatabaseIcon className="w-4 h-4 text-purple-500" />;
      case 'metadata_account':
        return <FileTextIcon className="w-4 h-4 text-orange-500" />;
      default:
        return <DatabaseIcon className="w-4 h-4 text-gray-500" />;
    }
  };

  const getSignificanceIcon = (significance: 'low' | 'medium' | 'high') => {
    switch (significance) {
      case 'low':
        return <ShieldCheckIcon className="w-4 h-4 text-green-500" />;
      case 'medium':
        return <InfoIcon className="w-4 h-4 text-yellow-500" />;
      case 'high':
        return <AlertTriangleIcon className="w-4 h-4 text-red-500" />;
      default:
        return <InfoIcon className="w-4 h-4 text-gray-500" />;
    }
  };

  const getSignificanceColor = (significance: 'low' | 'medium' | 'high') => {
    switch (significance) {
      case 'low':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'high':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const formatDataSize = (size: number) => {
    if (size < 1024) return `${size} bytes`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatHexData = (data: string) => {
    // Convert string to hex representation for display
    return data.split('').map(char => char.charCodeAt(0).toString(16).padStart(2, '0')).join(' ');
  };

  if (!dataChange.hasChanged) {
    return (
      <div className={`bg-muted/10 p-3 rounded-lg ${className}`}>
        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
          <ShieldCheckIcon className="w-4 h-4" />
          <span>No account data changes detected</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-muted/10 p-4 rounded-lg ${className}`}>
      {/* Header */}
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            {isExpanded ? (
              <ChevronDownIcon className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRightIcon className="w-4 h-4 text-muted-foreground" />
            )}
            <span className="font-medium text-foreground">Account Data Changes</span>
          </div>

          <div className="flex items-center space-x-2">
            {getDataTypeIcon(dataChange.dataType)}
            <span className="text-sm text-muted-foreground capitalize">
              {dataChange.dataType?.replace('_', ' ') || 'Generic'}
            </span>

            <span className={`px-2 py-1 rounded text-xs font-medium ${getSignificanceColor(dataChange.significance)}`}>
              {dataChange.significance}
            </span>

            {getSignificanceIcon(dataChange.significance)}
          </div>
        </div>

        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
          <span>{formatDataSize(dataChange.dataSize)}</span>
          {dataChange.sizeChange && dataChange.sizeChange !== 0 && (
            <span className={dataChange.sizeChange > 0 ? 'text-green-600' : 'text-red-600'}>
              ({dataChange.sizeChange > 0 ? '+' : ''}{dataChange.sizeChange} bytes)
            </span>
          )}
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="mt-4 space-y-4">
          {/* View Mode Selector */}
          <div className="flex items-center space-x-2">
            <span className="text-sm text-muted-foreground">View:</span>
            <div className="flex rounded-md overflow-hidden border border-border">
              {(['diff', 'raw', 'parsed'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-3 py-1 text-xs font-medium transition-colors ${viewMode === mode
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-background text-muted-foreground hover:text-foreground'
                    }`}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Diff View */}
          {viewMode === 'diff' && dataDiff && dataDiff.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-foreground">Data Differences</h4>
              <div className="bg-background border border-border rounded-md overflow-hidden">
                {dataDiff.map((diff, index) => (
                  <div key={index} className="border-b border-border last:border-b-0">
                    <div className="p-3">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="text-xs font-medium text-muted-foreground">
                          Field {diff.index + 1}
                        </span>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${diff.type === 'added' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                            diff.type === 'removed' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                              'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                          }`}>
                          {diff.type}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Before:</span>
                          <div className="font-mono bg-red-50 dark:bg-red-900/20 p-2 rounded mt-1">
                            {diff.before || <span className="text-muted-foreground italic">empty</span>}
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">After:</span>
                          <div className="font-mono bg-green-50 dark:bg-green-900/20 p-2 rounded mt-1">
                            {diff.after || <span className="text-muted-foreground italic">empty</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Raw View */}
          {viewMode === 'raw' && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-foreground">Before (Raw Data)</h4>
                  <button
                    onClick={() => copyToClipboard(dataChange.preData || '', 'preData')}
                    className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                    title="Copy raw data"
                  >
                    {copiedField === 'preData' ? (
                      <CheckIcon className="w-3 h-3 text-green-500" />
                    ) : (
                      <CopyIcon className="w-3 h-3" />
                    )}
                  </button>
                </div>
                <div className="bg-background border border-border rounded-md p-3 font-mono text-sm overflow-x-auto">
                  {dataChange.preData || <span className="text-muted-foreground italic">No data</span>}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-foreground">After (Raw Data)</h4>
                  <button
                    onClick={() => copyToClipboard(dataChange.postData || '', 'postData')}
                    className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                    title="Copy raw data"
                  >
                    {copiedField === 'postData' ? (
                      <CheckIcon className="w-3 h-3 text-green-500" />
                    ) : (
                      <CopyIcon className="w-3 h-3" />
                    )}
                  </button>
                </div>
                <div className="bg-background border border-border rounded-md p-3 font-mono text-sm overflow-x-auto">
                  {dataChange.postData || <span className="text-muted-foreground italic">No data</span>}
                </div>
              </div>
            </div>
          )}

          {/* Parsed View */}
          {viewMode === 'parsed' && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-foreground mb-2">Parsed Data Structure</h4>
                <div className="bg-background border border-border rounded-md p-3">
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center space-x-2">
                      <span className="text-muted-foreground">Account Type:</span>
                      <span className="font-medium text-foreground capitalize">
                        {dataChange.dataType?.replace('_', ' ') || 'Generic'}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className="text-muted-foreground">Data Size:</span>
                      <span className="font-medium text-foreground">
                        {formatDataSize(dataChange.dataSize)}
                      </span>
                    </div>

                    {dataChange.sizeChange && dataChange.sizeChange !== 0 && (
                      <div className="flex items-center space-x-2">
                        <span className="text-muted-foreground">Size Change:</span>
                        <span className={`font-medium ${dataChange.sizeChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {dataChange.sizeChange > 0 ? '+' : ''}{dataChange.sizeChange} bytes
                        </span>
                      </div>
                    )}

                    <div className="flex items-center space-x-2">
                      <span className="text-muted-foreground">Change Significance:</span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getSignificanceColor(dataChange.significance)}`}>
                        {dataChange.significance}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Hex View for Binary Data */}
              {dataChange.dataType === 'program' && (
                <div>
                  <h4 className="text-sm font-medium text-foreground mb-2">Hex Representation</h4>
                  <div className="bg-background border border-border rounded-md p-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-xs text-muted-foreground">Before:</span>
                        <div className="font-mono text-xs mt-1 break-all">
                          {dataChange.preData ? formatHexData(dataChange.preData) : 'No data'}
                        </div>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">After:</span>
                        <div className="font-mono text-xs mt-1 break-all">
                          {dataChange.postData ? formatHexData(dataChange.postData) : 'No data'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Impact Analysis */}
          <div className="bg-muted/20 p-3 rounded-lg">
            <h4 className="text-sm font-medium text-foreground mb-2">Impact Analysis</h4>
            <div className="space-y-1 text-sm">
              {dataChange.significance === 'high' && (
                <div className="text-red-600 dark:text-red-400">
                  • High significance change detected - review carefully
                </div>
              )}
              {dataChange.dataType === 'program' && (
                <div className="text-blue-600 dark:text-blue-400">
                  • Program code or state has been modified
                </div>
              )}
              {dataChange.dataType === 'token_account' && (
                <div className="text-green-600 dark:text-green-400">
                  • Token account data has been updated
                </div>
              )}
              {dataChange.sizeChange && Math.abs(dataChange.sizeChange) > 100 && (
                <div className="text-yellow-600 dark:text-yellow-400">
                  • Significant data size change ({dataChange.sizeChange > 0 ? 'increased' : 'decreased'} by {Math.abs(dataChange.sizeChange)} bytes)
                </div>
              )}
              {dataDiff && dataDiff.length > 5 && (
                <div className="text-orange-600 dark:text-orange-400">
                  • Multiple fields modified ({dataDiff.length} changes)
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountDataDiff;