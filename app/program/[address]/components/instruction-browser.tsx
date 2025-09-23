'use client';

import React, { useState, useMemo } from 'react';
import { useProgramInfo } from '@/contexts/ProgramRegistryContext';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { 
  AlertTriangle, 
  Info,
  CheckCircle,
  Box,
  Code,
  ExternalLink
} from 'lucide-react';

interface InstructionBrowserProps {
  programId: string;
}

const InstructionBrowser: React.FC<InstructionBrowserProps> = ({ programId }) => {
  const { program, metadata, isKnown, displayName, category, riskLevel } = useProgramInfo(programId);
  const [expandedInstructions, setExpandedInstructions] = useState<Set<string>>(new Set());
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedRiskLevel, setSelectedRiskLevel] = useState<string>('all');

  const toggleInstruction = (instructionName: string) => {
    const newExpanded = new Set(expandedInstructions);
    if (newExpanded.has(instructionName)) {
      newExpanded.delete(instructionName);
    } else {
      newExpanded.add(instructionName);
    }
    setExpandedInstructions(newExpanded);
  };

  // Filter instructions based on selected filters
  const filteredInstructions = useMemo(() => {
    if (!program) return [];
    
    return program.instructions.filter(instruction => {
      const categoryMatch = selectedCategory === 'all' || instruction.category === selectedCategory;
      const riskMatch = selectedRiskLevel === 'all' || instruction.riskLevel === selectedRiskLevel;
      return categoryMatch && riskMatch;
    });
  }, [program, selectedCategory, selectedRiskLevel]);

  // Get unique categories and risk levels for filters
  const availableCategories = useMemo(() => {
    if (!program) return [];
    return [...new Set(program.instructions.map(ix => ix.category))].sort();
  }, [program]);

  const availableRiskLevels = useMemo(() => {
    if (!program) return [];
    return [...new Set(program.instructions.map(ix => ix.riskLevel))].sort();
  }, [program]);

  const getRiskIcon = (risk: string) => {
    switch (risk) {
      case 'low': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'medium': return <Info className="w-4 h-4 text-yellow-500" />;
      case 'high': return <AlertTriangle className="w-4 h-4 text-red-500" />;
      default: return <Info className="w-4 h-4 text-gray-500" />;
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'text-green-500 bg-green-500/10 border-green-500/20';
      case 'medium': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
      case 'high': return 'text-red-500 bg-red-500/10 border-red-500/20';
      default: return 'text-gray-500 bg-gray-500/10 border-gray-500/20';
    }
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'account': return <Box className="w-4 h-4" />;
      case 'transfer': return <Code className="w-4 h-4" />;
      case 'swap': return <Code className="w-4 h-4" />;
      case 'mint': return <Box className="w-4 h-4" />;
      default: return <Code className="w-4 h-4" />;
    }
  };

  if (!isKnown) {
    return (
      <div className="p-6 text-center">
        <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-2">Unknown Program</h3>
        <p className="text-muted-foreground mb-4">
          This program is not in our registry. The IDL interface is not available.
        </p>
        <div className="bg-muted border border-border rounded-lg p-4 text-left">
          <div className="text-sm text-muted-foreground mb-1">Program ID</div>
          <div className="font-mono break-all text-foreground">{programId}</div>
        </div>
      </div>
    );
  }

  if (!program) {
    return (
      <div className="p-6 text-center">
        <div className="text-muted-foreground">Loading program information...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Program Overview */}
      <div className="bg-background border border-border rounded-lg p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-foreground">{program.name}</h2>
            <p className="text-muted-foreground mt-1">{program.description}</p>
          </div>
          <div className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${getRiskColor(riskLevel)}`}>
            {getRiskIcon(riskLevel)}
            <span className="ml-1 capitalize">{riskLevel} Risk</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <div className="text-sm text-muted-foreground mb-1">Category</div>
            <div className="capitalize text-foreground">{category}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground mb-1">Instructions</div>
            <div className="text-foreground">{program.instructions.length}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground mb-1">Program ID</div>
            <div className="font-mono text-xs text-foreground">{programId}</div>
          </div>
        </div>

        {/* Links */}
        {(program.website || program.documentation) && (
          <div className="flex gap-3 pt-3 border-t border-border">
            {program.website && (
                <a
                  href={program.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-sm text-blue-500 hover:text-blue-400"
                >
                  <ExternalLink className="w-4 h-4 mr-1" />
                  Website
                </a>
            )}
            {program.documentation && (
                <a
                  href={program.documentation}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-sm text-blue-500 hover:text-blue-400"
                >
                  <Code className="w-4 h-4 mr-1" />
                  Documentation
                </a>
            )}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="bg-background border border-border rounded-lg p-4">
        <h3 className="text-sm font-medium text-foreground mb-3">Filter Instructions</h3>
        <div className="flex gap-4">
          <div>
            <label className="text-xs text-muted-foreground">Category</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="block w-full mt-1 text-sm border border-border rounded-md bg-background text-foreground px-3 py-1"
            >
              <option value="all">All Categories</option>
              {availableCategories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Risk Level</label>
            <select
              value={selectedRiskLevel}
              onChange={(e) => setSelectedRiskLevel(e.target.value)}
              className="block w-full mt-1 text-sm border border-border rounded-md bg-background text-foreground px-3 py-1"
            >
              <option value="all">All Risk Levels</option>
              {availableRiskLevels.map(risk => (
                <option key={risk} value={risk}>{risk}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Instructions List */}
      <div className="bg-background border border-border rounded-lg">
        <div className="p-4 border-b border-border">
          <h3 className="text-lg font-semibold text-foreground">
            Instructions ({filteredInstructions.length})
          </h3>
        </div>
        
        <div className="divide-y divide-border">
          {filteredInstructions.map((instruction) => {
            const isExpanded = expandedInstructions.has(instruction.name);
            
            return (
              <div key={instruction.name} className="p-4">
                <button
                  onClick={() => toggleInstruction(instruction.name)}
                  className="flex items-center justify-between w-full text-left hover:bg-muted/50 rounded-lg p-2 -m-2"
                >
                  <div className="flex items-center space-x-3">
                    {isExpanded ? (
                      <ChevronDown className="w-5 h-5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    )}
                    <div className="flex items-center space-x-2">
                      {getCategoryIcon(instruction.category)}
                      <span className="font-medium text-foreground">{instruction.name}</span>
                    </div>
                    <div className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium border ${getRiskColor(instruction.riskLevel)}`}>
                      {getRiskIcon(instruction.riskLevel)}
                      <span className="ml-1 capitalize">{instruction.riskLevel}</span>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground capitalize">
                    {instruction.category}
                  </div>
                </button>

                {isExpanded && (
                  <div className="mt-4 ml-8 space-y-4">
                    <p className="text-muted-foreground">{instruction.description}</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="text-sm font-medium text-foreground mb-2">Discriminator</h4>
                        <div className="font-mono text-sm bg-muted rounded px-2 py-1">
                          {instruction.discriminator}
                        </div>
                      </div>
                    </div>

                    {/* Accounts */}
                    {instruction.accounts && instruction.accounts.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-foreground mb-2">Accounts</h4>
                        <div className="space-y-2">
                          {instruction.accounts.map((account, idx) => (
                            <div key={idx} className="bg-muted rounded-lg p-3">
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-foreground">{account.name}</span>
                                <div className="flex items-center space-x-2 text-xs">
                                  {account.isSigner && (
                                    <span className="bg-blue-500/20 text-blue-400 px-2 py-1 rounded">Signer</span>
                                  )}
                                  {account.isWritable && (
                                    <span className="bg-orange-500/20 text-orange-400 px-2 py-1 rounded">Writable</span>
                                  )}
                                  <span className="bg-gray-500/20 text-gray-400 px-2 py-1 rounded capitalize">
                                    {account.role}
                                  </span>
                                </div>
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">{account.description}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Parameters */}
                    {instruction.parameters && instruction.parameters.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-foreground mb-2">Parameters</h4>
                        <div className="space-y-2">
                          {instruction.parameters.map((param, idx) => (
                            <div key={idx} className="bg-muted rounded-lg p-3">
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-foreground">{param.name}</span>
                                <div className="flex items-center space-x-2 text-xs">
                                  <span className="bg-green-500/20 text-green-400 px-2 py-1 rounded">
                                    {param.type}
                                  </span>
                                  {param.optional && (
                                    <span className="bg-gray-500/20 text-gray-400 px-2 py-1 rounded">Optional</span>
                                  )}
                                </div>
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">{param.description}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {filteredInstructions.length === 0 && (
          <div className="p-8 text-center">
            <Code className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No Instructions Found</h3>
            <p className="text-muted-foreground">
              No instructions match the selected filters.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default InstructionBrowser;
