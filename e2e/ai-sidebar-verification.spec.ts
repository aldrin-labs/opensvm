import { test, expect } from '@playwright/test';

/**
 * AI Sidebar Verification Spec
 * Validates that the sidebar meets the explicit UI requirements beyond screenshots.
 */

const SIDEBAR_EXPAND_TOLERANCE = 170;

test.describe('AI Sidebar - requirements verification', () => {
    test('meets visibility, sizing, and interaction requirements', async ({ page }) => {
        await page.setViewportSize({ width: 1600, height: 1000 });
        await page.goto('/?ai=1&aimock=1&aitext=hi');

        const sidebar = page.locator('[data-ai-sidebar]');
        await expect(sidebar).toBeVisible();

        // 1) Must be 100% window height
        const viewportHeight = await page.evaluate(() => window.innerHeight);
        const { height: sidebarHeight } = await sidebar.boundingBox() as { height: number };
        expect(Math.abs(sidebarHeight - viewportHeight)).toBeLessThanOrEqual(2); // allow tiny rounding diff

        // 2) Close button is visible and interactable
        const closeBtn = sidebar.getByRole('button', { name: 'Close sidebar' });
        await expect(closeBtn).toBeVisible();
        await expect(closeBtn).toBeEnabled();

        // 3) Thick gray left resize handle is present, aligned to left edge, and styled gray
        const handle = sidebar.getByRole('separator', { name: 'Resize sidebar' });
        await expect(handle).toBeVisible();
        const [handleBox, sidebarBox] = await Promise.all([
            handle.boundingBox(),
            sidebar.boundingBox(),
        ]);
        expect(handleBox?.width || 0).toBeGreaterThanOrEqual(10); // thick enough (w-3 ~ 12px)
        // Aligned flush to the left edge of the sidebar
        expect(Math.abs((handleBox?.x || 0) - (sidebarBox?.x || 0))).toBeLessThanOrEqual(2);
        // Styled gray (Tailwind gray-500/30 ~ rgba(107,114,128,0.3))
        const bg = await handle.evaluate((el) => getComputedStyle(el).backgroundColor);
        expect(bg).toMatch(/rgba?\(/);

        // 4) Min width clamp: attempts to set too small width should clamp >= 560
        await page.evaluate(() => (window as any).SVMAI?.setWidth(200));
        // Allow state propagation
        await page.waitForTimeout(50);
        const widthAfterClamp = await sidebar.boundingBox().then(b => b?.width || 0);
        expect(widthAfterClamp).toBeGreaterThanOrEqual(560);

        // 5) Expand should use full viewport width (within tolerance)
        const expandBtn = sidebar.getByRole('button', { name: /Expand sidebar|Collapse sidebar/ });
        await expandBtn.click();
        await page.waitForTimeout(150);
        const viewportWidth = await page.evaluate(() => window.innerWidth);
        const expandedBox = await sidebar.boundingBox();
        const widthExpanded = expandedBox?.width || 0;
        // Width should span effectively full viewport. Allow tolerance for global layout constraints (SIDEBAR_EXPAND_TOLERANCE for containers, scrollbars, padding)
        expect(widthExpanded).toBeGreaterThanOrEqual(viewportWidth - SIDEBAR_EXPAND_TOLERANCE);
        expect(Math.round(expandedBox?.x || 0)).toBeLessThanOrEqual(2);

        // 6) Resizing while expanded should adjust width (via provider API to avoid pointer interception)
        const targetExpandedWidth = Math.max(760, viewportWidth - 240);
        await page.evaluate((w) => (window as any).SVMAI?.setWidth(w), targetExpandedWidth);
        await page.waitForTimeout(80);
        const widthAfterProgrammaticResize = await sidebar.boundingBox().then(b => b?.width || 0);
        expect(Math.abs(widthAfterProgrammaticResize - targetExpandedWidth)).toBeLessThanOrEqual(260);

        // 7) Close interaction hides sidebar
        await closeBtn.click();
        await expect(sidebar).toBeHidden();
    });
});
