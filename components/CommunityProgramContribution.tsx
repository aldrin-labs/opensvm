'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, CheckCircle, XCircle, Clock, Users, TrendingUp } from 'lucide-react';
import type { CommunityProgramDefinition, DiscoveredProgram, ProgramUsageStats } from '@/lib/dynamic-program-discovery';

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
      programId: 'TrendingProgram11111111111111111111111111',
      name: 'Hot DeFi Protocol',
      category: 'defi',
      trendScore: 95.5,
      stats: {
        totalTransactions: 15000,
        uniqueUsers: 2500,
        userGrowth: 45.2,
        activityTrend: 'increasing' as const
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
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold">Community Program Discovery</h2>
        <p className="text-muted-foreground mt-2">
          Help build the most comprehensive Solana program registry
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="contribute">Contribute</TabsTrigger>
          <TabsTrigger value="community">Community</TabsTrigger>
          <TabsTrigger value="discovered">Discovered</TabsTrigger>
          <TabsTrigger value="trending">Trending</TabsTrigger>
        </TabsList>

        <TabsContent value="contribute" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Contribute Program Definition</CardTitle>
              <CardDescription>
                Help the community by contributing program definitions for unknown or poorly documented programs
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {submitMessage && (
                <Alert className={submitMessage.type === 'success' ? 'border-green-500' : 'border-red-500'}>
                  <AlertDescription>{submitMessage.text}</AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="programId">Program ID *</Label>
                  <Input
                    id="programId"
                    placeholder="Enter Solana program ID"
                    value={programDefinition.programId}
                    onChange={(e) => setProgramDefinition(prev => ({ ...prev, programId: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="category">Category</Label>
                  <Select 
                    value={programDefinition.category} 
                    onValueChange={(value) => setProgramDefinition(prev => ({ ...prev, category: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="system">System</SelectItem>
                      <SelectItem value="token">Token</SelectItem>
                      <SelectItem value="defi">DeFi</SelectItem>
                      <SelectItem value="nft">NFT</SelectItem>
                      <SelectItem value="governance">Governance</SelectItem>
                      <SelectItem value="unknown">Unknown</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="name">Program Name *</Label>
                <Input
                  id="name"
                  placeholder="Enter program name"
                  value={programDefinition.name}
                  onChange={(e) => setProgramDefinition(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div>
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  placeholder="Describe what this program does"
                  value={programDefinition.description}
                  onChange={(e) => setProgramDefinition(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    placeholder="https://example.com"
                    value={programDefinition.website}
                    onChange={(e) => setProgramDefinition(prev => ({ ...prev, website: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="documentation">Documentation</Label>
                  <Input
                    id="documentation"
                    placeholder="https://docs.example.com"
                    value={programDefinition.documentation}
                    onChange={(e) => setProgramDefinition(prev => ({ ...prev, documentation: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-4">
                  <Label>Instructions</Label>
                  <Button onClick={addInstruction} size="sm" variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Instruction
                  </Button>
                </div>

                {programDefinition.instructions.map((instruction, index) => (
                  <Card key={index} className="mb-4">
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-medium">Instruction {index + 1}</h4>
                        {programDefinition.instructions.length > 1 && (
                          <Button 
                            onClick={() => removeInstruction(index)} 
                            size="sm" 
                            variant="destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Discriminator</Label>
                          <Input
                            placeholder="e.g., 01"
                            value={instruction.discriminator}
                            onChange={(e) => updateInstruction(index, 'discriminator', e.target.value)}
                          />
                        </div>
                        <div>
                          <Label>Risk Level</Label>
                          <Select 
                            value={instruction.riskLevel} 
                            onValueChange={(value) => updateInstruction(index, 'riskLevel', value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="low">Low</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="high">High</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="mt-4">
                        <Label>Instruction Name</Label>
                        <Input
                          placeholder="e.g., transfer"
                          value={instruction.name}
                          onChange={(e) => updateInstruction(index, 'name', e.target.value)}
                        />
                      </div>

                      <div className="mt-4">
                        <Label>Description</Label>
                        <Textarea
                          placeholder="Describe what this instruction does"
                          value={instruction.description}
                          onChange={(e) => updateInstruction(index, 'description', e.target.value)}
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Button 
                onClick={handleSubmitContribution} 
                disabled={isSubmitting}
                className="w-full"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Program Definition'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="community" className="space-y-4">
          <div className="text-center mb-6">
            <h3 className="text-xl font-semibold">Community Contributions</h3>
            <p className="text-muted-foreground">Vote on community-submitted program definitions</p>
          </div>

          {communityDefinitions.map((definition) => (
            <Card key={definition.programId}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-semibold">{definition.name}</h4>
                      <Badge variant={
                        definition.status === 'approved' ? 'default' :
                        definition.status === 'rejected' ? 'destructive' : 'secondary'
                      }>
                        {definition.status === 'approved' && <CheckCircle className="h-3 w-3 mr-1" />}
                        {definition.status === 'rejected' && <XCircle className="h-3 w-3 mr-1" />}
                        {definition.status === 'pending' && <Clock className="h-3 w-3 mr-1" />}
                        {definition.status}
                      </Badge>
                      <Badge variant="outline">{definition.category}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{definition.description}</p>
                    <p className="text-xs text-muted-foreground">
                      Program ID: {definition.programId}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Contributed by {definition.contributor} • {definition.instructions.length} instructions
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <div className="text-center">
                      <div className="text-sm font-medium">{definition.votes}</div>
                      <div className="text-xs text-muted-foreground">votes</div>
                    </div>
                    {definition.status === 'pending' && (
                      <div className="flex gap-1">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleVote(definition.programId, 'up')}
                        >
                          👍
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleVote(definition.programId, 'down')}
                        >
                          👎
                        </Button>
                        <Button 
                          size="sm" 
                          variant="destructive"
                          onClick={() => handleVote(definition.programId, 'report')}
                        >
                          🚩
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="discovered" className="space-y-4">
          <div className="text-center mb-6">
            <h3 className="text-xl font-semibold">Auto-Discovered Programs</h3>
            <p className="text-muted-foreground">Programs automatically discovered through transaction analysis</p>
          </div>

          {discoveredPrograms.map((program) => (
            <Card key={program.programId}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-semibold">{program.name}</h4>
                      <Badge variant="outline">{program.category}</Badge>
                      <Badge variant="secondary">
                        {Math.round(program.confidence * 100)}% confidence
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{program.description}</p>
                    <p className="text-xs text-muted-foreground">
                      Program ID: {program.programId}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span>📊 {program.transactionCount.toLocaleString()} transactions</span>
                      <span>👥 {program.uniqueUsers} unique users</span>
                      <span>🔧 {program.instructions.length} instructions</span>
                      <span>🕒 Last seen {new Date(program.lastSeen).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="trending" className="space-y-4">
          <div className="text-center mb-6">
            <h3 className="text-xl font-semibold">Trending Programs</h3>
            <p className="text-muted-foreground">Most popular programs based on usage statistics</p>
          </div>

          {trendingPrograms.map((program, index) => (
            <Card key={program.programId}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="text-2xl font-bold text-muted-foreground">
                      #{index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold">{program.name}</h4>
                        <Badge variant="outline">{program.category}</Badge>
                        <Badge variant="default" className="bg-green-500">
                          <TrendingUp className="h-3 w-3 mr-1" />
                          {program.stats.activityTrend}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Program ID: {program.programId}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span>📊 {program.stats.totalTransactions.toLocaleString()} transactions</span>
                        <span>👥 {program.stats.uniqueUsers.toLocaleString()} users</span>
                        <span>📈 {program.stats.userGrowth.toFixed(1)}% growth</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-lg font-bold text-green-500">
                      {program.trendScore.toFixed(1)}
                    </div>
                    <div className="text-xs text-muted-foreground">trend score</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}