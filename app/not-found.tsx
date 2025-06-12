import Link from 'next/link';
import { Home, Search, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-md mx-auto text-center">
        <div className="mb-8">
          <h1 className="text-6xl font-bold text-muted-foreground mb-4">404</h1>
          <h2 className="text-2xl font-semibold text-foreground mb-2">Page Not Found</h2>
          <p className="text-muted-foreground">
            The page you're looking for doesn't exist or may have been moved.
          </p>
        </div>

        <div className="space-y-4 mb-8">
          <div className="bg-muted/50 rounded-lg p-4 text-sm text-left">
            <h3 className="font-medium mb-2">Looking for blockchain data?</h3>
            <ul className="space-y-1 text-muted-foreground">
              <li>• Check transaction signatures are valid (64-character base58)</li>
              <li>• Verify account addresses are valid Solana addresses</li>
              <li>• Ensure block slots are numeric and exist</li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
          >
            <Home className="w-4 h-4" />
            Go Home
          </Link>
          
          <Link
            href="/search"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-border rounded hover:bg-muted transition-colors"
          >
            <Search className="w-4 h-4" />
            Search
          </Link>
          
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-border rounded hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </button>
        </div>

        <div className="mt-8 pt-6 border-t border-border">
          <h3 className="font-medium mb-3">Quick Navigation</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <Link href="/tokens" className="text-muted-foreground hover:text-foreground transition-colors">
              Tokens
            </Link>
            <Link href="/programs" className="text-muted-foreground hover:text-foreground transition-colors">
              Programs
            </Link>
            <Link href="/blocks" className="text-muted-foreground hover:text-foreground transition-colors">
              Blocks
            </Link>
            <Link href="/nfts" className="text-muted-foreground hover:text-foreground transition-colors">
              NFTs
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}