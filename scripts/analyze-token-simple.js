const fetch = require('node-fetch');

// Configuration
const BASE_URL = 'http://localhost:3000/api';
const TOKEN_ADDRESS = 'pvv4fu1RvQBkKXozyH5A843sp1mt6gTy9rPoZrBBAGS';

async function analyzeTokenSimple() {
    console.log(`\n🔍 Analyzing Token: ${TOKEN_ADDRESS}`);
    console.log('='.repeat(80));

    try {
        // 1. Get basic holders without volume calculation
        console.log('\n📊 TOKEN HOLDERS ANALYSIS');
        console.log('-'.repeat(40));
        
        const holdersUrl = `${BASE_URL}/token/${TOKEN_ADDRESS}/holders?limit=20&includeVolume=false`;
        const holdersResponse = await fetch(holdersUrl);
        const holdersData = await holdersResponse.json();
        
        if (holdersData.success) {
            console.log(`✅ Token found!`);
            console.log(`Total Holders: ${holdersData.tokenInfo.totalHolders}`);
            console.log(`Token Decimals: ${holdersData.tokenInfo.decimals}`);
            console.log(`Total Supply: ${holdersData.tokenInfo.supply}`);
            
            if (holdersData.holders && holdersData.holders.length > 0) {
                console.log('\n💰 Top 10 Holders by Balance:');
                holdersData.holders.slice(0, 10).forEach(holder => {
                    console.log(`  ${holder.rank}. ${holder.owner.substring(0, 8)}...${holder.owner.substring(holder.owner.length - 6)}`);
                    console.log(`     Balance: ${holder.balance.toLocaleString()} tokens`);
                    console.log(`     Percentage: ${holder.percentage.toFixed(4)}% of supply`);
                });
                
                // Calculate concentration
                const top10Balance = holdersData.holders.slice(0, 10).reduce((sum, h) => sum + h.balance, 0);
                const totalBalance = holdersData.holders.reduce((sum, h) => sum + h.balance, 0);
                const concentration = totalBalance > 0 ? (top10Balance / totalBalance * 100) : 0;
                
                console.log('\n📈 Distribution Analysis:');
                console.log(`  Top 10 holders control: ${concentration.toFixed(2)}% of circulating supply`);
                
                // Find whales (holders with >1% of supply)
                const whales = holdersData.holders.filter(h => h.percentage > 1);
                console.log(`  Whales (>1% of supply): ${whales.length} addresses`);
                
                if (whales.length > 0) {
                    console.log('  Whale addresses:');
                    whales.forEach(w => {
                        console.log(`    - ${w.owner.substring(0, 8)}...${w.owner.substring(w.owner.length - 6)}: ${w.percentage.toFixed(2)}%`);
                    });
                }
                
                // Distribution tiers
                const tier1 = holdersData.holders.filter(h => h.percentage >= 10).length;
                const tier2 = holdersData.holders.filter(h => h.percentage >= 1 && h.percentage < 10).length;
                const tier3 = holdersData.holders.filter(h => h.percentage >= 0.1 && h.percentage < 1).length;
                const tier4 = holdersData.holders.filter(h => h.percentage < 0.1).length;
                
                console.log('\n🎯 Holder Tiers:');
                console.log(`  Mega Whales (≥10%): ${tier1} holders`);
                console.log(`  Large Holders (1-10%): ${tier2} holders`);
                console.log(`  Medium Holders (0.1-1%): ${tier3} holders`);
                console.log(`  Small Holders (<0.1%): ${tier4} holders`);
                
            } else {
                console.log('❌ No holders found for this token');
            }
        } else {
            console.log(`❌ Error: ${holdersData.error}`);
            if (holdersData.details) {
                console.log(`   Details: ${holdersData.details}`);
            }
        }
        
        // 2. Try to get 24h trading activity (faster than 7 days)
        console.log('\n🔄 24-HOUR TRADING ACTIVITY');
        console.log('-'.repeat(40));
        
        const tradersUrl = `${BASE_URL}/token/${TOKEN_ADDRESS}/traders?limit=5&period=24&sortBy=transactions`;
        const tradersResponse = await fetch(tradersUrl);
        const tradersData = await tradersResponse.json();
        
        if (tradersData.success && tradersData.holders) {
            const activeTraders = tradersData.holders.filter(h => (h.transactionCount || 0) > 0);
            console.log(`Active traders (24h): ${activeTraders.length}`);
            
            if (activeTraders.length > 0) {
                console.log('Most active traders:');
                activeTraders.slice(0, 5).forEach(trader => {
                    console.log(`  - ${trader.owner.substring(0, 8)}...${trader.owner.substring(trader.owner.length - 6)}: ${trader.transactionCount} transactions`);
                });
            }
        }
        
        // 3. Summary
        console.log('\n📌 SUMMARY');
        console.log('-'.repeat(40));
        console.log(`Token Address: ${TOKEN_ADDRESS}`);
        
        if (holdersData.success && holdersData.tokenInfo.totalHolders > 0) {
            const riskLevel = concentration > 70 ? 'HIGH' : concentration > 50 ? 'MODERATE' : 'LOW';
            console.log(`\nRisk Assessment:`);
            console.log(`  Concentration Risk: ${riskLevel} (Top 10 hold ${concentration.toFixed(1)}%)`);
            console.log(`  Total Holders: ${holdersData.tokenInfo.totalHolders}`);
            
            if (holdersData.tokenInfo.totalHolders < 10) {
                console.log(`  ⚠️ Very low holder count - potential liquidity risk`);
            } else if (holdersData.tokenInfo.totalHolders < 100) {
                console.log(`  ⚠️ Low holder count - limited distribution`);
            } else {
                console.log(`  ✅ Good holder count for distribution`);
            }
        }

    } catch (error) {
        console.error('\n❌ Analysis Error:', error.message);
        console.error('Make sure the server is running on port 3000');
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('Analysis complete!');
}

// Run analysis
analyzeTokenSimple().catch(console.error);
