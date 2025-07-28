'use client';

import React from 'react';
import { ValidatorTab } from '@/components/solana/validator-tab';

export default function ValidatorsPage() {
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