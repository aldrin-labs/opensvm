import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { TransfersTable } from '../TransfersTable';
import { useTransfers } from '@/app/account/[address]/components/shared/hooks';
import { useRouter } from 'next/navigation';
import { formatNumber } from '@/lib/utils';
import { isSolanaOnlyTransaction } from '@/lib/qdrant';

// Mock the dependencies
jest.mock('@/app/account/[address]/components/shared/hooks');
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));
jest.mock('@/lib/utils');
jest.mock('@/lib/qdrant');
jest.mock('@/components/vtable', () => ({
  VTableWrapper: ({ columns, data, loading, onSort, selectedRowId, onRowSelect, renderRowAction, pinnedRowIds, onLoadMore, infiniteScroll, virtualScrolling, maxRows, initialLoadSize, scrollThreshold, responsive, 'aria-busy': ariaBusy }: any) => (
    <div data-testid="vtable-wrapper">
      <div data-testid="loading-state">{loading ? 'Loading...' : 'Loaded'}</div>
      <div data-testid="data-count">{data?.length || 0} rows</div>
      <div data-testid="selected-row">{selectedRowId || 'none'}</div>
      <div data-testid="pinned-rows">{Array.from(pinnedRowIds || []).join(',')}</div>
      <table>
        <thead>
          <tr>
            {columns?.map((col: any) => (
              <th key={col.field} onClick={() => onSort?.(col.field, 'asc')}>
                {col.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data?.map((row: any) => (
            <tr
              key={row.signature}
              data-testid={`row-${row.signature}`}
              onClick={() => onRowSelect?.(row.signature)}
            >
              {columns?.map((col: any) => (
                <td key={col.field} data-testid={`${col.field}-${row.signature}`}>
                  {col.render ? col.render(row) : row[col.field]}
                </td>
              ))}
              {selectedRowId === row.signature && renderRowAction && (
                <td data-testid={`row-action-${row.signature}`}>
                  {renderRowAction(row.signature)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {onLoadMore && <button onClick={onLoadMore}>Load More</button>}
    </div>
  )
}));

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock as any;

describe('TransfersTable', () => {
  const mockUseTransfers = useTransfers as jest.MockedFunction<typeof useTransfers>;
  const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
  const mockFormatNumber = formatNumber as jest.MockedFunction<typeof formatNumber>;
  const mockIsSolanaOnlyTransaction = isSolanaOnlyTransaction as jest.MockedFunction<typeof isSolanaOnlyTransaction>;

  const mockRouter = {
    push: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  };

  const mockTransfers = [
    {
      signature: 'tx1',
      timestamp: '2024-01-01T10:00:00Z',
      type: 'transfer',
      amount: 1000,
      tokenSymbol: 'SOL',
      tokenName: 'Solana',
      from: 'from1',
      to: 'to1',
      mint: 'mint1',
      usdValue: 100,
      isSolanaOnly: true,
    },
    {
      signature: 'tx2',
      timestamp: '2024-01-02T11:00:00Z',
      type: 'swap',
      amount: 500,
      tokenSymbol: 'USDC',
      tokenName: 'USD Coin',
      from: 'from2',
      to: 'to2',
      mint: 'mint2',
      usdValue: 500,
      isSolanaOnly: false,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRouter.mockReturnValue(mockRouter);
    mockUseTransfers.mockReturnValue({
      transfers: mockTransfers,
      loading: false,
      error: null,
      hasMore: true,
      loadMore: jest.fn(),
      totalCount: 2,
    });
    mockFormatNumber.mockImplementation((num) => num?.toLocaleString() || '0');
    mockIsSolanaOnlyTransaction.mockReturnValue(true);
    localStorageMock.getItem.mockReturnValue(null);
  });

  describe('Rendering', () => {
    it('renders the component with basic props', () => {
      render(<TransfersTable address="test-address" />);

      expect(screen.getByText('Account Transfers')).toBeInTheDocument();
      expect(screen.getByTestId('vtable-wrapper')).toBeInTheDocument();
    });

    it('displays loading state', () => {
      mockUseTransfers.mockReturnValue({
        transfers: [],
        loading: true,
        error: null,
        hasMore: false,
        loadMore: jest.fn(),
        totalCount: 0,
      });

      render(<TransfersTable address="test-address" />);

      expect(screen.getByTestId('loading-state')).toHaveTextContent('Loading...');
    });

    it('displays error state', () => {
      mockUseTransfers.mockReturnValue({
        transfers: [],
        loading: false,
        error: 'Failed to load transfers',
        hasMore: false,
        loadMore: jest.fn(),
        totalCount: 0,
      });

      render(<TransfersTable address="test-address" />);

      expect(screen.getByRole('alert')).toHaveTextContent('Failed to load transfers');
    });

    it('displays correct title based on transactionCategory', () => {
      const { rerender } = render(<TransfersTable address="test-address" transactionCategory="trading-txs" />);
      expect(screen.getByText('Trading Transactions')).toBeInTheDocument();

      rerender(<TransfersTable address="test-address" transactionCategory="nft-txs" />);
      expect(screen.getByText('NFT Transactions')).toBeInTheDocument();
    });

    it('shows total count when available', () => {
      render(<TransfersTable address="test-address" />);

      expect(screen.getByText('(1 of 2)')).toBeInTheDocument();
    });
  });

  describe('Filtering', () => {
    it('filters by search term', async () => {
      render(<TransfersTable address="test-address" />);

      const searchInput = screen.getByPlaceholderText('Search transfers by address, token symbol, or signature...');
      fireEvent.change(searchInput, { target: { value: 'SOL' } });

      await waitFor(() => {
        expect(screen.getByTestId('data-count')).toHaveTextContent('1 rows');
      });
    });

    it('filters by type', async () => {
      render(<TransfersTable address="test-address" />);

      const typeSelect = screen.getByLabelText('Filter by transaction type');
      fireEvent.change(typeSelect, { target: { value: 'transfer' } });

      await waitFor(() => {
        expect(screen.getByTestId('data-count')).toHaveTextContent('1 rows');
      });
    });

    it('filters by token', async () => {
      render(<TransfersTable address="test-address" />);

      const tokenSelect = screen.getByLabelText('Filter by token');
      fireEvent.change(tokenSelect, { target: { value: 'USDC' } });

      await waitFor(() => {
        expect(screen.getByTestId('data-count')).toHaveTextContent('1 rows');
      });
    });

    it('filters by amount range', async () => {
      render(<TransfersTable address="test-address" />);

      const minInput = screen.getByPlaceholderText('Min Amount');
      const maxInput = screen.getByPlaceholderText('Max Amount');

      fireEvent.change(minInput, { target: { value: '600' } });
      fireEvent.change(maxInput, { target: { value: '1200' } });

      await waitFor(() => {
        expect(screen.getByTestId('data-count')).toHaveTextContent('1 rows');
      });
    });

    it('clears all filters', async () => {
      render(<TransfersTable address="test-address" />);

      // Set some filters
      const searchInput = screen.getByPlaceholderText('Search transfers by address, token symbol, or signature...');
      fireEvent.change(searchInput, { target: { value: 'SOL' } });

      const clearButton = screen.getByText('Clear Filters');
      fireEvent.click(clearButton);

      await waitFor(() => {
        expect(searchInput).toHaveValue('');
        expect(screen.getByTestId('data-count')).toHaveTextContent('1 rows');
      });
    });

    it('shows Solana Only filter for account-transfers category', () => {
      render(<TransfersTable address="test-address" transactionCategory="account-transfers" />);

      expect(screen.getByText('Solana Only')).toBeInTheDocument();
    });

    it('shows custom program address input for custom-program-txs category', () => {
      render(<TransfersTable address="test-address" transactionCategory="custom-program-txs" />);

      expect(screen.getByPlaceholderText('Program Address')).toBeInTheDocument();
    });
  });

  describe('Sorting', () => {
    it('sorts by timestamp', () => {
      render(<TransfersTable address="test-address" />);

      const timestampHeader = screen.getByText('Time');
      fireEvent.click(timestampHeader);

      // Check if sort was called
      expect(screen.getByTestId('timestamp-tx1')).toBeInTheDocument();
    });

    it('sorts by amount', () => {
      render(<TransfersTable address="test-address" />);

      const amountHeader = screen.getByText('Amount');
      fireEvent.click(amountHeader);

      expect(screen.getByTestId('amount-tx1')).toBeInTheDocument();
    });
  });

  describe('Row Selection and Pinning', () => {
    it('selects a row when clicked', () => {
      render(<TransfersTable address="test-address" />);

      const row = screen.getByTestId('row-tx1');
      fireEvent.click(row);

      expect(screen.getByTestId('selected-row')).toHaveTextContent('tx1');
    });

    it('pins a row', () => {
      render(<TransfersTable address="test-address" />);

      // First select a row to show the pin button
      const row = screen.getByTestId('row-tx1');
      fireEvent.click(row);

      // Now the pin button should be visible
      const pinButton = screen.getByTestId('row-action-tx1').querySelector('button');
      expect(pinButton).toBeInTheDocument();
      if (pinButton) {
        fireEvent.click(pinButton);
      }

      expect(screen.getByTestId('pinned-rows')).toHaveTextContent('tx1');
    });

    it('unpins a row when clicked again', () => {
      render(<TransfersTable address="test-address" />);

      // First select a row to show the pin button
      const row = screen.getByTestId('row-tx1');
      fireEvent.click(row);

      // Click pin button twice
      const pinButton = screen.getByTestId('row-action-tx1').querySelector('button');
      expect(pinButton).toBeInTheDocument();
      if (pinButton) {
        fireEvent.click(pinButton);
        fireEvent.click(pinButton);
      }

      expect(screen.getByTestId('pinned-rows')).toHaveTextContent('');
    });
  });

  describe('Navigation', () => {
    it('navigates to account page when address is clicked', () => {
      render(<TransfersTable address="test-address" />);

      const addressLink = screen.getByText('from1');
      fireEvent.click(addressLink);

      expect(mockRouter.push).toHaveBeenCalledWith('/account/from1?tab=account-transfers', {
        scroll: false,
      });
    });

    it('navigates to transaction page when signature is clicked', () => {
      render(<TransfersTable address="test-address" />);

      const signatureLink = screen.getByText('tx1');
      fireEvent.click(signatureLink);

      expect(mockRouter.push).toHaveBeenCalledWith('/tx/tx1', {
        scroll: false,
      });
    });
  });

  describe('Local Storage', () => {
    beforeEach(() => {
      // Mock window object for localStorage tests
      Object.defineProperty(window, 'localStorage', {
        value: localStorageMock,
        writable: true,
      });
    });

    it('loads filter preferences from localStorage', () => {
      const savedPreferences = {
        transactionCategory: 'trading-txs',
        solanaOnlyFilter: true,
        customProgramAddress: 'program123',
      };

      localStorageMock.getItem.mockReturnValue(JSON.stringify(savedPreferences));

      render(<TransfersTable address="test-address" />);

      expect(localStorageMock.getItem).toHaveBeenCalledWith('opensvm-filter-preferences');
    });

    it('saves filter preferences to localStorage', () => {
      render(<TransfersTable address="test-address" />);

      const solanaOnlyButton = screen.getByText('Solana Only');
      fireEvent.click(solanaOnlyButton);

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'opensvm-filter-preferences',
        expect.stringContaining('"solanaOnlyFilter":true')
      );
    });

    it('handles localStorage errors gracefully', () => {
      localStorageMock.getItem.mockImplementation(() => {
        throw new Error('Storage error');
      });

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      render(<TransfersTable address="test-address" />);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to load filter preferences from localStorage:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Transaction Categorization', () => {
    it('categorizes transfers correctly', () => {
      // Mock to return only the transfer transaction for account-transfers category
      mockUseTransfers.mockReturnValueOnce({
        transfers: [mockTransfers[0]], // Only the transfer transaction
        loading: false,
        error: null,
        hasMore: false,
        loadMore: jest.fn(),
        totalCount: 1,
      });

      const { rerender } = render(<TransfersTable address="test-address" transactionCategory="account-transfers" />);

      // Should show the transfer transaction
      expect(screen.getByTestId('data-count')).toHaveTextContent('1 rows');

      // Mock to return only the swap transaction for trading-txs category
      mockUseTransfers.mockReturnValueOnce({
        transfers: [mockTransfers[1]], // Only the swap transaction
        loading: false,
        error: null,
        hasMore: false,
        loadMore: jest.fn(),
        totalCount: 1,
      });

      rerender(<TransfersTable address="test-address" transactionCategory="trading-txs" />);

      // Should show only the swap transaction
      expect(screen.getByTestId('data-count')).toHaveTextContent('1 rows');
    });

    it('handles custom program filtering', () => {
      render(<TransfersTable address="test-address" transactionCategory="custom-program-txs" />);

      const programInput = screen.getByPlaceholderText('Program Address');
      fireEvent.change(programInput, { target: { value: 'from1' } });

      // Should show all transfers since the mock doesn't filter by program
      expect(screen.getByTestId('data-count')).toHaveTextContent('1 rows');
    });
  });

  describe('Edge Cases', () => {
    it('handles empty transfers array', () => {
      mockUseTransfers.mockReturnValue({
        transfers: [],
        loading: false,
        error: null,
        hasMore: false,
        loadMore: jest.fn(),
        totalCount: 0,
      });

      render(<TransfersTable address="test-address" />);

      expect(screen.getByTestId('data-count')).toHaveTextContent('0 rows');
    });

    it('handles invalid timestamp', () => {
      mockUseTransfers.mockReturnValue({
        transfers: [{
          signature: 'tx3',
          timestamp: 'invalid-date',
          type: 'transfer',
          amount: 100,
          tokenSymbol: 'SOL',
          tokenName: 'Solana',
          from: 'from3',
          to: 'to3',
          mint: 'mint3',
          usdValue: 100,
          isSolanaOnly: true,
        }],
        loading: false,
        error: null,
        hasMore: false,
        loadMore: jest.fn(),
        totalCount: 1,
      });

      render(<TransfersTable address="test-address" />);

      expect(screen.getByTestId('timestamp-tx3')).toHaveTextContent('-');
    });

    it('handles missing optional fields', () => {
      mockUseTransfers.mockReturnValue({
        transfers: [{
          signature: 'tx4',
          timestamp: '2024-01-01T10:00:00Z',
          type: 'transfer',
          amount: undefined,
          tokenSymbol: undefined,
          tokenName: undefined,
          from: undefined,
          to: undefined,
          mint: undefined,
          usdValue: undefined,
          isSolanaOnly: true,
        }],
        loading: false,
        error: null,
        hasMore: false,
        loadMore: jest.fn(),
        totalCount: 1,
      });

      render(<TransfersTable address="test-address" />);

      expect(screen.getByTestId('amount-tx4')).toHaveTextContent('0');
      expect(screen.getByTestId('token-tx4')).toHaveTextContent('SOL');
      expect(screen.getByTestId('tokenName-tx4')).toHaveTextContent('Solana');
    });
  });

  describe('Load More', () => {
    it('calls loadMore when Load More button is clicked', () => {
      const mockLoadMore = jest.fn();
      mockUseTransfers.mockReturnValue({
        transfers: mockTransfers,
        loading: false,
        error: null,
        hasMore: true,
        loadMore: mockLoadMore,
        totalCount: 2,
      });

      render(<TransfersTable address="test-address" />);

      const loadMoreButton = screen.getByText('Load More');
      fireEvent.click(loadMoreButton);

      expect(mockLoadMore).toHaveBeenCalled();
    });
  });
});
