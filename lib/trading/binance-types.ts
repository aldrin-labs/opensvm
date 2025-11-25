// Binance-compatible API types for Solana DEX trading
// These types mirror the Binance Spot API for easy migration

// ===== Exchange Information =====

export interface BinanceExchangeInfo {
  timezone: string;
  serverTime: number;
  rateLimits: RateLimit[];
  symbols: SymbolInfo[];
}

export interface RateLimit {
  rateLimitType: 'REQUEST_WEIGHT' | 'ORDERS' | 'RAW_REQUESTS';
  interval: 'SECOND' | 'MINUTE' | 'DAY';
  intervalNum: number;
  limit: number;
}

export interface SymbolInfo {
  symbol: string;
  status: 'TRADING' | 'HALT' | 'BREAK';
  baseAsset: string;
  baseAssetPrecision: number;
  quoteAsset: string;
  quotePrecision: number;
  quoteAssetPrecision: number;
  orderTypes: OrderType[];
  icebergAllowed: boolean;
  ocoAllowed: boolean;
  isSpotTradingAllowed: boolean;
  isMarginTradingAllowed: boolean;
  filters: SymbolFilter[];
  permissions: string[];
  // Solana-specific extensions
  baseMint?: string;
  quoteMint?: string;
  dexSources?: string[];
}

export type SymbolFilter =
  | PriceFilter
  | LotSizeFilter
  | MinNotionalFilter
  | MaxNumOrdersFilter;

export interface PriceFilter {
  filterType: 'PRICE_FILTER';
  minPrice: string;
  maxPrice: string;
  tickSize: string;
}

export interface LotSizeFilter {
  filterType: 'LOT_SIZE';
  minQty: string;
  maxQty: string;
  stepSize: string;
}

export interface MinNotionalFilter {
  filterType: 'MIN_NOTIONAL';
  minNotional: string;
  applyToMarket: boolean;
  avgPriceMins: number;
}

export interface MaxNumOrdersFilter {
  filterType: 'MAX_NUM_ORDERS';
  maxNumOrders: number;
}

// ===== Order Types =====

export type OrderType = 'LIMIT' | 'MARKET' | 'STOP_LOSS' | 'STOP_LOSS_LIMIT' | 'TAKE_PROFIT' | 'TAKE_PROFIT_LIMIT' | 'LIMIT_MAKER';
export type OrderSide = 'BUY' | 'SELL';
export type OrderStatus = 'NEW' | 'PARTIALLY_FILLED' | 'FILLED' | 'CANCELED' | 'PENDING_CANCEL' | 'REJECTED' | 'EXPIRED';
export type TimeInForce = 'GTC' | 'IOC' | 'FOK';

// ===== Order Requests =====

export interface NewOrderRequest {
  symbol: string;
  side: OrderSide;
  type: OrderType;
  timeInForce?: TimeInForce;
  quantity: string;
  quoteOrderQty?: string;
  price?: string;
  newClientOrderId?: string;
  stopPrice?: string;
  icebergQty?: string;
  newOrderRespType?: 'ACK' | 'RESULT' | 'FULL';
  recvWindow?: number;
  timestamp: number;
  // Solana-specific
  walletAddress?: string;
  slippageBps?: number;
}

export interface CancelOrderRequest {
  symbol: string;
  orderId?: number;
  origClientOrderId?: string;
  newClientOrderId?: string;
  recvWindow?: number;
  timestamp: number;
}

export interface QueryOrderRequest {
  symbol: string;
  orderId?: number;
  origClientOrderId?: string;
  recvWindow?: number;
  timestamp: number;
}

// ===== Order Responses =====

export interface OrderResponse {
  symbol: string;
  orderId: number;
  orderListId: number;
  clientOrderId: string;
  transactTime: number;
  price: string;
  origQty: string;
  executedQty: string;
  cummulativeQuoteQty: string;
  status: OrderStatus;
  timeInForce: TimeInForce;
  type: OrderType;
  side: OrderSide;
  fills?: Fill[];
  // Solana-specific extensions
  txSignature?: string;
  route?: RouteInfo[];
  priceImpact?: string;
}

export interface Fill {
  price: string;
  qty: string;
  commission: string;
  commissionAsset: string;
  tradeId: number;
}

export interface RouteInfo {
  dex: string;
  poolAddress: string;
  inputMint: string;
  outputMint: string;
  inputAmount: string;
  outputAmount: string;
}

// ===== Account =====

export interface AccountInfo {
  makerCommission: number;
  takerCommission: number;
  buyerCommission: number;
  sellerCommission: number;
  canTrade: boolean;
  canWithdraw: boolean;
  canDeposit: boolean;
  updateTime: number;
  accountType: 'SPOT';
  balances: Balance[];
  permissions: string[];
  // Solana-specific
  walletAddress?: string;
}

export interface Balance {
  asset: string;
  free: string;
  locked: string;
  // Solana-specific
  mint?: string;
}

// ===== Market Data =====

export interface Ticker24hr {
  symbol: string;
  priceChange: string;
  priceChangePercent: string;
  weightedAvgPrice: string;
  prevClosePrice: string;
  lastPrice: string;
  lastQty: string;
  bidPrice: string;
  bidQty: string;
  askPrice: string;
  askQty: string;
  openPrice: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
  openTime: number;
  closeTime: number;
  firstId: number;
  lastId: number;
  count: number;
}

