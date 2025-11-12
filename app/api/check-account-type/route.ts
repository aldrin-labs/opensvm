import { NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import { getMint } from '@solana/spl-token';
import { getConnection } from '@/lib/solana-connection-server';

// Lenient validation - just check format, not blockchain validity
function looksLikeSolanaAddress(address: string): boolean {
  if (!address || typeof address !== 'string') return false;
  
  // Solana addresses are 32-44 characters
  if (address.length < 32 || address.length > 44) return false;
  
  // Check if it contains only valid base58 characters
  // Base58 alphabet: 123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
  return base58Regex.test(address);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');

  if (!address) {
    return NextResponse.json({ error: 'Address is required' }, { status: 400 });
  }

  if (!looksLikeSolanaAddress(address)) {
    console.log('Invalid Solana address format:', address);
    return NextResponse.json({ type: 'unknown' });
  }

  try {
    console.log('Checking account type:', address);
    const connection = await getConnection();
    const pubkey = new PublicKey(address);
    const accountInfo = await connection.getAccountInfo(pubkey);

    if (!accountInfo) {
      console.log('Account not found:', address);
      return NextResponse.json({ type: 'unknown' });
    }

    // Check if it's a program (executable)
    if (accountInfo.executable) {
      console.log('Found program:', address, 'Size:', accountInfo.data.length);
      return NextResponse.json({ type: 'program' });
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
          console.log('Found token mint:', address, 'Owner:', owner.toBase58());
          return NextResponse.json({ type: 'token' });
        }
      } catch (error) {
        console.log('Not a valid token mint:', address);
      }
    }

    // Regular account
    console.log('Found regular account:', address, 'Owner:', owner);
    return NextResponse.json({ type: 'account' });
  } catch (error) {
    console.error('Error checking account type:', error);
    return NextResponse.json({ type: 'unknown' });
  }
}
