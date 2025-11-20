import { NextRequest, NextResponse } from 'next/server';
import { PublicKey, Connection } from '@solana/web3.js';
import { getConnection } from '@/lib/solana/solana-connection-server';
import { isValidSolanaAddress } from '@/lib/utils';
import { rateLimit } from '@/lib/api/rate-limit';

// Route segment config: Set timeout to 120 seconds
export const maxDuration = 120;


interface ProgramAccountSearchRequest {
  programId: string;
  searchType: 'all' | 'filtered' | 'pda';
  filters?: {
    hasBalance?: boolean;
    minBalance?: number;
    hasData?: boolean;
    minDataSize?: number;
    isExecutable?: boolean;
  };
  pdaConfig?: {
    seeds: string[];
    encoding: 'utf8' | 'hex' | 'base64';
  };
  limit?: number;
  offset?: number;
}

interface AccountInfo {
  address: string;
  balance: number;
  dataSize: number;
  executable: boolean;
  owner: string;
  rentEpoch: number | null;
  data?: string;
}

/**
 * Generate PDA (Program Derived Address)
 */
function generatePDA(programId: PublicKey, seeds: string[], encoding: 'utf8' | 'hex' | 'base64'): { address: string; bump: number } | null {
  try {
    const seedBuffers: Buffer[] = [];
    
    for (const seed of seeds) {
      let buffer: Buffer;
      
      switch (encoding) {
        case 'utf8':
          buffer = Buffer.from(seed, 'utf8');
          break;
        case 'hex':
          buffer = Buffer.from(seed, 'hex');
          break;
        case 'base64':
          buffer = Buffer.from(seed, 'base64');
          break;
        default:
          throw new Error(`Invalid encoding: ${encoding}`);
      }
      
      seedBuffers.push(buffer);
    }

    const [pda, bump] = PublicKey.findProgramAddressSync(seedBuffers, programId);
    
    return {
      address: pda.toString(),
      bump
    };
  } catch (error) {
    console.error('Error generating PDA:', error);
    return null;
  }
}

/**
 * Filter accounts based on criteria
 */
