import { test, expect } from '@playwright/test';

test.describe('AI Chat Sidebar UX', () => {
    test('opens from floating SVMAI button and pushes content with draggable width persistence', async ({ page }) => {
        await page.goto('/');

        // Locate floating SVMAI button and click
        const floatingBtn = page.locator('button:has-text("SVMAI")').first();
        await expect(floatingBtn).toBeVisible();
        await floatingBtn.click();

        // Sidebar should be visible
        const sidebar = page.getByRole('complementary', { name: 'AI Chat Sidebar' });
        await expect(sidebar).toBeVisible();

        // Capture initial width style and main content shift
        const layoutContent = page.locator('#layout-content, #main-content, main').first();
        const w1 = await layoutContent.evaluate((el) => getComputedStyle(el as HTMLElement).width);
        const mr1 = await layoutContent.evaluate((el) => getComputedStyle(el as HTMLElement).marginRight);
        expect(mr1).not.toBe('0px');

        // Drag resizer ~+60px (simulate)
        const box = await sidebar.boundingBox();
        expect(box).not.toBeNull();
        const x = (box!.x) + 5; // near left edge
        const y = (box!.y) + 50;
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(x - 60, y); // expand sidebar width
        await page.mouse.up();

        const w2 = await layoutContent.evaluate((el) => getComputedStyle(el as HTMLElement).width);
        const mr2 = await layoutContent.evaluate((el) => getComputedStyle(el as HTMLElement).marginRight);
        expect(w2).not.toEqual(w1);
        expect(mr2).not.toEqual(mr1);

        // Reload and ensure width persisted (margin-right should remain non-zero)
        await page.reload();
        const mrReload = await layoutContent.evaluate((el) => getComputedStyle(el as HTMLElement).marginRight);
        expect(mrReload).not.toBe('0px');
    });

    test('navbar SVMAI opens the same sidebar with identical behavior', async ({ page }) => {
        await page.goto('/');

        const navBtn = page.getByRole('button', { name: 'Open AI Assistant' });
        await expect(navBtn).toBeVisible();
        await navBtn.click();

        const sidebar = page.getByRole('complementary', { name: 'AI Chat Sidebar' });
        await expect(sidebar).toBeVisible();

        // Close button visible (not clipped)
        const closeBtn = page.getByRole('button', { name: /close sidebar/i });
        await expect(closeBtn).toBeVisible();
    });
});


