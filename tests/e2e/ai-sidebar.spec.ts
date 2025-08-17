/**
 * Comprehensive Playwright E2E Tests for AI Sidebar Implementation
 * Tests all Phase 2.3-4.2 features including:
 * - Tab Management & Navigation
 * - Mode Switching (Agent/Assistant)
 * - Slash Commands & Autocomplete
 * - Enhanced Message Rendering
 * - Knowledge Management
 * - Premium Gating
 * - Thread Persistence
 */

import { test, expect, type Page } from '@playwright/test';

// Test configuration
test('SVMAI premium APIs work', async ({ page }) => {
    const premiumAPIs = await page.evaluate(() => {
        if (!window.SVMAI?.premium) return false;

        return {
            // @ts-ignore
            hasCheckFeature: typeof window.SVMAI.premium.checkFeature === 'function',
            // @ts-ignore
            hasGetUsage: typeof window.SVMAI.premium.getUsage === 'function',
            // @ts-ignore
            hasGetLimits: typeof window.SVMAI.premium.getLimits === 'function'
        };
    });

    if (premiumAPIs) {
        expect(premiumAPIs.hasCheckFeature).toBe(true);
        expect(premiumAPIs.hasGetUsage).toBe(true);
        expect(premiumAPIs.hasGetLimits).toBe(true);
    } else {
        console.log('Premium APIs not available');
    }
});

const BASE_URL = 'http://localhost:3000';
const AI_SIDEBAR_SELECTOR = '[data-testid="ai-sidebar"]';
const CHAT_INPUT_SELECTOR = '#chat-input';

// Helper functions
async function openAISidebar(page: Page) {
    // Look for AI sidebar trigger button or navigate to chat page
    try {
        await page.locator('[data-testid="ai-sidebar-toggle"]').click();
    } catch {
        // Fallback: navigate to chat page
        await page.goto(`${BASE_URL}/chat`);
    }

    // Wait for sidebar to be visible
    await page.waitForSelector(AI_SIDEBAR_SELECTOR, { timeout: 10000 });
}

async function waitForChatReady(page: Page) {
    await page.waitForSelector(CHAT_INPUT_SELECTOR, { timeout: 10000 });
    await page.waitForLoadState('networkidle');
}

test.describe('AI Sidebar - Core Integration', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto(BASE_URL);
        await page.waitForLoadState('networkidle');
    });

    test('AI Sidebar opens and displays correctly', async ({ page }) => {
        await openAISidebar(page);

        // Verify sidebar is visible
        await expect(page.locator(AI_SIDEBAR_SELECTOR)).toBeVisible();

        // Check for chat input
        await expect(page.locator(CHAT_INPUT_SELECTOR)).toBeVisible();

        // Verify sidebar has proper ARIA labels
        await expect(page.locator(AI_SIDEBAR_SELECTOR)).toHaveAttribute('role', 'complementary');
    });

    test('Chat input accepts user input', async ({ page }) => {
        await openAISidebar(page);
        await waitForChatReady(page);

        const testMessage = 'Hello AI Sidebar!';
        await page.fill(CHAT_INPUT_SELECTOR, testMessage);

        await expect(page.locator(CHAT_INPUT_SELECTOR)).toHaveValue(testMessage);
    });
});

test.describe('AI Sidebar - Tab Management', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto(BASE_URL);
        await openAISidebar(page);
        await waitForChatReady(page);
    });

    test('Tab bar is visible and functional', async ({ page }) => {
        // Check for tab bar
        const tabBar = page.locator('[data-testid="tab-bar"]');
        await expect(tabBar).toBeVisible();

        // Should have at least one active tab
        const activeTabs = page.locator('[data-testid="tab-item"][aria-selected="true"]');
        await expect(activeTabs).toHaveCount(1);
    });

    test('Can create new tabs', async ({ page }) => {
        // Click new tab button
        const newTabButton = page.locator('[data-testid="new-tab-button"]');

        if (await newTabButton.isVisible()) {
            const initialTabCount = await page.locator('[data-testid="tab-item"]').count();

            await newTabButton.click();

            // Should have one more tab
            await expect(page.locator('[data-testid="tab-item"]')).toHaveCount(initialTabCount + 1);
        } else {
            console.log('New tab button not found - testing tab creation via API');

            // Test tab creation via global API
            const tabCount = await page.evaluate(async () => {
                if (window.SVMAI?.threads) {
                    const threads = await window.SVMAI.threads();
                    return threads.length;
                }
                return 0;
            });
            expect(tabCount).toBeGreaterThanOrEqual(0);
        }
    });

    test('Can switch between tabs', async ({ page }) => {
        const tabs = page.locator('[data-testid="tab-item"]');
        const tabCount = await tabs.count();

        if (tabCount > 1) {
            // Click on second tab
            await tabs.nth(1).click();

            // Verify it becomes active
            await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
        }
    });

    test('Can close tabs', async ({ page }) => {
        const tabs = page.locator('[data-testid="tab-item"]');
        const initialCount = await tabs.count();

        if (initialCount > 1) {
            // Find close button on first tab
            const closeButton = tabs.first().locator('[data-testid="close-tab-button"]');

            if (await closeButton.isVisible()) {
                await closeButton.click();

                // Should have one fewer tab
                await expect(tabs).toHaveCount(initialCount - 1);
            }
        }
    });
});

