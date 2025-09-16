import { validateSolanaAddress } from '../lib/solana';

async function main() {
  const address = process.argv[2]; // Get address from command line argument

  if (!address) {
    console.error('Usage: ts-node scripts/validate-solana-address.ts <SOLANA_ADDRESS>');
    process.exit(1);
  }

  try {
    validateSolanaAddress(address);
    console.log(`Address "${address}" is a VALID Solana address.`);
  } catch (error: any) {
    console.error(`Address "${address}" is NOT a valid Solana address. Error: ${error.message}`);
  }
}

main();
