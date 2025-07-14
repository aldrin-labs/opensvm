/**
 * Share Button Component
 * Universal share button for any entity type with dynamic OG generation
 */

'use client';

import { useState } from 'react';
import { Share2, Copy, Check, ExternalLink } from 'lucide-react';
import { useCurrentUser } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator 
} from '@/components/ui/dropdown-menu';
// Simple toast replacement since sonner is not available
const toast = {
  success: (message: string) => console.log('Success:', message),
  error: (message: string) => console.error('Error:', message)
};
import { EntityType } from '@/types/share';

interface ShareButtonProps {
  entityType: EntityType;
  entityId: string;
  className?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'default' | 'lg';
}

export function ShareButton({ 
  entityType, 
  entityId, 
  className = '',
  variant = 'outline',
  size = 'sm'
}: ShareButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const { walletAddress } = useCurrentUser();
  
  const generateShareLink = async () => {
    try {
      setIsGenerating(true);
      
      const response = await fetch('/api/share/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType,
          entityId,
          referrerAddress: walletAddress || undefined
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate share link');
      }
      
      const data = await response.json();
      return data.shareUrl;
    } catch (error) {
      console.error('Error generating share link:', error);
      toast.error('Failed to generate share link');
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Share link copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy to clipboard');
    }
  };

  const handleCopyLink = async () => {
    const shareUrl = await generateShareLink();
    if (shareUrl) {
      await copyToClipboard(shareUrl);
    }
  };

  const handleOpenInNewTab = async () => {
    const shareUrl = await generateShareLink();
    if (shareUrl) {
      window.open(shareUrl, '_blank');
    }
  };

  const handleShareToTwitter = async () => {
    const shareUrl = await generateShareLink();
    if (shareUrl) {
      const twitterUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(`Check out this ${entityType} on OpenSVM Explorer!`)}`;
      window.open(twitterUrl, '_blank');
    }
  };

  const handleShareToTelegram = async () => {
    const shareUrl = await generateShareLink();
    if (shareUrl) {
      const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(`Check out this ${entityType} on OpenSVM Explorer!`)}`;
      window.open(telegramUrl, '_blank');
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant={variant} 
          size={size} 
          className={className}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" />
              <span>Generating...</span>
            </div>
          ) : copied ? (
            <>
              <Check className="h-4 w-4 mr-2" />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Share2 className="h-4 w-4 mr-2" />
              <span>Share</span>
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={handleCopyLink}>
          <Copy className="h-4 w-4 mr-2" />
          Copy share link
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={handleOpenInNewTab}>
          <ExternalLink className="h-4 w-4 mr-2" />
          Open preview
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem onClick={handleShareToTwitter}>
          <div className="h-4 w-4 mr-2 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
            𝕏
          </div>
          Share to X/Twitter
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={handleShareToTelegram}>
          <div className="h-4 w-4 mr-2 bg-blue-400 rounded-full flex items-center justify-center text-white text-xs">
            T
          </div>
          Share to Telegram
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
