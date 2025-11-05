/**
 * API Route: GET /api/launchpad/sales/[saleId]
 * Get a specific ICO sale by ID
 */

import { NextResponse } from 'next/server';
import { getSale } from '@/lib/launchpad/database';

export async function GET(
  request: Request,
  { params }: { params: { saleId: string } }
) {
  try {
    const saleId = params.saleId;
    const sale = await getSale(saleId);
    
    if (!sale) {
      return NextResponse.json(
        {
          success: false,
          error: 'Sale not found',
        },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: sale,
    });
  } catch (error) {
    console.error('Error fetching sale:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch sale',
      },
      { status: 500 }
    );
  }
}
