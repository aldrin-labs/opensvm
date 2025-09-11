import { render, screen } from '@testing-library/react';
import { ValidatorStaking } from '@/components/solana/validator-staking';

// Mock all external dependencies to prevent async operations
jest.mock('@/lib/solana-connection', () => ({
  getClientConnection: jest.fn(() => ({
    getBalance: jest.fn().mockResolvedValue(0),
    getTokenAccountBalance: jest.fn().mockResolvedValue({ value: { amount: '0', decimals: 9, uiAmount: 0 } }),
    getParsedAccountInfo: jest.fn().mockResolvedValue({ value: null }),
    getVoteAccounts: jest.fn().mockResolvedValue({ current: [], delinquent: [] }),
    getMinimumBalanceForRentExemption: jest.fn().mockResolvedValue(2282880),
    getLatestBlockhash: jest.fn().mockResolvedValue({ blockhash: 'test-blockhash', lastValidBlockHeight: 100 }),
    getBlockHeight: jest.fn().mockResolvedValue(50),
    confirmTransaction: jest.fn().mockResolvedValue({}),
  })),
}));

jest.mock('@solana/wallet-adapter-react', () => ({
  useWallet: () => ({
    publicKey: null,
    connected: false,
    sendTransaction: jest.fn(),
  }),
}));

const mockValidator = {
  validatorVoteAccount: 'test-validator-vote-account',
  validatorName: 'Test Validator',
  commission: 5,
  apy: 8.0,
};

describe('ValidatorStaking', () => {
  it('should render without crashing', () => {
    render(<ValidatorStaking {...mockValidator} />);
    expect(screen.getByText('join to stake')).toBeInTheDocument();
  });
});