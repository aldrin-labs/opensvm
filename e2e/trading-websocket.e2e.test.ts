/**
 * E2E Tests for Trading WebSocket Implementation
 *
 * Tests real-time data streaming, connection management, and UI updates
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const TRADING_TERMINAL_URL = `${BASE_URL}/trading-terminal`;

// Extend timeout for WebSocket connection tests
test.setTimeout(60000);

test.describe('Trading WebSocket E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to trading terminal
    await page.goto(TRADING_TERMINAL_URL);

    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');
  });

  test('should load trading terminal page', async ({ page }) => {
    // Check that the page title exists
    await expect(page).toHaveTitle(/OpenSVM/);

    // Check for key UI elements
    const tradingChart = page.locator('.trading-chart');
    await expect(tradingChart).toBeVisible();

    const tradeHistory = page.locator('.trade-history');
    await expect(tradeHistory).toBeVisible();
  });

  test('should establish WebSocket connection and show Live status', async ({ page }) => {
    // Wait for connection to establish (max 10 seconds)
    const connectionStatus = page.locator('text=Live').first();
    await expect(connectionStatus).toBeVisible({ timeout: 10000 });

    console.log('✓ WebSocket connection established');
  });

  test('should show connection status indicators', async ({ page }) => {
    // Look for Wifi icons (connection indicators)
    const wifiIcons = page.locator('svg').filter({ hasText: /Wifi/ });
    await expect(wifiIcons.first()).toBeVisible({ timeout: 10000 });

    // Check for "Live" or "Offline" text
    const statusText = page.locator('text=/Live|Offline|Reconnecting/').first();
    await expect(statusText).toBeVisible();

    console.log('✓ Connection status indicators visible');
  });

  test('should receive trade events within 10 seconds', async ({ page }) => {
    // Listen for console logs indicating trade events
    const tradeEvents: string[] = [];
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.includes('[TradingChart] Received trade:') ||
          text.includes('[TradeHistory] New trade:')) {
        tradeEvents.push(text);
      }
    });

    // Wait for at least one trade event (SSE sends trades every 2-5 seconds)
    await page.waitForTimeout(10000);

    expect(tradeEvents.length).toBeGreaterThan(0);
    console.log(`✓ Received ${tradeEvents.length} trade events`);
  });

  test('should display trades in TradeHistory component', async ({ page }) => {
    // Wait for connection
    await page.waitForSelector('text=Live', { timeout: 10000 });

    // Wait for trades to populate (give it 8 seconds for trades to arrive)
    await page.waitForTimeout(8000);

    // Check for trade entries
    const tradeEntries = page.locator('.trade-history').locator('div').filter({
      hasText: /\d+:\d+:\d+/ // Time format HH:MM:SS
    });

    const count = await tradeEntries.count();
    expect(count).toBeGreaterThan(0);

    console.log(`✓ Found ${count} trade entries in UI`);
  });

  test('should show trade count indicator', async ({ page }) => {
    // Wait for connection
    await page.waitForSelector('text=Live', { timeout: 10000 });

    // Wait for trades
    await page.waitForTimeout(8000);

    // Look for trade count (e.g., "10 trades")
    const tradeCount = page.locator('text=/\\d+ trades/');
    await expect(tradeCount).toBeVisible({ timeout: 5000 });

    console.log('✓ Trade count indicator visible');
  });

  test('should update chart with live data', async ({ page }) => {
    // Wait for connection
    await page.waitForSelector('text=Live', { timeout: 10000 });

    // Check for canvas element (where chart is drawn)
    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible();

    // Wait for data to populate
    await page.waitForTimeout(8000);

    // Check for data source indicator showing live data
    const dataSource = page.locator('text=/Live Trades|Live WebSocket/');
    await expect(dataSource).toBeVisible({ timeout: 5000 });

    console.log('✓ Chart showing live data');
  });

  test('should handle market switching', async ({ page }) => {
    // Wait for initial connection
    await page.waitForSelector('text=Live', { timeout: 10000 });

    // Find and click a different market (if available)
    // Note: This depends on your UI structure
    const marketSelectors = page.locator('button').filter({ hasText: /BONK|JUP|PYTH/ });
    const marketCount = await marketSelectors.count();

    if (marketCount > 0) {
      await marketSelectors.first().click();

      // Wait for reconnection
      await page.waitForTimeout(2000);

      // Verify still connected or reconnecting
      const status = page.locator('text=/Live|Reconnecting/');
      await expect(status).toBeVisible({ timeout: 10000 });

      console.log('✓ Market switching handled correctly');
    } else {
      console.log('⊘ No additional markets found to test switching');
    }
  });

  test('should show reconnection status on connection loss', async ({ page }) => {
    // Wait for connection
    await page.waitForSelector('text=Live', { timeout: 10000 });

    // Simulate connection loss by going offline
    await page.context().setOffline(true);

    // Wait a moment for the connection to fail
    await page.waitForTimeout(3000);

    // Check for "Offline" or "Reconnecting" status
    const offlineStatus = page.locator('text=/Offline|Reconnecting/');
    await expect(offlineStatus).toBeVisible({ timeout: 5000 });

    console.log('✓ Offline status shown correctly');

    // Bring connection back online
    await page.context().setOffline(false);

    // Wait for reconnection
    await page.waitForTimeout(5000);

    // Should reconnect and show Live status
    const liveStatus = page.locator('text=Live').first();
    await expect(liveStatus).toBeVisible({ timeout: 15000 });

    console.log('✓ Reconnection successful');
  });

  test('should receive heartbeat events', async ({ page }) => {
    // Listen for heartbeat logs
    const heartbeats: string[] = [];
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.includes('heartbeat')) {
        heartbeats.push(text);
      }
    });

    // Wait for connection
    await page.waitForSelector('text=Live', { timeout: 10000 });

    // Wait for heartbeat (sent every 15 seconds, so wait 20 seconds)
    await page.waitForTimeout(20000);

    // Should have received at least one heartbeat
    expect(heartbeats.length).toBeGreaterThanOrEqual(1);
    console.log(`✓ Received ${heartbeats.length} heartbeat events`);
  });

  test('should not show memory leaks after prolonged use', async ({ page }) => {
    // Wait for connection
    await page.waitForSelector('text=Live', { timeout: 10000 });

    // Get initial memory usage
    const initialMetrics = await page.evaluate(() => {
      if (performance.memory) {
        return {
          usedJSHeapSize: performance.memory.usedJSHeapSize,
          totalJSHeapSize: performance.memory.totalJSHeapSize,
        };
      }
      return null;
    });

    // Let trades flow for 30 seconds
    await page.waitForTimeout(30000);

    // Get final memory usage
    const finalMetrics = await page.evaluate(() => {
      if (performance.memory) {
        return {
          usedJSHeapSize: performance.memory.usedJSHeapSize,
          totalJSHeapSize: performance.memory.totalJSHeapSize,
        };
      }
      return null;
    });

    if (initialMetrics && finalMetrics) {
      const memoryIncrease = finalMetrics.usedJSHeapSize - initialMetrics.usedJSHeapSize;
      const memoryIncreasePercent = (memoryIncrease / initialMetrics.usedJSHeapSize) * 100;

      console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB (${memoryIncreasePercent.toFixed(1)}%)`);

      // Memory should not increase by more than 50% (indicating a leak)
      expect(memoryIncreasePercent).toBeLessThan(50);

      console.log('✓ No significant memory leaks detected');
    } else {
      console.log('⊘ Memory metrics not available in this browser');
    }
  });

  test('should display correct timeframe options', async ({ page }) => {
    // Look for timeframe buttons
    const timeframes = ['1m', '5m', '15m', '1h', '4h', '1d', '1w'];

    for (const tf of timeframes) {
      const button = page.locator(`button:has-text("${tf}")`);
      await expect(button).toBeVisible();
    }

    console.log('✓ All timeframe options available');
  });

  test('should display chart type options', async ({ page }) => {
    // Check for chart type icons/buttons
    const candleButton = page.locator('button[title="Candlestick"]');
    const lineButton = page.locator('button[title="Line"]');
    const areaButton = page.locator('button[title="Area"]');

    await expect(candleButton).toBeVisible();
    await expect(lineButton).toBeVisible();
    await expect(areaButton).toBeVisible();

    console.log('✓ All chart type options available');
  });

  test('should handle rapid component updates without crashes', async ({ page }) => {
    // Wait for connection
    await page.waitForSelector('text=Live', { timeout: 10000 });

    // Rapidly switch timeframes
    const timeframes = ['1m', '5m', '15m', '1h'];
    for (const tf of timeframes) {
      const button = page.locator(`button:has-text("${tf}")`).first();
      await button.click();
      await page.waitForTimeout(100); // Small delay between clicks
    }

    // Verify page still works
    const liveStatus = page.locator('text=Live').first();
    await expect(liveStatus).toBeVisible();

    console.log('✓ Handles rapid updates without crashes');
  });

  test('should show proper error state on SSE failure', async ({ page }) => {
    // Block SSE endpoint
    await page.route('**/api/trading/stream*', route => route.abort());

    // Reload page
    await page.reload();

    // Wait for error state
    await page.waitForTimeout(5000);

    // Should show offline or error status
    const errorStatus = page.locator('text=/Offline|Reconnecting|error/i');
    await expect(errorStatus).toBeVisible({ timeout: 10000 });

    console.log('✓ Error state displayed correctly');
  });
});

