export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from 'next/font/google';
import "./globals.css";
import { Suspense } from 'react';
import ClientLayoutWrapper from '@/components/ClientLayoutWrapper';

// Dynamic import of Providers to prevent SSR issues
import dynamicImport from 'next/dynamic';
const Providers = dynamicImport(() => import('./providers').then(mod => mod.Providers), {
  loading: () => <div className="min-h-screen bg-background" />
});

// Load fonts with preload
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
  preload: true,
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jetbrains',
  preload: true,
});

export const metadata: Metadata = {
  title: "OpenSVM - AI Explorer and RPC nodes provider for all SVM networks (Solana Virtual Machine)",
  description: "Explore all SVM networks with AI assistance, or create your Solana Network Extension for free.",
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
    other: {
      rel: 'icon',
      url: '/favicon.svg',
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${jetbrains.variable}`}>
      <head>
        <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
        {/* Preconnect to critical domains */}
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="preconnect"
          href="https://api.mainnet-beta.solana.com"
          crossOrigin="anonymous"
        />
        
        {/* Preload critical fonts */}
        <link 
          rel="preload" 
          href="/fonts/BerkeleyMono-Regular.woff2" 
          as="font" 
          type="font/woff2" 
          crossOrigin="anonymous"
        />
        <link 
          rel="preload" 
          href="/fonts/BerkeleyMono-Bold.woff2" 
          as="font" 
          type="font/woff2" 
          crossOrigin="anonymous"
        />
        
        {/* Priority hints for critical resources */}
        <link
          rel="preload"
          href="/favicon.svg"
          as="image"
          type="image/svg+xml"
          fetchPriority="high"
        />
        
        {/* Meta tags for performance monitoring */}
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#000000" />
        
        {/* Base favicon */}
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
      </head>
      <body className={inter.className}>
        <Providers>
          <Suspense fallback={<div className="min-h-screen bg-background" />}>
            <ClientLayoutWrapper>
              {children}
            </ClientLayoutWrapper>
          </Suspense>
        </Providers>
      </body>
    </html>
  );
}