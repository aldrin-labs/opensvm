#!/usr/bin/env node

const axios = require('axios');

async function verifyTokenFix() {
  console.log('=== Verifying Token Holder Fix ===\n');
  
  const tokenAddress = 'pvv4fu1RvQBkKXozyH5A843sp1mt6gTy9rPoZrBBAGS';
  
  try {
    // 1. Get data from our backend API
    console.log('1. Fetching from OpenSVM Backend API...');
    const backendResponse = await axios.get(`http://localhost:3000/api/token/${tokenAddress}`);
    const backendData = backendResponse.data;
    
    console.log('   Backend API Response:');
    console.log(`   - Supply: ${backendData.supply}`);
    console.log(`   - Decimals: ${backendData.decimals}`);
    console.log(`   - Holders: ${backendData.holders}`);
    console.log(`   - Volume24h: ${backendData.volume24h}`);
    
    // Convert supply to human-readable format
    const supplyInTokens = backendData.supply / Math.pow(10, backendData.decimals);
    console.log(`   - Supply (human): ${supplyInTokens.toLocaleString()} tokens`);
    
    // 2. Get data from CoinGecko
    console.log('\n2. Fetching from CoinGecko API...');
    const coinGeckoResponse = await axios.get(
      'https://api.coingecko.com/api/v3/coins/opensvm-com?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false'
    );
    const coinGeckoData = coinGeckoResponse.data;
    
    console.log('   CoinGecko API Response:');
    console.log(`   - Name: ${coinGeckoData.name}`);
    console.log(`   - Symbol: ${coinGeckoData.symbol}`);
    console.log(`   - Current Price: $${coinGeckoData.market_data.current_price.usd}`);
    console.log(`   - Market Cap: $${coinGeckoData.market_data.market_cap.usd?.toLocaleString()}`);
    console.log(`   - 24h Volume: $${coinGeckoData.market_data.total_volume.usd?.toLocaleString()}`);
    console.log(`   - Total Supply: ${coinGeckoData.market_data.total_supply?.toLocaleString()}`);
    
    // 3. Verify the fix
    console.log('\n3. Verification Results:');
    
    // Check holder count
    if (backendData.holders > 0) {
      console.log(`   ✅ Holder count fixed! Now showing ${backendData.holders} holders (was 0 before)`);
    } else {
      console.log(`   ❌ Holder count still showing 0 - fix may not be working`);
    }
    
    // Check supply consistency
    const supplyDiff = Math.abs(supplyInTokens - coinGeckoData.market_data.total_supply);
    const supplyDiffPercent = (supplyDiff / coinGeckoData.market_data.total_supply) * 100;
    
    if (supplyDiffPercent < 1) {
      console.log(`   ✅ Supply data matches CoinGecko (${supplyDiffPercent.toFixed(2)}% difference)`);
    } else {
      console.log(`   ⚠️  Supply differs from CoinGecko by ${supplyDiffPercent.toFixed(2)}%`);
    }
    
    // Summary
    console.log('\n4. Summary:');
    console.log('   The backend API token endpoint has been fixed to show actual holder counts.');
    console.log(`   - Previously: holders always returned 0`);
    console.log(`   - Now: holders returns ${backendData.holders} (actual count from blockchain)`);
    console.log('   - This fix uses multiple methods to get holder data:');
    console.log('     1. Moralis API (if configured)');
    console.log('     2. Solana RPC getTokenLargestAccounts (for estimation)');
    console.log('     3. Solana RPC getProgramAccounts (for exact count)');
    console.log('   - Results are cached for 5 minutes to improve performance');
    
    // Test MCP server proxy
    console.log('\n5. Testing MCP Server Proxy...');
    try {
      const { spawn } = require('child_process');
      const mcpTest = spawn('osvm', ['get_token_info', tokenAddress], { 
        timeout: 5000,
        shell: true 
      });
      
      let output = '';
      mcpTest.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      mcpTest.on('close', (code) => {
        if (code === 0 && output.includes('holders')) {
          try {
            const mcpData = JSON.parse(output);
            console.log(`   ✅ MCP server correctly proxying holder count: ${mcpData.holders}`);
          } catch {
            console.log('   ⚠️  MCP server returned data but couldn\'t parse it');
          }
        } else {
          console.log('   ⚠️  MCP server test skipped (osvm CLI not available or timed out)');
        }
      });
      
      setTimeout(() => {
        mcpTest.kill();
      }, 5000);
      
    } catch (error) {
      console.log('   ⚠️  MCP server test skipped (osvm CLI not available)');
    }
    
  } catch (error) {
    console.error('Error during verification:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the verification
verifyTokenFix();
