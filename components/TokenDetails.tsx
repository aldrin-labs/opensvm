'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getTokenInfo } from '@/lib/solana';
import { formatNumber } from '@/lib/utils';
import { Stack } from 'rinlab';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { ShareButton } from '@/components/ShareButton';

interface TokenData {
  metadata?: {
    name?: string;
    symbol?: string;
    description?: string;
    image?: string;
    updateAuthority?: string;
    attributes?: Array<{
      trait_type: string;
      value: string;
    }>;
  };
  price?: number;
  priceChange24h?: number;
  marketCap?: number;
  supply?: number;
  holders?: number;
  decimals: number;
  volume24h?: number;
}

interface Props {
  mint: string;
}

export default function TokenDetails({ mint }: Props) {
  const [data, setData] = useState<TokenData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const tokenInfo = await getTokenInfo(mint);
        setData(tokenInfo);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch token data');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [mint]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error || !data) {
    return <div>Error: {error || 'Failed to load token data'}</div>;
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Token Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-4">
              {data.metadata?.image && (
                <Image
                  src={data.metadata.image}
                  alt={data.metadata.name || 'Token'}
                  width={48}
                  height={48}
                  className="rounded-full"
                />
              )}
              <div>
                <h1 className="text-2xl font-bold">
                  {data.metadata?.name || 'Unknown Token'}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {data.metadata?.symbol || mint}
                </p>
              </div>
            </CardTitle>
            <ShareButton
              entityType="token"
              entityId={mint}
              variant="outline"
              size="sm"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Stack>
              <div className="text-sm text-muted-foreground">Price</div>
              <div className="text-xl font-semibold">
                ${data.price?.toFixed(6) || 'N/A'}
                {data.priceChange24h && (
                  <span className={`ml-2 text-sm ${data.priceChange24h >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {data.priceChange24h >= 0 ? '+' : ''}{data.priceChange24h.toFixed(2)}%
                  </span>
                )}
              </div>
            </Stack>
            <Stack>
              <div className="text-sm text-muted-foreground">Market Cap</div>
              <div className="text-xl font-semibold">
                ${formatNumber(data.marketCap || 0)}
              </div>
            </Stack>
            <Stack>
              <div className="text-sm text-muted-foreground">Supply</div>
              <div className="text-xl font-semibold">
                {formatNumber(data.supply || 0)}
              </div>
            </Stack>
            <Stack>
              <div className="text-sm text-muted-foreground">Holders</div>
              <div className="text-xl font-semibold">
                {formatNumber(data.holders || 0)}
              </div>
            </Stack>
            <Stack>
              <div className="text-sm text-muted-foreground">Decimals</div>
              <div className="text-xl font-semibold">
                {data.decimals}
              </div>
            </Stack>
            <Stack>
              <div className="text-sm text-muted-foreground">Volume (24h)</div>
              <div className="text-xl font-semibold">
                ${formatNumber(data.volume24h || 0)}
              </div>
            </Stack>
          </div>
        </CardContent>
      </Card>

      {/* Token Info */}
      <Card>
        <CardHeader>
          <CardTitle>Token Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Mint Address</div>
                <div className="font-mono break-all">
                  {mint}
                </div>
              </div>
              {data.metadata?.updateAuthority && (
                <div>
                  <div className="text-sm text-muted-foreground">Update Authority</div>
                  <div className="font-mono break-all">
                    {data.metadata.updateAuthority}
                  </div>
                </div>
              )}
            </div>
            {data.metadata?.description && (
              <div>
                <div className="text-sm text-muted-foreground">Description</div>
                <div className="mt-1">
                  {data.metadata.description}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Token Attributes */}
      {data.metadata?.attributes && data.metadata.attributes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Attributes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.metadata.attributes.map((attr, index) => (
                <div key={index} className="p-4 bg-secondary rounded-lg">
                  <div className="text-sm text-muted-foreground">
                    {attr.trait_type}
                  </div>
                  <div className="font-semibold">
                    {attr.value}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 