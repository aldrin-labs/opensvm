'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { 
  getProgramDefinition, 
  getAllProgramDefinitions, 
  getProgramsByCategory,
  searchPrograms,
  getProgramMetadata,
  getAllInstructionCategories,
  PROGRAM_CATEGORIES,
  RISK_LEVELS
} from '@/lib/solana/program-registry';

// Use the program registry's structure directly
type ProgramDefinition = ReturnType<typeof getProgramDefinition>;

interface ProgramRegistryContextType {
  // Core registry functions
  getProgramDefinition: (programId: string) => ProgramDefinition | undefined;
  getAllProgramDefinitions: () => ProgramDefinition[];
  getProgramsByCategory: (category: string) => ProgramDefinition[];
  searchPrograms: (query: string) => ProgramDefinition[];
  getProgramMetadata: (programId: string) => ReturnType<typeof getProgramMetadata>;
  getAllInstructionCategories: () => string[];
  
  // Constants
  PROGRAM_CATEGORIES: typeof PROGRAM_CATEGORIES;
  RISK_LEVELS: typeof RISK_LEVELS;
  
  // Helper functions
  isKnownProgram: (programId: string) => boolean;
  getProgramDisplayName: (programId: string) => string;
  getProgramCategory: (programId: string) => string;
  getProgramRiskLevel: (programId: string) => 'low' | 'medium' | 'high';
}

const ProgramRegistryContext = createContext<ProgramRegistryContextType | undefined>(undefined);

interface ProgramRegistryProviderProps {
  children: ReactNode;
}

export function ProgramRegistryProvider({ children }: ProgramRegistryProviderProps) {
  // Helper functions
  const isKnownProgram = (programId: string): boolean => {
    return getProgramDefinition(programId) !== undefined;
  };

  const getProgramDisplayName = (programId: string): string => {
    const program = getProgramDefinition(programId);
    return program?.name || `Unknown Program (${programId.slice(0, 8)}...)`;
  };

  const getProgramCategory = (programId: string): string => {
    const program = getProgramDefinition(programId);
    return program?.category || 'unknown';
  };

  const getProgramRiskLevel = (programId: string): 'low' | 'medium' | 'high' => {
    const program = getProgramDefinition(programId);
    if (!program) return 'high'; // Unknown programs are high risk
    
    // Determine overall program risk based on instruction risk levels
    const hasHighRisk = program.instructions.some(ix => ix.riskLevel === 'high');
    const hasMediumRisk = program.instructions.some(ix => ix.riskLevel === 'medium');
    
    if (hasHighRisk) return 'high';
    if (hasMediumRisk) return 'medium';
    return 'low';
  };

  const contextValue: ProgramRegistryContextType = {
    // Core registry functions
    getProgramDefinition,
    getAllProgramDefinitions,
    getProgramsByCategory,
    searchPrograms,
    getProgramMetadata,
    getAllInstructionCategories,
    
    // Constants
    PROGRAM_CATEGORIES,
    RISK_LEVELS,
    
    // Helper functions
    isKnownProgram,
    getProgramDisplayName,
    getProgramCategory,
    getProgramRiskLevel,
  };

  return (
    <ProgramRegistryContext.Provider value={contextValue}>
      {children}
    </ProgramRegistryContext.Provider>
  );
}

export function useProgramRegistry(): ProgramRegistryContextType {
  const context = useContext(ProgramRegistryContext);
  if (context === undefined) {
    throw new Error('useProgramRegistry must be used within a ProgramRegistryProvider');
  }
  return context;
}

// Convenience hook for getting program information
export function useProgramInfo(programId: string) {
  const registry = useProgramRegistry();
  
  const program = registry.getProgramDefinition(programId);
  const metadata = registry.getProgramMetadata(programId);
  const isKnown = registry.isKnownProgram(programId);
  const displayName = registry.getProgramDisplayName(programId);
  const category = registry.getProgramCategory(programId);
  const riskLevel = registry.getProgramRiskLevel(programId);
  
  return {
    program,
    metadata,
    isKnown,
    displayName,
    category,
    riskLevel,
  };
}
