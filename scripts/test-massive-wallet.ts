
import { Connection, PublicKey } from '@solana/web3.js';

const WALLET = '69yhtoJR4JYPPABZcSNkzuqbaFbwHsCkja1sP1Q2aVT5'; // Massive wallet
const API_URL = 'http://localhost:3001/api/account-transfers/' + WALLET;

async function test() {
  console.log(`Testing API for wallet: ${WALLET}`);
  const start = Date.now();
  
  try {
    const response = await fetch(API_URL);
    const end = Date.now();
    const duration = (end - start) / 1000;
    
    console.log(`Status: ${response.status}`);
    console.log(`Duration: ${duration.toFixed(2)}s`);
    
    if (response.ok) {
      const data = await response.json();
      console.log(`Data type: ${typeof data}`);
      if (Array.isArray(data)) {
        console.log(`Transfers found: ${data.length}`);
      } else {
        console.log('Data keys:', Object.keys(data));
        console.log('RPC Calls:', data.rpcCalls);
      }
    } else {
      console.error('Error:', await response.text());
    }
  } catch (error) {
    console.error('Fetch failed:', error);
  }
}

test();
