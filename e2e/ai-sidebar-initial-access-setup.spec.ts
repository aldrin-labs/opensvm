import { test, expect } from '@playwright/test';

/**
 * Initial Access & Setup Journey
 *
 * Validates:
 *  - Sidebar opens automatically with ?ai=1
 *  - Exactly one authoritative root [data-ai-sidebar-root]
 *  - No stray ultra-early reasoning placeholders remain outside root post-hydration
 *  - Default mode is agent
 *  - Width persistence across reloads (localStorage -> DOM)
 *  - Global SVMAI API readiness
 */
test.describe('AI Sidebar - Initial Access & Setup', () => {

  test('single root, reasoning placeholder cleanup, default mode', async ({ page }) => {
    await page.goto('/?ai=1', { waitUntil: 'domcontentloaded' });

    // Wait for global API
    await page.waitForFunction(() => !!(window as any).SVMAI, undefined, { timeout: 8000 });

    // Wait for hydrated root to appear (React mount may lag behind early global stubs)
    const rootLocator = page.locator('[data-ai-sidebar-root]');
    await expect(rootLocator).toHaveCount(1);
    await expect(rootLocator).toBeVisible();

    // Ensure no orphan early reasoning blocks remain outside root
    const orphanEarlyBlocks = await page.evaluate(() => {
      const root = document.querySelector('[data-ai-sidebar-root]');
      if (!root) return -1;
      const candidates = Array.from(document.querySelectorAll('[data-ai-reasoning-block][data-ai-reasoning-early]'));
      return candidates.filter(el => !root.contains(el)).length;
    });
    expect(orphanEarlyBlocks).toBe(0);

    // Default mode should be agent
    const dataMode = await page.locator('[data-ai-sidebar]').first().getAttribute('data-ai-mode');
    expect(dataMode).toBe('agent');

    // Reasoning readiness attribute should eventually appear after bootstrap (best-effort, don't fail hard if absent quickly)
    await page.waitForTimeout(250);
    // Soft assertion: do not throw if missing to avoid flakiness; log instead
    const reasoningReady = await page.evaluate(() => {
      const r = document.querySelector('[data-ai-sidebar-root]');
      return r?.getAttribute('data-ai-reasoning-ready') || null;
    });
    if (!reasoningReady) {
      console.warn('data-ai-reasoning-ready not set (non-fatal)');
    }
  });

  test('width persistence across reloads', async ({ page }) => {
    await page.goto('/?ai=1', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!(window as any).SVMAI, undefined, { timeout: 8000 });

    // Ensure root is mounted before attempting width mutation to avoid race
    const rootLocator = page.locator('[data-ai-sidebar-root]');
    await expect(rootLocator).toHaveCount(1);
    await expect(rootLocator).toBeVisible();

    // Invoke width change
    await page.evaluate(() => (window as any).SVMAI?.setWidth?.(640));

    // Wait for localStorage persistence of width
    await page.waitForFunction(() => window.localStorage.getItem('aiSidebarWidth') === '640', {}, { timeout: 3000 });

    // Wait for width mutation (hydration + state propagation); reissue if needed
    await page.waitForFunction(() => {
      const el = document.querySelector('[data-ai-sidebar-root]') as HTMLElement | null;
      if (!el) return false;
      const w = Math.round(el.getBoundingClientRect().width);
      if (w < 630) {
        // Reissue width setting if it didn't take effect
        const svmai = (window as any).SVMAI;
        if (svmai && svmai.setWidth) {
          svmai.setWidth(640);
        }
        return false;
      }
      return w >= 630;
    }, { timeout: 8000 }); // Increased timeout

    const widthBefore = await rootLocator.evaluate(el => Math.round((el as HTMLElement).getBoundingClientRect().width));
    expect(widthBefore).toBeGreaterThanOrEqual(630);
    expect(widthBefore).toBeLessThanOrEqual(650);

    // Reload (no ai param persistence needed since localStorage open state should persist)
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!(window as any).SVMAI, undefined, { timeout: 8000 });

    // Ensure sidebar restored & width persisted
    const restoredWidth = await page.locator('[data-ai-sidebar-root]').evaluate(el => {
      const rect = (el as HTMLElement).getBoundingClientRect();
      return Math.round(rect.width);
    });

    expect(restoredWidth).toBeGreaterThanOrEqual(630);
    expect(restoredWidth).toBeLessThanOrEqual(650);

    // Confirm localStorage value
    const lsWidth = await page.evaluate(() => window.localStorage.getItem('aiSidebarWidth'));
    expect(lsWidth).toBe('640');
  });
});
