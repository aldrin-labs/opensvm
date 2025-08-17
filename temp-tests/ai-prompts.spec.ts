import { test, expect, Page } from '@playwright/test';
import { AITestHelpers } from '../helpers/ai-sidebar-helpers';

test.describe('AI Sidebar Prompt Driven Scenarios Tests', () => {
    let page: Page;
    let helpers: AITestHelpers;

    test.beforeEach(async ({ page: p }) => {
        page = p;
        helpers = new AITestHelpers(page);
        await page.goto('/');
        await helpers.openSidebar();
        await page.click('[data-testid="chat-tab"]');
    });

    // Flows 75-91 already present...

    /*
     * --------------------------------------------------------------------------
     * Flow 92 – Gas Price Prediction
     * --------------------------------------------------------------------------
     */
    test('Flow 92: Gas price prediction suggests optimal timing', async () => {
        await helpers.sendMessage('When will Solana transaction fees be lowest today?');
        const resp = page.locator('[data-testid="ai-message"]').last();
        await expect(resp.locator('[data-testid="fee-prediction-chart"]')).toBeVisible();

        // NEW – verify the prediction contains an actual numeric fee and a time string
        const feeText = await resp.locator('[data-testid="predicted-fee"]').innerText();
        const feeValue = parseFloat(feeText.replace(/[^\d.]+/g, ''));
        expect(feeValue).toBeGreaterThan(0);

        const optimalTime = await resp.locator('[data-testid="optimal-time"]').innerText();
        expect(optimalTime).toMatch(/^\d{1,2}:\d{2}/);
    });

    /*
     * --------------------------------------------------------------------------
     * Flow 93 – Portfolio Rebalancing Strategy
     * --------------------------------------------------------------------------
     */
    test('Flow 93: Portfolio rebalancing recommendations are generated', async () => {
        await helpers.sendMessage('How should I rebalance my Solana portfolio based on current market conditions?');
        const resp = page.locator('[data-testid="ai-message"]').last();
        await expect(resp).toContainText(/rebalance/i);
        await expect(resp.locator('[data-testid="asset-allocation-table"]')).toBeVisible();
        await expect(resp.locator('[data-testid="risk-summary"]')).toBeVisible();

        const allocationRows = resp.locator('[data-testid="asset-allocation-table"] tbody tr');
        await expect(allocationRows).toHaveCountGreaterThan(0);

        // Ensure each row has a non-empty symbol and a % allocation > 0
        const rowCount = await allocationRows.count();
        for (let i = 0; i < rowCount; i++) {
            const cells = allocationRows.nth(i).locator('td');
            await expect(cells.nth(0)).not.toHaveText(/^$/);                    // symbol
            const pct = parseFloat((await cells.nth(1).innerText()).replace('%', ''));
            expect(pct).toBeGreaterThan(0);
        }
    });

    /*
     * --------------------------------------------------------------------------
     * Flow 94 – Security Incident Investigation
     * --------------------------------------------------------------------------
     */
    test('Flow 94: Security incident investigation flags compromise indicators', async () => {
        await helpers.sendMessage('Was my wallet compromised? Here are some suspicious transactions: ABC123, DEF456');
        const resp = page.locator('[data-testid="ai-message"]').last();
        await expect(resp).toContainText(/compromised|not compromised/i);
        await expect(resp.locator('[data-testid="compromise-indicators"]')).toBeVisible();
        await expect(resp.locator('[data-testid="mitigation-steps"]')).toBeVisible();

        const indicators = resp.locator('[data-testid="compromise-indicators"] li');
        await expect(indicators).toHaveCountGreaterThan(0);
        await expect(indicators.first()).not.toHaveText(/^$/);
    });

    /*
     * --------------------------------------------------------------------------
     * Flow 95 – Program Upgrade Impact Analysis
     * --------------------------------------------------------------------------
     */
    test('Flow 95: Program upgrade impact on DeFi positions is assessed', async () => {
        await helpers.sendMessage('How will the latest Solana program upgrade affect my DeFi positions?');
        const resp = page.locator('[data-testid="ai-message"]').last();
        await expect(resp).toContainText(/upgrade/i);
        await expect(resp.locator('[data-testid="position-impact-table"]')).toBeVisible();
        await expect(resp.locator('[data-testid="recommended-actions"]')).toBeVisible();

        const impactRows = resp.locator('[data-testid="position-impact-table"] tbody tr');
        await expect(impactRows).toHaveCountGreaterThan(0);
        const pnlText = await impactRows.first().locator('td').nth(2).innerText();
        expect(pnlText).toMatch(/[-+]?\d+(\.\d+)?%/);   // expects a percentage change
    });

    /*
     * --------------------------------------------------------------------------
     * Flow 96 – Cross-Program Interaction Mapping
     * --------------------------------------------------------------------------
     */
    test('Flow 96: Cross-program interaction diagram renders correctly', async () => {
        await helpers.sendMessage('Show me how this transaction interacts with multiple DeFi protocols');
        const resp = page.locator('[data-testid="ai-message"]').last();
        await expect(resp.locator('[data-testid="interaction-diagram"]')).toBeVisible();
        await expect(resp.locator('[data-testid="diagram-node"]')).toHaveCount.above(2);

        const edgeCount = await resp.locator('[data-testid="interaction-diagram"] [data-testid="diagram-edge"]').count();
        expect(edgeCount).toBeGreaterThan(0);
    });

    /*
     * --------------------------------------------------------------------------
     * Flow 97 – Historical Performance Comparison
     * --------------------------------------------------------------------------
     */
    test('Flow 97: Historical performance comparison chart is shown', async () => {
        await helpers.sendMessage('Compare SOL performance vs ETH over the last 6 months with technical analysis');
        const resp = page.locator('[data-testid="ai-message"]').last();
        await expect(resp.locator('[data-testid="comparison-chart"]')).toBeVisible();
        await expect(resp.locator('[data-testid="technical-indicators"]')).toBeVisible();

        const indicators = resp.locator('[data-testid="technical-indicators"] li');
        await expect(indicators).toHaveCountGreaterThan(2);        // should include RSI, MACD, etc.
    });

    /*
     * --------------------------------------------------------------------------
     * Flow 98 – Ecosystem Project Discovery
     * --------------------------------------------------------------------------
     */
    test('Flow 98: New Solana projects launched this month are listed', async () => {
        await helpers.sendMessage('Find promising new projects building on Solana that launched this month');
        const resp = page.locator('[data-testid="ai-message"]').last();
        await expect(resp.locator('[data-testid="project-list"]')).toBeVisible();
        await expect(resp.locator('[data-testid="project-item"]')).toHaveCount.above(0);

        const firstProject = resp.locator('[data-testid="project-item"]').first();
        await expect(firstProject.locator('[data-testid="project-name"]')).not.toHaveText(/^$/);
        await expect(firstProject.locator('[data-testid="launch-date"]')).toMatch(/\d{4}-\d{2}-\d{2}/);
    });

    /*
     * --------------------------------------------------------------------------
     * Flow 99 – Network Health Monitoring
     * --------------------------------------------------------------------------
     */
    test('Flow 99: Network health report shows real-time metrics', async () => {
        await helpers.sendMessage('Is the Solana network experiencing any issues right now?');
        const resp = page.locator('[data-testid="ai-message"]').last();
        await expect(resp.locator('[data-testid="network-status"]')).toBeVisible();
        await expect(resp.locator('[data-testid="tps-metric"]')).toBeVisible();
        await expect(resp.locator('[data-testid="validator-health"]')).toBeVisible();

        const tpsValue = parseFloat((await resp.locator('[data-testid="tps-metric"]').innerText()).replace(/[^\d.]+/g, ''));
        expect(tpsValue).toBeGreaterThan(0);
    });

    /*
     * --------------------------------------------------------------------------
     * Flow 100 – Custom Trading Strategy Backtesting
     * --------------------------------------------------------------------------
     */
    test('Flow 100: Backtest results for DCA strategy are provided', async () => {
        await helpers.sendMessage('Backtest a DCA strategy buying SOL weekly for the past year');
        const resp = page.locator('[data-testid="ai-message"]').last();
        await expect(resp.locator('[data-testid="backtest-summary"]')).toBeVisible();
        await expect(resp.locator('[data-testid="return-chart"]')).toBeVisible();
        await expect(resp.locator('[data-testid="risk-metrics"]')).toBeVisible();

        const totalReturn = parseFloat((await resp.locator('[data-testid="total-return"]').innerText()).replace(/[^\d.-]+/g, ''));
        expect(totalReturn).not.toBeNaN();
    });
});