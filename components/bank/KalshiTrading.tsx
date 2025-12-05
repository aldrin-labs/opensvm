'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  TrendingUp,
  TrendingDown,
  Search,
  Loader2,
  X,
  AlertTriangle,
  DollarSign,
  BarChart3,
  Clock,
  ChevronRight,
  RefreshCw,
  Link2,
  Link2Off,
  Eye,
  ShoppingCart,
  Trash2,
  CheckCircle2,
  XCircle,
  Activity,
  Wallet,
  PieChart,
} from 'lucide-react';

interface KalshiMarket {
  ticker: string;
  event_ticker: string;
  title: string;
  subtitle?: string;
  status: string;
  yes_bid: number;
  yes_ask: number;
  no_bid: number;
  no_ask: number;
  last_price: number;
  volume: number;
  volume_24h: number;
  open_interest: number;
  expiration_time: string;
  category?: string;
  result?: string;
}

interface KalshiPosition {
  ticker: string;
  market_title: string;
  position: number;
  average_cost: number;
  total_cost: number;
  current_price?: number;
  side?: string;
  contracts?: number;
  pnl?: {
    unrealized: number;
    maxProfit: number;
    maxLoss: number;
  };
  market_status?: string;
  expiration_time?: string;
}

interface KalshiOrder {
  order_id: string;
  ticker: string;
  side: string;
  type: string;
  action: string;
  count: number;
  price?: number;
  status: string;
  created_time: string;
  filled_count: number;
  remaining_count: number;
}

interface KalshiTradingProps {
  isOpen: boolean;
  onClose: () => void;
}

type Tab = 'markets' | 'portfolio' | 'orders' | 'connect';

