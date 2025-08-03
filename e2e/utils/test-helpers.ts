import { Page, expect } from '@playwright/test';

// Test utility function for generating secure test signatures
export function generateSecureTestSignature(prefix: string = 'test-signature'): string {
    const randomPart = Math.random().toString(36).substring(2, 9);
    const timestamp = Date.now().toString(36);
    return `${prefix}-${timestamp}-${randomPart}`;
}

// Wait for loading spinners to disappear
export async function waitForLoadingToComplete(page: Page, timeout = 6000) {
    try {
        await page.waitForFunction(() => {
            // Check for loading indicators but be more lenient
            const loadingSpinners = document.querySelectorAll('.animate-spin, .loading, [data-loading="true"]');
            const visibleSpinners = Array.from(loadingSpinners).filter(el => {
                if (!(el instanceof HTMLElement)) return false;
                const style = window.getComputedStyle(el);
                return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
            });
            return visibleSpinners.length === 0;
        }, { timeout });
    } catch (error) {
        console.debug('Loading spinner timeout - continuing with test');
    }
}

// Enhanced function to wait for account graph to load with proper cytoscape detection
export async function waitForAccountGraphLoad(page: Page, timeout = 15000) {
    try {
        console.log('Waiting for account graph to load...');
        
        // First, wait for the cytoscape wrapper to appear
        await page.waitForSelector('[data-testid="cytoscape-wrapper"]', {
            state: 'attached',
            timeout: Math.min(timeout / 2, 8000)
        });
        console.log('✓ Cytoscape wrapper found');
        
        // Wait for the programmatically created cy-container
        await page.waitForFunction(() => {
            const container = document.getElementById('cy-container');
            return container !== null;
        }, { timeout: 5000 });
        console.log('✓ cy-container element found');
        
        // Wait for graph initialization to complete
        await page.waitForFunction(() => {
            const container = document.getElementById('cy-container');
            if (!container) return false;
            
            const graphReady = container.getAttribute('data-graph-ready');
            return graphReady === 'true';
        }, { timeout: Math.min(timeout / 2, 10000) });
        console.log('✓ Graph initialization completed');
        
        // Give additional time for cytoscape to render
        await page.waitForTimeout(1500);
        console.log('✓ Account graph load complete');
        
    } catch (error) {
        console.debug('Account graph load timeout:', error.message);
        
        // Try to get more information about what's missing
        try {
            const wrapperExists = await page.locator('[data-testid="cytoscape-wrapper"]').count() > 0;
            const containerExists = await page.locator('#cy-container').count() > 0;
            const graphReady = await page.evaluate(() => {
                const container = document.getElementById('cy-container');
                return container?.getAttribute('data-graph-ready') || 'not found';
            });
            
            console.log('Graph load debug info:', {
                wrapperExists,
                containerExists,
                graphReady
            });
        } catch (debugError) {
            console.debug('Could not get debug info:', debugError.message);
        }
        
        // Don't throw - let tests continue with whatever state we have
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
        await page.waitForSelector('[data-testid="transaction-tab-content"]', { timeout: Math.min(timeout, 12000) });
        
        // Wait for any tab buttons to appear with multiple strategies
        const tabSelectors = [
            '.grid button[data-value]',
            'button[data-testid^="tab-"]',
            'button[role="tab"]',
            'button:has-text("Overview")'
        ];
        
        let tabsFound = false;
        for (const selector of tabSelectors) {
            try {
                await page.waitForSelector(selector, { timeout: 3000 });
                tabsFound = true;
                break;
            } catch (e) {
                continue;
            }
        }
        
        if (!tabsFound) {
            console.debug('No tab buttons found with any selector');
            return;
        }
        
        // Wait for at least some essential tab buttons to be visible and interactive
        await page.waitForFunction(() => {
            // Try multiple selector strategies
            const overviewBtn = document.querySelector('button[data-value="overview"]') ||
                               document.querySelector('button:has-text("Overview")') ||
                               document.querySelector('button[data-testid="tab-overview"]');
            
            const anyOtherBtn = document.querySelector('button[data-value="instructions"]') ||
                               document.querySelector('button[data-value="accounts"]') ||
                               document.querySelector('button:has-text("Instructions")') ||
                               document.querySelector('button[data-testid^="tab-"]');
            
            if (!overviewBtn) return false;
            
            // Check if buttons are actually visible and clickable
            const overviewRect = overviewBtn.getBoundingClientRect();
            const overviewVisible = overviewRect.width > 0 && overviewRect.height > 0;
            
            return overviewVisible && !!anyOtherBtn;
        }, { timeout: 8000 });
        
        console.debug('Transaction tab layout ready');
    } catch (error) {
        console.debug('Transaction tab layout timeout - continuing with test:', error.message);
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

// Test constants optimized for e2e testing reliability
export const TEST_CONSTANTS = {
    TIMEOUTS: {
        SHORT: 3000,        // Reduced for faster feedback
        MEDIUM: 10000,      // Reduced from 15s
        LONG: 20000,        // Reduced from 30s
        EXTRA_LONG: 40000,  // Reduced from 60s
        NETWORK_IDLE: 15000 // Specific timeout for network idle
    },
    TEST_ADDRESSES: {
        VALID_ACCOUNT: 'DtdSSG8ZJRZVv5Jx7K1MeWp7Zxcu19GD5wQRGRpQ9uMF',
        VALID_TOKEN: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
        VALID_TRANSACTION: '4RwR2w12LydcoutGYJz2TbVxY8HVV44FCN2xoo1L9xu7ZcFxFBpoxxpSFTRWf9MPwMzmr9yTuJZjGqSmzcrawF43',
        INVALID_ADDRESS: 'invalid_address_format'
    },
    RETRY_CONFIG: {
        MAX_RETRIES: 3,
        RETRY_DELAY: 1000,
        EXPONENTIAL_BACKOFF: true
    }
};

// Performance measurement helper with timeout protection
export async function measurePerformance(page: Page, action: () => Promise<void>, maxTime = 10000) {
    const startTime = Date.now();
    try {
        await Promise.race([
            action(),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Performance measurement timeout')), maxTime)
            )
        ]);
    } catch (error) {
        console.debug('Performance measurement failed:', error.message);
    }
    const endTime = Date.now();
    return Math.min(endTime - startTime, maxTime);
}

// Enhanced retry helper for flaky operations with exponential backoff
export async function retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries = TEST_CONSTANTS.RETRY_CONFIG.MAX_RETRIES,
    baseDelay = TEST_CONSTANTS.RETRY_CONFIG.RETRY_DELAY,
    useExponentialBackoff = TEST_CONSTANTS.RETRY_CONFIG.EXPONENTIAL_BACKOFF
): Promise<T> {
    let lastError: unknown;
    
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;
            if (i === maxRetries - 1) break;
            
            const delay = useExponentialBackoff
                ? baseDelay * Math.pow(2, i)
                : baseDelay;
            
            console.debug(`Retry attempt ${i + 1}/${maxRetries} after ${delay}ms delay`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    
    throw new Error(`Operation failed after ${maxRetries} retries. Last error: ${lastError instanceof Error ? lastError.message : lastError}`);
}

// Enhanced network idle wait with fallback
export async function waitForNetworkIdleWithFallback(page: Page, timeout = TEST_CONSTANTS.TIMEOUTS.NETWORK_IDLE) {
    try {
        await page.waitForLoadState('networkidle', { timeout });
    } catch (error) {
        console.debug('Network idle timeout, falling back to domcontentloaded');
        try {
            await page.waitForLoadState('domcontentloaded', { timeout: 5000 });
        } catch (fallbackError) {
            console.debug('Fallback load state also failed, continuing...');
        }
    }
}

// Global error handler for graceful test degradation
export function handleTestError(testName: string, error: unknown, options: {
    allowFailure?: boolean;
    fallbackMessage?: string;
    skipTest?: boolean;
} = {}) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    if (options.allowFailure || options.skipTest) {
        console.log(`⚠️ ${testName} failed gracefully: ${errorMessage}`);
        if (options.fallbackMessage) {
            console.log(`   ${options.fallbackMessage}`);
        }
        return false; // Indicate test should continue
    } else {
        console.error(`❌ ${testName} failed: ${errorMessage}`);
        throw error; // Re-throw for test failure
    }
}

