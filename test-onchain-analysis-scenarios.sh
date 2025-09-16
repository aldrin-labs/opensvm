#!/bin/bash

# 100 On-Chain Data Analysis Scenarios for OpenSVM API
# Focus: Analyzing blockchain data to find answers through data analysis

BASE_URL="http://localhost:3001/api/getAnswer"  # Use local dev server for testing
PRODUCTION_URL="https://osvm.ai/api/getAnswer"
DELAY=2
USE_LOCAL=true

# Set URL based on preference
if [ "$USE_LOCAL" = true ]; then
    API_URL=$BASE_URL
    echo "🔍 Testing against LOCAL server: $BASE_URL"
else
    API_URL=$PRODUCTION_URL
    echo "🔍 Testing against PRODUCTION server: $PRODUCTION_URL"
fi

echo "🚀 Starting 100 On-Chain Data Analysis Scenarios"
echo "================================================="
echo "Focus: Blockchain data analysis and insights"
echo ""

SCENARIO_COUNT=1

# Function to make API call and analyze response
test_scenario() {
    local question=$1
    local expected_analysis=$2
    echo -e "\n📊 Analysis Scenario $SCENARIO_COUNT: $question"
    echo "Expected: $expected_analysis"
    echo "----------------------------------------"
    
    response=$(curl -s -X POST -H "Content-Type: application/json" \
        -d "{\"question\":\"$question\",\"sources\":[]}" $API_URL)
    
    echo "Response: $response"
    
    # Check if response contains analysis indicators
    if [[ $response == *"analyze"* || $response == *"data"* || $response == *"transaction"* || $response == *"account"* ]]; then
        echo "✅ Analysis response detected"
    elif [[ $response == *"error"* ]]; then
        echo "❌ Error in response"
    else
        echo "⚠️  Generic response (may need better analysis prompting)"
    fi
    
    echo -e "\n"
    ((SCENARIO_COUNT++))
    sleep $DELAY
}

# 1-20: Transaction Analysis Scenarios
echo "=== TRANSACTION ANALYSIS SCENARIOS ==="
test_scenario "Analyze this Solana transaction: 2ZE7R7ZKNRwGwQkKiMWCMGMexUyZJLMBtBP5cvhqCQM6YRFZ7Cc8P3zJ5RpwVpqS8Q8SnFHUhV8H1ZF5G2mKdJC4" "Transaction detail analysis including success/failure, fees, instructions"

test_scenario "What went wrong with transaction 5K7M8N9P2Q3R4S5T6U7V8W9X1Y2Z3A4B5C6D7E8F9G1H2I3J4K5L6M7N8O9P1Q2R3?" "Transaction failure analysis with error codes and reasons"

test_scenario "Analyze the largest SOL transfer in the last 24 hours" "Large transaction detection and analysis"

test_scenario "Find and analyze all DEX swaps for address So11111111111111111111111111111111111111112 in the last hour" "DEX activity analysis for specific token"

test_scenario "What smart contract interactions happened in block 180000000?" "Block analysis with program call details"

test_scenario "Analyze transaction fees for the top 10 most expensive transactions today" "Fee analysis and comparison"

test_scenario "Find transactions where someone lost money due to slippage > 5%" "Slippage analysis and loss detection"

test_scenario "What are the most common instruction types in the last 1000 blocks?" "Instruction pattern analysis"

test_scenario "Analyze arbitrage transactions between Raydium and Orca in the last hour" "Arbitrage opportunity analysis"

test_scenario "Find transactions that interacted with more than 5 different programs" "Complex transaction analysis"

test_scenario "What percentage of transactions failed in the last epoch?" "Network reliability analysis"

test_scenario "Analyze the transaction that moved the most value today" "High-value transaction analysis"

test_scenario "Find transactions that used priority fees > 0.01 SOL" "Priority fee analysis"

test_scenario "What programs are being called most frequently right now?" "Program usage analytics"

test_scenario "Analyze MEV (Maximum Extractable Value) opportunities in recent blocks" "MEV analysis and detection"

test_scenario "Find transactions that created new token accounts today" "Token account creation analysis"

test_scenario "What are the gas usage patterns for Jupiter aggregator?" "Program efficiency analysis"

test_scenario "Analyze cross-program invocation patterns in DeFi transactions" "DeFi interaction analysis"

test_scenario "Find the most complex transaction (most instructions) in the last day" "Transaction complexity analysis"

