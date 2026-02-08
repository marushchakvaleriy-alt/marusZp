// Helper functions for E2E tests
import { expect } from '@playwright/test';

/**
 * Login as admin user
 */
export async function login(page, username = 'admin', password = 'admin') {
    await page.goto('/');

    // Fill login form - first input is username, second is password
    const inputs = await page.locator('input').all();
    await inputs[0].fill(username);
    await inputs[1].fill(password);

    // Click login button
    await page.click('button[type="submit"]');

    // Wait for successful login - should redirect and show navigation
    await page.waitForSelector('text=Замовлення', { timeout: 5000 });
}

/**
 * Navigate to User Management page
 */
export async function gotoUserManagement(page) {
    await page.click('text=Керування командою');
    await page.waitForSelector('text=Список користувачів');
}

/**
 * Create a new user
 */
export async function createUser(page, userData) {
    const {
        username,
        password = 'test123',
        full_name,
        role = 'constructor',
        salary_mode = 'sales_percent',
        salary_percent = 5.0,
        payment_stage1_percent = 50.0,
        payment_stage2_percent = 50.0
    } = userData;

    await gotoUserManagement(page);

    // Fill basic info
    await page.fill('input[placeholder="ivan_k"]', username);
    await page.fill('input[placeholder="supersecret"]', password);
    await page.fill('input[placeholder="Іванов Іван"]', full_name);

    // Select role - using nth-child since first select is for role
    await page.selectOption('select >> nth=0', role);

    // Salary configuration - select salary mode
    await page.selectOption('select.border-green-200', salary_mode);

    // Only fill percent if not fixed_amount mode
    if (salary_mode !== 'fixed_amount') {
        await page.fill('input[placeholder="5.0"]', salary_percent.toString());
    }

    // Stage distribution - these are the last two number inputs in the form
    const stageInputs = await page.locator('input.border-green-200[type="number"]').all();
    if (stageInputs.length >= 2) {
        // Last two inputs are stage percentages
        await stageInputs[stageInputs.length - 2].fill(payment_stage1_percent.toString());
        await stageInputs[stageInputs.length - 1].fill(payment_stage2_percent.toString());
    }

    // Submit - button has text "Створити" or "Зберегти зміни"
    await page.click('button:has-text("Створити")');

    // Wait for success - user should appear in list
    await page.waitForSelector(`text=${full_name}`, { timeout: 5000 });
}

/**
 * Navigate to Orders page
 */
export async function gotoOrders(page) {
    await page.click('text=Замовлення');
    await page.waitForSelector('text=Замовлення');
}

/**
 * Create a new order
 */
export async function createOrder(page, orderData) {
    const {
        name,
        price,
        material_cost = 0,
        fixed_bonus = null,
        constructor_id = null,
        date_design_deadline = null
    } = orderData;

    await gotoOrders(page);

    // Click "Нове замовлення" button
    await page.click('button:has-text("Нове замовлення")');

    // Wait for modal to appear
    await page.waitForSelector('text=Створити замовлення', { timeout: 3000 });

    // Fill order name
    await page.fill('input.font-bold[type="text"]', name);

    // Fill price - look for input near "Ціна" label
    const priceInput = page.locator('input[type="number"]').first();
    await priceInput.fill(price.toString());

    // Fill deadline date if specified
    if (date_design_deadline) {
        await page.fill('input[type="date"]', date_design_deadline);
    }

    // Select constructor if specified
    if (constructor_id !== null) {
        await page.selectOption('select', constructor_id.toString());
    }

    // Fill fixed bonus if specified (admin only field)
    if (fixed_bonus !== null) {
        const fixedBonusInput = page.locator('input.border-amber-200[type="number"]');
        if (await fixedBonusInput.isVisible().catch(() => false)) {
            await fixedBonusInput.fill(fixed_bonus.toString());
        }
    }

    // Submit form
    await page.click('button[type="submit"]:has-text("Створити")');

    // Wait for modal to close and order to appear
    await page.waitForTimeout(1000);
}

/**
 * Get order bonus amount from table
 */
export async function getOrderBonus(page, orderName) {
    const row = page.locator(`tr:has-text("${orderName}")`);
    const bonusCell = row.locator('td').nth(5); // Adjust index based on table structure
    const bonusText = await bonusCell.textContent();
    return parseFloat(bonusText.replace(/[^\d.]/g, ''));
}

/**
 * Mark order as "To Work" (triggers Stage 1 payment)
 */
export async function markOrderToWork(page, orderName) {
    const row = page.locator(`tr:has-text("${orderName}")`);
    await row.click();

    // Find and click "В роботу" button
    await page.click('button:has-text("В роботу")');
    await page.waitForTimeout(500);
}

/**
 * Pay Stage 1
 */
export async function payStage1(page, orderName) {
    const row = page.locator(`tr:has-text("${orderName}")`);
    await row.click();

    // Click stage 1 payment button
    await page.click('button:has-text("Оплатити"):first');
    await page.waitForTimeout(500);
}

/**
 * Verify calculation
 */
export function verifyCalculation(actual, expected, tolerance = 0.01) {
    expect(Math.abs(actual - expected)).toBeLessThan(tolerance);
}
