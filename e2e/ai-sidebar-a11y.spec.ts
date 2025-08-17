import { test, expect } from '@playwright/test';

// Basic accessibility smoke test for AI sidebar
// Requires app running; run with `npm run dev` then `npx playwright test` (or test:e2e script)

test.describe('AI Sidebar Accessibility', () => {
    test('no serious or critical issues', async ({ page }) => {
        await page.goto('/?ai=1');
        // Wait for sidebar root
        const sidebar = page.locator('[data-ai-sidebar]');
        await expect(sidebar).toBeVisible();

        // Seed some messages for richer structure
        await page.waitForTimeout(300); // allow hydration
        await page.evaluate(() => (window as any).__SVMAI_SEED__?.(5));

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
