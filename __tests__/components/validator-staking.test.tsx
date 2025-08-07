import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useWallet } from '@solana/wallet-adapter-react';
import { ValidatorStaking } from '../../components/solana/validator-staking';

// Mock the wallet adapter
jest.mock('@solana/wallet-adapter-react', () => ({
  useWallet: jest.fn()
}));

// Mock Solana Web3.js
jest.mock('@solana/web3.js', () => {
  const mockConnectionMethods = {
    getVoteAccounts: jest.fn(),
    getMinimumBalanceForRentExemption: jest.fn(),
    getBalance: jest.fn(),
    getLatestBlockhash: jest.fn(),
    getBlockHeight: jest.fn(),
    confirmTransaction: jest.fn(),
    getTokenAccountBalance: jest.fn(),
    getParsedProgramAccounts: jest.fn()
  };

  return {
    Connection: jest.fn(() => mockConnectionMethods),
    PublicKey: jest.fn().mockImplementation((key) => ({
      toBase58: () => key,
      toBuffer: () => Buffer.from(key)
    })),
    Transaction: jest.fn().mockImplementation(() => ({
      add: jest.fn(),
      recentBlockhash: '',
      feePayer: null
    })),
    StakeProgram: {
      programId: 'Stake11111111111111111111111111111111111111',
      space: 200,
      initialize: jest.fn(),
      delegate: jest.fn()
    },
    SystemProgram: {
      createAccountWithSeed: jest.fn()
    },
    Authorized: jest.fn(),
    Lockup: jest.fn(),
    LAMPORTS_PER_SOL: 1000000000,
    findProgramAddress: jest.fn()
  };
});

// Get the mock connection for use in tests
const { Connection } = require('@solana/web3.js');
const mockConnection = new Connection();

// Mock SPL Token
jest.mock('@solana/spl-token', () => ({
  getAssociatedTokenAddress: jest.fn(),
  TOKEN_PROGRAM_ID: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
}));

// Mock token config
jest.mock('../../lib/config/tokens', () => ({
  TOKEN_MINTS: {
    SVMAI: { toBase58: () => 'Cpzvdx6pppc9TNArsGsqgShCsKC9NCCjA2gtzHvUpump' }
  },
  TOKEN_DECIMALS: {
    SVMAI: 6
  },
  TOKEN_MULTIPLIERS: {
    SVMAI: 1000000
  }
}));

