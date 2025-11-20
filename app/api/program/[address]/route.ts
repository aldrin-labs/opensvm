// @ts-nocheck
import { NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import { getConnection } from '@/lib/solana/solana-connection-server';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ address: string }> }
) {
  try {
    const params = await context.params;
    const address = decodeURIComponent(params.address);
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

    const serializedAccountInfo = {
      executable: accountInfo.executable,
      owner: accountInfo.owner.toBase58(),
      lamports: (accountInfo.lamports || 0).toString(),
      rentEpoch: (accountInfo.rentEpoch || 0).toString(),
      data: Array.from(accountInfo.data).map(b => Number(b))
    };

    return NextResponse.json(
      { programData, serializedAccountInfo },
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
