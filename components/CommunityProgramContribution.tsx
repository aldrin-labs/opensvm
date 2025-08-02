'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';

interface CommunityProgramContributionProps {
  onContribute?: (definition: any) => void;
}

export function CommunityProgramContribution({
  onContribute
}: CommunityProgramContributionProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form state for contribution
  const [programDefinition, setProgramDefinition] = useState({
    programId: '',
    name: '',
    description: '',
    category: 'unknown',
    website: '',
    documentation: '',
    instructions: [
      {
        discriminator: '',
        name: '',
        description: '',
        category: 'unknown',
        riskLevel: 'low' as const,
        accounts: [],
        parameters: []
      }
    ]
  });

  const handleSubmitContribution = async () => {
    setIsSubmitting(true);

    try {
      // Submit the program definition
      const response = await fetch('/api/program-registry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(programDefinition),
      });

      const result = await response.json();

      if (result.success) {
        onContribute?.(programDefinition);
        // Reset form
        setProgramDefinition({
          programId: '',
          name: '',
          description: '',
          category: 'unknown',
          website: '',
          documentation: '',
          instructions: [
            {
              discriminator: '',
              name: '',
              description: '',
              category: 'unknown',
              riskLevel: 'low' as const,
              accounts: [],
              parameters: []
            }
          ]
        });
      } else {
        console.error('Submission failed:', result.error);
      }
    } catch (error) {
      console.error('Submission failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold">Community Program Registry</h2>
        <p className="text-muted-foreground mt-2">
          Help build the most comprehensive Solana program registry
        </p>
      </div>

      <div className="space-y-4">
        <div className="text-center">
          <h3 className="text-xl font-semibold">Contribute Program Definition</h3>
          <p className="text-muted-foreground">Help the community by contributing program definitions</p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div>
                <label htmlFor="programId" className="block text-sm font-medium mb-2">Program ID *</label>
                <Input
                  id="programId"
                  placeholder="Enter program ID"
                  value={programDefinition.programId}
                  onChange={(e) => setProgramDefinition(prev => ({ ...prev, programId: e.target.value }))}
                  required
                />
              </div>

              <div>
                <label htmlFor="name" className="block text-sm font-medium mb-2">Program Name *</label>
                <Input
                  id="name"
                  placeholder="Enter program name"
                  value={programDefinition.name}
                  onChange={(e) => setProgramDefinition(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium mb-2">Description *</label>
                <textarea
                  id="description"
                  placeholder="Describe what this program does"
                  value={programDefinition.description}
                  onChange={(e) => setProgramDefinition(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full p-2 border rounded-md"
                />
              </div>

              <Button
                onClick={handleSubmitContribution}
                disabled={isSubmitting}
                className="w-full"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Program Definition'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}