test_scenario "What percentage of transactions use compute unit limits?" "Compute unit usage analysis"

# 21-40: Wallet and Account Analysis
echo "=== WALLET & ACCOUNT ANALYSIS SCENARIOS ==="
test_scenario "Analyze the trading behavior of wallet 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU" "Wallet behavior pattern analysis"

test_scenario "What tokens does address 5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1 hold and what are they worth?" "Portfolio analysis with valuations"

test_scenario "Find wallets that bought a token before a 100x pump" "Early adopter identification"

test_scenario "Analyze the most active trader on Solana today" "High-activity wallet analysis"

test_scenario "What wallets are accumulating SOL while others are selling?" "Accumulation pattern analysis"

test_scenario "Find accounts that have never made a transaction but hold valuable tokens" "Dormant account analysis"

test_scenario "Analyze the diversification level of the top 10 SOL holders" "Portfolio diversification analysis"

test_scenario "What new wallets were created today and funded with > 10 SOL?" "New wallet activity analysis"

test_scenario "Find wallets that consistently profit from DeFi trades" "Profitable trader identification"

test_scenario "Analyze the voting behavior of top validators" "Validator governance analysis"

test_scenario "What wallets bridge assets from Ethereum to Solana daily?" "Cross-chain activity analysis"

test_scenario "Find accounts that only interact with specific DeFi protocols" "Protocol loyalty analysis"

test_scenario "Analyze the transaction timing patterns of suspected bot accounts" "Bot behavior detection"

test_scenario "What wallets hold the most NFTs and what's their total value?" "NFT portfolio analysis"

test_scenario "Find accounts that have been consistently staking for > 1 year" "Long-term staker analysis"

test_scenario "Analyze the token holding patterns of Alameda Research addresses" "Institutional wallet analysis"

test_scenario "What wallets are providing liquidity across multiple DEXs?" "Multi-DEX LP analysis"

test_scenario "Find accounts that have perfect trading records (never lost money)" "Perfect trader analysis"

test_scenario "Analyze the spending patterns of Solana Foundation addresses" "Foundation activity analysis"

test_scenario "What wallets consistently buy before major announcements?" "Insider trading detection"

# 41-60: Token and Market Analysis
echo "=== TOKEN & MARKET ANALYSIS SCENARIOS ==="
test_scenario "Analyze the price impact of the last 100 BONK trades" "Token price impact analysis"

test_scenario "What tokens have gained the most holders in the last 24 hours?" "Holder growth analysis"

test_scenario "Find tokens where whales are accumulating while retail sells" "Smart money vs retail analysis"

test_scenario "Analyze the correlation between SOL price and ecosystem token prices" "Price correlation analysis"

test_scenario "What meme coins launched today and survived more than 1 hour?" "New token survival analysis"

test_scenario "Find tokens with the highest volume-to-market-cap ratio" "Volume efficiency analysis"

test_scenario "Analyze the distribution of token holders for USDC on Solana" "Token distribution analysis"

test_scenario "What tokens are being shorted or borrowed most on lending protocols?" "Borrowing demand analysis"

test_scenario "Find tokens where 90% of supply is held by top 10 wallets" "Token concentration analysis"

test_scenario "Analyze the trading volume patterns of RAY token" "Volume pattern analysis"

test_scenario "What tokens have the most programmatic trading activity?" "Algorithmic trading detection"

test_scenario "Find tokens that have never had a day without trades" "Liquidity consistency analysis"

test_scenario "Analyze the burn rate of tokens with deflationary mechanics" "Token burn analysis"

test_scenario "What tokens have the highest velocity (rate of circulation)?" "Token velocity analysis"

test_scenario "Find tokens where yield farming rewards exceed trading volume" "Yield farming impact analysis"

test_scenario "Analyze the arbitrage price differences for USDT across DEXs" "Arbitrage opportunity analysis"

test_scenario "What tokens have the most stable price despite high volatility in SOL?" "Stability analysis"

test_scenario "Find tokens that consistently outperform during SOL bear markets" "Defensive token analysis"

test_scenario "Analyze the market making activity for newly launched tokens" "Market making analysis"

test_scenario "What tokens have the highest ratio of unique traders to holders?" "Trading activity analysis"

# 61-80: DeFi Protocol Analysis
echo "=== DEFI PROTOCOL ANALYSIS SCENARIOS ==="
test_scenario "Analyze the total value locked (TVL) changes in Raydium over the last week" "TVL trend analysis"

