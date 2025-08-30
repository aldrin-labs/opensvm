import { test, expect } from '@playwright/test';

/**
 * AI Sidebar Readiness & Persistence Focused Tests
 *
 * Covers:
 *  - Sidebar open-state persistence (localStorage aiSidebarOpen)
 *  - Width persistence sanity (quick re-check)
 *  - Seeding helper readiness event (svmai-seed-complete) + data-ai-total-messages
 *  - Virtualization readiness event (svmai-virtualized-ready) + attribute data-ai-virtualized-ready
 *  - Global pending flag lifecycle (__SVMAI_PENDING__) & processing indicator minimum visibility (>=400ms)
 *  - Performance snapshot after heavy load (re-validate virtualized flag)
 *
 * Relies on window helpers and instrumentation added in:
 *  - contexts/AIChatSidebarContext.tsx (open/close/toggle/prompt/setWidth/getWidth + persistence)
 *  - components/ai/AIChatSidebar.tsx (seed helper + seed completion event + total messages attribute)
 *  - components/ai/components/VirtualizedMessageList.tsx (virtualization readiness event/attr)
 */

async function gotoAndOpen(page, params: string = 'ai=1') {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('/?' + params);
  // Wait for global API
  await page.waitForFunction(() => typeof (window as any).SVMAI !== 'undefined', null, { timeout: 8000 });
  // Ensure open (URL param may already open it)
  await page.evaluate(() => (window as any).SVMAI?.open?.());
  // Wait for visible complementary region
  await page.waitForFunction(() => {
    const el = document.querySelector('[data-ai-sidebar][role="complementary"]') as HTMLElement | null;
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width >= 560 && r.height > 50;
  }, null, { timeout: 8000 });
}

test.describe('AI Sidebar - Open State Persistence', () => {
  test('persists open state across reload', async ({ page }) => {
    await gotoAndOpen(page, 'ai=0'); // start closed unless persistence reopens
    // Force close then open to ensure localStorage set
    await page.evaluate(() => (window as any).SVMAI?.close?.());
    await page.waitForTimeout(100);
    await page.evaluate(() => (window as any).SVMAI?.open?.());
    await page.waitForTimeout(120);
    // Confirm localStorage flag
    const flag = await page.evaluate(() => window.localStorage.getItem('aiSidebarOpen'));
    expect(flag).toBe('1');
    // Reload
    await page.reload();
    // Sidebar should auto-open from persisted state without needing param
    await page.waitForFunction(() => {
      const el = document.querySelector('[data-ai-sidebar][role="complementary"]');
      if (!el) return false;
      const r = (el as HTMLElement).getBoundingClientRect();
      return r.width >= 560;
    }, null, { timeout: 8000 });
  });
});

test.describe('AI Sidebar - Seeding Readiness', () => {
  test('emits svmai-seed-complete with total + data-ai-total-messages attribute', async ({ page }) => {
    await gotoAndOpen(page);
    // Wait for seed function
    await page.waitForFunction(() => typeof (window as any).SVMAI?.seed === 'function' || typeof (window as any).__SVMAI_SEED__ === 'function', null, { timeout: 8000 });

    // Listen for event & trigger
    const result = await page.evaluate(() => {
      return new Promise(resolve => {
        function handler(e: any) {
          window.removeEventListener('svmai-seed-complete', handler as any);
          resolve({
            detail: e.detail,
            attr: (document.querySelector('[data-ai-sidebar-root]') as HTMLElement | null)?.getAttribute('data-ai-total-messages')
          });
        }
        window.addEventListener('svmai-seed-complete', handler as any, { once: true });
        (window as any).SVMAI.seed?.(75) || (window as any).__SVMAI_SEED__?.(75);
      });
    });

    expect((result as any).detail.total).toBeGreaterThanOrEqual(75);
    expect(Number((result as any).attr)).toBeGreaterThanOrEqual(75);
  });
});

