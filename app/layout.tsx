import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from 'next/font/google';
import "./globals.css";
import "./styles/custom-scrollbar.css";
import "./styles/scrollbar-themes.css";
import dynamic from 'next/dynamic';
import { Suspense } from 'react';
// Import Navbar directly
import { NavbarInteractive } from '@/components/NavbarInteractive';

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

// Dynamic imports with loading fallbacks and error boundary
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
        
        {/* Meta tags for viewport control and performance monitoring */}
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=cover" />
        <meta name="theme-color" content="#000000" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        
        {/* PWA support */}
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/favicon.svg" />
        
        {/* Base favicon */}
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        
        {/* Service worker registration script */}
        <script src="/register-sw.js" defer></script>
      </head>
      <body className={inter.className}>
        <Providers>
          <Suspense fallback={<div className="min-h-screen bg-background" />}>
            <NavbarInteractive />
            <main className="flex-1 pt-14">
              {children}
            </main>
          </Suspense>
        </Providers>
      </body>
    </html>
  );
}