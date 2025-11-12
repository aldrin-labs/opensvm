#!/bin/bash
# Pure bash candlestick chart - NO PYTHON
# Usage: candlestick-chart.sh <MINT> <TIMEFRAME> [MAX_CANDLES] [BASE_MINT] [POOL_ADDRESS]
#   MINT: Token mint address (default: Bonk)
#   TIMEFRAME: 1m, 5m, 15m, 1H, 4H, 1D (default: 1H)
#   MAX_CANDLES: Number of recent candles to display (default: auto-detect based on terminal width)
#   BASE_MINT: Optional - filter pools by base token mint address
#   POOL_ADDRESS: Optional - show data for specific pool address
# Examples:
#   candlestick-chart.sh DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263 1m 50
#   candlestick-chart.sh DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263 15m
#   candlestick-chart.sh DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263 1H 30 "" GBMoNx84HsFdVK63t8BZuDgyZhSBaeKWB4pHHpoeRM9z

# Backend API port (auto-detect or default to 3000)
API_PORT="${API_PORT:-3000}"

MINT="${1:-pvv4fu1RvQBkKXozyH5A843sp1mt6gTy9rPoZrBBAGS}"
TYPE="${2:-1H}"
BASE_MINT="${4:-}"
POOL_ADDRESS="${5:-}"


# Auto-detect terminal width and calculate optimal candle count
TERM_WIDTH=$(tput cols 2>/dev/null || echo "80")
CANDLE_WIDTH=1  # Compact width (1=narrow, 2=normal, 3=wide)
CANDLE_SPACING=1  # Space between candles
AUTO_MAX_CANDLES=$(( (TERM_WIDTH - 10) / (CANDLE_WIDTH + CANDLE_SPACING) ))

# Use provided max or auto-calculated
MAX_CANDLES="${3:-$AUTO_MAX_CANDLES}"

# Build API URL with optional parameters
API_URL="http://localhost:${API_PORT}/api/market-data?endpoint=ohlcv&mint=$MINT&type=$TYPE"
[ -n "$POOL_ADDRESS" ] && API_URL="${API_URL}&poolAddress=$POOL_ADDRESS"

echo "Fetching $TYPE candles for $MINT..." >&2
DATA=$(curl -s "$API_URL")

# Extract metadata
TOKEN=$(echo "$DATA" | jq -r '.tokenInfo.symbol // "UNKNOWN"')
NAME=$(echo "$DATA" | jq -r '.tokenInfo.name // "Unknown Token"')
PAIR=$(echo "$DATA" | jq -r '.mainPair.pair // "?/?"')
DEX=$(echo "$DATA" | jq -r '.mainPair.dex // "Unknown DEX"')
LIQUIDITY=$(echo "$DATA" | jq -r '.tokenInfo.liquidity // 0' | awk '{printf "%.0f", $1}')
LIQUIDITY_FMT=$(echo "$LIQUIDITY" | sed ':a;s/\B[0-9]\{3\}\>/,&/;ta')
PRICE=$(echo "$DATA" | jq -r '.tokenInfo.price // 0')
VOLUME_24H=$(echo "$DATA" | jq -r '.tokenInfo.volume24h // 0' | awk '{printf "%.0f", $1}')
VOLUME_24H_FMT=$(echo "$VOLUME_24H" | sed ':a;s/\B[0-9]\{3\}\>/,&/;ta')

# Extract all pools
POOLS_COUNT=$(echo "$DATA" | jq -r '.pools | length')
declare -a POOL_LIST
if [ "$POOLS_COUNT" -gt 0 ]; then
    readarray -t POOL_LIST < <(echo "$DATA" | jq -r '.pools[] | "\(.dex) - \(.pair) - \(.poolAddress)"')
