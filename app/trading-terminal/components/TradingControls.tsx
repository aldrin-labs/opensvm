'use client';

import React, { useState } from 'react';
import { Wallet } from 'lucide-react';

interface TradingControlsProps {
  market: string;
}

type OrderType = 'limit' | 'market';
type OrderSide = 'buy' | 'sell';

export default function TradingControls({ market }: TradingControlsProps) {
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

  const handleTotalChange = (value: string) => {
    setTotal(value);
    if (value && price) {
      setAmount((parseFloat(value) / parseFloat(price)).toFixed(4));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Order submitted:', { orderSide, orderType, price, amount, total });
    // Here you would integrate with actual trading APIs
  };

  return (
    <div className="trading-controls p-4 bg-background border-t border-border">
      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Order Side Tabs */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setOrderSide('buy')}
            className={`py-2 px-4 rounded font-semibold transition-colors ${
              orderSide === 'buy'
                ? 'bg-primary text-primary-foreground'
                : 'bg-card text-foreground hover:bg-muted border border-border'
            }`}
          >
            BUY
          </button>
          <button
            type="button"
            onClick={() => setOrderSide('sell')}
            className={`py-2 px-4 rounded font-semibold transition-colors ${
              orderSide === 'sell'
                ? 'bg-destructive text-primary-foreground'
                : 'bg-card text-foreground hover:bg-muted border border-border'
            }`}
          >
            SELL
          </button>
        </div>

        {/* Order Type Selector */}
        <div className="flex items-center gap-2 bg-card rounded p-1">
          <button
            type="button"
            onClick={() => setOrderType('limit')}
            className={`flex-1 py-1.5 px-3 text-xs font-medium rounded transition-colors ${
              orderType === 'limit'
                ? 'bg-background text-primary'
                : 'text-foreground hover:bg-muted'
            }`}
          >
            Limit
          </button>
          <button
            type="button"
            onClick={() => setOrderType('market')}
            className={`flex-1 py-1.5 px-3 text-xs font-medium rounded transition-colors ${
              orderType === 'market'
                ? 'bg-background text-primary'
                : 'text-foreground hover:bg-muted'
            }`}
          >
            Market
          </button>
        </div>

        {/* Price Input (hidden for market orders) */}
        {orderType === 'limit' && (
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground font-medium">PRICE</label>
            <div className="relative">
              <input
                type="number"
                value={price}
                onChange={(e) => handlePriceChange(e.target.value)}
                placeholder="0.00"
                step="0.01"
                className="w-full px-3 py-2 bg-card border border-border rounded text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary font-mono"
              />
              <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-muted-foreground">
                USDC
              </span>
            </div>
          </div>
        )}

        {/* Amount Input */}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground font-medium">AMOUNT</label>
          <div className="relative">
            <input
              type="number"
              value={amount}
              onChange={(e) => handleAmountChange(e.target.value)}
              placeholder="0.0000"
              step="0.0001"
              className="w-full px-3 py-2 bg-card border border-border rounded text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary font-mono"
            />
            <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-muted-foreground">
              SOL
            </span>
          </div>
        </div>

        {/* Amount Percentage Buttons */}
        <div className="grid grid-cols-4 gap-1">
          {[25, 50, 75, 100].map((percent) => (
            <button
              key={percent}
              type="button"
              onClick={() => handleAmountChange((percent / 100 * 10).toString())}
              className="py-1 px-2 text-xs bg-card text-foreground hover:bg-muted rounded border border-border transition-colors"
            >
              {percent}%
            </button>
          ))}
        </div>

        {/* Total Input */}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground font-medium">TOTAL</label>
          <div className="relative">
            <input
              type="number"
              value={total}
              onChange={(e) => handleTotalChange(e.target.value)}
              placeholder="0.00"
              step="0.01"
              className="w-full px-3 py-2 bg-card border border-border rounded text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary font-mono"
            />
            <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-muted-foreground">
              USDC
            </span>
          </div>
        </div>

        {/* Balance Info */}
        <div className="flex items-center justify-between text-xs text-muted-foreground py-2">
          <div className="flex items-center gap-1">
            <Wallet size={12} />
            <span>Available:</span>
          </div>
          <span className="font-mono">1,234.56 USDC</span>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          className={`w-full py-3 rounded font-semibold transition-colors ${
            orderSide === 'buy'
              ? 'bg-primary hover:bg-primary/90 text-primary-foreground'
              : 'bg-destructive hover:bg-destructive/90 text-primary-foreground'
          }`}
        >
          {orderSide === 'buy' ? 'BUY' : 'SELL'} {market.split('/')[0]}
        </button>

        {/* Warning */}
        <p className="text-xs text-muted-foreground text-center">
          Connect wallet to start trading
        </p>
      </form>
    </div>
  );
}