test.describe('Performance Tests', () => {
  test('page load performance', async ({ page }) => {
    const startTime = Date.now();

    await page.goto(TRADING_TERMINAL_URL);
    await page.waitForLoadState('networkidle');

    const loadTime = Date.now() - startTime;

    console.log(`Page load time: ${loadTime}ms`);

    // Should load in under 5 seconds
    expect(loadTime).toBeLessThan(5000);
  });

  test('WebSocket connection establishment speed', async ({ page }) => {
    await page.goto(TRADING_TERMINAL_URL);

    const startTime = Date.now();

    // Wait for Live status
    await page.waitForSelector('text=Live', { timeout: 10000 });

    const connectionTime = Date.now() - startTime;

    console.log(`WebSocket connection time: ${connectionTime}ms`);

    // Should connect in under 3 seconds
    expect(connectionTime).toBeLessThan(3000);
  });

  test('trade event processing speed', async ({ page }) => {
    await page.goto(TRADING_TERMINAL_URL);
    await page.waitForSelector('text=Live', { timeout: 10000 });

    let firstTradeTime: number | null = null;
    let tradeCount = 0;

    page.on('console', (msg) => {
      if (msg.text().includes('Received trade:')) {
        if (!firstTradeTime) {
          firstTradeTime = Date.now();
        }
        tradeCount++;
      }
    });

    // Wait for trades
    await page.waitForTimeout(10000);

    if (firstTradeTime && tradeCount > 0) {
      const processingTime = Date.now() - firstTradeTime;
      const avgTimePerTrade = processingTime / tradeCount;

      console.log(`Processed ${tradeCount} trades in ${processingTime}ms`);
      console.log(`Average time per trade: ${avgTimePerTrade.toFixed(2)}ms`);

      // Average processing should be under 50ms per trade
      expect(avgTimePerTrade).toBeLessThan(50);
    }
  });
});
