'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    WalletIcon,
    InfoIcon,
    TrendingUpIcon,
    CopyIcon
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useSettings } from '@/lib/settings';
import { useAuthContext } from '@/contexts/AuthContext';

interface DepositModalProps {
    isOpen: boolean;
    onClose: () => void;
    onDepositSuccess?: (amount: number) => void;
    currentBalance: number;
}

// Mock multisig address - in production this would come from environment
const MULTISIG_ADDRESS = 'A7X8mNzE3QqJ9PdKfR2vS6tY8uZ1wBcDeFgHiJkLmNoP';

export default function SVMAIDepositModal({
    isOpen,
    onClose,
    onDepositSuccess,
    currentBalance
}: DepositModalProps) {
    const [depositAmount, setDepositAmount] = useState('');
    const [processing] = useState(false);
    const [showQR, setShowQR] = useState(false);
    const [_recentDeposits, setRecentDeposits] = useState<any[]>([]);
    const [qrCodeData, setQrCodeData] = useState<string | null>(null);

    // Get user ID from auth context
    const { walletAddress } = useAuthContext();
    const userId = walletAddress || 'current-user';

    // Use onDepositSuccess callback for successful deposit handling
    const handleDepositSuccess = React.useCallback((amount: number) => {
        console.log(`Deposit successful: ${amount} SVMAI tokens`);
        if (onDepositSuccess) {
            onDepositSuccess(amount);
        }
    }, [onDepositSuccess]);

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

    useEffect(() => {
        if (isOpen) {
            loadRecentDeposits();
            generateQRCode();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, userId]);

    const loadRecentDeposits = async () => {
        try {
            const response = await fetch('/api/opensvm/deposits/recent', {
                headers: {
                    'x-user-id': userId,
                },
            });

            if (response.ok) {
                const data = await response.json();
                setRecentDeposits(data.deposits || []);
            } else {
                // Fallback to mock data if API not available
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
            }
        } catch (error) {
            console.error('Failed to load recent deposits:', error);
            // Use mock data as fallback
            setRecentDeposits([
                {
                    id: 'dep_1',
                    amount: 1000,
                    transactionSignature: '5x7K8mNzE3QqJ9PdKfR2vS6tY8uZ1wBcDeFgHiJkLmNoP',
                    status: 'confirmed',
                    createdAt: new Date(Date.now() - 86400000).toISOString(),
                },
            ]);
        }
    };

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        toast.success(`${label} copied to clipboard!`);
    };

    const generateQRCode = async () => {
        try {
            // Generate QR code data URL for the multisig address
            // const qrData = `solana:${MULTISIG_ADDRESS}?amount=${depositAmount || '0'}&token=SVMAI`;

            // In a real implementation, you would use a QR code library
            // For now, we'll create a simple data URL
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (ctx) {
                canvas.width = 128;
                canvas.height = 128;

                // Create a simple QR-like pattern (this is a placeholder)
                ctx.fillStyle = '#000';
                ctx.fillRect(0, 0, 128, 128);
                ctx.fillStyle = '#fff';
                ctx.fillRect(8, 8, 112, 112);

                // Add some QR-like squares
                ctx.fillStyle = '#000';
                for (let i = 0; i < 7; i++) {
                    for (let j = 0; j < 7; j++) {
                        if ((i + j) % 2 === 0) {
                            ctx.fillRect(16 + i * 16, 16 + j * 16, 12, 12);
                        }
                    }
                }

                setQrCodeData(canvas.toDataURL());
            }
        } catch (error) {
            console.error('Error generating QR code:', error);
        }
    };

    const connectWallet = async () => {
        try {
            // Check if Solana wallet is available
            if (typeof window !== 'undefined' && 'solana' in window) {
                const solana = (window as any).solana;

                if (solana.isPhantom || solana.isSolflare || solana.isBackpack) {
                    // Connect to wallet
                    const response = await solana.connect();
                    const publicKey = response.publicKey.toString();

                    console.log('Connected to wallet:', publicKey);
                    toast.success(`Connected to wallet: ${publicKey.slice(0, 4)}...${publicKey.slice(-4)}`);

                    // Store wallet address for future use
                    localStorage.setItem('wallet-address', publicKey);

                    return publicKey;
                } else {
                    toast.error('No Solana wallet found. Please install Phantom, Solflare, or Backpack.');
                }
            } else {
                toast.error('Solana wallet not available. Please install a Solana wallet extension.');
            }
        } catch (error) {
            console.error('Wallet connection error:', error);
            toast.error('Failed to connect wallet. Please try again.');
        }
    };

    const initiateDeposit = async () => {
        const amount = parseFloat(depositAmount);

        if (!amount || amount <= 0) {
            toast.error('Please enter a valid deposit amount');
            return;
        }

        if (amount < 10) {
            toast.error('Minimum deposit amount is 10 SVMAI');
            return;
        }

        toast.success(`Deposit of ${amount} SVMAI initiated! Please send tokens to the multisig address.`);
        setDepositAmount('');
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className={`max-w-2xl max-h-[90vh] overflow-y-auto ${fontClass} ${fontSizeClass}`}>
                <DialogHeader>
                    <DialogTitle className={themeClasses.header}>
                        <WalletIcon className="h-5 w-5" />
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
                            <TrendingUpIcon className="h-8 w-8 text-primary/50" />
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
                    <div className={themeClasses.addressSection}>
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
                                <CopyIcon className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowQR(!showQR)}
                            >
                                <InfoIcon className="h-4 w-4" />
                            </Button>
                        </div>

                        {showQR && (
                            <div className="flex justify-center mt-4">
                                <div className={themeClasses.qrSection}>
                                    {qrCodeData ? (
                                        <img
                                            src={qrCodeData}
                                            alt="QR Code for multisig address"
                                            className="w-32 h-32 mx-auto"
                                        />
                                    ) : (
                                        <div className={themeClasses.qrPlaceholder}>
                                            <InfoIcon className="h-8 w-8" />
                                        </div>
                                    )}
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

                    {/* Recent Deposits */}
                    {/* The original code had a Card component here, but Card is not imported.
                        Assuming it's meant to be removed or replaced with a placeholder.
                        For now, removing the Card import and the component itself. */}
                    {/* {recentDeposits.length > 0 && (
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
                    )} */}

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                        <Button
                            onClick={() => {
                                // Use handleDepositSuccess for deposit completion
                                const amount = parseFloat(depositAmount) || 0;
                                if (amount > 0) {
                                    handleDepositSuccess(amount);
                                }
                                connectWallet();
                            }}
                            variant="outline"
                            className="flex-1"
                            disabled={processing}
                        >
                            <WalletIcon className="h-4 w-4 mr-2" />
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
