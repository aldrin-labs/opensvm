import { NextRequest, NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';
import logger from '@/lib/logging/logger';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const startTime = performance.now();
  
  try {
    logger.info('LLMs.txt documentation requested', {
      component: 'LLMsDocsRoute',
      metadata: {
        userAgent: request.headers.get('user-agent'),
        referer: request.headers.get('referer')
      }
    });

    const llmsDocs = generateLLMsDocs();
    
    const endTime = performance.now();
    const duration = endTime - startTime;

    logger.info('LLMs.txt documentation generated', {
      component: 'LLMsDocsRoute',
      metadata: {
        generationTime: duration,
        contentLength: llmsDocs.length
      }
    });

    return new NextResponse(llmsDocs, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Generation-Time': duration.toString(),
        'Cache-Control': 'public, max-age=3600',
      }
    });

  } catch (error) {
    const endTime = performance.now();
    const duration = endTime - startTime;

    logger.error('Failed to generate LLMs.txt documentation', {
      component: 'LLMsDocsRoute',
      metadata: {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        duration
      }
    });

    return new NextResponse(
      'Error generating LLMs.txt documentation',
      { status: 500 }
    );
  }
}

function generateLLMsDocs(): string {
  try {
    const llmsApiPath = join(process.cwd(), 'llms-api.txt');
    const comprehensiveSpec = readFileSync(llmsApiPath, 'utf-8');
    
    const header = `# OpenSVM - LLM-Optimized Documentation

> Comprehensive API documentation for AI agents and LLMs
> Last updated: ${new Date().toISOString()}

## QUICK NAVIGATION

### Main Pages
- Dashboard: https://osvm.ai/
- Search: https://osvm.ai/search  
- Transactions: https://osvm.ai/tx/{signature}
- Blocks: https://osvm.ai/block/{slot}
- Accounts: https://osvm.ai/account/{address}
- Tokens: https://osvm.ai/token/{mint}
- DeFi Analytics: https://osvm.ai/defi
- NFT Collections: https://osvm.ai/nfts

### Documentation
- API Reference: https://osvm.ai/swagger
- OpenAPI Spec: https://osvm.ai/api/docs/openapi
- User Docs: https://osvm.ai/docs
- This File: https://osvm.ai/llms.txt

================================================================================

`;
    
    return header + comprehensiveSpec;
    
  } catch (error) {
    logger.error('Failed to read llms-api.txt', {
      component: 'LLMsDocsRoute',
      metadata: {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    });
    
    return generateFallbackDocs();
  }
}

function generateFallbackDocs(): string {
  return `# OpenSVM API Documentation

## Base URL
- Production: https://osvm.ai/api
- Development: http://localhost:3000/api

## Core Endpoints

### Transactions
- GET /api/transaction/[signature]
- POST /api/transaction/batch
- GET /api/transaction/[signature]/analysis

### Market Data
- GET /api/market-data?mint={TOKEN}&endpoint={ohlcv|markets|orderbook}
- GET /api/dex/[name]
- GET /api/analytics/overview

### Search
- GET /api/search?q={query}&type={account|transaction|token}

## Rate Limits
- General: 60 req/min
- Analytics: 30 req/min
- AI: 10 req/min

For complete docs, ensure llms-api.txt is available.
`;
}
