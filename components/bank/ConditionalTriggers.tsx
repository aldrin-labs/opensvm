'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Zap,
  Plus,
  Loader2,
  Pause,
  Play,
  Trash2,
  X,
  AlertTriangle,
  ArrowRight,
  Bell,
  Send,
  RefreshCw,
  Webhook,
  Clock,
  TrendingUp,
  TrendingDown,
  Wallet,
  Signal
} from 'lucide-react';

interface ManagedWallet {
  id: string;
  address: string;
  name: string;
  balance: number;
}

interface TriggerCondition {
  type: string;
  tokenMint?: string;
  tokenSymbol?: string;
  priceThreshold?: number;
  percentChange?: number;
  timeWindowMinutes?: number;
  walletId?: string;
  balanceThreshold?: number;
  startHour?: number;
  endHour?: number;
  daysOfWeek?: number[];
  signalEndpoint?: string;
}

interface TriggerAction {
  type: string;
  fromWalletId?: string;
  toAddress?: string;
  amount?: number;
  inputMint?: string;
  outputMint?: string;
  inputAmount?: number;
  webhookUrl?: string;
  notificationMethod?: string;
  message?: string;
}

interface Trigger {
  id: string;
  name: string;
  description?: string;
  conditions: TriggerCondition[];
  actions: TriggerAction[];
  executeOnce: boolean;
  cooldownMinutes: number;
  maxExecutions?: number;
  status: 'active' | 'paused' | 'completed' | 'failed';
  executionCount: number;
  lastExecutedAt?: number;
  lastCheckAt?: number;
  createdAt: number;
}

interface ConditionalTriggersProps {
  wallets: ManagedWallet[];
  isOpen: boolean;
  onClose: () => void;
}