function filterAccounts(accounts: AccountInfo[], filters: ProgramAccountSearchRequest['filters']): AccountInfo[] {
  if (!filters) return accounts;
  
  return accounts.filter(account => {
    // Balance filters
    if (filters.hasBalance !== undefined) {
      const hasBalance = account.balance > 0;
      if (filters.hasBalance !== hasBalance) return false;
    }
    
    if (filters.minBalance !== undefined && account.balance < filters.minBalance) {
      return false;
    }
    
    // Data filters
    if (filters.hasData !== undefined) {
      const hasData = account.dataSize > 0;
      if (filters.hasData !== hasData) return false;
    }
    
    if (filters.minDataSize !== undefined && account.dataSize < filters.minDataSize) {
      return false;
    }
    
    // Executable filter
    if (filters.isExecutable !== undefined && account.executable !== filters.isExecutable) {
      return false;
    }
    
    return true;
  });
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    await rateLimit('program-accounts-api', { limit: 30, windowMs: 60000 });
    
    const body: ProgramAccountSearchRequest = await request.json();
    const { programId, searchType, filters, pdaConfig, limit = 100, offset = 0 } = body;

    // Validate program ID
    if (!programId || !isValidSolanaAddress(programId)) {
      return NextResponse.json(
        { error: 'Invalid program ID provided' },
        { status: 400 }
      );
    }

    // Validate search type
    if (!['all', 'filtered', 'pda'].includes(searchType)) {
      return NextResponse.json(
        { error: 'Invalid search type. Must be one of: all, filtered, pda' },
        { status: 400 }
      );
    }

    // Validate PDA config if needed
    if (searchType === 'pda') {
      if (!pdaConfig || !pdaConfig.seeds || !Array.isArray(pdaConfig.seeds)) {
        return NextResponse.json(
          { error: 'PDA configuration with seeds array is required for PDA search' },
          { status: 400 }
        );
      }
      
      if (!['utf8', 'hex', 'base64'].includes(pdaConfig.encoding)) {
        return NextResponse.json(
          { error: 'Invalid encoding. Must be one of: utf8, hex, base64' },
          { status: 400 }
        );
      }
    }

    const connection = getConnection();
    const programPublicKey = new PublicKey(programId);

    let accounts: AccountInfo[] = [];
    let totalCount = 0;

    if (searchType === 'pda') {
      // PDA Generation
      const pda = generatePDA(programPublicKey, pdaConfig!.seeds, pdaConfig!.encoding);
      
      if (!pda) {
        return NextResponse.json(
          { error: 'Failed to generate PDA with provided seeds' },
          { status: 400 }
        );
      }

      try {
        const accountInfo = await connection.getAccountInfo(new PublicKey(pda.address));
        
        if (accountInfo) {
          accounts = [{
            address: pda.address,
            balance: accountInfo.lamports / 1e9, // Convert to SOL
            dataSize: accountInfo.data.length,
            executable: accountInfo.executable,
            owner: accountInfo.owner.toString(),
            rentEpoch: accountInfo.rentEpoch ?? null,
            data: accountInfo.data.toString('base64')
          }];
          totalCount = 1;
        } else {
          // PDA doesn't exist yet, but still return the address
          accounts = [{
            address: pda.address,
            balance: 0,
            dataSize: 0,
            executable: false,
            owner: programId,
            rentEpoch: null
          }];
          totalCount = 1;
        }
      } catch (error) {
        console.error('Error fetching PDA account info:', error);
        return NextResponse.json(
          { error: 'Failed to fetch PDA account information' },
          { status: 500 }
        );
      }
    } else {
      // Fetch all program accounts or filtered accounts
      try {
        const programAccounts = await connection.getProgramAccounts(programPublicKey, {
          commitment: 'confirmed',
          encoding: 'base64'
        });

        // Convert to our format
        const allAccounts: AccountInfo[] = programAccounts.map(({ pubkey, account }) => ({
          address: pubkey.toString(),
          balance: account.lamports / 1e9, // Convert to SOL
          dataSize: account.data.length,
          executable: account.executable,
          owner: account.owner.toString(),
          rentEpoch: account.rentEpoch ?? null,
          data: Buffer.from(account.data).toString('base64')
        }));

        // Apply filters if this is a filtered search
        const filteredAccounts = searchType === 'filtered' && filters 
          ? filterAccounts(allAccounts, filters)
          : allAccounts;

        totalCount = filteredAccounts.length;

        // Apply pagination
        const startIndex = offset;
        const endIndex = Math.min(startIndex + limit, filteredAccounts.length);
        accounts = filteredAccounts.slice(startIndex, endIndex);

      } catch (error) {
        console.error('Error fetching program accounts:', error);
        return NextResponse.json(
          { error: 'Failed to fetch program accounts from blockchain' },
          { status: 500 }
        );
      }
    }

    const response = {
      success: true,
      data: {
        accounts,
        pagination: {
          total: totalCount,
          limit,
          offset,
          hasMore: offset + limit < totalCount
        },
        searchType,
        programId,
        ...(searchType === 'pda' && pdaConfig && {
          pda: {
            seeds: pdaConfig.seeds,
            encoding: pdaConfig.encoding,
            derivationPath: `Program: ${programId}, Seeds: [${pdaConfig.seeds.join(', ')}]`
          }
        })
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Program accounts API error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json(
    { 
      error: 'Method not allowed. Use POST to search program accounts.',
      endpoints: {
        POST: {
          description: 'Search for program accounts',
          parameters: {
            programId: 'string (required) - The program ID to search accounts for',
            searchType: 'string (required) - Type of search: "all", "filtered", or "pda"',
            filters: 'object (optional) - Filter criteria for "filtered" search',
            pdaConfig: 'object (required for "pda" search) - PDA configuration with seeds and encoding',
            limit: 'number (optional, default: 100) - Number of results to return',
            offset: 'number (optional, default: 0) - Pagination offset'
          },
          examples: {
            all: {
              programId: '11111111111111111111111111111112',
              searchType: 'all',
              limit: 50
            },
            filtered: {
              programId: '11111111111111111111111111111112',
              searchType: 'filtered',
              filters: {
                hasBalance: true,
                minBalance: 0.001,
                hasData: true
              }
            },
            pda: {
              programId: '11111111111111111111111111111112',
              searchType: 'pda',
              pdaConfig: {
                seeds: ['metadata', 'user123'],
                encoding: 'utf8'
              }
            }
          }
        }
      }
    },
    { status: 405 }
  );
}
