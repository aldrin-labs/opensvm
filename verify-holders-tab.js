const puppeteer = require('puppeteer');

async function verifyHoldersTab() {
  console.log('🔍 Testing Holders tab functionality...\n');
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Navigate to token page
    const url = 'http://localhost:3000/token/Cpzvdx6pppc9TNArsGsqgShCsKC9NCCjA2gtzHvUpump';
    console.log(`📍 Navigating to: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
    
    // Wait for page to load
    await page.waitForTimeout(2000);
    
    // Find and click Holders tab
    console.log('\n🖱️  Looking for Holders tab...');
    const holdersTabClicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const holdersButton = buttons.find(btn => 
        btn.textContent.toLowerCase().includes('holders')
      );
      if (holdersButton) {
        holdersButton.click();
        return true;
      }
      return false;
    });
    
    if (!holdersTabClicked) {
      console.log('❌ Could not find Holders tab button');
      return false;
    }
    
    console.log('✓ Holders tab clicked');
    
    // Wait for holder data to load
    await page.waitForTimeout(3000);
    
    // Check for holder analytics components
    console.log('\n📊 Checking for holder analytics data...');
    
    const holderData = await page.evaluate(() => {
      const results = {
        totalHoldersCard: false,
        concentrationCard: false,
        whaleRiskCard: false,
        decentralizationCard: false,
        pieChart: false,
        barChart: false,
        topHoldersTable: false,
        holderAddresses: [],
        metrics: {}
      };
      
      // Check for metric cards
      const cards = Array.from(document.querySelectorAll('[class*="card"]'));
      const cardTexts = cards.map(c => c.textContent.toLowerCase());
      
      results.totalHoldersCard = cardTexts.some(t => t.includes('total holders'));
      results.concentrationCard = cardTexts.some(t => t.includes('concentration'));
      results.whaleRiskCard = cardTexts.some(t => t.includes('whale risk'));
      results.decentralizationCard = cardTexts.some(t => t.includes('decentralization'));
      
      // Check for charts
      results.pieChart = !!document.querySelector('svg [class*="recharts"]');
      
      // Check for holder table
      const tables = Array.from(document.querySelectorAll('table'));
      if (tables.length > 0) {
        results.topHoldersTable = true;
        
        // Extract holder addresses from table
        const rows = Array.from(tables[0].querySelectorAll('tbody tr'));
        results.holderAddresses = rows.slice(0, 5).map(row => {
          const cells = row.querySelectorAll('td');
          return cells.length > 1 ? cells[1].textContent.trim() : '';
        }).filter(addr => addr.length > 0);
      }
      
      // Extract metrics
      const allText = document.body.textContent;
      const holderMatch = allText.match(/(\d{1,3}(?:,\d{3})*)\s*(?:Active wallets|holders)/i);
      if (holderMatch) {
        results.metrics.totalHolders = holderMatch[1];
      }
      
      return results;
    });
    
    // Verify API data
    console.log('\n🔍 Verifying holder data from API...');
    const apiResponse = await page.evaluate(async () => {
      try {
        const response = await fetch('/api/token/Cpzvdx6pppc9TNArsGsqgShCsKC9NCCjA2gtzHvUpump/holders');
        const data = await response.json();
        return {
          success: true,
          holderCount: data.holders?.length || 0,
          totalSupply: data.totalSupply,
          topHolder: data.holders?.[0]?.address || null,
          top10Percentage: data.holders?.slice(0, 10).reduce((sum, h) => sum + h.percentage, 0) || 0
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    
    // Print results
    console.log('\n📋 Holder Tab Components:');
    console.log('========================');
    console.log(`${holderData.totalHoldersCard ? '✓' : '❌'} Total Holders Card`);
    console.log(`${holderData.concentrationCard ? '✓' : '❌'} Concentration Card`);
    console.log(`${holderData.whaleRiskCard ? '✓' : '❌'} Whale Risk Card`);
    console.log(`${holderData.decentralizationCard ? '✓' : '❌'} Decentralization Card`);
    console.log(`${holderData.pieChart ? '✓' : '❌'} Distribution Pie Chart`);
    console.log(`${holderData.topHoldersTable ? '✓' : '❌'} Top Holders Table`);
    
    if (holderData.metrics.totalHolders) {
      console.log(`\n📊 Displayed Metrics:`);
      console.log(`   Total Holders: ${holderData.metrics.totalHolders}`);
    }
    
    if (holderData.holderAddresses.length > 0) {
      console.log(`\n👥 Top Holder Addresses (from UI):`);
      holderData.holderAddresses.forEach((addr, i) => {
        console.log(`   ${i + 1}. ${addr}`);
      });
    }
    
    console.log('\n🔌 API Data Verification:');
    console.log('========================');
    if (apiResponse.success) {
      console.log(`✓ API responded successfully`);
      console.log(`   Total Holders: ${apiResponse.holderCount.toLocaleString()}`);
      console.log(`   Total Supply: ${apiResponse.totalSupply.toLocaleString()}`);
      console.log(`   Top Holder: ${apiResponse.topHolder?.substring(0, 8)}...`);
      console.log(`   Top 10 Control: ${apiResponse.top10Percentage.toFixed(2)}%`);
    } else {
      console.log(`❌ API failed: ${apiResponse.error}`);
    }
    
    // Final verdict
    const allComponentsPresent = 
      holderData.totalHoldersCard &&
      holderData.concentrationCard &&
      holderData.whaleRiskCard &&
      holderData.decentralizationCard &&
      holderData.topHoldersTable &&
      apiResponse.success;
    
    console.log('\n' + '='.repeat(50));
    if (allComponentsPresent) {
      console.log('✅ SUCCESS: Holders tab is complete and functional!');
      console.log('   - All metric cards present');
      console.log('   - Holder table displaying data');
      console.log('   - API endpoint working correctly');
    } else {
      console.log('⚠️  INCOMPLETE: Some components missing');
    }
    console.log('='.repeat(50));
    
    return allComponentsPresent;
    
  } catch (error) {
    console.error('❌ Error during verification:', error.message);
    return false;
  } finally {
    await browser.close();
  }
}

verifyHoldersTab().then(success => {
  process.exit(success ? 0 : 1);
});
