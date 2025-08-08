import { test, expect } from '@playwright/test';

test.describe('Settings Menu E2E Test', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(3000); // Wait for React hydration
    });

    test('Settings menu basic functionality - open/close/theme change', async ({ page }) => {
        // Step 1: Find and click settings button
        const settingsButton = page.locator('button:has(svg:has(circle[cx="12"][cy="12"][r="3"]))').first();
        await expect(settingsButton).toBeVisible();
        await settingsButton.click();

        // Step 2: Verify menu opened
        await expect(page.locator('text="Settings"')).toBeVisible();

        // Step 3: Get current theme
        const initialTheme = await page.locator('html').getAttribute('class');

        // Step 4: Open theme submenu
        const themeSubmenu = page.locator('text=/Theme:.*/', { hasText: 'Theme:' }).first();
        await themeSubmenu.click();
        await page.waitForTimeout(500);

        // Step 5: Select Cyberpunk theme
        const cyberpunkTheme = page.locator('text="Cyberpunk"');
        await expect(cyberpunkTheme).toBeVisible();
        await cyberpunkTheme.click();

        // Step 6: Apply changes
        const applyButton = page.locator('button:has-text("Apply")');
        await expect(applyButton).toBeVisible();
        await applyButton.click();

        // Step 7: Verify theme changed
        await page.waitForTimeout(1000);
        const newTheme = await page.locator('html').getAttribute('class');
        expect(newTheme).toContain('theme-cyberpunk');
        expect(newTheme).not.toBe(initialTheme);

        // Step 8: Close menu by pressing Escape
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
        await expect(page.locator('text="Settings"')).not.toBeVisible();
    });

    test('Settings menu cancel functionality', async ({ page }) => {
        // Get initial theme
        const initialTheme = await page.locator('html').getAttribute('class');

        // Open settings and change theme
        const settingsButton = page.locator('button:has(svg:has(circle[cx="12"][cy="12"][r="3"]))').first();
        await settingsButton.click();
        await expect(page.locator('text="Settings"')).toBeVisible();

        const themeSubmenu = page.locator('text=/Theme:.*/', { hasText: 'Theme:' }).first();
        await themeSubmenu.click();
        await page.waitForTimeout(500);

        const solarizedTheme = page.locator('text="Solarized"');
        await solarizedTheme.click();

        // Cancel instead of apply
        const cancelButton = page.locator('button:has-text("Cancel")');
        await expect(cancelButton).toBeVisible();
        await cancelButton.click();

        // Verify theme didn't change
        await page.waitForTimeout(500);
        const currentTheme = await page.locator('html').getAttribute('class');
        expect(currentTheme).toBe(initialTheme);
    });

    test('Settings theme change is immediately applied', async ({ page }) => {
        // Open settings and change theme to verify immediate application
        const settingsButton = page.locator('button:has(svg:has(circle[cx="12"][cy="12"][r="3"]))').first();
        await settingsButton.click();

        const themeSubmenu = page.locator('text=/Theme:.*/', { hasText: 'Theme:' }).first();
        await themeSubmenu.click();
        await page.waitForTimeout(500);

        // Try a different theme
        const highContrastTheme = page.locator('text="High Contrast"');
        await highContrastTheme.click();

        const applyButton = page.locator('button:has-text("Apply")');
        await applyButton.click();

        await page.waitForTimeout(1000);
        const themeAfterChange = await page.locator('html').getAttribute('class');
        expect(themeAfterChange).toContain('theme-high-contrast');

        // Verify localStorage has the setting (for persistence verification)
        const savedSettings = await page.evaluate(() => {
            return localStorage.getItem('settings');
        });
        expect(savedSettings).toBeTruthy();
        const parsedSettings = JSON.parse(savedSettings!);
        expect(parsedSettings.theme).toBe('high-contrast');
    });

    test('Settings menu displays theme options', async ({ page }) => {
        const settingsButton = page.locator('button:has(svg:has(circle[cx="12"][cy="12"][r="3"]))').first();
        await settingsButton.click();
        await expect(page.locator('text="Settings"')).toBeVisible();

        // Check theme options
        const themeSubmenu = page.locator('text=/Theme:.*/', { hasText: 'Theme:' }).first();
        await expect(themeSubmenu).toBeVisible();
        await themeSubmenu.click();
        await page.waitForTimeout(500);

        // Verify all expected themes are available
        const expectedThemes = ['Paper', 'Cyberpunk', 'Solarized', 'High Contrast'];
        for (const theme of expectedThemes) {
            await expect(page.locator(`text="${theme}"`)).toBeVisible();
        }

        // Check that apply and cancel buttons are visible
        await expect(page.locator('button:has-text("Apply")')).toBeVisible();
        await expect(page.locator('button:has-text("Cancel")')).toBeVisible();

        // Close menu
        await page.keyboard.press('Escape');
    });
});