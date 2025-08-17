import { test, expect, Page } from '@playwright/test';
import { AITestHelpers } from '../helpers/ai-sidebar-helpers';

test.describe('AI Sidebar Navigation & UI Tests', () => {
    let page: Page;
    let helpers: AITestHelpers;

    test.beforeEach(async ({ page: p }) => {
        page = p;
        helpers = new AITestHelpers(page);
        await page.goto('/');
    });

    // Flow 1: First-Time Sidebar Activation
    test('Flow 1: First-time sidebar activation shows welcome state', async () => {
        await helpers.clearLocalStorage();
        await page.click('[data-testid="ai-sidebar-toggle"]');
        await expect(page.locator('[data-testid="ai-sidebar"]')).toBeVisible();
        await expect(page.locator('[data-testid="welcome-message"]')).toBeVisible();
        await expect(page.locator('[data-testid="mode-selector"]')).toHaveText('Agent');
        await expect(page.locator('[data-testid="knowledge-count"]')).toHaveText('0 notes');
        const sidebarWidth = await page.locator('[data-testid="ai-sidebar"]').evaluate(el => el.clientWidth);
        expect(sidebarWidth).toBe(560);
    });

    // Flow 2: Sidebar Resizing
    test('Flow 2: Sidebar resizing persists across sessions', async () => {
        await helpers.openSidebar();
        const resizeHandle = page.locator('[data-testid="sidebar-resize-handle"]');
        await resizeHandle.hover();
        await expect(page.locator('body')).toHaveCSS('cursor', 'ew-resize');

        await resizeHandle.dragTo(page.locator('body'), { targetPosition: { x: 200, y: 300 } });
        const newWidth = await page.locator('[data-testid="ai-sidebar"]').evaluate(el => el.clientWidth);
        expect(newWidth).toBeGreaterThan(560);

        await page.reload();
        await helpers.openSidebar();
        const persistedWidth = await page.locator('[data-testid="ai-sidebar"]').evaluate(el => el.clientWidth);
        expect(persistedWidth).toBe(newWidth);
    });

    // Flow 3: Multi-Tab Creation and Navigation
    test('Flow 3: Multi-tab creation and navigation maintains separate states', async () => {
        await helpers.openSidebar();
        await page.click('[data-testid="new-tab-button"]');
        await expect(page.locator('[data-testid="chat-tab-2"]')).toBeVisible();

        await helpers.sendMessage('Message in tab 1', 'chat-tab-1');
        await page.click('[data-testid="chat-tab-2"]');
        await helpers.sendMessage('Message in tab 2', 'chat-tab-2');

        await page.click('[data-testid="chat-tab-1"]');
        await expect(page.locator('[data-testid="message-content"]').first()).toContainText('Message in tab 1');

        await page.dblclick('[data-testid="chat-tab-2-title"]');
        await page.fill('[data-testid="tab-title-input"]', 'Custom Tab Name');
        await page.press('[data-testid="tab-title-input"]', 'Enter');
        await expect(page.locator('[data-testid="chat-tab-2-title"]')).toHaveText('Custom Tab Name');
    });

    // Flow 4: Tab Closing Prevention
    test('Flow 4: Last tab cannot be closed', async () => {
        await helpers.openSidebar();
        await helpers.createMultipleTabs(3);

        await page.click('[data-testid="close-tab-2"]');
        await page.click('[data-testid="close-tab-3"]');

        const lastCloseButton = page.locator('[data-testid="close-tab-1"]');
        await expect(lastCloseButton).toBeDisabled();
        await lastCloseButton.hover();
        await expect(page.locator('[data-testid="tooltip"]')).toHaveText('Cannot close last tab');
    });

    // Flow 5: Keyboard Navigation - Tab Switching
    test('Flow 5: Keyboard shortcuts switch between tabs', async () => {
        await helpers.openSidebar();
        await helpers.createMultipleTabs(3);

        await page.press('body', 'Control+1');
        await expect(page.locator('[data-testid="chat-tab-1"]')).toHaveClass(/active/);

        await page.press('body', 'Control+2');
        await expect(page.locator('[data-testid="chat-tab-2"]')).toHaveClass(/active/);

        await page.press('body', 'Control+3');
        await expect(page.locator('[data-testid="chat-tab-3"]')).toHaveClass(/active/);
    });

    // Flow 6: Message Input with Keyboard Shortcuts
    test('Flow 6: Message input handles keyboard shortcuts correctly', async () => {
        await helpers.openSidebar();
        const input = page.locator('[data-testid="message-input"]');

        await input.type('Line 1');
        await input.press('Shift+Enter');
        await input.type('Line 2');

        const inputValue = await input.inputValue();
        expect(inputValue).toContain('Line 1\nLine 2');

        await input.press('Enter');
        await expect(input).toHaveValue('');
        await expect(page.locator('[data-testid="message"]').last()).toContainText('Line 1\nLine 2');
    });

    // Flow 7: Escape Key Cancellation
    test('Flow 7: Escape key cancels ongoing AI processing', async () => {
        await helpers.openSidebar();
        await helpers.sendMessage('Generate a very long response');
        await expect(page.locator('[data-testid="loading-indicator"]')).toBeVisible();

        await page.press('body', 'Escape');
        await expect(page.locator('[data-testid="loading-indicator"]')).not.toBeVisible();
        await expect(page.locator('[data-testid="cancelled-message"]')).toHaveText('Request cancelled');
    });

    // Flow 8: Scroll Behavior in Long Conversations
    test('Flow 8: Auto-scroll behavior in long conversations', async () => {
        await helpers.openSidebar();
        await helpers.generateLongConversation(50);

        const chatContainer = page.locator('[data-testid="chat-container"]');
        const isAtBottom = await helpers.isScrolledToBottom(chatContainer);
        expect(isAtBottom).toBe(true);

        await chatContainer.evaluate(el => el.scrollTop = 0);
        await helpers.sendMessage('New message while scrolled up');

        await expect(page.locator('[data-testid="new-message-indicator"]')).toBeVisible();
        const isStillAtTop = await chatContainer.evaluate(el => el.scrollTop < 100);
        expect(isStillAtTop).toBe(true);
    });

    // Flow 9: Message Virtualization Activation
    test('Flow 9: Virtualization activates for 150+ messages', async () => {
        await helpers.openSidebar();
        await helpers.generateLongConversation(160);

        const visibleMessages = await page.locator('[data-testid="message"]:visible').count();
        expect(visibleMessages).toBeLessThan(160);

        await expect(page.locator('[data-testid="message-count"]')).toHaveText('160 messages');

        const scrollPerformance = await helpers.measureScrollPerformance();
        expect(scrollPerformance.fps).toBeGreaterThan(30);
    });

    // Flow 10: Copy Message Content
    test('Flow 10: Copy message content to clipboard', async () => {
        await helpers.openSidebar();
        await helpers.sendMessage('Test message to copy');
        await helpers.waitForAIResponse();

        const message = page.locator('[data-testid="ai-message"]').first();
        await message.hover();
        await page.click('[data-testid="copy-message-button"]');

        const clipboardContent = await page.evaluate(() => navigator.clipboard.readText());
        expect(clipboardContent).toContain('Test message');

        await expect(page.locator('[data-testid="toast-notification"]')).toHaveText('Copied to clipboard');
    });

    // Flow 11: Voice Recording Activation
    test('Flow 11: Voice recording requires and uses microphone permission', async () => {
        await helpers.openSidebar();
        await helpers.grantMicrophonePermission();

        await page.click('[data-testid="microphone-button"]');
        await expect(page.locator('[data-testid="recording-indicator"]')).toBeVisible();
        await expect(page.locator('[data-testid="waveform-animation"]')).toBeVisible();
    });

    // Flow 12: Voice Recording Transcription
    test('Flow 12: Voice transcription appears in input field', async () => {
        await helpers.openSidebar();
        await helpers.mockVoiceInput('Hello, this is a voice test');

        await page.click('[data-testid="microphone-button"]');
        await page.waitForTimeout(2000); // Simulate speaking
        await page.click('[data-testid="stop-recording-button"]');

        await expect(page.locator('[data-testid="message-input"]')).toHaveValue('Hello, this is a voice test');
    });

    // Flow 13: Knowledge Panel Access
    test('Flow 13: Knowledge panel displays notes and controls', async () => {
        await helpers.openSidebar();
        await page.click('[data-testid="notes-tab"]');

        await expect(page.locator('[data-testid="knowledge-panel"]')).toBeVisible();
        await expect(page.locator('[data-testid="knowledge-search"]')).toBeVisible();
        await expect(page.locator('[data-testid="add-entry-button"]')).toBeVisible();
        await expect(page.locator('[data-testid="note-count"]')).toBeVisible();
    });

    // Flow 14: Knowledge Search Functionality
    test('Flow 14: Knowledge search filters notes in real-time', async () => {
        await helpers.openSidebar();
        await helpers.createKnowledgeNotes(['Solana basics', 'DeFi protocols', 'NFT marketplaces']);

        await page.click('[data-testid="notes-tab"]');
        await page.fill('[data-testid="knowledge-search"]', 'DeFi');

        await expect(page.locator('[data-testid="knowledge-note"]')).toHaveCount(1);
        await expect(page.locator('.highlight')).toHaveText('DeFi');

        await page.fill('[data-testid="knowledge-search"]', 'xyz');
        await expect(page.locator('[data-testid="no-notes-found"]')).toBeVisible();
    });

    // Flow 15: Thread List Navigation
    test('Flow 15: Thread list shows all conversations with previews', async () => {
        await helpers.openSidebar();
        await helpers.createMultipleThreads(5);

        await page.click('[data-testid="thread-list-button"]');
        await expect(page.locator('[data-testid="thread-list"]')).toBeVisible();
        await expect(page.locator('[data-testid="pinned-threads"]')).toBeVisible();
        await expect(page.locator('[data-testid="recent-threads"]')).toBeVisible();

        const firstThread = page.locator('[data-testid="thread-item"]').first();
        await expect(firstThread.locator('[data-testid="thread-preview"]')).toBeVisible();
        await expect(firstThread.locator('[data-testid="thread-timestamp"]')).toBeVisible();
    });

    // Flow 16: Thread Pinning/Unpinning
    test('Flow 16: Threads can be pinned and unpinned', async () => {
        await helpers.openSidebar();
        await helpers.createMultipleThreads(3);

        await page.click('[data-testid="thread-list-button"]');
        const thread = page.locator('[data-testid="thread-item"]').first();

        await thread.hover();
        await thread.locator('[data-testid="pin-button"]').click();

        await expect(page.locator('[data-testid="pinned-threads"] [data-testid="thread-item"]')).toHaveCount(1);

        await thread.locator('[data-testid="pin-button"]').click();
        await expect(page.locator('[data-testid="pinned-threads"] [data-testid="thread-item"]')).toHaveCount(0);
    });

    // Flow 17: Mode Switching (Agent/Assistant)
    test('Flow 17: Mode switching changes AI capabilities', async () => {
        await helpers.openSidebar();

        await expect(page.locator('[data-testid="mode-selector"]')).toHaveText('Agent');
        await page.click('[data-testid="mode-selector"]');
        await page.click('[data-testid="assistant-mode-option"]');

        await expect(page.locator('[data-testid="mode-selector"]')).toHaveText('Assistant');
        await expect(page.locator('[data-testid="mode-indicator"]')).toHaveClass(/assistant-mode/);

        await helpers.sendMessage('What can you help with?');
        await helpers.waitForAIResponse();
        await expect(page.locator('[data-testid="ai-message"]').last()).not.toContainText('Solana');
    });

    // Flow 18: Settings Panel Access
    test('Flow 18: Settings panel displays configuration options', async () => {
        await helpers.openSidebar();
        await page.click('[data-testid="settings-button"]');

        await expect(page.locator('[data-testid="settings-panel"]')).toBeVisible();
        await expect(page.locator('[data-testid="token-usage"]')).toBeVisible();
        await expect(page.locator('[data-testid="theme-preferences"]')).toBeVisible();
        await expect(page.locator('[data-testid="export-options"]')).toBeVisible();
    });

    // Flow 19: Dark/Light Theme Toggle
    test('Flow 19: Theme toggle switches between light and dark modes', async () => {
        await helpers.openSidebar();
        await page.click('[data-testid="settings-button"]');

        const initialTheme = await page.evaluate(() => document.documentElement.dataset.theme);
        await page.click('[data-testid="theme-toggle"]');

        const newTheme = await page.evaluate(() => document.documentElement.dataset.theme);
        expect(newTheme).not.toBe(initialTheme);

        await page.reload();
        await helpers.openSidebar();
        const persistedTheme = await page.evaluate(() => document.documentElement.dataset.theme);
        expect(persistedTheme).toBe(newTheme);
    });

    // Flow 20: Mobile Responsive Layout
    test('Flow 20: Mobile layout adapts to small screens', async () => {
        await page.setViewportSize({ width: 375, height: 667 });
        await helpers.openSidebar();

        await expect(page.locator('[data-testid="ai-sidebar"]')).toHaveClass(/mobile-fullscreen/);
        await expect(page.locator('[data-testid="mobile-back-button"]')).toBeVisible();

        const swipeGesture = await helpers.simulateSwipe('left');
        await expect(page.locator('[data-testid="ai-sidebar"]')).not.toBeVisible();
    });

    // Flow 21: Accessibility - Keyboard Only Navigation
    test('Flow 21: Complete keyboard navigation without mouse', async () => {
        await helpers.openSidebar();

        await page.keyboard.press('Tab');
        await expect(page.locator('[data-testid="message-input"]')).toBeFocused();

        await page.keyboard.press('Tab');
        await expect(page.locator('[data-testid="send-button"]')).toBeFocused();

        await page.keyboard.press('Tab');
        await expect(page.locator('[data-testid="microphone-button"]')).toBeFocused();

        const skipLink = page.locator('[data-testid="skip-to-content"]');
        await skipLink.focus();
        await skipLink.press('Enter');
        await expect(page.locator('[data-testid="main-content"]')).toBeFocused();
    });

    // Flow 22: High Contrast Mode
    test('Flow 22: High contrast mode enhances visibility', async () => {
        await page.emulateMedia({ colorScheme: 'high-contrast' });
        await helpers.openSidebar();

        const backgroundColor = await page.locator('[data-testid="ai-sidebar"]').evaluate(
            el => getComputedStyle(el).backgroundColor
        );
        const textColor = await page.locator('[data-testid="message"]').evaluate(
            el => getComputedStyle(el).color
        );

        const contrast = await helpers.calculateColorContrast(backgroundColor, textColor);
        expect(contrast).toBeGreaterThan(7); // WCAG AAA standard
    });

    // Flow 23: Message Action Menu
    test('Flow 23: Right-click context menu provides message actions', async () => {
        await helpers.openSidebar();
        await helpers.sendMessage('Test message');
        await helpers.waitForAIResponse();

        const message = page.locator('[data-testid="ai-message"]').first();
        await message.click({ button: 'right' });

        const contextMenu = page.locator('[data-testid="context-menu"]');
        await expect(contextMenu).toBeVisible();
        await expect(contextMenu.locator('[data-testid="copy-action"]')).toBeVisible();
        await expect(contextMenu.locator('[data-testid="save-action"]')).toBeVisible();
        await expect(contextMenu.locator('[data-testid="share-action"]')).toBeVisible();
        await expect(contextMenu.locator('[data-testid="fork-action"]')).toBeVisible();
        await expect(contextMenu.locator('[data-testid="search-action"]')).toBeVisible();
    });

    // Flow 24: Drag and Drop File Upload
    test('Flow 24: Drag and drop file into chat area', async () => {
        await helpers.openSidebar();

        const fileData = await helpers.createTestFile('test.txt', 'Test content');
        await helpers.dragAndDropFile('[data-testid="chat-area"]', fileData);

        await expect(page.locator('[data-testid="drop-zone-highlight"]')).toBeVisible();
        await expect(page.locator('[data-testid="file-preview"]')).toBeVisible();
        await expect(page.locator('[data-testid="file-preview"]')).toContainText('test.txt');

        await page.click('[data-testid="confirm-upload"]');
        await expect(page.locator('[data-testid="message-attachment"]')).toBeVisible();
    });

    // Flow 25: Browser Back/Forward Integration
    test('Flow 25: Browser navigation works with conversation history', async () => {
        await helpers.openSidebar();
        await helpers.createMultipleThreads(3);

        await page.click('[data-testid="thread-item-1"]');
        await page.waitForURL(/.*thread=1/);

        await page.click('[data-testid="thread-item-2"]');
        await page.waitForURL(/.*thread=2/);

        await page.goBack();
        await expect(page).toHaveURL(/.*thread=1/);
        await expect(page.locator('[data-testid="active-thread"]')).toHaveText('Thread 1');

        await page.goForward();
        await expect(page).toHaveURL(/.*thread=2/);
        await expect(page.locator('[data-testid="active-thread"]')).toHaveText('Thread 2');
    });
});