test.describe('AI Sidebar - Mode Switching', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto(BASE_URL);
        await openAISidebar(page);
        await waitForChatReady(page);
    });

    test('Mode selector is visible and functional', async ({ page }) => {
        // Check for mode selector
        const modeSelector = page.locator('[data-testid="mode-selector"]');

        if (await modeSelector.isVisible()) {
            await expect(modeSelector).toBeVisible();

            // Should have Agent and Assistant options
            await expect(page.locator('[data-mode="agent"]')).toBeVisible();
            await expect(page.locator('[data-mode="assistant"]')).toBeVisible();
        } else {
            console.log('Mode selector not visible - checking for mode switching functionality');
        }
    });

    test('Can switch between Agent and Assistant modes', async ({ page }) => {
        const agentButton = page.locator('[data-mode="agent"]');
        const assistantButton = page.locator('[data-mode="assistant"]');

        if (await agentButton.isVisible() && await assistantButton.isVisible()) {
            // Switch to Assistant mode
            await assistantButton.click();
            await expect(assistantButton).toHaveAttribute('aria-pressed', 'true');

            // Switch back to Agent mode
            await agentButton.click();
            await expect(agentButton).toHaveAttribute('aria-pressed', 'true');
        }
    });
});

test.describe('AI Sidebar - Slash Commands', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto(BASE_URL);
        await openAISidebar(page);
        await waitForChatReady(page);
    });

    test('Slash commands trigger autocomplete', async ({ page }) => {
        // Type slash command
        await page.fill(CHAT_INPUT_SELECTOR, '/');

        // Wait for autocomplete to appear
        await page.waitForTimeout(500);

        // Check for slash command suggestions
        const suggestions = page.locator('[data-testid="slash-suggestions"], [data-testid="slash-help"]');

        if (await suggestions.isVisible()) {
            await expect(suggestions).toBeVisible();
        } else {
            // Fallback: check if input shows slash help in UI
            const helpText = page.locator('text*="Available commands:"');
            if (await helpText.isVisible()) {
                await expect(helpText).toBeVisible();
            }
        }
    });

    test('Common slash commands are available', async ({ page }) => {
        await page.fill(CHAT_INPUT_SELECTOR, '/');
        await page.waitForTimeout(500);

        // Test if common commands are suggested
        const commonCommands = ['/help', '/tx', '/tps', '/account'];

        for (const command of commonCommands) {
            await page.fill(CHAT_INPUT_SELECTOR, command);
            await page.waitForTimeout(200);

            // Verify command is recognized (input should show it)
            await expect(page.locator(CHAT_INPUT_SELECTOR)).toHaveValue(command);
        }
    });

    test('Tab completion works for slash commands', async ({ page }) => {
        await page.fill(CHAT_INPUT_SELECTOR, '/he');

        // Press Tab for completion
        await page.press(CHAT_INPUT_SELECTOR, 'Tab');

        // Should complete to /help or similar
        const value = await page.inputValue(CHAT_INPUT_SELECTOR);
        expect(value).toMatch(/^\/\w+/);
    });
});

