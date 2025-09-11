import { Tool, ToolContext, ToolResult } from "./types.ts";
import { extractFirstSolanaAddress } from "./utils.ts";
import { PublicKey } from "@solana/web3.js";

export const accountAnalysisTool: Tool = {
    name: "accountAnalysis",
    description: "Analyzes Solana accounts and wallet balances",

    canHandle: (context: ToolContext): boolean => {
        const { qLower, question } = context;
        const addr = extractFirstSolanaAddress(String(question || ""));

        return Boolean(addr) && (
            qLower.includes("balance") || qLower.includes("wallet balance") ||
            qLower.includes("balance of") || qLower.includes("check") ||
            qLower.includes("analyze") || qLower.includes("account") ||
            qLower.includes("info") || qLower.includes("details")
        );
    },

    execute: async (context: ToolContext): Promise<ToolResult> => {
        const { conn, question, qLower } = context;
        const addr = extractFirstSolanaAddress(String(question || ""));

        if (!addr) {
            return { handled: false };
        }

        try {
            // Balance query (simple)
            if (qLower.includes("balance") || qLower.includes("wallet balance") || qLower.includes("balance of")) {
                const bal = await conn.getBalance(new PublicKey(addr));
                const sol = bal / 1_000_000_000;
                const reply = `Balance for ${addr}:\n- Lamports: ${bal}\n- SOL: ${sol}`;

                return {
                    handled: true,
                    response: new Response(reply, {
                        status: 200,
                        headers: { "Content-Type": "text/plain" }
                    })
                };
            }

            // Full account analysis
            if (qLower.includes("check") || qLower.includes("analyze") || qLower.includes("account") ||
                qLower.includes("info") || qLower.includes("details")) {

                const [accountInfo, balance] = await Promise.all([
                    conn.getAccountInfo(new PublicKey(addr)),
                    conn.getBalance(new PublicKey(addr))
                ]);

                if (!accountInfo) {
                    return {
                        handled: true,
                        response: new Response(`Account ${addr} does not exist or has no data.`, {
                            status: 200,
                            headers: { "Content-Type": "text/plain" }
                        })
                    };
                }

                const sol = balance / 1_000_000_000;
                let reply = `Account Analysis for ${addr}:

**Balance:**
- SOL: ${sol}
- Lamports: ${balance}

**Account Details:**
- Owner: ${accountInfo.owner.toString()}
- Data Length: ${accountInfo.data.length} bytes
- Executable: ${accountInfo.executable ? 'Yes' : 'No'}
- Rent Epoch: ${accountInfo.rentEpoch}`;

                // Add program information if it's an executable account
                if (accountInfo.executable) {
                    reply += `\n\n**Program Information:**
- This is an executable program account
- Program ID: ${addr}`;
                }

                // Add token account information if it's owned by the Token Program
                if (accountInfo.owner.toString() === 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') {
                    reply += `\n\n**Token Account:**
- This appears to be a Token Program account
- Use token-specific tools for detailed token information`;
                }

                // Add data preview if account has data
                if (accountInfo.data.length > 0 && accountInfo.data.length <= 100) {
                    reply += `\n\n**Raw Data (first 100 bytes):**
- Hex: ${accountInfo.data.subarray(0, Math.min(100, accountInfo.data.length)).toString('hex')}`;
                } else if (accountInfo.data.length > 100) {
                    reply += `\n\n**Raw Data (first 100 bytes of ${accountInfo.data.length} total):**
- Hex: ${accountInfo.data.subarray(0, 100).toString('hex')}...`;
                }

                return {
                    handled: true,
                    response: new Response(reply, {
                        status: 200,
                        headers: { "Content-Type": "text/plain" }
                    })
                };
            }

            return { handled: false };

        } catch (error) {
            console.error('Account analysis error:', error);
            return {
                handled: true,
                response: new Response(
                    `Failed to analyze account ${addr}: ${(error as Error).message}`,
                    { status: 500, headers: { "Content-Type": "text/plain" } }
                )
            };
        }
    }
};
