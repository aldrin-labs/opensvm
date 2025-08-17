/**
 * Phase 4.2: Premium Feature Gating
 * Value differentiation with upgrade CTAs while preserving agent visibility
 */

import React, { useState, useEffect } from 'react';
import { track } from '../../../lib/ai/telemetry';

export interface PremiumConfig {
    // Feature limits for free tier
    maxReasoningExpansions: number;
    maxTokenLimit: number;
    maxThreadsStored: number;
    maxKnowledgeItems: number;

    // Premium status
    isPremium: boolean;

    // Trial settings
    trialDaysRemaining?: number;
    trialFeaturesEnabled?: boolean;
}

// Default configuration
const DEFAULT_PREMIUM_CONFIG: PremiumConfig = {
    maxReasoningExpansions: 5,
    maxTokenLimit: 4000,
    maxThreadsStored: 10,
    maxKnowledgeItems: 50,
    isPremium: false,
    trialDaysRemaining: 7,
    trialFeaturesEnabled: true
};

// Premium config management
class PremiumManager {
    private config: PremiumConfig;
    private listeners: ((config: PremiumConfig) => void)[] = [];

    constructor() {
        this.config = this.loadConfig();
    }

    private loadConfig(): PremiumConfig {
        try {
            const stored = localStorage.getItem('svmai_premium_config');
            if (stored) {
                const parsed = JSON.parse(stored);
                return { ...DEFAULT_PREMIUM_CONFIG, ...parsed };
            }
        } catch (error) {
            console.warn('Failed to load premium config:', error);
        }

        return { ...DEFAULT_PREMIUM_CONFIG };
    }

    private saveConfig(): void {
        try {
            localStorage.setItem('svmai_premium_config', JSON.stringify(this.config));
            this.notifyListeners();
        } catch (error) {
            console.error('Failed to save premium config:', error);
        }
    }

    private notifyListeners(): void {
        this.listeners.forEach(listener => listener(this.config));
    }

    getConfig(): PremiumConfig {
        return { ...this.config };
    }

    updateConfig(updates: Partial<PremiumConfig>): void {
        this.config = { ...this.config, ...updates };
        this.saveConfig();
    }

    subscribe(listener: (config: PremiumConfig) => void): () => void {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    // Usage tracking
    trackUsage(feature: string, count: number): boolean {
        const canUse = this.canUseFeature(feature, count);

        track('premium_feature_usage', {
            feature,
            count,
            allowed: canUse,
            is_premium: this.config.isPremium,
            trial_active: this.config.trialFeaturesEnabled
        });

        return canUse;
    }

    canUseFeature(feature: string, currentCount: number): boolean {
        if (this.config.isPremium || this.config.trialFeaturesEnabled) {
            return true;
        }

        switch (feature) {
            case 'reasoning_expansion':
                return currentCount < this.config.maxReasoningExpansions;
            case 'token_limit':
                return currentCount <= this.config.maxTokenLimit;
            case 'thread_storage':
                return currentCount < this.config.maxThreadsStored;
            case 'knowledge_items':
                return currentCount < this.config.maxKnowledgeItems;
            default:
                return true;
        }
    }

    getFeatureLimit(feature: string): number {
        switch (feature) {
            case 'reasoning_expansion':
                return this.config.maxReasoningExpansions;
            case 'token_limit':
                return this.config.maxTokenLimit;
            case 'thread_storage':
                return this.config.maxThreadsStored;
            case 'knowledge_items':
                return this.config.maxKnowledgeItems;
            default:
                return Infinity;
        }
    }
}

export const premiumManager = new PremiumManager();

// Premium overlay component
interface PremiumOverlayProps {
    feature: string;
    featureName: string;
    description: string;
    currentUsage?: number;
    limit?: number;
    onDismiss?: () => void;
    onUpgrade?: () => void;
    className?: string;
}

export function PremiumOverlay({
    feature,
    featureName,
    description,
    currentUsage,
    limit,
    onDismiss,
    onUpgrade,
    className = ''
}: PremiumOverlayProps) {
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        track('premium_overlay_shown', {
            feature,
            feature_name: featureName,
            current_usage: currentUsage,
            limit
        });
    }, [feature, featureName, currentUsage, limit]);

    const handleDismiss = () => {
        setDismissed(true);
        onDismiss?.();

        track('premium_overlay_dismissed', { feature });
    };

    const handleUpgrade = () => {
        onUpgrade?.();

        track('premium_upgrade_clicked', {
            feature,
            source: 'overlay',
            current_usage: currentUsage,
            limit
        });
    };

    if (dismissed) {
        return null;
    }

    return (
        <div
            className={`absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 ${className}`}
            data-ai-premium-overlay={feature}
            data-gated="true"
        >
            <div className="bg-gray-800 border border-gray-600 rounded-lg p-6 max-w-md mx-4 shadow-xl">
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                            <span className="text-white text-sm font-bold">Pro</span>
                        </div>
                        <h3 className="text-lg font-semibold text-white">{featureName}</h3>
                    </div>

                    <button
                        onClick={handleDismiss}
                        className="text-gray-400 hover:text-white"
                        data-ai-action="dismiss-premium-overlay"
                    >
                        ✕
                    </button>
                </div>

                <p className="text-gray-300 mb-4">{description}</p>

                {currentUsage !== undefined && limit !== undefined && (
                    <div className="mb-4">
                        <div className="flex justify-between text-sm text-gray-400 mb-1">
                            <span>Usage</span>
                            <span>{currentUsage} / {limit}</span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-2">
                            <div
                                className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full"
                                style={{ width: `${Math.min(100, (currentUsage / limit) * 100)}%` }}
                            />
                        </div>
                    </div>
                )}

                <div className="flex space-x-3">
                    <button
                        onClick={handleUpgrade}
                        className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                        data-ai-action="upgrade-premium"
                    >
                        Upgrade to Pro
                    </button>

                    <button
                        onClick={handleDismiss}
                        className="px-4 py-2 text-gray-400 hover:text-white border border-gray-600 rounded-lg transition-colors"
                        data-ai-action="maybe-later"
                    >
                        Maybe Later
                    </button>
                </div>
            </div>
        </div>
    );
}

