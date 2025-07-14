'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useParams } from 'next/navigation';
import { AlertCircle } from 'lucide-react';

export default function ShareLandingPage() {
  const params = useParams();
  const router = useRouter();
  const shareCode = params?.shareCode as string;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!shareCode) {
      router.push('/');
      return;
    }

    const fetchAndRedirect = async () => {
      try {
        // Fetch actual share data from database
        const response = await fetch(`/api/share/${shareCode}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            setError('Share link not found or expired');
          } else {
            setError('Failed to load shared content');
          }
          return;
        }
        
        const shareData = await response.json();
        
        // Build target URL based on actual entity data
        const targetUrls: Record<string, string> = {
          transaction: `/tx/${shareData.entityId}`,
          account: `/account/${shareData.entityId}`,
          program: `/program/${shareData.entityId}`,
          user: `/user/${shareData.entityId}`
        };
        
        const targetUrl = targetUrls[shareData.entityType] || '/';
        
        // Add ref parameter to track the referral
        const urlWithRef = new URL(targetUrl, window.location.origin);
        urlWithRef.searchParams.set('ref', shareCode);
        
        // Redirect to the actual content with ref tracking
        setTimeout(() => {
          router.push(urlWithRef.pathname + urlWithRef.search);
        }, 1000);
        
      } catch (error) {
        console.error('Error fetching share data:', error);
        setError('Failed to load shared content');
      }
    };

    fetchAndRedirect();
  }, [shareCode, router]);

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Share Not Found</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <button 
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Go to OpenSVM
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
        <p>Loading shared content...</p>
      </div>
    </div>
  );
}
