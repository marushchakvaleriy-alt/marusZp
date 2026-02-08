import { test, expect } from '@playwright/test';
import { login, createUser, createOrder, gotoOrders, verifyCalculation } from '../helpers/test-helpers.js';

test.describe('Fixed Amount Salary Mode Tests', () => {
    test.beforeEach(async ({ page }) => {
        await login(page);
    });

    test('should use fixed bonus from order (manager override)', async ({ page }) => {
        await createUser(page, {
            username: 'test_fixed_user',
            full_name: 'Test Fixed Mode User',
            salary_mode: 'sales_percent',
            salary_percent: 5.0 // This should be ignored when fixed_bonus is set
        });

        await createOrder(page, {
            name: 'Test Fixed Bonus Order',
            price: 10000,
            fixed_bonus: 1500 // Manager sets exact amount
        });

        await gotoOrders(page);
        const row = page.locator('tr:has-text("Test Fixed Bonus Order")');
        const bonusText = await row.locator('td').nth(6).textContent();
        const bonus = parseFloat(bonusText.replace(/[^\d.]/g, ''));

        // Expected: 1500 грн (not calculated, but fixed)
        verifyCalculation(bonus, 1500);
    });

    test('should use constructor fixed_amount mode', async ({ page }) => {
        await createUser(page, {
            username: 'test_constructor_fixed',
            full_name: 'Test Constructor Fixed',
            salary_mode: 'fixed_amount',
            // No salary_percent needed for this mode
        });

        // When creating order with this constructor, they always get
        // the amount specified in order's fixed_bonus field
        await createOrder(page, {
            name: 'Test Fixed Amount Constructor',
            price: 20000,
            fixed_bonus: 2000 // Each order has individual amount
        });

        await gotoOrders(page);
        const row = page.locator('tr:has-text("Test Fixed Amount Constructor")');
        const bonusText = await row.locator('td').nth(6).textContent();
        const bonus = parseFloat(bonusText.replace(/[^\d.]/g, ''));

        verifyCalculation(bonus, 2000);
    });

    test('fixed bonus should override auto-calculation', async ({ page }) => {
        await createUser(page, {
            username: 'test_override',
            full_name: 'Test Override User',
            salary_mode: 'sales_percent',
            salary_percent: 10.0
        });

        await createOrder(page, {
            name: 'Test Override Order',
            price: 10000,
            fixed_bonus: 2500
        });

        // Without fixed_bonus: 10000 * 0.10 = 1000 грн
        // With fixed_bonus: 2500 грн (overrides calculation)

        await gotoOrders(page);
        const row = page.locator('tr:has-text("Test Override Order")');
        const bonusText = await row.locator('td').nth(6).textContent();
        const bonus = parseFloat(bonusText.replace(/[^\d.]/g, ''));

        // Should be 2500, not 1000
        verifyCalculation(bonus, 2500);
        expect(bonus).not.toBeCloseTo(1000);
    });

    test('fixed bonus with custom stage distribution 70/30', async ({ page }) => {
        await createUser(page, {
            username: 'test_fixed_70_30',
            full_name: 'Test Fixed 70/30',
            salary_mode: 'sales_percent',
            salary_percent: 5.0,
            payment_stage1_percent: 70.0,
            payment_stage2_percent: 30.0
        });

        await createOrder(page, {
            name: 'Test Fixed 70/30 Order',
            price: 10000,
            fixed_bonus: 3000
        });

        // Total: 3000 грн (fixed)
        // Stage 1 (70%): 2100 грн
        // Stage 2 (30%): 900 грн

        await gotoOrders(page);
        const row = page.locator('tr:has-text("Test Fixed 70/30 Order")');
        await row.click();

        await expect(page.locator('text=/2100.*грн/i')).toBeVisible();
        await expect(page.locator('text=/900.*грн/i')).toBeVisible();
    });
});
