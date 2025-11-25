/**
 * Test Script: Send Transactions to Devnet Dummy Programs
 *
 * This script tests backend transaction sending capabilities on Solana devnet:
 * 1. System Program - SOL transfers
 * 2. Memo Program - On-chain messages
 * 3. Token Program - Create ATA (if needed)
 *
 * Usage: npx ts-node scripts/test-devnet-transactions.ts
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  TransactionInstruction,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
  ComputeBudgetProgram,
} from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ESM compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Devnet RPC endpoint
const DEVNET_RPC = 'https://api.devnet.solana.com';

// Well-known program IDs
const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

// Test wallet storage
const WALLET_PATH = path.join(__dirname, '../.data/test-wallet.json');

interface TestResult {
  name: string;
  success: boolean;
  signature?: string;
  error?: string;
  duration: number;
}

class DevnetTransactionTester {
  private connection: Connection;
  private wallet: Keypair;
  private results: TestResult[] = [];

  constructor() {
    this.connection = new Connection(DEVNET_RPC, {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: 60000,
    });
    this.wallet = this.loadOrCreateWallet();
  }

  private loadOrCreateWallet(): Keypair {
    try {
      // Try to load existing wallet
      if (fs.existsSync(WALLET_PATH)) {
        const walletData = JSON.parse(fs.readFileSync(WALLET_PATH, 'utf-8'));
        console.log('[WALLET] Loaded existing test wallet');
        return Keypair.fromSecretKey(new Uint8Array(walletData));
      }
    } catch (error) {
      console.log('[WALLET] Could not load existing wallet, creating new one');
    }

    // Create new wallet
    const wallet = Keypair.generate();

    // Ensure directory exists
    const dir = path.dirname(WALLET_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Save wallet
    fs.writeFileSync(WALLET_PATH, JSON.stringify(Array.from(wallet.secretKey)));
    console.log('[WALLET] Created new test wallet');

    return wallet;
  }

  async checkBalance(): Promise<number> {
    const balance = await this.connection.getBalance(this.wallet.publicKey);
    return balance / LAMPORTS_PER_SOL;
  }

  async requestAirdrop(amount: number = 1): Promise<boolean> {
    console.log(`[AIRDROP] Requesting ${amount} SOL airdrop...`);

    try {
      const signature = await this.connection.requestAirdrop(
        this.wallet.publicKey,
        amount * LAMPORTS_PER_SOL
      );

      // Wait for confirmation
      const latestBlockhash = await this.connection.getLatestBlockhash();
      await this.connection.confirmTransaction({
        signature,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      });

      console.log(`[AIRDROP] Success! Signature: ${signature}`);
      return true;
    } catch (error: any) {
      console.error(`[AIRDROP] Failed: ${error.message}`);

      // Check if rate limited
      if (error.message?.includes('rate') || error.message?.includes('limit')) {
        console.log('[AIRDROP] Rate limited. Try again later or use https://faucet.solana.com');
      }

      return false;
    }
  }

  async ensureBalance(minBalance: number = 0.1): Promise<boolean> {
    const balance = await this.checkBalance();
    console.log(`[BALANCE] Current: ${balance.toFixed(4)} SOL`);

    if (balance < minBalance) {
      console.log(`[BALANCE] Below minimum (${minBalance} SOL), requesting airdrop...`);
      const success = await this.requestAirdrop(1);

      if (!success) {
        console.error('[BALANCE] Could not get airdrop. Please fund wallet manually:');
        console.error(`  Address: ${this.wallet.publicKey.toBase58()}`);
        console.error('  Faucet: https://faucet.solana.com');
        return false;
      }

      // Re-check balance
      const newBalance = await this.checkBalance();
      console.log(`[BALANCE] New balance: ${newBalance.toFixed(4)} SOL`);
    }

    return true;
  }

  // Test 1: Simple SOL transfer to self
  async testSolTransfer(): Promise<TestResult> {
    const start = Date.now();
    const name = 'SOL Transfer (System Program)';

    console.log(`\n[TEST] ${name}`);

    try {
      const transaction = new Transaction();

      // Add priority fee
      transaction.add(
        ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: 1000,
        })
      );

      // Transfer 0.001 SOL to self (just to test the flow)
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: this.wallet.publicKey,
          toPubkey: this.wallet.publicKey, // Transfer to self
          lamports: 0.001 * LAMPORTS_PER_SOL,
        })
      );

      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [this.wallet],
        { commitment: 'confirmed' }
      );

      const duration = Date.now() - start;
      console.log(`[TEST] SUCCESS - Signature: ${signature}`);
      console.log(`[TEST] Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);

      return { name, success: true, signature, duration };
    } catch (error: any) {
      const duration = Date.now() - start;
      console.error(`[TEST] FAILED - ${error.message}`);
      return { name, success: false, error: error.message, duration };
    }
  }

  // Test 2: Memo Program - Write on-chain message
  async testMemoProgram(): Promise<TestResult> {
    const start = Date.now();
    const name = 'Memo Program (On-chain Message)';

    console.log(`\n[TEST] ${name}`);

    try {
      const message = `OpenSVM Test @ ${new Date().toISOString()}`;

      const transaction = new Transaction();

      // Add priority fee
      transaction.add(
        ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: 1000,
        })
      );

      // Memo instruction
      transaction.add(
        new TransactionInstruction({
          keys: [
            { pubkey: this.wallet.publicKey, isSigner: true, isWritable: false },
          ],
          programId: MEMO_PROGRAM_ID,
          data: Buffer.from(message, 'utf-8'),
        })
      );

      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [this.wallet],
        { commitment: 'confirmed' }
      );

      const duration = Date.now() - start;
      console.log(`[TEST] SUCCESS - Message: "${message}"`);
      console.log(`[TEST] Signature: ${signature}`);
      console.log(`[TEST] Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);

      return { name, success: true, signature, duration };
    } catch (error: any) {
      const duration = Date.now() - start;
      console.error(`[TEST] FAILED - ${error.message}`);
      return { name, success: false, error: error.message, duration };
    }
  }

  // Test 3: Multiple transfers in one transaction
  async testBatchTransfer(): Promise<TestResult> {
    const start = Date.now();
    const name = 'Batch Transfer (Multiple Instructions)';

    console.log(`\n[TEST] ${name}`);

    try {
      // Create multiple recipient addresses (random)
      const recipients = [
        Keypair.generate().publicKey,
        Keypair.generate().publicKey,
        Keypair.generate().publicKey,
      ];

      // Get minimum rent-exempt balance for account
      const minBalance = await this.connection.getMinimumBalanceForRentExemption(0);
      console.log(`[TEST] Min rent-exempt balance: ${minBalance} lamports`);

      const transaction = new Transaction();

      // Add priority fee
      transaction.add(
        ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: 1000,
        })
      );

      // Add multiple transfers (rent-exempt amount to create accounts)
      for (const recipient of recipients) {
        transaction.add(
          SystemProgram.transfer({
            fromPubkey: this.wallet.publicKey,
            toPubkey: recipient,
            lamports: minBalance, // Rent-exempt minimum
          })
        );
      }

      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [this.wallet],
        { commitment: 'confirmed' }
      );

      const duration = Date.now() - start;
      console.log(`[TEST] SUCCESS - Sent to ${recipients.length} recipients`);
      console.log(`[TEST] Signature: ${signature}`);
      console.log(`[TEST] Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);

      return { name, success: true, signature, duration };
    } catch (error: any) {
      const duration = Date.now() - start;
      console.error(`[TEST] FAILED - ${error.message}`);
      return { name, success: false, error: error.message, duration };
    }
  }

  // Test 4: Transfer to known account (simulate order execution)
  async testOrderExecution(): Promise<TestResult> {
    const start = Date.now();
    const name = 'Order Execution Simulation';

    console.log(`\n[TEST] ${name}`);

    try {
      // Simulate a trading order - transfer SOL and log memo
      const tradeAmount = 0.01 * LAMPORTS_PER_SOL; // 0.01 SOL
      const orderMemo = JSON.stringify({
        type: 'ORDER_FILL',
        orderId: Date.now(),
        symbol: 'SOL/USDC',
        side: 'BUY',
        price: 150.00,
        qty: 0.01,
        timestamp: new Date().toISOString(),
      });

      const transaction = new Transaction();

      // Priority fee for faster inclusion
      transaction.add(
        ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: 5000, // Higher priority
        })
      );

      // Simulate trade settlement (transfer to self for demo)
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: this.wallet.publicKey,
          toPubkey: this.wallet.publicKey,
          lamports: tradeAmount,
        })
      );

      // Log trade details on-chain
      transaction.add(
        new TransactionInstruction({
          keys: [
            { pubkey: this.wallet.publicKey, isSigner: true, isWritable: false },
          ],
          programId: MEMO_PROGRAM_ID,
          data: Buffer.from(orderMemo, 'utf-8'),
        })
      );

      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [this.wallet],
        { commitment: 'confirmed' }
      );

      const duration = Date.now() - start;
      console.log(`[TEST] SUCCESS - Simulated order fill`);
      console.log(`[TEST] Order memo logged on-chain`);
      console.log(`[TEST] Signature: ${signature}`);
      console.log(`[TEST] Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);

      return { name, success: true, signature, duration };
    } catch (error: any) {
      const duration = Date.now() - start;
      console.error(`[TEST] FAILED - ${error.message}`);
      return { name, success: false, error: error.message, duration };
    }
  }

  // Test 5: Nonce account simulation (for long-lived transactions)
  async testComputeBudget(): Promise<TestResult> {
    const start = Date.now();
    const name = 'Compute Budget Test';

    console.log(`\n[TEST] ${name}`);

    try {
      const transaction = new Transaction();

      // Set compute unit limit
      transaction.add(
        ComputeBudgetProgram.setComputeUnitLimit({
          units: 200000,
        })
      );

      // Set compute unit price
      transaction.add(
        ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: 10000,
        })
      );

      // Simple transfer
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: this.wallet.publicKey,
          toPubkey: this.wallet.publicKey,
          lamports: 1000,
        })
      );

      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [this.wallet],
        { commitment: 'confirmed' }
      );

      const duration = Date.now() - start;
      console.log(`[TEST] SUCCESS - With custom compute budget`);
      console.log(`[TEST] Signature: ${signature}`);
      console.log(`[TEST] Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);

      return { name, success: true, signature, duration };
    } catch (error: any) {
      const duration = Date.now() - start;
      console.error(`[TEST] FAILED - ${error.message}`);
      return { name, success: false, error: error.message, duration };
    }
  }

  async runAllTests(): Promise<void> {
    console.log('='.repeat(60));
    console.log('  DEVNET TRANSACTION TEST SUITE');
    console.log('='.repeat(60));
    console.log(`  Wallet: ${this.wallet.publicKey.toBase58()}`);
    console.log(`  RPC: ${DEVNET_RPC}`);
    console.log('='.repeat(60));

    // Ensure we have enough balance
    const hasBalance = await this.ensureBalance(0.1);
    if (!hasBalance) {
      console.error('\n[ERROR] Insufficient balance. Cannot run tests.');
      return;
    }

    // Run tests
    this.results.push(await this.testSolTransfer());
    this.results.push(await this.testMemoProgram());
    this.results.push(await this.testBatchTransfer());
    this.results.push(await this.testOrderExecution());
    this.results.push(await this.testComputeBudget());

    // Print summary
    this.printSummary();
  }

  private printSummary(): void {
    console.log('\n' + '='.repeat(60));
    console.log('  TEST SUMMARY');
    console.log('='.repeat(60));

    const passed = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => !r.success).length;
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);

    for (const result of this.results) {
      const status = result.success ? '[PASS]' : '[FAIL]';
      const duration = `${result.duration}ms`;
      console.log(`  ${status} ${result.name} (${duration})`);
      if (result.signature) {
        console.log(`         Tx: ${result.signature.slice(0, 20)}...`);
      }
      if (result.error) {
        console.log(`         Error: ${result.error.slice(0, 50)}...`);
      }
    }

    console.log('='.repeat(60));
    console.log(`  Passed: ${passed}/${this.results.length}`);
    console.log(`  Failed: ${failed}/${this.results.length}`);
    console.log(`  Total Time: ${totalDuration}ms`);
    console.log('='.repeat(60));

    // Final balance
    this.checkBalance().then(balance => {
      console.log(`  Final Balance: ${balance.toFixed(4)} SOL`);
      console.log('='.repeat(60));
    });
  }
}

// Run tests
async function main() {
  const tester = new DevnetTransactionTester();
  await tester.runAllTests();
}

main().catch(console.error);
