/**
 * Indexed Data Query API
 *
 * Query the valuable data produced by Proof-of-Useful-Work miners.
 * This data is the permanent contribution - indexed transactions,
 * detected patterns, classified wallets, and extracted entities.
 *
 * GET /api/mcp/indexed - Query indexed data
 *
 * @module app/api/mcp/indexed
 */

import { NextRequest, NextResponse } from 'next/server';
import { indexedStorage } from '../../../../api/src/pouw-indexed-storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/mcp/indexed
 *
 * Query params:
 * - action: 'stats' | 'transactions' | 'transaction' | 'patterns' | 'wallets' | 'wallet' | 'entities' | 'entity' | 'facets' | 'search' | 'status'
 * - For transactions: type, category, success, minFee, maxFee, startTime, endTime, program, account, labels
 * - For transaction: signature (required)
 * - For patterns: type, severity, minConfidence
 * - For wallets: classification, minConfidence, behavior
 * - For wallet: address (required)
 * - For entities: entityType, minConfidence
 * - For entity: address (required)
 * - For search: query (required), collections (comma-separated: transactions,patterns,wallets,entities)
 * - Common: limit, offset, sortBy, sortOrder
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action') || 'stats';

    // Common pagination params
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const sortBy = searchParams.get('sortBy') || undefined;
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc';

    switch (action) {
      case 'stats': {
        const stats = indexedStorage.getStats();
        return NextResponse.json({
          ...stats,
          message: 'These statistics represent the permanent value created by PoUW miners',
        });
      }

      case 'transactions': {
        const type = searchParams.get('type') || undefined;
        const category = searchParams.get('category') || undefined;
        const successParam = searchParams.get('success');
        const success = successParam === 'true' ? true : successParam === 'false' ? false : undefined;
        const minFee = searchParams.get('minFee') ? parseInt(searchParams.get('minFee')!) : undefined;
        const maxFee = searchParams.get('maxFee') ? parseInt(searchParams.get('maxFee')!) : undefined;
        const startTime = searchParams.get('startTime') ? parseInt(searchParams.get('startTime')!) : undefined;
        const endTime = searchParams.get('endTime') ? parseInt(searchParams.get('endTime')!) : undefined;
        const program = searchParams.get('program') || undefined;
        const account = searchParams.get('account') || undefined;
        const labelsParam = searchParams.get('labels');
        const labels = labelsParam ? labelsParam.split(',') : undefined;

        const transactions = indexedStorage.searchTransactions({
          limit,
          offset,
          sortBy,
          sortOrder,
          type,
          category,
          success,
          minFee,
          maxFee,
          startTime,
          endTime,
          program,
          account,
          labels,
        });

        return NextResponse.json({
          transactions,
          count: transactions.length,
          offset,
          limit,
          timestamp: Date.now(),
        });
      }

      case 'transaction': {
        const signature = searchParams.get('signature');
        if (!signature) {
          return NextResponse.json({ error: 'Missing signature parameter' }, { status: 400 });
        }
        const transaction = indexedStorage.getTransaction(signature);
        if (!transaction) {
          return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
        }
        return NextResponse.json(transaction);
      }

      case 'patterns': {
        const type = searchParams.get('type') || undefined;
        const severity = searchParams.get('severity') || undefined;
        const minConfidence = searchParams.get('minConfidence')
          ? parseFloat(searchParams.get('minConfidence')!)
          : undefined;

        const patterns = indexedStorage.searchPatterns({
          limit,
          offset,
          sortBy,
          sortOrder,
          type,
          severity,
          minConfidence,
        });

        return NextResponse.json({
          patterns,
          count: patterns.length,
          offset,
          limit,
          timestamp: Date.now(),
        });
      }

      case 'wallets': {
        const classification = searchParams.get('classification') || undefined;
        const minConfidence = searchParams.get('minConfidence')
          ? parseFloat(searchParams.get('minConfidence')!)
          : undefined;
        const behavior = searchParams.get('behavior') || undefined;

        const wallets = indexedStorage.searchWallets({
          limit,
          offset,
          sortBy,
          sortOrder,
          classification,
          minConfidence,
          behavior,
        });

        return NextResponse.json({
          wallets,
          count: wallets.length,
          offset,
          limit,
          timestamp: Date.now(),
        });
      }

      case 'wallet': {
        const address = searchParams.get('address');
        if (!address) {
          return NextResponse.json({ error: 'Missing address parameter' }, { status: 400 });
        }
        const wallet = indexedStorage.getWallet(address);
        if (!wallet) {
          return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });
        }
        return NextResponse.json(wallet);
      }

      case 'entities': {
        const entityType = searchParams.get('entityType') || undefined;
        const minConfidence = searchParams.get('minConfidence')
          ? parseFloat(searchParams.get('minConfidence')!)
          : undefined;

        const entities = indexedStorage.searchEntities({
          limit,
          offset,
          sortBy,
          sortOrder,
          entityType,
          minConfidence,
        });

        return NextResponse.json({
          entities,
          count: entities.length,
          offset,
          limit,
          timestamp: Date.now(),
        });
      }

      case 'entity': {
        const address = searchParams.get('address');
        if (!address) {
          return NextResponse.json({ error: 'Missing address parameter' }, { status: 400 });
        }
        const entity = indexedStorage.getEntity(address);
        if (!entity) {
          return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
        }
        return NextResponse.json(entity);
      }

      case 'facets': {
        const resource = searchParams.get('resource') || 'all';

        const result: Record<string, unknown> = {};

        if (resource === 'all' || resource === 'transactions') {
          result.transactions = indexedStorage.getTransactionFacets();
        }
        if (resource === 'all' || resource === 'patterns') {
          result.patterns = indexedStorage.getPatternFacets();
        }
        if (resource === 'all' || resource === 'wallets') {
          result.wallets = indexedStorage.getWalletFacets();
        }
        if (resource === 'all' || resource === 'entities') {
          result.entities = indexedStorage.getEntityFacets();
        }

        return NextResponse.json(result);
      }

      case 'search': {
        // Semantic search across all indexed data (requires Qdrant)
        const query = searchParams.get('query');
        if (!query) {
          return NextResponse.json({ error: 'Missing query parameter' }, { status: 400 });
        }

        const collectionsParam = searchParams.get('collections');
        const collections = collectionsParam
          ? (collectionsParam.split(',') as ('transactions' | 'patterns' | 'wallets' | 'entities')[])
          : undefined;

        const results = await indexedStorage.semanticSearch(query, {
          collections,
          limit,
        });

        if (!results.enabled) {
          return NextResponse.json({
            error: 'Semantic search requires Qdrant to be configured',
            hint: 'Set QDRANT_URL environment variable to enable',
            fallback: 'Use action=transactions/patterns/wallets/entities with filters instead',
          }, { status: 503 });
        }

        return NextResponse.json({
          query,
          results: {
            transactions: results.transactions,
            patterns: results.patterns,
            wallets: results.wallets,
            entities: results.entities,
          },
          counts: {
            transactions: results.transactions.length,
            patterns: results.patterns.length,
            wallets: results.wallets.length,
            entities: results.entities.length,
          },
          timestamp: Date.now(),
        });
      }

      case 'status': {
        // Get storage status including Qdrant connectivity
        return NextResponse.json({
          storage: {
            type: indexedStorage.isQdrantEnabled() ? 'hybrid' : 'in-memory',
            qdrantEnabled: indexedStorage.isQdrantEnabled(),
            qdrantUrl: process.env.QDRANT_URL ? '[configured]' : null,
          },
          capabilities: {
            semanticSearch: indexedStorage.isQdrantEnabled(),
            persistence: indexedStorage.isQdrantEnabled(),
            vectorSearch: indexedStorage.isQdrantEnabled(),
          },
          timestamp: Date.now(),
        });
      }

      default:
        return NextResponse.json(
          {
            error: `Invalid action: ${action}`,
            validActions: [
              'stats',
              'transactions',
              'transaction',
              'patterns',
              'wallets',
              'wallet',
              'entities',
              'entity',
              'facets',
              'search',
              'status'
            ]
          },
          { status: 400 }
        );
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