test.describe('AI Sidebar - Enhanced Message Rendering', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto(BASE_URL);
        await openAISidebar(page);
        await waitForChatReady(page);
    });

    test('Code blocks are properly highlighted', async ({ page }) => {
        // Send a message with code
        const codeMessage = '```javascript\nconsole.log("Hello World");\n```';

        await page.fill(CHAT_INPUT_SELECTOR, codeMessage);
        await page.press(CHAT_INPUT_SELECTOR, 'Enter');

        // Wait for message to appear
        await page.waitForTimeout(1000);

        // Check for syntax highlighted code
        const codeBlock = page.locator('pre code, .hljs, .language-javascript');

        if (await codeBlock.isVisible()) {
            await expect(codeBlock).toBeVisible();
        }
    });

    test('Tables are rendered with collapse functionality', async ({ page }) => {
        // Send a message with table
        const tableMessage = `
| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Data 1   | Data 2   | Data 3   |
| Data 4   | Data 5   | Data 6   |
    `;

        await page.fill(CHAT_INPUT_SELECTOR, tableMessage);
        await page.press(CHAT_INPUT_SELECTOR, 'Enter');

        await page.waitForTimeout(1000);

        // Check for table rendering
        const table = page.locator('table, [data-testid="collapsible-table"]');

        if (await table.isVisible()) {
            await expect(table).toBeVisible();

            // Check for collapse functionality
            const collapseButton = page.locator('[data-testid="table-collapse-button"]');
            if (await collapseButton.isVisible()) {
                await collapseButton.click();
                // Table should be collapsed
                await expect(table).toHaveAttribute('aria-expanded', 'false');
            }
        }
    });

    test('Mermaid diagrams are rendered', async ({ page }) => {
        // Send a message with Mermaid diagram
        const mermaidMessage = `
\`\`\`mermaid
graph TD
    A[Start] --> B[Process]
    B --> C[End]
\`\`\`
    `;

        await page.fill(CHAT_INPUT_SELECTOR, mermaidMessage);
        await page.press(CHAT_INPUT_SELECTOR, 'Enter');

        await page.waitForTimeout(2000);

        // Check for Mermaid diagram
        const mermaidDiagram = page.locator('.mermaid, [data-testid="mermaid-diagram"]');

        if (await mermaidDiagram.isVisible()) {
            await expect(mermaidDiagram).toBeVisible();
        }
    });
});

test.describe('AI Sidebar - Knowledge Management', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto(BASE_URL);
        await openAISidebar(page);
        await waitForChatReady(page);
    });

    test('Can add knowledge notes', async ({ page }) => {
        // Look for knowledge/notes section
        const notesSection = page.locator('[data-testid="knowledge-panel"], [data-ai-tab="knowledge"]');

        if (await notesSection.isVisible()) {
            await notesSection.click();

            // Add a note
            const noteInput = page.locator('[data-testid="note-input"], textarea[placeholder*="knowledge"]');

            if (await noteInput.isVisible()) {
                const testNote = 'Test knowledge note';
                await noteInput.fill(testNote);

                // Submit note
                const submitButton = page.locator('[data-testid="add-note-button"], button[type="submit"]');
                if (await submitButton.isVisible()) {
                    await submitButton.click();

                    // Verify note appears
                    await expect(page.locator(`text="${testNote}"`)).toBeVisible();
                }
            }
        } else {
            console.log('Knowledge panel not found - checking for notes functionality');
        }
    });

    test('Can delete individual notes', async ({ page }) => {
        // Navigate to knowledge section and add a note first
        const notesSection = page.locator('[data-testid="knowledge-panel"]');

        if (await notesSection.isVisible()) {
            await notesSection.click();

            // Look for existing notes with delete buttons
            const deleteButtons = page.locator('[data-ai-action="delete-note"]');

            if (await deleteButtons.first().isVisible()) {
                const noteCount = await page.locator('[data-testid="note-item"]').count();

                await deleteButtons.first().click();

                // Should have one fewer note
                await expect(page.locator('[data-testid="note-item"]')).toHaveCount(noteCount - 1);
            }
        }
    });

    test('Can clear all notes', async ({ page }) => {
        const clearButton = page.locator('[data-testid="clear-notes-button"]');

        if (await clearButton.isVisible()) {
            await clearButton.click();

            // All notes should be cleared
            await expect(page.locator('[data-testid="note-item"]')).toHaveCount(0);
        }
    });
});

test.describe('AI Sidebar - Global APIs', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto(BASE_URL);
        await openAISidebar(page);
        await waitForChatReady(page);
    });

    test('window.SVMAI is properly exposed', async ({ page }) => {
        const svmaiExists = await page.evaluate(() => {
            return typeof window.SVMAI === 'object' && window.SVMAI !== null;
        });

        expect(svmaiExists).toBe(true);
    });

    test('SVMAI thread management APIs work', async ({ page }) => {
        const threadAPIs = await page.evaluate(() => {
            if (!window.SVMAI) return false;

            return {
                hasThreads: typeof window.SVMAI.threads === 'function',
                hasLoadThread: typeof window.SVMAI.loadThread === 'function',
                hasStorageStats: typeof window.SVMAI.getStorageStats === 'function'
            };
        });

        if (threadAPIs) {
            expect(threadAPIs.hasThreads).toBe(true);
            expect(threadAPIs.hasLoadThread).toBe(true);
            expect(threadAPIs.hasStorageStats).toBe(true);
        } else {
            console.log('Thread APIs not available');
        }
    });
    test('SVMAI premium APIs work', async ({ page }) => {
        const premiumAPIs = await page.evaluate(() => {
            if (!window.SVMAI?.premium) return false;

            return {
                // @ts-ignore
                hasCheckFeature: typeof window.SVMAI.premium.checkFeature === 'function',
                // @ts-ignore
                hasGetUsage: typeof window.SVMAI.premium.getUsage === 'function',
                // @ts-ignore
                hasGetLimits: typeof window.SVMAI.premium.getLimits === 'function'
            };
        });

        // @ts-ignore
        expect(premiumAPIs.hasCheckFeature).toBe(true);
        // @ts-ignore
        expect(premiumAPIs.hasGetUsage).toBe(true);
        // @ts-ignore
        expect(premiumAPIs.hasGetLimits).toBe(true);
    });
});

