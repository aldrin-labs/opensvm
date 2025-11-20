import { NextRequest, NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import { dynamicProgramDiscovery } from '@/lib/maintenance/dynamic-program-discovery';
import { getConnection } from '@/lib/solana/solana-connection-server';

/**
 * GET /api/program-discovery
 * 
 * Query parameters:
 * - action: 'discover' | 'trending' | 'community' | 'stats' | 'search'
 * - programId: specific program ID for discovery
 * - query: search query for discovered programs
 * - status: filter community definitions by status
 * - limit: limit for trending programs
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'discover';
    const programId = searchParams.get('programId');
    const query = searchParams.get('query');
    const status = searchParams.get('status') as 'pending' | 'approved' | 'rejected' | null;
    const limit = parseInt(searchParams.get('limit') || '10');

    switch (action) {
      case 'discover':
        if (!programId) {
          return NextResponse.json(
            { success: false, error: { code: 'MISSING_PROGRAM_ID', message: 'Program ID is required for discovery' } },
            { status: 400 }
          );
        }

        // Fetch real transaction data for the program
        const transactionData = await fetchProgramTransactions(programId);
        const discoveredProgram = await dynamicProgramDiscovery.discoverProgram(programId, transactionData);

        if (!discoveredProgram) {
          return NextResponse.json(
            { success: false, error: { code: 'DISCOVERY_FAILED', message: 'Could not discover program information' } },
            { status: 404 }
          );
        }

        return NextResponse.json({
          success: true,
          data: discoveredProgram,
          timestamp: Date.now()
        });

      case 'trending':
        const trendingPrograms = await dynamicProgramDiscovery.getTrendingPrograms(limit);
        return NextResponse.json({
          success: true,
          data: trendingPrograms,
          count: trendingPrograms.length,
          timestamp: Date.now()
        });

      case 'community':
        const communityDefinitions = dynamicProgramDiscovery.getCommunityDefinitions(status || undefined);
        return NextResponse.json({
          success: true,
          data: communityDefinitions,
          count: communityDefinitions.length,
          filter: status,
          timestamp: Date.now()
        });

      case 'stats':
        if (!programId) {
          return NextResponse.json(
            { success: false, error: { code: 'MISSING_PROGRAM_ID', message: 'Program ID is required for stats' } },
            { status: 400 }
          );
        }

        const stats = await dynamicProgramDiscovery.getProgramUsageStats(programId);
        if (!stats) {
          return NextResponse.json(
            { success: false, error: { code: 'STATS_NOT_FOUND', message: 'Usage statistics not found' } },
            { status: 404 }
          );
        }

        return NextResponse.json({
          success: true,
          data: stats,
          timestamp: Date.now()
        });

      case 'search':
        if (!query) {
          return NextResponse.json(
            { success: false, error: { code: 'MISSING_QUERY', message: 'Search query is required' } },
            { status: 400 }
          );
        }

        const searchResults = dynamicProgramDiscovery.searchDiscoveredPrograms(query);
        return NextResponse.json({
          success: true,
          data: searchResults,
          count: searchResults.length,
          query,
          timestamp: Date.now()
        });

      case 'export':
        const exportData = dynamicProgramDiscovery.exportDiscoveryData();
        return NextResponse.json({
          success: true,
          data: exportData,
          timestamp: Date.now()
        });

      case 'all':
        const allDiscovered = dynamicProgramDiscovery.getAllDiscoveredPrograms();
        return NextResponse.json({
          success: true,
          data: allDiscovered,
          count: allDiscovered.length,
          timestamp: Date.now()
        });

      default:
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_ACTION', message: 'Invalid action parameter' } },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Program discovery API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error'
        }
      },
      { status: 500 }
    );
  }
}

/**
 * Fetch real transaction data for a program from the Solana blockchain
 */
async function fetchProgramTransactions(programId: string): Promise<any[]> {
  try {
    const connection = await getConnection();
    const publicKey = new PublicKey(programId);

    // Get recent signatures for the program (limit to reasonable number for analysis)
    const signatures = await connection.getSignaturesForAddress(publicKey, {
      limit: 50 // Reasonable limit for program discovery analysis
    });

    if (signatures.length === 0) {
      return [];
    }

    // Fetch detailed transaction data for each signature
    const transactions = await Promise.all(
      signatures.slice(0, 20).map(async (sig: any) => { // Limit to 20 for performance
        try {
          const tx = await connection.getParsedTransaction(sig.signature, {
            maxSupportedTransactionVersion: 0,
            commitment: 'confirmed'
          });

          if (!tx || !tx.meta) {
            return null;
          }

          // Extract transaction data in the format expected by analyzeUnknownProgram
          return {
            signature: sig.signature,
            feePayer: tx.transaction.message.accountKeys[0]?.pubkey?.toString() || '',
            signer: tx.transaction.message.accountKeys.find(acc => acc.signer)?.pubkey?.toString() || '',
            blockTime: tx.blockTime || Math.floor(Date.now() / 1000),
            instructions: tx.transaction.message.instructions.map((ix: any) => ({
              programId: ix.programId?.toString() || '',
              data: ix.data || '',
              accounts: ix.accounts?.map((accIndex: number) => {
                const accountKey = tx.transaction.message.accountKeys[accIndex];
                return {
                  pubkey: accountKey?.pubkey?.toString() || '',
                  isSigner: accountKey?.signer || false,
                  isWritable: accountKey?.writable || false
                };
              }) || []
            }))
          };
        } catch (error) {
          console.error(`Error fetching transaction ${sig.signature}:`, error);
          return null;
        }
      })
    );

    // Filter out null results and return valid transactions
    return transactions.filter((tx: any) => tx !== null);
  } catch (error) {
    console.error('Error fetching transactions for program %s:', programId, error);
    return [];
  }
}

/**
 * POST /api/program-discovery
 * 
 * For community contributions and program analysis
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, data } = body;

    switch (action) {
      case 'contribute':
        if (!data?.programDefinition || !data?.contributor) {
          return NextResponse.json(
            { success: false, error: { code: 'INVALID_DATA', message: 'Program definition and contributor are required' } },
            { status: 400 }
          );
        }

        const contributionResult = await dynamicProgramDiscovery.addCommunityDefinition(
          data.programDefinition,
          data.contributor
        );

        if (!contributionResult.success) {
          return NextResponse.json(
            { success: false, error: { code: 'CONTRIBUTION_FAILED', message: contributionResult.error } },
            { status: 400 }
          );
        }

        return NextResponse.json({
          success: true,
          message: 'Community definition submitted successfully',
          timestamp: Date.now()
        });

      case 'vote':
        if (!data?.programId || !data?.vote || !data?.userId) {
          return NextResponse.json(
            { success: false, error: { code: 'INVALID_DATA', message: 'Program ID, vote, and user ID are required' } },
            { status: 400 }
          );
        }

        const voteResult = await dynamicProgramDiscovery.voteOnCommunityDefinition(
          data.programId,
          data.vote,
          data.userId
        );

        if (!voteResult.success) {
          return NextResponse.json(
            { success: false, error: { code: 'VOTE_FAILED', message: voteResult.error } },
            { status: 400 }
          );
        }

        return NextResponse.json({
          success: true,
          message: 'Vote recorded successfully',
          timestamp: Date.now()
        });

      case 'analyze':
        if (!data?.programId || !data?.transactionData) {
          return NextResponse.json(
            { success: false, error: { code: 'INVALID_DATA', message: 'Program ID and transaction data are required' } },
            { status: 400 }
          );
        }

        // Update usage statistics
        await dynamicProgramDiscovery.updateProgramUsageStats(
          data.programId,
          data.transactionData
        );

        // Discover program information
        const analysis = await dynamicProgramDiscovery.discoverProgram(
          data.programId,
          data.transactionData
        );

        return NextResponse.json({
          success: true,
          data: {
            discoveredProgram: analysis,
            usageStats: await dynamicProgramDiscovery.getProgramUsageStats(data.programId)
          },
          timestamp: Date.now()
        });

      case 'bulk_analyze':
        if (!data?.programs || !Array.isArray(data.programs)) {
          return NextResponse.json(
            { success: false, error: { code: 'INVALID_DATA', message: 'Programs array is required' } },
            { status: 400 }
          );
        }

        const bulkResults = await Promise.all(
          data.programs.map(async (program: { programId: string; transactionData: any[] }) => {
            try {
              await dynamicProgramDiscovery.updateProgramUsageStats(
                program.programId,
                program.transactionData
              );

              const discovered = await dynamicProgramDiscovery.discoverProgram(
                program.programId,
                program.transactionData
              );

              return {
                programId: program.programId,
                success: true,
                discoveredProgram: discovered,
                usageStats: await dynamicProgramDiscovery.getProgramUsageStats(program.programId)
              };
            } catch (error) {
              return {
                programId: program.programId,
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
              };
            }
          })
        );

        return NextResponse.json({
          success: true,
          data: bulkResults,
          timestamp: Date.now()
        });

      default:
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_ACTION', message: 'Invalid action parameter' } },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Program discovery POST API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error'
        }
      },
      { status: 500 }
    );
  }
}