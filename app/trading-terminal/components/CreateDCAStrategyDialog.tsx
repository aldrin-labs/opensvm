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
import { Calendar, DollarSign, Repeat, TrendingUp } from 'lucide-react';
import { strategyEngine } from '@/lib/trading/strategy-engine';
import type { FrequencyType } from '@/lib/trading/strategy-types';
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

          {/* Summary */}
          <div className="p-3 bg-info/10 border border-info/20 rounded text-sm">
            <div className="font-semibold text-info mb-1">Summary</div>
            <div className="text-foreground space-y-1">
              <p>
                • Buy ${parseFloat(amountPerTrade) || 0} of {asset} {frequency.toLowerCase()}
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
              {totalInvestment && parseFloat(totalInvestment) > 0 && (
                <p>• Total limit: ${parseFloat(totalInvestment)}</p>
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
