import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import { screen, fireEvent } from '@testing-library/dom';
import { NavbarInteractive } from '../components/NavbarInteractive';
import { useRouter } from 'next/navigation';

// Mock the AIChatSidebar component
const AIChatSidebar = ({ isOpen }: { isOpen: boolean }) => (
  <div
    data-testid="ai-chat-sidebar"
    style={{
      transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
      position: 'fixed',
      right: 0,
      top: 0,
      width: '400px',
      height: '100vh',
      backgroundColor: 'white',
      zIndex: 50
    }}
  >
    Mock AI Chat Sidebar
  </div>
);// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

// Mock Solana wallet adapter to avoid provider errors
jest.mock('@solana/wallet-adapter-react', () => ({
  useWallet: () => ({
    connected: false,
    publicKey: null,
  }),
}));

// Mock child components to simplify testing
jest.mock('@/components/SettingsMenu', () => ({
  SettingsMenu: () => <div data-testid="settings-menu">Settings Menu</div>,
}));

jest.mock('@/components/WalletButton', () => ({
  WalletButton: () => <div data-testid="wallet-button">Connect Wallet</div>,
}));

// Mock the AI chat sidebar context
const mockOpenAIChat = jest.fn();
const mockUseAIChatSidebar = {
  isOpen: false,
  open: mockOpenAIChat,
  close: jest.fn(),
  sidebarWidth: 560,
  setSidebarWidth: jest.fn(),
  isResizing: false,
  onResizeStart: jest.fn(),
  onResizeEnd: jest.fn(),
};

jest.mock('@/contexts/AIChatSidebarContext', () => ({
  useAIChatSidebar: () => mockUseAIChatSidebar,
}));

jest.mock('@/components/ai/AIChatSidebar', () => ({
  AIChatSidebar: ({ isOpen }: { isOpen: boolean }) => (
    <div
      data-testid="ai-chat-sidebar"
      style={{ transform: isOpen ? 'translateX(0)' : 'translateX(100%)' }}
    >
      svmai
    </div>
  ),
})); describe('Navbar', () => {
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
    expect(screen.getByText('OpenSVM')).toBeInTheDocument();
    expect(screen.getByText('[ai]')).toBeInTheDocument();

    // Check search input
    expect(screen.getAllByPlaceholderText('Search accounts, tokens, or programs...')[0]).toBeInTheDocument();

    // Check navigation dropdowns
    expect(screen.getByTestId('nav-dropdown-explore')).toBeInTheDocument();
    expect(screen.getByTestId('nav-dropdown-tokens')).toBeInTheDocument();
    expect(screen.getByTestId('nav-dropdown-defi')).toBeInTheDocument();
    expect(screen.getByTestId('nav-dropdown-analytics')).toBeInTheDocument();

    // Check settings and wallet button (allow multiple occurrences due to mobile + desktop)
    const settingsMenus = screen.getAllByTestId('settings-menu');
    expect(settingsMenus.length).toBeGreaterThan(0);
    const walletButtons = screen.getAllByText('Connect Wallet');
    expect(walletButtons.length).toBeGreaterThan(0);
  });

  it('handles Solana address search correctly', async () => {
    render(<NavbarInteractive>{mockChildren}</NavbarInteractive>);

    const searchInput = screen.getAllByPlaceholderText('Search accounts, tokens, or programs...')[0];
    const validAddress = '5vJRzKtcp4fJxqmR7qzajkaPgqErYd1GdZk7Z7nqLqj8';

    fireEvent.change(searchInput, { target: { value: validAddress } });
    fireEvent.submit(searchInput);

    expect(mockPush).toHaveBeenCalledWith(`/account/${validAddress}`);
  });

  it('handles general search query correctly', async () => {
    render(<NavbarInteractive>{mockChildren}</NavbarInteractive>);

    const searchInput = screen.getAllByPlaceholderText('Search accounts, tokens, or programs...')[0];
    const searchQuery = 'test query';

    fireEvent.change(searchInput, { target: { value: searchQuery } });
    fireEvent.submit(searchInput);

    expect(mockPush).toHaveBeenCalledWith(`/search?q=${encodeURIComponent(searchQuery)}`);
  });

  it('ignores empty search queries', () => {
    render(<NavbarInteractive>{mockChildren}</NavbarInteractive>);

    const searchInput = screen.getAllByPlaceholderText('Search accounts, tokens, or programs...')[0];

    fireEvent.change(searchInput, { target: { value: '   ' } });
    fireEvent.submit(searchInput);

    expect(mockPush).not.toHaveBeenCalled();
  });

  it('toggles AI chat sidebar visibility', async () => {
    let isOpen = false;

    const TestWrapper = () => (
      <>
        <NavbarInteractive>{mockChildren}</NavbarInteractive>
        <AIChatSidebar isOpen={isOpen} />
      </>
    );

    const { rerender } = render(<TestWrapper />);

    const aiButton = screen.getByText('AI Assistant');
    const sidebar = screen.getByTestId('ai-chat-sidebar');

    // Initially hidden (translateX(100%))
    expect(sidebar).toHaveStyle('transform: translateX(100%)');

    // Show sidebar
    fireEvent.click(aiButton);
    expect(mockOpenAIChat).toHaveBeenCalled();

    // Update state and re-render
    isOpen = true;
    rerender(<TestWrapper />);

    const sidebarAfterClick = screen.getByTestId('ai-chat-sidebar');
    expect(sidebarAfterClick).toHaveStyle('transform: translateX(0)');
  }); it('renders children content', () => {
    render(<NavbarInteractive>{mockChildren}</NavbarInteractive>);
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('validates Solana addresses correctly', async () => {
    render(<NavbarInteractive>{mockChildren}</NavbarInteractive>);
    const searchInput = screen.getAllByPlaceholderText('Search accounts, tokens, or programs...')[0];

    // Test with a general search query
    const generalQuery = 'general search';
    fireEvent.change(searchInput, { target: { value: generalQuery } });
    fireEvent.submit(searchInput.closest('form')!);
    expect(mockPush).toHaveBeenCalledWith(`/search?q=${encodeURIComponent(generalQuery)}`);
  });
});
