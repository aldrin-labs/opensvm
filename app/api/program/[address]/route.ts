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

    // Don't serialize full program data - it can be massive (e.g., Token Program is ~250KB)
    // Only include first 256 bytes as preview for large programs
    const MAX_DATA_PREVIEW = 256;
    const dataPreview = accountInfo.data.length > MAX_DATA_PREVIEW
      ? Array.from(accountInfo.data.slice(0, MAX_DATA_PREVIEW)).map(b => Number(b))
      : Array.from(accountInfo.data).map(b => Number(b));

    const programData = {
      address: programId.toBase58(),
      executable: accountInfo.executable,
      owner: accountInfo.owner.toBase58(),
      lamports: accountInfo.lamports || 0,
      rentEpoch: accountInfo.rentEpoch || 0,
      dataPreview, // Only first 256 bytes for preview
      dataSize: accountInfo.data.length,
      dataTruncated: accountInfo.data.length > MAX_DATA_PREVIEW
    };

    const serializedAccountInfo = {
      executable: accountInfo.executable,
      owner: accountInfo.owner.toBase58(),
      lamports: (accountInfo.lamports || 0).toString(),
      rentEpoch: (accountInfo.rentEpoch || 0).toString(),
      dataSize: accountInfo.data.length
      // data field removed - too large for many programs
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