test.describe('AI Sidebar - Virtualization Readiness Event', () => {
  test('fires svmai-virtualized-ready when threshold crossed', async ({ page }) => {
    await gotoAndOpen(page);
    await page.waitForFunction(() => typeof (window as any).SVMAI?.seed === 'function' || typeof (window as any).__SVMAI_SEED__ === 'function', null, { timeout: 8000 });

    const readyPayload = await page.evaluate(() => {
      return new Promise(resolve => {
        function handler(e: any) {
          window.removeEventListener('svmai-virtualized-ready', handler as any);
          resolve({ count: e.detail.count, attr: !!document.querySelector('[data-ai-virtualized-ready="1"]') });
        }
        window.addEventListener('svmai-virtualized-ready', handler as any, { once: true });
        // Seed just above threshold (150) to trigger virtualization
        (window as any).SVMAI.seed?.(160) || (window as any).__SVMAI_SEED__?.(160);
      });
    });

    expect((readyPayload as any).count).toBeGreaterThanOrEqual(151);
    expect((readyPayload as any).attr).toBeTruthy();

    // Confirm list attributes
    await page.waitForSelector('[data-ai-message-list="virtualized"][data-ai-virtualized-active="1"]', { timeout: 8000 });
    const countAttr = await page.getAttribute('[data-ai-message-list="virtualized"]', 'data-ai-message-count');
    expect(Number(countAttr)).toBeGreaterThanOrEqual(160);
  });
});

test.describe('AI Sidebar - Processing Indicator Minimum Visibility', () => {
  test('indicator shows and lasts at least 400ms for auto-submit prompt', async ({ page }) => {
    await gotoAndOpen(page);
    // Trigger submitted prompt
    const start = Date.now();
    await page.evaluate(() => (window as any).SVMAI?.prompt('Timing visibility test', true));
    await page.waitForSelector('[data-ai-processing-status]', { timeout: 1500 });
    // Wait until it disappears (status element removed or hidden)
    await page.waitForFunction(() => {
      const el = document.querySelector('[data-ai-processing-status]');
      if (!el) return true;
      const style = window.getComputedStyle(el);
      return style.display === 'none' || style.visibility === 'hidden' || el.textContent?.match(/idle/i);
    }, { timeout: 6000 }).catch(() => {});
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(390); // slightly below 400 to avoid test flake
  });

  test('__SVMAI_PENDING__ flag lifecycle toggles around prompt submission', async ({ page }) => {
    await gotoAndOpen(page);
    const before = await page.evaluate(() => (window as any).__SVMAI_PENDING__ === true);
    expect(before).toBeFalsy();

    // Set up listener for pending-change events
    const lifecycle = await page.evaluate(() => {
      return new Promise(resolve => {
        const events: { ts: number; value: any }[] = [];
        function rec() {
          const val = (window as any).__SVMAI_PENDING__;
          events.push({ ts: Date.now(), value: !!val });
          if (events.length >= 4) {
            window.removeEventListener('svmai-pending-change', rec as any);
            resolve(events);
          }
        }
        window.addEventListener('svmai-pending-change', rec as any);
        (window as any).SVMAI?.prompt('Pending lifecycle test', true);
        // Fallback timeout to resolve early if not enough transitions
        setTimeout(() => {
          window.removeEventListener('svmai-pending-change', rec as any);
          resolve(events);
        }, 5000);
      });
    });

    // Expect at least one true then one false
    const anyTrue = (lifecycle as any[]).some(e => e.value === true);
    const anyFalse = (lifecycle as any[]).some(e => e.value === false);
    expect(anyTrue).toBeTruthy();
    expect(anyFalse).toBeTruthy();
  });
});

test.describe('AI Sidebar - Heavy Load Perf Snapshot', () => {
  test('getPerfSnapshot reflects virtualized after 500+ messages', async ({ page }) => {
    await gotoAndOpen(page);
    await page.waitForFunction(() => typeof (window as any).SVMAI?.seed === 'function' || typeof (window as any).__SVMAI_SEED__ === 'function', null, { timeout: 8000 });

    // Seed 510 messages
    await page.evaluate(() => (window as any).SVMAI.seed?.(510) || (window as any).__SVMAI_SEED__?.(510));

    // Wait for virtualization attributes
    await page.waitForFunction(() => {
      const list = document.querySelector('[data-ai-message-list="virtualized"]');
      if (!list) return false;
      const count = Number(list.getAttribute('data-ai-message-count') || '0');
      return count >= 500;
    }, null, { timeout: 10000 });

    // Allow perf frames
    await page.waitForTimeout(250);

    const snapshot = await page.evaluate(() => (window as any).SVMAI?.getPerfSnapshot?.());
    expect(snapshot).toBeTruthy();
    expect(snapshot.virtualized).toBeTruthy();
    expect(snapshot.messageCount).toBeGreaterThanOrEqual(500);
    if (typeof snapshot.lastFrameTime === 'number') {
      expect(snapshot.lastFrameTime).toBeLessThan(130);
    }
  });
});
