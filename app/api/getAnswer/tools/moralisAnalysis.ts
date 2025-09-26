import { Tool, ToolContext, ToolResult } from "./types";
import { extractFirstSolanaAddress } from "./utils";
import {
    getPortfolio,
    getTokenBalances,
    getNativeBalance,
    getNFTsForAddress,
    getSOLTransfers,
    getSPLTokenTransfers
} from "../../../lib/moralis-api";

// Timeout helper for Moralis API calls
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
            reject(new Error(`${operation} timeout after ${timeoutMs}ms`));
        }, timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]);
}

export const moralisAnalysisTool: Tool = {
    name: "moralisAnalysis",
    description: "Comprehensive Moralis-powered blockchain analysis including portfolio, tokens, NFTs, and market data",

    canHandle: (context: ToolContext): boolean => {
        const { qLower, question } = context;
        const addr = extractFirstSolanaAddress(String(question || ""));

        return Boolean(addr) && (
            qLower.includes("portfolio") || qLower.includes("moralis") ||
            qLower.includes("token") || qLower.includes("nft") ||
            qLower.includes("balance") || qLower.includes("holdings") ||
            qLower.includes("market") || qLower.includes("price") ||
            qLower.includes("transfers") || qLower.includes("transaction")
        );
    },

    execute: async (context: ToolContext): Promise<ToolResult> => {
        const { question, qLower } = context;
        const addr = extractFirstSolanaAddress(String(question || ""));

        if (!addr) {
            return { handled: false };
        }

        const partialData: any = {
            address: addr,
            timestamp: new Date().toISOString()
        };

        try {
            console.log(`🏦 Executing Moralis analysis for: ${addr}`);

            // Run multiple Moralis API calls in parallel for maximum speed
            const apiCalls = await Promise.allSettled([
                // Core portfolio data
                withTimeout(
                    MoralisAPI.getPortfolio(addr, false),
                    10000,
                    "Portfolio fetch"
                ).catch(err => ({ error: err.message, type: 'portfolio' })),

                // Token balances
                withTimeout(
                    MoralisAPI.getTokenBalances(addr),
                    8000,
                    "Token balances fetch"
                ).catch(err => ({ error: err.message, type: 'tokens' })),

                // Native SOL balance
                withTimeout(
                    MoralisAPI.getNativeBalance(addr),
                    5000,
                    "Native balance fetch"
                ).catch(err => ({ error: err.message, type: 'native' })),

                // NFTs (if mentioned in query)
                qLower.includes("nft") ?
                    withTimeout(
                        MoralisAPI.getNFTsForAddress(addr, { limit: 20, nftMetadata: false }),
                        12000,
                        "NFTs fetch"
                    ).catch(err => ({ error: err.message, type: 'nfts' })) :
                    null,

                // Transfers (if mentioned in query)
                (qLower.includes("transfer") || qLower.includes("transaction")) ?
                    withTimeout(
                        MoralisAPI.getSOLTransfers(addr, { limit: 10 }),
                        10000,
                        "SOL transfers fetch"
                    ).catch(err => ({ error: err.message, type: 'transfers' })) :
                    null,

                // SPL transfers (if mentioned in query)
                (qLower.includes("transfer") || qLower.includes("spl")) ?
                    withTimeout(
                        MoralisAPI.getSPLTokenTransfers(addr, { limit: 10 }),
                        10000,
                        "SPL transfers fetch"
                    ).catch(err => ({ error: err.message, type: 'spl_transfers' })) :
                    null
            ]);

            // Process results and collect successful data
            let successfulCalls = 0;
            let totalCalls = 0;

            // Portfolio data
            if (apiCalls[0].status === 'fulfilled' && !apiCalls[0].value?.error) {
                partialData.portfolio = apiCalls[0].value;
                successfulCalls++;
                console.log('✅ Portfolio data retrieved');
            } else {
                console.log('❌ Portfolio fetch failed:', apiCalls[0].status === 'fulfilled' ? apiCalls[0].value?.error : 'Promise rejected');
            }
            totalCalls++;

            // Token balances
            if (apiCalls[1].status === 'fulfilled' && !apiCalls[1].value?.error) {
                partialData.tokenBalances = apiCalls[1].value;
                successfulCalls++;
                console.log('✅ Token balances retrieved');
            } else {
                console.log('❌ Token balances fetch failed:', apiCalls[1].status === 'fulfilled' ? apiCalls[1].value?.error : 'Promise rejected');
            }
            totalCalls++;

            // Native balance
            if (apiCalls[2].status === 'fulfilled' && !apiCalls[2].value?.error) {
                partialData.nativeBalance = apiCalls[2].value;
                successfulCalls++;
                console.log('✅ Native balance retrieved');
            } else {
                console.log('❌ Native balance fetch failed:', apiCalls[2].status === 'fulfilled' ? apiCalls[2].value?.error : 'Promise rejected');
            }
            totalCalls++;

            // NFTs (if requested)
            if (apiCalls[3] !== null) {
                totalCalls++;
                if (apiCalls[3].status === 'fulfilled' && !apiCalls[3].value?.error) {
                    partialData.nfts = apiCalls[3].value;
                    successfulCalls++;
                    console.log('✅ NFTs retrieved');
                } else {
                    console.log('❌ NFTs fetch failed:', apiCalls[3].status === 'fulfilled' ? apiCalls[3].value?.error : 'Promise rejected');
                }
            }

            // SOL transfers (if requested)
            if (apiCalls[4] !== null) {
                totalCalls++;
                if (apiCalls[4].status === 'fulfilled' && !apiCalls[4].value?.error) {
                    partialData.solTransfers = apiCalls[4].value;
                    successfulCalls++;
                    console.log('✅ SOL transfers retrieved');
                } else {
                    console.log('❌ SOL transfers fetch failed:', apiCalls[4].status === 'fulfilled' ? apiCalls[4].value?.error : 'Promise rejected');
                }
            }

            // SPL transfers (if requested)
            if (apiCalls[5] !== null) {
                totalCalls++;
                if (apiCalls[5].status === 'fulfilled' && !apiCalls[5].value?.error) {
                    partialData.splTransfers = apiCalls[5].value;
                    successfulCalls++;
                    console.log('✅ SPL transfers retrieved');
                } else {
                    console.log('❌ SPL transfers fetch failed:', apiCalls[5].status === 'fulfilled' ? apiCalls[5].value?.error : 'Promise rejected');
                }
            }

            // Determine if we have enough data to provide a meaningful response
            const successRate = successfulCalls / totalCalls;
            console.log(`📊 Moralis Analysis: ${successfulCalls}/${totalCalls} calls successful (${Math.round(successRate * 100)}%)`);

            if (successRate >= 0.5) {
                // We have enough data, generate comprehensive response
                const response = await generateMoralisResponse(partialData, question);

                return {
                    handled: true,
                    response: new Response(response, {
                        status: 200,
                        headers: {
                            "Content-Type": "text/plain; charset=utf-8",
                            "Cache-Control": "no-cache",
                        }
                    })
                };
            } else {
                // Not enough successful calls, but return partial data for LLM processing
                const error = new Error(`Moralis analysis partially failed: ${successfulCalls}/${totalCalls} successful`);
                (error as any).partialData = {
                    moralisAnalysis: {
                        ...partialData,
                        successRate,
                        totalCalls,
                        successfulCalls
                    }
                };
                throw error;
            }

        } catch (error) {
            console.error('⚡ Moralis analysis error:', error);

            // If we have partial data, include it in the error
            if (Object.keys(partialData).length > 2) { // More than just address and timestamp
                const partialError = new Error(`Moralis analysis failed: ${(error as Error).message}`);
                (partialError as any).partialData = {
                    moralisAnalysis: partialData
                };
                throw partialError;
            }

            return { handled: false };
        }
    }
};

