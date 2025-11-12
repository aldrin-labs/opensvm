const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(60000);
    
    const consoleMessages = [];
    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    
    const tokenUrl = 'http://localhost:3000/token/Cpzvdx6pppc9TNArsGsqgShCsKC9NCCjA2gtzHvUpump';
    console.log('🔍 Validating token page DATA at', tokenUrl);
    console.log('⏳ Loading page...\n');
    
    await page.goto(tokenUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    
    // ========================================
    // VALIDATE MAIN METRICS
    // ========================================
    console.log('📊 Validating Main Metrics:');
    console.log('============================');
    
    const metrics = await page.evaluate(() => {
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
    
    const validateMetric = (name, value, shouldHaveData = true) => {
      if (!value || value === '$0.00' || value === '$0' || value === '0') {
        if (shouldHaveData) {
          console.log(`❌ ${name}: No data (${value || 'null'})`);
          return false;
        } else {
          console.log(`⚠️  ${name}: No data (${value || 'null'}) - may be expected`);
          return true;
        }
      }
      console.log(`✓ ${name}: ${value}`);
      return true;
    };
    
    let metricsValid = true;
    metricsValid &= validateMetric('Price', metrics.price);
    metricsValid &= validateMetric('Market Cap', metrics.marketCap);
    metricsValid &= validateMetric('Volume 24h', metrics.volume, false); // May be 0
    metricsValid &= validateMetric('Liquidity', metrics.liquidity, false); // May be 0
    metricsValid &= validateMetric('Supply', metrics.supply);
    metricsValid &= validateMetric('Holders', metrics.holders);
    
    // ========================================
    // VALIDATE CHART TAB
    // ========================================
    console.log('\n📈 Validating Chart Tab:');
    console.log('========================');
    
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const chartTab = buttons.find(btn => btn.textContent.trim() === 'Chart');
      if (chartTab) chartTab.click();
    });
    await page.waitForTimeout(2000);
    
    const chartData = await page.evaluate(() => {
      const hasChart = document.querySelector('.recharts-wrapper') !== null;
      const hasTimeframeButtons = Array.from(document.querySelectorAll('button'))
        .some(btn => ['1H', '4H', '1D', '1W'].includes(btn.textContent.trim()));
      const hasTechnicalIndicators = document.querySelector('[class*="technical"]') !== null ||
        Array.from(document.querySelectorAll('div')).some(el => 
          el.textContent.includes('RSI') || el.textContent.includes('MACD')
        );
      
      return { hasChart, hasTimeframeButtons, hasTechnicalIndicators };
    });
    
    console.log(chartData.hasChart ? '✓ Chart rendered' : '❌ Chart NOT rendered');
    console.log(chartData.hasTimeframeButtons ? '✓ Timeframe buttons present' : '❌ Timeframe buttons missing');
    console.log(chartData.hasTechnicalIndicators ? '✓ Technical indicators present' : '⚠️  Technical indicators not found');
    
    // ========================================
    // VALIDATE ANALYTICS TAB
    // ========================================
    console.log('\n📊 Validating Analytics Tab:');
    console.log('============================');
    
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const analyticsTab = buttons.find(btn => btn.textContent.trim() === 'Analytics');
      if (analyticsTab) analyticsTab.click();
    });
    await page.waitForTimeout(2000);
    
    const analyticsData = await page.evaluate(() => {
      const hasMarketStats = Array.from(document.querySelectorAll('h3, .text-lg, .font-semibold'))
        .some(el => el.textContent.includes('Market Statistics'));
      const hasSupplyMetrics = Array.from(document.querySelectorAll('h3, .text-lg, .font-semibold'))
        .some(el => el.textContent.includes('Supply Metrics'));
      
      return { hasMarketStats, hasSupplyMetrics };
    });
    
    console.log(analyticsData.hasMarketStats ? '✓ Market Statistics section present' : '❌ Market Statistics missing');
    console.log(analyticsData.hasSupplyMetrics ? '✓ Supply Metrics section present' : '❌ Supply Metrics missing');
    
    // ========================================
    // VALIDATE HOLDERS TAB
    // ========================================
    console.log('\n👥 Validating Holders Tab:');
    console.log('==========================');
    
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const holdersTab = buttons.find(btn => btn.textContent.trim() === 'Holders');
      if (holdersTab) holdersTab.click();
    });
    await page.waitForTimeout(3000); // Holders may take longer to load
    
    const holdersData = await page.evaluate(() => {
      const hasHoldersList = document.querySelector('table') !== null ||
        Array.from(document.querySelectorAll('div')).some(el => 
          el.textContent.includes('Address') || el.textContent.includes('Balance')
        );
      const hasDistributionChart = document.querySelector('.recharts-wrapper') !== null;
      const hasConcentrationMetrics = Array.from(document.querySelectorAll('div')).some(el =>
        el.textContent.includes('Top 10') || el.textContent.includes('Top 50')
      );
      
      return { hasHoldersList, hasDistributionChart, hasConcentrationMetrics };
    });
    
    console.log(holdersData.hasHoldersList ? '✓ Holders list/table present' : '⚠️  Holders list not found');
    console.log(holdersData.hasDistributionChart ? '✓ Distribution chart present' : '⚠️  Distribution chart not found');
    console.log(holdersData.hasConcentrationMetrics ? '✓ Concentration metrics present' : '⚠️  Concentration metrics not found');
    
    // ========================================
    // VALIDATE DEX TAB
    // ========================================
    console.log('\n💱 Validating DEX Tab:');
    console.log('======================');
    
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const dexTab = buttons.find(btn => btn.textContent.trim() === 'DEX');
      if (dexTab) dexTab.click();
    });
    await page.waitForTimeout(2000);
    
    const dexData = await page.evaluate(() => {
      const hasPools = Array.from(document.querySelectorAll('div')).some(el =>
        el.textContent.includes('Pool') || el.textContent.includes('Liquidity Pool')
      );
      const hasDEXNames = Array.from(document.querySelectorAll('div')).some(el =>
        el.textContent.includes('Raydium') || el.textContent.includes('Orca') || 
        el.textContent.includes('Jupiter') || el.textContent.includes('DEX')
      );
      
      return { hasPools, hasDEXNames };
    });
    
    console.log(dexData.hasPools ? '✓ Pool information present' : '⚠️  Pool information not found');
    console.log(dexData.hasDEXNames ? '✓ DEX names/data present' : '⚠️  DEX data not found');
    
    // ========================================
    // VALIDATE AI INSIGHTS TAB
    // ========================================
    console.log('\n🤖 Validating AI Insights Tab:');
    console.log('===============================');
    
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const aiTab = buttons.find(btn => btn.textContent.trim() === 'AI Insights');
      if (aiTab) aiTab.click();
    });
    await page.waitForTimeout(2000);
    
    const aiData = await page.evaluate(() => {
      const hasAIContent = Array.from(document.querySelectorAll('div')).some(el =>
        el.textContent.includes('Analysis') || el.textContent.includes('Insight') ||
        el.textContent.includes('AI') || el.textContent.length > 100
      );
      
      return { hasAIContent };
    });
    
    console.log(aiData.hasAIContent ? '✓ AI insights content present' : '⚠️  AI insights content not found');
    
    // ========================================
    // VALIDATE ACTIVITY TAB
    // ========================================
    console.log('\n⚡ Validating Activity Tab:');
    console.log('===========================');
    
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const activityTab = buttons.find(btn => btn.textContent.trim() === 'Activity');
      if (activityTab) activityTab.click();
    });
    await page.waitForTimeout(3000); // Activity feed may take longer
    
    const activityData = await page.evaluate(() => {
      const hasTransactions = Array.from(document.querySelectorAll('div')).some(el =>
        el.textContent.includes('Transaction') || el.textContent.includes('Signature')
      );
      const hasTimestamps = Array.from(document.querySelectorAll('div')).some(el =>
        el.textContent.includes('ago') || el.textContent.match(/\d+[smhd]/)
      );
      const hasAddresses = Array.from(document.querySelectorAll('.font-mono')).length > 0;
      
      return { hasTransactions, hasTimestamps, hasAddresses };
    });
    
    console.log(activityData.hasTransactions ? '✓ Transaction data present' : '⚠️  Transaction data not found');
    console.log(activityData.hasTimestamps ? '✓ Timestamps present' : '⚠️  Timestamps not found');
    console.log(activityData.hasAddresses ? '✓ Addresses displayed' : '⚠️  Addresses not found');
    
    // ========================================
    // FINAL SUMMARY
    // ========================================
    console.log('\n📋 Data Validation Summary:');
    console.log('============================');
    console.log(`✓ Page loaded successfully`);
    console.log(`✓ Critical errors: ${errors.length}`);
    console.log(`✓ Main metrics: ${metricsValid ? 'Valid' : 'Issues detected'}`);
    console.log(`✓ Chart tab: ${chartData.hasChart ? 'Has data' : 'No data'}`);
    console.log(`✓ Analytics tab: ${analyticsData.hasMarketStats && analyticsData.hasSupplyMetrics ? 'Has data' : 'Partial data'}`);
    console.log(`✓ Holders tab: ${holdersData.hasHoldersList ? 'Has data' : 'No data'}`);
    console.log(`✓ DEX tab: ${dexData.hasPools || dexData.hasDEXNames ? 'Has data' : 'No data'}`);
    console.log(`✓ AI Insights tab: ${aiData.hasAIContent ? 'Has data' : 'No data'}`);
    console.log(`✓ Activity tab: ${activityData.hasTransactions ? 'Has data' : 'No data'}`);
    
    const allDataValid = metricsValid && 
                        chartData.hasChart && 
                        (analyticsData.hasMarketStats || analyticsData.hasSupplyMetrics);
    
    if (allDataValid && errors.length === 0) {
      console.log('\n✅ All data validation passed! Token page is displaying real data.');
      process.exit(0);
    } else {
      console.log('\n⚠️  Some data validation issues detected. Review above for details.');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
