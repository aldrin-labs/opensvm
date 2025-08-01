import { NextRequest, NextResponse } from 'next/server';
import {
  getProgramDefinition,
  getInstructionDefinition,
  getAllInstructionCategories,
  getProgramsWithInstructionType
} from '@/lib/program-registry';
import { InstructionParserService } from '@/lib/instruction-parser-service';

/**
 * GET /api/instruction-lookup
 * 
 * Query parameters:
 * - programId: Program ID to lookup instructions for
 * - discriminator: Instruction discriminator to lookup
 * - instructionName: Instruction name to lookup
 * - category: Filter instructions by category
 * - riskLevel: Filter instructions by risk level
 * - action: 'lookup' | 'categories' | 'search' | 'parse'
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'lookup';
    const programId = searchParams.get('programId');
    const discriminator = searchParams.get('discriminator');
    const instructionName = searchParams.get('instructionName');
    const category = searchParams.get('category');
    const riskLevel = searchParams.get('riskLevel') as 'low' | 'medium' | 'high' | null;

    switch (action) {
      case 'lookup':
        if (!programId) {
          return NextResponse.json(
            { success: false, error: { code: 'MISSING_PROGRAM_ID', message: 'Program ID is required' } },
            { status: 400 }
          );
        }

        const program = getProgramDefinition(programId);
        if (!program) {
          return NextResponse.json(
            { success: false, error: { code: 'PROGRAM_NOT_FOUND', message: 'Program not found' } },
            { status: 404 }
          );
        }

        let instructions = program.instructions;

        // Filter by discriminator if provided
        if (discriminator) {
          instructions = instructions.filter(ix => ix.discriminator === discriminator);
        }

        // Filter by instruction name if provided
        if (instructionName) {
          instructions = instructions.filter(ix =>
            ix.name.toLowerCase().includes(instructionName.toLowerCase())
          );
        }

        // Filter by category if provided
        if (category) {
          instructions = instructions.filter(ix => ix.category === category);
        }

        // Filter by risk level if provided
        if (riskLevel) {
          instructions = instructions.filter(ix => ix.riskLevel === riskLevel);
        }

        return NextResponse.json({
          success: true,
          data: {
            program: {
              programId: program.programId,
              name: program.name,
              description: program.description,
              category: program.category,
              website: program.website,
              documentation: program.documentation
            },
            instructions,
            totalInstructions: instructions.length,
            filters: {
              discriminator,
              instructionName,
              category,
              riskLevel
            }
          },
          timestamp: Date.now()
        });

      case 'categories':
        const categories = getAllInstructionCategories();
        return NextResponse.json({
          success: true,
          data: categories,
          count: categories.length,
          timestamp: Date.now()
        });

      case 'search':
        if (!instructionName) {
          return NextResponse.json(
            { success: false, error: { code: 'MISSING_INSTRUCTION_NAME', message: 'Instruction name is required for search' } },
            { status: 400 }
          );
        }

        const programsWithInstruction = getProgramsWithInstructionType(instructionName);
        const searchResults = programsWithInstruction.map(program => ({
          program: {
            programId: program.programId,
            name: program.name,
            category: program.category
          },
          matchingInstructions: program.instructions.filter(ix =>
            ix.name.toLowerCase().includes(instructionName.toLowerCase())
          )
        }));

        return NextResponse.json({
          success: true,
          data: searchResults,
          count: searchResults.length,
          query: instructionName,
          timestamp: Date.now()
        });

      case 'parse':
        if (!programId || !discriminator) {
          return NextResponse.json(
            { success: false, error: { code: 'MISSING_PARAMETERS', message: 'Program ID and discriminator are required for parsing' } },
            { status: 400 }
          );
        }

        const instructionDef = getInstructionDefinition(programId, discriminator);
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

      default:
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_ACTION', message: 'Invalid action parameter' } },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Instruction lookup API error:', error);
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
 * POST /api/instruction-lookup
 * 
 * For bulk instruction lookups and parsing operations
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, data } = body;

    switch (action) {
      case 'bulk_lookup':
        if (!data?.instructions || !Array.isArray(data.instructions)) {
          return NextResponse.json(
            { success: false, error: { code: 'INVALID_DATA', message: 'Instructions array is required' } },
            { status: 400 }
          );
        }

        const bulkResults = data.instructions.map((instruction: { programId: string; discriminator?: string; name?: string }) => {
          try {
            const program = getProgramDefinition(instruction.programId);
            if (!program) {
              return {
                programId: instruction.programId,
                success: false,
                error: 'Program not found'
              };
            }

            let matchingInstructions = program.instructions;

            if (instruction.discriminator) {
              matchingInstructions = matchingInstructions.filter(ix => ix.discriminator === instruction.discriminator);
            }

            if (instruction.name) {
              matchingInstructions = matchingInstructions.filter(ix =>
                ix.name.toLowerCase().includes(instruction.name!.toLowerCase())
              );
            }

            return {
              programId: instruction.programId,
              programName: program.name,
              success: true,
              instructions: matchingInstructions,
              count: matchingInstructions.length
            };
          } catch (error) {
            return {
              programId: instruction.programId,
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error'
            };
          }
        });

        return NextResponse.json({
          success: true,
          data: bulkResults,
          timestamp: Date.now()
        });

      case 'parse_instructions':
        if (!data?.transactionInstructions || !Array.isArray(data.transactionInstructions)) {
          return NextResponse.json(
            { success: false, error: { code: 'INVALID_DATA', message: 'Transaction instructions array is required' } },
            { status: 400 }
          );
        }

        const parserService = new InstructionParserService();
        const parseResults = await Promise.all(
          data.transactionInstructions.map(async (instruction: any) => {
            try {
              const parsed = await parserService.parseInstruction(
                instruction.programId,
                instruction.accounts || [],
                instruction.data || '',
                instruction.parsed
              );

              return {
                programId: instruction.programId,
                success: true,
                parsed
              };
            } catch (error) {
              return {
                programId: instruction.programId,
                success: false,
                error: error instanceof Error ? error.message : 'Parse error'
              };
            }
          })
        );

        // Categorize the results
        const categorization = await parserService.categorizeInstructions(
          data.transactionInstructions
        );

        return NextResponse.json({
          success: true,
          data: {
            instructions: parseResults,
            categorization,
            summary: {
              totalInstructions: parseResults.length,
              successfulParses: parseResults.filter(r => r.success).length,
              failedParses: parseResults.filter(r => !r.success).length
            }
          },
          timestamp: Date.now()
        });

      case 'analyze_complexity':
        if (!data?.instructions || !Array.isArray(data.instructions)) {
          return NextResponse.json(
            { success: false, error: { code: 'INVALID_DATA', message: 'Instructions array is required' } },
            { status: 400 }
          );
        }

        const complexityAnalysis = data.instructions.map((instruction: any) => {
          const program = getProgramDefinition(instruction.programId);
          const instructionDef = program?.instructions.find(ix =>
            ix.discriminator === instruction.discriminator ||
            ix.name === instruction.name
          );

          if (!instructionDef) {
            return {
              programId: instruction.programId,
              complexity: 'unknown',
              score: 0,
              factors: ['Unknown instruction']
            };
          }

          // Calculate complexity score
          let complexityScore = 0;
          const factors: string[] = [];

          // Account complexity
          const accountCount = instructionDef.accounts.length;
          complexityScore += accountCount * 2;
          if (accountCount > 5) factors.push(`${accountCount} accounts`);

          // Parameter complexity
          const paramCount = instructionDef.parameters.length;
          complexityScore += paramCount;
          if (paramCount > 3) factors.push(`${paramCount} parameters`);

          // Risk level impact
          switch (instructionDef.riskLevel) {
            case 'high':
              complexityScore += 10;
              factors.push('High risk operation');
              break;
            case 'medium':
              complexityScore += 5;
              factors.push('Medium risk operation');
              break;
          }

          // Signer requirements
          const signerCount = instructionDef.accounts.filter((acc: any) => acc.isSigner).length;
          if (signerCount > 1) {
            complexityScore += signerCount * 3;
            factors.push(`${signerCount} signers required`);
          }

          // Writable accounts
          const writableCount = instructionDef.accounts.filter((acc: any) => acc.isWritable).length;
          if (writableCount > 2) {
            complexityScore += writableCount * 2;
            factors.push(`${writableCount} writable accounts`);
          }

          const complexity = complexityScore < 10 ? 'low' :
            complexityScore < 25 ? 'medium' : 'high';

          return {
            programId: instruction.programId,
            programName: program?.name,
            instructionName: instructionDef.name,
            complexity,
            score: complexityScore,
            factors,
            riskLevel: instructionDef.riskLevel,
            accountCount,
            parameterCount: paramCount,
            signerCount,
            writableCount
          };
        });

        return NextResponse.json({
          success: true,
          data: {
            instructions: complexityAnalysis,
            summary: {
              totalInstructions: complexityAnalysis.length,
              complexityDistribution: {
                low: complexityAnalysis.filter((i: any) => i.complexity === 'low').length,
                medium: complexityAnalysis.filter((i: any) => i.complexity === 'medium').length,
                high: complexityAnalysis.filter((i: any) => i.complexity === 'high').length
              },
              averageScore: complexityAnalysis.reduce((sum: number, i: any) => sum + i.score, 0) / complexityAnalysis.length,
              riskDistribution: {
                low: complexityAnalysis.filter((i: any) => i.riskLevel === 'low').length,
                medium: complexityAnalysis.filter((i: any) => i.riskLevel === 'medium').length,
                high: complexityAnalysis.filter((i: any) => i.riskLevel === 'high').length
              }
            }
          },
          timestamp: Date.now()
        });

      default:
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_ACTION', message: 'Invalid action parameter' } },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Instruction lookup POST API error:', error);
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