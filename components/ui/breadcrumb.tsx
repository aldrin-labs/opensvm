/**
 * Breadcrumb Navigation Component
 * Provides hierarchical navigation across the platform
 */

'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: React.ReactNode;
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
  showHome?: boolean;
}

export function Breadcrumb({ items, className, showHome = true }: BreadcrumbProps) {
  const allItems = showHome 
    ? [{ label: 'Home', href: '/', icon: <Home className="h-3 w-3" aria-hidden="true" /> }, ...items]
    : items;

  return (
    <nav 
      aria-label="Breadcrumb" 
      className={cn("flex items-center space-x-1 text-sm text-muted-foreground mb-4", className)}
    >
      <ol className="flex items-center space-x-1">
        {allItems.map((item, index) => {
          const isLast = index === allItems.length - 1;
          const isFirst = index === 0;

          return (
            <li key={index} className="flex items-center">
              {!isFirst && (
                <ChevronRight 
                  className="h-4 w-4 mx-1 flex-shrink-0" 
                  aria-hidden="true"
                />
              )}
              
              {isLast ? (
                <span 
                  className="flex items-center gap-1.5 font-medium text-foreground"
                  aria-current="page"
                >
                  {item.icon}
                  {item.label}
                </span>
              ) : item.href ? (
                <Link
                  href={item.href}
                  className="flex items-center gap-1.5 hover:text-foreground transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded px-1"
                  aria-label={`Navigate to ${item.label}`}
                >
                  {item.icon}
                  {item.label}
                </Link>
              ) : (
                <span className="flex items-center gap-1.5">
                  {item.icon}
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * Hook to generate breadcrumbs from pathname
 */
export function useBreadcrumbs(pathname: string, customLabels?: Record<string, string>): BreadcrumbItem[] {
  const segments = pathname.split('/').filter(Boolean);
  
  const defaultLabels: Record<string, string> = {
    'trading-terminal': 'Trading Terminal',
    'defi': 'DeFi',
    'tokens': 'Tokens',
    'blocks': 'Blocks',
    'programs': 'Programs',
    'validators': 'Validators',
    'analytics': 'Analytics',
    'account': 'Account',
    'tx': 'Transaction',
    'search': 'Search',
    'overview': 'Overview',
    'gainers': 'Top Gainers',
    'new': 'New Listings',
    'scan': 'Memecoin Scanner',
    'monitoring': 'Live Monitoring',
    'trends': 'Trends',
    ...customLabels,
  };

  const breadcrumbs: BreadcrumbItem[] = [];
  let currentPath = '';

  segments.forEach((segment, index) => {
    currentPath += `/${segment}`;
    
    // Skip if it's a hash or dynamic parameter (like account addresses)
    if (segment.length > 30 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(segment)) {
      breadcrumbs.push({
        label: `${segment.substring(0, 8)}...${segment.substring(segment.length - 8)}`,
        href: index < segments.length - 1 ? currentPath : undefined,
      });
    } else {
      breadcrumbs.push({
        label: defaultLabels[segment] || segment.charAt(0).toUpperCase() + segment.slice(1),
        href: index < segments.length - 1 ? currentPath : undefined,
      });
    }
  });

  return breadcrumbs;
}
