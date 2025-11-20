import { NextRequest, NextResponse } from 'next/server';
import { 
  getAllProgramDefinitions, 
  getProgramDefinition, 
  getProgramsByCategory,
  searchPrograms,
  getProgramRegistryStats,
  getProgramsWithInstructionType,
  getAllInstructionCategories,
  getProgramsByRiskLevel,
  getInstructionDefinition,
  isProgramHighRisk,
  getSimilarPrograms,
  getProgramMetadata,
  exportProgramRegistry,
  PROGRAM_CATEGORIES,
  RISK_LEVELS
} from '@/lib/solana/program-registry';

/**
 * GET /api/program-registry
 * 
 * Query parameters:
 * - action: 'list' | 'search' | 'stats' | 'categories' | 'export'
 * - programId: specific program ID to get details
 * - category: filter by category
 * - riskLevel: filter by risk level
 * - instructionType: filter by instruction type
 * - query: search query
 * - similar: get similar programs to specified programId
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'list';
    const programId = searchParams.get('programId');
    const category = searchParams.get('category');
    const riskLevel = searchParams.get('riskLevel') as 'low' | 'medium' | 'high' | null;
    const instructionType = searchParams.get('instructionType');
    const query = searchParams.get('query');
    const similar = searchParams.get('similar');

    switch (action) {
      case 'list':
        if (programId) {
          // Get specific program
          const program = getProgramDefinition(programId);
          if (!program) {
            return NextResponse.json(
              { success: false, error: { code: 'PROGRAM_NOT_FOUND', message: 'Program not found' } },
              { status: 404 }
            );
          }
          return NextResponse.json({
            success: true,
            data: program,
            timestamp: Date.now()
          });
        } else if (category) {
          // Get programs by category
          const programs = getProgramsByCategory(category);
          return NextResponse.json({
            success: true,
            data: programs,
            count: programs.length,
            timestamp: Date.now()
          });
        } else if (riskLevel) {
          // Get programs by risk level
          const programs = getProgramsByRiskLevel(riskLevel);
          return NextResponse.json({
            success: true,
            data: programs,
            count: programs.length,
            timestamp: Date.now()
          });
        } else if (instructionType) {
          // Get programs with specific instruction type
          const programs = getProgramsWithInstructionType(instructionType);
          return NextResponse.json({
            success: true,
            data: programs,
            count: programs.length,
            timestamp: Date.now()
          });
        } else {
          // Get all programs
          const programs = getAllProgramDefinitions();
          return NextResponse.json({
            success: true,
            data: programs,
            count: programs.length,
            timestamp: Date.now()
          });
        }

      case 'search':
        if (!query) {
          return NextResponse.json(
            { success: false, error: { code: 'MISSING_QUERY', message: 'Search query is required' } },
            { status: 400 }
          );
        }
        const searchResults = searchPrograms(query);
        return NextResponse.json({
          success: true,
          data: searchResults,
          count: searchResults.length,
          query,
          timestamp: Date.now()
        });

      case 'stats':
        const stats = getProgramRegistryStats();
        return NextResponse.json({
          success: true,
          data: stats,
          timestamp: Date.now()
        });

      case 'categories':
        const categories = getAllInstructionCategories();
        return NextResponse.json({
          success: true,
          data: {
            programCategories: PROGRAM_CATEGORIES,
            instructionCategories: categories,
            riskLevels: RISK_LEVELS
          },
          timestamp: Date.now()
        });

      case 'similar':
        if (!similar) {
          return NextResponse.json(
            { success: false, error: { code: 'MISSING_PROGRAM_ID', message: 'Program ID is required for similar programs' } },
            { status: 400 }
          );
        }
        const similarPrograms = getSimilarPrograms(similar);
        return NextResponse.json({
          success: true,
          data: similarPrograms,
          count: similarPrograms.length,
          programId: similar,
          timestamp: Date.now()
        });

      case 'metadata':
        if (!programId) {
          return NextResponse.json(
            { success: false, error: { code: 'MISSING_PROGRAM_ID', message: 'Program ID is required for metadata' } },
            { status: 400 }
          );
        }
        const metadata = getProgramMetadata(programId);
        if (!metadata) {
          return NextResponse.json(
            { success: false, error: { code: 'PROGRAM_NOT_FOUND', message: 'Program not found' } },
            { status: 404 }
          );
        }
        return NextResponse.json({
          success: true,
          data: metadata,
          timestamp: Date.now()
        });

      case 'export':
        const exportData = exportProgramRegistry();
        return NextResponse.json({
          success: true,
          data: exportData,
          timestamp: Date.now()
        });

      default:
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_ACTION', message: 'Invalid action parameter' } },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Program registry API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'INTERNAL_ERROR', 
          message: 'Internal server error' 
        } 
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/program-registry
 * 
 * For advanced queries and bulk operations
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, data } = body;

    switch (action) {
      case 'bulk_lookup':
        if (!data?.programIds || !Array.isArray(data.programIds)) {
          return NextResponse.json(
            { success: false, error: { code: 'INVALID_DATA', message: 'programIds array is required' } },
            { status: 400 }
          );
        }

        const programs = data.programIds.map((programId: string) => ({
          programId,
          program: getProgramDefinition(programId),
          isHighRisk: isProgramHighRisk(programId)
        }));

        return NextResponse.json({
          success: true,
          data: programs,
          count: programs.length,
          timestamp: Date.now()
        });

      case 'instruction_lookup':
        if (!data?.programId || !data?.instructionName) {
          return NextResponse.json(
            { success: false, error: { code: 'INVALID_DATA', message: 'programId and instructionName are required' } },
            { status: 400 }
          );
        }

        const instructionDef = getInstructionDefinition(data.programId, data.instructionName);
        if (!instructionDef) {
          return NextResponse.json(
            { success: false, error: { code: 'INSTRUCTION_NOT_FOUND', message: 'Instruction not found' } },
            { status: 404 }
          );
        }

        return NextResponse.json({
          success: true,
          data: instructionDef,
          timestamp: Date.now()
        });

      case 'risk_assessment':
        if (!data?.programIds || !Array.isArray(data.programIds)) {
          return NextResponse.json(
            { success: false, error: { code: 'INVALID_DATA', message: 'programIds array is required' } },
            { status: 400 }
          );
        }

        const riskAssessment = data.programIds.map((programId: string) => {
          const program = getProgramDefinition(programId);
          const isHighRisk = isProgramHighRisk(programId);
          
          let riskScore = 0;
          let riskFactors: string[] = [];

          if (program) {
            const highRiskInstructions = program.instructions.filter(ix => ix.riskLevel === 'high').length;
            const mediumRiskInstructions = program.instructions.filter(ix => ix.riskLevel === 'medium').length;
            
            riskScore = (highRiskInstructions * 3) + (mediumRiskInstructions * 1);
            
            if (highRiskInstructions > 0) {
              riskFactors.push(`${highRiskInstructions} high-risk instructions`);
            }
            if (mediumRiskInstructions > 0) {
              riskFactors.push(`${mediumRiskInstructions} medium-risk instructions`);
            }
            if (!program.documentation && !program.website) {
              riskFactors.push('No documentation available');
              riskScore += 1;
            }
          } else {
            riskScore = 10; // Unknown programs get maximum risk score
            riskFactors.push('Unknown program');
          }

          return {
            programId,
            programName: program?.name || 'Unknown Program',
            isHighRisk,
            riskScore,
            riskLevel: riskScore >= 5 ? 'high' : riskScore >= 2 ? 'medium' : 'low',
            riskFactors
          };
        });

        return NextResponse.json({
          success: true,
          data: riskAssessment,
          timestamp: Date.now()
        });

      default:
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_ACTION', message: 'Invalid action parameter' } },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Program registry POST API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'INTERNAL_ERROR', 
          message: 'Internal server error' 
        } 
      },
      { status: 500 }
    );
  }
}