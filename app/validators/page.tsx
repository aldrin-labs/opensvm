'use client';

export const dynamic = 'force-dynamic';

import React from 'react';
import { useSettings } from '@/lib/settings';
import { ValidatorTab } from '@/components/solana/validator-tab';

export default function ValidatorsPage() {
  const settings = useSettings();
    // Added ai-validators-page-wrapper for AI navigation
    return (
        <div className="container mx-auto py-8 ai-validators-page-wrapper">
            <div className="mb-8">
                <h1 className="text-4xl font-bold mb-2">Validators</h1>
                <p className="text-muted-foreground">
                    Validator performance and decentralization analytics
                </p>
            </div>
            <ValidatorTab />
        </div>
    );
}
