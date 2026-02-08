import { test, expect } from '@playwright/test';
import { login, createUser, createOrder, gotoOrders, verifyCalculation } from '../helpers/test-helpers.js';

test.describe('Sales Percent Salary Mode Tests', () => {
    test.beforeEach(async ({ page }) => {
        await login(page);
    });

    test('should calculate 5% of sales price correctly', async ({ page }) => {
        // Create constructor with 5% sales mode
        await createUser(page, {
            username: 'test_sales_5',
            full_name: 'Test Sales 5%',
            salary_mode: 'sales_percent',
            salary_percent: 5.0,
            payment_stage1_percent: 50.0,
            payment_stage2_percent: 50.0
        });

        // Create order with 10000 грн price
        await createOrder(page, {
            name: 'Test Order Sales 5%',
            price: 10000,
            constructor_id: null // Will need to select from dropdown
        });

        // Navigate to orders and verify calculation
        await gotoOrders(page);
        const row = page.locator('tr:has-text("Test Order Sales 5%")');

        // Expected: 10000 * 0.05 = 500 грн
        const bonusText = await row.locator('td').nth(6).textContent(); // Adjust column index
        const bonus = parseFloat(bonusText.replace(/[^\d.]/g, ''));

        verifyCalculation(bonus, 500);
    });

    test('should split bonus 50/50 between stages', async ({ page }) => {
        await createUser(page, {
            username: 'test_split_50_50',
            full_name: 'Test Split 50/50',
            salary_mode: 'sales_percent',
            salary_percent: 10.0
        });

        await createOrder(page, {
            name: 'Test 50/50 Split',
            price: 5000
        });

        await gotoOrders(page);
        const row = page.locator('tr:has-text("Test 50/50 Split")');

        // Expected bonus: 5000 * 0.10 = 500 грн
        // Stage 1 (50%): 250 грн
        // Stage 2 (50%): 250 грн

        // Click row to see details
        await row.click();

        // Verify stage amounts (adjust selectors based on modal structure)
        const stage1Text = await page.locator('text=/Етап I.*250/').textContent();
        const stage2Text = await page.locator('text=/Етап II.*250/').textContent();

        expect(stage1Text).toContain('250');
        expect(stage2Text).toContain('250');
    });

    test('should apply custom 60/40 stage distribution', async ({ page }) => {
        await createUser(page, {
            username: 'test_60_40',
            full_name: 'Test 60/40 Split',
            salary_mode: 'sales_percent',
            salary_percent: 10.0,
            payment_stage1_percent: 60.0,
            payment_stage2_percent: 40.0
        });

        await createOrder(page, {
            name: 'Test 60/40 Order',
            price: 10000
        });

        // Expected: 10000 * 0.10 = 1000 грн total
        // Stage 1: 600 грн
        // Stage 2: 400 грн

        await gotoOrders(page);
        const row = page.locator('tr:has-text("Test 60/40 Order")');
        await row.click();

        const stage1Amount = await page.locator('text=/600.*грн/').textContent();
        const stage2Amount = await page.locator('text=/400.*грн/').textContent();

        expect(stage1Amount).toContain('600');
        expect(stage2Amount).toContain('400');
    });

    test('should apply 100/0 split (all payment in stage 1)', async ({ page }) => {
        await createUser(page, {
            username: 'test_100_0',
            full_name: 'Test 100/0',
            salary_mode: 'sales_percent',
            salary_percent: 5.0,
            payment_stage1_percent: 100.0,
            payment_stage2_percent: 0.0
        });

        await createOrder(page, {
            name: 'Test 100/0 Order',
            price: 20000
        });

        // Expected: 20000 * 0.05 = 1000 грн
        // Stage 1: 1000 грн
        // Stage 2: 0 грн

        await gotoOrders(page);
        const row = page.locator('tr:has-text("Test 100/0 Order")');
        await row.click();

        // Verify stage 1 = 1000, stage 2 = 0
        await expect(page.locator('text=/Етап I.*1000/i')).toBeVisible();
        await expect(page.locator('text=/Етап II.*0/i')).toBeVisible();
    });
});
