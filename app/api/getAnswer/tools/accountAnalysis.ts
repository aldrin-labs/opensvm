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
            qLower.includes("info") || qLower.includes("details") ||
            qLower.includes("/wallet") || qLower.startsWith("wallet ")
        );
    },

    execute: async (context: ToolContext): Promise<ToolResult> => {
        const { conn, question, qLower } = context;
        const addr = extractFirstSolanaAddress(String(question || ""));

        if (!addr) {
            return { handled: false };
        }

        try {
            // Comprehensive wallet analysis for /wallet command
            if (qLower.includes("/wallet") || qLower.startsWith("wallet ")) {
                console.log(`[accountAnalysis] Executing comprehensive wallet analysis for: ${addr}`);

                // Execute comprehensive plan with detailed transaction analysis
                const [accountInfo, balance, tokenAccounts, signatures] = await Promise.all([
                    conn.getAccountInfo(new PublicKey(addr)),
                    conn.getBalance(new PublicKey(addr)),
                    conn.getParsedTokenAccountsByOwner(new PublicKey(addr), {
                        programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
                    }).catch(() => ({ value: [] })), // Graceful fallback
                    conn.getSignaturesForAddress(new PublicKey(addr), { limit: 50 })
                        .catch(() => []) // Graceful fallback
                ]);

                // Analyze detailed transactions for flows and interactions
                const detailedTransactions = await Promise.all(
                    signatures.slice(0, 20).map(async (sig) => {
                        try {
                            const tx = await conn.getParsedTransaction(sig.signature, {
                                maxSupportedTransactionVersion: 0
                            });
                            return { signature: sig, transaction: tx };
                        } catch (e) {
                            return { signature: sig, transaction: null };
                        }
                    })
                );

                // Analyze inflow/outflow transactions
                const flows = {
                    inflow: [] as Array<{ address: string, txId: string, amount: number, token?: string }>,
                    outflow: [] as Array<{ address: string, txId: string, amount: number, token?: string }>,
                    nftActions: [] as Array<{ action: string, mint: string, txId: string, counterparty?: string }>,
                    lpActions: [] as Array<{ action: string, pool: string, txId: string, tokens: string[] }>
                };

                for (const { signature, transaction } of detailedTransactions) {
                    if (!transaction?.meta) continue;

                    const txId = signature.signature;
                    const { preBalances, postBalances } = transaction.meta;
                    const accountKeys = transaction.transaction.message.accountKeys;

                    // Analyze SOL flows
                    const walletIndex = accountKeys.findIndex(key => key.pubkey.toString() === addr);
                    if (walletIndex !== -1 && preBalances[walletIndex] !== undefined && postBalances[walletIndex] !== undefined) {
                        const balanceChange = postBalances[walletIndex] - preBalances[walletIndex];
                        if (balanceChange > 0) {
                            // Find source of inflow
                            accountKeys.forEach((key, index) => {
                                if (index !== walletIndex && preBalances[index] > postBalances[index]) {
                                    const amount = (preBalances[index] - postBalances[index]) / 1_000_000_000;
                                    if (amount > 0.001) { // Filter dust
                                        flows.inflow.push({
                                            address: key.pubkey.toString(),
                                            txId,
                                            amount,
                                            token: 'SOL'
                                        });
                                    }
                                }
                            });
                        } else if (balanceChange < 0) {
                            // Find destination of outflow
                            accountKeys.forEach((key, index) => {
                                if (index !== walletIndex && postBalances[index] > preBalances[index]) {
                                    const amount = (postBalances[index] - preBalances[index]) / 1_000_000_000;
                                    if (amount > 0.001) { // Filter dust
                                        flows.outflow.push({
                                            address: key.pubkey.toString(),
                                            txId,
                                            amount,
                                            token: 'SOL'
                                        });
                                    }
                                }
                            });
                        }
                    }

                    // Analyze token transfers
                    if (transaction.meta.preTokenBalances && transaction.meta.postTokenBalances) {
                        const preTokenBalances = transaction.meta.preTokenBalances;
                        const postTokenBalances = transaction.meta.postTokenBalances;

                        // Find token changes for our wallet
                        preTokenBalances.forEach(preBalance => {
                            if (preBalance.owner === addr) {
                                const postBalance = postTokenBalances.find(post =>
                                    post.accountIndex === preBalance.accountIndex
                                );
                                if (postBalance) {
                                    const preAmount = parseFloat(preBalance.uiTokenAmount.uiAmountString || '0');
                                    const postAmount = parseFloat(postBalance.uiTokenAmount.uiAmountString || '0');
                                    const change = postAmount - preAmount;

                                    if (Math.abs(change) > 0.001) {
                                        if (change > 0) {
                                            // Token inflow - find sender
                                            const senderBalance = preTokenBalances.find(pb =>
                                                pb.mint === preBalance.mint && pb.owner !== addr &&
                                                parseFloat(pb.uiTokenAmount.uiAmountString || '0') > change
                                            );
                                            if (senderBalance) {
                                                flows.inflow.push({
                                                    address: senderBalance.owner || 'Unknown',
                                                    txId,
                                                    amount: change,
                                                    token: preBalance.mint
                                                });
                                            }
                                        } else {
                                            // Token outflow - find receiver
                                            const receiverBalance = postTokenBalances.find(pb =>
                                                pb.mint === preBalance.mint && pb.owner !== addr
                                            );
                                            if (receiverBalance) {
                                                flows.outflow.push({
                                                    address: receiverBalance.owner || 'Unknown',
                                                    txId,
                                                    amount: Math.abs(change),
                                                    token: preBalance.mint
                                                });
                                            }
                                        }
                                    }
                                }
                            }
                        });
                    }

                    // Analyze instructions for NFT and LP actions
                    if (transaction.transaction.message.instructions) {
                        transaction.transaction.message.instructions.forEach((instruction: any) => {
                            const programId = instruction.programId?.toString() || '';

                            // NFT Program detection (Metaplex, etc.)
                            if (programId === 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s' || // Metaplex
                                programId === 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') {
                                // Check for NFT-like patterns (decimals = 0, supply = 1)
                                if (instruction.parsed?.type === 'transfer' &&
                                    instruction.parsed?.info?.amount === '1') {
                                    flows.nftActions.push({
                                        action: 'Transfer',
                                        mint: instruction.parsed.info.mint || 'Unknown',
                                        txId,
                                        counterparty: instruction.parsed.info.destination || 'Unknown'
                                    });
                                }
                            }

                            // LP/DEX Program detection (Raydium, Orca, etc.)
                            if (programId === 'RVKd61ztZW9GUwhRbbLoYVRE5Xf1B2tVscKqwZqXgEr' || // Raydium
                                programId === 'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc' || // Orca
                                programId === '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM') { // Raydium V4
                                flows.lpActions.push({
                                    action: instruction.parsed?.type || 'LP Operation',
                                    pool: instruction.accounts?.[0]?.toString() || 'Unknown',
                                    txId,
                                    tokens: instruction.accounts?.slice(1, 3).map((acc: any) => acc.toString()) || []
                                });
                            }
                        });
                    }
                }

                const sol = balance / 1_000_000_000;
                let reply = `🔍 **Comprehensive Wallet Analysis for ${addr}**

📊 **Account Information:**
- **Balance:** ${sol} SOL (${balance} lamports)
- **Owner:** ${accountInfo?.owner?.toString() || 'N/A'}
- **Executable:** ${accountInfo?.executable ? 'Yes (Program Account)' : 'No'}
- **Data Length:** ${accountInfo?.data?.length || 0} bytes
- **Rent Epoch:** ${accountInfo?.rentEpoch || 'N/A'}

💰 **Token Holdings:**`;

                if (tokenAccounts.value.length > 0) {
                    reply += `\n- **Total Tokens:** ${tokenAccounts.value.length}\n`;
                    tokenAccounts.value.forEach((token, index) => {
                        const mint = token.account.data.parsed.info.mint;
                        const amount = token.account.data.parsed.info.tokenAmount.uiAmount || 0;
                        const decimals = token.account.data.parsed.info.tokenAmount.decimals;
                        reply += `  ${index + 1}. **Mint:** ${mint}\n     **Amount:** ${amount} (${decimals} decimals)\n`;
                    });
                } else {
                    reply += `\n- No SPL tokens found\n`;
                }

                // Inflow transactions
                reply += `\n📈 **Inflow Transactions (Recent):**`;
                if (flows.inflow.length > 0) {
                    flows.inflow.forEach((flow, index) => {
                        reply += `\n  ${index + 1}. **From:** ${flow.address}\n     **Amount:** ${flow.amount} ${flow.token}\n     **Transaction:** ${flow.txId}\n`;
                    });
                } else {
                    reply += `\n- No recent inflow transactions found\n`;
                }

                // Outflow transactions
                reply += `\n📉 **Outflow Transactions (Recent):**`;
                if (flows.outflow.length > 0) {
                    flows.outflow.forEach((flow, index) => {
                        reply += `\n  ${index + 1}. **To:** ${flow.address}\n     **Amount:** ${flow.amount} ${flow.token}\n     **Transaction:** ${flow.txId}\n`;
                    });
                } else {
                    reply += `\n- No recent outflow transactions found\n`;
                }

                // NFT Actions
                reply += `\n🎨 **NFT Actions (Recent):**`;
                if (flows.nftActions.length > 0) {
                    flows.nftActions.forEach((nft, index) => {
                        reply += `\n  ${index + 1}. **Action:** ${nft.action}\n     **NFT Mint:** ${nft.mint}\n     **Transaction:** ${nft.txId}`;
                        if (nft.counterparty) {
                            reply += `\n     **Counterparty:** ${nft.counterparty}`;
                        }
                        reply += '\n';
                    });
                } else {
                    reply += `\n- No recent NFT actions found\n`;
                }

                // LP Actions
                reply += `\n🏊 **Liquidity Pool Actions (Recent):**`;
                if (flows.lpActions.length > 0) {
                    flows.lpActions.forEach((lp, index) => {
                        reply += `\n  ${index + 1}. **Action:** ${lp.action}\n     **Pool:** ${lp.pool}\n     **Transaction:** ${lp.txId}`;
                        if (lp.tokens.length > 0) {
                            reply += `\n     **Tokens:** ${lp.tokens.join(', ')}`;
                        }
                        reply += '\n';
                    });
                } else {
                    reply += `\n- No recent LP actions found\n`;
                }

                reply += `\n📈 **Recent Activity Summary:**`;
                if (signatures.length > 0) {
                    reply += `\n- **Total Recent Transactions:** ${signatures.length}\n`;

                    // Enhanced transaction analysis with detailed information
                    for (let i = 0; i < Math.min(10, signatures.length); i++) {
                        const sig = signatures[i];
                        const status = sig.err ? '❌ Failed' : '✅ Success';
                        const shortDate = sig.blockTime ? new Date(sig.blockTime * 1000).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            timeZone: 'UTC'
                        }) + ' UTC' : 'Unknown';

                        reply += `  ${i + 1}. **Transaction:** ${sig.signature}\n     **Status:** ${status}\n     **Date:** ${shortDate}\n`;

                        // Find corresponding detailed transaction for balance movement info
                        const detailedTx = detailedTransactions.find(tx => tx.signature.signature === sig.signature);
                        if (detailedTx?.transaction?.meta) {
                            const { preBalances, postBalances } = detailedTx.transaction.meta;
                            const accountKeys = detailedTx.transaction.transaction.message.accountKeys;

                            // Find wallet index and calculate SOL balance change
                            const walletIndex = accountKeys.findIndex(key => key.pubkey.toString() === addr);
                            if (walletIndex !== -1 && preBalances[walletIndex] !== undefined && postBalances[walletIndex] !== undefined) {
                                const balanceChange = postBalances[walletIndex] - preBalances[walletIndex];
                                const balanceChangeSOL = balanceChange / 1_000_000_000;

                                if (Math.abs(balanceChangeSOL) > 0.001) {
                                    if (balanceChange > 0) {
                                        reply += `     **SOL Movement:** +${balanceChangeSOL.toFixed(9)} SOL (Inflow)\n`;

                                        // Find source of SOL
                                        accountKeys.forEach((key, index) => {
                                            if (index !== walletIndex && preBalances[index] > postBalances[index]) {
                                                const sourceChange = (preBalances[index] - postBalances[index]) / 1_000_000_000;
                                                if (sourceChange > 0.001) {
                                                    reply += `     **From:** ${key.pubkey.toString()}\n`;
                                                }
                                            }
                                        });
                                    } else {
                                        reply += `     **SOL Movement:** ${balanceChangeSOL.toFixed(9)} SOL (Outflow)\n`;

                                        // Find destination of SOL
                                        accountKeys.forEach((key, index) => {
                                            if (index !== walletIndex && postBalances[index] > preBalances[index]) {
                                                const destChange = (postBalances[index] - preBalances[index]) / 1_000_000_000;
                                                if (destChange > 0.001) {
                                                    reply += `     **To:** ${key.pubkey.toString()}\n`;
                                                }
                                            }
                                        });
                                    }
                                }
                            }

                            // Analyze token movements for this transaction
                            if (detailedTx.transaction.meta.preTokenBalances && detailedTx.transaction.meta.postTokenBalances) {
                                const preTokenBalances = detailedTx.transaction.meta.preTokenBalances;
                                const postTokenBalances = detailedTx.transaction.meta.postTokenBalances;

                                // Find token changes for our wallet in this specific transaction
                                preTokenBalances.forEach(preBalance => {
                                    if (preBalance.owner === addr) {
                                        const postBalance = postTokenBalances.find(post =>
                                            post.accountIndex === preBalance.accountIndex
                                        );
                                        if (postBalance) {
                                            const preAmount = parseFloat(preBalance.uiTokenAmount.uiAmountString || '0');
                                            const postAmount = parseFloat(postBalance.uiTokenAmount.uiAmountString || '0');
                                            const change = postAmount - preAmount;

                                            if (Math.abs(change) > 0.001) {
                                                const mintShort = `${preBalance.mint.slice(0, 8)}...${preBalance.mint.slice(-4)}`;
                                                if (change > 0) {
                                                    reply += `     **Token Movement:** +${change} ${mintShort} (Inflow)\n`;
                                                    reply += `     **Token Mint:** ${preBalance.mint}\n`;

                                                    // Find token sender
                                                    const senderBalance = preTokenBalances.find(pb =>
                                                        pb.mint === preBalance.mint && pb.owner !== addr
                                                    );
                                                    if (senderBalance) {
                                                        reply += `     **Token From:** ${senderBalance.owner}\n`;
                                                    }
                                                } else {
                                                    reply += `     **Token Movement:** ${change} ${mintShort} (Outflow)\n`;
                                                    reply += `     **Token Mint:** ${preBalance.mint}\n`;

                                                    // Find token receiver
                                                    const receiverBalance = postTokenBalances.find(pb =>
                                                        pb.mint === preBalance.mint && pb.owner !== addr
                                                    );
                                                    if (receiverBalance) {
                                                        reply += `     **Token To:** ${receiverBalance.owner}\n`;
                                                    }
                                                }
                                            }
                                        }
                                    }
                                });
                            }

                            // Add fee information
                            if (detailedTx.transaction.meta.fee) {
                                const feeSOL = detailedTx.transaction.meta.fee / 1_000_000_000;
                                reply += `     **Transaction Fee:** ${feeSOL.toFixed(9)} SOL\n`;
                            }
                        }

                        reply += '\n';
                    }

                    if (signatures.length > 10) {
                        reply += `  ... and ${signatures.length - 10} more transactions\n`;
                    }
                } else {
                    reply += `\n- No recent transactions found\n`;
                }

                // Add program information if it's an executable account
                if (accountInfo?.executable) {
                    reply += `\n🔧 **Program Information:**
- This is an executable program account
- Program ID: ${addr}
- Can be invoked by other programs and transactions`;
                }

                return {
                    handled: true,
                    response: new Response(reply, {
                        status: 200,
                        headers: { "Content-Type": "text/plain" }
                    })
                };
            }

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