// Gated feature wrapper
interface GatedFeatureProps {
    feature: string;
    featureName: string;
    description: string;
    currentUsage: number;
    children: React.ReactNode;
    fallback?: React.ReactNode;
    className?: string;
}

export function GatedFeature({
    feature,
    featureName,
    description,
    currentUsage,
    children,
    fallback,
    className = ''
}: GatedFeatureProps) {
    const [config, setConfig] = useState(premiumManager.getConfig());
    const [showOverlay, setShowOverlay] = useState(false);
    const limit = premiumManager.getFeatureLimit(feature);
    const canUse = premiumManager.canUseFeature(feature, currentUsage);

    useEffect(() => {
        return premiumManager.subscribe(setConfig);
    }, []);

    useEffect(() => {
        if (!canUse && currentUsage >= limit) {
            setShowOverlay(true);
        }
    }, [canUse, currentUsage, limit]);

    const handleUpgrade = () => {
        // In a real app, this would redirect to payment flow
        console.log('Upgrade clicked for feature:', feature);
        window.open('https://svm-pay.com', '_blank');
    };

    if (!canUse) {
        return (
            <div className={`relative ${className}`} data-gated="true">
                {fallback || (
                    <div className="opacity-50 pointer-events-none">
                        {children}
                    </div>
                )}

                {showOverlay && (
                    <PremiumOverlay
                        feature={feature}
                        featureName={featureName}
                        description={description}
                        currentUsage={currentUsage}
                        limit={limit}
                        onDismiss={() => setShowOverlay(false)}
                        onUpgrade={handleUpgrade}
                    />
                )}
            </div>
        );
    }

    return <div className={className}>{children}</div>;
}

// Gated slider component for token limits
interface GatedSliderProps {
    value: number;
    onChange: (value: number) => void;
    min: number;
    max: number;
    step?: number;
    className?: string;
}

export function GatedSlider({
    value,
    onChange,
    min,
    max,
    step = 1,
    className = ''
}: GatedSliderProps) {
    const config = premiumManager.getConfig();
    const effectiveMax = config.isPremium ? max : Math.min(max, config.maxTokenLimit);
    const isLocked = value > effectiveMax;

    const handleChange = (newValue: number) => {
        if (newValue <= effectiveMax) {
            onChange(newValue);
        } else {
            // Track gating event
            track('premium_slider_gated', {
                feature: 'token_limit',
                attempted_value: newValue,
                max_allowed: effectiveMax,
                is_premium: config.isPremium
            });
        }
    };

    return (
        <div className={`relative ${className}`}>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={Math.min(value, effectiveMax)}
                onChange={(e) => handleChange(Number(e.target.value))}
                className={`w-full ${isLocked ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                data-locked={isLocked || undefined}
                data-ai-action="token-limit-slider"
            />

            {isLocked && (
                <div className="absolute top-0 right-0 bg-yellow-600 text-black text-xs px-2 py-1 rounded">
                    Pro Feature
                </div>
            )}

            <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>{min}</span>
                <span>{effectiveMax} {!config.isPremium && `(Pro: ${max})`}</span>
            </div>
        </div>
    );
}

// Hook for premium state
export function usePremium() {
    const [config, setConfig] = useState(premiumManager.getConfig());

    useEffect(() => {
        return premiumManager.subscribe(setConfig);
    }, []);

    return {
        config,
        isPremium: config.isPremium,
        canUseFeature: (feature: string, currentUsage: number) =>
            premiumManager.canUseFeature(feature, currentUsage),
        trackUsage: (feature: string, count: number) =>
            premiumManager.trackUsage(feature, count),
        getLimit: (feature: string) => premiumManager.getFeatureLimit(feature)
    };
}

// Global API exposure
if (typeof window !== 'undefined') {
    window.SVMAI = window.SVMAI || {};
    window.SVMAI.premium = {
        getConfig: () => premiumManager.getConfig(),
        canUse: (feature: string, usage: number) => premiumManager.canUseFeature(feature, usage),
        trackUsage: (feature: string, count: number) => premiumManager.trackUsage(feature, count)
    };
}
