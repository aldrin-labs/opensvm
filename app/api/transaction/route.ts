export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const signature = request.nextUrl.searchParams.get('signature');

    if (!signature) {
      return NextResponse.json({ error: 'Transaction signature is required' }, { status: 400 });
    }

    // Return mock data for development
    const txDetails = {
      signature,
      timestamp: Date.now(),
      slot: 234567890,
      success: true,
      type: 'token',
      details: {
        instructions: [
          {
            program: 'spl-token',
            accounts: [0, 1, 2],
            data: '{"type":"transfer","info":{"amount":"1000000","authority":"DtdSSG8ZJRZVv5Jx7K1MeWp7Zxcu19GD5wQRGRpQ9uMF","source":"ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL","destination":"TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"}}',
            parsed: {
              type: "transfer",
              info: {
                amount: '1000000',
                authority: 'DtdSSG8ZJRZVv5Jx7K1MeWp7Zxcu19GD5wQRGRpQ9uMF',
                source: 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
                destination: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
              }
            },
            computeUnits: 2400,
            computeUnitsConsumed: 1800
          }
        ],
        accounts: [
          {
            pubkey: { toString() { return 'DtdSSG8ZJRZVv5Jx7K1MeWp7Zxcu19GD5wQRGRpQ9uMF'; } },
            signer: true,
            writable: true
          },
          {
            pubkey: { toString() { return 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'; } },
            signer: false,
            writable: true
          },
          {
            pubkey: { toString() { return 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'; } },
            signer: false,
            writable: true
          }
        ],
        preBalances: [1000000, 500000, 300000],
        postBalances: [999000, 499000, 301000],
        preTokenBalances: [
          {
            accountIndex: 1,
            mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
            uiTokenAmount: {
              amount: '1000000',
              decimals: 6,
              uiAmount: 1.0
            }
          }
        ],
        postTokenBalances: [
          {
            accountIndex: 2,
            mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
            uiTokenAmount: {
              amount: '1000000',
              decimals: 6,
              uiAmount: 1.0
            }
          }
        ],
        logs: [
          'Program TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA invoke [1]',
          'Program log: Transfer 1 USDC',
          'Program consumed 1800 of 2400 compute units',
          'Program TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA success'
        ],
        innerInstructions: []
      }
    };
    return NextResponse.json(txDetails);

  } catch (error) {
    console.error('Transaction error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to fetch transaction',
        details: error instanceof Error ? {
          name: error.name,
          message: error.message,
          stack: error.stack
        } : error
      },
      { status: 500 }
    );
  }
}