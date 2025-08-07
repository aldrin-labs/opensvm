'use client';

import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, ExternalLink, Settings, Shield, AlertTriangle } from 'lucide-react';

interface IFrameWidgetProps {
  config: {
    title: string;
    url?: string;
    allowNavigation?: boolean;
    showControls?: boolean;
    sandbox?: string[];
    refreshInterval?: number;
    fallbackContent?: string;
    trustedDomains?: string[];
  };
  size: { w: number; h: number };
}

export function IFrameWidget({ config, size }: IFrameWidgetProps) {
  const {
    title,
    url: defaultUrl,
    allowNavigation = false,
    showControls = true,
    sandbox = ['allow-same-origin', 'allow-scripts', 'allow-forms'],
    refreshInterval,
    fallbackContent = 'No content to display',
    trustedDomains = [],
  } = config;

  const [currentUrl, setCurrentUrl] = useState(defaultUrl || '');
  const [inputUrl, setInputUrl] = useState(currentUrl);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isSecure, setIsSecure] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const isCompact = size.h <= 3;

  const validateUrl = (url: string): boolean => {
    try {
      const parsed = new URL(url);
      setIsSecure(parsed.protocol === 'https:');
      
      // Check if domain is in trusted list
      if (trustedDomains.length > 0) {
        return trustedDomains.some(domain => parsed.hostname.includes(domain));
      }
      
      return true;
    } catch {
      return false;
    }
  };

  const handleUrlChange = () => {
    if (validateUrl(inputUrl)) {
      setCurrentUrl(inputUrl);
      setHasError(false);
    } else {
      setHasError(true);
    }
  };

  const handleRefresh = () => {
    if (iframeRef.current) {
      setIsLoading(true);
      const src = iframeRef.current.src;
      iframeRef.current.src = '';
      setTimeout(() => {
        if (iframeRef.current) {
          iframeRef.current.src = src;
        }
      }, 100);
    }
  };

  const handleIFrameLoad = () => {
    setIsLoading(false);
    setHasError(false);
  };

  const handleIFrameError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  const openInNewTab = () => {
    if (currentUrl) {
      window.open(currentUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const getSandboxAttribute = () => {
    return sandbox.join(' ');
  };

  const renderFallback = () => {
    if (hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center p-4 space-y-2">
          <AlertTriangle className="h-8 w-8 text-destructive" />
          <p className="text-sm font-medium">Failed to load content</p>
          <p className="text-xs text-muted-foreground">
            The requested URL could not be loaded or is not accessible
          </p>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-3 w-3 mr-1" />
            Try Again
          </Button>
        </div>
      );
    }

    if (!currentUrl) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center p-4 space-y-2">
          <div className="text-muted-foreground">
            <Shield className="h-8 w-8 mx-auto mb-2" />
            <p className="text-sm">{fallbackContent}</p>
            {allowNavigation && (
              <p className="text-xs mt-2">Enter a URL above to display content</p>
            )}
          </div>
        </div>
      );
    }

    return null;
  };

  const renderSecurityBadge = () => {
    if (!currentUrl) return null;
    
    return (
      <Badge 
        variant={isSecure ? 'default' : 'destructive'} 
        className="text-xs"
        title={isSecure ? 'Secure connection' : 'Insecure connection'}
      >
        <Shield className="h-2 w-2 mr-1" />
        {isSecure ? 'Secure' : 'Insecure'}
      </Badge>
    );
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2 flex-shrink-0">
        <CardTitle className="text-sm flex items-center justify-between">
          <div className="flex items-center space-x-2 min-w-0 flex-1">
            <span className="truncate">{title}</span>
            {renderSecurityBadge()}
          </div>
          
          {showControls && !isCompact && (
            <div className="flex items-center space-x-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={handleRefresh}
                disabled={!currentUrl}
                title="Refresh"
              >
                <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={openInNewTab}
                disabled={!currentUrl}
                title="Open in new tab"
              >
                <ExternalLink className="h-3 w-3" />
              </Button>
            </div>
          )}
        </CardTitle>
        
        {allowNavigation && !isCompact && (
          <div className="flex items-center space-x-2 mt-2">
            <Input
              type="url"
              placeholder="Enter URL..."
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              className="flex-1 h-7 text-xs"
              onKeyPress={(e) => e.key === 'Enter' && handleUrlChange()}
            />
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-3 text-xs"
              onClick={handleUrlChange}
              disabled={!inputUrl.trim()}
            >
              Go
            </Button>
          </div>
        )}
      </CardHeader>

      <CardContent className="pt-0 flex-1 overflow-hidden relative">
        <div className="h-full relative">
          {currentUrl ? (
            <>
              <iframe
                ref={iframeRef}
                src={currentUrl}
                className="w-full h-full border-0 rounded"
                sandbox={getSandboxAttribute()}
                onLoad={handleIFrameLoad}
                onError={handleIFrameError}
                title={title}
                loading="lazy"
                style={{ display: hasError ? 'none' : 'block' }}
              />
              {isLoading && (
                <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                  <div className="flex items-center space-x-2">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">Loading...</span>
                  </div>
                </div>
              )}
            </>
          ) : null}
          
          {renderFallback()}
        </div>

        {trustedDomains.length > 0 && !isCompact && (
          <div className="absolute bottom-2 left-2 right-2">
            <div className="bg-background/90 backdrop-blur-sm border rounded px-2 py-1">
              <p className="text-xs text-muted-foreground">
                Trusted domains: {trustedDomains.slice(0, 2).join(', ')}
                {trustedDomains.length > 2 && ` +${trustedDomains.length - 2} more`}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Also export as default for backwards compatibility
export default IFrameWidget;