async function generateMoralisResponse(data: any, question: string): Promise<string> {
    let response = `# 🏦 Moralis Blockchain Analysis\n\n`;
    response += `**Address**: \`${data.address}\`\n`;
    response += `**Analysis Time**: ${new Date(data.timestamp).toLocaleString()}\n\n`;

    // Native Balance Section
    if (data.nativeBalance) {
        response += `## 💰 Native SOL Balance\n\n`;
        const balance = data.nativeBalance.lamports ? (data.nativeBalance.lamports / 1e9).toFixed(4) : 'N/A';
        response += `- **Balance**: ${balance} SOL\n`;
        if (data.nativeBalance.usd) {
            response += `- **USD Value**: $${data.nativeBalance.usd}\n`;
        }
        response += `\n`;
    }

    // Token Balances Section
    if (data.tokenBalances && Array.isArray(data.tokenBalances)) {
        response += `## 🪙 Token Holdings\n\n`;
        if (data.tokenBalances.length === 0) {
            response += `No SPL tokens found.\n\n`;
        } else {
            response += `Found ${data.tokenBalances.length} token(s):\n\n`;
            data.tokenBalances.slice(0, 10).forEach((token: any, index: number) => {
                response += `${index + 1}. **${token.symbol || 'Unknown'}** (${token.name || 'N/A'})\n`;
                response += `   - Mint: \`${token.mint}\`\n`;
                response += `   - Balance: ${token.amount || 'N/A'}\n`;
                if (token.usd_value) {
                    response += `   - USD Value: $${token.usd_value}\n`;
                }
                response += `\n`;
            });
        }
    }

    // Portfolio Section
    if (data.portfolio) {
        response += `## 📊 Portfolio Overview\n\n`;
        if (data.portfolio.total_value_usd) {
            response += `- **Total Portfolio Value**: $${data.portfolio.total_value_usd}\n`;
        }
        if (data.portfolio.tokens && Array.isArray(data.portfolio.tokens)) {
            response += `- **Token Count**: ${data.portfolio.tokens.length}\n`;
        }
        if (data.portfolio.nfts && Array.isArray(data.portfolio.nfts)) {
            response += `- **NFT Count**: ${data.portfolio.nfts.length}\n`;
        }
        response += `\n`;
    }

    // NFTs Section
    if (data.nfts && Array.isArray(data.nfts.result)) {
        response += `## 🖼️ NFT Collection\n\n`;
        if (data.nfts.result.length === 0) {
            response += `No NFTs found.\n\n`;
        } else {
            response += `Found ${data.nfts.result.length} NFT(s):\n\n`;
            data.nfts.result.slice(0, 5).forEach((nft: any, index: number) => {
                response += `${index + 1}. **${nft.name || 'Unnamed NFT'}**\n`;
                response += `   - Mint: \`${nft.mint}\`\n`;
                if (nft.collection_name) {
                    response += `   - Collection: ${nft.collection_name}\n`;
                }
                response += `\n`;
            });
        }
    }

    // Transfers Section
    if (data.solTransfers && Array.isArray(data.solTransfers)) {
        response += `## 🔄 Recent SOL Transfers\n\n`;
        if (data.solTransfers.length === 0) {
            response += `No recent SOL transfers found.\n\n`;
        } else {
            response += `Recent ${data.solTransfers.length} transfer(s):\n\n`;
            data.solTransfers.slice(0, 5).forEach((transfer: any, index: number) => {
                response += `${index + 1}. **${transfer.amount || 'N/A'} SOL**\n`;
                response += `   - From: \`${transfer.from_address || 'N/A'}\`\n`;
                response += `   - To: \`${transfer.to_address || 'N/A'}\`\n`;
                response += `   - Signature: \`${transfer.signature || 'N/A'}\`\n`;
                response += `\n`;
            });
        }
    }

    // SPL Transfers Section
    if (data.splTransfers && Array.isArray(data.splTransfers)) {
        response += `## 🔄 Recent SPL Token Transfers\n\n`;
        if (data.splTransfers.length === 0) {
            response += `No recent SPL transfers found.\n\n`;
        } else {
            response += `Recent ${data.splTransfers.length} SPL transfer(s):\n\n`;
            data.splTransfers.slice(0, 5).forEach((transfer: any, index: number) => {
                response += `${index + 1}. **${transfer.symbol || 'Unknown Token'}**\n`;
                response += `   - Amount: ${transfer.amount || 'N/A'}\n`;
                response += `   - From: \`${transfer.from_address || 'N/A'}\`\n`;
                response += `   - To: \`${transfer.to_address || 'N/A'}\`\n`;
                response += `   - Signature: \`${transfer.signature || 'N/A'}\`\n`;
                response += `\n`;
            });
        }
    }

    response += `---\n\n`;
    response += `*Analysis powered by Moralis Web3 Data API*\n`;

    return response;
}