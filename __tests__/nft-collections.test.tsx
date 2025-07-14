import { render, screen } from '@testing-library/react';
import NFTsPage from '@/app/nfts/page';
import { act } from 'react-dom/test-utils';


// Mock fetch
global.fetch = jest.fn();

describe('NFTsPage', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers({ advanceTimers: true });
    (global.fetch as jest.Mock).mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  const waitForStateUpdate = async () => {
    await act(async () => {
      await Promise.resolve();
      jest.runAllTimers();
      await Promise.resolve();
    });
  };

  it('shows loading state initially', async () => {
    render(<NFTsPage />);
    expect(screen.getAllByTestId('nft-skeleton')).toHaveLength(6);
    await waitForStateUpdate();
  });

  it('displays NFT collections when fetch succeeds', async () => {
    const mockCollections = [
      {
        address: 'DRiP2Pn2K6fuMLKQmt5rZWyHiUZ6WK3GChEySUpHSS4x',
        name: 'DRiP',
        symbol: 'DRIP',
        image: '/images/placeholder-nft.svg'
      },
      {
        address: 'SMBH3wF6baUj6JWtzYvqcKuj2XCKWDqQxzspY12xPND',
        name: 'Solana Monkey Business',
        symbol: 'SMB',
        image: '/images/placeholder-nft.svg'
      }
    ];

    (global.fetch as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockCollections),
      })
    );

    render(<NFTsPage />);

    // Should show loading state initially
    expect(screen.getAllByTestId('nft-skeleton')).toHaveLength(6);

    // Wait for collections to load
    await waitForStateUpdate();
    expect(screen.getAllByTestId('nft-collection')).toHaveLength(2);

    // Verify collection details
    expect(screen.getByText('DRiP')).toBeInTheDocument();
    expect(screen.getByText('Solana Monkey Business')).toBeInTheDocument();
    expect(screen.getByText('DRIP')).toBeInTheDocument();
    expect(screen.getByText('SMB')).toBeInTheDocument();
  });

  it('shows error message when fetch fails', async () => {
    // Mock a failed fetch that will cause a JSON parsing error
    (global.fetch as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        json: () => { throw new TypeError('Cannot read properties of undefined (reading \'json\')'); }
      })
    );

    render(<NFTsPage />);

    // Should show loading state initially
    expect(screen.getAllByTestId('nft-skeleton')).toHaveLength(6);

    // Wait for error state and loading to clear
    await waitForStateUpdate();
    expect(screen.queryAllByTestId('nft-skeleton')).toHaveLength(0);
    const errorElement = screen.getByText('Cannot read properties of undefined (reading \'json\')');
    expect(errorElement).toBeInTheDocument();
    expect(errorElement.className).toContain('text-red-600');
    expect(screen.queryAllByTestId('nft-collection')).toHaveLength(0);
  });

  it('makes initial request plus 2 retries when fetch fails', async () => {
    jest.useFakeTimers({ advanceTimers: true });

    const jsonError = new TypeError('Cannot read properties of undefined (reading \'json\')');
    
    (global.fetch as jest.Mock)
      .mockImplementationOnce(() => Promise.resolve({
        json: () => { throw jsonError; }
      }))
      .mockImplementationOnce(() => Promise.resolve({
        json: () => { throw jsonError; }
      }))
      .mockImplementationOnce(() => Promise.resolve({
        json: () => { throw jsonError; }
      }));

    render(<NFTsPage />);

    // Initial loading state
    expect(screen.getAllByTestId('nft-skeleton')).toHaveLength(6);

    // Initial attempt
    await waitForStateUpdate();

    // First retry
    await act(async () => {
      jest.advanceTimersByTime(1000);
      await Promise.resolve();
    });
    await waitForStateUpdate();

    // Second retry
    await act(async () => {
      jest.advanceTimersByTime(1000);
      await Promise.resolve();
    });
    await waitForStateUpdate();

    // Wait for all retries to complete
    await act(async () => {
      jest.advanceTimersByTime(1000);
      await Promise.resolve();
    });
    await waitForStateUpdate();

    // Verify all three attempts were made
    expect(global.fetch).toHaveBeenCalledTimes(3);

    // Verify final state
    expect(screen.queryAllByTestId('nft-skeleton')).toHaveLength(0);
    const errorElement = screen.getByText('Cannot read properties of undefined (reading \'json\')');
    expect(errorElement).toBeInTheDocument();
    expect(errorElement.className).toContain('text-red-600');

    jest.useRealTimers();
  });

  it('handles empty collections response', async () => {
    jest.useFakeTimers({ advanceTimers: true });
    (global.fetch as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve([]),
      })
    );

    render(<NFTsPage />);

    await waitForStateUpdate();

    expect(screen.queryAllByTestId('nft-skeleton')).toHaveLength(0);
    expect(screen.queryAllByTestId('nft-collection')).toHaveLength(0);
    expect(screen.getByText('No NFT collections found')).toBeInTheDocument();
  });

  it('uses placeholder image when collection image fails to load', async () => {
    jest.useFakeTimers({ advanceTimers: true });
    const mockCollections = [
      {
        address: 'DRiP2Pn2K6fuMLKQmt5rZWyHiUZ6WK3GChEySUpHSS4x',
        name: 'DRiP',
        symbol: 'DRIP',
        image: 'invalid-image-url'
      }
    ];

    (global.fetch as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockCollections),
      })
    );

    render(<NFTsPage />);

    await act(async () => {
      await Promise.resolve();
      jest.runAllTimers();
      await Promise.resolve();
    });

    expect(screen.getByTestId('nft-collection')).toBeInTheDocument();

    // Verify placeholder image is used immediately for invalid URLs
    const img = screen.getByAltText('DRiP');
    expect(img).toHaveAttribute('src', '/images/placeholder-nft.svg');
  });
});
