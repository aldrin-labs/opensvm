'use client';

import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, TrendingUp, Flame, Crown, Clock, ArrowUpRight } from 'lucide-react';

interface TrendingValidator {
  voteAccount: string;
  name: string;
  commission: number;
  activatedStake: number;
  depositVolume24h: number;
  boostEndTime?: number;
  boostAmount?: number;
  trendingScore: number;
  trendingReason: 'volume' | 'boost';
  rank: number;
}

interface TrendingCarouselProps {
  onValidatorClick?: (voteAccount: string) => void;
}

export function TrendingCarousel({ onValidatorClick }: TrendingCarouselProps) {
  const [trendingValidators, setTrendingValidators] = useState<TrendingValidator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showBoostModal, setShowBoostModal] = useState(false);
  const [selectedValidator, setSelectedValidator] = useState<TrendingValidator | null>(null);
  const [boostAmount, setBoostAmount] = useState<number>(10);
  const [boostDuration, setBoostDuration] = useState<number>(24);

  const itemsPerView = 3; // Show 3 trending validators at once

  const fetchTrendingValidators = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/analytics/trending-validators');
      const result = await response.json();
      
      if (result.success) {
        setTrendingValidators(result.data);
        setError(null);
      } else {
        setError(result.error || 'Failed to fetch trending validators');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrendingValidators();
    // Refresh every 2 minutes
    const interval = setInterval(fetchTrendingValidators, 120000);
    return () => clearInterval(interval);
  }, []);

  const formatSOL = (lamports: number) => {
    const sol = lamports / 1e9;
    if (sol >= 1e6) return `${(sol / 1e6).toFixed(2)}M SOL`;
    if (sol >= 1e3) return `${(sol / 1e3).toFixed(2)}K SOL`;
    return `${sol.toFixed(2)} SOL`;
  };

  const formatTimeRemaining = (endTime: number) => {
    const remaining = endTime - Date.now();
    if (remaining <= 0) return 'Expired';
    
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const nextSlide = () => {
    setCurrentIndex((prev) => 
      prev + itemsPerView >= trendingValidators.length ? 0 : prev + 1
    );
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => 
      prev === 0 ? Math.max(0, trendingValidators.length - itemsPerView) : prev - 1
    );
  };

  const handleBoostPurchase = async () => {
    if (!selectedValidator) return;

    try {
      const response = await fetch('/api/analytics/trending-validators', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          voteAccount: selectedValidator.voteAccount,
          amount: boostAmount,
          duration: boostDuration
        })
      });

      const result = await response.json();
      
      if (result.success) {
        setShowBoostModal(false);
        setSelectedValidator(null);
        // Refresh trending data
        fetchTrendingValidators();
        alert('Boost purchased successfully! Your validator will appear in trending shortly.');
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (err) {
      alert(`Error purchasing boost: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  if (loading) {
    return (
      <div className="bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-200 dark:border-orange-800 rounded-lg p-6">
        <div className="flex items-center justify-center h-32">
          <div className="animate-pulse flex items-center">
            <Flame className="h-6 w-6 text-orange-500 mr-2" />
            <span className="text-lg font-medium">Loading trending validators...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error || trendingValidators.length === 0) {
    return (
      <div className="bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-200 dark:border-orange-800 rounded-lg p-6">
        <div className="flex items-center justify-center h-32">
          <div className="text-center">
            <Flame className="h-6 w-6 text-orange-500 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              {error || 'No trending validators available'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const visibleValidators = trendingValidators.slice(currentIndex, currentIndex + itemsPerView);

  return (
    <>
      <div className="bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-200 dark:border-orange-800 rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <Flame className="h-6 w-6 text-orange-500 mr-2" />
            <h3 className="text-lg font-semibold">Trending Validators</h3>
            <TrendingUp className="h-4 w-4 text-orange-500 ml-2" />
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={prevSlide}
              disabled={currentIndex === 0}
              className="p-2 rounded-full bg-background border hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="Previous trending validators"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={nextSlide}
              disabled={currentIndex + itemsPerView >= trendingValidators.length}
              className="p-2 rounded-full bg-background border hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="Next trending validators"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {visibleValidators.map((validator) => (
            <div
              key={validator.voteAccount}
              className="bg-background border rounded-lg p-4 hover:shadow-lg transition-all duration-200 cursor-pointer group"
              onClick={() => onValidatorClick?.(validator.voteAccount)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center">
                  <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-r from-orange-500 to-red-500 rounded-full text-white text-sm font-semibold mr-3">
                    #{validator.rank}
                  </div>
                  <div>
                    <h4 className="font-medium text-sm group-hover:text-primary transition-colors">
                      {validator.name || 'Unknown Validator'}
                    </h4>
                    <p className="text-xs text-muted-foreground truncate w-32">
                      {validator.voteAccount}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center">
                  {validator.trendingReason === 'boost' && validator.boostEndTime && (
                    <div className="flex items-center text-xs text-orange-600 dark:text-orange-400">
                      <Crown className="h-3 w-3 mr-1" />
                      <span>{formatTimeRemaining(validator.boostEndTime)}</span>
                    </div>
                  )}
                  {validator.trendingReason === 'volume' && (
                    <div className="flex items-center text-xs text-green-600 dark:text-green-400">
                      <TrendingUp className="h-3 w-3 mr-1" />
                      <span>Volume</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Stake:</span>
                  <span className="font-medium">{formatSOL(validator.activatedStake)}</span>
                </div>
                
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">24h Deposits:</span>
                  <span className="font-medium text-green-600 dark:text-green-400">
                    {formatSOL(validator.depositVolume24h * 1e9)}
                  </span>
                </div>
                
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Commission:</span>
                  <span className="font-medium">{validator.commission}%</span>
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Trending Score:</span>
                  <span className="font-semibold text-orange-600 dark:text-orange-400">
                    {validator.trendingScore.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedValidator(validator);
                    setShowBoostModal(true);
                  }}
                  className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white text-xs font-medium py-2 px-3 rounded-md transition-all duration-200 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <ArrowUpRight className="h-3 w-3 mr-1" />
                  Buy Boost
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-center mt-4">
          <div className="flex space-x-1">
            {Array.from({ length: Math.ceil(trendingValidators.length / itemsPerView) }).map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index * itemsPerView)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  Math.floor(currentIndex / itemsPerView) === index
                    ? 'bg-orange-500'
                    : 'bg-muted-foreground/30'
                }`}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Boost Purchase Modal */}
      {showBoostModal && selectedValidator && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background border rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Purchase Trending Boost</h3>
              <button
                onClick={() => setShowBoostModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-2">Validator:</p>
                <p className="font-medium">{selectedValidator.name || 'Unknown Validator'}</p>
                <p className="text-xs text-muted-foreground truncate">{selectedValidator.voteAccount}</p>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Boost Amount (SOL)</label>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={boostAmount}
                  onChange={(e) => setBoostAmount(Number(e.target.value))}
                  className="w-full p-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Higher amounts increase your trending score multiplier
                </p>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Duration (hours)</label>
                <select
                  value={boostDuration}
                  onChange={(e) => setBoostDuration(Number(e.target.value))}
                  className="w-full p-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value={24}>24 hours</option>
                  <option value={48}>48 hours</option>
                  <option value={72}>72 hours</option>
                  <option value={168}>1 week</option>
                </select>
              </div>

              <div className="bg-muted/50 p-3 rounded-md">
                <p className="text-sm">
                  <strong>Total Cost:</strong> {boostAmount} SOL for {boostDuration} hours
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Your validator will appear in trending until someone outbids you or the duration expires.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowBoostModal(false)}
                  className="flex-1 py-2 px-4 border rounded-md hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBoostPurchase}
                  className="flex-1 py-2 px-4 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  Purchase Boost
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}