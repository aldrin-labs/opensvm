import { test, expect } from '@playwright/test';

/**
 * Extended AI Sidebar tests covering:
 * - Virtualization thresholds (150+, 500+ messages)
 * - Performance snapshot API
 * - Knowledge CRUD + persistence
 * - Width resize + persistence
 * - Global pending / processing indicator parity
 *
 * Relies on window helpers:
 *   window.__SVMAI_SEED__(n)  -> deterministic seeding of messages
 *   window.SVMAI.setWidth(w)  -> programmatic width setting (clamped)
 *   window.SVMAI.getPerfSnapshot() -> performance metrics (virtualized, dropped frames)
 */

async function openAISidebar(page, params: string = 'ai=1&aimock=1') {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto(`/?${params}`);

  // Ensure global API is ready, then force-open (some environments render a hidden root shell first)
  await page.waitForFunction(() => typeof (window as any).SVMAI !== 'undefined', null, { timeout: 8000 });
  await page.evaluate(() => (window as any).SVMAI?.open?.());

  // Wait for the visible sidebar container (ChatLayout supplies role+data-ai-sidebar)
  const visibleSidebar = page.locator('[data-ai-sidebar][role="complementary"]').first();
  await page.waitForFunction(() => {
    const el = document.querySelector('[data-ai-sidebar][role="complementary"]') as HTMLElement | null;
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    // Sidebar considered open if width >= 560 (min) and height plausible
    return rect.width >= 560 && rect.height > 50;
  }, null, { timeout: 8000 });
  await expect(visibleSidebar).toBeVisible({ timeout: 8000 });

  // Ensure chat input or fallback present
  await expect(page.locator('[data-ai-chat-input], #chat-input')).toBeVisible({ timeout: 4000 });
}

test.describe('AI Sidebar - Virtualization & Performance', () => {
  test('activates virtualization at >150 messages with placeholders', async ({ page }) => {
    await openAISidebar(page);

    // Wait for seeding helper to be ready
    await page.waitForFunction(() => typeof (window as any).__SVMAI_SEED__ === 'function', null, { timeout: 8000 });

    // Seed 160 messages
    await page.evaluate(() => (window as any).__SVMAI_SEED__(160));

    // Wait until virtualization list reports expected message count
    await page.waitForFunction(() => {
      const list = document.querySelector('[data-ai-message-list="virtualized"]');
      if (!list) return false;
      const count = Number(list.getAttribute('data-ai-message-count') || '0');
      return count >= 160;
    }, null, { timeout: 8000 });

    // Virtualized list should be present
    const list = page.locator('[data-ai-message-list="virtualized"]');
    await expect(list).toBeVisible({ timeout: 8000 });

    // Placeholders for off-screen content
    await expect(page.locator('[data-ai-placeholder="start"]')).toBeVisible();
    await expect(page.locator('[data-ai-placeholder="end"]')).toBeVisible();

    // Attribute sanity
    const countAttr = await list.getAttribute('data-ai-message-count');
    expect(Number(countAttr)).toBeGreaterThanOrEqual(160);
  });

  test('maintains performance & virtualization at 500+ messages', async ({ page }) => {
    await openAISidebar(page);

    // Wait for seeding helper
    await page.waitForFunction(() => typeof (window as any).__SVMAI_SEED__ === 'function', null, { timeout: 8000 });

    // Seed 520 messages
    await page.evaluate(() => (window as any).__SVMAI_SEED__(520));

    // Wait until virtualization list reports expected message count
    await page.waitForFunction(() => {
      const list = document.querySelector('[data-ai-message-list="virtualized"]');
      if (!list) return false;
      const count = Number(list.getAttribute('data-ai-message-count') || '0');
      return count >= 520;
    }, null, { timeout: 10000 });

    const list = page.locator('[data-ai-message-list="virtualized"]');
    await expect(list).toBeVisible({ timeout: 8000 });

    // Allow a few frames for perf monitor accumulation
    await page.waitForTimeout(250);

    const snapshot = await page.evaluate(() => (window as any).SVMAI?.getPerfSnapshot?.());
    expect(snapshot).toBeTruthy();
    expect(snapshot.messageCount).toBeGreaterThanOrEqual(520);
    expect(snapshot.virtualized).toBeTruthy();

    // Frame time heuristic (should not exceed ~120ms worst-case steady state)
    if (typeof snapshot.lastFrameTime === 'number') {
      expect(snapshot.lastFrameTime).toBeLessThan(120);
    }
  });
});

