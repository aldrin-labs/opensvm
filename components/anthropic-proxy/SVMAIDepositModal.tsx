'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import {
    Wallet,
    Copy,
    ExternalLink,
    CheckCircle,
    Clock,
    AlertCircle,
    TrendingUp,
    Info
} from 'lucide-react';
import { toast } from 'sonner';
import { useSettings } from '@/lib/settings';

interface DepositModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentBalance: number;
    onDepositSuccess: (amount: number) => void;
}

interface DepositTransaction {
    id: string;
    amount: number;
    transactionSignature: string;
    status: 'pending' | 'confirmed' | 'failed';
    createdAt: string;
}

// Mock multisig address - in production this would come from environment
const MULTISIG_ADDRESS = 'A7X8mNzE3QqJ9PdKfR2vS6tY8uZ1wBcDeFgHiJkLmNoP';

export default function SVMAIDepositModal({
    isOpen,
    onClose,
    currentBalance,
    onDepositSuccess
}: DepositModalProps) {
    const [depositAmount, setDepositAmount] = useState<string>('');
    const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
    const [processing, setProcessing] = useState(false);
    const [recentDeposits, setRecentDeposits] = useState<DepositTransaction[]>([]);
    const [showQR, setShowQR] = useState(false);

    // Get user settings for theme and font
    const settings = useSettings();

    // Theme-aware CSS classes
    const themeClasses = {
        container: "space-y-4 sm:space-y-6",
        header: "flex items-center gap-2 text-primary",
        title: "text-xl sm:text-2xl font-bold",
        balanceCard: "bg-primary/5 p-4 rounded-lg",
        balanceLabel: "text-sm text-primary/80",
        balanceValue: "text-xl sm:text-2xl font-bold text-primary",
        infoCard: "bg-muted/50 p-3 rounded-lg text-sm",
        infoTitle: "font-medium mb-1",
        infoList: "text-muted-foreground space-y-1",
        addressSection: "space-y-3",
        addressLabel: "text-sm font-medium",
        addressCode: "flex-1 px-3 py-2 bg-muted border rounded font-mono text-sm break-all",
        qrSection: "p-4 bg-card border rounded-lg",
        qrPlaceholder: "w-32 h-32 mx-auto bg-muted rounded-lg flex items-center justify-center text-muted-foreground",
        qrText: "text-xs text-center text-muted-foreground mt-2",
        warningCard: "bg-warning/10 p-3 rounded-lg border border-warning/20",
        warningTitle: "font-medium text-warning mb-2",
        warningList: "text-sm text-warning/80 space-y-1",
        depositItem: "flex items-center justify-between p-3 bg-muted/50 rounded-lg",
        depositMeta: "font-medium",
        depositAmount: "text-sm text-muted-foreground",
        statusIcon: "h-4 w-4",
        emptyState: "text-center py-8 text-muted-foreground"
    };

    // Apply font family from settings
    const fontClass = settings.fontFamily === 'berkeley' ? 'font-mono' :
        settings.fontFamily === 'jetbrains' ? 'font-mono' :
            'font-sans';

    // Apply font size from settings
    const fontSizeClass = settings.fontSize === 'small' ? 'text-sm' :
        settings.fontSize === 'large' ? 'text-lg' :
            'text-base';

    // Predefined amounts for quick selection
    const quickAmounts = [100, 500, 1000, 2500, 5000, 10000];

    useEffect(() => {
        if (isOpen) {
            loadCurrentBalance();
            loadRecentDeposits();
        }
    }, [isOpen]);

    const loadCurrentBalance = async () => {
        try {
            const response = await fetch('/api/opensvm/balance', {
                headers: {
                    'x-user-id': 'current-user', // TODO: Get from auth context
                },
            });

            if (response.ok) {
                const data = await response.json();
                // setCurrentBalance(data.data.balance.available); // This line is removed as per new_code
            }
        } catch (error) {
            console.error('Failed to load balance:', error);
        }
    };

    const loadRecentDeposits = async () => {
        // TODO: Implement API endpoint for recent deposits
        // For now, using mock data
        setRecentDeposits([
            {
                id: 'dep_1',
                amount: 1000,
                transactionSignature: '5x7K8mNzE3QqJ9PdKfR2vS6tY8uZ1wBcDeFgHiJkLmNoP',
                status: 'confirmed',
                createdAt: new Date(Date.now() - 86400000).toISOString(),
            },
            {
                id: 'dep_2',
                amount: 500,
                transactionSignature: '5x7K8mNzE3QqJ9PdKfR2vS6tY8uZ1wBcDeFgHiJkLmNoP',
                status: 'pending',
                createdAt: new Date(Date.now() - 3600000).toISOString(),
            },
        ]);
    };

    const handleAmountChange = (value: string) => {
        setDepositAmount(value);
        setSelectedAmount(null);
    };

    const selectQuickAmount = (amount: number) => {
        setSelectedAmount(amount);
        setDepositAmount(amount.toString());
    };

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        toast.success(`${label} copied to clipboard!`);
    };

    const initiateDeposit = async () => {
        const amount = selectedAmount || parseFloat(depositAmount);

        if (!amount || amount <= 0) {
            toast.error('Please enter a valid deposit amount');
            return;
        }

        if (amount < 10) {
            toast.error('Minimum deposit amount is 10 SVMAI');
            return;
        }

        setProcessing(true);
        try {
            // TODO: Implement actual deposit initiation API
            // This would create a deposit record and potentially integrate with wallet

            toast.success(`Deposit of ${amount} SVMAI initiated! Please send tokens to the multisig address.`);
            setDepositAmount('');
            setSelectedAmount(null);
            await loadRecentDeposits();

            if (onDepositSuccess) {
                onDepositSuccess(amount);
            }
        } catch (error) {
            toast.error('Failed to initiate deposit');
        } finally {
            setProcessing(false);
        }
    };

    const connectWallet = async () => {
        // TODO: Implement Solana wallet connection
        toast.info('Wallet integration coming soon! For now, please send tokens manually.');
    };

    const generateQRCode = () => {
        // Simple QR code URL - in production, use a proper QR code library
        return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${MULTISIG_ADDRESS}`;
    };

    const getStatusIcon = (status: 'pending' | 'confirmed' | 'failed') => {
        switch (status) {
            case 'confirmed':
                return <CheckCircle className={`${themeClasses.statusIcon} text-success`} />;
            case 'pending':
                return <Clock className={`${themeClasses.statusIcon} text-warning`} />;
            case 'failed':
                return <AlertCircle className={`${themeClasses.statusIcon} text-destructive`} />;
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'confirmed':
                return 'bg-green-100 text-green-800';
            case 'pending':
                return 'bg-yellow-100 text-yellow-800';
            case 'failed':
                return 'bg-red-100 text-red-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className={`max-w-2xl max-h-[90vh] overflow-y-auto ${fontClass} ${fontSizeClass}`}>
                <DialogHeader>
                    <DialogTitle className={themeClasses.header}>
                        <Wallet className="h-5 w-5" />
                        <span className={themeClasses.title}>Deposit SVMAI Tokens</span>
                    </DialogTitle>
                </DialogHeader>

                <div className={themeClasses.container}>
                    {/* Current Balance Display */}
                    <div className={themeClasses.balanceCard}>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className={themeClasses.balanceLabel}>Current SVMAI Balance</p>
                                <p className={themeClasses.balanceValue}>{currentBalance.toFixed(1)} SVMAI</p>
                            </div>
                            <TrendingUp className="h-8 w-8 text-primary/50" />
                        </div>
                    </div>

                    {/* Deposit Amount Input */}
                    <div className="space-y-3">
                        <Label htmlFor="depositAmount" className="text-sm font-medium">
                            Deposit Amount (SVMAI)
                        </Label>
                        <Input
                            id="depositAmount"
                            type="number"
                            placeholder="Enter amount to deposit"
                            value={depositAmount}
                            onChange={(e) => setDepositAmount(e.target.value)}
                            min="1"
                            step="0.1"
                        />

                        {/* Quick Amount Buttons */}
                        <div className="flex gap-2 flex-wrap">
                            {[100, 500, 1000, 5000].map((amount) => (
                                <Button
                                    key={amount}
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setDepositAmount(amount.toString())}
                                >
                                    {amount} SVMAI
                                </Button>
                            ))}
                        </div>

                        <div className={themeClasses.infoCard}>
                            <p className={themeClasses.infoTitle}>💡 Token Value Guide</p>
                            <ul className={themeClasses.infoList}>
                                <li>• 100 SVMAI ≈ 10,000 Claude-3-Haiku tokens</li>
                                <li>• 500 SVMAI ≈ 5,000 Claude-3-Sonnet tokens</li>
                                <li>• 1,000 SVMAI ≈ 1,000 Claude-3-Opus tokens</li>
                            </ul>
                        </div>
                    </div>

                    {/* Deposit Instructions */}
                    <Card>
                        <CardContent className="p-4 space-y-4">
                            <h3 className="font-semibold flex items-center gap-2">
                                <ExternalLink className="h-4 w-4" />
                                Deposit Instructions
                            </h3>

                            <div className="space-y-3">
                                <div>
                                    <Label className={themeClasses.addressLabel}>OpenSVM Multisig Address</Label>
                                    <div className="flex items-center gap-2 mt-1">
                                        <code className={themeClasses.addressCode}>
                                            {MULTISIG_ADDRESS}
                                        </code>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => copyToClipboard(MULTISIG_ADDRESS, 'Multisig address')}
                                        >
                                            <Copy className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setShowQR(!showQR)}
                                        >
                                            <Info className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>

                                {showQR && (
                                    <div className="flex justify-center">
                                        <div className={themeClasses.qrSection}>
                                            <div className={themeClasses.qrPlaceholder}>
                                                <Info className="h-8 w-8" />
                                            </div>
                                            <p className={themeClasses.qrText}>
                                                Scan to copy address
                                            </p>
                                        </div>
                                    </div>
                                )}

                                <div className={themeClasses.warningCard}>
                                    <h4 className={themeClasses.warningTitle}>⚠️ Important Notes</h4>
                                    <ul className={themeClasses.warningList}>
                                        <li>• Only send SVMAI tokens to this address</li>
                                        <li>• Deposits are automatically detected and credited</li>
                                        <li>• Allow 1-2 minutes for confirmation</li>
                                        <li>• Minimum deposit: 10 SVMAI</li>
                                        <li>• All deposits are final (no withdrawals)</li>
                                    </ul>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Recent Deposits */}
                    {recentDeposits.length > 0 && (
                        <Card>
                            <CardContent className="p-4">
                                <h3 className="font-semibold mb-3">Recent Deposits</h3>
                                <div className="space-y-2">
                                    {recentDeposits.map((deposit) => (
                                        <div key={deposit.id} className={themeClasses.depositItem}>
                                            <div className="flex items-center gap-2">
                                                {getStatusIcon(deposit.status)}
                                                <div>
                                                    <p className={themeClasses.depositMeta}>{deposit.amount} SVMAI</p>
                                                    <p className={themeClasses.depositAmount}>{formatDate(deposit.createdAt)}</p>
                                                </div>
                                            </div>
                                            <Badge variant={deposit.status === 'confirmed' ? 'default' : 'secondary'}>
                                                {deposit.status}
                                            </Badge>
                                        </div>
                                    ))}

                                    {recentDeposits.length === 0 && (
                                        <div className={themeClasses.emptyState}>
                                            <p>No recent deposits</p>
                                            <p className="text-xs">Your deposit history will appear here</p>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                        <Button
                            onClick={connectWallet}
                            variant="outline"
                            className="flex-1"
                            disabled={processing}
                        >
                            <Wallet className="h-4 w-4 mr-2" />
                            Connect Wallet
                        </Button>
                        <Button
                            onClick={initiateDeposit}
                            className="flex-1"
                            disabled={processing || !depositAmount || parseFloat(depositAmount) < 10}
                        >
                            {processing ? 'Processing...' : 'Initiate Deposit'}
                        </Button>
                    </div>

                    <div className="text-center">
                        <Button variant="ghost" onClick={onClose}>
                            Close
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
} 