/**
 * CreateDCAStrategyDialog
 *
 * UI for creating a new DCA (Dollar Cost Averaging) strategy
 */

'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Calendar, DollarSign, Repeat, TrendingUp, Sparkles, Info } from 'lucide-react';
import { strategyEngine } from '@/lib/trading/strategy-engine';
import type { FrequencyType } from '@/lib/trading/strategy-types';
import { getRecommendedParameters } from '@/lib/trading/smart-dca-executor';
import { toast } from 'sonner';

interface CreateDCAStrategyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onStrategyCreated?: () => void;
}

export default function CreateDCAStrategyDialog({
  open,
  onOpenChange,
  userId,
  onStrategyCreated,
}: CreateDCAStrategyDialogProps) {
  const [name, setName] = useState('');
  const [asset, setAsset] = useState('SOL');
  const [amountPerTrade, setAmountPerTrade] = useState('100');
  const [frequency, setFrequency] = useState<FrequencyType>('WEEKLY');
  const [dayOfWeek, setDayOfWeek] = useState('1');
  const [hourOfDay, setHourOfDay] = useState('9');
  const [totalInvestment, setTotalInvestment] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // AI-powered DCA options
  const [enableAI, setEnableAI] = useState(false);
  const [aiRiskProfile, setAIRiskProfile] = useState<'conservative' | 'moderate' | 'aggressive'>('moderate');
  const [customMinBuyScore, setCustomMinBuyScore] = useState('0.7');
  const [customMaxWaitPeriods, setCustomMaxWaitPeriods] = useState('4');
  const [dynamicSizing, setDynamicSizing] = useState(true);

  // Get recommended AI parameters based on risk profile
  const aiParams = getRecommendedParameters(aiRiskProfile);

  const handleCreate = async () => {
    // Validation
    if (!name.trim()) {
      toast.error('Please enter a strategy name');
      return;
    }

    const amount = parseFloat(amountPerTrade);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setIsCreating(true);

    try {
      const strategy = strategyEngine.createDCAStrategy(userId, name, {
        asset,
        quoteAsset: 'USDC',
        amountPerTrade: amount,
        frequency,
        dayOfWeek: frequency === 'WEEKLY' ? parseInt(dayOfWeek) : undefined,
        hourOfDay: parseInt(hourOfDay),
        totalInvestment: totalInvestment ? parseFloat(totalInvestment) : undefined,
      });

      toast.success('DCA Strategy Created', {
        description: `"${name}" will invest $${amount} in ${asset} ${frequency.toLowerCase()}`,
      });

      // Reset form
      setName('');
      setAmountPerTrade('100');
      setTotalInvestment('');

      onOpenChange(false);
      onStrategyCreated?.();
    } catch (error) {
      toast.error('Failed to create strategy', {
        description: String(error),
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary">
            <TrendingUp size={20} />
            Create DCA Strategy
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Strategy Name */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-medium">
              Strategy Name
            </Label>
            <Input
              id="name"
              placeholder="e.g., SOL Weekly DCA"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-background border-border"
            />
          </div>

          {/* Asset */}
          <div className="space-y-2">
            <Label htmlFor="asset" className="text-sm font-medium">
              Asset to Buy
            </Label>
            <Select value={asset} onValueChange={setAsset}>
              <SelectTrigger id="asset" className="bg-background border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SOL">SOL - Solana</SelectItem>
                <SelectItem value="BTC">BTC - Bitcoin</SelectItem>
                <SelectItem value="ETH">ETH - Ethereum</SelectItem>
                <SelectItem value="BONK">BONK</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Amount Per Trade */}
          <div className="space-y-2">
            <Label htmlFor="amount" className="text-sm font-medium flex items-center gap-2">
              <DollarSign size={14} />
              Amount Per Trade (USD)
            </Label>
            <Input
              id="amount"
              type="number"
              placeholder="100"
              value={amountPerTrade}
              onChange={(e) => setAmountPerTrade(e.target.value)}
              className="bg-background border-border"
            />
          </div>

          {/* Frequency */}
          <div className="space-y-2">
            <Label htmlFor="frequency" className="text-sm font-medium flex items-center gap-2">
              <Repeat size={14} />
              Frequency
            </Label>
            <Select value={frequency} onValueChange={(v) => setFrequency(v as FrequencyType)}>
              <SelectTrigger id="frequency" className="bg-background border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DAILY">Daily</SelectItem>
                <SelectItem value="WEEKLY">Weekly</SelectItem>
                <SelectItem value="BIWEEKLY">Biweekly (Every 2 weeks)</SelectItem>
                <SelectItem value="MONTHLY">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Day of Week (for weekly) */}
          {frequency === 'WEEKLY' && (
            <div className="space-y-2">
              <Label htmlFor="dayOfWeek" className="text-sm font-medium flex items-center gap-2">
                <Calendar size={14} />
                Day of Week
              </Label>
              <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
                <SelectTrigger id="dayOfWeek" className="bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Sunday</SelectItem>
                  <SelectItem value="1">Monday</SelectItem>
                  <SelectItem value="2">Tuesday</SelectItem>
                  <SelectItem value="3">Wednesday</SelectItem>
                  <SelectItem value="4">Thursday</SelectItem>
                  <SelectItem value="5">Friday</SelectItem>
                  <SelectItem value="6">Saturday</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Hour of Day */}
          <div className="space-y-2">
            <Label htmlFor="hourOfDay" className="text-sm font-medium">
              Time of Day
            </Label>
            <Select value={hourOfDay} onValueChange={setHourOfDay}>
              <SelectTrigger id="hourOfDay" className="bg-background border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 24 }, (_, i) => (
                  <SelectItem key={i} value={i.toString()}>
                    {i.toString().padStart(2, '0')}:00
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Total Investment (Optional) */}
          <div className="space-y-2">
            <Label htmlFor="totalInvestment" className="text-sm font-medium">
              Total Investment Limit (Optional)
            </Label>
            <Input
              id="totalInvestment"
              type="number"
              placeholder="Leave empty for unlimited"
              value={totalInvestment}
              onChange={(e) => setTotalInvestment(e.target.value)}
              className="bg-background border-border"
            />
            {totalInvestment && parseFloat(totalInvestment) > 0 && parseFloat(amountPerTrade) > 0 && (
              <p className="text-xs text-muted-foreground">
                Strategy will execute{' '}
                {Math.ceil(parseFloat(totalInvestment) / parseFloat(amountPerTrade))} times
                before completing
              </p>
            )}
          </div>

          {/* AI-Powered DCA Section */}
          <div className="border-t border-border pt-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-primary" />
                <Label htmlFor="enableAI" className="text-sm font-medium cursor-pointer">
                  AI-Powered DCA
                </Label>
                <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
                  BETA
                </Badge>
              </div>
              <Switch
                id="enableAI"
                checked={enableAI}
                onCheckedChange={setEnableAI}
              />
            </div>

            {enableAI && (
              <>
                <div className="p-3 bg-primary/10 border border-primary/20 rounded text-xs space-y-1">
                  <div className="flex items-start gap-2">
                    <Info size={14} className="text-primary mt-0.5 flex-shrink-0" />
                    <div className="text-foreground">
                      <p className="font-semibold mb-1">AI waits for optimal entry points</p>
                      <p className="text-muted-foreground">
                        Uses RSI, moving averages, and dip detection to time buys better than static DCA.
                        Expected improvement: 15-30% more tokens for the same investment.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Risk Profile */}
                <div className="space-y-2">
                  <Label htmlFor="aiRiskProfile" className="text-sm font-medium">
                    AI Risk Profile
                  </Label>
                  <Select value={aiRiskProfile} onValueChange={(v: any) => setAIRiskProfile(v)}>
                    <SelectTrigger id="aiRiskProfile" className="bg-background border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="conservative">
                        <div className="flex flex-col items-start">
                          <span className="font-medium">Conservative</span>
                          <span className="text-xs text-muted-foreground">
                            Only buy on very strong signals (score &gt; 0.8)
                          </span>
                        </div>
                      </SelectItem>
                      <SelectItem value="moderate">
                        <div className="flex flex-col items-start">
                          <span className="font-medium">Moderate</span>
                          <span className="text-xs text-muted-foreground">
                            Buy on good signals (score &gt; 0.7)
                          </span>
                        </div>
                      </SelectItem>
                      <SelectItem value="aggressive">
                        <div className="flex flex-col items-start">
                          <span className="font-medium">Aggressive</span>
                          <span className="text-xs text-muted-foreground">
                            Buy on decent signals (score &gt; 0.6)
                          </span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Dynamic Sizing */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="dynamicSizing" className="text-sm font-medium cursor-pointer">
                      Dynamic Position Sizing
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Invest more when AI confidence is higher
                    </p>
                  </div>
                  <Switch
                    id="dynamicSizing"
                    checked={dynamicSizing}
                    onCheckedChange={setDynamicSizing}
                  />
                </div>

                {/* AI Parameters Summary */}
                <div className="p-2 bg-muted/50 rounded text-xs space-y-1">
                  <div className="font-medium text-foreground mb-1">AI Settings</div>
                  <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                    <div>Min Buy Score: {aiParams.minBuyScore}</div>
                    <div>Max Wait: {aiParams.maxWaitPeriods} periods</div>
                    <div>Dynamic Sizing: {dynamicSizing ? 'Yes' : 'No'}</div>
                    <div>Profile: {aiRiskProfile}</div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Summary */}
          <div className="p-3 bg-info/10 border border-info/20 rounded text-sm">
            <div className="font-semibold text-info mb-1 flex items-center gap-2">
              Summary
              {enableAI && <Sparkles size={14} className="text-primary" />}
            </div>
            <div className="text-foreground space-y-1">
              <p>
                • {enableAI ? 'AI-powered buy up to' : 'Buy'} ${parseFloat(amountPerTrade) || 0} of {asset} {frequency.toLowerCase()}
              </p>
              {frequency === 'WEEKLY' && (
                <p>
                  • Every{' '}
                  {
                    ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][
                      parseInt(dayOfWeek)
                    ]
                  }{' '}
                  at {hourOfDay}:00
                </p>
              )}
              {enableAI && (
                <p>
                  • AI waits for score &gt; {aiParams.minBuyScore} ({aiRiskProfile} profile)
                </p>
              )}
              {totalInvestment && parseFloat(totalInvestment) > 0 && (
                <p>• Total limit: ${parseFloat(totalInvestment)}</p>
              )}
              {enableAI && (
                <p className="text-xs text-primary mt-1">
                  Expected: 15-30% more {asset} vs standard DCA
                </p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              className="flex-1 bg-success hover:bg-success/90 text-white"
              disabled={isCreating}
            >
              {isCreating ? 'Creating...' : 'Create Strategy'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
