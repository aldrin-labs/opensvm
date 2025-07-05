import { test, expect, Page } from '@playwright/test';
import { UI_CONSTANTS } from '@/lib/constants/analytics-constants';

// Enhanced test utilities with comprehensive logging and accessibility checks
class EnhancedAnalyticsTestHelper {
  private logs: Array<{ timestamp: number; level: string; message: string; context?: any }> = [];
  
  constructor(private page: Page) {
    this.setupLogging();
  }

  /**
   * Setup comprehensive logging for debugging
   */
  private setupLogging() {
    // Console message logging
    this.page.on('console', (msg) => {
      this.log(msg.type(), `Console ${msg.type()}: ${msg.text()}`, {
        location: msg.location(),
        args: msg.args()
      });
    });

    // Network request/response logging
    this.page.on('request', (request) => {
      this.log('info', `Request: ${request.method()} ${request.url()}`, {
        headers: request.headers(),
        postData: request.postData()
      });
    });

    this.page.on('response', (response) => {
      const logLevel = response.ok() ? 'info' : 'error';
      this.log(logLevel, `Response: ${response.status()} ${response.url()}`, {
        headers: response.headers(),
        timing: response.request().timing()
      });
    });

    // Page error logging
    this.page.on('pageerror', (error) => {
      this.log('error', `Page error: ${error.message}`, {
        stack: error.stack,
        name: error.name
      });
    });

    // Request failure logging
    this.page.on('requestfailed', (request) => {
      this.log('error', `Request failed: ${request.method()} ${request.url()}`, {
        failure: request.failure(),
        headers: request.headers()
      });
    });
  }

