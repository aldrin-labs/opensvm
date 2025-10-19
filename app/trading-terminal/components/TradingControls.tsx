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
    <div className="trading-controls p-4 bg-[#1e1e1e] border-t border-[#3e3e42]">
      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Order Side Tabs */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setOrderSide('buy')}
            className={`py-2 px-4 rounded font-semibold transition-colors ${
              orderSide === 'buy'
                ? 'bg-[#4ec9b0] text-[#1e1e1e]'
                : 'bg-[#252526] text-[#cccccc] hover:bg-[#2a2d2e] border border-[#3e3e42]'
            }`}
          >
            BUY
          </button>
          <button
            type="button"
            onClick={() => setOrderSide('sell')}
            className={`py-2 px-4 rounded font-semibold transition-colors ${
              orderSide === 'sell'
                ? 'bg-[#f48771] text-[#1e1e1e]'
                : 'bg-[#252526] text-[#cccccc] hover:bg-[#2a2d2e] border border-[#3e3e42]'
            }`}
          >
            SELL
          </button>
        </div>

        {/* Order Type Selector */}
        <div className="flex items-center gap-2 bg-[#252526] rounded p-1">
          <button
            type="button"
            onClick={() => setOrderType('limit')}
            className={`flex-1 py-1.5 px-3 text-xs font-medium rounded transition-colors ${
              orderType === 'limit'
                ? 'bg-[#1e1e1e] text-[#4ec9b0]'
                : 'text-[#cccccc] hover:bg-[#2a2d2e]'
            }`}
          >
            Limit
          </button>
          <button
            type="button"
            onClick={() => setOrderType('market')}
            className={`flex-1 py-1.5 px-3 text-xs font-medium rounded transition-colors ${
              orderType === 'market'
                ? 'bg-[#1e1e1e] text-[#4ec9b0]'
                : 'text-[#cccccc] hover:bg-[#2a2d2e]'
            }`}
          >
            Market
          </button>
        </div>

        {/* Price Input (hidden for market orders) */}
        {orderType === 'limit' && (
          <div className="space-y-1">
            <label className="text-xs text-[#858585] font-medium">PRICE</label>
            <div className="relative">
              <input
                type="number"
                value={price}
                onChange={(e) => handlePriceChange(e.target.value)}
                placeholder="0.00"
                step="0.01"
                className="w-full px-3 py-2 bg-[#252526] border border-[#3e3e42] rounded text-sm text-[#cccccc] placeholder-[#858585] focus:outline-none focus:border-[#4ec9b0] font-mono"
              />
              <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-[#858585]">
                USDC
              </span>
            </div>
          </div>
        )}

        {/* Amount Input */}
        <div className="space-y-1">
          <label className="text-xs text-[#858585] font-medium">AMOUNT</label>
          <div className="relative">
            <input
              type="number"
              value={amount}
              onChange={(e) => handleAmountChange(e.target.value)}
              placeholder="0.0000"
              step="0.0001"
              className="w-full px-3 py-2 bg-[#252526] border border-[#3e3e42] rounded text-sm text-[#cccccc] placeholder-[#858585] focus:outline-none focus:border-[#4ec9b0] font-mono"
            />
            <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-[#858585]">
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
              className="py-1 px-2 text-xs bg-[#252526] text-[#cccccc] hover:bg-[#2a2d2e] rounded border border-[#3e3e42] transition-colors"
            >
              {percent}%
            </button>
          ))}
        </div>

        {/* Total Input */}
        <div className="space-y-1">
          <label className="text-xs text-[#858585] font-medium">TOTAL</label>
          <div className="relative">
            <input
              type="number"
              value={total}
              onChange={(e) => handleTotalChange(e.target.value)}
              placeholder="0.00"
              step="0.01"
              className="w-full px-3 py-2 bg-[#252526] border border-[#3e3e42] rounded text-sm text-[#cccccc] placeholder-[#858585] focus:outline-none focus:border-[#4ec9b0] font-mono"
            />
            <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-[#858585]">
              USDC
            </span>
          </div>
        </div>

        {/* Balance Info */}
        <div className="flex items-center justify-between text-xs text-[#858585] py-2">
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
              ? 'bg-[#4ec9b0] hover:bg-[#4ec9b0]/90 text-[#1e1e1e]'
              : 'bg-[#f48771] hover:bg-[#f48771]/90 text-[#1e1e1e]'
          }`}
        >
          {orderSide === 'buy' ? 'BUY' : 'SELL'} {market.split('/')[0]}
        </button>

        {/* Warning */}
        <p className="text-xs text-[#858585] text-center">
          Connect wallet to start trading
        </p>
      </form>
    </div>
  );
}
