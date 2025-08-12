import { test, expect } from '@playwright/test';

test.describe('Settings Menu Functionality', () => {
    test.beforeEach(async ({ page }) => {
        // Start from home page
        await page.goto('/');
        await page.waitForLoadState('domcontentloaded');

        // Wait for React hydration and components to mount
        await page.waitForTimeout(3000);
    });

    test('should open and close settings menu', async ({ page }) => {
        // Find the settings button - it's a button with a settings icon SVG
        const settingsButton = page.locator('button:has(svg:has(circle[cx="12"][cy="12"][r="3"]))').first();

        // Verify settings button is visible
        await expect(settingsButton).toBeVisible();

        // Click to open settings menu
        await settingsButton.click();

        // Verify dropdown menu appears - use more specific Radix attributes
        const settingsDropdown = page.locator('[data-radix-collection-item], [role="menu"]').first();
        await expect(settingsDropdown).toBeVisible();

        // Verify "Settings" label is present
        await expect(page.locator('text="Settings"')).toBeVisible();

        // Click outside to close (or press escape)
        await page.keyboard.press('Escape');

        // Wait for dropdown to close
        await page.waitForTimeout(500);

        // Verify dropdown closes
        await expect(settingsDropdown).not.toBeVisible();
    });

    test('should display theme selection submenu', async ({ page }) => {
        // Open settings menu
        const settingsButton = page.locator('button:has(svg:has(circle[cx="12"][cy="12"][r="3"]))').first();
        await settingsButton.click();

        // Wait for dropdown to appear
        const settingsDropdown = page.locator('[data-radix-collection-item], [role="menu"]').first();
        await expect(settingsDropdown).toBeVisible();

        // Find and hover over theme submenu trigger - use text content search
        const themeSubmenu = page.locator('text=/Theme:.*/', { hasText: 'Theme:' }).first();
        await expect(themeSubmenu).toBeVisible();

        // Click on theme submenu to open it
        await themeSubmenu.click();

        // Wait for submenu to appear
        await page.waitForTimeout(500);

        // Verify theme options are available
        const expectedThemes = ['Paper', 'Cyberpunk', 'Solarized', 'High Contrast'];

        for (const theme of expectedThemes) {
            const themeOption = page.locator(`text="${theme}"`);
            await expect(themeOption).toBeVisible();
        }
    }); test('should change theme and apply changes', async ({ page }) => {
        // Get initial theme class
        const initialTheme = await page.locator('html').getAttribute('class');

        // Open settings menu
        const settingsButton = page.locator('button[aria-label*="Settings"], button:has([data-testid="settings-icon"]), nav button:has(svg)').first();
        await settingsButton.click();

        // Open theme submenu
        const themeSubmenu = page.locator('text*="Theme:"').first();
        await themeSubmenu.click();

        // Select a different theme (e.g., Cyberpunk)
        const cyberpunkTheme = page.locator('text="Cyberpunk"');
        await cyberpunkTheme.click();

        // Click Apply button
        const applyButton = page.locator('button:has-text("Apply")');
        await expect(applyButton).toBeVisible();
        await applyButton.click();

        // Verify theme class changed on html element
        await page.waitForTimeout(500); // Wait for theme to apply
        const newTheme = await page.locator('html').getAttribute('class');

        // Should contain theme-cyberpunk class
        expect(newTheme).toContain('theme-cyberpunk');
        expect(newTheme).not.toBe(initialTheme);

        // Verify settings menu closes after apply
        const settingsDropdown = page.locator('[role="menu"], [data-radix-content], .dropdown-menu-content');
        await expect(settingsDropdown).not.toBeVisible();
    });

    test('should display font family selection submenu', async ({ page }) => {
        // Open settings menu
        const settingsButton = page.locator('button[aria-label*="Settings"], button:has([data-testid="settings-icon"]), nav button:has(svg)').first();
        await settingsButton.click();

        // Open font submenu
        const fontSubmenu = page.locator('text*="Font:"').first();
        await expect(fontSubmenu).toBeVisible();
        await fontSubmenu.click();

        // Verify font options are available
        const expectedFonts = ['Berkeley', 'Inter', 'JetBrains'];

        for (const font of expectedFonts) {
            const fontOption = page.locator(`text="${font}"`);
            await expect(fontOption).toBeVisible();
        }
    });

    test('should change font family and apply changes', async ({ page }) => {
        // Open settings menu
        const settingsButton = page.locator('button[aria-label*="Settings"], button:has([data-testid="settings-icon"]), nav button:has(svg)').first();
        await settingsButton.click();

        // Open font submenu
        const fontSubmenu = page.locator('text*="Font:"').first();
        await fontSubmenu.click();

        // Select a different font (e.g., JetBrains)
        const jetbrainsFont = page.locator('text="JetBrains"');
        await jetbrainsFont.click();

        // Click Apply button
        const applyButton = page.locator('button:has-text("Apply")');
        await applyButton.click();

        // Verify font family changed in CSS custom properties
        await page.waitForTimeout(500);
        const fontFamily = await page.evaluate(() => {
            return getComputedStyle(document.documentElement).getPropertyValue('--font-family');
        });

        // Should contain jetbrains font reference
        expect(fontFamily).toContain('jetbrains');
    });

    test('should display font size selection submenu', async ({ page }) => {
        // Open settings menu
        const settingsButton = page.locator('button[aria-label*="Settings"], button:has([data-testid="settings-icon"]), nav button:has(svg)').first();
        await settingsButton.click();

        // Open font size submenu
        const sizeSubmenu = page.locator('text*="Size:"').first();
        await expect(sizeSubmenu).toBeVisible();
        await sizeSubmenu.click();

        // Verify size options are available
        const expectedSizes = ['Small', 'Medium', 'Large'];

        for (const size of expectedSizes) {
            const sizeOption = page.locator(`text="${size}"`);
            await expect(sizeOption).toBeVisible();
        }
    });

    test('should change font size and apply changes', async ({ page }) => {
        // Open settings menu
        const settingsButton = page.locator('button[aria-label*="Settings"], button:has([data-testid="settings-icon"]), nav button:has(svg)').first();
        await settingsButton.click();

        // Open font size submenu
        const sizeSubmenu = page.locator('text*="Size:"').first();
        await sizeSubmenu.click();

        // Select a different size (e.g., Large)
        const largeSize = page.locator('text="Large"');
        await largeSize.click();

        // Click Apply button
        const applyButton = page.locator('button:has-text("Apply")');
        await applyButton.click();

        // Verify font size changed in CSS custom properties
        await page.waitForTimeout(500);
        const fontSize = await page.evaluate(() => {
            return getComputedStyle(document.documentElement).getPropertyValue('--base-font-size');
        });

        // Should be 18px for large size
        expect(fontSize.trim()).toBe('18px');
    });

    test('should display RPC endpoint selection submenu', async ({ page }) => {
        // Open settings menu
        const settingsButton = page.locator('button[aria-label*="Settings"], button:has([data-testid="settings-icon"]), nav button:has(svg)').first();
        await settingsButton.click();

        // Open RPC submenu
        const rpcSubmenu = page.locator('text*="RPC:"').first();
        await expect(rpcSubmenu).toBeVisible();
        await rpcSubmenu.click();

        // Verify RPC options are available
        const expectedRpcOptions = ['osvm rpc', 'Serum', 'Ankr', 'ExtrNode', 'Mainnet', 'Devnet', 'Testnet'];

        // Check for at least some of these options
        const opensvmOption = page.locator('text="OpenSVM"');
        await expect(opensvmOption).toBeVisible();

        // Should also have a "Custom..." option
        const customOption = page.locator('text="Custom..."');
        await expect(customOption).toBeVisible();
    });

    test('should cancel changes without applying', async ({ page }) => {
        // Get initial theme class
        const initialTheme = await page.locator('html').getAttribute('class');

        // Open settings menu
        const settingsButton = page.locator('button[aria-label*="Settings"], button:has([data-testid="settings-icon"]), nav button:has(svg)').first();
        await settingsButton.click();

        // Open theme submenu and select different theme
        const themeSubmenu = page.locator('text*="Theme:"').first();
        await themeSubmenu.click();

        const cyberpunkTheme = page.locator('text="Cyberpunk"');
        await cyberpunkTheme.click();

        // Click Cancel button instead of Apply
        const cancelButton = page.locator('button:has-text("Cancel")');
        await expect(cancelButton).toBeVisible();
        await cancelButton.click();

        // Verify theme didn't change
        await page.waitForTimeout(500);
        const currentTheme = await page.locator('html').getAttribute('class');
        expect(currentTheme).toBe(initialTheme);

        // Verify settings menu closes
        const settingsDropdown = page.locator('[role="menu"], [data-radix-content], .dropdown-menu-content');
        await expect(settingsDropdown).not.toBeVisible();
    });

    test('should persist settings across page reloads', async ({ page }) => {
        // Open settings and change theme to Cyberpunk
        const settingsButton = page.locator('button[aria-label*="Settings"], button:has([data-testid="settings-icon"]), nav button:has(svg)').first();
        await settingsButton.click();

        const themeSubmenu = page.locator('text*="Theme:"').first();
        await themeSubmenu.click();

        const cyberpunkTheme = page.locator('text="Cyberpunk"');
        await cyberpunkTheme.click();

        const applyButton = page.locator('button:has-text("Apply")');
        await applyButton.click();

        // Wait for theme to apply
        await page.waitForTimeout(500);

        // Verify theme is applied
        const themeAfterChange = await page.locator('html').getAttribute('class');
        expect(themeAfterChange).toContain('theme-cyberpunk');

        // Reload the page
        await page.reload();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);

        // Verify theme persisted after reload
        const themeAfterReload = await page.locator('html').getAttribute('class');
        expect(themeAfterReload).toContain('theme-cyberpunk');
    });

    test('should handle multiple setting changes in one session', async ({ page }) => {
        // Open settings menu
        const settingsButton = page.locator('button[aria-label*="Settings"], button:has([data-testid="settings-icon"]), nav button:has(svg)').first();
        await settingsButton.click();

        // Change theme
        const themeSubmenu = page.locator('text*="Theme:"').first();
        await themeSubmenu.click();
        const solarizedTheme = page.locator('text="Solarized"');
        await solarizedTheme.click();

        // Change font
        const fontSubmenu = page.locator('text*="Font:"').first();
        await fontSubmenu.click();
        const interFont = page.locator('text="Inter"');
        await interFont.click();

        // Change font size
        const sizeSubmenu = page.locator('text*="Size:"').first();
        await sizeSubmenu.click();
        const smallSize = page.locator('text="Small"');
        await smallSize.click();

        // Apply all changes
        const applyButton = page.locator('button:has-text("Apply")');
        await applyButton.click();

        // Verify all changes applied
        await page.waitForTimeout(500);

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
});
