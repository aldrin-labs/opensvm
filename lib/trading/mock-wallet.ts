/**
 * Mock Wallet Provider for Demo Trading Terminal
 * Simulates wallet connection without requiring actual wallet integration
 */

import { EventEmitter } from 'events';

export interface MockWallet {
  publicKey: string;
  connected: boolean;
  balance: number;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  signTransaction: (tx: any) => Promise<any>;
  signMessage: (message: string) => Promise<string>;
}

class MockWalletProvider extends EventEmitter implements MockWallet {
  public publicKey: string = '';
  public connected: boolean = false;
  public balance: number = 10000; // Start with $10,000 USDC for demo
  
  constructor() {
    super();
    // Auto-connect for demo
    setTimeout(() => this.connect(), 1000);
  }
  
  async connect(): Promise<void> {
    // Simulate wallet connection
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Generate a mock public key
    this.publicKey = 'Demo' + Math.random().toString(36).substring(2, 15).toUpperCase();
    this.connected = true;
    
    this.emit('connect', this.publicKey);
    console.log('Mock wallet connected:', this.publicKey);
  }
  
  async disconnect(): Promise<void> {
    this.publicKey = '';
    this.connected = false;
    this.balance = 10000;
    
    this.emit('disconnect');
    console.log('Mock wallet disconnected');
  }
  
  async signTransaction(tx: any): Promise<any> {
    // Simulate transaction signing
    await new Promise(resolve => setTimeout(resolve, 300));
    return {
      ...tx,
      signature: 'MOCK_SIG_' + Date.now(),
      status: 'confirmed'
    };
  }
  
  async signMessage(message: string): Promise<string> {
    // Simulate message signing
    await new Promise(resolve => setTimeout(resolve, 200));
    return 'MOCK_SIGNED_' + Buffer.from(message).toString('base64');
  }
  
  // Additional helper methods for demo
  public updateBalance(amount: number): void {
    this.balance = Math.max(0, this.balance + amount);
    this.emit('balanceChange', this.balance);
  }
  
  public getBalance(): number {
    return this.balance;
  }
}

// Export singleton instance
export const mockWallet = new MockWalletProvider();

// Hook for React components
export function useMockWallet() {
  return mockWallet;
}
