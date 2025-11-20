const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(60000);
    
    const tokenAddress = 'Cpzvdx6pppc9TNArsGsqgShCsKC9NCCjA2gtzHvUpump';
    const tokenUrl = `http://localhost:3000/token/${tokenAddress}`;
    
    console.log('🔍 Verifying Data Accuracy');
    console.log('==========================\n');
    
    // Fetch API data first
    console.log('📡 Fetching API data...');
    const apiResponse = await fetch(`http://localhost:3000/api/token/${tokenAddress}`);
    const apiData = await apiResponse.json();
    
    console.log('API Response:');
    console.log(`  Price: $${apiData.price}`);
    console.log(`  Market Cap: $${apiData.marketCap}`);
    console.log(`  Volume 24h: $${apiData.volume24h}`);
    console.log(`  Liquidity: $${apiData.liquidity}`);
    console.log(`  Supply: ${apiData.supply}`);
    console.log(`  Decimals: ${apiData.decimals}`);
    console.log(`  Holders: ${apiData.totalHolders || apiData.holders}`);
    
    // Load page
    console.log('\n⏳ Loading page...');
    await page.goto(tokenUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    
    // Extract displayed values
    const displayedData = await page.evaluate(() => {
      const getMetricValue = (label) => {
        const sections = Array.from(document.querySelectorAll('.space-y-1'));
        for (const section of sections) {
          const labelEl = section.querySelector('.text-muted-foreground');
          if (labelEl && labelEl.textContent.trim() === label) {
            const valueEl = section.querySelector('.text-2xl, .text-xl');
            return valueEl ? valueEl.textContent.trim() : null;
          }
        }
        return null;
      };
      
      return {
        price: getMetricValue('Price'),
        marketCap: getMetricValue('Market Cap'),
        volume: getMetricValue('Volume 24h'),
        liquidity: getMetricValue('Liquidity'),
        supply: getMetricValue('Supply'),
        holders: getMetricValue('Holders')
      };
    });
    
    console.log('\n📊 Displayed Values:');
    console.log(`  Price: ${displayedData.price}`);
    console.log(`  Market Cap: ${displayedData.marketCap}`);
    console.log(`  Volume 24h: ${displayedData.volume}`);
    console.log(`  Liquidity: ${displayedData.liquidity}`);
    console.log(`  Supply: ${displayedData.supply}`);
    console.log(`  Holders: ${displayedData.holders}`);
    
    // Verification functions
    const parseDisplayedNumber = (str) => {
      if (!str) return null;
      // Remove $ and commas
      str = str.replace(/[$,]/g, '');
      // Handle M/B suffixes
      if (str.endsWith('M')) {
        return parseFloat(str.replace('M', '')) * 1_000_000;
      }
      if (str.endsWith('B')) {
        return parseFloat(str.replace('B', '')) * 1_000_000_000;
      }
      return parseFloat(str);
    };
    
    const verifyValue = (name, displayed, apiValue, tolerance = 0.01) => {
      const displayedNum = parseDisplayedNumber(displayed);
      
      if (displayedNum === null) {
        console.log(`❌ ${name}: Could not parse displayed value "${displayed}"`);
        return false;
      }
      
      // Calculate percentage difference
      const diff = Math.abs(displayedNum - apiValue);
      const percentDiff = (diff / apiValue) * 100;
      
      if (percentDiff <= tolerance) {
        console.log(`✓ ${name}: CORRECT (${percentDiff.toFixed(4)}% diff)`);
        return true;
      } else {
        console.log(`❌ ${name}: MISMATCH`);
        console.log(`   Displayed: ${displayedNum}`);
        console.log(`   API: ${apiValue}`);
        console.log(`   Difference: ${percentDiff.toFixed(2)}%`);
        return false;
      }
    };
    
    console.log('\n🔬 Data Accuracy Verification:');
    console.log('================================');
    
    let allCorrect = true;
    
    // Verify each metric
    allCorrect &= verifyValue('Price', displayedData.price, apiData.price, 1); // 1% tolerance for rounding
    allCorrect &= verifyValue('Market Cap', displayedData.marketCap, apiData.marketCap, 1);
    allCorrect &= verifyValue('Volume 24h', displayedData.volume, apiData.volume24h, 1);
    allCorrect &= verifyValue('Liquidity', displayedData.liquidity, apiData.liquidity, 1);
    allCorrect &= verifyValue('Supply', displayedData.supply, apiData.supply, 0.1); // 0.1% tolerance
    allCorrect &= verifyValue('Holders', displayedData.holders, apiData.totalHolders || apiData.holders, 0);
    
    // Verify supply formatting specifically
    console.log('\n📐 Supply Formatting Verification:');
    console.log('===================================');
    const expectedSupplyDisplay = '999.71M';
    const actualSupplyDisplay = displayedData.supply;
    
    if (actualSupplyDisplay === expectedSupplyDisplay) {
      console.log(`✓ Supply format: CORRECT (${actualSupplyDisplay})`);
      console.log(`  Raw value: ${apiData.supply.toLocaleString()}`);
      console.log(`  Abbreviated: ${actualSupplyDisplay}`);
      console.log(`  Format rule: >10M shows as M suffix`);
    } else {
      console.log(`❌ Supply format: INCORRECT`);
      console.log(`  Expected: ${expectedSupplyDisplay}`);
      console.log(`  Actual: ${actualSupplyDisplay}`);
      allCorrect = false;
    }
    
    // Cross-check with CoinGecko if available
    console.log('\n🌐 External Data Source Verification:');
    console.log('======================================');
    try {
      const cgResponse = await fetch('https://api.coingecko.com/api/v3/coins/opensvm-com?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false');
      const cgData = await cgResponse.json();
      
      if (cgData.market_data) {
        const cgPrice = cgData.market_data.current_price?.usd;
        const cgMarketCap = cgData.market_data.market_cap?.usd;
        const cgVolume = cgData.market_data.total_volume?.usd;
        
        console.log('CoinGecko Data:');
        console.log(`  Price: $${cgPrice}`);
        console.log(`  Market Cap: $${cgMarketCap}`);
        console.log(`  Volume 24h: $${cgVolume}`);
        
        // Compare with our API (allow larger tolerance for external source)
        const priceDiff = cgPrice ? Math.abs((apiData.price - cgPrice) / cgPrice * 100) : null;
        const mcDiff = cgMarketCap ? Math.abs((apiData.marketCap - cgMarketCap) / cgMarketCap * 100) : null;
        
        if (priceDiff !== null) {
          console.log(`\nPrice comparison with CoinGecko: ${priceDiff.toFixed(2)}% difference`);
          if (priceDiff < 5) {
            console.log('✓ Price is within 5% of CoinGecko (acceptable)');
          } else {
            console.log('⚠️  Price differs >5% from CoinGecko (may indicate stale data)');
          }
        }
        
        if (mcDiff !== null) {
          console.log(`Market Cap comparison: ${mcDiff.toFixed(2)}% difference`);
          if (mcDiff < 5) {
            console.log('✓ Market Cap is within 5% of CoinGecko (acceptable)');
          } else {
            console.log('⚠️  Market Cap differs >5% from CoinGecko');
          }
        }
      }
    } catch (cgError) {
      console.log('⚠️  Could not fetch CoinGecko data for comparison');
    }
    
    // Final summary
    console.log('\n📋 Final Verification Summary:');
    console.log('================================');
    
    if (allCorrect) {
      console.log('✅ ALL DATA VERIFIED CORRECT!');
      console.log('   - All displayed values match API responses');
      console.log('   - Supply formatting is correct (999.71M)');
      console.log('   - Data accuracy within acceptable tolerances');
      process.exit(0);
    } else {
      console.log('❌ DATA VERIFICATION FAILED');
      console.log('   - Some displayed values do not match API data');
      console.log('   - Review mismatches above');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
