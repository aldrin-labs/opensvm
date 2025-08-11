'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight, TrendingUp, Flame, Crown } from 'lucide-react';

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
  const abortControllerRef = useRef<AbortController | null>(null);
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  const itemsPerView = 6; // Show 6 trending validators at once for thin layout

  const fetchTrendingValidators = useCallback(async () => {
    try {
      // 📊 PERFORMANCE: Cancel any previous requests to prevent race conditions
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      setLoading(true);
      setError(null);

      // 🔒 SECURITY: Add timeout protection
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }

      fetchTimeoutRef.current = setTimeout(() => {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
      }, 15000); // 15 second timeout

      const response = await fetch('/api/analytics/trending-validators', {
        signal: abortControllerRef.current.signal,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });

      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
        fetchTimeoutRef.current = null;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      // 🔒 SECURITY: Validate response structure
      if (!result || typeof result !== 'object') {
        throw new Error('Invalid response format');
      }

      if (result.success) {
        // 📊 BUSINESS LOGIC: Sanitize and validate trending validators data
        const sanitizedValidators = Array.isArray(result.data) ?
          result.data.slice(0, 50).map((validator: any) => { // Limit to 50 for performance
            // Validate required fields
            if (!validator || typeof validator !== 'object') {
              return null;
            }

            return {
              voteAccount: typeof validator.voteAccount === 'string' ? validator.voteAccount.trim() : '',
              name: typeof validator.name === 'string' ?
                validator.name.replace(/[<>&"']/g, '').trim().slice(0, 100) : 'Unknown', // XSS protection
              commission: typeof validator.commission === 'number' ?
                Math.max(0, Math.min(100, validator.commission)) : 0, // Clamp between 0-100%
              activatedStake: typeof validator.activatedStake === 'number' ?
                Math.max(0, validator.activatedStake) : 0,
              depositVolume24h: typeof validator.depositVolume24h === 'number' ?
                Math.max(0, validator.depositVolume24h) : 0,
              boostEndTime: typeof validator.boostEndTime === 'number' ? validator.boostEndTime : undefined,
              boostAmount: typeof validator.boostAmount === 'number' ?
                Math.max(0, validator.boostAmount) : undefined,
              trendingScore: typeof validator.trendingScore === 'number' ?
                Math.max(0, validator.trendingScore) : 0,
              trendingReason: ['volume', 'boost'].includes(validator.trendingReason) ?
                validator.trendingReason : 'volume',
              rank: typeof validator.rank === 'number' ?
                Math.max(1, validator.rank) : 1
            };
          }).filter(Boolean) : []; // Remove any null entries

        // Only update state if component is still mounted
        if (mountedRef.current) {
          setTrendingValidators(sanitizedValidators);
          setError(null);
        }
      } else {
        throw new Error(result.error || 'Failed to fetch trending validators');
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Request was cancelled, this is expected
        return;
      }

      console.error('Error fetching trending validators:', err);

      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Network error');
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
        fetchTimeoutRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchTrendingValidators();

    // Refresh every 2 minutes with proper cleanup
    intervalRef.current = setInterval(() => {
      if (mountedRef.current) {
        fetchTrendingValidators();
      }
    }, 120000);

    return () => {
      // 📊 PERFORMANCE: Comprehensive cleanup to prevent memory leaks
      mountedRef.current = false;

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }

      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchTrendingValidators]);

  const nextSlide = useCallback(() => {
    if (currentIndex + itemsPerView < trendingValidators.length) {
      setCurrentIndex(currentIndex + itemsPerView);
    }
  }, [currentIndex, itemsPerView, trendingValidators.length]);

  const prevSlide = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(Math.max(0, currentIndex - itemsPerView));
    }
  }, [currentIndex, itemsPerView]);

  // 🔒 SECURITY: Sanitize and validate validator click handler
  const handleValidatorClick = useCallback((voteAccount: string) => {
    try {
      if (!voteAccount || typeof voteAccount !== 'string') {
        console.error('Invalid vote account provided');
        return;
      }

      // Basic Solana address validation
      if (voteAccount.length < 32 || voteAccount.length > 44 || !/^[1-9A-HJ-NP-Za-km-z]+$/.test(voteAccount)) {
        console.error('Invalid vote account format');
        return;
      }

      onValidatorClick?.(voteAccount);
    } catch (error) {
      console.error('Error handling validator click:', error);
    }
  }, [onValidatorClick]);

  if (loading) {
    return (
      <div className="bg-accent/10 border border-border rounded-lg p-3 mb-4">
        <div className="flex items-center justify-center h-16">
          <div className="animate-pulse flex items-center">
            <Flame className="h-4 w-4 text-accent mr-2" />
            <span className="text-sm font-medium">Loading trending validators...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error || trendingValidators.length === 0) {
    return (
      <div className="bg-gradient-to-r from-accent/5 to-primary/5 border border-border rounded-lg p-4 sm:p-6 mb-4">
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center">
            <div className="relative">
              <Flame className="h-8 w-8 text-accent animate-pulse" />
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full animate-ping" />
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-base font-semibold text-foreground">
              Boost Your Favorite Validator
            </h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
              Help validators gain visibility by burning $SVMAI tokens. Boosted validators appear here and get enhanced exposure to the community.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <div className="flex items-center text-xs text-muted-foreground bg-background/50 px-3 py-2 rounded-full border">
              <Crown className="h-4 w-4 mr-2 text-accent" />
              <span>24h boost duration</span>
            </div>
            <div className="flex items-center text-xs text-muted-foreground bg-background/50 px-3 py-2 rounded-full border">
              <TrendingUp className="h-4 w-4 mr-2 text-primary" />
              <span>Trending visibility</span>
            </div>
          </div>

          <div className="pt-2">
            <p className="text-xs text-muted-foreground">
              Select a validator from the list below to start boosting
            </p>
          </div>
        </div>
      </div>
    );
  }

  const visibleValidators = trendingValidators.slice(currentIndex, currentIndex + itemsPerView);

  return (
    <div className="bg-accent/10 border border-border rounded-lg p-3 mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center">
          <Flame className="h-4 w-4 text-accent mr-2" />
          <h3 className="text-sm font-semibold">Trending Validators</h3>
          <TrendingUp className="h-3 w-3 text-accent ml-2" />
        </div>

        <div className="flex items-center space-x-1">
          <button
            onClick={prevSlide}
            disabled={currentIndex === 0}
            className="p-1 rounded-md hover:bg-accent/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Previous trending validators"
          >
            <ChevronLeft className="h-3 w-3" />
          </button>
          <span className="text-xs text-muted-foreground px-2">
            {Math.floor(currentIndex / itemsPerView) + 1} / {Math.ceil(trendingValidators.length / itemsPerView)}
          </span>
          <button
            onClick={nextSlide}
            disabled={currentIndex + itemsPerView >= trendingValidators.length}
            className="p-1 rounded-md hover:bg-accent/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Next trending validators"
          >
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
        {visibleValidators.map((validator) => (
          <div
            key={validator.voteAccount}
            className="bg-background border rounded-md p-2 hover:shadow-md transition-all duration-200 cursor-pointer group"
            onClick={() => handleValidatorClick(validator.voteAccount)}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center justify-center w-5 h-5 bg-accent rounded-full text-accent-foreground text-xs font-semibold">
                #{validator.rank}
              </div>
              {validator.trendingReason === 'boost' && validator.boostEndTime && (
                <Crown className="h-3 w-3 text-accent" />
              )}
              {validator.trendingReason === 'volume' && (
                <TrendingUp className="h-3 w-3 text-primary" />
              )}
            </div>

            <div className="mb-1">
              <h4 className="font-medium text-xs group-hover:text-primary transition-colors truncate">
                {validator.name || 'Unknown'}
              </h4>
              <p className="text-xs text-muted-foreground truncate">
                {validator.voteAccount.slice(0, 8)}...
              </p>
            </div>

            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Commission:</span>
                <span className="font-medium">{validator.commission}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Score:</span>
                <span className="font-medium text-accent">{validator.trendingScore}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