export interface TickerPrice {
  symbol: string;
  price: string;
}

export interface BookTicker {
  symbol: string;
  bidPrice: string;
  bidQty: string;
  askPrice: string;
  askQty: string;
}

export interface OrderBookEntry {
  price: string;
  quantity: string;
}

export interface OrderBook {
  lastUpdateId: number;
  bids: [string, string][]; // [price, quantity]
  asks: [string, string][]; // [price, quantity]
}

export interface Trade {
  id: number;
  price: string;
  qty: string;
  quoteQty: string;
  time: number;
  isBuyerMaker: boolean;
  isBestMatch: boolean;
}

export interface AggTrade {
  a: number;  // Aggregate tradeId
  p: string;  // Price
  q: string;  // Quantity
  f: number;  // First tradeId
  l: number;  // Last tradeId
  T: number;  // Timestamp
  m: boolean; // Was the buyer the maker?
  M: boolean; // Was the trade the best price match?
}

export interface Kline {
  openTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  closeTime: number;
  quoteAssetVolume: string;
  numberOfTrades: number;
  takerBuyBaseAssetVolume: string;
  takerBuyQuoteAssetVolume: string;
}

// ===== WebSocket Streams =====

export interface WsTradeEvent {
  e: 'trade';
  E: number;  // Event time
  s: string;  // Symbol
  t: number;  // Trade ID
  p: string;  // Price
  q: string;  // Quantity
  b: number;  // Buyer order ID
  a: number;  // Seller order ID
  T: number;  // Trade time
  m: boolean; // Is the buyer the market maker?
  M: boolean; // Ignore
}

export interface WsKlineEvent {
  e: 'kline';
  E: number;
  s: string;
  k: {
    t: number;  // Kline start time
    T: number;  // Kline close time
    s: string;  // Symbol
    i: string;  // Interval
    f: number;  // First trade ID
    L: number;  // Last trade ID
    o: string;  // Open price
    c: string;  // Close price
    h: string;  // High price
    l: string;  // Low price
    v: string;  // Base asset volume
    n: number;  // Number of trades
    x: boolean; // Is this kline closed?
    q: string;  // Quote asset volume
    V: string;  // Taker buy base asset volume
    Q: string;  // Taker buy quote asset volume
  };
}

export interface WsDepthEvent {
  e: 'depthUpdate';
  E: number;
  s: string;
  U: number;  // First update ID in event
  u: number;  // Final update ID in event
  b: [string, string][];  // Bids
  a: [string, string][];  // Asks
}

export interface WsTickerEvent {
  e: '24hrTicker';
  E: number;
  s: string;
  p: string;  // Price change
  P: string;  // Price change percent
  w: string;  // Weighted average price
  x: string;  // First trade(F)-1 price
  c: string;  // Last price
  Q: string;  // Last quantity
  b: string;  // Best bid price
  B: string;  // Best bid quantity
  a: string;  // Best ask price
  A: string;  // Best ask quantity
  o: string;  // Open price
  h: string;  // High price
  l: string;  // Low price
  v: string;  // Total traded base asset volume
  q: string;  // Total traded quote asset volume
  O: number;  // Statistics open time
  C: number;  // Statistics close time
  F: number;  // First trade ID
  L: number;  // Last trade Id
  n: number;  // Total number of trades
}

export interface WsBookTickerEvent {
  u: number;  // Order book updateId
  s: string;  // Symbol
  b: string;  // Best bid price
  B: string;  // Best bid qty
  a: string;  // Best ask price
  A: string;  // Best ask qty
}

// ===== Error Response =====

export interface BinanceError {
  code: number;
  msg: string;
}

// ===== User Data Stream =====

export interface ListenKeyResponse {
  listenKey: string;
}

export interface WsAccountUpdateEvent {
  e: 'outboundAccountPosition';
  E: number;
  u: number;
  B: Array<{
    a: string;  // Asset
    f: string;  // Free
    l: string;  // Locked
  }>;
}

export interface WsOrderUpdateEvent {
  e: 'executionReport';
  E: number;
  s: string;  // Symbol
  c: string;  // Client order ID
  S: OrderSide;
  o: OrderType;
  f: TimeInForce;
  q: string;  // Order quantity
  p: string;  // Order price
  P: string;  // Stop price
  F: string;  // Iceberg quantity
  g: number;  // OrderListId
  C: string;  // Original client order ID
  x: 'NEW' | 'CANCELED' | 'REPLACED' | 'REJECTED' | 'TRADE' | 'EXPIRED';
  X: OrderStatus;
  r: string;  // Order reject reason
  i: number;  // Order ID
  l: string;  // Last executed quantity
  z: string;  // Cumulative filled quantity
  L: string;  // Last executed price
  n: string;  // Commission amount
  N: string;  // Commission asset
  T: number;  // Transaction time
  t: number;  // Trade ID
  I: number;  // Ignore
  w: boolean; // Is the order on the book?
  m: boolean; // Is this trade the maker side?
  M: boolean; // Ignore
  O: number;  // Order creation time
  Z: string;  // Cumulative quote asset transacted quantity
  Y: string;  // Last quote asset transacted quantity
  Q: string;  // Quote Order Qty
}
