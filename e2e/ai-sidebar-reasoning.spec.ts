import { test, expect } from '@playwright/test';

/**
 * Reasoning Block E2E Tests
 *
 * Validates:
 *  - Reasoning parsing from <REASONING> tags
 *  - Single rendering (no duplication)
 *  - Collapsed by default
 *  - Expand/collapse toggling with custom events
 *  - Token estimate display
 *  - Reasoning text excluded from main visible answer content
 */
test.describe('AI Sidebar Reasoning Blocks', () => {

  test('parses, renders, and toggles reasoning blocks correctly', async ({ page }) => {
    // Open with sidebar visible
    await page.goto('/?ai=1', { waitUntil: 'domcontentloaded' });

    // Ensure global SVMAI API present (sidebar mounted)
    await page.waitForFunction(() => !!(window as any).SVMAI, undefined, { timeout: 8000 });

    // Seed messages with reasoning every 2nd assistant message
    await page.evaluate(() => {
      return (window as any).SVMAI.seed?.(20, {
        clear: true,
        reasoningEvery: 2,
        reasoningText: 'Synthetic test reasoning sequence for validation of collapse/expand.'
      });
    });

    // Wait for at least one reasoning block to appear
    const toggleLocator = page.locator('[data-ai-reasoning-toggle]');
    await expect(toggleLocator.first()).toBeVisible({ timeout: 8000 });

    // Collect counts
    const blockCount = await page.locator('[data-ai-reasoning-block]').count();
    expect(blockCount).toBeGreaterThan(0);

    // Verify each block has a token estimate and is collapsed by default
    for (let i = 0; i < blockCount; i++) {
      const block = page.locator('[data-ai-reasoning-block]').nth(i);
      const toggle = block.locator('[data-ai-reasoning-toggle]');
      await expect(toggle).toBeVisible();
      const toggleText = (await toggle.textContent()) || '';
      expect(toggleText).toMatch(/Reasoning\s*\(\d+\s*token/);

      const content = block.locator('[data-ai-reasoning-content]');
      // Collapsed means aria-hidden="true" or effectively zero height
      const ariaHidden = await content.getAttribute('aria-hidden');
      expect(ariaHidden).toBe('true');
    }

    // Attach listener for custom events before interaction
    await page.evaluate(() => {
      (window as any).__svmaiReasoningEvents = [];
      window.addEventListener('svmai:event', (e: any) => {
        (window as any).__svmaiReasoningEvents.push(e.detail);
      });
    });

    // Expand first block
    const firstBlock = page.locator('[data-ai-reasoning-block]').first();
    const firstToggle = firstBlock.locator('[data-ai-reasoning-toggle]');
    await firstToggle.click();

    // Expect content expanded
    const firstContent = firstBlock.locator('[data-ai-reasoning-content]');
    await expect(firstContent).toBeVisible({ timeout: 3000 });
    const ariaHiddenAfter = await firstContent.getAttribute('aria-hidden');
    expect(ariaHiddenAfter).toBe('false');

    // Validate custom event fired
    const events = await page.evaluate(() => (window as any).__svmaiReasoningEvents || []);
    const expandEvent = events.find((e: any) => e.type === 'reasoning_expand');
    expect(expandEvent).toBeTruthy();

    // Collapse again
    await firstToggle.click();
    await page.waitForTimeout(150);
    const ariaHiddenCollapsed = await firstContent.getAttribute('aria-hidden');
    expect(ariaHiddenCollapsed).toBe('true');
    const eventsAfter = await page.evaluate(() => (window as any).__svmaiReasoningEvents || []);
    const collapseEvent = eventsAfter.find((e: any) => e.type === 'reasoning_collapse');
    expect(collapseEvent).toBeTruthy();

    // Ensure reasoning text is NOT duplicated inside the visible answer body
    // Strategy: pick one assistant message containing <REASONING> tag source, confirm its rendered visible block (excluding reasoning content) lacks a known reasoning snippet text.
    const snippet = 'Synthetic test reasoning sequence';
    // Grab raw DOM text of assistant messages (excluding reasoning content container)
    const duplicateFound = await page.evaluate((needle) => {
      const blocks = Array.from(document.querySelectorAll('[data-ai-reasoning-block]'));
      // For each block, look at its parent message container and extract visible text excluding the reasoning content when collapsed
      return blocks.some(blockEl => {
        const messageEl = blockEl.closest('[data-ai-message]');
        if (!messageEl) return false;
        // Collect text nodes excluding reasoning content
        const reasoningContent = blockEl.querySelector('[data-ai-reasoning-content]');
        if (reasoningContent) reasoningContent.setAttribute('data-temp-hide', '1');
        const cloned = messageEl.cloneNode(true) as HTMLElement;
        // Remove the reasoning content from clone
        cloned.querySelectorAll('[data-ai-reasoning-content]').forEach(el => el.remove());
        const text = cloned.textContent || '';
        if (reasoningContent) reasoningContent.removeAttribute('data-temp-hide');
        return text.includes(needle);
      });
    }, snippet);

    expect(duplicateFound).toBeFalsy();
  });

  test('token estimate consistency across multiple expanded reasoning blocks', async ({ page }) => {
    await page.goto('/?ai=1', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!(window as any).SVMAI, undefined, { timeout: 8000 });

    await page.evaluate(() => {
      return (window as any).SVMAI.seed?.(30, {
        clear: true,
        reasoningEvery: 3,
        reasoningText: 'Reasoning consistency sample block for token estimation accuracy.'
      });
    });

    await expect(page.locator('[data-ai-reasoning-toggle]').first()).toBeVisible({ timeout: 8000 });

    // Expand first three reasoning blocks (if available)
    const blocks = page.locator('[data-ai-reasoning-block]');
    const count = await blocks.count();
    const expandCount = Math.min(count, 3);
    const tokenValues: number[] = [];

    for (let i = 0; i < expandCount; i++) {
      const block = blocks.nth(i);
      const toggle = block.locator('[data-ai-reasoning-toggle]');
      await toggle.click();
      await expect(block.locator('[data-ai-reasoning-content]')).toBeVisible();
      const toggleText = (await toggle.textContent()) || '';
      const match = toggleText.match(/\((\d+)\s*token/);
      if (match) {
        tokenValues.push(parseInt(match[1], 10));
      }
    }

    expect(tokenValues.length).toBeGreaterThan(0);
    // All token estimates should be positive
    tokenValues.forEach(v => expect(v).toBeGreaterThan(0));
  });
});