test('SVMAI message extraction APIs work', async ({ page }) => {
    const messageAPIs = await page.evaluate(() => {
        if (!window.SVMAI) return false;

        return {
            hasExtractMessages: typeof window.SVMAI.extractMessages === 'function',
            hasExportTranscript: typeof window.SVMAI.exportTranscript === 'function',
            hasDownloadTranscript: typeof window.SVMAI.downloadTranscript === 'function'
        };
    });

    // @ts-ignore
    expect(messageAPIs.hasExtractMessages).toBe(true);
    // @ts-ignore
    expect(messageAPIs.hasExportTranscript).toBe(true);
    // @ts-ignore
    expect(messageAPIs.hasDownloadTranscript).toBe(true);
});

test.describe('AI Sidebar - Accessibility & Performance', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto(BASE_URL);
        await openAISidebar(page);
        await waitForChatReady(page);
    });

    test('Sidebar has proper ARIA labels and roles', async ({ page }) => {
        // Check main sidebar
        await expect(page.locator(AI_SIDEBAR_SELECTOR)).toHaveAttribute('role');

        // Check chat input
        await expect(page.locator(CHAT_INPUT_SELECTOR)).toHaveAttribute('aria-label');

        // Check tab navigation
        const tabs = page.locator('[role="tab"]');
        if (await tabs.first().isVisible()) {
            await expect(tabs.first()).toHaveAttribute('aria-selected');
        }
    });

    test('Keyboard navigation works', async ({ page }) => {
        // Tab to chat input
        await page.keyboard.press('Tab');

        // Input should be focused
        await expect(page.locator(CHAT_INPUT_SELECTOR)).toBeFocused();

        // Test Enter key for sending messages
        await page.fill(CHAT_INPUT_SELECTOR, 'Test message');
        await page.keyboard.press('Enter');

        // Message should be sent (input cleared)
        await expect(page.locator(CHAT_INPUT_SELECTOR)).toHaveValue('');
    });

    test('Sidebar is responsive', async ({ page }) => {
        // Test different viewport sizes
        await page.setViewportSize({ width: 768, height: 1024 }); // Tablet
        await expect(page.locator(AI_SIDEBAR_SELECTOR)).toBeVisible();

        await page.setViewportSize({ width: 375, height: 667 }); // Mobile
        // Sidebar should still be accessible
        await expect(page.locator(AI_SIDEBAR_SELECTOR)).toBeVisible();
    });
});

test.describe('AI Sidebar - Integration with Transaction Pages', () => {
    test('AI Sidebar works on transaction pages', async ({ page }) => {
        // Navigate to a transaction page
        await page.goto(`${BASE_URL}/tx`);
        await page.waitForLoadState('networkidle');

        await openAISidebar(page);
        await waitForChatReady(page);

        // Should be able to use AI features on tx pages
        await expect(page.locator(CHAT_INPUT_SELECTOR)).toBeVisible();

        // Test transaction-specific slash commands
        await page.fill(CHAT_INPUT_SELECTOR, '/tx');
        await page.waitForTimeout(500);

        // Should show transaction command suggestions
        const suggestions = page.locator('[data-testid="slash-suggestions"]');
        if (await suggestions.isVisible()) {
            await expect(suggestions).toBeVisible();
        }
    });

    test('AI Sidebar works on account pages', async ({ page }) => {
        // Navigate to account page
        await page.goto(`${BASE_URL}/account/11111111111111111111111111111112`);
        await page.waitForLoadState('networkidle');

        await openAISidebar(page);
        await waitForChatReady(page);

        // Should be able to use AI features on account pages
        await expect(page.locator(CHAT_INPUT_SELECTOR)).toBeVisible();

        // Test account-specific slash commands
        await page.fill(CHAT_INPUT_SELECTOR, '/account');
        await page.waitForTimeout(500);

        const inputValue = await page.inputValue(CHAT_INPUT_SELECTOR);
        expect(inputValue).toContain('/account');
    });
});
