/**
 * Dynamic Program Discovery Service
 * 
 * This service provides automatic program detection, categorization,
 * and community-contributed program definitions. It extends the static
 * program registry with dynamic discovery capabilities.
 */

import type { ProgramDefinition } from './instruction-parser-service';
import { 
  getAllProgramDefinitions, 
  getProgramDefinition,
  validateProgramDefinition 
} from './program-registry';

/**
 * Interface for discovered program information
 */
export interface DiscoveredProgram {
  programId: string;
  name?: string;
  description?: string;
  category: string;
  confidence: number; // 0-1 confidence score
  discoveryMethod: 'heuristic' | 'community' | 'usage_pattern' | 'metadata';
  firstSeen: number; // timestamp
  lastSeen: number; // timestamp
  transactionCount: number;
  uniqueUsers: number;
  instructions: DiscoveredInstruction[];
  metadata?: {
    website?: string;
    documentation?: string;
    github?: string;
    twitter?: string;
  };
}

/**
 * Interface for discovered instruction information
 */
export interface DiscoveredInstruction {
  discriminator: string;
  name?: string;
  description?: string;
  category: string;
  frequency: number; // how often this instruction is used
  riskLevel: 'low' | 'medium' | 'high';
  accounts: DiscoveredAccount[];
  parameters: DiscoveredParameter[];
}

/**
 * Interface for discovered account patterns
 */
export interface DiscoveredAccount {
  index: number;
  role: string;
  description?: string;
  isSigner: boolean;
  isWritable: boolean;
  frequency: number; // how often this account pattern appears
}

/**
 * Interface for discovered parameter patterns
 */
export interface DiscoveredParameter {
  name?: string;
  type: string;
  description?: string;
  frequency: number;
}

/**
 * Interface for community-contributed program definitions
 */
export interface CommunityProgramDefinition extends ProgramDefinition {
  contributor: string;
  contributedAt: number;
  verified: boolean;
  votes: number;
  reports: number;
  status: 'pending' | 'approved' | 'rejected';
}

/**
 * Interface for program usage statistics
 */
export interface ProgramUsageStats {
  programId: string;
  totalTransactions: number;
  uniqueUsers: number;
  dailyTransactions: number[];
  popularInstructions: Array<{
    discriminator: string;
    name?: string;
    count: number;
    percentage: number;
  }>;
  userGrowth: number; // percentage growth in unique users
  activityTrend: 'increasing' | 'stable' | 'decreasing';
  lastUpdated: number;
}

/**
 * Dynamic Program Discovery Service
 */
export class DynamicProgramDiscoveryService {
  private discoveredPrograms: Map<string, DiscoveredProgram> = new Map();
  private communityDefinitions: Map<string, CommunityProgramDefinition> = new Map();
  private usageStats: Map<string, ProgramUsageStats> = new Map();
  private discoveryRules: ProgramDiscoveryRule[] = [];

  constructor() {
    this.initializeDiscoveryRules();
  }

  /**
   * Discover program information from transaction data
   */
  async discoverProgram(
    programId: string,
    transactionData: any[]
  ): Promise<DiscoveredProgram | null> {
    // Check if program is already in static registry
    const staticProgram = getProgramDefinition(programId);
    if (staticProgram) {
      return this.convertStaticToDiscovered(staticProgram);
    }

    // Check if already discovered
    const existing = this.discoveredPrograms.get(programId);
    if (existing) {
      return this.updateDiscoveredProgram(existing, transactionData);
    }

    // Perform discovery analysis
    const discovered = await this.analyzeUnknownProgram(programId, transactionData);
    if (discovered) {
      this.discoveredPrograms.set(programId, discovered);
    }

    return discovered;
  }

  /**
   * Add community-contributed program definition
   */
  async addCommunityDefinition(
    definition: Omit<CommunityProgramDefinition, 'contributedAt' | 'verified' | 'votes' | 'reports' | 'status'>,
    contributor: string
  ): Promise<{ success: boolean; error?: string }> {
    // Validate the definition
    const validation = validateProgramDefinition(definition);
    if (!validation.isValid) {
      return {
        success: false,
        error: `Invalid program definition: ${validation.errors.join(', ')}`
      };
    }

    // Check for duplicates
    if (this.communityDefinitions.has(definition.programId)) {
      return {
        success: false,
        error: 'Program definition already exists'
      };
    }

    // Create community definition
    const communityDef: CommunityProgramDefinition = {
      ...definition,
      contributor,
      contributedAt: Date.now(),
      verified: false,
      votes: 0,
      reports: 0,
      status: 'pending'
    };

    this.communityDefinitions.set(definition.programId, communityDef);

    return { success: true };
  }

