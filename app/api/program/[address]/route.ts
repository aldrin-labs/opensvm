// @ts-nocheck
import { NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import { getConnection } from '@/lib/solana-connection-server';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(_request, context) {
  try {
    const address = decodeURIComponent(context.params.address);
    const programId = new PublicKey(address);
    const connection = await getConnection();
    const accountInfo = await connection.getAccountInfo(programId);

    if (!accountInfo) {
      return NextResponse.json(
        { error: 'Program not found' },
        { status: 404, headers: corsHeaders }
      );
    }

    if (!accountInfo.executable) {
      return NextResponse.json(
        { error: 'Account is not a program' },
        { status: 400, headers: corsHeaders }
      );
    }

    const programData = {
      address: programId.toBase58(),
      executable: accountInfo.executable,
      owner: accountInfo.owner.toBase58(),
      lamports: accountInfo.lamports || 0,
      rentEpoch: accountInfo.rentEpoch || 0,
      data: Array.from(accountInfo.data).map(b => Number(b)),
      dataSize: accountInfo.data.length
    };

    return NextResponse.json(
      { programData },
      { headers: corsHeaders }
    );

  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch program data' },
      { status: 500, headers: corsHeaders }
    );
  }
}
