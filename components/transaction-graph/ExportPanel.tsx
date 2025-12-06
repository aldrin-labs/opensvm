'use client';

import React, { useState } from 'react';
import {
  Download,
  X,
  Image,
  FileJson,
  FileCode,
  Copy,
  Share2,
  Upload,
  Check
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExportPanelProps {
  onExportPNG: (options: { scale: number; backgroundColor: string }) => void;
  onExportSVG: () => void;
  onExportJSON: (includeMetadata: boolean) => void;
  onImportJSON: (file: File) => void;
  onCopyAddresses: () => void;
  onCopySignatures: () => void;
  onGenerateShareURL: () => string;
  className?: string;
}

export const ExportPanel: React.FC<ExportPanelProps> = ({
  onExportPNG,
  onExportSVG,
  onExportJSON,
  onImportJSON,
  onCopyAddresses,
  onCopySignatures,
  onGenerateShareURL,
  className
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [pngScale, setPngScale] = useState(2);
  const [pngBackground, setPngBackground] = useState('#ffffff');
  const [includeMetadata, setIncludeMetadata] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const handleCopy = async (type: 'addresses' | 'signatures' | 'url') => {
    if (type === 'addresses') {
      onCopyAddresses();
    } else if (type === 'signatures') {
      onCopySignatures();
    } else if (type === 'url') {
      const url = onGenerateShareURL();
      setShareUrl(url);
      await navigator.clipboard.writeText(url);
    }
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportJSON(file);
    }
  };

  return (
    <div className={cn(
      'absolute bottom-4 right-4 z-20 bg-background/95 backdrop-blur-sm',
      'border border-border rounded-xl shadow-lg transition-all duration-300',
      isExpanded ? 'w-72' : 'w-auto',
      className
    )}>
      {/* Collapsed */}
      {!isExpanded && (
        <button
          onClick={() => setIsExpanded(true)}
          className="flex items-center gap-2 p-3 rounded-xl hover:bg-muted/50 transition-colors"
        >
          <Download className="w-5 h-5 text-primary" />
          <span className="text-sm font-medium">Export</span>
        </button>
      )}

      {/* Expanded */}
      {isExpanded && (
        <>
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Download className="w-5 h-5 text-primary" />
              <span className="font-medium">Export & Share</span>
            </div>
            <button
              onClick={() => setIsExpanded(false)}
              className="p-1 rounded-lg hover:bg-muted text-muted-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-3 space-y-4">
            {/* Image Export */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Image Export
              </p>

              <div className="flex gap-2">
                <button
                  onClick={() => onExportPNG({ scale: pngScale, backgroundColor: pngBackground })}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-sm"
                >
                  <Image className="w-4 h-4" />
                  PNG
                </button>
                <button
                  onClick={onExportSVG}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-muted hover:bg-muted/80 text-sm"
                >
                  <FileCode className="w-4 h-4" />
                  SVG
                </button>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <label className="text-muted-foreground">Scale:</label>
                <select
                  value={pngScale}
                  onChange={(e) => setPngScale(Number(e.target.value))}
                  className="px-2 py-1 rounded border border-border bg-background"
                >
                  <option value={1}>1x</option>
                  <option value={2}>2x (HD)</option>
                  <option value={3}>3x</option>
                  <option value={4}>4x (Print)</option>
                </select>
                <label className="text-muted-foreground ml-2">BG:</label>
                <input
                  type="color"
                  value={pngBackground}
                  onChange={(e) => setPngBackground(e.target.value)}
                  className="w-6 h-6 rounded cursor-pointer"
                />
              </div>
            </div>

            {/* Data Export */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Data Export
              </p>

              <button
                onClick={() => onExportJSON(includeMetadata)}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-muted hover:bg-muted/80 text-sm"
              >
                <FileJson className="w-4 h-4" />
                Export JSON
              </button>

              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeMetadata}
                  onChange={(e) => setIncludeMetadata(e.target.checked)}
                  className="rounded border-border"
                />
                <span className="text-muted-foreground">Include metadata</span>
              </label>
            </div>

            {/* Import */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Import
              </p>

              <label className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-muted hover:bg-muted/80 text-sm cursor-pointer border-2 border-dashed border-border">
                <Upload className="w-4 h-4" />
                Import JSON
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileImport}
                  className="hidden"
                />
              </label>
            </div>

            {/* Copy to Clipboard */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Copy to Clipboard
              </p>

              <div className="flex gap-2">
                <button
                  onClick={() => handleCopy('addresses')}
                  className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-xs"
                >
                  {copied === 'addresses' ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
                  Addresses
                </button>
                <button
                  onClick={() => handleCopy('signatures')}
                  className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-xs"
                >
                  {copied === 'signatures' ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
                  Signatures
                </button>
              </div>
            </div>

            {/* Share */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Share
              </p>

              <button
                onClick={() => handleCopy('url')}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-success/10 hover:bg-success/20 text-success text-sm"
              >
                {copied === 'url' ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
                {copied === 'url' ? 'URL Copied!' : 'Generate Share URL'}
              </button>

              {shareUrl && (
                <div className="p-2 bg-muted/50 rounded text-xs font-mono break-all">
                  {shareUrl}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ExportPanel;
