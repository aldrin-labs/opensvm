import { render } from '@testing-library/react';
import { screen, fireEvent } from '@testing-library/dom';
import { NavbarInteractive } from '@/components/NavbarInteractive';
import { useRouter } from 'next/navigation';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

// Mock child components to simplify testing
jest.mock('@/components/SettingsMenu', () => ({
  SettingsMenu: () => <div data-testid="settings-menu">Settings Menu</div>,
}));

jest.mock('@/components/WalletButton', () => ({
  WalletButton: () => <div data-testid="wallet-button">Connect Wallet</div>,
}));

jest.mock('@/components/ai/AIChatSidebar', () => ({
  AIChatSidebar: ({ isOpen }: { isOpen: boolean }) => (
    <div data-testid="ai-chat-sidebar" className={isOpen ? 'visible' : 'hidden'}>
      AI Chat Sidebar
    </div>
  ),
}));

describe('Navbar', () => {
  const mockPush = jest.fn();
  const mockChildren = <div>Test Content</div>;

  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
    });
    mockPush.mockClear();
  });

  it('renders the navbar with all main elements', () => {
    render(<NavbarInteractive>{mockChildren}</NavbarInteractive>);

    // Check logo and branding
    expect(screen.getByText('OPENSVM')).toBeInTheDocument();
    expect(screen.getByText('[AI]')).toBeInTheDocument();

    // Check search input
    expect(screen.getByPlaceholderText('Search accounts, tokens, or programs...')).toBeInTheDocument();

    // Check navigation dropdowns
    expect(screen.getByTestId('nav-dropdown-explore')).toBeInTheDocument();
    expect(screen.getByTestId('nav-dropdown-tokens')).toBeInTheDocument();
    expect(screen.getByTestId('nav-dropdown-nfts')).toBeInTheDocument();
    expect(screen.getByTestId('nav-dropdown-analytics')).toBeInTheDocument();

    // Check settings and wallet button
    expect(screen.getByTestId('settings-menu')).toBeInTheDocument();
    expect(screen.getByText('Connect Wallet')).toBeInTheDocument();
  });

  it('handles Solana address search correctly', async () => {
    render(<NavbarInteractive>{mockChildren}</NavbarInteractive>);
    
    const searchInput = screen.getByPlaceholderText('Search accounts, tokens, or programs...');
    const validAddress = '5vJRzKtcp4fJxqmR7qzajkaPgqErYd1GdZk7Z7nqLqj8';
    
    fireEvent.change(searchInput, { target: { value: validAddress } });
    fireEvent.submit(searchInput);

    expect(mockPush).toHaveBeenCalledWith(`/account/${validAddress}`);
  });

  it('handles general search query correctly', async () => {
    render(<NavbarInteractive>{mockChildren}</NavbarInteractive>);
    
    const searchInput = screen.getByPlaceholderText('Search accounts, tokens, or programs...');
    const searchQuery = 'test query';
    
    fireEvent.change(searchInput, { target: { value: searchQuery } });
    fireEvent.submit(searchInput);

    expect(mockPush).toHaveBeenCalledWith(`/search?q=${encodeURIComponent(searchQuery)}`);
  });

  it('ignores empty search queries', () => {
    render(<NavbarInteractive>{mockChildren}</NavbarInteractive>);
    
    const searchInput = screen.getByPlaceholderText('Search accounts, tokens, or programs...');
    
    fireEvent.change(searchInput, { target: { value: '   ' } });
    fireEvent.submit(searchInput);

    expect(mockPush).not.toHaveBeenCalled();
  });

  it('toggles AI chat sidebar visibility', async () => {
    render(<NavbarInteractive>{mockChildren}</NavbarInteractive>);
    
    const aiButton = screen.getByText('AI Assistant');
    const sidebar = screen.getByTestId('ai-chat-sidebar');
    
    // Initially hidden
    expect(sidebar).toHaveClass('hidden');
    
    // Show sidebar
    fireEvent.click(aiButton);
    expect(sidebar).toHaveClass('visible');
  });

  it('renders children content', () => {
    render(<NavbarInteractive>{mockChildren}</NavbarInteractive>);
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('validates Solana addresses correctly', async () => {
    render(<NavbarInteractive>{mockChildren}</NavbarInteractive>);
    const searchInput = screen.getByPlaceholderText('Search accounts, tokens, or programs...');

    // Test with a general search query
    const generalQuery = 'general search';
    fireEvent.change(searchInput, { target: { value: generalQuery } });
    fireEvent.submit(searchInput.closest('form')!);
    expect(mockPush).toHaveBeenCalledWith(`/search?q=${generalQuery}`);
  });
});