const POPULAR_TOKENS = [
  { mint: 'So11111111111111111111111111111111111112', symbol: 'SOL' },
  { mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', symbol: 'USDC' },
  { mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', symbol: 'USDT' },
  { mint: 'JUPyiWrYvFmk5uBTwu1kggV38pSakeUtp8rK', symbol: 'JUP' },
  { mint: 'DezXAZ8z7PnyWe8fgJHR2A2fTQHYPT7YdN3rG', symbol: 'BONK' },
  { mint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', symbol: 'WIF' }
];

const CONDITION_TYPES = [
  { type: 'price_above', label: 'Price Above', icon: TrendingUp },
  { type: 'price_below', label: 'Price Below', icon: TrendingDown },
  { type: 'price_change_percent', label: 'Price Change %', icon: RefreshCw },
  { type: 'balance_above', label: 'Balance Above', icon: Wallet },
  { type: 'balance_below', label: 'Balance Below', icon: Wallet },
  { type: 'time_window', label: 'Time Window', icon: Clock },
  { type: 'external_signal', label: 'External Signal', icon: Signal }
];

const ACTION_TYPES = [
  { type: 'transfer', label: 'Transfer', icon: Send },
  { type: 'swap', label: 'Swap', icon: RefreshCw },
  { type: 'webhook', label: 'Webhook', icon: Webhook },
  { type: 'notification', label: 'Notification', icon: Bell }
];

export function ConditionalTriggers({ wallets, isOpen, onClose }: ConditionalTriggersProps) {
  const [triggers, setTriggers] = useState<Trigger[]>([]);
  const [completedTriggers, setCompletedTriggers] = useState<Trigger[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [executeOnce, setExecuteOnce] = useState(false);
  const [cooldownMinutes, setCooldownMinutes] = useState(60);
  const [maxExecutions, setMaxExecutions] = useState('');

  // Condition form
  const [conditionType, setConditionType] = useState<string>('price_above');
  const [conditionToken, setConditionToken] = useState(POPULAR_TOKENS[0].mint);
  const [priceThreshold, setPriceThreshold] = useState('');
  const [percentChange, setPercentChange] = useState('');
  const [timeWindow, setTimeWindow] = useState('60');
  const [conditionWallet, setConditionWallet] = useState('');
  const [balanceThreshold, setBalanceThreshold] = useState('');
  const [startHour, setStartHour] = useState('9');
  const [endHour, setEndHour] = useState('17');
  const [signalEndpoint, setSignalEndpoint] = useState('');
  const [conditions, setConditions] = useState<TriggerCondition[]>([]);

  // Action form
  const [actionType, setActionType] = useState<string>('transfer');
  const [actionWallet, setActionWallet] = useState('');
  const [toAddress, setToAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [inputMint, setInputMint] = useState(POPULAR_TOKENS[1].mint);
  const [outputMint, setOutputMint] = useState(POPULAR_TOKENS[0].mint);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [notificationMessage, setNotificationMessage] = useState('');
  const [actions, setActions] = useState<TriggerAction[]>([]);

  const fetchTriggers = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/bank/triggers', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setTriggers(data.triggers || []);
        setCompletedTriggers(data.completedTriggers || []);
      }
    } catch (err) {
      console.error('Failed to fetch triggers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) fetchTriggers();
  }, [isOpen]);

  const addCondition = () => {
    const condition: TriggerCondition = { type: conditionType };

    switch (conditionType) {
      case 'price_above':
      case 'price_below':
        if (!priceThreshold) return;
        condition.tokenMint = conditionToken;
        condition.tokenSymbol = POPULAR_TOKENS.find(t => t.mint === conditionToken)?.symbol;
        condition.priceThreshold = parseFloat(priceThreshold);
        break;
      case 'price_change_percent':
        if (!percentChange || !timeWindow) return;
        condition.tokenMint = conditionToken;
        condition.tokenSymbol = POPULAR_TOKENS.find(t => t.mint === conditionToken)?.symbol;
        condition.percentChange = parseFloat(percentChange);
        condition.timeWindowMinutes = parseInt(timeWindow);
        break;
      case 'balance_above':
      case 'balance_below':
        if (!conditionWallet || !balanceThreshold) return;
        condition.walletId = conditionWallet;
        condition.balanceThreshold = parseFloat(balanceThreshold);
        break;
      case 'time_window':
        condition.startHour = parseInt(startHour);
        condition.endHour = parseInt(endHour);
        break;
      case 'external_signal':
        if (!signalEndpoint) return;
        condition.signalEndpoint = signalEndpoint;
        break;
    }

    setConditions([...conditions, condition]);
    resetConditionForm();
  };

  const addAction = () => {
    const action: TriggerAction = { type: actionType };

    switch (actionType) {
      case 'transfer':
        if (!actionWallet || !toAddress || !amount) return;
        action.fromWalletId = actionWallet;
        action.toAddress = toAddress;
        action.amount = parseFloat(amount);
        break;
      case 'swap':
        if (!actionWallet || !amount) return;
        action.fromWalletId = actionWallet;
        action.inputMint = inputMint;
        action.outputMint = outputMint;
        action.inputAmount = parseFloat(amount);
        break;
      case 'webhook':
        if (!webhookUrl) return;
        action.webhookUrl = webhookUrl;
        break;
      case 'notification':
        action.notificationMethod = 'webhook';
        action.message = notificationMessage || name;
        break;
    }

    setActions([...actions, action]);
    resetActionForm();
  };

  const resetConditionForm = () => {
    setPriceThreshold('');
    setPercentChange('');
    setBalanceThreshold('');
    setSignalEndpoint('');
  };

  const resetActionForm = () => {
    setToAddress('');
    setAmount('');
    setWebhookUrl('');
    setNotificationMessage('');
  };

  const handleCreate = async () => {
    setError(null);
    if (!name || conditions.length === 0 || actions.length === 0) {
      setError('Name, at least one condition, and one action are required');
      return;
    }

    setActionLoading('create');
    try {
      const response = await fetch('/api/bank/triggers', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          conditions,
          actions,
          executeOnce,
          cooldownMinutes,
          maxExecutions: maxExecutions ? parseInt(maxExecutions) : undefined
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create');
      }

      await fetchTriggers();
      resetForm();
      setShowCreate(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create');
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggle = async (id: string, status: string) => {
    setActionLoading(id);
    try {
      const newStatus = status === 'active' ? 'paused' : 'active';
      await fetch(`/api/bank/triggers/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      await fetchTriggers();
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this trigger?')) return;
    setActionLoading(id);
    try {
      await fetch(`/api/bank/triggers/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      await fetchTriggers();
    } finally {
      setActionLoading(null);
    }
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setExecuteOnce(false);
    setCooldownMinutes(60);
    setMaxExecutions('');
    setConditions([]);
    setActions([]);
    setError(null);
  };

  const formatCondition = (c: TriggerCondition): string => {
    switch (c.type) {
      case 'price_above':
        return `${c.tokenSymbol} > $${c.priceThreshold}`;
      case 'price_below':
        return `${c.tokenSymbol} < $${c.priceThreshold}`;
      case 'price_change_percent':
        return `${c.tokenSymbol} ${c.percentChange! > 0 ? '+' : ''}${c.percentChange}% in ${c.timeWindowMinutes}m`;
      case 'balance_above':
        return `Balance > ${c.balanceThreshold} SOL`;
      case 'balance_below':
        return `Balance < ${c.balanceThreshold} SOL`;
      case 'time_window':
        return `${c.startHour}:00 - ${c.endHour}:00`;
      case 'external_signal':
        return 'External Signal';
      default:
        return c.type;
    }
  };

  const formatAction = (a: TriggerAction): string => {
    switch (a.type) {
      case 'transfer':
        return `Transfer ${a.amount} SOL`;
      case 'swap':
        return `Swap ${a.inputAmount}`;
      case 'webhook':
        return 'Call Webhook';
      case 'notification':
        return 'Send Notification';
      default:
        return a.type;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-background border rounded-xl w-full max-w-3xl mx-4 shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="font-semibold text-lg">Conditional Triggers</h2>
              <p className="text-xs text-muted-foreground">
                Automate actions based on conditions
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => setShowCreate(true)}
              disabled={showCreate}
              className="gap-2"
            >
              <Plus className="h-4 w-4" /> New Trigger
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Create Form */}
          {showCreate && (
            <Card className="mb-4 border-yellow-500/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Create Trigger</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Name</label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g., Buy SOL on dip"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Cooldown (minutes)</label>
                    <Input
                      type="number"
                      value={cooldownMinutes}
                      onChange={(e) => setCooldownMinutes(parseInt(e.target.value))}
                      min={1}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">Description (optional)</label>
                  <Input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What does this trigger do?"
                  />
                </div>

                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={executeOnce}
                      onChange={(e) => setExecuteOnce(e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm">Execute only once</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">Max executions:</span>
                    <Input
                      type="number"
                      value={maxExecutions}
                      onChange={(e) => setMaxExecutions(e.target.value)}
                      placeholder="Unlimited"
                      className="w-24"
                    />
                  </div>
                </div>

                {/* Conditions */}
                <div className="border rounded-lg p-3">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    Conditions (all must be true)
                  </h4>

                  {conditions.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {conditions.map((c, i) => (
                        <Badge key={i} variant="secondary" className="gap-1">
                          {formatCondition(c)}
                          <button
                            onClick={() => setConditions(conditions.filter((_, j) => j !== i))}
                            className="ml-1 hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-4 gap-2 mb-2">
                    <select
                      value={conditionType}
                      onChange={(e) => setConditionType(e.target.value)}
                      className="col-span-2 p-2 border rounded-lg bg-background text-sm"
                    >
                      {CONDITION_TYPES.map(ct => (
                        <option key={ct.type} value={ct.type}>{ct.label}</option>
                      ))}
                    </select>

                    {(conditionType === 'price_above' || conditionType === 'price_below' || conditionType === 'price_change_percent') && (
                      <select
                        value={conditionToken}
                        onChange={(e) => setConditionToken(e.target.value)}
                        className="col-span-2 p-2 border rounded-lg bg-background text-sm"
                      >
                        {POPULAR_TOKENS.map(t => (
                          <option key={t.mint} value={t.mint}>{t.symbol}</option>
                        ))}
                      </select>
                    )}

                    {(conditionType === 'balance_above' || conditionType === 'balance_below') && (
                      <select
                        value={conditionWallet}
                        onChange={(e) => setConditionWallet(e.target.value)}
                        className="col-span-2 p-2 border rounded-lg bg-background text-sm"
                      >
                        <option value="">Select wallet</option>
                        {wallets.map(w => (
                          <option key={w.id} value={w.id}>{w.name}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    {(conditionType === 'price_above' || conditionType === 'price_below') && (
                      <Input
                        type="number"
                        value={priceThreshold}
                        onChange={(e) => setPriceThreshold(e.target.value)}
                        placeholder="Price ($)"
                        className="col-span-3"
                      />
                    )}

                    {conditionType === 'price_change_percent' && (
                      <>
                        <Input
                          type="number"
                          value={percentChange}
                          onChange={(e) => setPercentChange(e.target.value)}
                          placeholder="% change"
                          className="col-span-2"
                        />
                        <Input
                          type="number"
                          value={timeWindow}
                          onChange={(e) => setTimeWindow(e.target.value)}
                          placeholder="Minutes"
                        />
                      </>
                    )}

                    {(conditionType === 'balance_above' || conditionType === 'balance_below') && (
                      <Input
                        type="number"
                        value={balanceThreshold}
                        onChange={(e) => setBalanceThreshold(e.target.value)}
                        placeholder="SOL amount"
                        className="col-span-3"
                      />
                    )}

                    {conditionType === 'time_window' && (
                      <>
                        <Input
                          type="number"
                          value={startHour}
                          onChange={(e) => setStartHour(e.target.value)}
                          placeholder="Start hour"
                          min={0}
                          max={23}
                        />
                        <span className="flex items-center justify-center">to</span>
                        <Input
                          type="number"
                          value={endHour}
                          onChange={(e) => setEndHour(e.target.value)}
                          placeholder="End hour"
                          min={0}
                          max={23}
                        />
                      </>
                    )}

                    {conditionType === 'external_signal' && (
                      <Input
                        value={signalEndpoint}
                        onChange={(e) => setSignalEndpoint(e.target.value)}
                        placeholder="https://api.example.com/signal"
                        className="col-span-3"
                      />
                    )}

                    <Button size="sm" onClick={addCondition}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Actions */}
                <div className="border rounded-lg p-3">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <ArrowRight className="h-4 w-4 text-green-500" />
                    Actions (executed when conditions met)
                  </h4>

                  {actions.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {actions.map((a, i) => (
                        <Badge key={i} variant="secondary" className="gap-1">
                          {formatAction(a)}
                          <button
                            onClick={() => setActions(actions.filter((_, j) => j !== i))}
                            className="ml-1 hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-4 gap-2 mb-2">
                    <select
                      value={actionType}
                      onChange={(e) => setActionType(e.target.value)}
                      className="col-span-2 p-2 border rounded-lg bg-background text-sm"
                    >
                      {ACTION_TYPES.map(at => (
                        <option key={at.type} value={at.type}>{at.label}</option>
                      ))}
                    </select>

                    {(actionType === 'transfer' || actionType === 'swap') && (
                      <select
                        value={actionWallet}
                        onChange={(e) => setActionWallet(e.target.value)}
                        className="col-span-2 p-2 border rounded-lg bg-background text-sm"
                      >
                        <option value="">Select wallet</option>
                        {wallets.map(w => (
                          <option key={w.id} value={w.id}>{w.name}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    {actionType === 'transfer' && (
                      <>
                        <Input
                          value={toAddress}
                          onChange={(e) => setToAddress(e.target.value)}
                          placeholder="Recipient address"
                          className="col-span-2"
                        />
                        <Input
                          type="number"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          placeholder="SOL amount"
                        />
                      </>
                    )}

                    {actionType === 'swap' && (
                      <>
                        <select
                          value={inputMint}
                          onChange={(e) => setInputMint(e.target.value)}
                          className="p-2 border rounded-lg bg-background text-sm"
                        >
                          {POPULAR_TOKENS.map(t => (
                            <option key={t.mint} value={t.mint}>{t.symbol}</option>
                          ))}
                        </select>
                        <select
                          value={outputMint}
                          onChange={(e) => setOutputMint(e.target.value)}
                          className="p-2 border rounded-lg bg-background text-sm"
                        >
                          {POPULAR_TOKENS.filter(t => t.mint !== inputMint).map(t => (
                            <option key={t.mint} value={t.mint}>{t.symbol}</option>
                          ))}
                        </select>
                        <Input
                          type="number"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          placeholder="Amount"
                        />
                      </>
                    )}

                    {actionType === 'webhook' && (
                      <Input
                        value={webhookUrl}
                        onChange={(e) => setWebhookUrl(e.target.value)}
                        placeholder="https://example.com/webhook"
                        className="col-span-3"
                      />
                    )}

                    {actionType === 'notification' && (
                      <Input
                        value={notificationMessage}
                        onChange={(e) => setNotificationMessage(e.target.value)}
                        placeholder="Notification message"
                        className="col-span-3"
                      />
                    )}

                    <Button size="sm" onClick={addAction}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {error && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    <p className="text-sm text-red-500">{error}</p>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    onClick={handleCreate}
                    disabled={actionLoading === 'create' || !name || conditions.length === 0 || actions.length === 0}
                    className="flex-1 gap-2 bg-yellow-600 hover:bg-yellow-700"
                  >
                    {actionLoading === 'create' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Zap className="h-4 w-4" />
                    )}
                    Create Trigger
                  </Button>
                  <Button variant="outline" onClick={() => { setShowCreate(false); resetForm(); }}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Triggers List */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : triggers.length === 0 && completedTriggers.length === 0 && !showCreate ? (
            <div className="text-center py-12">
              <Zap className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground">No triggers configured</p>
              <Button onClick={() => setShowCreate(true)} className="mt-4 gap-2">
                <Plus className="h-4 w-4" /> Create Your First Trigger
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Active Triggers */}
              {triggers.map(trigger => (
                <div
                  key={trigger.id}
                  className={`p-4 rounded-lg border ${
                    trigger.status === 'paused' ? 'bg-muted/50 opacity-75' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Zap className="h-4 w-4 text-yellow-500" />
                        <span className="font-medium">{trigger.name}</span>
                        <Badge variant={trigger.status === 'active' ? 'default' : 'secondary'}>
                          {trigger.status}
                        </Badge>
                      </div>
                      {trigger.description && (
                        <p className="text-sm text-muted-foreground mb-2">{trigger.description}</p>
                      )}
                      <div className="flex flex-wrap gap-1 mb-2">
                        {trigger.conditions.map((c, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {formatCondition(c)}
                          </Badge>
                        ))}
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        {trigger.actions.map((a, i) => (
                          <Badge key={i} variant="outline" className="text-xs bg-green-500/10">
                            {formatAction(a)}
                          </Badge>
                        ))}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Executed: {trigger.executionCount}x</span>
                        <span>Cooldown: {trigger.cooldownMinutes}m</span>
                        {trigger.lastExecutedAt && (
                          <span>Last: {new Date(trigger.lastExecutedAt).toLocaleString()}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggle(trigger.id, trigger.status)}
                        disabled={actionLoading === trigger.id}
                      >
                        {trigger.status === 'active' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(trigger.id)}
                        disabled={actionLoading === trigger.id}
                        className="text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}

              {/* Completed Triggers */}
              {completedTriggers.length > 0 && (
                <>
                  <h3 className="text-sm font-medium text-muted-foreground mt-6 mb-2">
                    Completed / Failed
                  </h3>
                  {completedTriggers.map(trigger => (
                    <div
                      key={trigger.id}
                      className="p-4 rounded-lg border bg-muted/30 opacity-75"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Zap className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{trigger.name}</span>
                            <Badge variant={trigger.status === 'completed' ? 'secondary' : 'destructive'}>
                              {trigger.status}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>Executed: {trigger.executionCount}x</span>
                            {trigger.lastExecutedAt && (
                              <span>Last: {new Date(trigger.lastExecutedAt).toLocaleString()}</span>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(trigger.id)}
                          disabled={actionLoading === trigger.id}
                          className="text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
