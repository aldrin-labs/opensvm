/**
 * Kalshi Prediction Market API Client
 *
 * Integrates with Kalshi's REST API for prediction market trading.
 * Supports both demo and production environments.
 */

// API Base URLs
const KALSHI_API_BASE = process.env.KALSHI_API_URL || 'https://api.elections.kalshi.com/trade-api/v2';
const KALSHI_DEMO_API_BASE = 'https://demo-api.kalshi.co/trade-api/v2';

// Use demo mode by default for safety
const USE_DEMO = process.env.KALSHI_USE_DEMO !== 'false';

interface KalshiCredentials {
  email: string;
  password: string;
}

interface KalshiAuthResponse {
  token: string;
  member_id: string;
}

interface KalshiMarket {
  ticker: string;
  event_ticker: string;
  title: string;
  subtitle?: string;
  open_time: string;
  close_time: string;
  expiration_time: string;
  status: 'open' | 'closed' | 'settled';
  yes_bid: number;
  yes_ask: number;
  no_bid: number;
  no_ask: number;
  last_price: number;
  volume: number;
  volume_24h: number;
  open_interest: number;
  result?: 'yes' | 'no';
  category: string;
  series_ticker: string;
}

interface KalshiEvent {
  event_ticker: string;
  title: string;
  subtitle?: string;
  category: string;
  markets: KalshiMarket[];
  status: string;
}

interface KalshiOrderbook {
  ticker: string;
  yes: Array<{ price: number; quantity: number }>;
  no: Array<{ price: number; quantity: number }>;
}

interface KalshiPosition {
  ticker: string;
  market_title: string;
  position: number; // positive = yes, negative = no
  average_cost: number;
  total_cost: number;
  resting_orders_count: number;
}

interface KalshiBalance {
  balance: number; // in cents
  portfolio_value: number;
}

interface KalshiOrder {
  order_id: string;
  ticker: string;
  side: 'yes' | 'no';
  type: 'limit' | 'market';
  action: 'buy' | 'sell';
  count: number;
  price?: number; // in cents (1-99)
  status: 'pending' | 'open' | 'filled' | 'cancelled';
  created_time: string;
  filled_count: number;
  remaining_count: number;
}

interface PlaceOrderParams {
  ticker: string;
  side: 'yes' | 'no';
  action: 'buy' | 'sell';
  count: number;
  type: 'limit' | 'market';
  price?: number; // cents (1-99) for limit orders
  expiration_ts?: number;
}

interface KalshiTrade {
  trade_id: string;
  ticker: string;
  side: 'yes' | 'no';
  count: number;
  price: number;
  created_time: string;
  is_taker: boolean;
}

// Token cache with expiry tracking
let tokenCache: {
  token: string;
  memberId: string;
  expiresAt: number;
} | null = null;

/**
 * Get the API base URL
 */
function getBaseUrl(): string {
  return USE_DEMO ? KALSHI_DEMO_API_BASE : KALSHI_API_BASE;
}

/**
 * Authenticate with Kalshi and get access token
 */
export async function authenticate(credentials: KalshiCredentials): Promise<KalshiAuthResponse> {
  // Check cache first (tokens expire in 30 minutes)
  if (tokenCache && tokenCache.expiresAt > Date.now()) {
    return { token: tokenCache.token, member_id: tokenCache.memberId };
  }

  const response = await fetch(`${getBaseUrl()}/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: credentials.email,
      password: credentials.password,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Kalshi authentication failed: ${error}`);
  }

  const data = await response.json();

  // Cache token (expires in 25 minutes to be safe)
  tokenCache = {
    token: data.token,
    memberId: data.member_id,
    expiresAt: Date.now() + 25 * 60 * 1000,
  };

  return { token: data.token, member_id: data.member_id };
}

/**
 * Make authenticated API request
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  token?: string
): Promise<T> {
  const url = `${getBaseUrl()}${endpoint}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Kalshi API error (${response.status}): ${error}`);
  }

  return response.json();
}

/**
 * Get list of markets with optional filters
 */
export async function getMarkets(params?: {
  status?: 'open' | 'closed' | 'settled';
  event_ticker?: string;
  series_ticker?: string;
  cursor?: string;
  limit?: number;
}): Promise<{ markets: KalshiMarket[]; cursor?: string }> {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set('status', params.status);
  if (params?.event_ticker) searchParams.set('event_ticker', params.event_ticker);
  if (params?.series_ticker) searchParams.set('series_ticker', params.series_ticker);
  if (params?.cursor) searchParams.set('cursor', params.cursor);
  if (params?.limit) searchParams.set('limit', params.limit.toString());

  const query = searchParams.toString();
  return apiRequest(`/markets${query ? `?${query}` : ''}`);
}

/**
 * Get single market details
 */
export async function getMarket(ticker: string): Promise<{ market: KalshiMarket }> {
  return apiRequest(`/markets/${ticker}`);
}

/**
 * Get market orderbook
 */
export async function getOrderbook(ticker: string): Promise<{ orderbook: KalshiOrderbook }> {
  return apiRequest(`/markets/${ticker}/orderbook`);
}

/**
 * Get events list
 */
export async function getEvents(params?: {
  status?: string;
  series_ticker?: string;
  cursor?: string;
  limit?: number;
}): Promise<{ events: KalshiEvent[]; cursor?: string }> {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set('status', params.status);
  if (params?.series_ticker) searchParams.set('series_ticker', params.series_ticker);
  if (params?.cursor) searchParams.set('cursor', params.cursor);
  if (params?.limit) searchParams.set('limit', params.limit.toString());

  const query = searchParams.toString();
  return apiRequest(`/events${query ? `?${query}` : ''}`);
}

/**
 * Get single event details
 */