test.describe('AI Sidebar - Knowledge CRUD & Persistence', () => {
  test('creates knowledge note and persists across reload', async ({ page }) => {
    await openAISidebar(page);

    // Switch to knowledge tab if a control exists; fallback to querying panel presence
    // Attempt to find an element that toggles knowledge view (robust to different UI layouts)
    const knowledgeToggleCandidates = [
      '[data-ai-tab="knowledge"] button',
      'button:has-text("Knowledge")',
      '[data-testid="knowledge-tab"]'
    ];
    for (const sel of knowledgeToggleCandidates) {
      const candidate = page.locator(sel);
      if (await candidate.count()) {
        try { await candidate.first().click({ timeout: 500 }); } catch {}
      }
    }

    // Knowledge panel should now be visible (disambiguated selector)
    await expect(page.locator('[data-ai-knowledge-panel="1"]')).toBeVisible({ timeout: 3000 });

    // If empty state: add-first-note action
    const addFirst = page.locator('[data-ai-action="add-first-note"]');
    if (await addFirst.isVisible().catch(() => false)) {
      await addFirst.click();
    } else {
      // Otherwise toggle add form
      const toggleAdd = page.locator('[data-ai-action="toggle-add-form"]');
      if (await toggleAdd.isVisible().catch(() => false)) {
        await toggleAdd.click();
      }
    }

    const noteContent = `Test knowledge entry ${Date.now()}`;
    await page.fill('[data-ai-input="new-note-content"]', noteContent);
    await page.click('[data-ai-action="save-note"]');

    const noteItem = page.locator(`[data-testid="note-item"]:has-text("${noteContent}")`);
    await expect(noteItem).toBeVisible({ timeout: 4000 });

    // Reload and confirm persistence (relaxed visibility — root may report hidden while open)
    await page.reload();
    await page.waitForFunction(() => typeof (window as any).SVMAI !== 'undefined', null, { timeout: 8000 });
    await page.evaluate(() => (window as any).SVMAI?.open?.());
    const sidebarRoot = page.locator('[data-ai-sidebar-root],[data-ai-sidebar]').first();
    await expect(sidebarRoot).toHaveAttribute('data-open', '1', { timeout: 8000 });

    // Re-open knowledge tab after reload (original selection lost on navigation)
    const knowledgeToggleCandidatesReload = [
      '[data-ai-tab="knowledge"] button',
      'button:has-text("Knowledge")',
      '[data-testid="knowledge-tab"]'
    ];
    for (const sel of knowledgeToggleCandidatesReload) {
      const candidate = page.locator(sel);
      if (await candidate.count()) {
        try { await candidate.first().click({ timeout: 500 }); break; } catch { /* noop */ }
      }
    }

    // Wait for hydration attribute signaling knowledge load
    await page.waitForFunction(() => {
      const root = document.querySelector('[data-ai-sidebar-root]');
      return !!root && root.getAttribute('data-ai-knowledge-hydrated') === '1';
    }, null, { timeout: 8000 });

    // Optional: wait for non-zero knowledge count (ignore timeout if still zero; note might be only entry)
    try {
      await page.waitForFunction(() => {
        const root = document.querySelector('[data-ai-sidebar-root]');
        if (!root) return false;
        const c = Number(root.getAttribute('data-ai-knowledge-count') || '0');
        return c >= 1;
      }, null, { timeout: 3000 });
    } catch { /* noop */ }

    const persisted = page.locator(`[data-testid="note-item"]:has-text("${noteContent}")`);
    await expect(persisted).toBeVisible({ timeout: 8000 });
  });
});

