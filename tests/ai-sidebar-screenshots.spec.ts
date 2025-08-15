import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const OUT_DIR = path.resolve(__dirname, '../screenshots/ai-sidebar');

test.describe('AI Sidebar screenshots', () => {
    test.beforeAll(() => {
        fs.mkdirSync(OUT_DIR, { recursive: true });
    });

    test('capture steps', async ({ page }) => {
        // 1) Open with sidebar auto-opened
        await page.goto('http://localhost:3000/?ai=1', { waitUntil: 'networkidle' });

        const sidebar = page.locator('[data-ai-sidebar]');
        await expect(sidebar).toBeVisible();
        await page.screenshot({ path: path.join(OUT_DIR, 'step1-open.png'), fullPage: true });

        // 2) Hover the resize handle (role=separator, aria-label="Resize sidebar")
        const handle = sidebar.getByRole('separator', { name: 'Resize sidebar' });
        await expect(handle).toBeVisible();
        await handle.hover();
        await page.waitForTimeout(150); // allow hover styles
        await page.screenshot({ path: path.join(OUT_DIR, 'step2-hover-handle.png'), fullPage: true });

        // 3) Click Expand button
        const expandBtn = sidebar.getByRole('button', { name: 'Expand sidebar' });
        await expect(expandBtn).toBeVisible();
        await expandBtn.click();
        await page.waitForTimeout(200);
        await page.screenshot({ path: path.join(OUT_DIR, 'step3-expanded.png'), fullPage: true });

        // 4) Drag resize handle to shrink a bit while expanded (this exits expanded mode)
        const box = await handle.boundingBox();
        if (!box) throw new Error('Handle bounding box not found');
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width / 2 + 200, box.y + box.height / 2, { steps: 10 });
        await page.mouse.up();
        await page.waitForTimeout(200);
        await page.screenshot({ path: path.join(OUT_DIR, 'step4-drag-resized.png'), fullPage: true });

        // 5) Close the sidebar via the X button
        const closeBtn = sidebar.getByRole('button', { name: 'Close sidebar' });
        await expect(closeBtn).toBeVisible();
        await closeBtn.click();
        await page.waitForTimeout(150);
        await page.screenshot({ path: path.join(OUT_DIR, 'step5-closed.png'), fullPage: true });
    });
});
