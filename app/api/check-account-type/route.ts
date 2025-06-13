import { NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';
import { getMint } from '@solana/spl-token';
import { getConnection } from '@/lib/solana-connection';
import { isValidSolanaAddress } from '@/lib/utils';
import { networks } from '@/components/NetworksTable';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');

  if (!address) {
    return NextResponse.json({ error: 'Address is required' }, { status: 400 });
  }

  if (!isValidSolanaAddress(address)) {
    console.log('Invalid Solana address format:', address);
    return NextResponse.json({ type: 'unknown' });
  }

  try {
    console.log('Checking account type across all networks:', address);
    
    // Create connections for each network
    const networkConnections = networks.map(network => ({
      networkId: network.id,
      networkName: network.name,
      connection: new Connection(network.endpoints.mainnet || 'https://api.mainnet-beta.solana.com')
    }));

    // Check account type across all networks in parallel
    const results = await Promise.all(
      networkConnections.map(async ({ networkId, networkName, connection }) => {
        try {
          const pubkey = new PublicKey(address);
          const accountInfo = await connection.getAccountInfo(pubkey);
          
          if (!accountInfo) {
            return { type: 'unknown', network: networkName };
          }

          // Check if it's a program (executable)
          if (accountInfo.executable) {
            console.log(`Found program on ${networkName}:`, address, 'Size:', accountInfo.data.length);
            return { type: 'program', network: networkName };
          }

          // Check if it's a token mint
          const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
          const TOKEN_2022_PROGRAM_ID = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');
          
          const owner = accountInfo.owner;
          if (owner.equals(TOKEN_PROGRAM_ID) || owner.equals(TOKEN_2022_PROGRAM_ID)) {
            try {
              // Verify it's a valid mint account
              const mintInfo = await getMint(connection, pubkey);
              if (mintInfo.isInitialized) {
                console.log(`Found token mint on ${networkName}:`, address, 'Owner:', owner.toBase58());
                return { type: 'token', network: networkName };
              }
            } catch (error) {
              console.log(`Not a valid token mint on ${networkName}:`, address);
            }
          }

          // Regular account
          console.log(`Found regular account on ${networkName}:`, address, 'Owner:', owner);
          return { type: 'account', network: networkName };
        } catch (error) {
          console.error(`Error checking account type on ${networkName}:`, error);
          return { type: 'unknown', network: networkName };
        }
      })
    );

    // Find the first valid result (not unknown)
    const validResult = results.find(result => result.type !== 'unknown');
    if (validResult) {
      return NextResponse.json(validResult);
    }

    // If no valid results found, return unknown
    return NextResponse.json({ type: 'unknown' });
  } catch (error) {
    console.error('Error checking account type:', error);
    return NextResponse.json({ type: 'unknown' });
  }
}