test_scenario "What lending protocol has the highest utilization rates right now?" "Lending market analysis"

test_scenario "Find yield farming pools with the highest real APY (after token emissions)" "Real yield analysis"

test_scenario "Analyze the liquidation events on Solend in the last 24 hours" "Liquidation risk analysis"

test_scenario "What DEX has the best price execution for large trades > 100k USD?" "DEX execution quality"

test_scenario "Find protocols where governance token holders are most active" "Governance participation analysis"

test_scenario "Analyze the fee revenue of Jupiter aggregator" "Protocol revenue analysis"

test_scenario "What automated market makers have the least impermanent loss?" "IL analysis across AMMs"

test_scenario "Find lending pools where interest rates are inverted (borrow < supply)" "Interest rate anomaly detection"

test_scenario "Analyze the flash loan usage across all Solana protocols" "Flash loan activity analysis"

test_scenario "What protocols have the highest insurance fund ratios?" "Protocol safety analysis"

test_scenario "Find DEXs with the most MEV extraction" "MEV impact on DEXs"

test_scenario "Analyze the cross-protocol composability usage" "DeFi composability metrics"

test_scenario "What protocols have the best capital efficiency?" "Capital efficiency comparison"

test_scenario "Find yield farms that are likely Ponzi schemes based on token emissions" "Sustainability analysis"

test_scenario "Analyze the slippage tolerance settings of successful traders" "Trading strategy analysis"

test_scenario "What protocols have the most institutional adoption?" "Institutional usage analysis"

test_scenario "Find protocols with the highest development activity" "Protocol development metrics"

test_scenario "Analyze the user retention rates of different DeFi protocols" "User engagement analysis"

test_scenario "What protocols are most affected by network congestion?" "Network dependency analysis"

# 81-100: Advanced Network and Ecosystem Analysis
echo "=== NETWORK & ECOSYSTEM ANALYSIS SCENARIOS ==="
test_scenario "Analyze validator performance and their impact on network health" "Validator performance analysis"

test_scenario "What programs consume the most compute units per transaction?" "Resource usage analysis"

test_scenario "Find patterns in network congestion and predict the next bottleneck" "Network congestion prediction"

test_scenario "Analyze the geographic distribution of Solana nodes" "Network decentralization analysis"

test_scenario "What are the most common reasons for transaction failures?" "Failure mode analysis"

test_scenario "Find correlations between network metrics and token prices" "Network-price correlation"

test_scenario "Analyze the evolution of Solana's transaction types over time" "Transaction evolution analysis"

test_scenario "What programs have the highest success rates?" "Program reliability analysis"

test_scenario "Find evidence of network spam or attack patterns" "Network security analysis"

test_scenario "Analyze the impact of epoch changes on network performance" "Epoch transition analysis"

test_scenario "What validators have the most consistent block production?" "Validator consistency analysis"

test_scenario "Find programs that are upgraded most frequently" "Program maintenance analysis"

test_scenario "Analyze the relationship between stake distribution and network security" "Security analysis"

test_scenario "What are the peak usage hours for different types of transactions?" "Usage pattern analysis"

test_scenario "Find accounts that are likely exchange hot wallets based on behavior" "Exchange identification"

test_scenario "Analyze the on-chain footprint of major protocols" "Protocol footprint analysis"

test_scenario "What programs have the highest error rates?" "Error rate analysis"

test_scenario "Find patterns in successful vs failed transaction retry attempts" "Retry pattern analysis"

test_scenario "Analyze the compute unit pricing efficiency across different operations" "Compute pricing analysis"

test_scenario "What does the future adoption of Solana look like based on current trends?" "Growth projection analysis"

echo ""
echo "🎉 Completed all 100 On-Chain Analysis Scenarios!"
echo "==============================================="
echo "Total scenarios tested: $((SCENARIO_COUNT - 1))"
echo ""
echo "Key Focus Areas Covered:"
echo "- Transaction Analysis & Pattern Detection"
echo "- Wallet Behavior & Portfolio Analysis" 
echo "- Token Market Dynamics & Trading Patterns"
echo "- DeFi Protocol Health & Performance"
echo "- Network Security & Performance Analysis"
echo ""
echo "These scenarios test the API's ability to:"
echo "✓ Query and analyze real blockchain data"
echo "✓ Identify patterns and anomalies"
echo "✓ Provide actionable insights"
echo "✓ Handle complex analytical queries"
echo "✓ Process real addresses and transactions"