export async function getEvent(eventTicker: string): Promise<{ event: KalshiEvent }> {
  return apiRequest(`/events/${eventTicker}`);
}

/**
 * Get account balance
 */
export async function getBalance(token: string): Promise<KalshiBalance> {
  return apiRequest('/portfolio/balance', {}, token);
}

/**
 * Get current positions
 */
export async function getPositions(token: string): Promise<{ market_positions: KalshiPosition[] }> {
  return apiRequest('/portfolio/positions', {}, token);
}

/**
 * Get user's orders
 */
export async function getOrders(
  token: string,
  params?: {
    ticker?: string;
    status?: 'open' | 'pending' | 'filled' | 'cancelled';
    cursor?: string;
    limit?: number;
  }
): Promise<{ orders: KalshiOrder[]; cursor?: string }> {
  const searchParams = new URLSearchParams();
  if (params?.ticker) searchParams.set('ticker', params.ticker);
  if (params?.status) searchParams.set('status', params.status);
  if (params?.cursor) searchParams.set('cursor', params.cursor);
  if (params?.limit) searchParams.set('limit', params.limit.toString());

  const query = searchParams.toString();
  return apiRequest(`/portfolio/orders${query ? `?${query}` : ''}`, {}, token);
}

/**
 * Place a new order
 */
export async function placeOrder(
  token: string,
  params: PlaceOrderParams
): Promise<{ order: KalshiOrder }> {
  const body: Record<string, unknown> = {
    ticker: params.ticker,
    side: params.side,
    action: params.action,
    count: params.count,
    type: params.type,
  };

  if (params.type === 'limit' && params.price !== undefined) {
    body.yes_price = params.side === 'yes' ? params.price : undefined;
    body.no_price = params.side === 'no' ? params.price : undefined;
  }

  if (params.expiration_ts) {
    body.expiration_ts = params.expiration_ts;
  }

  return apiRequest('/portfolio/orders', {
    method: 'POST',
    body: JSON.stringify(body),
  }, token);
}

/**
 * Cancel an order
 */
export async function cancelOrder(
  token: string,
  orderId: string
): Promise<{ order: KalshiOrder }> {
  return apiRequest(`/portfolio/orders/${orderId}`, {
    method: 'DELETE',
  }, token);
}

/**
 * Get trade history
 */
export async function getTrades(
  token: string,
  params?: {
    ticker?: string;
    cursor?: string;
    limit?: number;
  }
): Promise<{ trades: KalshiTrade[]; cursor?: string }> {
  const searchParams = new URLSearchParams();
  if (params?.ticker) searchParams.set('ticker', params.ticker);
  if (params?.cursor) searchParams.set('cursor', params.cursor);
  if (params?.limit) searchParams.set('limit', params.limit.toString());

  const query = searchParams.toString();
  return apiRequest(`/portfolio/fills${query ? `?${query}` : ''}`, {}, token);
}

/**
 * Search markets by keyword
 */
export async function searchMarkets(query: string): Promise<{ markets: KalshiMarket[] }> {
  const encoded = encodeURIComponent(query);
  return apiRequest(`/markets?title=${encoded}&status=open`);
}

/**
 * Get market categories
 */
export async function getCategories(): Promise<string[]> {
  // Kalshi categories
  return [
    'Politics',
    'Economics',
    'Finance',
    'Climate',
    'Science',
    'Tech',
    'Entertainment',
    'Sports',
    'Companies',
    'Legal',
    'Health',
    'World'
  ];
}

/**
 * Calculate potential profit/loss for a position
 */
export function calculatePnL(
  position: number,
  avgCost: number,
  currentPrice: number,
  contractsToClose?: number
): { realized: number; unrealized: number; maxProfit: number; maxLoss: number } {
  const contracts = contractsToClose || Math.abs(position);
  const isYes = position > 0;

  // Current value per contract (price is in cents, 1-99)
  const currentValue = isYes ? currentPrice : (100 - currentPrice);
  const costBasis = avgCost;

  // Unrealized P&L per contract
  const unrealizedPerContract = currentValue - costBasis;
  const unrealized = unrealizedPerContract * contracts;

  // Max profit: if contract settles at 100 (yes wins) or 0 (no wins)
  const maxProfit = isYes
    ? (100 - costBasis) * contracts  // Yes: profit if settles at 100
    : costBasis * contracts;          // No: profit if settles at 0

  // Max loss: if contract settles opposite
  const maxLoss = isYes
    ? costBasis * contracts            // Yes: lose cost basis if settles at 0
    : (100 - costBasis) * contracts;   // No: lose cost basis if settles at 100

  return {
    realized: 0, // Would need trade history to calculate
    unrealized: unrealized / 100, // Convert cents to dollars
    maxProfit: maxProfit / 100,
    maxLoss: maxLoss / 100,
  };
}

/**
 * Format price from cents to display
 */
export function formatPrice(cents: number): string {
  return `${cents}¢`;
}

/**
 * Format price as implied probability
 */
export function formatProbability(cents: number): string {
  return `${cents}%`;
}

/**
 * Convert dollar amount to contracts at given price
 */
export function dollarsToContracts(dollars: number, priceInCents: number): number {
  // Each contract costs priceInCents cents
  // dollars * 100 = total cents
  // total cents / priceInCents = number of contracts
  return Math.floor((dollars * 100) / priceInCents);
}

/**
 * Calculate cost for given contracts at price
 */
export function contractsToDollars(contracts: number, priceInCents: number): number {
  return (contracts * priceInCents) / 100;
}

// Export types
export type {
  KalshiMarket,
  KalshiEvent,
  KalshiOrderbook,
  KalshiPosition,
  KalshiBalance,
  KalshiOrder,
  KalshiTrade,
  PlaceOrderParams,
  KalshiCredentials,
  KalshiAuthResponse,
};
