const BASE_URL = 'https://prediction-markets-api.dflow.net';
const DEFAULT_TIMEOUT = 30000;

// API client function
async function apiRequest(method, path, params) {
  const url = new URL(path, BASE_URL);
  if (params && method === 'GET') {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

  try {
    const response = await fetch(url.toString(), {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: method === 'POST' && params ? JSON.stringify(params) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timeout');
    }
    throw error;
  }
}

// Tool definitions
const TOOLS = [
  // Event endpoints
  {
    name: 'get_event',
    description: 'Get a single event by ticker. Returns event metadata including series ticker, subtitle, markets, strike information and volume.',
    inputSchema: {
      type: 'object',
      properties: {
        event_id: { type: 'string', description: 'Event ticker' },
        withNestedMarkets: { type: 'boolean', description: 'Include nested markets (optional)' },
      },
      required: ['event_id'],
    },
  },
  {
    name: 'get_events',
    description: 'Get a paginated list of all events with optional filtering and sorting.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'integer', minimum: 0, description: 'Maximum number of events to return' },
        cursor: { type: 'integer', minimum: 0, description: 'Pagination cursor' },
        withNestedMarkets: { type: 'boolean', description: 'Include nested markets' },
        seriesTickers: { type: 'string', description: 'Filter by series tickers (comma-separated)' },
        isInitialized: { type: 'boolean', description: 'Filter by initialization status' },
        status: { type: 'string', description: 'Filter by event status' },
        sort: { type: 'string', enum: ['volume', 'volume24h', 'liquidity', 'openInterest', 'startDate'], description: 'Sort field' },
      },
      required: [],
    },
  },

  // Market endpoints
  {
    name: 'get_market',
    description: 'Get details of a market by ticker.',
    inputSchema: {
      type: 'object',
      properties: {
        market_id: { type: 'string', description: 'Market ticker' },
      },
      required: ['market_id'],
    },
  },
  {
    name: 'get_market_by_mint',
    description: 'Get a market by looking up its mint address.',
    inputSchema: {
      type: 'object',
      properties: {
        mint_address: { type: 'string', description: 'Ledger or outcome mint address' },
      },
      required: ['mint_address'],
    },
  },
  {
    name: 'get_markets',
    description: 'Get a paginated list of markets with optional filtering.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'integer', minimum: 0, description: 'Number of markets to return' },
        cursor: { type: 'integer', minimum: 0, description: 'Pagination cursor' },
        isInitialized: { type: 'boolean', description: 'Filter by initialization status' },
        status: { type: 'string', description: 'Filter by status' },
        sort: { type: 'string', enum: ['volume', 'volume24h', 'liquidity', 'openInterest', 'startDate'], description: 'Sort field' },
      },
      required: [],
    },
  },
  {
    name: 'get_markets_batch',
    description: 'Get multiple markets by tickers and/or mint addresses (up to 100 results).',
    inputSchema: {
      type: 'object',
      properties: {
        tickers: { type: 'array', items: { type: 'string' }, description: 'Array of market tickers' },
        mints: { type: 'array', items: { type: 'string' }, description: 'Array of mint addresses' },
      },
      required: [],
    },
  },

  // Trade endpoints
  {
    name: 'get_trades',
    description: 'Get a paginated list of trades across markets with optional filtering.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'integer', minimum: 0, description: 'Number of trades to return' },
        cursor: { type: 'string', description: 'Pagination cursor' },
        ticker: { type: 'string', description: 'Filter by market ticker' },
        minTs: { type: 'integer', minimum: 0, description: 'Minimum timestamp filter' },
        maxTs: { type: 'integer', minimum: 0, description: 'Maximum timestamp filter' },
      },
      required: [],
    },
  },
  {
    name: 'get_trades_by_mint',
    description: 'Get trades for a market identified by a mint address.',
    inputSchema: {
      type: 'object',
      properties: {
        mint_address: { type: 'string', description: 'Mint address' },
        limit: { type: 'integer', minimum: 0, description: 'Number of trades to return' },
        cursor: { type: 'string', description: 'Pagination cursor' },
        minTs: { type: 'integer', minimum: 0, description: 'Minimum timestamp filter' },
        maxTs: { type: 'integer', minimum: 0, description: 'Maximum timestamp filter' },
      },
      required: ['mint_address'],
    },
  },

  // Forecast endpoints
  {
    name: 'get_forecast_percentile_history',
    description: 'Get historical raw and formatted forecast numbers for an event at specified percentiles.',
    inputSchema: {
      type: 'object',
      properties: {
        series_ticker: { type: 'string', description: 'Series ticker' },
        event_id: { type: 'string', description: 'Event ticker' },
        percentiles: { type: 'string', description: 'Comma-separated list of percentiles' },
        startTs: { type: 'integer', minimum: 0, description: 'Start timestamp' },
        endTs: { type: 'integer', minimum: 0, description: 'End timestamp' },
        periodInterval: { type: 'integer', minimum: 0, description: 'Sampling interval in seconds' },
      },
      required: ['series_ticker', 'event_id', 'percentiles', 'startTs', 'endTs', 'periodInterval'],
    },
  },
  {
    name: 'get_forecast_percentile_history_by_mint',
    description: 'Get forecast history by looking up an event using a market mint address.',
    inputSchema: {
      type: 'object',
      properties: {
        mint_address: { type: 'string', description: 'Market mint address' },
        percentiles: { type: 'string', description: 'Comma-separated list of percentiles' },
        startTs: { type: 'integer', minimum: 0, description: 'Start timestamp' },
        endTs: { type: 'integer', minimum: 0, description: 'End timestamp' },
        periodInterval: { type: 'integer', minimum: 0, description: 'Sampling interval in seconds' },
      },
      required: ['mint_address', 'percentiles', 'startTs', 'endTs', 'periodInterval'],
    },
  },

  // Candlestick endpoints
  {
    name: 'get_event_candlesticks',
    description: 'Get event candlesticks from the Kalshi API. Resolves series ticker automatically.',
    inputSchema: {
      type: 'object',
      properties: {
        ticker: { type: 'string', description: 'Event ticker' },
        startTs: { type: 'integer', minimum: 0, description: 'Start timestamp' },
        endTs: { type: 'integer', minimum: 0, description: 'End timestamp' },
        periodInterval: { type: 'integer', minimum: 0, description: 'Interval size in seconds' },
      },
      required: ['ticker', 'startTs', 'endTs', 'periodInterval'],
    },
  },
  {
    name: 'get_market_candlesticks',
    description: 'Get market candlesticks. Resolves series ticker automatically.',
    inputSchema: {
      type: 'object',
      properties: {
        ticker: { type: 'string', description: 'Market ticker' },
        startTs: { type: 'integer', minimum: 0, description: 'Start timestamp' },
        endTs: { type: 'integer', minimum: 0, description: 'End timestamp' },
        periodInterval: { type: 'integer', minimum: 0, description: 'Interval size in seconds' },
      },
      required: ['ticker', 'startTs', 'endTs', 'periodInterval'],
    },
  },
  {
    name: 'get_market_candlesticks_by_mint',
    description: 'Get candlesticks by looking up a market by mint address.',
    inputSchema: {
      type: 'object',
      properties: {
        mint_address: { type: 'string', description: 'Mint address' },
        startTs: { type: 'integer', minimum: 0, description: 'Start timestamp' },
        endTs: { type: 'integer', minimum: 0, description: 'End timestamp' },
        periodInterval: { type: 'integer', minimum: 0, description: 'Interval size in seconds' },
      },
      required: ['mint_address', 'startTs', 'endTs', 'periodInterval'],
    },
  },

  // Live data endpoints
  {
    name: 'get_live_data',
    description: 'Get live data from the Kalshi API for specific milestones.',
    inputSchema: {
      type: 'object',
      properties: {
        milestoneIds: { type: 'array', items: { type: 'string' }, description: 'Array of milestone IDs' },
      },
      required: ['milestoneIds'],
    },
  },
  {
    name: 'get_live_data_by_event',
    description: 'Get live data for all milestones of an event.',
    inputSchema: {
      type: 'object',
      properties: {
        event_ticker: { type: 'string', description: 'Event ticker' },
        minimumStartDate: { type: 'string', description: 'Filter milestones after this date' },
        category: { type: 'string', description: 'Filter by category' },
        competition: { type: 'string', description: 'Filter by competition' },
        sourceId: { type: 'string', description: 'Filter by data source' },
        type: { type: 'string', description: 'Filter by milestone type' },
      },
      required: ['event_ticker'],
    },
  },
  {
    name: 'get_live_data_by_mint',
    description: 'Get live data by looking up an event from a market mint address.',
    inputSchema: {
      type: 'object',
      properties: {
        mint_address: { type: 'string', description: 'Mint address' },
        minimumStartDate: { type: 'string', description: 'Filter milestones after this date' },
        category: { type: 'string', description: 'Filter by category' },
        competition: { type: 'string', description: 'Filter by competition' },
        sourceId: { type: 'string', description: 'Filter by data source' },
        type: { type: 'string', description: 'Filter by milestone type' },
      },
      required: ['mint_address'],
    },
  },

  // Series endpoints
  {
    name: 'get_series',
    description: 'Get all series templates with optional filtering.',
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Filter by series category' },
        tags: { type: 'string', description: 'Filter by tags' },
        isInitialized: { type: 'boolean', description: 'Filter by initialization status' },
        status: { type: 'string', description: 'Filter by series status' },
      },
      required: [],
    },
  },
  {
    name: 'get_series_by_ticker',
    description: 'Get a single series by its ticker.',
    inputSchema: {
      type: 'object',
      properties: {
        series_ticker: { type: 'string', description: 'Series ticker' },
      },
      required: ['series_ticker'],
    },
  },

  // Utility endpoints
  {
    name: 'get_outcome_mints',
    description: 'Get a flat list of yes and no outcome mint pubkeys.',
    inputSchema: {
      type: 'object',
      properties: {
        minCloseTs: { type: 'integer', minimum: 0, description: 'Filter by minimum close timestamp' },
      },
      required: [],
    },
  },
  {
    name: 'filter_outcome_mints',
    description: 'Filter a list of addresses and return only outcome mints.',
    inputSchema: {
      type: 'object',
      properties: {
        addresses: { type: 'array', items: { type: 'string' }, maxItems: 200, description: 'Array of addresses to filter' },
      },
      required: ['addresses'],
    },
  },
  {
    name: 'get_tags_by_categories',
    description: 'Get a mapping of series categories to tags.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_filters_by_sports',
    description: 'Get filtering options for each sport including scopes and competitions.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'search_events',
    description: 'Search events with nested markets by title or ticker.',
    inputSchema: {
      type: 'object',
      properties: {
        q: { type: 'string', description: 'Search query' },
        sort: { type: 'string', enum: ['volume', 'volume24h', 'liquidity', 'openInterest', 'startDate'], description: 'Sort field' },
        order: { type: 'string', enum: ['desc', 'asc'], description: 'Sort order' },
        limit: { type: 'integer', minimum: 0, description: 'Number of results to return' },
        cursor: { type: 'integer', minimum: 0, description: 'Pagination cursor' },
        withNestedMarkets: { type: 'boolean', description: 'Include nested markets' },
        withMarketAccounts: { type: 'boolean', description: 'Include market accounts' },
      },
      required: ['q'],
    },
  },
  {
    name: 'candlestick_chart',
    description: 'Generate ASCII candlestick chart with OHLCV data for a market. Returns a visual representation of price movements.',
    inputSchema: {
      type: 'object',
      properties: {
        ticker: { type: 'string', description: 'Market ticker' },
        startTs: { type: 'integer', minimum: 0, description: 'Start timestamp' },
        endTs: { type: 'integer', minimum: 0, description: 'End timestamp' },
        periodInterval: { type: 'integer', minimum: 0, description: 'Interval size in seconds' },
        width: { type: 'integer', minimum: 20, maximum: 200, description: 'Chart width in characters (default: 80)' },
        height: { type: 'integer', minimum: 10, maximum: 50, description: 'Chart height in characters (default: 25)' },
      },
      required: ['ticker', 'startTs', 'endTs', 'periodInterval'],
    },
  },
];

