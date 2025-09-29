import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// In-memory store for rate limiting
// Note: This will be reset on deployment or server restart
// For production, use a persistent store like Redis
const rateLimit = new Map<string, { count: number; timestamp: number }>();

// Rate limit configuration
const RATE_LIMIT = {
  window: 60 * 1000, // 1 minute in milliseconds
  max: 60, // Maximum requests per window
  apiOnly: true, // Only apply rate limiting to API routes
};

// Security headers to add to all responses
const securityHeaders = {
  'X-DNS-Prefetch-Control': 'on',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'X-XSS-Protection': '1; mode=block',
  'X-Frame-Options': 'SAMEORIGIN',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

// Legacy path redirects
const REDIRECTS: Record<string, string> = {
  // Explorer redirects
  '/tx-explorer': '/tx',
  '/block-explorer': '/blocks',
  '/token-explorer': '/tokens',

  // Common mistypes and variations
  '/transaction': '/tx',
  '/transactions': '/tx',
  '/txn': '/tx',
  '/txns': '/tx',
  '/hash': '/tx',

  // Account variations
  '/address': '/account',
  '/addresses': '/account',
  '/wallet': '/account',
  '/wallets': '/account',
  '/pubkey': '/account',

  // Block variations
  '/slot': '/blocks',
  '/slots': '/blocks',
  '/height': '/blocks',

  // Token variations
  '/gg': '/token',
  '/ezgg': '/token',
  '/to': '/token',
  '/yolo': '/token',
  '/getin': '/token',
  '/ape': '/token',
  '/sendit': '/token',
  '/dyor': '/token',
  '/pf': '/token',
  '/mem': '/token',
  '/meme': '/token',
  '/pumpfun': '/token',
  '/fun': '/token',
  '/ca': '/token',
  '/mint': '/token',
  '/mints': '/tokens',
  '/spl': '/tokens',
  '/spl-tokens': '/tokens',

  // Program variations
  '/programs': '/program',
  '/smart-contract': '/program',
  '/smart-contracts': '/program',
  '/contract': '/program',
  '/contracts': '/program',
  '/dapp': '/program',
  '/dapps': '/program',

  // NFT variations
  '/nft-collection': '/nfts',
  '/nft-collections': '/nfts',
  '/collectibles': '/nfts',
  '/collection': '/nfts',
  '/collections': '/nfts',

  // Common explorer terms
  '/explore': '/',
  '/explorer': '/',
  '/lookup': '/',
  '/query': '/',
  '/find': '/',

  // Dashboard/stats variations
  '/metrics': '/stats',

  // Network variations
  '/mainnet': '/?cluster=mainnet',
  '/devnet': '/?cluster=devnet',
  '/testnet': '/?cluster=testnet',
};

// Helper functions
const getHeaderValue = (headers: Headers, ...keys: string[]): string => {
  const value = keys
    .map(key => headers.get(key))
    .find(value => typeof value === 'string' && value.length > 0);
  return value || 'anonymous';
};

const getQueryParam = (params: URLSearchParams, ...keys: string[]): string => {
  const value = keys
    .map(key => params.get(key))
    .find(value => typeof value === 'string' && value.length > 0);
  return value || '';
};

// ...existing code...
// Regex patterns for paths that should be handled by middleware
const STATIC_ASSET_REGEX = /\.(jpe?g|png|svg|gif|ico|webp|mp4|webm|woff2?|ttf|eot)$/i;

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const url = request.nextUrl.clone();
  const userAgent = request.headers.get('user-agent') || '';

  // CLI installer script handling
  if (pathname === '/') {
    const isCurl = userAgent.toLowerCase().includes('curl');
    const isPowershell = userAgent.toLowerCase().includes('powershell');

    if (isCurl || isPowershell) {
      let scriptContent = '';
      if (isPowershell) {
        // Windows PowerShell command
        scriptContent = `powershell -Command "Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/opensvm/osvm-cli/main/install.ps1' -OutFile 'install.ps1'; .\\install.ps1"`;
        return new Response(scriptContent, {
          status: 200,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      } else {
        // Linux, macOS, etc.
        scriptContent = `curl -sSf https://raw.githubusercontent.com/opensvm/osvm-cli/main/install.sh | sh`;
        return new Response(scriptContent, {
          status: 200,
          headers: { 'Content-Type': 'text/x-shellscript; charset=utf-8' },
        });
      }
    }
  }

  // Skip middleware for static assets (performance optimization)
  // This prevents unnecessary processing of security headers, rate limiting, etc. for static files
  if (STATIC_ASSET_REGEX.test(pathname)) {
    return NextResponse.next();
  }

  // Create response to modify
  const response = NextResponse.next();

  // Add security headers to all responses
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  // Add Content Security Policy for enhanced security
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self' data:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https://*.solana.com https://solana.pics https://maga.finance https://amm.buzz https://p2p.opensvm.com https://tron.codes https://*.helius-rpc.com https://*.chainstack.com https://opensvm.com https://ingesteer.services-prod.nsvcs.net http://localhost:6333 http://localhost:*; object-src 'self' data:;"
  );

  // Handle API rate limiting
  if (pathname.startsWith('/api/')) {
    const ip = getHeaderValue(request.headers, 'x-forwarded-for', 'x-real-ip');
    const now = Date.now();

    // Get existing rate limit data for this IP
    const rateData = rateLimit.get(ip) || { count: 0, timestamp: now };

    // Reset count if outside the current window
    if (now - rateData.timestamp > RATE_LIMIT.window) {
      rateData.count = 0;
      rateData.timestamp = now;
    }

    // Increment request count
    rateData.count++;
    rateLimit.set(ip, rateData);

    // Set rate limit headers
    response.headers.set('X-RateLimit-Limit', RATE_LIMIT.max.toString());
    response.headers.set('X-RateLimit-Remaining', Math.max(0, RATE_LIMIT.max - rateData.count).toString());
    response.headers.set('X-RateLimit-Reset', (rateData.timestamp + RATE_LIMIT.window).toString());

    // Return 429 if rate limit exceeded
    if (rateData.count > RATE_LIMIT.max) {
      return NextResponse.json(
        { error: 'Too many requests, please try again later.' },
        {
          status: 429,
          headers: {
            ...Object.fromEntries(response.headers),
            'Retry-After': Math.ceil((rateData.timestamp + RATE_LIMIT.window - now) / 1000).toString(),
          }
        }
      );
    }
  }

  // Persist custom cluster/RPC override via query param -> cookie
  // Example usages:
  //   ?cluster=devnet
  //   ?cluster=testnet
  //   ?cluster=mainnet
  //   ?cluster=rpc.osvm.ai
  //   ?cluster=https://rpc.osvm.ai/sonic?token=secrettoken
  const clusterParam = url.searchParams.get('cluster');
  if (clusterParam && clusterParam.trim().length > 0) {
    // Set cookie so it persists across navigation
    const cookieValue = clusterParam.trim();

    // Use a redirect to remove the query param from the URL so links stay clean
    url.searchParams.delete('cluster');
    const redirectResponse = NextResponse.redirect(url);

    // Persist cookie for 30 days
    redirectResponse.cookies.set('cluster', cookieValue, {
      path: '/',
      httpOnly: false,
      sameSite: 'lax',
      secure: url.protocol === 'https:',
      maxAge: 60 * 60 * 24 * 30,
    });

    // Carry security headers on redirect, too
    Object.entries(securityHeaders).forEach(([key, value]) => {
      redirectResponse.headers.set(key, value);
    });
    redirectResponse.headers.set(
      'Content-Security-Policy',
      "default-src 'self' data:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https://*.solana.com https://solana.pics https://maga.finance https://amm.buzz https://p2p.opensvm.com https://tron.codes https://*.helius-rpc.com https://*.chainstack.com https://opensvm.com https://ingesteer.services-prod.nsvcs.net http://localhost:6333 http://localhost:*; object-src 'self' data:;"
    );

    return redirectResponse;
  }

  // Handle redirects for legacy paths
  if (pathname in REDIRECTS) {
    url.pathname = REDIRECTS[pathname];
    return NextResponse.redirect(url);
  }

  // Handle specific redirects or rewrites
  if (pathname === '/tx' && !url.search) {
    // Redirect bare /tx to the homepage
    return NextResponse.redirect(new URL('/', request.url));
  }

  if (pathname === '/account' && !url.search) {
    // Redirect bare /account to the homepage
    return NextResponse.redirect(new URL('/', request.url));
  }

  if (pathname === '/token' && !url.search) {
    // Redirect bare /token to the tokens page
    return NextResponse.redirect(new URL('/tokens', request.url));
  }

  if (pathname === '/program' && !url.search) {
    // Redirect bare /program to the programs page
    return NextResponse.redirect(new URL('/programs', request.url));
  }

  if (pathname === '/nft' || pathname === '/nfts/collection') {
    // Redirect NFT-related paths without parameters to the NFTs page
    return NextResponse.redirect(new URL('/nfts', request.url));
  }

  if (pathname === '/block' && !url.search) {
    // Redirect bare /block to the blocks page
    return NextResponse.redirect(new URL('/blocks', request.url));
  }

  // Handle legacy URL redirects
  if (pathname.startsWith('/tx/') && pathname.includes('?')) {
    // Convert query param style to path style: /tx?sig=abc123 -> /tx/abc123
    const txSignature = getQueryParam(url.searchParams, 'sig', 'signature');
    if (txSignature) {
      const newUrl = new URL(`/tx/${txSignature}`, request.url);
      return NextResponse.redirect(newUrl);
    }
  }

  // Handle block redirects
  if (pathname.startsWith('/block') && pathname.includes('?')) {
    // Convert query param style to path style: /block?slot=123 -> /block/123
    const slot = getQueryParam(url.searchParams, 'slot');
    if (slot) {
      // The slot is a string since we checked it's not empty above
      const newUrl = new URL(`/block/${slot}`, request.url);
      return NextResponse.redirect(newUrl);
    }
  }

  return response;
}

// Configure which paths the middleware should run on
export const config = {
  matcher: [
    // Apply to all API routes
    '/api/:path*',
    // Apply to all pages except static assets and Next.js internals
    '/((?!_next|_document|favicon.ico|fonts|images|register-sw\\.js|manifest\\.json).*)',
  ],
};
