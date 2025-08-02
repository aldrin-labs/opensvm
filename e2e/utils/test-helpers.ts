import { Page, expect } from '@playwright/test';

// Test utility function for generating secure test signatures
export function generateSecureTestSignature(prefix: string = 'test-signature'): string {
    const randomPart = Math.random().toString(36).substring(2, 9);
    const timestamp = Date.now().toString(36);
    return `${prefix}-${timestamp}-${randomPart}`;
}

// Wait for loading spinners to disappear
export async function waitForLoadingToComplete(page: Page, timeout = 30000) {
    try {
        await page.waitForFunction(() => {
            const loadingSpinners = document.querySelectorAll('.animate-spin, .loading, [data-loading="true"]');
            return loadingSpinners.length === 0;
        }, { timeout });
    } catch (error) {
        console.log('Loading spinner timeout - continuing with test');
    }
}
// Wait for React hydration and tab navigation to be ready
export async function waitForReactHydration(page: Page, timeout = 30000) {
    try {
        // Wait for React to hydrate and tab navigation to be present
        await page.waitForFunction(() => {
            // Check if React has hydrated by looking for interactive elements
            const buttons = document.querySelectorAll('button[data-value], .grid button');
            const hasButtons = buttons.length > 0;
            
            // Check if buttons are actually clickable and visible (not just present in DOM)
            const hasVisibleButtons = Array.from(buttons).some(btn => {
                if (!(btn instanceof HTMLElement)) return false;
                if (btn.hasAttribute('disabled')) return false;
                
                // More comprehensive visibility check
                const style = window.getComputedStyle(btn);
                const rect = btn.getBoundingClientRect();
                
                return (
                    btn.offsetParent !== null && // element is visible in layout
                    style.visibility !== 'hidden' &&
                    style.display !== 'none' &&
                    style.opacity !== '0' &&
                    rect.width > 0 &&
                    rect.height > 0 &&
                    rect.top >= 0 && // not scrolled out of view
                    rect.left >= 0
                );
            });
            
            return hasButtons && hasVisibleButtons;
        }, { timeout });
    } catch (error) {
        console.log('React hydration timeout - continuing with test');
    }
}

// Enhanced wait for transaction tab layout to be fully ready
export async function waitForTransactionTabLayout(page: Page, timeout = 30000) {
    try {
        await page.waitForFunction(() => {
            // Wait for the transaction tab content to be ready
            const tabContent = document.querySelector('[data-testid="transaction-tab-content"]');
            const tabButtons = document.querySelectorAll('button[data-value]');
            const hasValidButtons = tabButtons.length >= 6; // Should have at least 6 main tabs
            
            // Check if the grid container is properly laid out
            const gridContainer = document.querySelector('.grid.grid-cols-4, .grid.grid-cols-8');
            const hasGridLayout = gridContainer && window.getComputedStyle(gridContainer).display === 'grid';
            
            // Verify at least one button is properly visible
            const hasVisibleButton = Array.from(tabButtons).some(btn => {
                if (!(btn instanceof HTMLElement)) return false;
                const style = window.getComputedStyle(btn);
                const rect = btn.getBoundingClientRect();
                
                return (
                    style.visibility === 'visible' &&
                    style.display !== 'none' &&
                    parseFloat(style.opacity) > 0.5 &&
                    rect.width > 50 && // reasonable button width
                    rect.height > 20   // reasonable button height
                );
            });
            
            return tabContent && hasValidButtons && hasGridLayout && hasVisibleButton;
        }, { timeout });
    } catch (error) {
        console.log('Transaction tab layout timeout - continuing with test');
    }
}


// Wait for table to load with data or error
export async function waitForTableLoad(page: Page, timeout = 15000) {
    try {
        await Promise.race([
            page.waitForSelector('table tbody tr', { state: 'attached', timeout }),
            page.waitForSelector('.text-red-400, .text-destructive, [role="alert"]', { state: 'attached', timeout })
        ]);
    } catch (error) {
        console.log('Table load timeout - continuing with test');
    }
}

// Wait for analytics tab to load
export async function waitForAnalyticsTabLoad(page: Page, tabName: string, timeout = 30000) {
    const startTime = Date.now();

    try {
        // Click the tab
        await page.click(`button:has-text("${tabName}")`, { timeout: 5000 });

        // Wait for loading to complete
        await page.waitForFunction(() => {
            const loadingElement = document.querySelector('.animate-spin, .loading');
            const errorElement = document.querySelector('.text-destructive, [role="alert"]');
            const contentElement = document.querySelector('table, .chart, .metric, .data-point');

            return !loadingElement && (contentElement || errorElement);
        }, { timeout });

        const loadTime = Date.now() - startTime;
        return { success: true, loadTime };
    } catch (error) {
        const loadTime = Date.now() - startTime;
        console.log(`Tab ${tabName} failed to load within ${timeout}ms (actual: ${loadTime}ms)`);
        return { success: false, loadTime, error: error.message };
    }
}

// Check if element exists and is visible
export async function isElementVisible(page: Page, selector: string): Promise<boolean> {
    try {
        const element = page.locator(selector);
        return await element.isVisible();
    } catch {
        return false;
    }
}

// Get element count safely
export async function getElementCount(page: Page, selector: string): Promise<number> {
    try {
        return await page.locator(selector).count();
    } catch {
        return 0;
    }
}

// Wait for API response
export async function waitForApiResponse(page: Page, urlPattern: string, timeout = 15000) {
    try {
        const response = await page.waitForResponse(
            response => response.url().includes(urlPattern) && response.status() === 200,
            { timeout }
        );
        return { success: true, response };
    } catch (error) {
        console.log(`API response timeout for pattern: ${urlPattern}`);
        return { success: false, error: error.message };
    }
}

// Handle test failures gracefully
export function handleTestFailure(testName: string, error: any) {
    console.error(`Test failed: ${testName}`);
    console.error('Error details:', error);

    // Return a structured error for better debugging
    return {
        testName,
        error: error.message || error,
        timestamp: new Date().toISOString(),
        stack: error.stack
    };
}

// Test constants
export const TEST_CONSTANTS = {
    TIMEOUTS: {
        SHORT: 5000,
        MEDIUM: 15000,
        LONG: 30000,
        EXTRA_LONG: 60000
    },
    TEST_ADDRESSES: {
        VALID_ACCOUNT: 'DtdSSG8ZJRZVv5Jx7K1MeWp7Zxcu19GD5wQRGRpQ9uMF',
        VALID_TOKEN: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
        VALID_TRANSACTION: '4RwR2w12LydcoutGYJz2TbVxY8HVV44FCN2xoo1L9xu7ZcFxFBpoxxpSFTRWf9MPwMzmr9yTuJZjGqSmzcrawF43',
        INVALID_ADDRESS: 'invalid_address_format'
    }
};

// Performance measurement helper
export async function measurePerformance(page: Page, action: () => Promise<void>) {
    const startTime = Date.now();
    await action();
    const endTime = Date.now();
    return endTime - startTime;
}

// Retry helper for flaky operations
export async function retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries = 3,
    delay = 1000
): Promise<T> {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await operation();
        } catch (error) {
            if (i === maxRetries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    throw new Error('Max retries exceeded');
} 