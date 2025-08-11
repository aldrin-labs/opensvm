export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import { getConnection } from '@/lib/solana-connection-server';
import { isValidSolanaAddress } from '@/lib/utils';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');

  if (!address) {
    return NextResponse.json({ error: 'Address is required' }, { status: 400 });
  }

  if (!isValidSolanaAddress(address)) {
    console.log('Invalid Solana address format:', address);
    return NextResponse.json({ isToken: false });
  }

  try {
    console.log('Checking if address is token mint:', address);
    const connection = await getConnection();
    const pubkey = new PublicKey(address);

    // First check if account exists and get its owner
    const accountInfo = await connection.getAccountInfo(pubkey);
    if (!accountInfo?.owner) {
      console.log('Account not found or no owner:', address);
      return NextResponse.json({ isToken: false });
    }

    // Check if account is owned by Token Program
    const TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
    const TOKEN_2022_PROGRAM_ID = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';

    const owner = accountInfo.owner.toBase58();
    const isToken = owner === TOKEN_PROGRAM_ID || owner === TOKEN_2022_PROGRAM_ID;

    if (isToken) {
      console.log('Found token mint:', address, 'Owner:', owner);
    } else {
      console.log('Not a token mint:', address, 'Owner:', owner);
    }

    return NextResponse.json({ isToken });
  } catch (error) {
    // If error is not related to invalid mint, log it
    if (!(error instanceof Error) || !error.message.includes('Invalid mint')) {
      console.error('Error checking token mint:', error);
    } else {
      console.log('Not a valid token mint:', address);
    }
    return NextResponse.json({ isToken: false });
  }
}