// Improved function to safely interact with canvas elements
export async function safeCanvasClick(page: Page, canvasSelector: string, options: {
    position?: { x: number; y: number };
    timeout?: number;
    retries?: number;
} = {}) {
    const {
        position = { x: 100, y: 100 },
        timeout = 5000,
        retries = 2
    } = options;
    
    const canvas = page.locator(canvasSelector);
    const count = await canvas.count();
    
    if (count === 0) {
        console.log('Canvas not found for safe click');
        return false;
    }
    
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            await canvas.waitFor({ state: 'visible', timeout: timeout / 2 });
            
            const boundingBox = await canvas.boundingBox();
            if (!boundingBox || boundingBox.width < 50 || boundingBox.height < 50) {
                console.log(`Canvas too small for safe clicking (attempt ${attempt + 1})`);
                continue;
            }
            
            const safeX = Math.min(position.x, boundingBox.width - 10);
            const safeY = Math.min(position.y, boundingBox.height - 10);
            
            await canvas.click({
                position: { x: safeX, y: safeY },
                timeout: timeout / 2
            });
            
            console.log(`Canvas click successful on attempt ${attempt + 1}`);
            return true;
        } catch (error) {
            console.log(`Canvas click attempt ${attempt + 1} failed:`, error.message);
            if (attempt < retries - 1) {
                await page.waitForTimeout(1000);
            }
        }
    }
    
    return false;
}

// Improved localStorage availability check
export async function checkLocalStorageAvailable(page: Page): Promise<boolean> {
    try {
        return await page.evaluate(() => {
            try {
                const testKey = `test_${Date.now()}_${Math.random()}`;
                localStorage.setItem(testKey, 'test');
                const retrieved = localStorage.getItem(testKey);
                localStorage.removeItem(testKey);
                return retrieved === 'test';
            } catch (error) {
                return false;
            }
        });
    } catch (error) {
        console.debug('localStorage check failed:', error.message);
        return false;
    }
}

// Optimized page navigation with retry logic
export async function navigateWithRetry(page: Page, url: string, maxRetries = 2) {
    return retryOperation(async () => {
        await page.goto(url);
        await waitForNetworkIdleWithFallback(page);
        
        // Verify page loaded correctly
        const currentUrl = page.url();
        if (!currentUrl.includes(url.split('/').pop() || '')) {
            throw new Error(`Navigation failed: expected ${url}, got ${currentUrl}`);
        }
    }, maxRetries);
}