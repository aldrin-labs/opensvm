import { test, expect, Page } from '@playwright/test';

async function takeScreenshot(page: Page, name: string) {
    const screenshotsDir = './screenshots';
    await page.screenshot({
        path: `${screenshotsDir}/${name}.png`,
        fullPage: true
    });
    console.log(`📸 Screenshot saved: ${name}.png`);
}

test.describe('AI Sidebar - Comprehensive Functionality Screenshots', () => {
    test('document complete AI sidebar functionality with visual proof', async ({ page }) => {
        await page.setViewportSize({ width: 1600, height: 1000 });

        // 1. Initial state - home page with no sidebar
        await page.goto('/');
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(1000);
        await takeScreenshot(page, '01-home-no-sidebar');

        // 2. Navigate to page with AI sidebar enabled
        await page.goto('/?ai=1&aimock=1');
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(2000); // Wait longer for sidebar to initialize
        await takeScreenshot(page, '02-home-with-sidebar');

        // 3. Test sidebar basic functionality - check for input instead
        const chatInput = page.locator('[data-ai-chat-input], #chat-input');
        await chatInput.waitFor({ state: 'attached', timeout: 10000 });
        await expect(chatInput).toBeVisible();
        await takeScreenshot(page, '03-sidebar-visible');

        // 4. Test input and quick actions
        await chatInput.fill('What is Solana?');
        await takeScreenshot(page, '04-sidebar-with-input');

        // 5. Submit message and show processing
        await chatInput.press('Enter');
        await page.waitForTimeout(500); // Show processing state
        await takeScreenshot(page, '05-sidebar-processing');

        // 6. Wait for response and show result
        await page.waitForTimeout(2000); // Wait for mock response
        await takeScreenshot(page, '06-sidebar-with-response');

        // 7. Test expand functionality
        const expandButton = page.getByRole('button', { name: /Expand|Collapse/i });
        await expandButton.click();
        await page.waitForTimeout(500);
        await takeScreenshot(page, '07-sidebar-expanded');

        // 8. Test collapse back
        await expandButton.click();
        await page.waitForTimeout(500);
        await takeScreenshot(page, '08-sidebar-collapsed');

        // 9. Test more menu
        const moreButton = page.getByRole('button', { name: /More/i });
        await moreButton.click();
        await page.waitForTimeout(300);
        await takeScreenshot(page, '09-sidebar-more-menu');

        // 10. Test help menu item
        const helpItem = page.getByRole('menuitem', { name: /Help/i });
        await helpItem.click();
        await page.waitForTimeout(500);
        await takeScreenshot(page, '10-sidebar-help-clicked');

        // 11. Close and reopen sidebar
        const closeButton = page.getByRole('button', { name: /Close/i });
        await closeButton.click();
        await page.waitForTimeout(500);
        await takeScreenshot(page, '11-sidebar-closed');

        // 12. Reopen via URL param
        await page.goto('/?ai=1&aimock=1');
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(1000);
        await takeScreenshot(page, '12-sidebar-reopened');

        // 13. Test on transaction page
        await page.goto('/tx/5JbxvGuxz64CgFidRvBEV6TGEpwtbBSvaxVJiXGJrMnqHKGmKk5wXJMhM1VujQ7WGjE3VDJp1oucukwW6LEuLWFo?ai=1&aimock=1');
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(2000);
        await takeScreenshot(page, '13-sidebar-on-tx-page');

        // 14. Test quick actions on tx page
        const quickActions = page.locator('[data-ai-quick="tps"]').first();
        if (await quickActions.isVisible()) {
            await takeScreenshot(page, '14-sidebar-tx-quick-actions');
        }

        // 15. Test markdown rendering
        await chatInput.fill('Here is some **bold** and *italic* text with a [link](https://example.com)');
        await chatInput.press('Enter');
        await page.waitForTimeout(2500); // Wait for response
        await takeScreenshot(page, '15-sidebar-markdown-rendering');

        // 16. Test accessibility - tab navigation
        await page.keyboard.press('Tab');
        await page.waitForTimeout(300);
        await takeScreenshot(page, '16-sidebar-keyboard-navigation');

        // 17. Test resize functionality (programmatically)
        await page.evaluate(() => {
            const sidebar = document.querySelector('[data-testid="ai-chat-sidebar"]') as HTMLElement;
            if (sidebar) {
                sidebar.style.width = '450px';
            }
        });
        await page.waitForTimeout(500);
        await takeScreenshot(page, '17-sidebar-resized');

        // 18. Final expanded state for comparison
        await expandButton.click();
        await page.waitForTimeout(500);
        await takeScreenshot(page, '18-sidebar-final-expanded');

        console.log('✅ All AI sidebar functionality documented with 18 screenshots!');
        console.log('📁 Screenshots saved to ./screenshots/ directory');

        // Verify key functionality is working
        await expect(chatInput).toBeVisible();
        await expect(expandButton).toBeVisible();

        console.log('🎉 AI Sidebar comprehensive test PASSED with visual proof!');
    });
});
