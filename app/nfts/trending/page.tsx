'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useSettings } from '@/app/providers/SettingsProvider';

interface TrendingNFTCollection {
  address: string;
  name: string;
  symbol: string;
  image: string;
  volume24h: string;
  transactions24h: number;
}

const fetchTrendingCollections = async (): Promise<TrendingNFTCollection[]> => {
  const response = await fetch('/api/nft-collections/trending');
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json();
};

export default function TrendingNFTsPage() {
  const settings = useSettings();
  const [collections, setCollections] = useState<TrendingNFTCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let mounted = true;
    let retryTimeout: NodeJS.Timeout;

    const fetchCollections = async () => {
      try {
        const data = await fetchTrendingCollections();
        if (mounted) {
          setCollections(data);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to fetch trending collections';
          setError(errorMessage);
          if (retryCount < 2) {
            const nextRetry = () => {
              if (mounted) {
                setRetryCount(prev => prev + 1);
              }
            };
            retryTimeout = setTimeout(nextRetry, 1000);
          }
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchCollections();

    return () => {
      mounted = false;
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
    };
  }, [retryCount]);

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Trending NFTs</h1>
          <p className="text-muted-foreground">
            Most active NFT collections in the last 24 hours.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} data-testid="nft-skeleton" className="rounded-lg border p-4 animate-pulse">
              <div className="w-full h-48 bg-muted mb-4" />
              <div className="h-4 bg-muted w-3/4 mb-2" />
              <div className="h-4 bg-muted w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Trending NFTs</h1>
          <p className="text-muted-foreground">
            Most active NFT collections in the last 24 hours.
          </p>
        </div>
        <div className="rounded-md border p-8 text-center">
          <p className="text-red-600" data-testid="error-message">{error}</p>
        </div>
      </div>
    );
  }

  if (collections.length === 0) {
    return (
      <div className="container mx-auto py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Trending NFTs</h1>
          <p className="text-muted-foreground">
            Most active NFT collections in the last 24 hours.
          </p>
        </div>
        <div className="rounded-md border p-8 text-center">
          <p className="text-muted-foreground">No trending collections found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Trending NFTs</h1>
        <p className="text-muted-foreground">
          Most active NFT collections in the last 24 hours.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {collections.map((collection) => (
          <div
            key={collection.name}
            data-testid="nft-collection"
            className="rounded-lg border p-4"
          >
            {collection.image.startsWith('/') || collection.image.startsWith('http') ? (
              <Image
                src={collection.image}
                alt={collection.name}
                width={400}
                height={300}
                className="w-full h-48 object-cover rounded-md mb-4"
                onError={(e) => {
                  e.currentTarget.src = '/images/placeholder-nft.svg';
                }}
              />
            ) : (
              <Image
                src="/images/placeholder-nft.svg"
                alt={collection.name}
                width={400}
                height={300}
                className="w-full h-48 object-cover rounded-md mb-4"
              />
            )}
            <h3 className="font-semibold text-lg mb-2">{collection.name}</h3>
            <p className="text-muted-foreground mb-2">{collection.symbol}</p>
            <div className="flex justify-between text-sm">
              <div>
                <p className="text-muted-foreground">24h Volume</p>
                <p className="font-medium">{Number(collection.volume24h).toLocaleString()} SOL</p>
              </div>
              <div className="text-right">
                <p className="text-muted-foreground">24h Transactions</p>
                <p className="font-medium">{collection.transactions24h.toLocaleString()}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