// ASCII Candlestick Chart Generator
function generateCandlestickChart(candleData, width = 80, height = 25) {
  if (!candleData || candleData.length === 0) {
    return 'No candlestick data available';
  }

  // Extract OHLCV
  const candles = candleData.map(c => ({
    o: parseFloat(c.open),
    h: parseFloat(c.high),
    l: parseFloat(c.low),
    c: parseFloat(c.close),
    v: parseFloat(c.volume || 0)
  }));

  // Find min/max for scaling
  let min = Infinity, max = -Infinity;
  candles.forEach(c => {
    min = Math.min(min, c.l);
    max = Math.max(max, c.h);
  });
  const range = max - min || 1;

  // Calculate stats
  const first = candles[0].c;
  const last = candles[candles.length - 1].c;
  const change = ((last - first) / first * 100).toFixed(2);

  // Initialize grid
  const grid = Array(height).fill(null).map(() => Array(width).fill(' '));

  const candleWidth = Math.max(1, Math.floor(width / candles.length) - 1);
  const spacing = Math.floor((width - (candles.length * candleWidth)) / candles.length);

  // Plot candles
  candles.forEach((candle, idx) => {
    const x = idx * (candleWidth + spacing);
    const bullish = candle.c >= candle.o;

    // Scale to chart height
    const o = Math.floor((candle.o - min) / range * (height - 1));
    const h = Math.floor((candle.h - min) / range * (height - 1));
    const l = Math.floor((candle.l - min) / range * (height - 1));
    const c = Math.floor((candle.c - min) / range * (height - 1));

    const top = Math.max(o, c);
    const bot = Math.min(o, c);

    // Draw candle
    for (let w = 0; w < candleWidth; w++) {
      const col = x + w;
      if (col >= width) break;

      for (let row = l; row <= h; row++) {
        if (row >= height) continue;
        if (row >= bot && row <= top) {
          grid[height - 1 - row][col] = bullish ? '█' : '▓';
        } else {
          grid[height - 1 - row][col] = bullish ? '│' : '│';
        }
      }
    }
  });

  // Build output
  let chart = '```\n';
  chart += `Candlestick Chart (${candles.length} candles)\n`;
  chart += `Range: ${min.toFixed(2)} → ${max.toFixed(2)} | Change: ${change}%\n`;
  chart += `─`.repeat(width) + '\n';

  grid.forEach(row => {
    chart += row.join('') + '\n';
  });

  chart += `─`.repeat(width) + '\n';
  chart += `First: ${first.toFixed(2)} → Last: ${last.toFixed(2)}\n`;
  chart += '```';

  return chart;
}

