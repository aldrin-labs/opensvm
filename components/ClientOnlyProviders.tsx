'use client';

import dynamic from 'next/dynamic';
import React from 'react';

const Providers = dynamic(() => import('@/app/providers').then(mod => mod.Providers), {
    loading: () => <div className="min-h-screen bg-background" />,
    ssr: false,
});

export default function ClientOnlyProviders({ children }: { children: React.ReactNode }) {
    return <Providers>{children}</Providers>;
}
