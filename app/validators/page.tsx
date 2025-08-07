'use client';

export const dynamic = 'force-dynamic';

import React from 'react';
import { useSettings } from '@/app/providers/SettingsProvider';
import { ValidatorTab } from '@/components/solana/validator-tab';

export default function ValidatorsPage() {
  const settings = useSettings();
    return (
        <div className="container mx-auto py-8">
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