'use client';

import React from 'react';
import Link from 'next/link';
import {
  Search,
  ExternalLink,
  Copy,
  Route,
  Users,
  Shield,
  Zap,
  Eye,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface GraphContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number } | null;
  targetAddress: string | null;
  targetType: 'account' | 'transaction' | null;
  onClose: () => void;
  onSetPathSource?: (address: string) => void;
  onSetPathTarget?: (address: string) => void;
  onProfileWallet?: (address: string) => void;
  onFindClusters?: (address: string) => void;
  onCopy?: (text: string) => void;
}

export const GraphContextMenu: React.FC<GraphContextMenuProps> = ({
  isOpen,
  position,
  targetAddress,
  targetType,
  onClose,
  onSetPathSource,
  onSetPathTarget,
  onProfileWallet,
  onFindClusters,
  onCopy
}) => {
  if (!isOpen || !position || !targetAddress) return null;

  const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(targetAddress);
    onCopy?.(targetAddress);
    onClose();
  };

  const menuItems = targetType === 'account' ? [
    {
      id: 'view',
      label: 'View Account',
      icon: <Eye className="w-4 h-4" />,
      href: `/account/${targetAddress}`
    },
    {
      id: 'investigate',
      label: 'Investigate',
      icon: <Shield className="w-4 h-4 text-primary" />,
      href: `/investigation?address=${targetAddress}`
    },
    { id: 'divider-1', divider: true },
    {
      id: 'path-source',
      label: 'Set as Path Source',
      icon: <Route className="w-4 h-4" />,
      action: () => {
        onSetPathSource?.(targetAddress);
        onClose();
      }
    },
    {
      id: 'path-target',
      label: 'Set as Path Target',
      icon: <Route className="w-4 h-4" />,
      action: () => {
        onSetPathTarget?.(targetAddress);
        onClose();
      }
    },
    { id: 'divider-2', divider: true },
    {
      id: 'profile',
      label: 'Profile Wallet',
      icon: <Search className="w-4 h-4" />,
      action: () => {
        onProfileWallet?.(targetAddress);
        onClose();
      }
    },
    {
      id: 'clusters',
      label: 'Find Related Clusters',
      icon: <Users className="w-4 h-4" />,
      action: () => {
        onFindClusters?.(targetAddress);
        onClose();
      }
    },
    { id: 'divider-3', divider: true },
    {
      id: 'copy',
      label: 'Copy Address',
      icon: <Copy className="w-4 h-4" />,
      action: handleCopy
    },
    {
      id: 'solscan',
      label: 'View on Solscan',
      icon: <ExternalLink className="w-4 h-4" />,
      href: `https://solscan.io/account/${targetAddress}`,
      external: true
    }
  ] : [
    // Transaction context menu items
    {
      id: 'view-tx',
      label: 'View Transaction',
      icon: <Eye className="w-4 h-4" />,
      href: `/tx/${targetAddress}`
    },
    {
      id: 'copy-sig',
      label: 'Copy Signature',
      icon: <Copy className="w-4 h-4" />,
      action: handleCopy
    },
    {
      id: 'solscan-tx',
      label: 'View on Solscan',
      icon: <ExternalLink className="w-4 h-4" />,
      href: `https://solscan.io/tx/${targetAddress}`,
      external: true
    }
  ];

  return (
    <>
      {/* Backdrop to close menu */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
      />

      {/* Context menu */}
      <div
        className="fixed z-50 min-w-48 bg-background border border-border rounded-lg shadow-lg py-1 overflow-hidden"
        style={{
          left: Math.min(position.x, window.innerWidth - 200),
          top: Math.min(position.y, window.innerHeight - 300)
        }}
      >
        {/* Header */}
        <div className="px-3 py-2 border-b border-border">
          <div className="text-xs text-muted-foreground">
            {targetType === 'account' ? 'Account' : 'Transaction'}
          </div>
          <div className="font-mono text-sm font-medium truncate">
            {formatAddress(targetAddress)}
          </div>
        </div>

        {/* Menu items */}
        <div className="py-1">
          {menuItems.map((item) => {
            if ('divider' in item && item.divider) {
              return <div key={item.id} className="h-px bg-border my-1" />;
            }

            const content = (
              <>
                {item.icon}
                <span className="flex-1">{item.label}</span>
                {item.href && !('external' in item) && (
                  <ChevronRight className="w-3 h-3 text-muted-foreground" />
                )}
                {'external' in item && item.external && (
                  <ExternalLink className="w-3 h-3 text-muted-foreground" />
                )}
              </>
            );

            if (item.href) {
              const linkProps = 'external' in item && item.external
                ? { target: '_blank', rel: 'noopener noreferrer' }
                : {};

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted cursor-pointer',
                    item.id === 'investigate' && 'font-medium text-primary'
                  )}
                  {...linkProps}
                >
                  {content}
                </Link>
              );
            }

            return (
              <button
                key={item.id}
                onClick={item.action}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted text-left"
              >
                {content}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
};

export default GraphContextMenu;
