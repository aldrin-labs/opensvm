#!/bin/bash

# Update API route files
files=(
  "app/api/account-stats/[address]/route.ts"
  "app/api/account-token-stats/[address]/[mint]/route.ts"
  "app/api/account-transfers/[address]/route.ts"
  "app/api/blocks/[slot]/route.ts"
  "app/api/solana-proxy/[transaction]/route.ts"
  "app/api/token/[mint]/route.ts"
  "app/api/token-stats/[account]/[mint]/route.ts"
  "app/api/transaction/[signature]/route.ts"
)

for file in "${files[@]}"; do
  # Replace the params type with Promise type
  sed -i '' 's/{ params: { \([^}]*\) }}/{ params: Promise<{ \1 }> }/g' "$file"
  # Add await for params
  sed -i '' 's/const { \([^}]*\) } = params/const { \1 } = await params/g' "$file"
done

# Update page files
pages=(
  "app/account/[address]/page.tsx"
  "app/block/[slot]/page.tsx"
  "app/docs/[slug]/page.tsx"
  "app/program/[address]/page.tsx"
  "app/token/[mint]/page.tsx"
  "app/tx/[signature]/page.tsx"
)

for file in "${pages[@]}"; do
  # Update interface/type definitions
  sed -i '' 's/params: { \([^}]*\) }/params: Promise<{ \1 }>/g' "$file"
  # Add await for params
  sed -i '' 's/const { \([^}]*\) } = params/const { \1 } = await params/g' "$file"
done

# Update layout files
layouts=(
  "app/program/[address]/layout.tsx"
  "app/account/[address]/layout.tsx"
  "app/block/[slot]/layout.tsx"
  "app/token/[mint]/layout.tsx"
  "app/tx/[signature]/layout.tsx"
)

for file in "${layouts[@]}"; do
  if [ -f "$file" ]; then
    # Update interface/type definitions
    sed -i '' 's/params: { \([^}]*\) }/params: Promise<{ \1 }>/g' "$file"
    # Add await for params
    sed -i '' 's/const { \([^}]*\) } = params/const { \1 } = await params/g' "$file"
  fi
done

# Update client components
echo "'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import AutocompleteSearchBar from '@/components/AutocompleteSearchBar';
import { Select } from '@/components/ui/select';
import { sanitizeSearchQuery, formatNumber, isValidSolanaAddress, isValidTransactionSignature } from '@/lib/utils';

interface SearchPageProps {
  searchParams: { [key: string]: string | string[] | undefined };
}

// Rest of the file content..." > app/search/page.tsx

chmod +x update-types.sh