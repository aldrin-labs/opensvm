import { Tool, ToolContext, ToolResult } from "./types.ts";
import { extractFirstSolanaAddress } from "./utils.ts";
import { PublicKey } from "@solana/web3.js";

export const transactionAnalysisTool: Tool = {
    name: "transactionAnalysis",
    description: "Analyzes individual transactions by signature",

    canHandle: (context: ToolContext): boolean => {
        const { question, qLower } = context;
        const txSignature = extractFirstSolanaAddress(String(question || ""));

        // Check for transaction signature (typically 87-88 characters)
        const isLikelyTxSignature = txSignature && txSignature.length >= 85 && txSignature.length <= 90;
        const containsTxKeywords = qLower.includes('transaction') || qLower.includes('tx') ||
            qLower.includes('signature') || qLower.includes('analyze');

        return Boolean(isLikelyTxSignature && (question.trim() === txSignature || containsTxKeywords));
    },

    execute: async (context: ToolContext): Promise<ToolResult> => {
        const { conn, question } = context;
        const txSignature = extractFirstSolanaAddress(String(question || ""));

        if (!txSignature) {
            return { handled: false };
        }

        console.log('Debug - Attempting transaction signature detection for:', txSignature);

        try {
            // Execute comprehensive transaction analysis
            const [txDetails, sigStatus] = await Promise.all([
                conn.getTransaction(txSignature, {
                    commitment: 'confirmed',
                    maxSupportedTransactionVersion: 0
                }),
                conn.getSignatureStatuses([txSignature])
            ]);

            if (!txDetails) {
                return {
                    handled: true,
                    response: new Response(
                        `Transaction ${txSignature} not found. It may not exist, be too old, or still pending.`,
                        { status: 200, headers: { "Content-Type": "text/plain" } }
                    )
                };
            }

            const status = sigStatus.value[0];
            const meta = txDetails.meta;

            let response = `🔍 **Transaction Analysis: ${txSignature}**\n\n`;

            // Status
            response += `**Status:** ${meta?.err ? '❌ Failed' : '✅ Success'}\n`;
            if (status) {
                response += `**Confirmation:** ${status.confirmationStatus || 'Unknown'}\n`;
                response += `**Slot:** ${status.slot || 'Unknown'}\n`;
            }

            // Basic details
            response += `**Block Time:** ${txDetails.blockTime ? new Date(txDetails.blockTime * 1000).toISOString() : 'Unknown'}\n`;
            response += `**Fee:** ${meta?.fee ? (meta.fee / 1_000_000_000).toFixed(9) + ' SOL' : 'Unknown'}\n`;

            // Account changes
            if (meta?.preBalances && meta?.postBalances) {
                response += `\n**Account Changes:**\n`;
                // Handle versioned transactions
                let accountKeys: PublicKey[] = [];

                if ('accountKeys' in txDetails.transaction.message) {
                    // Legacy transaction
                    accountKeys = txDetails.transaction.message.accountKeys;
                } else {
                    // Versioned transaction - simplified approach
                    try {
                        const messageAccountKeys = txDetails.transaction.message.getAccountKeys({
                            accountKeysFromLookups: meta?.loadedAddresses
                        });
                        // Convert MessageAccountKeys to array
                        accountKeys = [];
                        for (let i = 0; i < messageAccountKeys.length; i++) {
                            accountKeys.push(messageAccountKeys.get(i)!);
                        }
                    } catch (e) {
                        // Fallback if account keys can't be loaded
                        accountKeys = [];
                    }
                }

                for (let i = 0; i < Math.min(accountKeys.length, 10); i++) {
                    const preBalance = meta.preBalances[i] || 0;
                    const postBalance = meta.postBalances[i] || 0;
                    const change = postBalance - preBalance;
                    if (change !== 0) {
                        const account = accountKeys[i].toString();
                        response += `- ${account.slice(0, 8)}...${account.slice(-4)}: ${change > 0 ? '+' : ''}${(change / 1_000_000_000).toFixed(9)} SOL\n`;
                    }
                }
            }

            // Instructions
            const instructionCount = 'instructions' in txDetails.transaction.message
                ? txDetails.transaction.message.instructions.length
                : txDetails.transaction.message.compiledInstructions.length;
            response += `\n**Instructions:** ${instructionCount}\n`;

            // Error details if failed
            if (meta?.err) {
                response += `\n**Error Details:**\n${JSON.stringify(meta.err, null, 2)}\n`;
            }

            // Compute units
            if (meta?.computeUnitsConsumed) {
                response += `\n**Compute Units Used:** ${meta.computeUnitsConsumed.toLocaleString()}\n`;
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
                    `Error analyzing transaction ${txSignature}: ${(error as Error).message}`,
                    { status: 200, headers: { "Content-Type": "text/plain" } }
                )
            };
        }
    }
};
