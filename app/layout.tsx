import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from 'next/font/google';
import "./globals.css";
import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import Script from 'next/script';
// Import Navbar with dynamic loading
const Navbar = dynamic(() => import('@/components/Navbar').then(mod => mod.Navbar), {
  loading: () => <div className="h-14 border-b border-border bg-background" />
});

// Load fonts
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jetbrains',
});

// Dynamic imports with loading fallbacks
const Providers = dynamic(() => import('./providers').then(mod => mod.Providers), {
  loading: () => <div className="min-h-screen bg-background" />
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
        
        {/* Performance optimization meta tags */}
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        
        {/* PWA manifest and meta tags */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#00DC82" />
        <meta name="application-name" content="OpenSVM Explorer" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="OpenSVM" />

        {/* Add iOS splash screen images */}
        <link rel="apple-touch-icon" href="/favicon.svg" />
        <link rel="apple-touch-startup-image" href="/favicon.svg" />

        {/* Add preload for critical resources */}
        <link rel="preload" href="/styles/critical.css" as="style" />
        <link rel="stylesheet" href="/styles/critical.css" />
      </head>
      <body className={inter.className}>
        {/* Inline critical CSS for faster rendering */}
        <style dangerouslySetInnerHTML={{ __html: `
          body { display: block; }
          .h-14 { height: 3.5rem; }
          .border-b { border-bottom-width: 1px; }
          .border-border { border-color: hsl(var(--border)); }
          .bg-background { background-color: hsl(var(--background)); }
          .min-h-screen { min-height: 100vh; }
        `}} />
        
        <Providers>
          <Suspense fallback={<div className="min-h-screen bg-background" />}>
            <Navbar>
              {children}
            </Navbar>
          </Suspense>
        </Providers>
        
        {/* Defer non-critical scripts */}
        <Script
          src="/scripts/analytics.js"
          strategy="lazyOnload"
        />
        
        {/* Register service worker */}
        <Script
          id="register-sw"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(
                    function(registration) {
                      console.log('ServiceWorker registration successful with scope: ', registration.scope);
                    },
                    function(error) {
                      console.log('ServiceWorker registration failed: ', error);
                    }
                  );
                });
              }
            `
          }}
        />
        
        {/* Web Vitals monitoring */}
        <Script
          id="web-vitals"
          strategy="afterInteractive"
          src="/scripts/web-vitals.js"
        />
      </body>
    </html>
  );
}