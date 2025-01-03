// @ts-nocheck
import { Suspense } from 'react';
import { Card, CardHeader, CardContent } from 'rinlab';
import { SearchParams } from 'next/navigation';

type Props = {
  searchParams: { q?: string };
  params: Record<string, string>;
};

export default function SearchPage({
  searchParams,
}: Props) {
  const query = searchParams.q || '';

  if (!query) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Please enter a search query</h1>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Search Results for "{query}"</h1>
      
      <Suspense fallback={<div>Loading...</div>}>
        <div className="grid grid-cols-1 gap-6">
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Accounts</h2>
            </CardHeader>
            <CardContent>
              {/* Account results will go here */}
              <p className="text-gray-500">No matching accounts found</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Tokens</h2>
            </CardHeader>
            <CardContent>
              {/* Token results will go here */}
              <p className="text-gray-500">No matching tokens found</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Programs</h2>
            </CardHeader>
            <CardContent>
              {/* Program results will go here */}
              <p className="text-gray-500">No matching programs found</p>
            </CardContent>
          </Card>
        </div>
      </Suspense>
    </div>
  );
} 