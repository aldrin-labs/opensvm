import { test, expect } from '@playwright/test';

test.describe('Settings Menu Basic Functionality', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(3000); // Wait for React hydration
    });

    test('should open settings menu', async ({ page }) => {
        // Find settings button by the specific SVG with settings icon
        const settingsButton = page.locator('button:has(svg:has(circle[cx="12"][cy="12"][r="3"]))').first();

        // Verify button exists and is visible
        await expect(settingsButton).toBeVisible();

        // Click to open menu
        await settingsButton.click();

        // Check for "Settings" text to confirm menu opened
        await expect(page.locator('text="Settings"')).toBeVisible({ timeout: 5000 });
    });

    test('should change theme when Apply is clicked', async ({ page }) => {
        // Get initial theme
        const initialTheme = await page.locator('html').getAttribute('class');

        // Open settings menu
        const settingsButton = page.locator('button:has(svg:has(circle[cx="12"][cy="12"][r="3"]))').first();
        await settingsButton.click();

        // Wait for menu to open
        await expect(page.locator('text="Settings"')).toBeVisible();

        // Look for any theme-related text and click it
        const themeSubmenu = page.locator('text=/Theme:.*/', { hasText: 'Theme:' }).first();
        await themeSubmenu.click();

        // Wait a bit for submenu
        await page.waitForTimeout(500);

        // Try to click Cyberpunk theme
        const cyberpunkOption = page.locator('text="Cyberpunk"');
        await cyberpunkOption.click();

        // Look for Apply button and click it
        const applyButton = page.locator('button:has-text("Apply")');
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
        const settingsButton = page.locator('button:has(svg:has(circle[cx="12"][cy="12"][r="3"]))').first();
        await settingsButton.click();

        await expect(page.locator('text="Settings"')).toBeVisible();

        const themeSubmenu = page.locator('text=/Theme:.*/', { hasText: 'Theme:' }).first();
        await themeSubmenu.click();

        await page.waitForTimeout(500);

        const cyberpunkOption = page.locator('text="Cyberpunk"');
        await cyberpunkOption.click();

        // Click Cancel instead of Apply
        const cancelButton = page.locator('button:has-text("Cancel")');
        await cancelButton.click();

        // Wait a bit
        await page.waitForTimeout(500);

        // Verify theme didn't change
        const currentTheme = await page.locator('html').getAttribute('class');
        expect(currentTheme).toBe(initialTheme);
    });
});
