'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Shield,
  ShieldCheck,
  ShieldOff,
  Loader2,
  Copy,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  X,
  Link2,
  Unlink
} from 'lucide-react';

interface HardwareWalletSettingsProps {
  walletId: string;
  walletAddress: string;
  walletName: string;
  onUpdate: () => void;
}

interface HardwareStatus {
  hardwareLinked: boolean;
  hardwareWalletPubkey: string | null;
  requiresHardwareSignature: boolean;
  hardwareLinkedAt: number | null;
}

export function HardwareWalletSettings({
  walletId,
  walletAddress,
  walletName,
  onUpdate
}: HardwareWalletSettingsProps) {
  const [status, setStatus] = useState<HardwareStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Link flow state
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [hardwarePubkey, setHardwarePubkey] = useState('');
  const [challenge, setChallenge] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Unlink flow state
  const [showUnlinkConfirm, setShowUnlinkConfirm] = useState(false);
  const [unlinkChallenge, setUnlinkChallenge] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);

  // Fetch current status
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch(`/api/bank/wallets/${walletId}/hardware`, {
          credentials: 'include'
        });
        if (response.ok) {
          const data = await response.json();
          setStatus(data);
        }
      } catch (err) {
        console.error('Failed to fetch hardware status:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStatus();
  }, [walletId]);

  const handleInitiateLink = async () => {
    if (!hardwarePubkey.trim()) {
      setError('Please enter your hardware wallet address');
      return;
    }

    setActionLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/bank/wallets/${walletId}/hardware`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'initiate',
          hardwarePubkey: hardwarePubkey.trim()
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to initiate linking');
      }

      setChallenge(data.challenge);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initiate');
    } finally {
      setActionLoading(false);
    }
  };

  const handleInitiateUnlink = async () => {
    setActionLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/bank/wallets/${walletId}/hardware`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unlink' })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to initiate unlink');
      }

      setUnlinkChallenge(data.challenge);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initiate');
    } finally {
      setActionLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const resetForms = () => {
    setShowLinkForm(false);
    setShowUnlinkConfirm(false);
    setHardwarePubkey('');
    setChallenge(null);
    setUnlinkChallenge(null);
    setError(null);
  };

  if (loading) {
    return (
      <Card className="border-purple-500/20">
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-purple-500/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {status?.hardwareLinked ? (
              <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                <ShieldCheck className="h-5 w-5 text-purple-500" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-full bg-slate-500/20 flex items-center justify-center">
                <Shield className="h-5 w-5 text-slate-500" />
              </div>
            )}
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                Hardware Wallet
                {status?.hardwareLinked && (
                  <Badge variant="outline" className="text-purple-500 border-purple-500/50">
                    2-of-2 Active
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-xs">
                Add hardware wallet for enhanced security
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Current Status */}
        {status?.hardwareLinked && status.hardwareWalletPubkey && (
          <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-purple-500">Linked Hardware Wallet</span>
              {status.hardwareLinkedAt && (
                <span className="text-xs text-muted-foreground">
                  Since {new Date(status.hardwareLinkedAt).toLocaleDateString()}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <code className="text-xs font-mono flex-1 truncate">
                {status.hardwareWalletPubkey}
              </code>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => copyToClipboard(status.hardwareWalletPubkey!)}
              >
                {copied ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Transfers from this wallet require signatures from both the server and your hardware wallet.
            </p>
          </div>
        )}

        {/* Link Form */}
        {showLinkForm && !challenge && (
          <div className="p-4 rounded-lg bg-slate-500/10 border border-slate-500/30 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Link Hardware Wallet</span>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={resetForms}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Enter the public address of your hardware wallet (Ledger, Trezor, etc.)
            </p>
            <Input
              value={hardwarePubkey}
              onChange={(e) => setHardwarePubkey(e.target.value)}
              placeholder="Enter hardware wallet address"
            />
            <Button
              onClick={handleInitiateLink}
              disabled={actionLoading || !hardwarePubkey.trim()}
              className="w-full gap-2"
            >
              {actionLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Link2 className="h-4 w-4" />
              )}
              Generate Challenge
            </Button>
          </div>
        )}

        {/* Challenge for Linking */}
        {challenge && (
          <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 space-y-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-medium text-amber-500">Sign with Hardware Wallet</span>
            </div>
            <div className="p-3 rounded bg-background border">
              <code className="text-xs font-mono break-all whitespace-pre-wrap">
                {challenge}
              </code>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => copyToClipboard(challenge)}
                className="gap-2"
              >
                {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                Copy
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={resetForms}
              >
                Cancel
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Sign this message with your hardware wallet and submit the signature via the API:
              <code className="block mt-1 p-2 rounded bg-muted text-xs">
                POST /api/bank/wallets/{walletId}/hardware {`{ action: 'confirm', signature: '...' }`}
              </code>
            </p>
          </div>
        )}

        {/* Unlink Confirmation */}
        {showUnlinkConfirm && !unlinkChallenge && (
          <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 space-y-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <span className="text-sm font-semibold text-red-500">Remove Hardware Protection?</span>
            </div>
            <p className="text-xs text-muted-foreground">
              This will disable 2-of-2 multisig protection. You will need to sign with your hardware wallet to confirm.
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="destructive"
                onClick={handleInitiateUnlink}
                disabled={actionLoading}
                className="gap-2"
              >
                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlink className="h-4 w-4" />}
                Generate Unlink Challenge
              </Button>
              <Button size="sm" variant="ghost" onClick={resetForms}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Unlink Challenge */}
        {unlinkChallenge && (
          <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 space-y-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span className="text-sm font-medium text-red-500">Sign to Unlink</span>
            </div>
            <div className="p-3 rounded bg-background border">
              <code className="text-xs font-mono break-all whitespace-pre-wrap">
                {unlinkChallenge}
              </code>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="destructive"
                onClick={() => copyToClipboard(unlinkChallenge)}
                className="gap-2"
              >
                {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                Copy
              </Button>
              <Button size="sm" variant="ghost" onClick={resetForms}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-500">{error}</p>
          </div>
        )}

        {/* Action Buttons */}
        {!showLinkForm && !showUnlinkConfirm && !challenge && !unlinkChallenge && (
          <div className="flex gap-2">
            {!status?.hardwareLinked ? (
              <Button
                onClick={() => setShowLinkForm(true)}
                className="flex-1 gap-2 bg-purple-600 hover:bg-purple-700"
              >
                <Link2 className="h-4 w-4" />
                Link Hardware Wallet
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => setShowUnlinkConfirm(true)}
                className="flex-1 gap-2 text-red-500 hover:text-red-600 hover:bg-red-500/10"
              >
                <Unlink className="h-4 w-4" />
                Unlink Hardware Wallet
              </Button>
            )}
          </div>
        )}

        {/* Info */}
        {!status?.hardwareLinked && !showLinkForm && (
          <div className="p-3 rounded-lg bg-muted/50 flex items-start gap-2">
            <Shield className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <p className="text-xs text-muted-foreground">
              Link a hardware wallet (Ledger, Trezor) to enable 2-of-2 multisig.
              All transfers will require approval from both the server and your hardware device.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
