'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, CheckCircle, XCircle, Clock, TrendingUp } from 'lucide-react';
import type { CommunityProgramDefinition, DiscoveredProgram } from '@/lib/dynamic-program-discovery';

interface CommunityProgramContributionProps {
  onContribute?: (definition: any) => void;
  onVote?: (programId: string, vote: 'up' | 'down' | 'report') => void;
}

export function CommunityProgramContribution({
  onContribute,
  onVote
}: CommunityProgramContributionProps) {
  const [activeTab, setActiveTab] = useState('contribute');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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

  // Mock data for demonstration
  const [communityDefinitions] = useState<CommunityProgramDefinition[]>([
    {
      programId: 'ExampleProgram1111111111111111111111111',
      name: 'Example DeFi Protocol',
      description: 'A community-contributed DeFi protocol definition',
      category: 'defi',
      contributor: 'user123',
      contributedAt: Date.now() - 86400000,
      verified: false,
      votes: 3,
      reports: 0,
      status: 'pending',
      instructions: [
        {
          discriminator: '01',
          name: 'swap',
          description: 'Swap tokens',
          category: 'swap',
          riskLevel: 'medium',
          accounts: [],
          parameters: []
        }
      ]
    }
  ]);

  const [discoveredPrograms] = useState<DiscoveredProgram[]>([
    {
      programId: 'DiscoveredProgram111111111111111111111111',
      name: 'Auto-Discovered NFT Program',
      description: 'Automatically discovered NFT minting program',
      category: 'nft',
      confidence: 0.85,
      discoveryMethod: 'heuristic',
      firstSeen: Date.now() - 172800000,
      lastSeen: Date.now() - 3600000,
      transactionCount: 1250,
      uniqueUsers: 89,
      instructions: [
        {
          discriminator: '01',
          name: 'mint_nft',
          description: 'Mint new NFT',
          category: 'mint',
          frequency: 1250,
          riskLevel: 'medium',
          accounts: [],
          parameters: []
        }
      ]
    }
  ]);

  const [trendingPrograms] = useState([
    {
      programId: 'TrendingProgram111111111111111111111111',
      name: 'Popular DeFi Protocol',
      description: 'High-usage DeFi protocol',
      category: 'defi',
      trendScore: 95.5,
      stats: {
        totalTransactions: 50000,
        uniqueUsers: 2500,
        userGrowth: 15.2,
        activityTrend: 'rising'
      }
    }
  ]);

  const handleSubmitContribution = async () => {
    setIsSubmitting(true);
    setSubmitMessage(null);

    try {
      // Validate form
      if (!programDefinition.programId || !programDefinition.name || !programDefinition.description) {
        throw new Error('Please fill in all required fields');
      }

      // Submit to API
      const response = await fetch('/api/program-discovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'contribute',
          data: {
            programDefinition,
            contributor: 'current_user' // In real app, get from auth
          }
        })
      });

      const result = await response.json();

      if (result.success) {
        setSubmitMessage({ type: 'success', text: 'Program definition submitted successfully!' });
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
              riskLevel: 'low',
              accounts: [],
              parameters: []
            }
          ]
        });
      } else {
        throw new Error(result.error?.message || 'Submission failed');
      }
    } catch (error) {
      setSubmitMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'An error occurred'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVote = async (programId: string, vote: 'up' | 'down' | 'report') => {
    try {
      const response = await fetch('/api/program-discovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'vote',
          data: {
            programId,
            vote,
            userId: 'current_user' // In real app, get from auth
          }
        })
      });

      const result = await response.json();
      if (result.success) {
        onVote?.(programId, vote);
      }
    } catch (error) {
      console.error('Vote failed:', error);
    }
  };

  const addInstruction = () => {
    setProgramDefinition(prev => ({
      ...prev,
      instructions: [
        ...prev.instructions,
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
    }));
  };

  const removeInstruction = (index: number) => {
    setProgramDefinition(prev => ({
      ...prev,
      instructions: prev.instructions.filter((_, i) => i !== index)
    }));
  };

  const updateInstruction = (index: number, field: string, value: any) => {
    setProgramDefinition(prev => ({
      ...prev,
      instructions: prev.instructions.map((inst, i) =>
        i === index ? { ...inst, [field]: value } : inst
      )
    }));
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