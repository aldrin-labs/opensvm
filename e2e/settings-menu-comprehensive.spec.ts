import { test, expect } from '@playwright/test';

test.describe('Settings Menu Comprehensive Testing', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(3000); // Wait for React hydration
    });

    async function openSettingsMenu(page) {
        const settingsButton = page.locator('button:has(svg:has(circle[cx="12"][cy="12"][r="3"]))').first();
        await settingsButton.click();
        await expect(page.locator('text="Settings"')).toBeVisible();
        return settingsButton;
    }

    test('should open and close settings menu', async ({ page }) => {
        await openSettingsMenu(page);

        // Close with Escape key
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);

        // Verify menu is closed
        const settingsText = page.locator('text="Settings"');
        await expect(settingsText).not.toBeVisible();
    });

    test('should display all theme options', async ({ page }) => {
        await openSettingsMenu(page);

        // Open theme submenu
        const themeSubmenu = page.locator('text=/Theme:.*/', { hasText: 'Theme:' }).first();
        await themeSubmenu.click();
        await page.waitForTimeout(500);

        // Check for theme options
        const themes = ['Paper', 'Cyberpunk', 'Solarized', 'High Contrast'];
        for (const theme of themes) {
            await expect(page.locator(`text="${theme}"`)).toBeVisible();
        }
    });

    test('should change theme and persist setting', async ({ page }) => {
        const initialTheme = await page.locator('html').getAttribute('class');

        await openSettingsMenu(page);

        // Select Cyberpunk theme
        const themeSubmenu = page.locator('text=/Theme:.*/', { hasText: 'Theme:' }).first();
        await themeSubmenu.click();
        await page.waitForTimeout(500);

        const cyberpunkOption = page.locator('text="Cyberpunk"');
        await cyberpunkOption.click();

        // Apply changes
        const applyButton = page.locator('button:has-text("Apply")');
        await applyButton.click();
        await page.waitForTimeout(1000);

        // Verify theme changed
        const newTheme = await page.locator('html').getAttribute('class');
        expect(newTheme).toContain('theme-cyberpunk');
        expect(newTheme).not.toBe(initialTheme);

        // Reload page and check persistence
        await page.reload();
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(3000);

        const persistedTheme = await page.locator('html').getAttribute('class');
        expect(persistedTheme).toContain('theme-cyberpunk');
    });

    test('should display font family options', async ({ page }) => {
        await openSettingsMenu(page);

        // Open font submenu
        const fontSubmenu = page.locator('text=/Font:.*/', { hasText: 'Font:' }).first();
        await fontSubmenu.click();
        await page.waitForTimeout(500);

        // Check for font options
        const fonts = ['Berkeley Mono', 'Inter', 'JetBrains Mono'];
        for (const font of fonts) {
            await expect(page.locator(`text="${font}"`)).toBeVisible();
        }
    });

    test('should change font family', async ({ page }) => {
        await openSettingsMenu(page);

        // Select JetBrains Mono font
        const fontSubmenu = page.locator('text=/Font:.*/', { hasText: 'Font:' }).first();
        await fontSubmenu.click();
        await page.waitForTimeout(500);

        const jetbrainsOption = page.locator('text="JetBrains Mono"');
        await jetbrainsOption.click();

        // Apply changes
        const applyButton = page.locator('button:has-text("Apply")');
        await applyButton.click();
        await page.waitForTimeout(1000);

        // Check CSS variable
        const fontFamily = await page.evaluate(() => {
            return getComputedStyle(document.documentElement).getPropertyValue('--font-family');
        });
        expect(fontFamily).toContain('jetbrains');
    });

    test('should display font size options', async ({ page }) => {
        await openSettingsMenu(page);

        // Open size submenu
        const sizeSubmenu = page.locator('text=/Size:.*/', { hasText: 'Size:' }).first();
        await sizeSubmenu.click();
        await page.waitForTimeout(500);

        // Check for size options
        const sizes = ['Small', 'Medium', 'Large'];
        for (const size of sizes) {
            await expect(page.locator(`text="${size}"`)).toBeVisible();
        }
    });

    test('should change font size', async ({ page }) => {
        await openSettingsMenu(page);

        // Select Large font size
        const sizeSubmenu = page.locator('text=/Size:.*/', { hasText: 'Size:' }).first();
        await sizeSubmenu.click();
        await page.waitForTimeout(500);

        const largeOption = page.locator('text="Large"');
        await largeOption.click();

        // Apply changes
        const applyButton = page.locator('button:has-text("Apply")');
        await applyButton.click();
        await page.waitForTimeout(1000);

        // Check CSS variable
        const fontSize = await page.evaluate(() => {
            return getComputedStyle(document.documentElement).getPropertyValue('--base-font-size');
        });
        expect(fontSize.trim()).toBe('18px');
    });

    test('should display RPC endpoint options', async ({ page }) => {
        await openSettingsMenu(page);

        // Open RPC submenu
        const rpcSubmenu = page.locator('text=/RPC:.*/', { hasText: 'RPC:' }).first();
        await rpcSubmenu.click();
        await page.waitForTimeout(500);

        // Check for OpenSVM option (main endpoint)
        await expect(page.locator('text="OpenSVM"')).toBeVisible();

        // Check for Custom option
        await expect(page.locator('text="Custom..."')).toBeVisible();
    });

    test('should cancel changes without applying', async ({ page }) => {
        const initialTheme = await page.locator('html').getAttribute('class');

        await openSettingsMenu(page);

        // Make a change but don't apply
        const themeSubmenu = page.locator('text=/Theme:.*/', { hasText: 'Theme:' }).first();
        await themeSubmenu.click();
        await page.waitForTimeout(500);

        const cyberpunkOption = page.locator('text="Cyberpunk"');
        await cyberpunkOption.click();

        // Cancel instead of apply
        const cancelButton = page.locator('button:has-text("Cancel")');
        await cancelButton.click();
        await page.waitForTimeout(500);

        // Verify no changes applied
        const currentTheme = await page.locator('html').getAttribute('class');
        expect(currentTheme).toBe(initialTheme);
    });

    test('should handle multiple setting changes in one session', async ({ page }) => {
        await openSettingsMenu(page);

        // Change theme to Solarized
        const themeSubmenu = page.locator('text=/Theme:.*/', { hasText: 'Theme:' }).first();
        await themeSubmenu.click();
        await page.waitForTimeout(500);
        const solarizedOption = page.locator('text="Solarized"');
        await solarizedOption.click();

        // Change font to Inter
        const fontSubmenu = page.locator('text=/Font:.*/', { hasText: 'Font:' }).first();
        await fontSubmenu.click();
        await page.waitForTimeout(500);
        const interOption = page.locator('text="Inter"');
        await interOption.click();

        // Change size to Small
        const sizeSubmenu = page.locator('text=/Size:.*/', { hasText: 'Size:' }).first();
        await sizeSubmenu.click();
        await page.waitForTimeout(500);
        const smallOption = page.locator('text="Small"');
        await smallOption.click();

        // Apply all changes
        const applyButton = page.locator('button:has-text("Apply")');
        await applyButton.click();
        await page.waitForTimeout(1000);

        // Verify all changes applied
        const theme = await page.locator('html').getAttribute('class');
        expect(theme).toContain('theme-solarized');

        const fontFamily = await page.evaluate(() => {
            return getComputedStyle(document.documentElement).getPropertyValue('--font-family');
        });
        expect(fontFamily).toContain('inter');

        const fontSize = await page.evaluate(() => {
            return getComputedStyle(document.documentElement).getPropertyValue('--base-font-size');
        });
        expect(fontSize.trim()).toBe('14px');
    });

    test('should reset to default theme (Paper)', async ({ page }) => {
        // First change to a different theme
        await openSettingsMenu(page);

        const themeSubmenu = page.locator('text=/Theme:.*/', { hasText: 'Theme:' }).first();
        await themeSubmenu.click();
        await page.waitForTimeout(500);

        const cyberpunkOption = page.locator('text="Cyberpunk"');
        await cyberpunkOption.click();

        const applyButton = page.locator('button:has-text("Apply")');
        await applyButton.click();
        await page.waitForTimeout(1000);

        // Verify theme changed
        let currentTheme = await page.locator('html').getAttribute('class');
        expect(currentTheme).toContain('theme-cyberpunk');

        // Now change back to Paper
        await openSettingsMenu(page);

        const themeSubmenu2 = page.locator('text=/Theme:.*/', { hasText: 'Theme:' }).first();
        await themeSubmenu2.click();
        await page.waitForTimeout(500);

        const paperOption = page.locator('text="Paper"');
        await paperOption.click();

        const applyButton2 = page.locator('button:has-text("Apply")');
        await applyButton2.click();
        await page.waitForTimeout(1000);

        // Verify theme changed back
        currentTheme = await page.locator('html').getAttribute('class');
        expect(currentTheme).toContain('theme-paper');
        expect(currentTheme).not.toContain('theme-cyberpunk');
    });
});
