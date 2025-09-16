#!/bin/bash

# Fast 100 Scenarios Test - Results saved to file
API_URL="http://localhost:3000/api/getAnswer"
OUTPUT_FILE="100-scenarios-results.json"
SCENARIO_COUNT=1

echo "Starting fast 100-scenario test..."
echo "Results will be saved to: $OUTPUT_FILE"
echo "{"  > "$OUTPUT_FILE"

# Function to make API call and save result
test_scenario_fast() {
    local question="$1"
    local description="$2"
    
    echo "Testing scenario $SCENARIO_COUNT: $description"
    
    # Make API call and get response
    response=$(curl -s -X POST -H "Content-Type: application/json" \
        -d "{\"question\":\"$question\",\"sources\":[]}" \
        "$API_URL")
    
    # Add to JSON output
    if [ $SCENARIO_COUNT -gt 1 ]; then
        echo "," >> "$OUTPUT_FILE"
    fi
    
    echo "  \"scenario_$SCENARIO_COUNT\": {" >> "$OUTPUT_FILE"
    echo "    \"description\": \"$description\"," >> "$OUTPUT_FILE"
    echo "    \"question\": \"$question\"," >> "$OUTPUT_FILE"
    echo "    \"response\": $(echo "$response" | jq -R .)" >> "$OUTPUT_FILE"
    echo "  }" >> "$OUTPUT_FILE"
    
    ((SCENARIO_COUNT++))
}