else
    # Fetch top 3 pools from our backend
    echo "Fetching pool data from backend..." >&2
    POOL_API_URL="http://localhost:${API_PORT}/api/market-data?mint=$MINT&endpoint=markets"
    [ -n "$BASE_MINT" ] && POOL_API_URL="${POOL_API_URL}&baseMint=$BASE_MINT"
    
    POOL_DATA=$(curl -s "$POOL_API_URL")
    
    if [ "$(echo "$POOL_DATA" | jq -r '.success')" = "true" ]; then
        POOLS_JSON=$(echo "$POOL_DATA" | jq -r '.pools')
        POOLS_COUNT=$(echo "$POOLS_JSON" | jq '. | length')
        if [ "$POOLS_COUNT" -gt 0 ]; then
            readarray -t POOL_LIST < <(echo "$POOLS_JSON" | jq -r '.[] | "\(.dex) - \(.pair) - \(.poolAddress)"')
            # Store pool details for later use
            POOLS_DETAILS="$POOLS_JSON"
        fi
    fi
fi

# Extract OHLC + Volume data (limit to last MAX_CANDLES)
readarray -t OHLC < <(echo "$DATA" | jq -r ".data.items[-${MAX_CANDLES}:] | .[] | \"\(.o),\(.h),\(.l),\(.c),\(.v)\"")

