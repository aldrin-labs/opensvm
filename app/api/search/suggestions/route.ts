export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';
import { sanitizeSearchQuery } from '@/lib/utils';
import { networks } from '@/components/NetworksTable';

interface SearchSuggestion {
  type: 'address' | 'transaction' | 'token' | 'program';
  value: string;
  label?: string;
  network?: string; // Add network field
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query) {
      return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 });
    }

    const sanitizedQuery = sanitizeSearchQuery(query);
    if (!sanitizedQuery) {
      return NextResponse.json({ error: 'Invalid query' }, { status: 400 });
    }

    // Create connections for each network
    const networkConnections = networks.map(network => ({
      networkId: network.id,
      networkName: network.name,
      connection: new Connection(network.endpoints.mainnet || 'https://api.mainnet-beta.solana.com')
    }));

    // Search across all networks in parallel
    const allSuggestions = await Promise.all(
      networkConnections.map(async ({ networkId, networkName, connection }) => {
        const networkSuggestions: SearchSuggestion[] = [];
        
        try {
          // Search for recent transactions
          const pubkey = new PublicKey(sanitizedQuery);
          const signatures = await connection.getSignaturesForAddress(
            pubkey,
            { limit: 3 } // Reduced from 5 to 3 to avoid too many results
          );

          signatures.forEach(sig => {
            networkSuggestions.push({
              type: 'transaction',
              value: sig.signature,
              label: `Transaction: ${sig.signature.slice(0, 20)}...`,
              network: networkName
            });
          });

          // Add program suggestions if it's a program
          try {
            const programInfo = await connection.getAccountInfo(new PublicKey(sanitizedQuery));
            if (programInfo?.executable) {
              networkSuggestions.push({
                type: 'program',
                value: sanitizedQuery,
                label: `Program: ${sanitizedQuery.slice(0, 20)}...`,
                network: networkName
              });
            }
          } catch (error) {
            // Not a valid program, ignore error
          }
        } catch (error) {
          // Not a valid address or other error, ignore
        }

        return networkSuggestions;
      })
    );

    // Combine suggestions from all networks
    const combinedSuggestions = allSuggestions.flat();

    // Add token suggestions if available (using the first network's connection for token check)
    try {
      const tokenResponse = await fetch(`/api/check-token?address=${encodeURIComponent(sanitizedQuery)}`);
      if (tokenResponse.ok) {
        const tokenData = await tokenResponse.json();
        if (tokenData.isToken) {
          // Add token suggestion for each network
          networks.forEach(network => {
            combinedSuggestions.push({
              type: 'token',
              value: sanitizedQuery,
              label: `Token: ${tokenData.symbol || sanitizedQuery}`,
              network: network.name
            });
          });
        }
      }
    } catch (error) {
      console.error('Error checking token:', error);
    }

    return NextResponse.json(combinedSuggestions);
  } catch (error) {
    console.error('Error in suggestions API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}