import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // In a real implementation, this would fetch from a database or external API
    const collections = [
      {
        address: 'DRiP2Pn2K6fuMLKQmt5rZWyHiUZ6WK3GChEySUpHSS4x',
        name: 'DRiP',
        symbol: 'DRIP',
        image: '/images/placeholder-nft.svg',
        mintedAt: '2024-01-29T07:00:00Z',
        totalSupply: 10000
      },
      {
        address: 'SMBH3wF6baUj6JWtzYvqcKuj2XCKWDqQxzspY12xPND',
        name: 'Solana Monkey Business',
        symbol: 'SMB',
        image: '/images/placeholder-nft.svg',
        mintedAt: '2024-01-29T06:30:00Z',
        totalSupply: 5000
      }
    ];

    return NextResponse.json(collections);
  } catch (error) {
    return new NextResponse(
      error instanceof Error ? error.message : 'Internal Server Error',
      { status: 500 }
    );
  }
}
