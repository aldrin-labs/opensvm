import { NextRequest, NextResponse } from 'next/server';
import {
  getProgramDefinition,
  getProgramMetadata,
  getSimilarPrograms,
  isProgramHighRisk,
  getInstructionDefinition
} from '@/lib/solana/program-registry';

/**
 * GET /api/program-registry/[programId]
 * 
 * Get detailed information about a specific program
 * 
 * Query parameters:
 * - include: comma-separated list of additional data to include
 *   - 'metadata': include program statistics
 *   - 'similar': include similar programs
 *   - 'risk': include risk assessment
 *   - 'instructions': include detailed instruction information
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ programId: string }> }
) {
  try {
    const { programId } = await params;
    const { searchParams } = new URL(request.url);
    const include = searchParams.get('include')?.split(',') || [];
    const instructionName = searchParams.get('instruction');

    // Validate program ID format
    if (!programId || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(programId)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_PROGRAM_ID',
            message: 'Invalid program ID format'
          }
        },
        { status: 400 }
      );
    }

    // Get basic program information
    const program = getProgramDefinition(programId);
    if (!program) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'PROGRAM_NOT_FOUND',
            message: 'Program not found in registry'
          }
        },
        { status: 404 }
      );
    }

    // If specific instruction is requested
    if (instructionName) {
      const instructionDef = getInstructionDefinition(programId, instructionName);
      if (!instructionDef) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'INSTRUCTION_NOT_FOUND',
              message: 'Instruction not found'
            }
          },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          program: instructionDef.program,
          instruction: instructionDef.instruction
        },
        timestamp: Date.now()
      });
    }

    // Build response data
    const responseData: any = {
      program
    };

    // Include additional data based on query parameters
    if (include.includes('metadata')) {
      const metadata = getProgramMetadata(programId);
      if (metadata) {
        responseData.metadata = metadata.stats;
      }
    }

    if (include.includes('similar')) {
      responseData.similarPrograms = getSimilarPrograms(programId);
    }

    if (include.includes('risk')) {
      const isHighRisk = isProgramHighRisk(programId);
      const highRiskInstructions = program.instructions.filter(ix => ix.riskLevel === 'high');
      const mediumRiskInstructions = program.instructions.filter(ix => ix.riskLevel === 'medium');
      const lowRiskInstructions = program.instructions.filter(ix => ix.riskLevel === 'low');

      let riskScore = (highRiskInstructions.length * 3) + (mediumRiskInstructions.length * 1);
      let riskFactors: string[] = [];

      if (highRiskInstructions.length > 0) {
        riskFactors.push(`${highRiskInstructions.length} high-risk instructions`);
      }
      if (mediumRiskInstructions.length > 0) {
        riskFactors.push(`${mediumRiskInstructions.length} medium-risk instructions`);
      }
      if (!program.documentation && !program.website) {
        riskFactors.push('No documentation available');
        riskScore += 1;
      }

      responseData.riskAssessment = {
        isHighRisk,
        riskScore,
        riskLevel: riskScore >= 5 ? 'high' : riskScore >= 2 ? 'medium' : 'low',
        riskFactors,
        instructionRiskDistribution: {
          high: highRiskInstructions.length,
          medium: mediumRiskInstructions.length,
          low: lowRiskInstructions.length
        }
      };
    }

    if (include.includes('instructions')) {
      responseData.instructionDetails = program.instructions.map(instruction => ({
        ...instruction,
        accountCount: instruction.accounts.length,
        parameterCount: instruction.parameters.length,
        hasOptionalParameters: instruction.parameters.some(p => p.optional),
        requiresSigners: instruction.accounts.some(a => a.isSigner),
        modifiesAccounts: instruction.accounts.some(a => a.isWritable)
      }));
    }

    return NextResponse.json({
      success: true,
      data: responseData,
      timestamp: Date.now(),
      cached: false
    });

  } catch (error) {
    console.error('Program registry individual lookup error:', error);
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
 * POST /api/program-registry/[programId]
 * 
 * Perform operations on a specific program
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ programId: string }> }
) {
  try {
    const { programId } = await params;
    const body = await request.json();
    const { action, data } = body;

    // Validate program exists
    const program = getProgramDefinition(programId);
    if (!program) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'PROGRAM_NOT_FOUND',
            message: 'Program not found in registry'
          }
        },
        { status: 404 }
      );
    }

    switch (action) {
      case 'analyze_instructions':
        if (!data?.instructions || !Array.isArray(data.instructions)) {
          return NextResponse.json(
            { success: false, error: { code: 'INVALID_DATA', message: 'instructions array is required' } },
            { status: 400 }
          );
        }

        const analysisResults = data.instructions.map((instructionName: string) => {
          const instruction = program.instructions.find(ix =>
            ix.name.toLowerCase() === instructionName.toLowerCase()
          );

          if (!instruction) {
            return {
              instructionName,
              found: false,
              error: 'Instruction not found'
            };
          }

          return {
            instructionName,
            found: true,
            instruction: {
              ...instruction,
              complexity: instruction.accounts.length + instruction.parameters.length,
              requiresMultipleSigners: instruction.accounts.filter(a => a.isSigner).length > 1,
              modifiesMultipleAccounts: instruction.accounts.filter(a => a.isWritable).length > 1
            }
          };
        });

        return NextResponse.json({
          success: true,
          data: {
            programId,
            programName: program.name,
            analysisResults,
            summary: {
              totalInstructions: data.instructions.length,
              foundInstructions: analysisResults.filter((r: any) => r.found).length,
              notFoundInstructions: analysisResults.filter((r: any) => !r.found).length
            }
          },
          timestamp: Date.now()
        });

      case 'compare_with':
        if (!data?.compareWithProgramId) {
          return NextResponse.json(
            { success: false, error: { code: 'INVALID_DATA', message: 'compareWithProgramId is required' } },
            { status: 400 }
          );
        }

        const compareProgram = getProgramDefinition(data.compareWithProgramId);
        if (!compareProgram) {
          return NextResponse.json(
            { success: false, error: { code: 'COMPARE_PROGRAM_NOT_FOUND', message: 'Comparison program not found' } },
            { status: 404 }
          );
        }

        const comparison = {
          program1: {
            programId,
            name: program.name,
            category: program.category,
            instructionCount: program.instructions.length,
            riskDistribution: program.instructions.reduce((acc, ix) => {
              acc[ix.riskLevel] = (acc[ix.riskLevel] || 0) + 1;
              return acc;
            }, {} as Record<string, number>)
          },
          program2: {
            programId: data.compareWithProgramId,
            name: compareProgram.name,
            category: compareProgram.category,
            instructionCount: compareProgram.instructions.length,
            riskDistribution: compareProgram.instructions.reduce((acc, ix) => {
              acc[ix.riskLevel] = (acc[ix.riskLevel] || 0) + 1;
              return acc;
            }, {} as Record<string, number>)
          },
          similarities: {
            sameCategory: program.category === compareProgram.category,
            commonInstructions: program.instructions.filter(ix1 =>
              compareProgram.instructions.some(ix2 => ix1.name === ix2.name)
            ).map(ix => ix.name)
          }
        };

        return NextResponse.json({
          success: true,
          data: comparison,
          timestamp: Date.now()
        });

      default:
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_ACTION', message: 'Invalid action parameter' } },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Program registry individual POST error:', error);
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