describe('ValidatorStaking', () => {
  const mockProps = {
    validatorVoteAccount: 'validator123',
    validatorName: 'Test Validator',
    commission: 5,
    apy: 7.5
  };

  const mockWallet = {
    publicKey: { toBase58: () => 'user123' },
    connected: true,
    sendTransaction: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useWallet as jest.Mock).mockReturnValue(mockWallet);
    
    // Default mock implementations
    mockConnection.getVoteAccounts.mockResolvedValue({
      current: [{ votePubkey: 'validator123' }],
      delinquent: []
    });
    mockConnection.getMinimumBalanceForRentExemption.mockResolvedValue(2282880);
    mockConnection.getBalance.mockResolvedValue(5000000000); // 5 SOL
    mockConnection.getLatestBlockhash.mockResolvedValue({
      blockhash: 'test_blockhash',
      lastValidBlockHeight: 1000
    });
    mockConnection.getBlockHeight.mockResolvedValue(900);
    mockConnection.confirmTransaction.mockResolvedValue({ value: { err: null } });
    mockConnection.getTokenAccountBalance.mockResolvedValue({
      value: { amount: '150000000000', decimals: 6 } // 150k SVMAI
    });
    mockConnection.getParsedProgramAccounts.mockResolvedValue([]);
  });

  describe('Component Rendering', () => {
    it('should render stake and unstake buttons when user meets requirements', async () => {
      render(<ValidatorStaking {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('Stake SOL')).toBeInTheDocument();
        expect(screen.getByText('Unstake SOL')).toBeInTheDocument();
      });
    });

    it('should show SVMAI requirement info', () => {
      render(<ValidatorStaking {...mockProps} />);

      expect(screen.getByText(/100,000 \$SVMAI/)).toBeInTheDocument();
      expect(screen.getByText(/required to use staking features/)).toBeInTheDocument();
    });

    it('should display validator information', () => {
      render(<ValidatorStaking {...mockProps} />);

      expect(screen.getByText('Test Validator')).toBeInTheDocument();
      expect(screen.getByText('5%')).toBeInTheDocument(); // Commission
      expect(screen.getByText('7.5%')).toBeInTheDocument(); // APY
    });

    it('should show high commission warning', () => {
      const highCommissionProps = { ...mockProps, commission: 95 };
      render(<ValidatorStaking {...highCommissionProps} />);

      expect(screen.getByText('⚠️ Very high commission')).toBeInTheDocument();
    });
  });

  describe('Wallet Connection', () => {
    it('should show connect wallet message when not connected', () => {
      (useWallet as jest.Mock).mockReturnValue({
        ...mockWallet,
        connected: false,
        publicKey: null
      });

      render(<ValidatorStaking {...mockProps} />);

      expect(screen.getByText(/Please connect your wallet/)).toBeInTheDocument();
    });

    it('should disable buttons when wallet not connected', () => {
      (useWallet as jest.Mock).mockReturnValue({
        ...mockWallet,
        connected: false,
        publicKey: null
      });

      render(<ValidatorStaking {...mockProps} />);

      const stakeButton = screen.getByText('Stake SOL');
      const unstakeButton = screen.getByText('Unstake SOL');

      expect(stakeButton.closest('button')).toBeDisabled();
      expect(unstakeButton.closest('button')).toBeDisabled();
    });
  });

  describe('SVMAI Balance Requirements', () => {
    it('should disable staking when SVMAI balance is insufficient', async () => {
      mockConnection.getTokenAccountBalance.mockResolvedValue({
        value: { amount: '50000000000', decimals: 6 } // 50k SVMAI (insufficient)
      });

      render(<ValidatorStaking {...mockProps} />);

      await waitFor(() => {
        const stakeButton = screen.getByText('Stake SOL');
        expect(stakeButton.closest('button')).toBeDisabled();
      });
    });

    it('should enable staking when SVMAI balance is sufficient', async () => {
      mockConnection.getTokenAccountBalance.mockResolvedValue({
        value: { amount: '150000000000', decimals: 6 } // 150k SVMAI (sufficient)
      });

      render(<ValidatorStaking {...mockProps} />);

      await waitFor(() => {
        const stakeButton = screen.getByText('Stake SOL');
        expect(stakeButton.closest('button')).not.toBeDisabled();
      });
    });

    it('should handle missing SVMAI token account', async () => {
      mockConnection.getTokenAccountBalance.mockRejectedValue(
        new Error('could not find account')
      );

      render(<ValidatorStaking {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('0 $SVMAI')).toBeInTheDocument();
      });
    });
  });

  describe('Staking Modal', () => {
    beforeEach(async () => {
      render(<ValidatorStaking {...mockProps} />);
      
      // Wait for component to load and click stake button
      await waitFor(() => {
        const stakeButton = screen.getByText('Stake SOL');
        fireEvent.click(stakeButton);
      });
    });

    it('should open stake modal when stake button clicked', async () => {
      expect(screen.getByText('Stake with Test Validator')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Enter SOL amount')).toBeInTheDocument();
    });

    it('should show expected returns for different periods', async () => {
      // Enter stake amount
      const input = screen.getByPlaceholderText('Enter SOL amount');
      fireEvent.change(input, { target: { value: '10' } });

      await waitFor(() => {
        expect(screen.getByText(/7 days/)).toBeInTheDocument();
        expect(screen.getByText(/30 days/)).toBeInTheDocument();
        expect(screen.getByText(/90 days/)).toBeInTheDocument();
        expect(screen.getByText(/180 days/)).toBeInTheDocument();
        expect(screen.getByText(/365 days/)).toBeInTheDocument();
      });
    });

    it('should validate minimum stake amount', async () => {
      const input = screen.getByPlaceholderText('Enter SOL amount');
      const confirmButton = screen.getByText('Confirm Stake');

      // Enter amount below minimum
      fireEvent.change(input, { target: { value: '0.05' } });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText(/minimum stake amount is 0.1 SOL/)).toBeInTheDocument();
      });
    });

    it('should validate sufficient SOL balance', async () => {
      mockConnection.getBalance.mockResolvedValue(500000000); // 0.5 SOL

      const input = screen.getByPlaceholderText('Enter SOL amount');
      const confirmButton = screen.getByText('Confirm Stake');

      // Enter amount exceeding balance
      fireEvent.change(input, { target: { value: '1' } });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText(/Insufficient SOL balance/)).toBeInTheDocument();
      });
    });
  });

  describe('Staking Process', () => {
    it('should successfully create stake transaction', async () => {
      const { PublicKey } = require('@solana/web3.js');
      PublicKey.findProgramAddress = jest.fn().mockResolvedValue([
        { toBase58: () => 'stake_account_pda' },
        255
      ]);

      mockWallet.sendTransaction.mockResolvedValue('transaction_signature');

      render(<ValidatorStaking {...mockProps} />);

      // Open modal and enter stake amount
      await waitFor(() => {
        const stakeButton = screen.getByText('Stake SOL');
        fireEvent.click(stakeButton);
      });

      const input = screen.getByPlaceholderText('Enter SOL amount');
      fireEvent.change(input, { target: { value: '1' } });

      const confirmButton = screen.getByText('Confirm Stake');
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockWallet.sendTransaction).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(screen.getByText(/Successfully staked/)).toBeInTheDocument();
      });
    });

    it('should handle validator validation failure', async () => {
      mockConnection.getVoteAccounts.mockResolvedValue({
        current: [],
        delinquent: []
      });

      render(<ValidatorStaking {...mockProps} />);

      await waitFor(() => {
        const stakeButton = screen.getByText('Stake SOL');
        fireEvent.click(stakeButton);
      });

      const input = screen.getByPlaceholderText('Enter SOL amount');
      fireEvent.change(input, { target: { value: '1' } });

      const confirmButton = screen.getByText('Confirm Stake');
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText(/Invalid or inactive validator/)).toBeInTheDocument();
      });
    });

    it('should handle network congestion', async () => {
      mockConnection.getBlockHeight.mockResolvedValue(950); // Too close to lastValidBlockHeight

      render(<ValidatorStaking {...mockProps} />);

      await waitFor(() => {
        const stakeButton = screen.getByText('Stake SOL');
        fireEvent.click(stakeButton);
      });

      const input = screen.getByPlaceholderText('Enter SOL amount');
      fireEvent.change(input, { target: { value: '1' } });

      const confirmButton = screen.getByText('Confirm Stake');
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText(/Network congestion detected/)).toBeInTheDocument();
      });
    });

    it('should handle insufficient balance after rent check', async () => {
      // Mock balance that becomes insufficient after including rent
      mockConnection.getBalance
        .mockResolvedValueOnce(5000000000) // Initial check passes
        .mockResolvedValueOnce(1000000000); // Re-check shows insufficient balance

      render(<ValidatorStaking {...mockProps} />);

      await waitFor(() => {
        const stakeButton = screen.getByText('Stake SOL');
        fireEvent.click(stakeButton);
      });

      const input = screen.getByPlaceholderText('Enter SOL amount');
      fireEvent.change(input, { target: { value: '1' } });

      const confirmButton = screen.getByText('Confirm Stake');
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText(/Insufficient SOL balance/)).toBeInTheDocument();
      });
    });
  });

  describe('Unstaking Process', () => {
    beforeEach(() => {
      // Mock existing stake accounts
      mockConnection.getParsedProgramAccounts.mockResolvedValue([
        {
          pubkey: { toBase58: () => 'stake_account_1' },
          account: {
            data: {
              parsed: {
                type: 'delegated',
                info: {
                  stake: {
                    delegation: {
                      stake: '1000000000', // 1 SOL
                      voter: 'validator123'
                    }
                  }
                }
              }
            }
          }
        }
      ]);
    });

    it('should show existing stake amount', async () => {
      render(<ValidatorStaking {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('1.0000 SOL')).toBeInTheDocument(); // Staked amount
      });
    });

    it('should successfully create unstake transaction', async () => {
      mockWallet.sendTransaction.mockResolvedValue('unstake_signature');

      render(<ValidatorStaking {...mockProps} />);

      await waitFor(() => {
        const unstakeButton = screen.getByText('Unstake SOL');
        fireEvent.click(unstakeButton);
      });

      const input = screen.getByPlaceholderText('Enter SOL amount to unstake');
      fireEvent.change(input, { target: { value: '0.5' } });

      const confirmButton = screen.getByText('Confirm Unstake');
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockWallet.sendTransaction).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(screen.getByText(/Successfully initiated unstaking/)).toBeInTheDocument();
      });
    });

    it('should validate unstake amount against staked balance', async () => {
      render(<ValidatorStaking {...mockProps} />);

      await waitFor(() => {
        const unstakeButton = screen.getByText('Unstake SOL');
        fireEvent.click(unstakeButton);
      });

      const input = screen.getByPlaceholderText('Enter SOL amount to unstake');
      fireEvent.change(input, { target: { value: '2' } }); // More than staked

      const confirmButton = screen.getByText('Confirm Unstake');
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText(/Cannot unstake more than your staked amount/)).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle RPC errors gracefully', async () => {
      mockConnection.getTokenAccountBalance.mockRejectedValue(new Error('RPC Error'));

      render(<ValidatorStaking {...mockProps} />);

      // Component should still render despite RPC error
      expect(screen.getByText('Test Validator')).toBeInTheDocument();
    });

    it('should handle transaction errors', async () => {
      mockWallet.sendTransaction.mockRejectedValue(new Error('Transaction failed'));

      render(<ValidatorStaking {...mockProps} />);

      await waitFor(() => {
        const stakeButton = screen.getByText('Stake SOL');
        fireEvent.click(stakeButton);
      });

      const input = screen.getByPlaceholderText('Enter SOL amount');
      fireEvent.change(input, { target: { value: '1' } });

      const confirmButton = screen.getByText('Confirm Stake');
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText(/Transaction failed/)).toBeInTheDocument();
      });
    });

    it('should sanitize validator name in success messages', async () => {
      const xssProps = {
        ...mockProps,
        validatorName: '<script>alert("xss")</script>Test'
      };

      mockWallet.sendTransaction.mockResolvedValue('transaction_signature');

      render(<ValidatorStaking {...xssProps} />);

      await waitFor(() => {
        const stakeButton = screen.getByText('Stake SOL');
        fireEvent.click(stakeButton);
      });

      const input = screen.getByPlaceholderText('Enter SOL amount');
      fireEvent.change(input, { target: { value: '1' } });

      const confirmButton = screen.getByText('Confirm Stake');
      fireEvent.click(confirmButton);

      await waitFor(() => {
        const successMessage = screen.getByText(/Successfully staked/);
        expect(successMessage.textContent).not.toContain('<script>');
        expect(successMessage.textContent).toContain('Test'); // Sanitized version
      });
    });
  });

  describe('Loading States', () => {
    it('should show loading spinner during staking', async () => {
      // Mock a slow transaction
      mockWallet.sendTransaction.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve('sig'), 1000))
      );

      render(<ValidatorStaking {...mockProps} />);

      await waitFor(() => {
        const stakeButton = screen.getByText('Stake SOL');
        fireEvent.click(stakeButton);
      });

      const input = screen.getByPlaceholderText('Enter SOL amount');
      fireEvent.change(input, { target: { value: '1' } });

      const confirmButton = screen.getByText('Confirm Stake');
      fireEvent.click(confirmButton);

      // Should show loading state
      expect(screen.getByText('Staking...')).toBeInTheDocument();
      expect(confirmButton).toBeDisabled();
    });

    it('should show refresh loading state', async () => {
      render(<ValidatorStaking {...mockProps} />);

      // Find and click refresh button
      const refreshButton = screen.getByLabelText('Refresh balances');
      fireEvent.click(refreshButton);

      // Should show loading state briefly
      await waitFor(() => {
        expect(refreshButton).toHaveAttribute('disabled');
      });
    });
  });
});