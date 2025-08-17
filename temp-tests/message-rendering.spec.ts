import { test, expect, Page } from '@playwright/test';
import { AITestHelpers } from '../helpers/ai-sidebar-helpers';

test.describe('AI Sidebar Message Rendering Tests', () => {
    let page: Page;
    let helpers: AITestHelpers;

    test.beforeEach(async ({ page: p }) => {
        page = p;
        helpers = new AITestHelpers(page);
        await page.goto('/');
        await helpers.openSidebar();
    });

    // Flow 26: Basic Markdown Rendering
    test('Flow 26: Markdown renders with proper formatting', async () => {
        await helpers.sendMessage('Format this: **bold** *italic* [link](https://example.com)');
        await helpers.waitForAIResponse();

        const response = page.locator('[data-testid="ai-message"]').last();
        await expect(response.locator('strong')).toBeVisible();
        await expect(response.locator('em')).toBeVisible();
        await expect(response.locator('a[href="https://example.com"]')).toBeVisible();

        const link = response.locator('a').first();
        await expect(link).toHaveAttribute('target', '_blank');
        await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    // Flow 27: Code Block Syntax Highlighting
    test('Flow 27: Code blocks render with syntax highlighting', async () => {
        await helpers.sendMessage('Show me a JavaScript function');
        await helpers.mockAIResponse(`\`\`\`javascript
function test() {
  return "Hello World";
}
\`\`\``);

        const codeBlock = page.locator('[data-testid="code-block"]').first();
        await expect(codeBlock).toHaveAttribute('data-language', 'javascript');
        await expect(codeBlock.locator('.token.keyword')).toBeVisible();
        await expect(codeBlock.locator('.token.string')).toBeVisible();

        await codeBlock.hover();
        await expect(page.locator('[data-testid="copy-code-button"]')).toBeVisible();
        await expect(codeBlock.locator('[data-testid="line-numbers"]')).toBeVisible();
    });

    // Flow 28: Mermaid Diagram Rendering
    test('Flow 28: Mermaid diagrams render in collapsible containers', async () => {
        await helpers.sendMessage('Show me a flowchart');
        await helpers.mockAIResponse(`\`\`\`mermaid
graph TD
  A[Start] --> B{Decision}
  B -->|Yes| C[End]
  B -->|No| D[Continue]
\`\`\``);

        const diagramContainer = page.locator('[data-testid="mermaid-container"]');
        await expect(diagramContainer).toBeVisible();
        await expect(diagramContainer.locator('[data-testid="collapse-button"]')).toBeVisible();

        await diagramContainer.locator('[data-testid="collapse-button"]').click();
        await expect(diagramContainer.locator('svg')).not.toBeVisible();

        await diagramContainer.locator('[data-testid="expand-button"]').click();
        await expect(diagramContainer.locator('svg')).toBeVisible();
    });

    // Flow 29: Large Table Handling
    test('Flow 29: Large tables become collapsible after 10 rows', async () => {
        const tableData = Array.from({ length: 25 }, (_, i) => `| Row ${i} | Data ${i} |`).join('\n');
        await helpers.sendMessage('Show me data');
        await helpers.mockAIResponse(`| Header 1 | Header 2 |\n|----------|----------|\n${tableData}`);

        const table = page.locator('[data-testid="data-table"]');
        await expect(table).toBeVisible();

        const visibleRows = await table.locator('tbody tr:visible').count();
        expect(visibleRows).toBe(10);

        await expect(page.locator('[data-testid="show-more-button"]')).toHaveText('Show 15 more rows');
        await page.click('[data-testid="show-more-button"]');

        const allRows = await table.locator('tbody tr:visible').count();
        expect(allRows).toBe(25);

        await expect(page.locator('[data-testid="table-search"]')).toBeVisible();
    });

    // Flow 30: Reasoning Block Interaction
    test('Flow 30: Reasoning blocks are collapsible and show chain-of-thought', async () => {
        await helpers.sendMessage('Explain something complex');
        await helpers.mockAIResponseWithReasoning(
            'Here is the answer',
            'First, I need to consider... Then, I analyze... Finally, I conclude...'
        );

        const reasoningBlock = page.locator('[data-testid="reasoning-block"]');
        await expect(reasoningBlock).toBeVisible();
        await expect(reasoningBlock).toHaveAttribute('aria-expanded', 'false');

        await reasoningBlock.click();
        await expect(reasoningBlock).toHaveAttribute('aria-expanded', 'true');
        await expect(reasoningBlock.locator('[data-testid="reasoning-content"]')).toContainText('First, I need to consider');
    });

    // Flow 31: Link Preview Generation
    test('Flow 31: External links generate preview cards', async () => {
        await helpers.sendMessage('Check out https://github.com/solana-labs/solana');
        await helpers.waitForAIResponse();

        const linkPreview = page.locator('[data-testid="link-preview"]');
        await expect(linkPreview).toBeVisible();
        await expect(linkPreview.locator('[data-testid="preview-thumbnail"]')).toBeVisible();
        await expect(linkPreview.locator('[data-testid="preview-title"]')).toContainText('Solana');
        await expect(linkPreview.locator('[data-testid="preview-description"]')).toBeVisible();

        await linkPreview.click();
        const newTab = await helpers.waitForNewTab();
        expect(newTab.url()).toContain('github.com');
    });

    // Flow 32: Mathematical Formula Rendering
    test('Flow 32: LaTeX formulas render correctly', async () => {
        await helpers.sendMessage('Show me the quadratic formula');
        await helpers.mockAIResponse('The formula is $$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$');

        const mathBlock = page.locator('[data-testid="math-block"]');
        await expect(mathBlock).toBeVisible();
        await expect(mathBlock.locator('.katex')).toBeVisible();

        const inlineMath = page.locator('[data-testid="inline-math"]');
        await helpers.mockAIResponse('Also, $e^{i\\pi} + 1 = 0$');
        await expect(inlineMath).toBeVisible();
    });

    // Flow 33: Image Display and Handling
    test('Flow 33: Images load with proper sizing and expansion', async () => {
        await helpers.sendMessage('Show me an image');
        await helpers.mockAIResponseWithImage('https://example.com/image.png', 'Test Image');

        const image = page.locator('[data-testid="message-image"]');
        await expect(image).toBeVisible();
        await expect(image).toHaveAttribute('alt', 'Test Image');
        await expect(page.locator('[data-testid="image-loading"]')).not.toBeVisible();

        await image.click();
        await expect(page.locator('[data-testid="image-modal"]')).toBeVisible();
        await expect(page.locator('[data-testid="full-size-image"]')).toBeVisible();
    });

    // Flow 34: Interactive Elements in Messages
    test('Flow 34: Interactive components work within messages', async () => {
        await helpers.sendMessage('Create an interactive poll');
        await helpers.mockAIResponseWithInteractive('poll', {
            question: 'Favorite blockchain?',
            options: ['Solana', 'Ethereum', 'Bitcoin']
        });

        const poll = page.locator('[data-testid="interactive-poll"]');
        await expect(poll).toBeVisible();

        await poll.locator('[data-testid="option-Solana"]').click();
        await expect(poll.locator('[data-testid="results"]')).toBeVisible();
        await expect(poll.locator('[data-testid="vote-count-Solana"]')).toHaveText('1');
    });

    // Flow 35: Message Threading and Replies
    test('Flow 35: Reply threading maintains conversation context', async () => {
        await helpers.sendMessage('First message');
        await helpers.waitForAIResponse();

        const firstMessage = page.locator('[data-testid="message"]').first();
        await firstMessage.hover();
        await firstMessage.locator('[data-testid="reply-button"]').click();

        await page.fill('[data-testid="reply-input"]', 'This is a reply');
        await page.press('[data-testid="reply-input"]', 'Enter');

        const reply = page.locator('[data-testid="threaded-reply"]');
        await expect(reply).toBeVisible();
        await expect(reply).toHaveAttribute('data-reply-to', await firstMessage.getAttribute('data-message-id'));
        await expect(reply.locator('[data-testid="thread-line"]')).toBeVisible();
    });

    // Flow 36: Message Editing (User Messages)
    test('Flow 36: User can edit their own messages', async () => {
        await helpers.sendMessage('Original message');

        const userMessage = page.locator('[data-testid="user-message"]').last();
        await userMessage.hover();
        await userMessage.locator('[data-testid="edit-button"]').click();

        const editor = userMessage.locator('[data-testid="inline-editor"]');
        await expect(editor).toBeVisible();
        await editor.clear();
        await editor.type('Edited message');
        await editor.press('Enter');

        await expect(userMessage).toContainText('Edited message');
        await expect(userMessage.locator('[data-testid="edited-indicator"]')).toBeVisible();
    });

    // Flow 37: Message Deletion with Confirmation
    test('Flow 37: Message deletion requires confirmation', async () => {
        await helpers.sendMessage('Message to delete');
        await helpers.waitForAIResponse();

        const message = page.locator('[data-testid="user-message"]').last();
        await message.hover();
        await message.locator('[data-testid="delete-button"]').click();

        const confirmDialog = page.locator('[data-testid="confirm-dialog"]');
        await expect(confirmDialog).toBeVisible();
        await expect(confirmDialog).toContainText('This will affect the conversation flow');

        await confirmDialog.locator('[data-testid="confirm-delete"]').click();
        await expect(message).not.toBeVisible();
    });

    // Flow 38: Quote and Reference Handling
    test('Flow 38: Quotes and references render with proper styling', async () => {
        await helpers.sendMessage('Quote something');
        await helpers.mockAIResponse(`> This is a blockquote from a source[^1]
    
[^1]: Source: Example Paper, 2024`);

        const blockquote = page.locator('blockquote');
        await expect(blockquote).toBeVisible();
        await expect(blockquote).toHaveCSS('border-left', /4px solid/);

        const footnote = page.locator('[data-testid="footnote-1"]');
        await expect(footnote).toBeVisible();
        await footnote.click();
        await expect(page.locator('[data-testid="reference-details"]')).toBeVisible();
    });

    // Flow 39: Emoji and Unicode Support
    test('Flow 39: Emojis and unicode render correctly', async () => {
        await helpers.sendMessage('Test emojis 😀 🚀 💻 and unicode ñ ü 中文');
        await helpers.waitForAIResponse();

        const message = page.locator('[data-testid="user-message"]').last();
        await expect(message).toContainText('😀');
        await expect(message).toContainText('🚀');
        await expect(message).toContainText('中文');

        const emojiPicker = await helpers.openEmojiPicker();
        await emojiPicker.selectEmoji('👍');
        await expect(page.locator('[data-testid="message-input"]')).toHaveValue('👍');
    });

    // Flow 40: Message Search Within Conversation
    test('Flow 40: Search finds and highlights messages', async () => {
        await helpers.generateConversation(['Hello world', 'Solana is fast', 'DeFi is growing']);

        await page.click('[data-testid="message-search-button"]');
        const searchBox = page.locator('[data-testid="message-search-input"]');
        await searchBox.fill('Solana');

        await expect(page.locator('[data-testid="search-result-count"]')).toHaveText('1 result');
        await expect(page.locator('.search-highlight')).toHaveText('Solana');

        await page.click('[data-testid="next-result"]');
        const highlightedMessage = page.locator('[data-testid="message"]:has(.search-highlight)');
        await expect(highlightedMessage).toBeInViewport();
    });

    // Flow 41: Export Message as Standalone
    test('Flow 41: Individual messages can be exported', async () => {
        await helpers.sendMessage('Important information to export');
        await helpers.waitForAIResponse();

        const message = page.locator('[data-testid="ai-message"]').last();
        await message.hover();
        await message.locator('[data-testid="export-button"]').click();

        const exportDialog = page.locator('[data-testid="export-dialog"]');
        await expect(exportDialog).toBeVisible();
        await exportDialog.locator('[data-testid="format-markdown"]').click();

        const download = await helpers.waitForDownload();
        expect(download.suggestedFilename()).toMatch(/message-\d+\.md/);
    });

    // Flow 42: Message Timestamp and Metadata
    test('Flow 42: Hovering shows detailed message metadata', async () => {
        await helpers.sendMessage('Test message');
        await helpers.waitForAIResponse();

        const message = page.locator('[data-testid="ai-message"]').last();
        await message.hover();

        const tooltip = page.locator('[data-testid="message-tooltip"]');
        await expect(tooltip).toBeVisible();
        await expect(tooltip.locator('[data-testid="timestamp"]')).toMatch(/\d{2}:\d{2}:\d{2}/);
        await expect(tooltip.locator('[data-testid="token-count"]')).toMatch(/\d+ tokens/);
        await expect(tooltip.locator('[data-testid="processing-time"]')).toMatch(/\d+ms/);
    });

    // Flow 43: Multi-language Content Support
    test('Flow 43: Multiple languages render correctly', async () => {
        await helpers.sendMessage('Translate to multiple languages');
        await helpers.mockAIResponse(`English: Hello
日本語: こんにちは
العربية: مرحبا
עברית: שלום`);

        const message = page.locator('[data-testid="ai-message"]').last();
        await expect(message).toContainText('Hello');
        await expect(message).toContainText('こんにちは');

        const arabicText = message.locator(':text("مرحبا")');
        await expect(arabicText).toHaveCSS('direction', 'rtl');

        const hebrewText = message.locator(':text("שלום")');
        await expect(hebrewText).toHaveCSS('direction', 'rtl');
    });

    // Flow 44: Streaming Response Display
    test('Flow 44: Streaming responses appear incrementally', async () => {
        await helpers.sendMessage('Generate a long response');

        const streamingMessage = page.locator('[data-testid="streaming-message"]');
        await expect(streamingMessage).toBeVisible();
        await expect(streamingMessage.locator('[data-testid="cursor"]')).toBeVisible();

        let previousLength = 0;
        for (let i = 0; i < 3; i++) {
            await page.waitForTimeout(500);
            const currentText = await streamingMessage.textContent();
            expect(currentText.length).toBeGreaterThan(previousLength);
            previousLength = currentText.length;
        }

        await expect(page.locator('[data-testid="stop-generation"]')).toBeVisible();
        await page.click('[data-testid="stop-generation"]');
        await expect(streamingMessage.locator('[data-testid="cursor"]')).not.toBeVisible();
    });

    // Flow 45: Message Reactions
    test('Flow 45: Users can add emoji reactions to messages', async () => {
        await helpers.sendMessage('React to this');
        await helpers.waitForAIResponse();

        const message = page.locator('[data-testid="ai-message"]').last();
        await message.hover();
        await message.locator('[data-testid="reaction-button"]').click();

        const reactionPicker = page.locator('[data-testid="reaction-picker"]');
        await reactionPicker.locator('[data-testid="emoji-👍"]').click();

        await expect(message.locator('[data-testid="reaction-👍"]')).toBeVisible();
        await expect(message.locator('[data-testid="reaction-count"]')).toHaveText('1');
    });

    // Flow 46: Message Bookmarking
    test('Flow 46: Messages can be bookmarked for quick access', async () => {
        await helpers.sendMessage('Important to bookmark');
        await helpers.waitForAIResponse();

        const message = page.locator('[data-testid="ai-message"]').last();
        await message.hover();
        await message.locator('[data-testid="bookmark-button"]').click();

        await expect(message.locator('[data-testid="bookmarked-indicator"]')).toBeVisible();

        await page.click('[data-testid="bookmarks-menu"]');
        const bookmarksList = page.locator('[data-testid="bookmarks-list"]');
        await expect(bookmarksList.locator('[data-testid="bookmark-item"]')).toHaveCount(1);

        await bookmarksList.locator('[data-testid="bookmark-item"]').first().click();
        await expect(message).toBeInViewport();
    });

    // Flow 47: Code Execution Display
    test('Flow 47: Executable code blocks show results', async () => {
        await helpers.sendMessage('Show me executable JavaScript');
        await helpers.mockAIResponse(`\`\`\`javascript
console.log("Hello World");
return 2 + 2;
\`\`\``);

        const codeBlock = page.locator('[data-testid="code-block"]');
        await expect(codeBlock.locator('[data-testid="run-button"]')).toBeVisible();

        await codeBlock.locator('[data-testid="run-button"]').click();

        const output = page.locator('[data-testid="code-output"]');
        await expect(output).toBeVisible();
        await expect(output).toContainText('Hello World');
        await expect(output).toContainText('4');
    });

    // Flow 48: Collaborative Features
    test('Flow 48: Multiple users see real-time updates', async () => {
        // Simulate second user
        const page2 = await helpers.openSecondBrowser();
        await page2.goto('/');
        await helpers.openSidebar(page2);
        await helpers.joinSharedSession(page2);

        await helpers.sendMessage('Message from user 1');

        // Check message appears for second user
        await expect(page2.locator('[data-testid="message"]').last()).toContainText('Message from user 1');

        // Show presence indicators
        await expect(page.locator('[data-testid="user-presence"]')).toHaveCount(2);
        await expect(page2.locator('[data-testid="user-presence"]')).toHaveCount(2);
    });

    // Flow 49: Message Performance Metrics
    test('Flow 49: Performance metrics display for messages', async () => {
        await helpers.sendMessage('Generate large response');
        await helpers.mockLargeAIResponse(5000); // 5000 tokens

        const message = page.locator('[data-testid="ai-message"]').last();
        await message.hover();
        await message.locator('[data-testid="metrics-button"]').click();

        const metricsPanel = page.locator('[data-testid="message-metrics"]');
        await expect(metricsPanel).toBeVisible();
        await expect(metricsPanel.locator('[data-testid="load-time"]')).toMatch(/\d+ms/);
        await expect(metricsPanel.locator('[data-testid="message-size"]')).toMatch(/\d+KB/);
        await expect(metricsPanel.locator('[data-testid="performance-warning"]')).toBeVisible();
        await expect(metricsPanel).toContainText('Consider summarizing for better performance');
    });
});
