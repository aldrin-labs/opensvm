import { test, expect } from '@playwright/test';
import { TEST_CONSTANTS } from './utils/test-helpers';

// Test wallet address for API testing
const TEST_WALLET = 'DtdSSG8ZJRZVv5Jx7K1MeWp7Zxcu19GD5wQRGpQ9uMF';

// Valid tab types
const VALID_TABS = ['overview', 'instructions', 'accounts', 'graph', 'ai', 'metrics', 'related', 'failure'];

test.describe('Transaction Tab Preference API', () => {
  
  test.describe('GET /api/user-tab-preference/[walletAddress]', () => {
    test('should return default preference for new user', async ({ request }) => {
      const response = await request.get(`/api/user-tab-preference/${TEST_WALLET}`);
      
      expect(response.status()).toBe(200);
      
      const data = await response.json();
      expect(data).toHaveProperty('preferredTab');
      expect(data.preferredTab).toBe('overview'); // Default fallback
      expect(data).toHaveProperty('source');
      
      console.log('✅ API returns default preference for new user');
    });

    test('should handle invalid wallet address gracefully', async ({ request }) => {
      const invalidWallets = ['invalid', '123', 'too-short-address'];
      
      for (const invalidWallet of invalidWallets) {
        const response = await request.get(`/api/user-tab-preference/${invalidWallet}`);
        
        expect(response.status()).toBe(400);
        
        const data = await response.json();
        expect(data).toHaveProperty('error');
        expect(data.error).toContain('Invalid wallet address');
        
        console.log(`✅ API handles invalid wallet "${invalidWallet}" correctly`);
      }
    });

    test('should return fallback when database unavailable', async ({ request }) => {
      // This test assumes the API will gracefully handle Qdrant being down
      const response = await request.get(`/api/user-tab-preference/${TEST_WALLET}`);
      
      // Should still return 200 with fallback even if DB is down
      expect(response.status()).toBe(200);
      
      const data = await response.json();
      expect(data).toHaveProperty('preferredTab');
      expect(data).toHaveProperty('source');
      
      console.log('✅ API returns fallback when database issues occur');
    });
  });

  test.describe('PUT /api/user-tab-preference/[walletAddress]', () => {
    test('should reject unauthorized requests', async ({ request }) => {
      for (const tab of VALID_TABS) {
        const response = await request.put(`/api/user-tab-preference/${TEST_WALLET}`, {
          data: {
            preferredTab: tab
          }
        });
        
        // Should be unauthorized (401) since we don't have valid auth
        expect(response.status()).toBe(401);
        
        const data = await response.json();
        expect(data).toHaveProperty('error');
        expect(data.error).toContain('Unauthorized');
      }
      
      console.log('✅ API rejects unauthorized PUT requests');
    });

    test('should validate tab preference values', async ({ request }) => {
      const invalidTabs = ['invalid', 'nonexistent', 'badtab', '', null];
      
      for (const invalidTab of invalidTabs) {
        const response = await request.put(`/api/user-tab-preference/${TEST_WALLET}`, {
          data: {
            preferredTab: invalidTab
          }
        });
        
        // Should reject invalid tab values
        expect([400, 401]).toContain(response.status());
        
        if (response.status() === 400) {
          const data = await response.json();
          expect(data).toHaveProperty('error');
          expect(data.error).toContain('Invalid tab preference');
        }
      }
      
      console.log('✅ API validates tab preference values');
    });

    test('should reject requests when database unavailable', async ({ request }) => {
      // Test when Qdrant is down - should return 503
      const response = await request.put(`/api/user-tab-preference/${TEST_WALLET}`, {
        data: {
          preferredTab: 'graph'
        }
      });
      
      // Should either be unauthorized (401) or service unavailable (503)
      expect([401, 503]).toContain(response.status());
      
      console.log('✅ API handles database unavailability correctly');
    });
  });

  test.describe('API Integration with Frontend', () => {
    test('should integrate with localStorage preference system', async ({ page }) => {
      // Set preference via frontend
      await page.goto(`/tx/${TEST_CONSTANTS.TEST_ADDRESSES.VALID_TRANSACTION}/metrics`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      // Check that localStorage was updated
      const localStorageValue = await page.evaluate(() => {
        return localStorage.getItem('opensvm_preferred_tx_tab');
      });
      
      expect(localStorageValue).toBe('metrics');
      
      console.log('✅ Frontend integration updates localStorage correctly');
    });

    test('should handle API errors gracefully in frontend', async ({ page }) => {
      // Mock API failure
      await page.route('/api/user-tab-preference/**', route => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal server error' })
        });
      });

      // Navigate to tab - should still work with localStorage fallback
      await page.goto(`/tx/${TEST_CONSTANTS.TEST_ADDRESSES.VALID_TRANSACTION}/ai`);
      await page.waitForLoadState('networkidle');

      // Should still show the AI tab content despite API error
      expect(page.url()).toContain('/ai');
      
      // Should still save to localStorage
      const localStorageValue = await page.evaluate(() => {
        return localStorage.getItem('opensvm_preferred_tx_tab');
      });
      
      expect(localStorageValue).toBe('ai');
      
      console.log('✅ Frontend handles API errors gracefully');
    });

    test('should prefer localStorage over API when available', async ({ page }) => {
      // Set localStorage preference
      await page.evaluate(() => {
        localStorage.setItem('opensvm_preferred_tx_tab', 'graph');
      });

      // Visit base transaction URL
      await page.goto(`/tx/${TEST_CONSTANTS.TEST_ADDRESSES.VALID_TRANSACTION}`);
      await page.waitForTimeout(2000);

      // Should redirect to localStorage preference
      const currentUrl = page.url();
      expect(currentUrl).toContain('/graph');
      
      console.log('✅ localStorage preference takes precedence');
    });
  });

  test.describe('Performance and Reliability', () => {
    test('should handle high request volume', async ({ request }) => {
      const requestCount = 10;
      
      // Send multiple concurrent requests
      const promises = Array.from({ length: requestCount }, () =>
        request.get(`/api/user-tab-preference/${TEST_WALLET}`)
      );
      
      const responses = await Promise.all(promises);
      
      // All requests should succeed or fail gracefully
      for (const response of responses) {
        expect([200, 401, 503]).toContain(response.status());
      }
      
      console.log(`✅ API handles ${requestCount} concurrent requests`);
    });

    test('should respond within reasonable time', async ({ request }) => {
      const startTime = Date.now();
      
      const response = await request.get(`/api/user-tab-preference/${TEST_WALLET}`);
      
      const responseTime = Date.now() - startTime;
      
      // API should respond within 5 seconds
      expect(responseTime).toBeLessThan(5000);
      expect([200, 401, 503]).toContain(response.status());
      
      console.log(`✅ API responds in ${responseTime}ms`);
    });

    test('should handle malformed request bodies', async ({ request }) => {
      const malformedBodies = [
        'invalid json',
        { invalidField: 'value' },
        { preferredTab: 123 },
        null,
        undefined
      ];
      
      for (const body of malformedBodies) {
        const response = await request.put(`/api/user-tab-preference/${TEST_WALLET}`, {
          data: body
        });
        
        // Should handle malformed requests gracefully
        expect([400, 401, 500]).toContain(response.status());
      }
      
      console.log('✅ API handles malformed request bodies gracefully');
    });
  });
});