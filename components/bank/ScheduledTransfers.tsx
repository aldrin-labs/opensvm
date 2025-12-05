'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Clock,
  Plus,
  Loader2,
  Calendar,
  Repeat,
  Pause,
  Play,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  X,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface ManagedWallet {
  id: string;
  address: string;
  name: string;
  balance: number;
}

interface ScheduledTransfer {
  id: string;
  fromWalletId: string;
  fromWalletName: string;
  toAddress: string;
  toWalletName?: string;
  amount: number;
  tokenMint?: string;
  tokenSymbol?: string;
  scheduleType: 'once' | 'recurring';
  frequency?: 'daily' | 'weekly' | 'monthly';
  dayOfWeek?: number;
  dayOfMonth?: number;
  hour: number;
  minute: number;
  status: 'active' | 'paused' | 'completed' | 'failed';
  nextExecution: number;
  executionCount: number;
  maxExecutions?: number;
  label?: string;
}

interface ScheduledTransfersProps {
  wallets: ManagedWallet[];
  isOpen: boolean;
  onClose: () => void;
}

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function ScheduledTransfers({ wallets, isOpen, onClose }: ScheduledTransfersProps) {
  const [transfers, setTransfers] = useState<ScheduledTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [completedTransfers, setCompletedTransfers] = useState<ScheduledTransfer[]>([]);

  // Form state
  const [fromWalletId, setFromWalletId] = useState('');
  const [toWalletId, setToWalletId] = useState('');
  const [toAddress, setToAddress] = useState('');
  const [isInternal, setIsInternal] = useState(true);
  const [amount, setAmount] = useState('');
  const [scheduleType, setScheduleType] = useState<'once' | 'recurring'>('once');
  const [executeDate, setExecuteDate] = useState('');
  const [executeTime, setExecuteTime] = useState('09:00');
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [maxExecutions, setMaxExecutions] = useState('');
  const [label, setLabel] = useState('');

  const fetchTransfers = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/bank/scheduled', {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setTransfers(data.transfers || []);
        setCompletedTransfers(data.completedTransfers || []);
      }
    } catch (err) {
      console.error('Failed to fetch scheduled transfers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchTransfers();
    }
  }, [isOpen]);

  const handleCreate = async () => {
    setError(null);
    setActionLoading('create');

    try {
      const [hour, minute] = executeTime.split(':').map(Number);

      const body: any = {
        fromWalletId,
        toAddress: isInternal ? toWalletId : toAddress,
        isInternalTransfer: isInternal,
        amount: parseFloat(amount),
        scheduleType,
        hour,
        minute,
        label: label || undefined
      };

      if (scheduleType === 'once') {
        const date = new Date(executeDate);
        date.setHours(hour, minute, 0, 0);
        body.executeAt = date.getTime();
      } else {
        body.frequency = frequency;
        if (frequency === 'weekly') body.dayOfWeek = dayOfWeek;
        if (frequency === 'monthly') body.dayOfMonth = dayOfMonth;
        if (maxExecutions) body.maxExecutions = parseInt(maxExecutions);
      }

      const response = await fetch('/api/bank/scheduled', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create');
      }

      await fetchTransfers();
      resetForm();
      setShowCreateForm(false);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create');
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    setActionLoading(id);
    try {
      const newStatus = currentStatus === 'active' ? 'paused' : 'active';
      const response = await fetch(`/api/bank/scheduled/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      if (response.ok) {
        await fetchTransfers();
      }
    } catch (err) {
      console.error('Failed to toggle status:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this scheduled transfer?')) return;

    setActionLoading(id);
    try {
      const response = await fetch(`/api/bank/scheduled/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        await fetchTransfers();
      }
    } catch (err) {
      console.error('Failed to delete:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const resetForm = () => {
    setFromWalletId('');
    setToWalletId('');
    setToAddress('');
    setAmount('');
    setScheduleType('once');
    setExecuteDate('');
    setExecuteTime('09:00');
    setFrequency('daily');
    setDayOfWeek(1);
    setDayOfMonth(1);
    setMaxExecutions('');
    setLabel('');
    setError(null);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const getFrequencyLabel = (transfer: ScheduledTransfer) => {
    if (transfer.scheduleType === 'once') return 'One-time';
    if (transfer.frequency === 'daily') return 'Daily';
    if (transfer.frequency === 'weekly') return `Weekly (${DAYS_OF_WEEK[transfer.dayOfWeek || 0]})`;
    if (transfer.frequency === 'monthly') return `Monthly (Day ${transfer.dayOfMonth})`;
    return transfer.frequency;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-background border rounded-xl w-full max-w-2xl mx-4 shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center">
              <Clock className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="font-semibold text-lg">Scheduled Transfers</h2>
              <p className="text-xs text-muted-foreground">
                Automate recurring payments
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => setShowCreateForm(true)}
              className="gap-2"
              disabled={showCreateForm}
            >
              <Plus className="h-4 w-4" />
              New
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Create Form */}
          {showCreateForm && (
            <Card className="mb-4 border-violet-500/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Create Scheduled Transfer</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Source Wallet */}
                <div>
                  <label className="text-sm font-medium mb-1 block">From Wallet</label>
                  <select
                    value={fromWalletId}
                    onChange={(e) => setFromWalletId(e.target.value)}
                    className="w-full p-2 border rounded-lg bg-background"
                  >
                    <option value="">Select wallet</option>
                    {wallets.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>

                {/* Destination */}
                <div>
                  <div className="flex gap-2 mb-2">
                    <Button
                      size="sm"
                      variant={isInternal ? 'default' : 'outline'}
                      onClick={() => setIsInternal(true)}
                    >
                      My Wallet
                    </Button>
                    <Button
                      size="sm"
                      variant={!isInternal ? 'default' : 'outline'}
                      onClick={() => setIsInternal(false)}
                    >
                      External
                    </Button>
                  </div>
                  {isInternal ? (
                    <select
                      value={toWalletId}
                      onChange={(e) => setToWalletId(e.target.value)}
                      className="w-full p-2 border rounded-lg bg-background"
                    >
                      <option value="">Select wallet</option>
                      {wallets.filter(w => w.id !== fromWalletId).map(w => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      value={toAddress}
                      onChange={(e) => setToAddress(e.target.value)}
                      placeholder="Enter Solana address"
                    />
                  )}
                </div>

                {/* Amount */}
                <div>
                  <label className="text-sm font-medium mb-1 block">Amount (SOL)</label>
                  <Input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                  />
                </div>

                {/* Schedule Type */}
                <div>
                  <label className="text-sm font-medium mb-1 block">Schedule</label>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={scheduleType === 'once' ? 'default' : 'outline'}
                      onClick={() => setScheduleType('once')}
                      className="gap-2"
                    >
                      <Calendar className="h-4 w-4" />
                      One-time
                    </Button>
                    <Button
                      size="sm"
                      variant={scheduleType === 'recurring' ? 'default' : 'outline'}
                      onClick={() => setScheduleType('recurring')}
                      className="gap-2"
                    >
                      <Repeat className="h-4 w-4" />
                      Recurring
                    </Button>
                  </div>
                </div>

                {/* One-time Date */}
                {scheduleType === 'once' && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-sm font-medium mb-1 block">Date</label>
                      <Input
                        type="date"
                        value={executeDate}
                        onChange={(e) => setExecuteDate(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">Time</label>
                      <Input
                        type="time"
                        value={executeTime}
                        onChange={(e) => setExecuteTime(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {/* Recurring Options */}
                {scheduleType === 'recurring' && (
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium mb-1 block">Frequency</label>
                      <select
                        value={frequency}
                        onChange={(e) => setFrequency(e.target.value as any)}
                        className="w-full p-2 border rounded-lg bg-background"
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    </div>

                    {frequency === 'weekly' && (
                      <div>
                        <label className="text-sm font-medium mb-1 block">Day of Week</label>
                        <select
                          value={dayOfWeek}
                          onChange={(e) => setDayOfWeek(parseInt(e.target.value))}
                          className="w-full p-2 border rounded-lg bg-background"
                        >
                          {DAYS_OF_WEEK.map((day, idx) => (
                            <option key={idx} value={idx}>{day}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {frequency === 'monthly' && (
                      <div>
                        <label className="text-sm font-medium mb-1 block">Day of Month</label>
                        <Input
                          type="number"
                          value={dayOfMonth}
                          onChange={(e) => setDayOfMonth(parseInt(e.target.value))}
                          min={1}
                          max={31}
                        />
                      </div>
                    )}

                    <div>
                      <label className="text-sm font-medium mb-1 block">Time</label>
                      <Input
                        type="time"
                        value={executeTime}
                        onChange={(e) => setExecuteTime(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-1 block">Max Executions (optional)</label>
                      <Input
                        type="number"
                        value={maxExecutions}
                        onChange={(e) => setMaxExecutions(e.target.value)}
                        placeholder="Unlimited"
                        min={1}
                      />
                    </div>
                  </div>
                )}

                {/* Label */}
                <div>
                  <label className="text-sm font-medium mb-1 block">Label (optional)</label>
                  <Input
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="e.g., Weekly savings"
                  />
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
                    disabled={actionLoading === 'create' || !fromWalletId || (!toWalletId && !toAddress) || !amount}
                    className="flex-1 gap-2"
                  >
                    {actionLoading === 'create' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    Create
                  </Button>
                  <Button variant="outline" onClick={() => { setShowCreateForm(false); resetForm(); }}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Transfers List */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : transfers.length === 0 && !showCreateForm ? (
            <div className="text-center py-12">
              <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground">No scheduled transfers</p>
              <Button
                onClick={() => setShowCreateForm(true)}
                className="mt-4 gap-2"
              >
                <Plus className="h-4 w-4" />
                Create One
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {transfers.map(transfer => (
                <div
                  key={transfer.id}
                  className={`p-4 rounded-lg border ${
                    transfer.status === 'paused' ? 'bg-muted/50 opacity-75' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {transfer.scheduleType === 'recurring' ? (
                          <Repeat className="h-4 w-4 text-violet-500" />
                        ) : (
                          <Calendar className="h-4 w-4 text-blue-500" />
                        )}
                        <span className="font-medium">
                          {transfer.label || `${transfer.amount} SOL`}
                        </span>
                        <Badge variant={transfer.status === 'active' ? 'default' : 'secondary'}>
                          {transfer.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {transfer.fromWalletName} → {transfer.toWalletName || transfer.toAddress.slice(0, 8) + '...'}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span>{getFrequencyLabel(transfer)}</span>
                        <span>at {String(transfer.hour).padStart(2, '0')}:{String(transfer.minute).padStart(2, '0')}</span>
                        {transfer.executionCount > 0 && (
                          <span>{transfer.executionCount} executions</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Next: {formatDate(transfer.nextExecution)}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleStatus(transfer.id, transfer.status)}
                        disabled={actionLoading === transfer.id}
                      >
                        {transfer.status === 'active' ? (
                          <Pause className="h-4 w-4" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(transfer.id)}
                        disabled={actionLoading === transfer.id}
                        className="text-red-500 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}

              {/* Completed Section */}
              {completedTransfers.length > 0 && (
                <div className="mt-6">
                  <button
                    onClick={() => setShowCompleted(!showCompleted)}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                  >
                    {showCompleted ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    {completedTransfers.length} completed/failed
                  </button>

                  {showCompleted && (
                    <div className="mt-2 space-y-2">
                      {completedTransfers.map(transfer => (
                        <div
                          key={transfer.id}
                          className="p-3 rounded-lg border bg-muted/30 opacity-60"
                        >
                          <div className="flex items-center gap-2">
                            {transfer.status === 'completed' ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            ) : (
                              <AlertTriangle className="h-4 w-4 text-red-500" />
                            )}
                            <span className="text-sm">
                              {transfer.label || `${transfer.amount} SOL`}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {transfer.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {transfer.executionCount} execution(s)
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
