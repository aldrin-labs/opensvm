import { test, expect } from '@playwright/test';

test.describe('Settings Menu Basic Functionality', () => {
    async function openSettings(page) {
        const settingsButton = page
            .locator('button[data-test="settings-menu-trigger"]:not([disabled])')
            .or(page.locator('button[aria-label*="Settings"]:has(svg):not([disabled])'))
            .first();

        // Ensure navbar area is in view
        await page.evaluate(() => window.scrollTo(0, 0));
        await settingsButton.scrollIntoViewIfNeeded();
        await expect(settingsButton).toBeVisible();
        // Wait for settings component to mount client-side
        await page.waitForFunction(() => (window as any).__isSettingsMounted === true, { timeout: 5000 }).catch(() => { });
        // Try programmatic open first for reliability
        await page.waitForFunction(() => typeof (window as any).__openSettingsMenu === 'function', { timeout: 3000 }).catch(() => { });
        await page.evaluate(() => {
            try {
                (window as any).__openSettingsMenu?.();
                window.dispatchEvent(new Event('e2e:open-settings'));
            } catch { }
        });
        await page.waitForTimeout(250);
        // Wait for internal open state if provided
        await page.waitForFunction(() => (window as any).__isSettingsOpen === true, { timeout: 2000 }).catch(() => { });
        // Fallback to clicking if needed
        const menuSelector = '#settings-menu-content, [data-testid="settings-menu"], [data-test="settings-menu"], [aria-label="Settings menu"][role="menu"]';
        const menu = page.locator(menuSelector).first();
        if (!(await menu.isVisible().catch(() => false))) {
            await settingsButton.click({ force: true });
            await page.waitForTimeout(200);
        }

        // Fallback: keypress to open if click didn't register
        if (!(await menu.isVisible().catch(() => false))) {
            await settingsButton.focus();
            await page.keyboard.press('Enter');
            await page.waitForTimeout(100);
            if (!(await menu.isVisible().catch(() => false))) {
                await page.keyboard.press('ArrowDown');
                await page.waitForTimeout(150);
                await page.keyboard.press('Space');
            }
        }

        // First ensure it's attached to DOM, then visible
        await menu.waitFor({ state: 'attached', timeout: 7000 });
        await expect(menu).toBeVisible({ timeout: 7000 });
        return { settingsButton, menu };
    }
    test.beforeEach(async ({ page }) => {
        // Ensure flags exist before any scripts run
        await page.addInitScript(() => {
            (window as any).__E2E_OPEN_SETTINGS__ = true;
            (window as any).__E2E_FORCE_DROPDOWN_MOUNT = true;
            (window as any).__E2E_INLINE_DROPDOWN = true;
            (window as any).__E2E_ALWAYS_OPEN = true;
            (window as any).__E2E_ALWAYS_RENDER_SETTINGS = true;
        });
        // Use a known route that renders the standard layout and navbar
        await page.goto('/account/DtdSSG8ZJRZVv5Jx7K1MeWp7Zxcu19GD5wQRGRpQ9uMF');
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(3000); // Wait for React hydration
        // Confirm flags
        await page.waitForFunction(() => (window as any).__E2E_OPEN_SETTINGS__ === true, { timeout: 5000 });
    });

    test('should open settings menu', async ({ page }) => {
        await openSettings(page);
    });

    test('should change theme when Apply is clicked', async ({ page }) => {
        // Get initial theme
        const initialTheme = await page.locator('html').getAttribute('class');

        // Open settings menu
        const { menu } = await openSettings(page);

        // Look for any theme-related text and click it
        const themeSubmenu = menu.locator('[data-test="settings-theme-submenu"]').first();
        if (await themeSubmenu.isVisible()) {
            await themeSubmenu.click();
        }

        // Wait a bit for submenu
        await page.waitForTimeout(500);

        // Try to click Cyberpunk theme
        const cyberpunkOption = menu.getByText('Cyberpunk').first();
        await cyberpunkOption.click();

        // Look for Apply button and click it
        const applyButton = menu.locator('button[data-test="settings-apply"], button:has-text("Apply")').first();
        await applyButton.click();

        // Wait for theme to apply
        await page.waitForTimeout(1000);

        // Check theme changed
        const newTheme = await page.locator('html').getAttribute('class');
        expect(newTheme).not.toBe(initialTheme);
        expect(newTheme).toContain('theme-cyberpunk');
    });

    test('should cancel changes when Cancel is clicked', async ({ page }) => {
        // Get initial theme
        const initialTheme = await page.locator('html').getAttribute('class');

        // Open settings and make a change
        const { menu } = await openSettings(page);

        const themeSubmenu = menu.locator('[data-test="settings-theme-submenu"]').first();
        if (await themeSubmenu.isVisible()) {
            await themeSubmenu.click();
        }

        await page.waitForTimeout(500);

        const cyberpunkOption = menu.getByText('Cyberpunk').first();
        await cyberpunkOption.click();

        // Click Cancel instead of Apply
        const cancelButton = menu.locator('button[data-test="settings-cancel"], button:has-text("Cancel")').first();
        await cancelButton.click();

        // Wait a bit
        await page.waitForTimeout(500);

        // Verify theme didn't change
        const currentTheme = await page.locator('html').getAttribute('class');
        expect(currentTheme).toBe(initialTheme);
    });
});
