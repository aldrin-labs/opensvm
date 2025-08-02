import { Page, expect } from '@playwright/test';

// Test utility function for generating secure test signatures
export function generateSecureTestSignature(prefix: string = 'test-signature'): string {
    const randomPart = Math.random().toString(36).substring(2, 9);
    const timestamp = Date.now().toString(36);
    return `${prefix}-${timestamp}-${randomPart}`;
}

// Wait for loading spinners to disappear
export async function waitForLoadingToComplete(page: Page, timeout = 8000) {
    try {
        await page.waitForFunction(() => {
            // Check for loading indicators but be more lenient
            const loadingSpinners = document.querySelectorAll('.animate-spin, .loading, [data-loading="true"]');
            const visibleSpinners = Array.from(loadingSpinners).filter(el => {
                if (!(el instanceof HTMLElement)) return false;
                const style = window.getComputedStyle(el);
                return style.display !== 'none' && style.visibility !== 'hidden';
            });
            return visibleSpinners.length === 0;
        }, { timeout });
    } catch (error) {
        console.log('Loading spinner timeout - continuing with test');
    }
}
// Wait for React hydration and tab navigation to be ready
export async function waitForReactHydration(page: Page, timeout = 10000) {
    try {
        // Very basic check for React hydration - just ensure page is interactive
        await page.waitForFunction(() => {
            return document.readyState === 'complete' &&
                   document.body &&
                   document.body.children.length > 0;
        }, { timeout });
    } catch (error) {
        console.log('React hydration timeout - continuing with test');
    }
}

// Enhanced wait for transaction tab layout to be fully ready
export async function waitForTransactionTabLayout(page: Page, timeout = 15000) {
    try {
        // First wait for transaction data to load (this is when tabs appear in TransactionTabLayout)
        await page.waitForSelector('[data-testid="transaction-tab-content"]', { timeout });
        
        // Then wait for the specific grid structure with tab buttons
        await page.waitForSelector('.grid button[data-value]', { timeout: 10000 });
        
        // Wait for at least some essential tab buttons to be visible and interactive
        await page.waitForFunction(() => {
            const overviewBtn = document.querySelector('button[data-value="overview"]');
            const instructionsBtn = document.querySelector('button[data-value="instructions"]');
            
            if (!overviewBtn || !instructionsBtn) return false;
            
            // Check if buttons are actually visible and clickable
            const overviewRect = overviewBtn.getBoundingClientRect();
            const instructionsRect = instructionsBtn.getBoundingClientRect();
            
            const overviewVisible = overviewRect.width > 0 && overviewRect.height > 0;
            const instructionsVisible = instructionsRect.width > 0 && instructionsRect.height > 0;
            
            return overviewVisible && instructionsVisible;
        }, { timeout: 8000 });
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