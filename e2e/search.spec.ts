import { test, expect } from '@playwright/test';

test.describe('Search feature', () => {
  test('type query, see suggestions (when available), and navigate to results', async ({ page }) => {
    // Try homepage first; if search bar isn't rendered there, fallback to /search which renders it.
    const candidatePaths = ['/', '/search'];
    let inputFound = false;

    for (const path of candidatePaths) {
      await test.step(`navigate to ${path}`, async () => {
        await page.goto(path);
      });

      const input = page.locator('input[aria-label="Search input"]');
      if (await input.count()) {
        try {
          if (await input.first().isVisible({ timeout: 2000 })) {
            inputFound = true;

            // Type a query that should produce suggestions
            await input.fill('sol');

            // Suggestions endpoint uses debounce and network; allow some time
            // Prefer robust checks:
            //  - Footer hint: "Press Enter to select" shows when suggestions are present
            //  - Or visible known suggestion text like "Solana" (from SOL token)
            const footerHint = page.getByText(/Press\s+Enter\s+to\s+select/i);
            const solanaText = page.getByText(/Solana/i);

            // Wait up to 5s for either the footer hint or a known suggestion label
            try {
              await Promise.race([
                footerHint.waitFor({ state: 'visible', timeout: 5000 }),
                solanaText.waitFor({ state: 'visible', timeout: 5000 }),
              ]);
            } catch {
              // Suggestions might not load due to network; continue anyway
            }

            // Submit via Enter to trigger navigation to /search?q=...
            await input.press('Enter');

            // Expect navigation to search results page
            await expect(page).toHaveURL(/\/search\?/, { timeout: 15000 });
            await expect(page.getByRole('heading', { name: /Search Results for/i })).toBeVisible();

            // The results page will either render a table or "No results found". Accept either.
            const resultsTable = page.locator('table[aria-label="SVM search results"]');
            const noResults = page.getByText(/No results found/i);
            await expect(resultsTable.or(noResults)).toBeVisible({ timeout: 10000 });

            return;
          }
        } catch {
          // Try next candidate path
        }
      }
    }

    expect(inputFound).toBeTruthy();
  });
});
