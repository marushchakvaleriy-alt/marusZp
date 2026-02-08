import { test, expect } from '@playwright/test';
import { login, createUser, createOrder, gotoOrders, verifyCalculation } from '../helpers/test-helpers.js';

test.describe('Materials Percent Salary Mode Tests', () => {
    test.beforeEach(async ({ page }) => {
        await login(page);
    });

    test('should calculate 10% of material cost correctly', async ({ page }) => {
        await createUser(page, {
            username: 'test_materials_10',
            full_name: 'Test Materials 10%',
            salary_mode: 'materials_percent',
            salary_percent: 10.0
        });

        await createOrder(page, {
            name: 'Test Materials Order',
            price: 10000,
            material_cost: 5000 // 10% of 5000 = 500
        });

        await gotoOrders(page);
        const row = page.locator('tr:has-text("Test Materials Order")');
        const bonusText = await row.locator('td').nth(6).textContent();
        const bonus = parseFloat(bonusText.replace(/[^\d.]/g, ''));

        // Expected: 5000 * 0.10 = 500 грн
        verifyCalculation(bonus, 500);
    });

    test('should handle zero material cost gracefully', async ({ page }) => {
        await createUser(page, {
            username: 'test_materials_zero',
            full_name: 'Test Materials Zero',
            salary_mode: 'materials_percent',
            salary_percent: 10.0
        });

        await createOrder(page, {
            name: 'Test Zero Materials',
            price: 10000,
            material_cost: 0
        });

        await gotoOrders(page);
        const row = page.locator('tr:has-text("Test Zero Materials")');
        const bonusText = await row.locator('td').nth(6).textContent();
        const bonus = parseFloat(bonusText.replace(/[^\d.]/g, ''));

        // Expected: 0 * 0.10 = 0 грн
        verifyCalculation(bonus, 0);
    });

    test('should calculate with high material percentage', async ({ page }) => {
        await createUser(page, {
            username: 'test_materials_20',
            full_name: 'Test Materials 20%',
            salary_mode: 'materials_percent',
            salary_percent: 20.0
        });

        await createOrder(page, {
            name: 'Test High Percent Materials',
            price: 15000,
            material_cost: 8000
        });

        await gotoOrders(page);
        const row = page.locator('tr:has-text("Test High Percent Materials")');
        const bonusText = await row.locator('td').nth(6).textContent();
        const bonus = parseFloat(bonusText.replace(/[^\d.]/g, ''));

        // Expected: 8000 * 0.20 = 1600 грн
        verifyCalculation(bonus, 1600);
    });
});
