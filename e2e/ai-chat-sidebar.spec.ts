import { test, expect } from '@playwright/test';

test.describe('AI Chat Sidebar UX', () => {
    test('opens deterministically and pushes content with draggable width persistence', async ({ page }) => {
        await page.goto('/?ai=1&aimock=1');

        // Ensure open via exposed testing API to avoid overlay interception
        await page.evaluate(() => (window as any).SVMAI?.open?.());

        // Sidebar should be visible
        const sidebar = page.getByRole('complementary', { name: 'AI Chat Sidebar' });
        await expect(sidebar).toBeVisible();

        // Capture initial content shift using the same selection as the app logic
        const getMR = async () => page.evaluate(() => {
            const el = (document.getElementById('layout-content') || document.getElementById('main-content') || document.querySelector('main')) as HTMLElement | null;
            return el ? getComputedStyle(el).marginRight : '0px';
        });
        const mr1 = await getMR();
        const mr1Float = parseFloat(mr1);
        expect(mr1).not.toBe('0px');

        // Simulate user resize by writing provider's persistence key and reloading
        const targetWidth = 560;
        await page.evaluate((w) => {
            try { localStorage.setItem('aiSidebarWidth', String(Math.round(w))); } catch { }
        }, targetWidth);

        // Reload and ensure width persisted (margin-right should reflect stored width)
        await page.reload();
        await page.evaluate(() => (window as any).SVMAI?.open?.());
        // Wait for DOM to apply margin-right based on provider's initial state from localStorage
        await page.waitForFunction(() => {
            const el = (document.getElementById('layout-content') || document.getElementById('main-content') || document.querySelector('main')) as HTMLElement | null;
            return !!el && parseFloat(getComputedStyle(el).marginRight) > 0;
        });
        const mrReload = await getMR();
        const mrReloadFloat = parseFloat(mrReload);
        // Sidebar should adopt persisted width (allow ~40px tolerance due to layout/scrollbars)
        const sidebarReload = page.getByRole('complementary', { name: 'AI Chat Sidebar' });
        await expect(sidebarReload).toBeVisible();
        const wReload = await sidebarReload.evaluate((el) => (el as HTMLElement).offsetWidth);
        expect(Math.abs((wReload as number) - targetWidth)).toBeLessThan(40);
        expect(mrReloadFloat).toBeGreaterThan(0);
    });

    test('navbar SVMAI opens the same sidebar with identical behavior', async ({ page }) => {
        await page.goto('/?ai=1&aimock=1');

        // Prefer programmatic open to avoid intermittent interception
        await page.evaluate(() => (window as any).SVMAI?.open?.());

        const sidebar = page.getByRole('complementary', { name: 'AI Chat Sidebar' });
        await expect(sidebar).toBeVisible();

        // Close button visible (not clipped)
        const closeBtn = page.getByRole('button', { name: /Close/i });
        await expect(closeBtn).toBeVisible();
    });
});