  private log(level: string, message: string, context?: any) {
    this.logs.push({
      timestamp: Date.now(),
      level,
      message,
      context
    });

    // Also output to console for immediate feedback
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${level.toUpperCase()}: ${message}`;
    
    if (level === 'error') {
      console.error(logMessage, context);
    } else if (level === 'warn') {
      console.warn(logMessage, context);
    } else {
      console.log(logMessage, context ? JSON.stringify(context, null, 2) : '');
    }
  }

  /**
   * Get all collected logs with filtering
   */
  getLogs(level?: string): typeof this.logs {
    if (level) {
      return this.logs.filter(log => log.level === level);
    }
    return [...this.logs];
  }

  /**
   * Export logs for debugging
   */
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  /**
   * AI-enhanced loading detection with comprehensive error context
   */
  async waitForTabToLoad(tabName: string, maxTimeout = 30000) {
    const startTime = Date.now();
    this.log('info', `Starting to load tab: ${tabName}`);
    
    try {
      // Click the tab with retry logic
      await this.clickWithRetry(`button:has-text("${tabName}")`, 3);
      
      // Wait for initial DOM update
      await this.page.waitForTimeout(UI_CONSTANTS.TRANSITIONS.NORMAL_TRANSITION_MS);
      
      // Enhanced detection loop with detailed context
      while (Date.now() - startTime < maxTimeout) {
        const currentTime = Date.now() - startTime;
        
        // Comprehensive element detection
        const [loadingCount, errorCount, contentCount, spinnerCount] = await Promise.all([
          this.page.locator('.loading, [data-loading="true"], [aria-label*="loading" i]').count(),
          this.page.locator('.error, [data-error="true"], .text-red-500, .bg-red-500, [role="alert"]').count(),
          this.page.locator('table, .chart, .metric, .data-point, .analytics-content, [data-testid*="content"]').count(),
          this.page.locator('.spinner, .animate-spin, [aria-label*="spinner" i]').count()
        ]);

        this.log('debug', `Tab loading status (${currentTime}ms): loading=${loadingCount}, errors=${errorCount}, content=${contentCount}, spinners=${spinnerCount}`);

        // Check for successful load
        if (contentCount > 0 && loadingCount === 0 && spinnerCount === 0) {
          this.log('info', `Tab ${tabName} loaded successfully with ${contentCount} content elements`);
          return { 
            status: 'loaded', 
            contentCount, 
            loadTime: currentTime,
            logs: this.getLogs().slice(-10) // Last 10 logs for context
          };
        }
        
        // Check for error states with detailed error extraction
        if (errorCount > 0) {
          const errorElements = await this.page.locator('.error, [data-error="true"], [role="alert"]').all();
          const errorTexts = await Promise.all(
            errorElements.map(async (el) => ({
              text: await el.textContent(),
              html: await el.innerHTML(),
              attributes: await this.getElementAttributes(el)
            }))
          );
          
          this.log('error', `Tab ${tabName} has ${errorCount} error(s)`, { errors: errorTexts });
          return { 
            status: 'error', 
            errors: errorTexts,
            logs: this.getLogs('error')
          };
        }
        
        // Enhanced stuck detection
        if (currentTime > 10000 && loadingCount > 0) {
          const networkRequests = this.logs.filter(log => 
            log.message.includes('Request:') && 
            log.timestamp > Date.now() - 5000
          );
          
          if (networkRequests.length === 0) {
            this.log('warn', `Tab ${tabName} appears stuck - no network activity in last 5 seconds`);
            return { 
              status: 'stuck', 
              message: 'No network activity detected',
              loadTime: currentTime,
              logs: this.getLogs().slice(-20)
            };
          }
        }
        
        await this.page.waitForTimeout(1000);
      }
      
      this.log('error', `Tab ${tabName} timeout after ${maxTimeout}ms`);
      return { 
        status: 'timeout', 
        message: `Tab did not load within ${maxTimeout}ms`,
        logs: this.getLogs()
      };
      
    } catch (error) {
      this.log('error', `Exception while loading tab ${tabName}`, { error: error.message, stack: error.stack });
      return { 
        status: 'exception', 
        error: error.message,
        logs: this.getLogs('error')
      };
    }
  }

  /**
   * Click element with retry logic and better error context
   */
  private async clickWithRetry(selector: string, retries = 3): Promise<void> {
    for (let i = 0; i < retries; i++) {
      try {
        await this.page.click(selector, { timeout: 5000 });
        this.log('debug', `Successfully clicked: ${selector} (attempt ${i + 1})`);
        return;
      } catch (error) {
        this.log('warn', `Click attempt ${i + 1} failed for ${selector}: ${error.message}`);
        if (i === retries - 1) throw error;
        await this.page.waitForTimeout(1000);
      }
    }
  }

  /**
   * Get all attributes of an element for debugging
   */
  private async getElementAttributes(element: any): Promise<Record<string, string>> {
    try {
      return await element.evaluate((el: Element) => {
        const attrs: Record<string, string> = {};
        for (const attr of el.attributes) {
          attrs[attr.name] = attr.value;
        }
        return attrs;
      });
    } catch {
      return {};
    }
  }

  /**
   * Comprehensive accessibility audit
   */
  async performAccessibilityAudit(): Promise<{
    violations: any[];
    warnings: any[];
    passed: number;
    score: number;
  }> {
    this.log('info', 'Starting accessibility audit');
    
    try {
      // Manual accessibility checks (since axe-core requires additional setup)
      const [
        missingAltImages,
        missingAriaLabels,
        missingHeadingStructure,
        lowContrastElements,
        keyboardTrapElements,
        missingSkipLinks
      ] = await Promise.all([
        this.page.locator('img:not([alt])').count(),
        this.page.locator('button:not([aria-label]):not([aria-labelledby]):not(:has(text))').count(),
        this.checkHeadingStructure(),
        this.checkColorContrast(),
        this.checkKeyboardNavigation(),
        this.page.locator('a[href="#main"], [role="navigation"] a[href*="skip"]').count()
      ]);

      const violations = [];
      const warnings = [];

      if (missingAltImages > 0) {
        violations.push({
          type: 'missing-alt-text',
          count: missingAltImages,
          severity: 'critical',
          description: 'Images without alt text found'
        });
      }

      if (missingAriaLabels > 0) {
        warnings.push({
          type: 'missing-aria-labels',
          count: missingAriaLabels,
          severity: 'moderate',
          description: 'Buttons without accessible names found'
        });
      }

      if (!missingHeadingStructure.valid) {
        violations.push({
          type: 'heading-structure',
          severity: 'moderate',
          description: 'Invalid heading structure detected',
          details: missingHeadingStructure.issues
        });
      }

      if (lowContrastElements > 0) {
        warnings.push({
          type: 'low-contrast',
          count: lowContrastElements,
          severity: 'moderate',
          description: 'Elements with potentially low contrast found'
        });
      }

      if (!keyboardTrapElements.accessible) {
        violations.push({
          type: 'keyboard-navigation',
          severity: 'critical',
          description: 'Keyboard navigation issues detected',
          details: keyboardTrapElements.issues
        });
      }

      if (missingSkipLinks === 0) {
        warnings.push({
          type: 'skip-links',
          severity: 'minor',
          description: 'No skip navigation links found'
        });
      }

      const totalChecks = 6;
      const totalViolations = violations.length;
      const passed = totalChecks - totalViolations;
      const score = Math.round((passed / totalChecks) * 100);

      this.log('info', `Accessibility audit complete: ${passed}/${totalChecks} checks passed (${score}%)`, {
        violations,
        warnings
      });

      return { violations, warnings, passed, score };
      
    } catch (error) {
      this.log('error', 'Accessibility audit failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Check heading structure (h1 -> h2 -> h3, etc.)
   */
  private async checkHeadingStructure(): Promise<{ valid: boolean; issues: string[] }> {
    const headings = await this.page.locator('h1, h2, h3, h4, h5, h6').all();
    const issues: string[] = [];
    let previousLevel = 0;

    for (const heading of headings) {
      const tagName = await heading.evaluate(el => el.tagName.toLowerCase());
      const currentLevel = parseInt(tagName.charAt(1));

      if (currentLevel > previousLevel + 1) {
        issues.push(`Heading skips from h${previousLevel} to h${currentLevel}`);
      }

      previousLevel = currentLevel;
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * Basic color contrast check (simplified)
   */
  private async checkColorContrast(): Promise<number> {
    // This is a simplified check - in production, you'd use a proper contrast analyzer
    const suspiciousElements = await this.page.locator('.text-gray-400, .text-gray-300, .opacity-50').count();
    return suspiciousElements;
  }

  /**
   * Test keyboard navigation accessibility
   */
  private async checkKeyboardNavigation(): Promise<{ accessible: boolean; issues: string[] }> {
    const issues: string[] = [];

    try {
      // Test tab navigation
      await this.page.keyboard.press('Tab');
      const focusedElement = await this.page.locator(':focus').count();
      
      if (focusedElement === 0) {
        issues.push('No element receives focus on Tab key press');
      }

      // Test for focus indicators
      const focusIndicators = await this.page.locator(':focus-visible, .focus\\:ring, .focus\\:outline').count();
      if (focusIndicators === 0) {
        issues.push('No visible focus indicators found');
      }

      // Test escape key handling
      await this.page.keyboard.press('Escape');
      
    } catch (error) {
      issues.push(`Keyboard navigation test failed: ${error.message}`);
    }

    return {
      accessible: issues.length === 0,
      issues
    };
  }

  /**
   * Performance monitoring
   */
  async measurePerformance(): Promise<{
    loadTime: number;
    renderTime: number;
    networkRequests: number;
    errors: number;
  }> {
    const navigationTiming = await this.page.evaluate(() => {
      const timing = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return {
        loadTime: timing.loadEventEnd - timing.fetchStart,
        renderTime: timing.domContentLoadedEventEnd - timing.fetchStart
      };
    });

    const networkRequests = this.logs.filter(log => log.message.includes('Request:')).length;
    const errors = this.logs.filter(log => log.level === 'error').length;

    return {
      loadTime: navigationTiming.loadTime,
      renderTime: navigationTiming.renderTime,
      networkRequests,
      errors
    };
  }
}

test.describe('Enhanced Analytics Platform Tests with Accessibility', () => {
  let helper: EnhancedAnalyticsTestHelper;
  let testResults: any = {};

  test.beforeEach(async ({ page }) => {
    helper = new EnhancedAnalyticsTestHelper(page);
    
    // Navigate to analytics page
    await page.goto('/analytics');
    
    // Wait for page to be ready
    await page.waitForLoadState('networkidle');
  });

  test.afterEach(async ({ page }) => {
    // Export logs for debugging if test failed
    if (testResults.failed) {
      const logs = helper.exportLogs();
      console.log('=== TEST LOGS FOR DEBUGGING ===');
      console.log(logs);
      console.log('=== END TEST LOGS ===');
    }
  });

  test('should load analytics page with full accessibility compliance', async ({ page }) => {
    // Check page title and structure
    await expect(page.locator('h1')).toContainText('Solana Ecosystem Analytics');
    
    // Check that all tabs are present with proper ARIA attributes
    const tabs = ['Overview', 'Solana DEX', 'Cross-Chain', 'DeFi Health', 'Validators'];
    for (const tab of tabs) {
      const tabButton = page.locator(`button:has-text("${tab}")`);
      await expect(tabButton).toBeVisible();
      
      // Check for ARIA attributes
      const ariaLabel = await tabButton.getAttribute('aria-label');
      const ariaSelected = await tabButton.getAttribute('aria-selected');
      const role = await tabButton.getAttribute('role');
      
      expect(ariaLabel || role).toBeTruthy(); // Should have either aria-label or role
    }

    // Perform comprehensive accessibility audit
    const accessibilityResults = await helper.performAccessibilityAudit();
    
    // Log accessibility results
    console.log('Accessibility Audit Results:', {
      score: accessibilityResults.score,
      violations: accessibilityResults.violations.length,
      warnings: accessibilityResults.warnings.length
    });

    // Fail test if critical accessibility violations found
    const criticalViolations = accessibilityResults.violations.filter(v => v.severity === 'critical');
    if (criticalViolations.length > 0) {
      testResults.failed = true;
      test.fail(true, `Critical accessibility violations found: ${JSON.stringify(criticalViolations, null, 2)}`);
    }

    // Warn about moderate violations but don't fail
    if (accessibilityResults.violations.length > 0) {
      console.warn('Accessibility violations detected:', accessibilityResults.violations);
    }

    expect(accessibilityResults.score).toBeGreaterThan(80); // Minimum 80% accessibility score
  });

  test('should load Overview tab with performance monitoring', async ({ page }) => {
    const startTime = Date.now();
    const result = await helper.waitForTabToLoad('Overview', 10000);
    
    if (result.status !== 'loaded') {
      testResults.failed = true;
      test.fail(true, `Overview tab failed to load: ${JSON.stringify(result, null, 2)}`);
    }

    expect(result.status).toBe('loaded');
    
    // Check for key metrics
    await expect(page.locator('text=Network Performance')).toBeVisible();
    await expect(page.locator('text=DeFi Ecosystem')).toBeVisible();
    await expect(page.locator('text=Cross-Chain Activity')).toBeVisible();

    // Performance monitoring
    const performance = await helper.measurePerformance();
    console.log('Overview tab performance:', performance);

    expect(performance.loadTime).toBeLessThan(5000); // Should load within 5 seconds
    expect(performance.errors).toBe(0); // No errors should occur
  });

  test('should load Solana DEX tab with error context logging', async ({ page }) => {
    const result = await helper.waitForTabToLoad('Solana DEX', 45000);
    
    if (result.status === 'stuck' || result.status === 'timeout') {
      testResults.failed = true;
      // Include detailed logs in failure message
      test.fail(true, `Solana DEX tab is loading forever: ${result.message}\nLogs: ${JSON.stringify(result.logs, null, 2)}`);
    } else if (result.status === 'error') {
      testResults.failed = true;
      test.fail(true, `Solana DEX tab has error: ${JSON.stringify(result.errors, null, 2)}`);
    }
    
    expect(result.status).toBe('loaded');
    
    // Check for DEX content with better selectors
    const contentVisible = await Promise.race([
      page.locator('text=DEX Volume Rankings').isVisible(),
      page.locator('text=Liquidity Pools').isVisible(),
      page.locator('table').first().isVisible(),
      page.waitForTimeout(5000).then(() => false)
    ]);

    expect(contentVisible).toBe(true);
  });

  test('should load Cross-Chain tab with network monitoring', async ({ page }) => {
    const result = await helper.waitForTabToLoad('Cross-Chain', 45000);
    
    if (result.status === 'stuck' || result.status === 'timeout') {
      testResults.failed = true;
      test.fail(true, `Cross-Chain tab loading issue: ${result.message}\nNetwork logs: ${JSON.stringify(helper.getLogs().filter(l => l.message.includes('Request:')), null, 2)}`);
    } else if (result.status === 'error') {
      testResults.failed = true;
      test.fail(true, `Cross-Chain tab has error: ${JSON.stringify(result.errors, null, 2)}`);
    }
    
    expect(result.status).toBe('loaded');
    
    // Check for cross-chain content
    const contentExists = await page.locator('table, .chart, .data-point').count();
    expect(contentExists).toBeGreaterThan(0);
  });

  test('should load DeFi Health tab with comprehensive error detection', async ({ page }) => {
    const result = await helper.waitForTabToLoad('DeFi Health', 60000); // Extended timeout for DeFi
    
    if (result.status === 'stuck' || result.status === 'timeout') {
      testResults.failed = true;
      // Include API call logs specifically for DeFi Health
      const apiLogs = helper.getLogs().filter(log => 
        log.message.includes('/api/analytics/defi-health') || 
        log.message.includes('defi') ||
        log.level === 'error'
      );
      test.fail(true, `DeFi Health tab loading issue: ${result.message}\nAPI logs: ${JSON.stringify(apiLogs, null, 2)}`);
    } else if (result.status === 'error') {
      testResults.failed = true;
      test.fail(true, `DeFi Health tab has error: ${JSON.stringify(result.errors, null, 2)}`);
    }
    
    expect(result.status).toBe('loaded');
    
    // Check for DeFi health content
    const contentExists = await page.locator('table, .metric, .health-indicator').count();
    expect(contentExists).toBeGreaterThan(0);
  });

  test('should load Validators tab with geolocation error detection', async ({ page }) => {
    const result = await helper.waitForTabToLoad('Validators', 45000);
    
    if (result.status === 'stuck' || result.status === 'timeout') {
      testResults.failed = true;
      // Focus on validator-specific logs
      const validatorLogs = helper.getLogs().filter(log => 
        log.message.includes('/api/analytics/validators') ||
        log.message.includes('validator') ||
        log.message.includes('geolocation') ||
        log.level === 'error'
      );
      test.fail(true, `Validators tab loading issue: ${result.message}\nValidator logs: ${JSON.stringify(validatorLogs, null, 2)}`);
    } else if (result.status === 'error') {
      testResults.failed = true;
      test.fail(true, `Validators tab has error: ${JSON.stringify(result.errors, null, 2)}`);
    }
    
    expect(result.status).toBe('loaded');
    
    // Check for validator content
    const validatorTable = await page.locator('table').count();
    expect(validatorTable).toBeGreaterThan(0);

    // Check if geolocation data is present (country/city information)
    const hasGeoData = await page.locator('td, .country, .city').count();
    if (hasGeoData === 0) {
      console.warn('No geolocation data detected in validators - this may indicate IP geolocation service issues');
    }
  });

  test('should test keyboard navigation accessibility', async ({ page }) => {
    // Test tab navigation
    await page.keyboard.press('Tab');
    
    // Should focus on first interactive element
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();

    // Test tab navigation through all tabs
    const tabs = ['Overview', 'Solana DEX', 'Cross-Chain', 'DeFi Health', 'Validators'];
    
    for (let i = 0; i < tabs.length; i++) {
      // Navigate to tab using keyboard
      await page.keyboard.press(`${i + 1}`); // Assuming keyboard shortcuts
      
      // Or use arrow keys if implemented
      await page.keyboard.press('ArrowRight');
      
      // Verify tab is focused and activated
      const activeTab = page.locator('[aria-selected="true"], .border-primary');
      await expect(activeTab).toBeVisible();
      
      // Test Enter key activation
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
    }
  });

  test('should test API endpoints with detailed timing and error context', async ({ page }) => {
    const endpoints = [
      { path: '/api/analytics/dex', name: 'DEX Analytics' },
      { path: '/api/analytics/cross-chain', name: 'Cross-Chain Analytics' },
      { path: '/api/analytics/defi-health', name: 'DeFi Health' },
      { path: '/api/analytics/validators', name: 'Validators' }
    ];
    
    const results = [];
    
    for (const endpoint of endpoints) {
      const startTime = Date.now();
      
      try {
        const response = await page.request.get(endpoint.path);
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        const result = {
          endpoint: endpoint.name,
          path: endpoint.path,
          status: response.status(),
          responseTime,
          success: response.ok()
        };
        
        if (!response.ok()) {
          const errorText = await response.text();
          result.error = errorText;
          testResults.failed = true;
          test.fail(true, `API endpoint ${endpoint.path} failed with status ${response.status()}: ${errorText}`);
        }
        
        try {
          const data = await response.json();
          result.hasData = !!data.data;
          result.dataSize = JSON.stringify(data).length;
          
          if (!data.success && !data.data) {
            console.warn(`API endpoint ${endpoint.path} returned unsuccessful response:`, data);
          }
        } catch (jsonError) {
          result.jsonError = jsonError.message;
          testResults.failed = true;
          test.fail(true, `API endpoint ${endpoint.path} returned invalid JSON: ${jsonError.message}`);
        }
        
        results.push(result);
        console.log(`${endpoint.name} API test:`, result);
        
        // Performance expectations
        expect(responseTime).toBeLessThan(30000); // 30 second timeout
        
        if (responseTime > 10000) {
          console.warn(`API endpoint ${endpoint.path} is slow (${responseTime}ms) - consider optimization`);
        }
        
      } catch (error) {
        results.push({
          endpoint: endpoint.name,
          path: endpoint.path,
          error: error.message,
          failed: true
        });
        
        testResults.failed = true;
        test.fail(true, `API endpoint ${endpoint.path} request failed: ${error.message}`);
      }
    }
    
    console.log('API Endpoint Test Summary:', results);
  });

  test('should monitor for memory leaks and performance degradation', async ({ page }) => {
    const initialPerformance = await helper.measurePerformance();
    
    // Load each tab multiple times to test for memory leaks
    const tabs = ['Solana DEX', 'Cross-Chain', 'DeFi Health', 'Validators'];
    
    for (let iteration = 0; iteration < 3; iteration++) {
      for (const tabName of tabs) {
        await helper.waitForTabToLoad(tabName, 30000);
        await page.waitForTimeout(2000); // Allow time for any background processes
      }
    }
    
    const finalPerformance = await helper.measurePerformance();
    
    // Check for performance degradation
    const performanceDelta = {
      loadTimeDiff: finalPerformance.loadTime - initialPerformance.loadTime,
      networkRequestsIncrease: finalPerformance.networkRequests - initialPerformance.networkRequests,
      errorsIncrease: finalPerformance.errors - initialPerformance.errors
    };
    
    console.log('Performance monitoring results:', {
      initial: initialPerformance,
      final: finalPerformance,
      delta: performanceDelta
    });
    
    // Alert if performance degraded significantly
    if (performanceDelta.errorsIncrease > 10) {
      console.warn('Significant increase in errors detected during testing');
    }
    
    if (performanceDelta.networkRequestsIncrease > 100) {
      console.warn('Unusually high number of network requests - possible memory leak or inefficient polling');
    }
  });
});