  /**
   * Vote on community-contributed definition
   */
  async voteOnCommunityDefinition(
    programId: string,
    vote: 'up' | 'down' | 'report',
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    const definition = this.communityDefinitions.get(programId);
    if (!definition) {
      return {
        success: false,
        error: 'Community definition not found'
      };
    }

    // Update votes/reports
    switch (vote) {
      case 'up':
        definition.votes++;
        break;
      case 'down':
        definition.votes--;
        break;
      case 'report':
        definition.reports++;
        break;
    }

    // Auto-approve if enough positive votes
    if (definition.votes >= 5 && definition.reports < 2) {
      definition.status = 'approved';
      definition.verified = true;
    }

    // Auto-reject if too many reports
    if (definition.reports >= 3) {
      definition.status = 'rejected';
    }

    return { success: true };
  }

  /**
   * Get program usage statistics
   */
  async getProgramUsageStats(programId: string): Promise<ProgramUsageStats | null> {
    return this.usageStats.get(programId) || null;
  }

  /**
   * Update program usage statistics
   */
  async updateProgramUsageStats(
    programId: string,
    transactionData: any[]
  ): Promise<void> {
    const existing = this.usageStats.get(programId);
    const now = Date.now();

    // Analyze transaction data
    const uniqueUsers = new Set(transactionData.map(tx => tx.feePayer || tx.signer)).size;
    const totalTransactions = transactionData.length;
    
    // Analyze instruction usage
    const instructionCounts: Record<string, number> = {};
    transactionData.forEach(tx => {
      tx.instructions?.forEach((ix: any) => {
        if (ix.programId === programId) {
          const discriminator = this.extractDiscriminator(ix.data);
          instructionCounts[discriminator] = (instructionCounts[discriminator] || 0) + 1;
        }
      });
    });

    const popularInstructions = Object.entries(instructionCounts)
      .map(([discriminator, count]) => ({
        discriminator,
        name: this.getInstructionName(programId, discriminator),
        count,
        percentage: (count / totalTransactions) * 100
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Calculate growth and trend
    const userGrowth = existing 
      ? ((uniqueUsers - existing.uniqueUsers) / existing.uniqueUsers) * 100
      : 0;

    const activityTrend = this.calculateActivityTrend(existing, totalTransactions);

    const stats: ProgramUsageStats = {
      programId,
      totalTransactions,
      uniqueUsers,
      dailyTransactions: this.calculateDailyTransactions(transactionData),
      popularInstructions,
      userGrowth,
      activityTrend,
      lastUpdated: now
    };

    this.usageStats.set(programId, stats);
  }

  /**
   * Get trending programs based on usage statistics
   */
  async getTrendingPrograms(limit: number = 10): Promise<Array<{
    programId: string;
    name?: string;
    category: string;
    stats: ProgramUsageStats;
    trendScore: number;
  }>> {
    const allStats = Array.from(this.usageStats.values());
    
    return allStats
      .map(stats => {
        const program = this.getProgram(stats.programId);
        const trendScore = this.calculateTrendScore(stats);
        
        return {
          programId: stats.programId,
          name: program?.name,
          category: program?.category || 'unknown',
          stats,
          trendScore
        };
      })
      .sort((a, b) => b.trendScore - a.trendScore)
      .slice(0, limit);
  }

  /**
   * Get all discovered programs
   */
  getAllDiscoveredPrograms(): DiscoveredProgram[] {
    return Array.from(this.discoveredPrograms.values());
  }

  /**
   * Get community definitions by status
   */
  getCommunityDefinitions(status?: 'pending' | 'approved' | 'rejected'): CommunityProgramDefinition[] {
    const definitions = Array.from(this.communityDefinitions.values());
    return status ? definitions.filter(def => def.status === status) : definitions;
  }

  /**
   * Search discovered programs
   */
  searchDiscoveredPrograms(query: string): DiscoveredProgram[] {
    const lowercaseQuery = query.toLowerCase();
    return this.getAllDiscoveredPrograms().filter(program =>
      program.name?.toLowerCase().includes(lowercaseQuery) ||
      program.description?.toLowerCase().includes(lowercaseQuery) ||
      program.programId.includes(query)
    );
  }

  /**
   * Export discovery data
   */
  exportDiscoveryData(): {
    discoveredPrograms: DiscoveredProgram[];
    communityDefinitions: CommunityProgramDefinition[];
    usageStats: ProgramUsageStats[];
    timestamp: number;
  } {
    return {
      discoveredPrograms: this.getAllDiscoveredPrograms(),
      communityDefinitions: this.getCommunityDefinitions(),
      usageStats: Array.from(this.usageStats.values()),
      timestamp: Date.now()
    };
  }

  /**
   * Private helper methods
   */

  private initializeDiscoveryRules(): void {
    this.discoveryRules = [
      // DeFi program detection rules
      {
        name: 'DeFi Swap Detection',
        category: 'defi',
        confidence: 0.8,
        matcher: (programId: string, instructions: any[]) => {
          const hasSwapInstructions = instructions.some(ix => 
            ix.data && (
              ix.data.includes('swap') ||
              ix.data.includes('exchange') ||
              ix.accounts?.length >= 4 // Typical swap instruction has multiple accounts
            )
          );
          return hasSwapInstructions;
        }
      },
      {
        name: 'NFT Program Detection',
        category: 'nft',
        confidence: 0.7,
        matcher: (programId: string, instructions: any[]) => {
          const hasNFTPatterns = instructions.some(ix =>
            ix.data && (
              ix.data.includes('mint') ||
              ix.data.includes('metadata') ||
              ix.data.includes('collection')
            )
          );
          return hasNFTPatterns;
        }
      },
      {
        name: 'Governance Program Detection',
        category: 'governance',
        confidence: 0.9,
        matcher: (programId: string, instructions: any[]) => {
          const hasGovernancePatterns = instructions.some(ix =>
            ix.data && (
              ix.data.includes('vote') ||
              ix.data.includes('proposal') ||
              ix.data.includes('governance')
            )
          );
          return hasGovernancePatterns;
        }
      }
    ];
  }

  private async analyzeUnknownProgram(
    programId: string,
    transactionData: any[]
  ): Promise<DiscoveredProgram | null> {
    if (transactionData.length === 0) return null;

    // Extract instructions for this program
    const programInstructions = transactionData.flatMap(tx =>
      tx.instructions?.filter((ix: any) => ix.programId === programId) || []
    );

    if (programInstructions.length === 0) return null;

    // Apply discovery rules
    let bestMatch: { category: string; confidence: number } = {
      category: 'unknown',
      confidence: 0
    };

    for (const rule of this.discoveryRules) {
      if (rule.matcher(programId, programInstructions)) {
        if (rule.confidence > bestMatch.confidence) {
          bestMatch = {
            category: rule.category,
            confidence: rule.confidence
          };
        }
      }
    }

    // Analyze instruction patterns
    const discoveredInstructions = this.analyzeInstructionPatterns(programInstructions);

    // Create discovered program
    const discovered: DiscoveredProgram = {
      programId,
      name: this.generateProgramName(programId, bestMatch.category),
      description: this.generateProgramDescription(programId, bestMatch.category),
      category: bestMatch.category,
      confidence: bestMatch.confidence,
      discoveryMethod: 'heuristic',
      firstSeen: Date.now(),
      lastSeen: Date.now(),
      transactionCount: transactionData.length,
      uniqueUsers: new Set(transactionData.map(tx => tx.feePayer || tx.signer)).size,
      instructions: discoveredInstructions
    };

    return discovered;
  }

  private analyzeInstructionPatterns(instructions: any[]): DiscoveredInstruction[] {
    const instructionMap: Map<string, {
      discriminator: string;
      occurrences: any[];
    }> = new Map();

    // Group instructions by discriminator
    instructions.forEach(ix => {
      const discriminator = this.extractDiscriminator(ix.data);
      if (!instructionMap.has(discriminator)) {
        instructionMap.set(discriminator, {
          discriminator,
          occurrences: []
        });
      }
      instructionMap.get(discriminator)!.occurrences.push(ix);
    });

    // Analyze each instruction type
    return Array.from(instructionMap.values()).map(({ discriminator, occurrences }) => {
      const frequency = occurrences.length;
      const accountPatterns = this.analyzeAccountPatterns(occurrences);
      const parameterPatterns = this.analyzeParameterPatterns(occurrences);

      return {
        discriminator,
        name: this.generateInstructionName(discriminator),
        description: this.generateInstructionDescription(discriminator),
        category: this.categorizeInstruction(discriminator, occurrences),
        frequency,
        riskLevel: this.assessInstructionRisk(occurrences),
        accounts: accountPatterns,
        parameters: parameterPatterns
      };
    });
  }

  private analyzeAccountPatterns(instructions: any[]): DiscoveredAccount[] {
    const accountPatterns: Map<number, {
      index: number;
      signerCount: number;
      writableCount: number;
      total: number;
    }> = new Map();

    instructions.forEach(ix => {
      ix.accounts?.forEach((account: any, index: number) => {
        if (!accountPatterns.has(index)) {
          accountPatterns.set(index, {
            index,
            signerCount: 0,
            writableCount: 0,
            total: 0
          });
        }
        const pattern = accountPatterns.get(index)!;
        pattern.total++;
        if (account.isSigner) pattern.signerCount++;
        if (account.isWritable) pattern.writableCount++;
      });
    });

    return Array.from(accountPatterns.values()).map(pattern => ({
      index: pattern.index,
      role: this.inferAccountRole(pattern),
      description: `Account ${pattern.index}`,
      isSigner: pattern.signerCount > pattern.total / 2,
      isWritable: pattern.writableCount > pattern.total / 2,
      frequency: pattern.total
    }));
  }

  private analyzeParameterPatterns(instructions: any[]): DiscoveredParameter[] {
    // Simplified parameter analysis
    const hasData = instructions.some(ix => ix.data && ix.data.length > 8);
    
    if (!hasData) return [];

    return [
      {
        name: 'data',
        type: 'bytes',
        description: 'Instruction data',
        frequency: instructions.length
      }
    ];
  }

  private convertStaticToDiscovered(staticProgram: ProgramDefinition): DiscoveredProgram {
    return {
      programId: staticProgram.programId,
      name: staticProgram.name,
      description: staticProgram.description,
      category: staticProgram.category,
      confidence: 1.0,
      discoveryMethod: 'metadata',
      firstSeen: 0, // Static programs are always known
      lastSeen: Date.now(),
      transactionCount: 0,
      uniqueUsers: 0,
      instructions: staticProgram.instructions.map(ix => ({
        discriminator: ix.discriminator,
        name: ix.name,
        description: ix.description,
        category: ix.category,
        frequency: 0,
        riskLevel: ix.riskLevel,
        accounts: ix.accounts.map((acc, index) => ({
          index,
          role: acc.role,
          description: acc.description,
          isSigner: acc.isSigner,
          isWritable: acc.isWritable,
          frequency: 0
        })),
        parameters: ix.parameters.map(param => ({
          name: param.name,
          type: param.type,
          description: param.description,
          frequency: 0
        }))
      })),
      metadata: {
        website: staticProgram.website,
        documentation: staticProgram.documentation
      }
    };
  }

  private updateDiscoveredProgram(
    existing: DiscoveredProgram,
    transactionData: any[]
  ): DiscoveredProgram {
    return {
      ...existing,
      lastSeen: Date.now(),
      transactionCount: existing.transactionCount + transactionData.length,
      uniqueUsers: existing.uniqueUsers + new Set(transactionData.map(tx => tx.feePayer || tx.signer)).size
    };
  }

  private extractDiscriminator(data: string | Buffer): string {
    if (!data) return '00';
    const dataStr = typeof data === 'string' ? data : data.toString('hex');
    return dataStr.slice(0, 16).padEnd(16, '0');
  }

  private getInstructionName(programId: string, discriminator: string): string | undefined {
    const program = this.getProgram(programId);
    return program?.instructions.find(ix => ix.discriminator === discriminator)?.name;
  }

  private getProgram(programId: string): ProgramDefinition | DiscoveredProgram | undefined {
    return getProgramDefinition(programId) || this.discoveredPrograms.get(programId);
  }

  private generateProgramName(programId: string, category: string): string {
    const shortId = programId.slice(0, 8);
    const categoryName = category.charAt(0).toUpperCase() + category.slice(1);
    return `${categoryName} Program ${shortId}`;
  }

  private generateProgramDescription(programId: string, category: string): string {
    const descriptions: Record<string, string> = {
      defi: 'Decentralized finance protocol',
      nft: 'Non-fungible token program',
      governance: 'Governance and voting program',
      unknown: 'Unknown program'
    };
    return descriptions[category] || descriptions.unknown;
  }

  private generateInstructionName(discriminator: string): string {
    return `instruction_${discriminator}`;
  }

  private generateInstructionDescription(discriminator: string): string {
    return `Instruction with discriminator ${discriminator}`;
  }

  private categorizeInstruction(discriminator: string, occurrences: any[]): string {
    // Simple heuristic categorization
    if (occurrences.some(ix => ix.accounts?.length >= 4)) return 'complex';
    if (occurrences.some(ix => ix.accounts?.some((acc: any) => acc.isWritable))) return 'state_change';
    return 'query';
  }

  private assessInstructionRisk(occurrences: any[]): 'low' | 'medium' | 'high' {
    const hasWritableAccounts = occurrences.some(ix => 
      ix.accounts?.some((acc: any) => acc.isWritable)
    );
    const hasMultipleSigners = occurrences.some(ix =>
      ix.accounts?.filter((acc: any) => acc.isSigner).length > 1
    );
    const hasLargeData = occurrences.some(ix => ix.data && ix.data.length > 100);

    if (hasMultipleSigners || hasLargeData) return 'high';
    if (hasWritableAccounts) return 'medium';
    return 'low';
  }

  private inferAccountRole(pattern: {
    index: number;
    signerCount: number;
    writableCount: number;
    total: number;
  }): string {
    const signerRatio = pattern.signerCount / pattern.total;
    const writableRatio = pattern.writableCount / pattern.total;

    if (signerRatio > 0.8) return 'authority';
    if (writableRatio > 0.8) return 'recipient';
    if (pattern.index === 0) return 'payer';
    return 'unknown';
  }

  private calculateDailyTransactions(transactionData: any[]): number[] {
    // Simplified daily transaction calculation
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const days = 7; // Last 7 days
    
    const dailyCounts = new Array(days).fill(0);
    
    transactionData.forEach(tx => {
      const txTime = tx.blockTime * 1000; // Convert to milliseconds
      const dayIndex = Math.floor((now - txTime) / oneDayMs);
      if (dayIndex >= 0 && dayIndex < days) {
        dailyCounts[days - 1 - dayIndex]++;
      }
    });
    
    return dailyCounts;
  }

  private calculateActivityTrend(
    existing: ProgramUsageStats | undefined,
    currentTransactions: number
  ): 'increasing' | 'stable' | 'decreasing' {
    if (!existing) return 'stable';
    
    const change = currentTransactions - existing.totalTransactions;
    const changePercent = (change / existing.totalTransactions) * 100;
    
    if (changePercent > 10) return 'increasing';
    if (changePercent < -10) return 'decreasing';
    return 'stable';
  }

  private calculateTrendScore(stats: ProgramUsageStats): number {
    let score = 0;
    
    // Base score from transaction volume
    score += Math.log10(stats.totalTransactions + 1) * 10;
    
    // User growth bonus
    if (stats.userGrowth > 0) {
      score += stats.userGrowth * 2;
    }
    
    // Activity trend bonus
    switch (stats.activityTrend) {
      case 'increasing':
        score += 20;
        break;
      case 'stable':
        score += 5;
        break;
      case 'decreasing':
        score -= 10;
        break;
    }
    
    // Recent activity bonus
    const daysSinceUpdate = (Date.now() - stats.lastUpdated) / (24 * 60 * 60 * 1000);
    if (daysSinceUpdate < 1) {
      score += 10;
    }
    
    return Math.max(0, score);
  }
}

/**
 * Interface for program discovery rules
 */
interface ProgramDiscoveryRule {
  name: string;
  category: string;
  confidence: number;
  matcher: (programId: string, instructions: any[]) => boolean;
}

/**
 * Singleton instance of the discovery service
 */
export const dynamicProgramDiscovery = new DynamicProgramDiscoveryService();