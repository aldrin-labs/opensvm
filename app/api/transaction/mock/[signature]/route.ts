import { NextRequest, NextResponse } from 'next/server';

// Route segment config: Set timeout to 120 seconds
export const maxDuration = 120;


// Mock transaction data for testing
const MOCK_TRANSACTION_DATA = {
  signature: '4RwR2w12LydcoutGYJz2TbVxY8HVV44FCN2xoo1L9xu7ZcFxFBpoxxpSFTRWf9MPwMzmr9yTuJZjGqSmzcrawF43',
  slot: 123456789,
  blockTime: Date.now() - 3600000, // 1 hour ago
  timestamp: Date.now() - 3600000,
  success: true,
  type: 'transfer',
  fee: 5000,
  details: {
    instructions: [
      {
        programId: 'System111111111111111111111111111111111111',
        accounts: [
          { pubkey: 'DtdSSG8ZJRZVv5Jx7K1MeWp7Zxcu19GD5wQRGpQ9uMF', isSigner: true, isWritable: true },
          { pubkey: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', isSigner: false, isWritable: true }
        ],
        data: 'test-instruction-data',
        type: 'transfer'
      }
    ],
    accounts: [
      { 
        pubkey: 'DtdSSG8ZJRZVv5Jx7K1MeWp7Zxcu19GD5wQRGpQ9uMF',
        lamports: 1000000000,
        owner: 'System111111111111111111111111111111111111',
        executable: false,
        rentEpoch: 123
      },
      { 
        pubkey: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
        lamports: 500000000,
        owner: 'System111111111111111111111111111111111111',
        executable: false,
        rentEpoch: 123
      }
    ],
    balanceChanges: [
      {
        account: 'DtdSSG8ZJRZVv5Jx7K1MeWp7Zxcu19GD5wQRGpQ9uMF',
        before: 1000000000,
        after: 900000000,
        change: -100000000
      },
      {
        account: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
        before: 500000000,
        after: 595000000,
        change: 95000000
      }
    ]
  },
  logs: [
    'Program System111111111111111111111111111111111111 invoke [1]',
    'Program System111111111111111111111111111111111111 success'
  ],
  innerTransactions: [],
  accountKeys: [
    'DtdSSG8ZJRZVv5Jx7K1MeWp7Zxcu19GD5wQRGpQ9uMF',
    '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM'
  ]
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ signature: string }> }
) {
  const { signature } = await params;

  // Detect test environment
  const isTestEnv = process.env.NODE_ENV === 'test' || 
                    process.env.PLAYWRIGHT_TEST === 'true' ||
                    request.headers.get('user-agent')?.includes('playwright');

  if (!isTestEnv) {
    return NextResponse.json(
      { error: 'Mock API only available in test environment' }, 
      { status: 403 }
    );
  }

  // Return mock data with the requested signature
  const mockData = {
    ...MOCK_TRANSACTION_DATA,
    signature: signature
  };

  // Simulate slight delay for realistic testing
  await new Promise(resolve => setTimeout(resolve, 100));

  return NextResponse.json(mockData);
}

// Also support POST requests for consistency
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ signature: string }> }
) {
  return GET(request, { params });
}