const fetch = require('node-fetch');

// Configuration
const BASE_URL = 'http://localhost:3000/api';
const TOKEN_ADDRESS = 'pvv4fu1RvQBkKXozyH5A843sp1mt6gTy9rPoZrBBAGS';
const PERIOD_HOURS = 7 * 24; // 7 days

async function analyzeToken() {
    console.log(`\n🔍 Analyzing Token: ${TOKEN_ADDRESS}`);
    console.log(`📅 Period: Last 7 days (${PERIOD_HOURS} hours)`);
    console.log('='.repeat(80));

    try {
        // 1. Get top traders by volume over 7 days
        console.log('\n📊 TOP TRADERS BY VOLUME (7 DAYS)');
        console.log('-'.repeat(40));
        
        const tradersUrl = `${BASE_URL}/token/${TOKEN_ADDRESS}/traders?limit=20&period=${PERIOD_HOURS}&sortBy=volume`;
        const tradersResponse = await fetch(tradersUrl);
        const tradersData = await tradersResponse.json();
        
        if (tradersData.success) {
            console.log(`Total Holders: ${tradersData.tokenInfo.totalHolders}`);
            console.log(`Active Traders: ${tradersData.tokenInfo.activeTraders || 0}`);
            console.log(`Token Decimals: ${tradersData.tokenInfo.decimals}`);
            console.log(`Total Supply: ${tradersData.tokenInfo.supply}`);
            
            if (tradersData.holders && tradersData.holders.length > 0) {
                console.log('\nTop 10 Traders by Volume:');
                tradersData.holders.slice(0, 10).forEach(holder => {
                    const volume = holder.volume24h || 0;
                    const txCount = holder.transactionCount || 0;
                    console.log(`  ${holder.rank}. ${holder.owner.substring(0, 6)}...${holder.owner.substring(holder.owner.length - 4)}`);
                    console.log(`     Balance: ${holder.balance.toLocaleString()} tokens (${holder.percentage.toFixed(2)}%)`);
                    console.log(`     7-Day Volume: ${volume.toLocaleString()} tokens`);
                    console.log(`     Transactions: ${txCount}`);
                    console.log(`     Avg per tx: ${txCount > 0 ? (volume / txCount).toFixed(2) : 0} tokens`);
                });
            } else {
                console.log('No holders found for this token');
            }
        } else {
            console.log(`Error: ${tradersData.error}`);
        }

        // 2. Get holders sorted by balance (traditional top holders)
        console.log('\n💰 TOP HOLDERS BY BALANCE');
        console.log('-'.repeat(40));
        
        const holdersUrl = `${BASE_URL}/token/${TOKEN_ADDRESS}/traders?limit=10&period=${PERIOD_HOURS}&sortBy=balance&includeVolume=true`;
        const holdersResponse = await fetch(holdersUrl);
        const holdersData = await holdersResponse.json();
        
        if (holdersData.success && holdersData.holders && holdersData.holders.length > 0) {
            console.log('Top 10 Holders by Balance:');
            holdersData.holders.forEach(holder => {
                const volume = holder.volume24h || 0;
                const txCount = holder.transactionCount || 0;
                console.log(`  ${holder.rank}. ${holder.owner.substring(0, 6)}...${holder.owner.substring(holder.owner.length - 4)}`);
                console.log(`     Balance: ${holder.balance.toLocaleString()} tokens (${holder.percentage.toFixed(2)}%)`);
                console.log(`     7-Day Activity: ${txCount} txs, ${volume.toLocaleString()} volume`);
            });
        }

        // 3. Get most active traders by transaction count
        console.log('\n🔄 MOST ACTIVE TRADERS (BY TRANSACTION COUNT)');
        console.log('-'.repeat(40));
        
        const activeUrl = `${BASE_URL}/token/${TOKEN_ADDRESS}/traders?limit=10&period=${PERIOD_HOURS}&sortBy=transactions`;
        const activeResponse = await fetch(activeUrl);
        const activeData = await activeResponse.json();
        
        if (activeData.success && activeData.holders && activeData.holders.length > 0) {
            console.log('Top 10 Most Active Traders:');
            activeData.holders.forEach(holder => {
                const txCount = holder.transactionCount || 0;
                const volume = holder.volume24h || 0;
                const avgSize = txCount > 0 ? (volume / txCount).toFixed(2) : 0;
                console.log(`  ${holder.rank}. ${holder.owner.substring(0, 6)}...${holder.owner.substring(holder.owner.length - 4)}`);
                console.log(`     Transactions: ${txCount} (avg size: ${avgSize} tokens)`);
                console.log(`     Balance: ${holder.balance.toLocaleString()} tokens`);
            });
        }

        // 4. Statistical Analysis
        console.log('\n📈 STATISTICAL ANALYSIS (7 DAYS)');
        console.log('-'.repeat(40));
        
        if (tradersData.success && tradersData.holders && tradersData.holders.length > 0) {
            const holders = tradersData.holders;
            
            // Calculate statistics
            const totalVolume = holders.reduce((sum, h) => sum + (h.volume24h || 0), 0);
            const totalTransactions = holders.reduce((sum, h) => sum + (h.transactionCount || 0), 0);
            const avgVolume = holders.length > 0 ? totalVolume / holders.length : 0;
            const avgTransactions = holders.length > 0 ? totalTransactions / holders.length : 0;
            
            // Find whales (top 1% holders)
            const whaleThreshold = holders.length * 0.01;
            const whales = holders.slice(0, Math.max(1, Math.ceil(whaleThreshold)));
            const whaleBalance = whales.reduce((sum, h) => sum + h.balance, 0);
            const totalBalance = holders.reduce((sum, h) => sum + h.balance, 0);
            const whalePercentage = totalBalance > 0 ? (whaleBalance / totalBalance * 100) : 0;
            
            console.log(`Total 7-Day Volume: ${totalVolume.toLocaleString()} tokens`);
            console.log(`Total Transactions: ${totalTransactions}`);
            console.log(`Average Volume per Holder: ${avgVolume.toFixed(2)} tokens`);
            console.log(`Average Transactions per Holder: ${avgTransactions.toFixed(2)}`);
            console.log(`\nWhale Analysis (Top 1% = ${whales.length} holders):`);
            console.log(`  Control ${whalePercentage.toFixed(2)}% of supply`);
            console.log(`  Total Balance: ${whaleBalance.toLocaleString()} tokens`);
            
            // Trading patterns
            const activeTraders = holders.filter(h => (h.transactionCount || 0) > 0);
            const highFreqTraders = holders.filter(h => (h.transactionCount || 0) > 10);
            const dormantHolders = holders.filter(h => (h.transactionCount || 0) === 0);
            
            console.log(`\nTrading Patterns:`);
            console.log(`  Active Traders: ${activeTraders.length} (${(activeTraders.length / holders.length * 100).toFixed(1)}%)`);
            console.log(`  High-Frequency (>10 tx): ${highFreqTraders.length} (${(highFreqTraders.length / holders.length * 100).toFixed(1)}%)`);
            console.log(`  Dormant Holders: ${dormantHolders.length} (${(dormantHolders.length / holders.length * 100).toFixed(1)}%)`);
        }

        // 5. Summary
        console.log('\n📌 SUMMARY');
        console.log('-'.repeat(40));
        console.log(`Token Address: ${TOKEN_ADDRESS}`);
        console.log(`Analysis Period: 7 days`);
        console.log(`Data freshness: Cached for up to 5 minutes`);
        console.log(`\nKey Insights:`);
        
        if (tradersData.success && tradersData.tokenInfo.totalHolders > 0) {
            const activeRatio = tradersData.tokenInfo.activeTraders / tradersData.tokenInfo.totalHolders;
            
            if (activeRatio > 0.5) {
                console.log(`✅ High trading activity (${(activeRatio * 100).toFixed(1)}% active)`);
            } else if (activeRatio > 0.2) {
                console.log(`⚠️ Moderate trading activity (${(activeRatio * 100).toFixed(1)}% active)`);
            } else {
                console.log(`❌ Low trading activity (${(activeRatio * 100).toFixed(1)}% active)`);
            }
            
            if (tradersData.holders && tradersData.holders.length > 0) {
                const top10Balance = tradersData.holders.slice(0, 10).reduce((sum, h) => sum + h.balance, 0);
                const totalBalance = tradersData.holders.reduce((sum, h) => sum + h.balance, 0);
                const concentration = totalBalance > 0 ? (top10Balance / totalBalance * 100) : 0;
                
                if (concentration > 70) {
                    console.log(`⚠️ High concentration risk (top 10 hold ${concentration.toFixed(1)}%)`);
                } else {
                    console.log(`✅ Reasonable distribution (top 10 hold ${concentration.toFixed(1)}%)`);
                }
            }
        } else if (!tradersData.success) {
            console.log('❌ Analysis failed - check if token address is valid');
        } else {
            console.log('⚠️ No holder data available for this token');
        }

    } catch (error) {
        console.error('\n❌ Analysis Error:', error.message);
        console.error('Make sure the server is running on port 3000');
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('Analysis complete!');
}

// Run analysis
analyzeToken().catch(console.error);
