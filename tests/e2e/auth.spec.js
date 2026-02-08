import { test, expect } from '@playwright/test';
import { login } from '../helpers/test-helpers.js';

test.describe('Authentication Tests', () => {
    test('should login successfully with admin credentials', async ({ page }) => {
        await page.goto('/');

        // Fill login form - first input is username, second is password
        const inputs = await page.locator('input').all();
        await inputs[0].fill('admin');
        await inputs[1].fill('admin');

        // Click submit
        await page.click('button[type="submit"]');

        // Wait for navigation menu to appear after login
        await page.waitForSelector('text=Замовлення', { timeout: 5000 });

        // Verify we're logged in
        const isLoggedIn = await page.locator('text=Замовлення').isVisible();
        expect(isLoggedIn).toBe(true);
    });

    test('should show error with invalid credentials', async ({ page }) => {
        await page.goto('/');

        const inputs = await page.locator('input').all();
        await inputs[0].fill('invalid_user');
        await inputs[1].fill('wrong_password');

        await page.click('button[type="submit"]');

        // Wait a bit to see if login fails
        await page.waitForTimeout(2000);

        // Should still be on login page (no navigation menu visible)
        const hasNavigation = await page.locator('text=Замовлення').isVisible().catch(() => false);
        expect(hasNavigation).toBe(false);
    });
});
