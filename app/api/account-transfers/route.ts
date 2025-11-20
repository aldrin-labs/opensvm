import { NextRequest, NextResponse } from 'next/server';
import { processTransferRequest, TransactionType } from './[address]/route';
import { isValidSolanaAddress } from '@/lib/utils';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Request limits to prevent abuse
const MAX_LIMIT = 5000;
const MAX_OFFSET = 100000;
const MIN_LIMIT = 1;

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const searchParams = request.nextUrl.searchParams;
  
  // Extract address from query params
  const rawAddress = searchParams.get('address');
  
  if (!rawAddress) {
    return NextResponse.json(
      { error: 'Missing address parameter' },
      { status: 400, headers: corsHeaders }
    );
  }
  
  const address = decodeURIComponent(String(rawAddress));
  
  // Validate address
  if (!isValidSolanaAddress(address)) {
    return NextResponse.json(
      { error: 'Invalid Solana address format' },
      { status: 400, headers: corsHeaders }
    );
  }

  // INPUT VALIDATION: Validate and sanitize offset parameter
  const rawOffset = searchParams.get('offset');
  let offset = parseInt(rawOffset || '0');
  
  if (isNaN(offset) || offset < 0) {
    return NextResponse.json(
      { error: 'Invalid offset parameter. Must be a non-negative integer.' },
      { status: 400, headers: corsHeaders }
    );
  }
  
  if (offset > MAX_OFFSET) {
    return NextResponse.json(
      { error: `Offset too large. Maximum offset is ${MAX_OFFSET}.` },
      { status: 400, headers: corsHeaders }
    );
  }
  
  // INPUT VALIDATION: Validate and sanitize limit parameter
  const rawLimit = searchParams.get('limit');
  const requestedLimit = parseInt(rawLimit || '500');
  
  if (isNaN(requestedLimit) || requestedLimit < MIN_LIMIT) {
    return NextResponse.json(
      { error: `Invalid limit parameter. Must be an integer >= ${MIN_LIMIT}.` },
      { status: 400, headers: corsHeaders }
    );
  }
  
  if (requestedLimit > MAX_LIMIT) {
    return NextResponse.json(
      { error: `Limit too large. Maximum limit is ${MAX_LIMIT}.` },
      { status: 400, headers: corsHeaders }
    );
  }
  
  const limit = requestedLimit;
  const transferType = searchParams.get('transferType') || 'ALL';
  const solanaOnly = searchParams.get('solanaOnly') === 'true';
  const bypassCache = searchParams.get('bypassCache') === 'true';
  
  const txTypeFilter = searchParams.get('txType');
  const txTypeFilters: TransactionType[] | null = txTypeFilter 
    ? txTypeFilter.split(',').filter(t => ['sol', 'spl', 'defi', 'nft', 'program', 'system', 'funding'].includes(t)) as TransactionType[]
    : ['sol', 'spl', 'defi', 'nft', 'program', 'system', 'funding'];

  const mintFilter = searchParams.get('mints');
  const mintFilters: string[] | null = mintFilter
    ? mintFilter.split(',').map(m => m.trim()).filter(m => m.length > 0)
    : null;

  return await processTransferRequest(
    address,
    offset,
    limit,
    transferType,
    solanaOnly,
    startTime,
    searchParams,
    txTypeFilters,
    bypassCache,
    mintFilters
  );
}
