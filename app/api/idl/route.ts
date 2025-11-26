/**
 * IDL API - List and Create IDLs
 *
 * GET /api/idl - List all IDLs with optional filters
 * POST /api/idl - Upload/store a new IDL
 */

import { NextRequest, NextResponse } from 'next/server';
import { storeIDL, listIDLs, validateIDL } from '@/lib/idl/database';

// Validate Solana public key format (base58, 32-44 chars)
function isValidProgramId(programId: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(programId);
}

/**
 * GET /api/idl
 * List all IDLs with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const filters = {
      network: searchParams.get('network') || undefined,
      verified: searchParams.get('verified')
        ? searchParams.get('verified') === 'true'
        : undefined,
      source: searchParams.get('source') || undefined,
      limit: searchParams.get('limit')
        ? parseInt(searchParams.get('limit')!, 10)
        : 100,
      offset: searchParams.get('offset')
        ? parseInt(searchParams.get('offset')!, 10)
        : 0,
    };

    const { items, total } = await listIDLs(filters);

    return NextResponse.json({
      items,
      total,
      limit: filters.limit,
      offset: filters.offset,
      hasMore: filters.offset! + items.length < total,
    });
  } catch (error) {
    console.error('Error listing IDLs:', error);
    return NextResponse.json(
      { error: 'Failed to list IDLs' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/idl
 * Upload/store a new IDL
 *
 * Request body:
 * {
 *   programId: string,        // Required: Program address
 *   idl: object,              // Required: Full IDL JSON
 *   network?: string,         // Optional: mainnet, devnet, testnet, localnet (default: mainnet)
 *   verified?: boolean,       // Optional: Whether IDL is verified (default: false)
 *   source?: string,          // Optional: anchor, manual, onchain, github
 *   sourceUrl?: string        // Optional: URL to source (e.g., GitHub repo)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.programId) {
      return NextResponse.json(
        { error: 'programId is required' },
        { status: 400 }
      );
    }

    if (!isValidProgramId(body.programId)) {
      return NextResponse.json(
        { error: 'Invalid programId format. Must be a valid Solana public key.' },
        { status: 400 }
      );
    }

    if (!body.idl) {
      return NextResponse.json(
        { error: 'idl is required' },
        { status: 400 }
      );
    }

    // Validate IDL structure
    const validation = validateIDL(body.idl);
    if (!validation.valid) {
      return NextResponse.json(
        {
          error: 'Invalid IDL structure',
          details: validation.errors,
        },
        { status: 400 }
      );
    }

    // Validate network
    const validNetworks = ['mainnet', 'devnet', 'testnet', 'localnet'];
    const network = body.network || 'mainnet';
    if (!validNetworks.includes(network)) {
      return NextResponse.json(
        {
          error: 'Invalid network',
          validNetworks,
        },
        { status: 400 }
      );
    }

    // Validate source
    const validSources = ['anchor', 'manual', 'onchain', 'github'];
    if (body.source && !validSources.includes(body.source)) {
      return NextResponse.json(
        {
          error: 'Invalid source',
          validSources,
        },
        { status: 400 }
      );
    }

    // Store IDL
    const stored = await storeIDL({
      programId: body.programId,
      idl: body.idl,
      network: network as 'mainnet' | 'devnet' | 'testnet' | 'localnet',
      verified: body.verified ?? false,
      uploadedBy: body.uploadedBy,
      source: body.source,
      sourceUrl: body.sourceUrl,
    });

    return NextResponse.json(
      {
        success: true,
        message: 'IDL stored successfully',
        programId: stored.programId,
        name: stored.name,
        version: stored.version,
        network: stored.network,
        verified: stored.verified,
        instructionCount: stored.instructionCount,
        accountCount: stored.accountCount,
        typeCount: stored.typeCount,
        errorCount: stored.errorCount,
        createdAt: stored.createdAt,
        updatedAt: stored.updatedAt,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error storing IDL:', error);

    // Check for JSON parse error
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to store IDL' },
      { status: 500 }
    );
  }
}