// CORS headers for MCP Streamable HTTP
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, mcp-session-id, mcp-protocol-version, *',
  'Access-Control-Expose-Headers': 'mcp-session-id, mcp-protocol-version',
};

// Main request handler
exports.handler = async function(event, context) {
  const { httpMethod, body, headers } = event;

  // Handle CORS preflight
  if (httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: '',
    };
  }

  // Handle GET for health check and discovery
  if (httpMethod === 'GET') {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      body: JSON.stringify({
        name: "dflow-mcp-server",
        version: "1.0.0",
        description: "Access real-time and historical prediction market data from DFlow/Kalshi",
        capabilities: { tools: true },
        tools_count: TOOLS.length
      })
    };
  }

  // Handle only POST requests for MCP
  if (httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const request = JSON.parse(body);

    // Handle initialize
    if (request.method === 'initialize') {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: request.id,
          result: {
            protocolVersion: "2024-11-05",
            capabilities: {
              tools: { listChanged: false },
            },
            serverInfo: {
              name: "dflow-mcp-server",
              version: "1.0.0",
              description: "Access real-time and historical prediction market data from DFlow/Kalshi APIs"
            }
          }
        })
      };
    }

    // Handle initialized notification
    if (request.method === 'notifications/initialized') {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        body: JSON.stringify({
          jsonrpc: "2.0",
          result: {}
        })
      };
    }

    // Handle tools.list / tools/list
    if (request.method === 'tools.list' || request.method === 'tools/list') {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: request.id,
          result: { tools: TOOLS }
        })
      };
    }

    // Handle tools.call
    if (request.method === 'tools.call' || request.method === 'tools/call') {
      const { name, arguments: args } = request.params;
      const toolArgs = args || {};

      let result;
      try {
        switch (name) {
          // Event endpoints
          case 'get_event':
            result = await apiRequest('GET', `/api/v1/event/${toolArgs.event_id}`, {
              withNestedMarkets: toolArgs.withNestedMarkets,
            });
            break;
          case 'get_events':
            result = await apiRequest('GET', '/api/v1/events', toolArgs);
            break;

          // Market endpoints
          case 'get_market':
            result = await apiRequest('GET', `/api/v1/market/${toolArgs.market_id}`, {});
            break;
          case 'get_market_by_mint':
            result = await apiRequest('GET', `/api/v1/market/by-mint/${toolArgs.mint_address}`, {});
            break;
          case 'get_markets':
            result = await apiRequest('GET', '/api/v1/markets', toolArgs);
            break;
          case 'get_markets_batch':
            result = await apiRequest('POST', '/api/v1/markets/batch', toolArgs);
            break;

          // Trade endpoints
          case 'get_trades':
            result = await apiRequest('GET', '/api/v1/trades', toolArgs);
            break;
          case 'get_trades_by_mint':
            const { mint_address: trade_mint, ...trade_params } = toolArgs;
            result = await apiRequest('GET', `/api/v1/trades/by-mint/${trade_mint}`, trade_params);
            break;

          // Forecast endpoints
          case 'get_forecast_percentile_history':
            const { series_ticker, event_id, ...forecast_params } = toolArgs;
            result = await apiRequest('GET', `/api/v1/event/${series_ticker}/${event_id}/forecast_percentile_history`, forecast_params);
            break;
          case 'get_forecast_percentile_history_by_mint':
            const { mint_address: forecast_mint, ...forecast_mint_params } = toolArgs;
            result = await apiRequest('GET', `/api/v1/event/by-mint/${forecast_mint}/forecast_percentile_history`, forecast_mint_params);
            break;

          // Candlestick endpoints
          case 'get_event_candlesticks':
            const { ticker: event_ticker, ...event_candle_params } = toolArgs;
            result = await apiRequest('GET', `/api/v1/event/${event_ticker}/candlesticks`, event_candle_params);
            break;
          case 'get_market_candlesticks':
            const { ticker: market_ticker, ...market_candle_params } = toolArgs;
            result = await apiRequest('GET', `/api/v1/market/${market_ticker}/candlesticks`, market_candle_params);
            break;
          case 'get_market_candlesticks_by_mint':
            const { mint_address: candle_mint, ...candle_mint_params } = toolArgs;
            result = await apiRequest('GET', `/api/v1/market/by-mint/${candle_mint}/candlesticks`, candle_mint_params);
            break;

          // Live data endpoints
          case 'get_live_data':
            result = await apiRequest('GET', '/api/v1/live_data', { milestoneIds: toolArgs.milestoneIds });
            break;
          case 'get_live_data_by_event':
            const { event_ticker: live_event_ticker, ...live_event_params } = toolArgs;
            result = await apiRequest('GET', `/api/v1/live_data/by-event/${live_event_ticker}`, live_event_params);
            break;
          case 'get_live_data_by_mint':
            const { mint_address: live_mint, ...live_mint_params } = toolArgs;
            result = await apiRequest('GET', `/api/v1/live_data/by-mint/${live_mint}`, live_mint_params);
            break;

          // Series endpoints
          case 'get_series':
            result = await apiRequest('GET', '/api/v1/series', toolArgs);
            break;
          case 'get_series_by_ticker':
            result = await apiRequest('GET', `/api/v1/series/${toolArgs.series_ticker}`, {});
            break;

          // Utility endpoints
          case 'get_outcome_mints':
            result = await apiRequest('GET', '/api/v1/outcome_mints', toolArgs);
            break;
          case 'filter_outcome_mints':
            result = await apiRequest('POST', '/api/v1/filter_outcome_mints', toolArgs);
            break;
          case 'get_tags_by_categories':
            result = await apiRequest('GET', '/api/v1/tags_by_categories', {});
            break;
          case 'get_filters_by_sports':
            result = await apiRequest('GET', '/api/v1/filters_by_sports', {});
            break;
          case 'search_events':
            result = await apiRequest('GET', '/api/v1/search', toolArgs);
            break;

          case 'candlestick_chart':
            const { ticker, startTs, endTs, periodInterval, width, height } = toolArgs;
            const candleData = await apiRequest('GET', `/api/v1/market/${ticker}/candlesticks`, {
              startTs,
              endTs,
              periodInterval
            });

            // Generate ASCII chart
            const chart = generateCandlestickChart(
              candleData.candlesticks || candleData.data || candleData,
              width || 80,
              height || 25
            );

            result = {
              ticker,
              timeframe: `${periodInterval}s intervals`,
              dataPoints: candleData.candlesticks?.length || candleData.data?.length || 0,
              chart
            };
            break;

          default:
            throw new Error(`Unknown tool: ${name}`);
        }

        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: request.id,
            result: {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2)
                }
              ]
            }
          })
        };
      } catch (error) {
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: request.id,
            error: {
              code: -32603,
              message: error.message
            }
          })
        };
      }
    }

    // Method not found
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: request.id,
        error: { code: -32601, message: 'Method not found' }
      })
    };

  } catch (error) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: 'Parse error' }
      })
    };
  }
};
