import { test, expect } from '@playwright/test';

// Basic accessibility smoke test for AI sidebar
// Requires app running; run with `npm run dev` then `npx playwright test` (or test:e2e script)

test.describe('AI Sidebar Accessibility', () => {
    test('no serious or critical issues', async ({ page }) => {
        await page.goto('/?ai=1');
        
        // Wait for the page to fully load and hydrate
        await page.waitForLoadState('networkidle');
        
        // Wait for the global SVMAI API to be ready
        await page.waitForFunction(() => {
            const w = window as any;
            return w.SVMAI && typeof w.SVMAI.open === 'function';
        }, { timeout: 10000 });

        // Ensure sidebar is open programmatically if not already
        await page.evaluate(() => {
            const w = window as any;
            if (w.SVMAI && typeof w.SVMAI.open === 'function') {
                w.SVMAI.open();
            }
        });

        // Wait for sidebar state to update and become visible
        // First check that data-open attribute is set to "1" on the root element
        const sidebar = page.locator('[data-ai-sidebar-root]').first();
        await expect(sidebar).toHaveAttribute('data-open', '1', { timeout: 8000 });
        
        // Then verify it's actually visible (not translated off-screen)
        await expect(sidebar).toBeVisible({ timeout: 2000 });

        // Wait for React components to fully hydrate
        await page.waitForTimeout(500);
        
        // Seed some messages for richer structure
        await page.evaluate(() => (window as any).__SVMAI_SEED__?.(5));

        // Wait a bit more for any async rendering to complete
        await page.waitForTimeout(300);

        // Dynamically import axe-core to avoid build-time type resolution issues if typings missing
        const axeMod: any = await import('@axe-core/playwright');
        const builder = new axeMod.default({ page }).withTags(['wcag2a', 'wcag2aa']);
        const results = await builder.analyze();

        const serious = results.violations.filter(v => v.impact === 'serious' || v.impact === 'critical');
        if (serious.length) {
            console.log('A11y Violations:', serious.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.length })));
        }
        expect(serious, 'No serious/critical accessibility violations expected').toHaveLength(0);
    });
});