if [ ${#OHLC[@]} -eq 0 ]; then
    echo "❌ No data" >&2
    exit 1
fi

# Calculate offset for indicator arrays
TOTAL_ITEMS=$(echo "$DATA" | jq -r '.data.items | length')
OFFSET=$((TOTAL_ITEMS - ${#OHLC[@]}))

# Extract volumes and closes
declare -a VOLUMES CLOSES
for item in "${OHLC[@]}"; do
    IFS=',' read -r o h l c v <<< "$item"
    VOLUMES+=("$v")
    CLOSES+=("$c")
done

# Extract pre-calculated indicators from API (slice to match OHLC range)
readarray -t MA7_FULL < <(echo "$DATA" | jq -r '.indicators.ma7[]')
readarray -t MA25_FULL < <(echo "$DATA" | jq -r '.indicators.ma25[]')
readarray -t MACD_LINE_FULL < <(echo "$DATA" | jq -r '.indicators.macd.line[]')
readarray -t SIGNAL_LINE_FULL < <(echo "$DATA" | jq -r '.indicators.macd.signal[]')

# Slice indicator arrays to match the displayed OHLC range
declare -a MA7 MA25 MACD_LINE SIGNAL_LINE
for ((i=0; i<${#OHLC[@]}; i++)); do
    MA7[$i]="${MA7_FULL[$((OFFSET + i))]}"
    MA25[$i]="${MA25_FULL[$((OFFSET + i))]}"
    MACD_LINE[$i]="${MACD_LINE_FULL[$((OFFSET + i))]}"
    SIGNAL_LINE[$i]="${SIGNAL_LINE_FULL[$((OFFSET + i))]}"
done

# Calculate stats
IFS=',' read -r _ _ _ FIRST _ <<< "${OHLC[0]}"
IFS=',' read -r _ _ _ LAST _ <<< "${OHLC[-1]}"
CHANGE=$(awk "BEGIN {printf \"%.2f\", (($LAST - $FIRST) / $FIRST) * 100}")

# Find min/max
MIN="" MAX=""
for item in "${OHLC[@]}"; do
    IFS=',' read -r o h l c v <<< "$item"
    [ -z "$MIN" ] && MIN=$l || MIN=$(awk "BEGIN {print ($l < $MIN ? $l : $MIN)}")
    [ -z "$MAX" ] && MAX=$h || MAX=$(awk "BEGIN {print ($h > $MAX ? $h : $MAX)}")
done

RANGE=$(awk "BEGIN {print $MAX - $MIN}")

# Display header
echo ""
echo "═══════════════════════════════════════════════════════════════════════════════"
echo "  $NAME ($TOKEN)  |  Mint: $MINT"
echo "  $PAIR  |  DEX: $DEX"
echo "  Price: $PRICE  |  Liquidity: \$$LIQUIDITY_FMT  |  24h Vol: \$$VOLUME_24H_FMT"
echo "  Timeframe: $TYPE  |  Showing: ${#OHLC[@]}/$TOTAL_ITEMS candles  |  Change: ${CHANGE}%"
echo "  Range: $MIN → $MAX  |  Terminal: ${TERM_WIDTH} cols"

# Show top 3 pools if any
if [ ${#POOL_LIST[@]} -gt 0 ]; then
    echo "─────────────────────────────────────────────────────────────────────────────── "
    echo "  Top 3 Pools (sorted by liquidity):"
    echo ""
    
    # Check if we have detailed pool data from direct fetch
    if [ -n "$POOLS_DETAILS" ]; then
        for i in "${!POOL_LIST[@]}"; do
            POOL_INFO=$(echo "$POOLS_DETAILS" | jq -r ".[$i]")
            DEX_NAME=$(echo "$POOL_INFO" | jq -r '.dex')
            PAIR=$(echo "$POOL_INFO" | jq -r '.pair')
            POOL_ADDR=$(echo "$POOL_INFO" | jq -r '.poolAddress')
            P_PRICE=$(echo "$POOL_INFO" | jq -r '.price')
            P_VOL=$(echo "$POOL_INFO" | jq -r '.volume24h')
            P_TXS=$(echo "$POOL_INFO" | jq -r '.txCount24h')
            P_LIQ=$(echo "$POOL_INFO" | jq -r '.liquidity')
            BASE_TOKEN=$(echo "$POOL_INFO" | jq -r '.baseToken')
            QUOTE_TOKEN=$(echo "$POOL_INFO" | jq -r '.quoteToken')
            
            # Format values
            PRICE_FMT=$(awk "BEGIN {printf \"%.8f\", $P_PRICE}" 2>/dev/null || echo "$P_PRICE")
            VOL_FMT=$(awk "BEGIN {printf \"%.0f\", $P_VOL}" 2>/dev/null | sed ':a;s/\B[0-9]\{3\}\>/,&/;ta')
            LIQ_FMT=$(awk "BEGIN {printf \"%.0f\", $P_LIQ}" 2>/dev/null | sed ':a;s/\B[0-9]\{3\}\>/,&/;ta')
            
            echo "  [$((i+1))] $DEX_NAME - $PAIR"
            echo "      Pool: $POOL_ADDR"
            echo "      Price: $PRICE_FMT ($BASE_TOKEN per $QUOTE_TOKEN)"
            echo "      Liquidity: \$$LIQ_FMT  |  24h Vol: \$$VOL_FMT  |  24h Txs: $P_TXS"
            echo ""
        done
    else
        # Use data from backend API
        for i in "${!POOL_LIST[@]}"; do
            POOL_DATA=$(echo "$DATA" | jq -r ".pools[$i]")
            DEX_NAME=$(echo "$POOL_DATA" | jq -r '.dex')
            PAIR=$(echo "$POOL_DATA" | jq -r '.pair')
            POOL_ADDR=$(echo "$POOL_DATA" | jq -r '.poolAddress')
            P_PRICE=$(echo "$POOL_DATA" | jq -r '.price')
            P_VOL=$(echo "$POOL_DATA" | jq -r '.volume24h')
            P_TXS=$(echo "$POOL_DATA" | jq -r '.txCount24h')
            P_LIQ=$(echo "$POOL_DATA" | jq -r '.estimatedLiquidity // 0')
            
            # Format values
            PRICE_FMT=$(awk "BEGIN {printf \"%.8f\", $P_PRICE}" 2>/dev/null || echo "$P_PRICE")
            VOL_FMT=$(awk "BEGIN {printf \"%.0f\", $P_VOL}" 2>/dev/null | sed ':a;s/\B[0-9]\{3\}\>/,&/;ta')
            LIQ_FMT=$(awk "BEGIN {printf \"%.0f\", $P_LIQ}" 2>/dev/null | sed ':a;s/\B[0-9]\{3\}\>/,&/;ta')
            
            echo "  [$((i+1))] $DEX_NAME - $PAIR"
            echo "      Pool: $POOL_ADDR"
            echo "      Price: $PRICE_FMT  |  Liquidity: ~\$$LIQ_FMT"
            echo "      24h Vol: \$$VOL_FMT  |  24h Txs: $P_TXS"
            echo ""
        done
    fi
fi

echo "═══════════════════════════════════════════════════════════════════════════════"
echo ""

# Chart settings
HEIGHT=25
VOL_HEIGHT=6
# CANDLE_WIDTH already set above for responsive sizing
declare -A grid vol_grid

# Find volume min/max
VOL_MIN="" VOL_MAX=""
for v in "${VOLUMES[@]}"; do
    [ -z "$VOL_MIN" ] && VOL_MIN=$v || VOL_MIN=$(awk "BEGIN {print ($v < $VOL_MIN ? $v : $VOL_MIN)}")
    [ -z "$VOL_MAX" ] && VOL_MAX=$v || VOL_MAX=$(awk "BEGIN {print ($v > $VOL_MAX ? $v : $VOL_MAX)}")
done
VOL_RANGE=$(awk "BEGIN {print $VOL_MAX - $VOL_MIN}")

# Initialize grids with dynamic width
for ((r=0; r<=HEIGHT; r++)); do
    for ((c=0; c<${#OHLC[@]}*(CANDLE_WIDTH+1); c++)); do
        grid[$r,$c]=" "
    done
done

for ((r=0; r<=VOL_HEIGHT; r++)); do
    for ((c=0; c<${#OHLC[@]}*(CANDLE_WIDTH+1); c++)); do
        vol_grid[$r,$c]=" "
    done
done

# Plot candles and volume
idx=0
for item in "${OHLC[@]}"; do
    IFS=',' read -r open high low close volume <<< "$item"
    
    # Scale price to HEIGHT
    o=$(awk "BEGIN {printf \"%.0f\", (($open - $MIN) / $RANGE * $HEIGHT)}")
    h=$(awk "BEGIN {printf \"%.0f\", (($high - $MIN) / $RANGE * $HEIGHT)}")
    l=$(awk "BEGIN {printf \"%.0f\", (($low - $MIN) / $RANGE * $HEIGHT)}")
    c=$(awk "BEGIN {printf \"%.0f\", (($close - $MIN) / $RANGE * $HEIGHT)}")
    
    bullish=$(awk "BEGIN {print ($close >= $open)}")
    top=$(awk "BEGIN {print ($o > $c ? $o : $c)}")
    bot=$(awk "BEGIN {print ($o < $c ? $o : $c)}")
    
    col=$((idx * (CANDLE_WIDTH + 1) + CANDLE_WIDTH / 2))
    
    # Draw price candle (draw on multiple columns for width)
    for ((cw=0; cw<CANDLE_WIDTH; cw++)); do
        candle_col=$((col - CANDLE_WIDTH / 2 + cw))
        for ((row=l; row<=h; row++)); do
            if [ "$row" -ge "$bot" ] && [ "$row" -le "$top" ]; then
                [ "$bullish" = "1" ] && grid[$row,$candle_col]="G█" || grid[$row,$candle_col]="R▓"
            else
                [ "$bullish" = "1" ] && grid[$row,$candle_col]="G│" || grid[$row,$candle_col]="R│"
            fi
        done
    done
    
    # Draw volume bar (also use CANDLE_WIDTH)
    if [ "$VOL_RANGE" != "0" ]; then
        vol_height=$(awk "BEGIN {printf \"%.0f\", (($volume - $VOL_MIN) / $VOL_RANGE * $VOL_HEIGHT)}")
        for ((cw=0; cw<CANDLE_WIDTH; cw++)); do
            vcol=$((col - CANDLE_WIDTH / 2 + cw))
            for ((vrow=0; vrow<=$vol_height; vrow++)); do
                [ "$bullish" = "1" ] && vol_grid[$vrow,$vcol]="G▌" || vol_grid[$vrow,$vcol]="R▌"
            done
        done
    fi
    
    ((idx++))
done

# Draw MA lines after candles (so they overlay properly)
for ((i=0; i<${#OHLC[@]}; i++)); do
    col=$((i * (CANDLE_WIDTH + 1) + CANDLE_WIDTH / 2))
    
    # MA7 (yellow) - draw across multiple columns for visibility
    if [ "${MA7[$i]}" != "null" ] && [ -n "${MA7[$i]}" ]; then
        ma7="${MA7[$i]}"
        ma7_row=$(awk "BEGIN {printf \"%.0f\", (($ma7 - $MIN) / $RANGE * $HEIGHT)}")
        if [ "$ma7_row" -ge 0 ] && [ "$ma7_row" -le "$HEIGHT" ]; then
            # Draw across candle width + gaps
            for ((c=col-CANDLE_WIDTH; c<=col+CANDLE_WIDTH; c++)); do
                cell="${grid[$ma7_row,$c]}"
                if [ -z "$cell" ] || [ "$cell" = " " ]; then
                    grid[$ma7_row,$c]="Y─"
                fi
            done
        fi
    fi
    
    # MA25 (cyan) - draw across multiple columns for visibility
    if [ "${MA25[$i]}" != "null" ] && [ -n "${MA25[$i]}" ]; then
        ma25="${MA25[$i]}"
        ma25_row=$(awk "BEGIN {printf \"%.0f\", (($ma25 - $MIN) / $RANGE * $HEIGHT)}")
        if [ "$ma25_row" -ge 0 ] && [ "$ma25_row" -le "$HEIGHT" ]; then
            # Draw across candle width + gaps
            for ((c=col-CANDLE_WIDTH; c<=col+CANDLE_WIDTH; c++)); do
                cell="${grid[$ma25_row,$c]}"
                if [ -z "$cell" ] || [ "$cell" = " " ]; then
                    grid[$ma25_row,$c]="C─"
                fi
            done
        fi
    fi
done

# Print price chart
for ((row=HEIGHT; row>=0; row--)); do
    for ((col=0; col<${#OHLC[@]}*(CANDLE_WIDTH+1); col++)); do
        cell="${grid[$row,$col]}"
        case "$cell" in
            G*) echo -ne "\033[32m${cell:1}\033[0m" ;;
            R*) echo -ne "\033[31m${cell:1}\033[0m" ;;
            Y*) echo -ne "\033[33m${cell:1}\033[0m" ;;  # Yellow for MA7
            C*) echo -ne "\033[36m${cell:1}\033[0m" ;;  # Cyan for MA25
            *)  echo -ne "\033[90m·\033[0m" ;;  # Dark gray dots for empty space
        esac
    done
    echo ""
done

echo ""
echo "Volume"
# Print volume chart
for ((row=VOL_HEIGHT; row>=0; row--)); do
    for ((col=0; col<${#OHLC[@]}*(CANDLE_WIDTH+1); col++)); do
        vcell="${vol_grid[$row,$col]}"
        case "$vcell" in
            G*) echo -ne "\033[32m${vcell:1}\033[0m" ;;
            R*) echo -ne "\033[31m${vcell:1}\033[0m" ;;
            *)  echo -ne "\033[90m·\033[0m" ;;  # Dark gray dots for empty space
        esac
    done
    echo ""
done

echo ""
echo "  First: $FIRST  →  Last: $LAST  (${CHANGE}%)"
echo ""