test.describe('AI Sidebar - Width Resize & Persistence', () => {
  test('resizes & persists width across reload', async ({ page }) => {
    await openAISidebar(page);

    const sidebar = page.locator('[data-ai-sidebar][role="complementary"]').first();
    await expect(sidebar).toBeVisible({ timeout: 8000 });

    // Set width programmatically (should clamp if needed)
    const targetWidth = 860;
    await page.evaluate(w => (window as any).SVMAI?.setWidth(w), targetWidth);
    await page.waitForTimeout(120);

    const width1 = (await sidebar.boundingBox())?.width || 0;
    expect(width1).toBeGreaterThanOrEqual(560); // min clamp
    expect(width1).toBeGreaterThanOrEqual(700); // ensure notable resize (heuristic)

    // Reload page
    await page.reload();
    await expect(sidebar).toBeVisible();
    const width2 = (await sidebar.boundingBox())?.width || 0;

    // Width should remain within reasonable delta of prior width (allowing for layout shifts)
    test.info().annotations.push({ type: 'width-persist', description: JSON.stringify({ width1, width2, diff: Math.abs(width2 - width1) }) });
    expect(Math.abs(width2 - width1)).toBeLessThanOrEqual(100);
  });
});

test.describe('AI Sidebar - Processing Indicator Global Pending', () => {
  test('processing indicator appears for window prompt (primary or fallback)', async ({ page }) => {
    await openAISidebar(page, 'ai=1&aimock=1');

    // Trigger prompt auto-submit
    await page.evaluate(() => (window as any).SVMAI?.prompt('Test processing indicator', true));

    // Indicator must appear (select one of possible dual status elements)
    await page.waitForFunction(() => {
      return !!document.querySelector('[data-ai-processing-status][data-ai-processing-active="1"], #svmai-temp-processing[data-ai-processing-active="1"]');
    }, null, { timeout: 2000 });
    const indicator = page.locator('[data-ai-processing-status][data-ai-processing-active="1"], #svmai-temp-processing[data-ai-processing-active="1"]').first();
    await expect(indicator).toHaveText(/Processing/i, { timeout: 1500 });

    // Wait for it to eventually clear (allow mock to finish)
    await page.waitForTimeout(1200);
  });
});

test.describe('AI Sidebar - Persistence of Messages & Tabs (basic)', () => {
  test('messages persist across reload', async ({ page }) => {
    await openAISidebar(page);

    // Send a user message via API prompt
    const uniqueText = `Persistence test ${Date.now()}`;
    await page.evaluate(t => (window as any).SVMAI?.prompt(t, true), uniqueText);

    // Wait for message presence robustly
    await page.waitForFunction((txt) => {
      return Array.from(document.querySelectorAll('[data-ai-msg-index]')).some(el => el.textContent?.includes(txt));
    }, uniqueText, { timeout: 8000 });

    // Reload and verify still present (relaxed visibility)
    await page.reload();
    await page.waitForFunction(() => typeof (window as any).SVMAI !== 'undefined', null, { timeout: 8000 });
    await page.evaluate(() => (window as any).SVMAI?.open?.());
    const sidebarRoot = page.locator('[data-ai-sidebar-root],[data-ai-sidebar]').first();
    await expect(sidebarRoot).toHaveAttribute('data-open', '1', { timeout: 8000 });
    await page.waitForFunction((txt) => {
      return Array.from(document.querySelectorAll('[data-ai-msg-index]')).some(el => el.textContent?.includes(txt));
    }, uniqueText, { timeout: 8000 });
  });
});

/**
 * NOTE:
 * - Export / sharing, advanced slash commands, agent retry flows will be covered in a subsequent spec.
 * - Accessibility deep checks already exist in ai-sidebar-a11y.spec.ts.
 */
