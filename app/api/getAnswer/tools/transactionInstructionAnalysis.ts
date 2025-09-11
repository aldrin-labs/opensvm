import { Tool, ToolContext, ToolResult } from "./types.ts";
import { extractAllTransactionSignatures, getProgramName, decodeInstructionData } from "./utils.ts";

export const transactionInstructionAnalysisTool: Tool = {
    name: "transactionInstructionAnalysis",
    description: "Analyzes transaction instruction calling chains with detailed bytecode information",

    canHandle: (context: ToolContext): boolean => {
        const allTxSignatures = extractAllTransactionSignatures(String(context.question || ""));
        const containsInstructionKeywords = context.qLower.includes('instruction') ||
            context.qLower.includes('calling chain') || context.qLower.includes('call chain') ||
            context.qLower.includes('instruction chain') || context.qLower.includes('bytecode') ||
            context.qLower.includes('decode') || context.qLower.includes('analyze');

        return allTxSignatures.length >= 1 && containsInstructionKeywords;
    },

    execute: async (context: ToolContext): Promise<ToolResult> => {
        const { conn, question } = context;
        const allTxSignatures = extractAllTransactionSignatures(String(question || ""));

        console.log('Debug - Transaction signatures with instruction analysis detected:', allTxSignatures.length);

        try {
            const txAnalyses = await Promise.all(
                allTxSignatures.map(async (txSig) => {
                    try {
                        const txDetails = await conn.getTransaction(txSig, {
                            commitment: 'confirmed',
                            maxSupportedTransactionVersion: 0
                        });
                        return { signature: txSig, transaction: txDetails };
                    } catch (error) {
                        return { signature: txSig, error: (error as Error).message };
                    }
                })
            );

            let response = `🔗 **Instruction Calling Chain Analysis**\n\n`;
            if (allTxSignatures.length > 1) {
                response += `**Analyzing ${allTxSignatures.length} transactions:**\n\n`;
            } else {
                response += `**Analyzing transaction:**\n\n`;
            }

            for (const analysis of txAnalyses) {
                response += `---\n\n`;
                response += `**Transaction:** \`${analysis.signature}\`\n`;

                if ('error' in analysis) {
                    response += `❌ **Error:** ${analysis.error}\n\n`;
                    continue;
                }

                if (!analysis.transaction) {
                    response += `❌ **Not Found:** Transaction not found or too old\n\n`;
                    continue;
                }

                const tx = analysis.transaction;
                const meta = tx.meta;

                // Status
                response += `**Status:** ${meta?.err ? '❌ Failed' : '✅ Success'}\n`;
                response += `**Block Time:** ${tx.blockTime ? new Date(tx.blockTime * 1000).toISOString() : 'Unknown'}\n`;

                // Instruction calling chain with detailed bytecode analysis
                response += `\n**📋 Detailed Instruction Calling Chain with Bytecode:**\n`;

                let instructions: any[] = [];
                let accountKeys: any;

                if ('instructions' in tx.transaction.message) {
                    // Legacy transaction
                    instructions = tx.transaction.message.instructions;
                    accountKeys = tx.transaction.message.accountKeys;
                } else {
                    // Versioned transaction
                    instructions = tx.transaction.message.compiledInstructions;
                    try {
                        accountKeys = tx.transaction.message.getAccountKeys({
                            accountKeysFromLookups: meta?.loadedAddresses
                        });
                    } catch (e) {
                        accountKeys = tx.transaction.message.staticAccountKeys;
                    }
                }

                for (let i = 0; i < instructions.length; i++) {
                    const instruction = instructions[i];
                    response += `\n**Instruction ${i + 1}:**\n`;

                    let programId: string;
                    let accounts: string[] = [];
                    let instructionData: Buffer | null = null;

                    if ('programIdIndex' in instruction) {
                        // Compiled instruction (versioned transaction)
                        try {
                            programId = accountKeys.get ? accountKeys.get(instruction.programIdIndex)?.toString() :
                                accountKeys[instruction.programIdIndex]?.toString();

                            // Get account details
                            for (const accountIndex of instruction.accountKeyIndexes || []) {
                                const account = accountKeys.get ? accountKeys.get(accountIndex)?.toString() :
                                    accountKeys[accountIndex]?.toString();
                                if (account) accounts.push(account);
                            }

                            instructionData = instruction.data ? Buffer.from(instruction.data) : null;
                        } catch (e) {
                            programId = `Program Index ${instruction.programIdIndex}`;
                        }
                    } else {
                        // Legacy instruction
                        programId = instruction.programId.toString();
                        accounts = instruction.keys?.map((key: any) => key.pubkey.toString()) || [];
                        instructionData = instruction.data ? Buffer.from(instruction.data) : null;
                    }

                    // Program ID (full, not truncated)
                    response += `   **🔧 Program ID:** \`${programId}\`\n`;

                    // Program name recognition
                    const programName = getProgramName(programId);
                    if (programName !== programId) {
                        response += `   **📝 Program:** ${programName}\n`;
                    }

                    // Account details
                    response += `   **👥 Accounts (${accounts.length}):**\n`;
                    for (let j = 0; j < accounts.length; j++) {
                        response += `      ${j + 1}. \`${accounts[j]}\`\n`;
                    }

                    // Bytecode analysis
                    if (instructionData && instructionData.length > 0) {
                        response += `   **🔐 Instruction Data (${instructionData.length} bytes):**\n`;
                        response += `      **Hex:** \`${instructionData.toString('hex')}\`\n`;

                        // Try to decode the instruction
                        const decodedInfo = decodeInstructionData(programId, instructionData);
                        if (decodedInfo) {
                            response += `      **Decoded:** ${decodedInfo}\n`;
                        }

                        // Show first 4 bytes as potential method selector
                        if (instructionData.length >= 4) {
                            const selector = instructionData.subarray(0, 4);
                            response += `      **Method Selector:** \`${selector.toString('hex')}\`\n`;
                        }

                        // Show remaining data as parameters
                        if (instructionData.length > 4) {
                            const params = instructionData.subarray(4);
                            response += `      **Parameters:** \`${params.toString('hex')}\`\n`;
                        }
                    } else {
                        response += `   **📭 No instruction data**\n`;
                    }
                }

                // Inner instructions (if any)
                if (meta?.innerInstructions && meta.innerInstructions.length > 0) {
                    response += `\n**🔄 Inner Instructions (CPIs):**\n`;
                    for (const innerGroup of meta.innerInstructions) {
                        response += `   **From Instruction ${innerGroup.index + 1}:**\n`;
                        for (let j = 0; j < innerGroup.instructions.length; j++) {
                            const innerInst = innerGroup.instructions[j];
                            response += `   ${j + 1}. `;

                            if ('programIdIndex' in innerInst) {
                                let programId = 'Unknown Program';
                                try {
                                    const messageAccountKeys = tx.transaction.message.getAccountKeys({
                                        accountKeysFromLookups: meta?.loadedAddresses
                                    });
                                    programId = messageAccountKeys.get(innerInst.programIdIndex)?.toString() || 'Unknown Program';
                                } catch (e) {
                                    programId = `Program Index ${innerInst.programIdIndex}`;
                                }
                                response += `CPI to \`${programId.slice(0, 8)}...${programId.slice(-4)}\`\n`;
                            }
                        }
                    }
                }

                // Compute units
                if (meta?.computeUnitsConsumed) {
                    response += `\n**⚡ Compute Units:** ${meta.computeUnitsConsumed.toLocaleString()}\n`;
                }

                response += `\n`;
            }

            return {
                handled: true,
                response: new Response(response, {
                    status: 200,
                    headers: { "Content-Type": "text/plain" }
                })
            };

        } catch (error) {
            console.error('Transaction analysis error:', error);
            return {
                handled: true,
                response: new Response(
                    JSON.stringify({ error: `Transaction analysis failed: ${(error as Error).message}` }),
                    {
                        status: 500,
                        headers: { "Content-Type": "application/json" },
                    }
                )
            };
        }
    }
};
