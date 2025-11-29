'use client';

import React, { useState } from 'react';
import { Wallet } from 'lucide-react';

interface TradingControlsProps {
  market: string;
  walletConnected?: boolean;
}

type OrderType = 'limit' | 'market';
type OrderSide = 'buy' | 'sell';

export default function TradingControls({ market, walletConnected = false }: TradingControlsProps) {
  const [orderSide, setOrderSide] = useState<OrderSide>('buy');
  const [orderType, setOrderType] = useState<OrderType>('limit');
  const [price, setPrice] = useState('');
  const [amount, setAmount] = useState('');
  const [total, setTotal] = useState('');

  const handlePriceChange = (value: string) => {
    setPrice(value);
    if (value && amount) {
      setTotal((parseFloat(value) * parseFloat(amount)).toFixed(2));
    }
  };

  const handleAmountChange = (value: string) => {
    setAmount(value);
    if (value && price) {
      setTotal((parseFloat(value) * parseFloat(price)).toFixed(2));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Order submitted:', { orderSide, orderType, price, amount, total });
    // Here you would integrate with actual trading APIs
  };

  return (
    <div className="trading-controls bg-background">
      {/* Wallet Connection Warning */}
      {!walletConnected && (
        <div className="mb-2 p-2 bg-warning/10 border border-warning/30 rounded text-sm flex items-center gap-2">
          <Wallet className="h-4 w-4 text-warning" />
          <span className="text-warning font-medium">Connect wallet to enable trading</span>
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-2 p-3">
        {/* Row 1: BUY/SELL Toggle + Order Type + Inputs */}
        <div className="flex items-center gap-3">
          {/* BUY/SELL Toggle */}
          <div className="flex items-center gap-1 bg-card rounded p-1 flex-shrink-0">
            <button
              type="button"
              onClick={() => setOrderSide('buy')}
              className={`py-1 px-3 text-xs font-bold rounded transition-colors ${
                orderSide === 'buy'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-foreground hover:bg-muted'
              }`}
            >
              BUY
            </button>
            <button
              type="button"
              onClick={() => setOrderSide('sell')}
              className={`py-1 px-3 text-xs font-bold rounded transition-colors ${
                orderSide === 'sell'
                  ? 'bg-destructive text-primary-foreground'
                  : 'text-foreground hover:bg-muted'
              }`}
            >
              SELL
            </button>
          </div>

          {/* Order Type */}
          <div className="flex items-center gap-1 bg-card rounded p-1 flex-shrink-0">
            <button
              type="button"
              onClick={() => setOrderType('limit')}
              className={`py-1 px-2 text-xs font-medium rounded transition-colors ${
                orderType === 'limit'
                  ? 'bg-background text-primary'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              Limit
            </button>
            <button
              type="button"
              onClick={() => setOrderType('market')}
              className={`py-1 px-2 text-xs font-medium rounded transition-colors ${
                orderType === 'market'
                  ? 'bg-background text-primary'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              Market
            </button>
          </div>

          {/* Price Input (only for limit orders) */}
          {orderType === 'limit' && (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <label className="text-xs text-muted-foreground font-medium whitespace-nowrap">Price</label>
              <div className="relative flex-1">
                <input
                  type="number"
                  value={price}
                  onChange={(e) => handlePriceChange(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  className="w-full px-2 py-1 bg-background border border-border rounded text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary font-mono [color-scheme:dark]"
                />
                <span className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs text-muted-foreground">
                  USDC
                </span>
              </div>
            </div>
          )}

          {/* Amount Input */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <label className="text-xs text-muted-foreground font-medium whitespace-nowrap">Amount</label>
            <div className="relative flex-1">
              <input
                type="number"
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
                placeholder="0.0000"
                step="0.0001"
                className="w-full px-2 py-1 bg-background border border-border rounded text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary font-mono [color-scheme:dark]"
              />
              <span className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs text-muted-foreground">
                SOL
              </span>
            </div>
          </div>
        </div>

        {/* Row 2: Quick Percentages + Total + Balance + Submit */}
        <div className="flex items-center gap-3">
          {/* Percentage Quick Actions */}
          <div className="flex items-center gap-1">
            {[25, 50, 75, 100].map((percent) => (
              <button
                key={percent}
                type="button"
                onClick={() => handleAmountChange((percent / 100 * 10).toString())}
                className="py-0.5 px-2 text-xs bg-card text-muted-foreground hover:bg-muted hover:text-foreground rounded border border-border transition-colors"
              >
                {percent === 100 ? 'MAX' : `${percent}%`}
              </button>
            ))}
          </div>

          {/* Total (calculated, read-only display) */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs text-muted-foreground">Total:</span>
            <span className="text-xs font-mono text-foreground font-semibold">
              {total || '0.00'} USDC
            </span>
          </div>

          {/* Balance */}
          <div className="flex items-center gap-1.5 flex-shrink-0 text-xs text-muted-foreground">
            <Wallet size={11} />
            <span className="font-mono">1,234.56 USDC</span>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!walletConnected}
            className={`py-1.5 px-6 rounded font-semibold text-xs transition-colors flex-shrink-0 ${
              !walletConnected
                ? 'bg-muted text-muted-foreground cursor-not-allowed'
                : orderSide === 'buy'
                ? 'bg-primary hover:bg-primary/90 text-primary-foreground'
                : 'bg-destructive hover:bg-destructive/90 text-primary-foreground'
            }`}
            title={!walletConnected ? 'Connect wallet to trade' : ''}
          >
            {!walletConnected 
              ? 'Connect Wallet to Trade' 
              : `${orderSide === 'buy' ? 'BUY' : 'SELL'} ${market.split('/')[0]}`
            }
          </button>
        </div>
      </form>
    </div>
  );
}
