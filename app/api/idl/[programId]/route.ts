/**
 * IDL API - Get/Delete IDL by Program ID
 *
 * GET /api/idl/:programId - Get IDL for a program
 * DELETE /api/idl/:programId - Delete IDL for a program
 */

import { NextRequest, NextResponse } from 'next/server';
import { getIDL, getIDLsByProgram, deleteIDL } from '@/lib/idl/database';

// Validate Solana public key format (base58, 32-44 chars)
function isValidProgramId(programId: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(programId);
}

/**
 * GET /api/idl/:programId
 * Get IDL for a specific program
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ programId: string }> }
) {
  try {
    const { programId } = await params;

    if (!programId || !isValidProgramId(programId)) {
      return NextResponse.json(
        { error: 'Invalid program ID format' },
        { status: 400 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const network = searchParams.get('network') || 'mainnet';
    const allNetworks = searchParams.get('all') === 'true';

    // Get all IDLs for this program across networks
    if (allNetworks) {
      const idls = await getIDLsByProgram(programId);
      if (idls.length === 0) {
        return NextResponse.json(
          { error: 'IDL not found for program', programId },
          { status: 404 }
        );
      }
      return NextResponse.json({
        programId,
        idls: idls.map((i) => ({
          network: i.network,
          name: i.name,
          version: i.version,
          verified: i.verified,
          idl: i.idl,
          createdAt: i.createdAt,
          updatedAt: i.updatedAt,
        })),
      });
    }

    // Get IDL for specific network
    const stored = await getIDL(programId, network);
    if (!stored) {
      return NextResponse.json(
        { error: 'IDL not found for program', programId, network },
        { status: 404 }
      );
    }

    return NextResponse.json({
      programId: stored.programId,
      name: stored.name,
      version: stored.version,
      description: stored.description,
      network: stored.network,
      verified: stored.verified,
      source: stored.source,
      sourceUrl: stored.sourceUrl,
      instructionCount: stored.instructionCount,
      accountCount: stored.accountCount,
      typeCount: stored.typeCount,
      errorCount: stored.errorCount,
      idl: stored.idl,
      createdAt: stored.createdAt,
      updatedAt: stored.updatedAt,
    });
  } catch (error) {
    console.error('Error fetching IDL:', error);
    return NextResponse.json(
      { error: 'Failed to fetch IDL' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/idl/:programId
 * Delete IDL for a program
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ programId: string }> }
) {
  try {
    const { programId } = await params;

    if (!programId || !isValidProgramId(programId)) {
      return NextResponse.json(
        { error: 'Invalid program ID format' },
        { status: 400 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const network = searchParams.get('network') || 'mainnet';

    const deleted = await deleteIDL(programId, network);
    if (!deleted) {
      return NextResponse.json(
        { error: 'IDL not found', programId, network },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'IDL deleted successfully',
      programId,
      network,
    });
  } catch (error) {
    console.error('Error deleting IDL:', error);
    return NextResponse.json(
      { error: 'Failed to delete IDL' },
      { status: 500 }
    );
  }
}