export function KalshiTrading({ isOpen, onClose }: KalshiTradingProps) {
  const [activeTab, setActiveTab] = useState<Tab>('markets');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Connection state
  const [connected, setConnected] = useState(false);
  const [isDemo, setIsDemo] = useState(true);
  const [balance, setBalance] = useState(0);
  const [portfolioValue, setPortfolioValue] = useState(0);

  // Connect form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [connectLoading, setConnectLoading] = useState(false);

  // Markets state
  const [markets, setMarkets] = useState<KalshiMarket[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMarket, setSelectedMarket] = useState<KalshiMarket | null>(null);

  // Portfolio state
  const [positions, setPositions] = useState<KalshiPosition[]>([]);
  const [analytics, setAnalytics] = useState<{
    totalUnrealizedPnL: number;
    totalMaxProfit: number;
    totalMaxLoss: number;
  } | null>(null);

  // Orders state
  const [orders, setOrders] = useState<KalshiOrder[]>([]);

  // Order form state
  const [orderSide, setOrderSide] = useState<'yes' | 'no'>('yes');
  const [orderAction, setOrderAction] = useState<'buy' | 'sell'>('buy');
  const [orderType, setOrderType] = useState<'limit' | 'market'>('limit');
  const [orderContracts, setOrderContracts] = useState('');
  const [orderPrice, setOrderPrice] = useState('');
  const [orderLoading, setOrderLoading] = useState(false);

  // Check connection status
  const checkConnection = useCallback(async () => {
    try {
      const response = await fetch('/api/bank/kalshi?action=status', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setConnected(data.connected);
        setIsDemo(data.isDemo ?? true);
        if (data.connected) {
          setBalance(data.balance || 0);
          setPortfolioValue(data.portfolioValue || 0);
        }
      }
    } catch (err) {
      console.error('Failed to check Kalshi connection:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch markets
  const fetchMarkets = useCallback(async () => {
    try {
      const url = searchQuery
        ? `/api/bank/kalshi?action=search&q=${encodeURIComponent(searchQuery)}`
        : '/api/bank/kalshi?action=markets&status=open&limit=50';

      const response = await fetch(url, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setMarkets(data.markets || []);
      }
    } catch (err) {
      console.error('Failed to fetch markets:', err);
    }
  }, [searchQuery]);

  // Fetch portfolio
  const fetchPortfolio = useCallback(async () => {
    if (!connected) return;

    try {
      const response = await fetch('/api/bank/kalshi/portfolio?action=summary', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setBalance(data.balance?.available || 0);
        setPortfolioValue(data.balance?.portfolioValue || 0);
        setPositions(data.positions || []);
        setAnalytics(data.analytics);
      }
    } catch (err) {
      console.error('Failed to fetch portfolio:', err);
    }
  }, [connected]);

  // Fetch orders
  const fetchOrders = useCallback(async () => {
    if (!connected) return;

    try {
      const response = await fetch('/api/bank/kalshi/orders?action=orders&status=open', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setOrders(data.orders || []);
      }
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    }
  }, [connected]);

  // Initial load
  useEffect(() => {
    if (isOpen) {
      checkConnection();
    }
  }, [isOpen, checkConnection]);

  // Tab data loading
  useEffect(() => {
    if (!isOpen) return;

    if (activeTab === 'markets') {
      fetchMarkets();
    } else if (activeTab === 'portfolio' && connected) {
      fetchPortfolio();
    } else if (activeTab === 'orders' && connected) {
      fetchOrders();
    }
  }, [isOpen, activeTab, connected, fetchMarkets, fetchPortfolio, fetchOrders]);

  // Search debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeTab === 'markets') {
        fetchMarkets();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, activeTab, fetchMarkets]);

  // Connect account
  const handleConnect = async () => {
    setError(null);
    setConnectLoading(true);

    try {
      const response = await fetch('/api/bank/kalshi', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, isDemo }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Connection failed');
      }

      const data = await response.json();
      setConnected(true);
      setBalance(data.balance || 0);
      setPortfolioValue(data.portfolioValue || 0);
      setEmail('');
      setPassword('');
      setActiveTab('markets');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setConnectLoading(false);
    }
  };

  // Disconnect account
  const handleDisconnect = async () => {
    if (!confirm('Disconnect your Kalshi account?')) return;

    try {
      await fetch('/api/bank/kalshi', {
        method: 'DELETE',
        credentials: 'include',
      });
      setConnected(false);
      setBalance(0);
      setPortfolioValue(0);
      setPositions([]);
      setOrders([]);
      setActiveTab('connect');
    } catch (err) {
      console.error('Failed to disconnect:', err);
    }
  };

  // Place order
  const handlePlaceOrder = async () => {
    if (!selectedMarket || !orderContracts) return;

    setError(null);
    setOrderLoading(true);

    try {
      const response = await fetch('/api/bank/kalshi/orders', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker: selectedMarket.ticker,
          side: orderSide,
          action: orderAction,
          count: parseInt(orderContracts),
          type: orderType,
          price: orderType === 'limit' ? parseInt(orderPrice) : undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Order failed');
      }

      // Reset form and refresh
      setOrderContracts('');
      setOrderPrice('');
      setSelectedMarket(null);
      fetchPortfolio();
      fetchOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Order failed');
    } finally {
      setOrderLoading(false);
    }
  };

  // Cancel order
  const handleCancelOrder = async (orderId: string) => {
    try {
      await fetch(`/api/bank/kalshi/orders?order_id=${orderId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      fetchOrders();
    } catch (err) {
      console.error('Failed to cancel order:', err);
    }
  };

  // Format time remaining
  const formatTimeRemaining = (expirationTime: string) => {
    const diff = new Date(expirationTime).getTime() - Date.now();
    if (diff < 0) return 'Expired';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) return `${days}d ${hours}h`;
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-background border rounded-xl w-full max-w-4xl mx-4 shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="font-semibold text-lg flex items-center gap-2">
                Kalshi Trading
                {isDemo && connected && (
                  <Badge variant="outline" className="text-xs">Demo</Badge>
                )}
              </h2>
              <p className="text-xs text-muted-foreground">
                Prediction market trading
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {connected && (
              <div className="text-right mr-2">
                <p className="text-sm font-medium">${(balance + portfolioValue).toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">
                  ${balance.toFixed(2)} available
                </p>
              </div>
            )}
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b px-4 flex-shrink-0">
          {[
            { id: 'markets', label: 'Markets', icon: Activity },
            { id: 'portfolio', label: 'Portfolio', icon: PieChart, requiresAuth: true },
            { id: 'orders', label: 'Orders', icon: ShoppingCart, requiresAuth: true },
            { id: 'connect', label: connected ? 'Account' : 'Connect', icon: connected ? Wallet : Link2 },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as Tab)}
              disabled={tab.requiresAuth && !connected}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              } ${tab.requiresAuth && !connected ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Markets Tab */}
              {activeTab === 'markets' && (
                <div className="space-y-4">
                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search markets..."
                      className="pl-10"
                    />
                  </div>

                  {/* Selected Market - Order Form */}
                  {selectedMarket && connected && (
                    <Card className="border-indigo-500/30 bg-indigo-500/5">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-base">{selectedMarket.title}</CardTitle>
                            <CardDescription className="flex items-center gap-2 mt-1">
                              <Clock className="h-3 w-3" />
                              {formatTimeRemaining(selectedMarket.expiration_time)}
                            </CardDescription>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedMarket(null)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Current Prices */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                            <p className="text-xs text-muted-foreground">Yes</p>
                            <p className="text-lg font-bold text-green-600">
                              {selectedMarket.yes_bid}c - {selectedMarket.yes_ask}c
                            </p>
                          </div>
                          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                            <p className="text-xs text-muted-foreground">No</p>
                            <p className="text-lg font-bold text-red-600">
                              {selectedMarket.no_bid}c - {selectedMarket.no_ask}c
                            </p>
                          </div>
                        </div>

                        {/* Order Form */}
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-2">
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant={orderSide === 'yes' ? 'default' : 'outline'}
                                onClick={() => setOrderSide('yes')}
                                className="flex-1"
                              >
                                <TrendingUp className="h-4 w-4 mr-1" />
                                Yes
                              </Button>
                              <Button
                                size="sm"
                                variant={orderSide === 'no' ? 'default' : 'outline'}
                                onClick={() => setOrderSide('no')}
                                className="flex-1"
                              >
                                <TrendingDown className="h-4 w-4 mr-1" />
                                No
                              </Button>
                            </div>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant={orderAction === 'buy' ? 'default' : 'outline'}
                                onClick={() => setOrderAction('buy')}
                                className="flex-1"
                              >
                                Buy
                              </Button>
                              <Button
                                size="sm"
                                variant={orderAction === 'sell' ? 'default' : 'outline'}
                                onClick={() => setOrderAction('sell')}
                                className="flex-1"
                              >
                                Sell
                              </Button>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className="text-xs font-medium mb-1 block">Contracts</label>
                              <Input
                                type="number"
                                value={orderContracts}
                                onChange={(e) => setOrderContracts(e.target.value)}
                                placeholder="10"
                                min={1}
                              />
                            </div>
                            <div>
                              <label className="text-xs font-medium mb-1 block">Type</label>
                              <select
                                value={orderType}
                                onChange={(e) => setOrderType(e.target.value as 'limit' | 'market')}
                                className="w-full p-2 h-10 border rounded-lg bg-background text-sm"
                              >
                                <option value="limit">Limit</option>
                                <option value="market">Market</option>
                              </select>
                            </div>
                            {orderType === 'limit' && (
                              <div>
                                <label className="text-xs font-medium mb-1 block">Price (c)</label>
                                <Input
                                  type="number"
                                  value={orderPrice}
                                  onChange={(e) => setOrderPrice(e.target.value)}
                                  placeholder={orderSide === 'yes' ? selectedMarket.yes_bid.toString() : selectedMarket.no_bid.toString()}
                                  min={1}
                                  max={99}
                                />
                              </div>
                            )}
                          </div>

                          {orderContracts && (
                            <div className="p-2 rounded bg-muted text-sm">
                              <div className="flex justify-between">
                                <span>Cost:</span>
                                <span className="font-medium">
                                  ${((parseInt(orderContracts) * (parseInt(orderPrice) || (orderSide === 'yes' ? selectedMarket.yes_ask : selectedMarket.no_ask))) / 100).toFixed(2)}
                                </span>
                              </div>
                              <div className="flex justify-between text-muted-foreground">
                                <span>Max Profit:</span>
                                <span>
                                  ${((parseInt(orderContracts) * (100 - (parseInt(orderPrice) || (orderSide === 'yes' ? selectedMarket.yes_ask : selectedMarket.no_ask)))) / 100).toFixed(2)}
                                </span>
                              </div>
                            </div>
                          )}

                          {error && (
                            <div className="p-2 rounded bg-red-500/10 border border-red-500/30 text-sm text-red-500 flex items-center gap-2">
                              <AlertTriangle className="h-4 w-4" />
                              {error}
                            </div>
                          )}

                          <Button
                            onClick={handlePlaceOrder}
                            disabled={orderLoading || !orderContracts || (orderType === 'limit' && !orderPrice)}
                            className="w-full gap-2"
                          >
                            {orderLoading ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <ShoppingCart className="h-4 w-4" />
                            )}
                            Place {orderAction === 'buy' ? 'Buy' : 'Sell'} Order
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Markets List */}
                  <div className="space-y-2">
                    {markets.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No markets found</p>
                      </div>
                    ) : (
                      markets.map((market) => (
                        <div
                          key={market.ticker}
                          onClick={() => connected && setSelectedMarket(market)}
                          className={`p-4 rounded-lg border transition-colors ${
                            connected ? 'hover:border-primary/50 cursor-pointer' : ''
                          } ${selectedMarket?.ticker === market.ticker ? 'border-primary bg-primary/5' : ''}`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1 pr-4">
                              <h4 className="font-medium text-sm line-clamp-2">{market.title}</h4>
                              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {formatTimeRemaining(market.expiration_time)}
                                </span>
                                <span>Vol: {market.volume.toLocaleString()}</span>
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <div className="flex items-center gap-2">
                                <div className="text-center">
                                  <p className="text-xs text-muted-foreground">Yes</p>
                                  <p className="font-bold text-green-600">{market.yes_bid}c</p>
                                </div>
                                <div className="text-center">
                                  <p className="text-xs text-muted-foreground">No</p>
                                  <p className="font-bold text-red-600">{market.no_bid}c</p>
                                </div>
                              </div>
                            </div>
                          </div>
                          {!connected && (
                            <p className="text-xs text-muted-foreground mt-2">
                              Connect your Kalshi account to trade
                            </p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Portfolio Tab */}
              {activeTab === 'portfolio' && connected && (
                <div className="space-y-4">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-muted-foreground">Available</p>
                            <p className="text-xl font-bold">${balance.toFixed(2)}</p>
                          </div>
                          <DollarSign className="h-8 w-8 text-muted-foreground" />
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-muted-foreground">In Positions</p>
                            <p className="text-xl font-bold">${portfolioValue.toFixed(2)}</p>
                          </div>
                          <PieChart className="h-8 w-8 text-muted-foreground" />
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-muted-foreground">Unrealized P&L</p>
                            <p className={`text-xl font-bold ${(analytics?.totalUnrealizedPnL || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {(analytics?.totalUnrealizedPnL || 0) >= 0 ? '+' : ''}
                              ${(analytics?.totalUnrealizedPnL || 0).toFixed(2)}
                            </p>
                          </div>
                          {(analytics?.totalUnrealizedPnL || 0) >= 0 ? (
                            <TrendingUp className="h-8 w-8 text-green-600" />
                          ) : (
                            <TrendingDown className="h-8 w-8 text-red-600" />
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Positions */}
                  <div>
                    <h3 className="font-medium mb-3 flex items-center gap-2">
                      <Activity className="h-4 w-4" />
                      Open Positions ({positions.length})
                    </h3>
                    {positions.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground border rounded-lg">
                        <PieChart className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No open positions</p>
                        <Button
                          variant="link"
                          onClick={() => setActiveTab('markets')}
                          className="mt-2"
                        >
                          Browse Markets
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {positions.map((pos) => (
                          <div key={pos.ticker} className="p-4 rounded-lg border">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <Badge variant={pos.side === 'yes' ? 'default' : 'secondary'}>
                                    {pos.side?.toUpperCase()}
                                  </Badge>
                                  <span className="font-medium text-sm">{pos.contracts} contracts</span>
                                </div>
                                <p className="text-sm mt-1 line-clamp-1">{pos.market_title}</p>
                                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                  <span>Avg: {pos.average_cost}c</span>
                                  <span>Current: {pos.current_price}c</span>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className={`font-bold ${(pos.pnl?.unrealized || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {(pos.pnl?.unrealized || 0) >= 0 ? '+' : ''}
                                  ${(pos.pnl?.unrealized || 0).toFixed(2)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Max: +${(pos.pnl?.maxProfit || 0).toFixed(2)}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Orders Tab */}
              {activeTab === 'orders' && connected && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium flex items-center gap-2">
                      <ShoppingCart className="h-4 w-4" />
                      Open Orders ({orders.length})
                    </h3>
                    <Button variant="outline" size="sm" onClick={fetchOrders}>
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>

                  {orders.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground border rounded-lg">
                      <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No open orders</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {orders.map((order) => (
                        <div key={order.order_id} className="p-4 rounded-lg border">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <Badge variant={order.side === 'yes' ? 'default' : 'secondary'}>
                                  {order.side.toUpperCase()}
                                </Badge>
                                <Badge variant="outline">
                                  {order.action.toUpperCase()}
                                </Badge>
                                <span className="text-sm font-medium">
                                  {order.count} @ {order.price}c
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                {order.ticker}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Filled: {order.filled_count} / {order.count}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCancelOrder(order.order_id)}
                              className="text-red-500"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Connect Tab */}
              {activeTab === 'connect' && (
                <div className="space-y-4">
                  {connected ? (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                          Account Connected
                        </CardTitle>
                        <CardDescription>
                          {isDemo ? 'Demo account' : 'Live account'}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-3 rounded-lg bg-muted">
                            <p className="text-xs text-muted-foreground">Available Balance</p>
                            <p className="text-xl font-bold">${balance.toFixed(2)}</p>
                          </div>
                          <div className="p-3 rounded-lg bg-muted">
                            <p className="text-xs text-muted-foreground">Portfolio Value</p>
                            <p className="text-xl font-bold">${portfolioValue.toFixed(2)}</p>
                          </div>
                        </div>

                        <Button
                          variant="destructive"
                          onClick={handleDisconnect}
                          className="w-full gap-2"
                        >
                          <Link2Off className="h-4 w-4" />
                          Disconnect Account
                        </Button>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card>
                      <CardHeader>
                        <CardTitle>Connect Kalshi Account</CardTitle>
                        <CardDescription>
                          Enter your Kalshi credentials to start trading prediction markets
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                            <div className="text-sm">
                              <p className="font-medium text-amber-600">Security Notice</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Your credentials are encrypted using your wallet signature and never stored in plain text.
                                We recommend starting with a demo account.
                              </p>
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="text-sm font-medium mb-1 block">Email</label>
                          <Input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="your@email.com"
                          />
                        </div>

                        <div>
                          <label className="text-sm font-medium mb-1 block">Password</label>
                          <Input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Your Kalshi password"
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="isDemo"
                            checked={isDemo}
                            onChange={(e) => setIsDemo(e.target.checked)}
                            className="rounded"
                          />
                          <label htmlFor="isDemo" className="text-sm">
                            Use demo account (recommended for testing)
                          </label>
                        </div>

                        {error && (
                          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                            <p className="text-sm text-red-500">{error}</p>
                          </div>
                        )}

                        <Button
                          onClick={handleConnect}
                          disabled={connectLoading || !email || !password}
                          className="w-full gap-2"
                        >
                          {connectLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Link2 className="h-4 w-4" />
                          )}
                          Connect Account
                        </Button>

                        <p className="text-xs text-muted-foreground text-center">
                          Don't have a Kalshi account?{' '}
                          <a
                            href="https://kalshi.com/sign-up"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            Sign up here
                          </a>
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
