import { test, expect } from '@playwright/test';

// Captures step-by-step screenshots of the AI sidebar interactions
// Outputs to screenshots/ai-sidebar/*.png

test.describe('AI Sidebar - step-by-step screenshots', () => {
    test('open, hover handle, expand, drag resize, close', async ({ page }) => {
        await page.setViewportSize({ width: 1600, height: 1000 });

        // 1) Open with AI enabled and mock processing to keep UI stable
        await page.goto('/?ai=1&aimock=1&aitext=hi');

        const sidebar = page.locator('[data-ai-sidebar]');
        await expect(sidebar).toBeVisible();

        // Ensure input exists before first shot
        await expect(page.locator('[data-ai-chat-input], #chat-input')).toBeVisible();

        await page.screenshot({ path: 'screenshots/ai-sidebar/step1-open.png', fullPage: true });

        // 2) Hover the left resize handle to show affordance
        const handle = sidebar.getByRole('separator', { name: 'Resize sidebar' });
        await expect(handle).toBeVisible();
        await handle.hover();
        await page.waitForTimeout(150); // allow hover styles to apply
        await page.screenshot({ path: 'screenshots/ai-sidebar/step2-hover-handle.png', fullPage: true });

        // 3) Click Expand button
        const expandBtn = sidebar.getByRole('button', { name: /Expand sidebar|Collapse sidebar/ });
        await expect(expandBtn).toBeVisible();
        // If currently collapsed (not expanded), click to expand
        const isExpanded = await expandBtn.getAttribute('aria-expanded');
        if (isExpanded !== 'true') {
            await expandBtn.click();
            await expect(expandBtn).toHaveAttribute('aria-expanded', 'true');
        }
        await page.waitForTimeout(200); // animate
        await page.screenshot({ path: 'screenshots/ai-sidebar/step3-expanded.png', fullPage: true });

        // 4) Drag to resize while expanded
        const box = await handle.boundingBox();
        if (box) {
            // Start drag from handle center a bit inside the sidebar so we grab it reliably
            const startX = box.x + box.width / 2 + 2;
            const startY = box.y + box.height / 2;
            await page.mouse.move(startX, startY);
            await page.mouse.down();
            // Drag left to make the sidebar wider
            await page.mouse.move(startX - 220, startY, { steps: 8 });
            await page.mouse.up();
            await page.waitForTimeout(200);
        }
        await page.screenshot({ path: 'screenshots/ai-sidebar/step4-drag-resized.png', fullPage: true });

        // 5) Close sidebar via the header button
        const closeBtn = sidebar.getByRole('button', { name: 'Close sidebar' });
        await expect(closeBtn).toBeVisible();
        await closeBtn.click();
        await page.waitForTimeout(250); // allow close animation
        await page.screenshot({ path: 'screenshots/ai-sidebar/step5-closed.png', fullPage: true });
    });
});