# All 100 scenarios
scenarios=(
    "What is the current slot height?|Basic network status"
    "Show me the most recent transaction on Solana|Recent transaction data"
    "How many transactions per second is Solana processing right now?|Current TPS metrics"
    "What are the top DeFi protocols on Solana?|DeFi ecosystem overview"
    "What are the trending NFT collections on Solana today?|NFT market trends"
    "What are the hottest meme coins on Solana right now?|Meme coin discovery"
    "Which validators have the highest staking rewards?|Validator staking analysis"
    "What are the top gaming tokens and GameFi projects on Solana?|Gaming ecosystem"
    "Where can I find the highest yield farming opportunities on Solana?|Yield farming guide"
    "How do I provide liquidity on Raydium?|DEX liquidity provision"
    "How do I secure my Solana wallet from hackers?|Wallet security guide"
    "What are the biggest transactions in the last 24 hours?|Large transaction analysis"
    "How do I bridge Ethereum assets to Solana?|Cross-chain bridging"
    "How do I build my first Solana program?|Developer onboarding"
    "Why are Solana transaction fees so low?|Fee structure explanation"
    "How does Solana consensus work?|Consensus mechanism"
    "What are the best liquid staking options on Solana?|Liquid staking comparison"
    "How can I find arbitrage opportunities between Solana DEXs?|Arbitrage strategies"
    "Where can I learn more about Solana development?|Learning resources"
    "What factors affect SOL price movements?|Price analysis factors"
    "How do I use Jupiter aggregator for best swap prices?|DEX aggregation strategies"
    "What are the most liquid trading pairs on Solana?|Liquidity analysis"
    "How do I analyze on-chain whale movements?|Whale tracking methods"
    "What are the best tools for Solana portfolio tracking?|Portfolio management"
    "How do I set up price alerts for Solana tokens?|Price monitoring"
    "What are the top Solana tokens by market cap?|Market cap rankings"
    "How do I identify new token launches early?|Early token detection"
    "What are the most profitable Solana trading bots?|Trading bot strategies"
    "How do I analyze Solana options and derivatives?|Derivatives trading"
    "What are the best Solana lending protocols?|Lending opportunities"
    "How do I track Solana ecosystem funding rounds?|Investment tracking"
    "What are the highest APY farms on Solana right now?|High-yield farming"
    "How do I use flash loans on Solana?|Flash loan mechanics"
    "What are the best Solana perpetual trading platforms?|Perp trading platforms"
    "How do I hedge my Solana positions?|Risk management"
    "What are the top Solana index funds?|Index investing"
    "How do I analyze Solana network congestion?|Network performance"
    "What are the best Solana mobile wallets?|Mobile wallet comparison"
    "How do I participate in Solana token sales?|Token sale participation"
    "What are the most innovative Solana projects?|Innovation spotting"
    "How do I create and mint NFTs on Solana?|NFT creation guide"
    "What are the best Solana NFT marketplaces?|NFT marketplace comparison"
    "How do I value Solana NFTs?|NFT valuation methods"
    "What are the rarest Solana NFT collections?|Rare NFT discovery"
    "How do I track NFT floor prices on Solana?|NFT price tracking"
    "What are the best Solana NFT analytics tools?|NFT analytics platforms"
    "How do I create NFT royalties on Solana?|NFT royalty systems"
    "What are the top Solana art collections?|Art NFT collections"
    "How do I create dynamic NFTs on Solana?|Dynamic NFT development"
    "What are the best Solana NFT drops this month?|Upcoming NFT drops"
    "How do I create NFT collections with utility?|Utility NFT design"
    "What are the most expensive Solana NFTs ever sold?|High-value NFT sales"
    "How do I create music NFTs on Solana?|Music NFT creation"
    "What are the best Solana avatar projects?|Avatar NFT projects"
    "How do I fractionalize NFTs on Solana?|NFT fractionalization"
    "What are the top Solana metaverse projects?|Metaverse platforms"
    "How do I create NFT staking rewards?|NFT staking mechanisms"
    "What are the best Solana NFT lending platforms?|NFT lending options"
    "How do I create cross-chain NFTs?|Cross-chain NFT bridging"
    "What are the top Solana gaming NFTs?|Gaming NFT ecosystems"
    "How do I create a Solana AMM pool?|AMM pool creation"
    "What are the best Solana derivatives protocols?|Derivatives platforms"
    "How do I create synthetic assets on Solana?|Synthetic asset creation"
    "What are the top Solana insurance protocols?|DeFi insurance options"
    "How do I create prediction markets on Solana?|Prediction market development"
    "What are the best Solana DAO tools?|DAO creation platforms"
    "How do I create tokenized real estate on Solana?|Real estate tokenization"
    "What are the top Solana privacy protocols?|Privacy-focused projects"
    "How do I create decentralized identity on Solana?|DID implementation"
    "What are the best Solana oracle solutions?|Oracle service comparison"
    "How do I create cross-chain bridges on Solana?|Bridge development"
    "What are the top Solana algorithmic stablecoins?|Algorithmic stablecoin analysis"
    "How do I create automated trading strategies?|Automated trading setup"
    "What are the best Solana governance tokens?|Governance token analysis"
    "How do I create liquidity mining programs?|Liquidity incentive design"
    "What are the top Solana launchpads?|Token launch platforms"
    "How do I create bonds and fixed-income on Solana?|Fixed-income protocols"
    "What are the best Solana asset management tools?|Asset management platforms"
    "How do I create options protocols on Solana?|Options platform development"
    "What are the top Solana structured products?|Structured product analysis"
    "How do I create AI-powered trading bots on Solana?|AI trading integration"
    "What are the top Solana RWA (Real World Assets) projects?|RWA tokenization"
    "How do I create carbon credit markets on Solana?|Carbon trading platforms"
    "What are the best Solana social trading platforms?|Social trading networks"
    "How do I create subscription services on Solana?|Subscription model development"
    "What are the top Solana infrastructure providers?|Infrastructure service comparison"
    "How do I create decentralized VPNs on Solana?|dVPN development"
    "What are the best Solana data analytics platforms?|Data analytics tools"
    "How do I create IoT payments on Solana?|IoT payment systems"
    "What are the top Solana energy trading platforms?|Energy market tokenization"
    "How do I create decentralized storage on Solana?|Storage protocol development"
    "What are the best Solana streaming protocols?|Streaming service platforms"
    "How do I create supply chain tracking on Solana?|Supply chain transparency"
    "What are the top Solana creator economy platforms?|Creator monetization tools"
    "How do I create decentralized computing on Solana?|Distributed computing networks"
    "What are the best Solana cross-chain protocols?|Interoperability solutions"
    "How do I create regulatory-compliant DeFi?|Compliance framework development"
    "What are the top Solana institutional services?|Institutional platform comparison"
    "How do I create quantum-resistant security on Solana?|Quantum security implementation"
    "What are the future trends in the Solana ecosystem?|Ecosystem future analysis"
    "How do I analyze Solana transaction patterns?|Transaction analysis"
    "What are the best Solana MEV protection strategies?|MEV mitigation"
    "How do I create Solana-based prediction markets?|Prediction platform development"
    "What are the top Solana sustainability initiatives?|Green blockchain projects"
    "How do I optimize Solana RPC performance?|RPC optimization techniques"
    "What are the best Solana governance frameworks?|Governance system design"
    "How do I create Solana account abstraction?|Account abstraction implementation"
    "What are the top Solana privacy coins?|Privacy token analysis"
    "How do I build Solana mobile dApps?|Mobile development guide"
    "What are the latest Solana protocol upgrades?|Protocol development updates"
)

# Process all scenarios
for scenario in "${scenarios[@]}"; do
    IFS='|' read -r question description <<< "$scenario"
    test_scenario_fast "$question" "$description"
done

echo "}" >> "$OUTPUT_FILE"

echo "Completed all 100 scenarios!"
echo "Results saved to: $OUTPUT_FILE"
echo "Total scenarios tested: $((SCENARIO_COUNT - 1))"
