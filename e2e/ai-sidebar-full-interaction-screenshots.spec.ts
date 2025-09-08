import { test, expect, Page } from '@playwright/test';

// Captures a screenshot BEFORE every click interaction to document pre-click state.
// Output directory: screenshots/ai-sidebar/full/
// Run via: npx playwright test e2e/ai-sidebar-full-interaction-screenshots.spec.ts

const shot = async (page: Page, name: string) => {
    try {
        await page.screenshot({ path: `screenshots/ai-sidebar/full/${Date.now()}-${name}.png`, fullPage: true });
    } catch (error) {
        console.log(`Screenshot failed for ${name}:`, error.message);
        // Continue test execution even if screenshot fails
    }
};

async function openMoreMenu(page: Page, shotFn: (page: Page, filename: string) => Promise<void>, labelSuffix: string) {
    const moreButton = page.locator('button[data-testid="ai-chat-more-button"]');
    await moreButton.click();
    const menu = page.locator('[role="menu"][aria-label="More options menu"]');

    // Wait for menu to be visible instead of checking aria-hidden (menu uses hidden attribute)
    for (let i = 0; i < 3; i++) {
        await page.waitForTimeout(100);
        await menu.waitFor({ state: 'attached' });
        const isVisible = await menu.isVisible();
        if (isVisible) {
            await shotFn(page, `${labelSuffix}-after-more-open`);
            return;
        }
    }
    // Final assert to fail fast with context if still closed
    await expect(menu).toBeVisible();
}

test.describe('AI Sidebar - full interaction pre-click screenshots', () => {
    test('document pre-click states through a typical user session', async ({ page }) => {
        await page.setViewportSize({ width: 1600, height: 1000 });
        await page.goto('/?ai=1&aimock=1');

        // Wait for page to load - use domcontentloaded instead of networkidle
        // to avoid timeout with continuous network activity
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(2000); // Additional wait for React hydration

        // Open programmatically for determinism
        try {
            await page.evaluate(() => {
                const w = window as any;
                if (w.SVMAI && typeof w.SVMAI.open === 'function') {
                    w.SVMAI.open();
                } else {
                    console.log('SVMAI API not available, trying to find sidebar manually');
                }
            });
        } catch (error) {
            console.log('SVMAI API not available');
        }
        
        // Wait for sidebar to be visible with multiple selector strategies
        let sidebar;
        try {
            sidebar = page.locator('[data-ai-sidebar]');
            await expect(sidebar).toBeVisible({ timeout: 10000 });
        } catch (error) {
            console.log('Primary sidebar selector failed, trying alternatives');
            try {
                sidebar = page.locator('[data-ai-sidebar-root]');
                await expect(sidebar).toBeVisible({ timeout: 5000 });
            } catch (error2) {
                try {
                    sidebar = page.locator('.ai-sidebar');
                    await expect(sidebar).toBeVisible({ timeout: 5000 });
                } catch (error3) {
                    sidebar = page.locator('[role="complementary"]');
                    await expect(sidebar).toBeVisible({ timeout: 5000 });
                }
            }
        }
        
        if (!sidebar) {
            throw new Error('Could not find sidebar with any selector');
        }
        
        await shot(page, '01-opened');

        // Try to hover resize handle if it exists
        try {
            const handle = sidebar.getByRole('separator', { name: 'Resize sidebar' });
            await handle.hover();
            await page.waitForTimeout(120);
            await shot(page, '02-before-resize-drag');

            // Perform a drag resize (no click screenshot needed after drag start - capturing pre state only)
            const box = await handle.boundingBox();
            if (box) {
                const startX = box.x + box.width / 2 + 2;
                const startY = box.y + box.height / 2;
                await page.mouse.move(startX, startY);
                await page.mouse.down();
                await page.mouse.move(startX - 180, startY, { steps: 6 });
                await page.mouse.up();
            }
            await page.waitForTimeout(200);
            await shot(page, '03-after-resize');
        } catch (error) {
            console.log('Resize handle not found, skipping resize test');
            await shot(page, '03-resize-skipped');
        }

        // Expand button
        const expandBtn = sidebar.getByRole('button', { name: /Expand sidebar|Collapse sidebar/ });
        await shot(page, '04-before-expand-click');
        await expandBtn.click();
        await page.waitForTimeout(250);
        await shot(page, '05-after-expand');

        // Open More menu (robust helper)
        await openMoreMenu(page, shot, '06-menu');

        // Open Tokens panel (Settings) - simplified approach
        // Wait for the menu to be fully open first
        await page.waitForTimeout(500);
        
        // Try to find a settings or tokens button in the menu
        const settingsBtn = page.locator('[data-testid="nav-dropdown-tokens"], [role="menuitem"]:has-text("Settings"), button:has-text("Settings")').first();
        
        if (await settingsBtn.isVisible()) {
            try {
                await shot(page, '08-before-tokens-click');
                await settingsBtn.click();
                await page.waitForTimeout(100);
                await shot(page, '09-after-tokens-open');
            } catch (error) {
                console.log('Failed to click settings button:', error.message);
                await shot(page, '08-tokens-menu-skipped');
            }
        } else {
            console.log('Settings menu item not found, skipping token panel test');
            await shot(page, '08-tokens-menu-skipped');
        }

        // Close settings modal explicitly via its Cancel button (overlay blocks clicks otherwise)
        const cancelBtn = page.getByRole('button', { name: /^Cancel$/ });
        if (await cancelBtn.isVisible()) {
            await shot(page, '10-before-settings-cancel');
            await cancelBtn.click();
            await page.waitForTimeout(120);
        }
        await shot(page, '11-after-settings-close');

        // New Chat (re-open More menu if necessary)
        // New Chat: header button is visible on >= sm screens; otherwise in More menu
        const headerNewChat = sidebar.getByRole('button', { name: /Start new chat/i });
        if (await headerNewChat.isVisible()) {
            await shot(page, '12-before-newchat-click-header');
            await headerNewChat.click();
            await page.waitForTimeout(160);
            await shot(page, '13-after-newchat-header');
        } else {
            await openMoreMenu(page, shot, '12-menu-reopen');
            const helpMenuItem = page.getByRole('menuitem', { name: /Help/ });
            await shot(page, '14-before-help-click-menu');
            await helpMenuItem.click();
            await page.waitForTimeout(180);
            await shot(page, '15-after-help-menu');
        }

        // Send a couple of messages
        const input = page.locator('[data-ai-chat-input], #chat-input');
        await input.fill('First test message');
        await shot(page, '16-before-first-send');
        await input.press('Enter');
        await page.waitForTimeout(300);
        await shot(page, '17-after-first-send');

        await input.fill('Second test message with /help');
        await shot(page, '18-before-second-send');
        await input.press('Enter');
        await page.waitForTimeout(300);
        await shot(page, '19-after-second-send');

        // Collapse sidebar
        const collapseBtn = page.getByRole('button', { name: /Collapse sidebar/ });
        await shot(page, '20-before-collapse-click');
        await collapseBtn.click();
        await page.waitForTimeout(250);
        await shot(page, '21-after-collapse');

        // Close sidebar
        const closeBtn = sidebar.getByRole('button', { name: 'Close sidebar' });
        await shot(page, '22-before-close-click');
        await closeBtn.click();
        await page.waitForTimeout(250);
        await shot(page, '23-after-close');
    });
});
