// PH-04: the whole catalog without typing, «تحديد الكل» for what is shown, and adding them in one go.
import { expect, test } from '@playwright/test';
import { freshStart, switchTo } from './helpers';

test('show all, pick a category, select all and add them together', async ({ page }) => {
  await freshStart(page);
  await switchTo(page, 'مالك صيدلية');
  await page.goto('/pharmacy-portal/medicines/add', { waitUntil: 'networkidle' });

  await page.getByRole('button', { name: /عرض كل الأدوية \(\d+\)/ }).click();
  await page.getByRole('group', { name: 'تصنيف الأدوية' }).getByRole('button', { name: 'العين والأذن' }).click();
  const rows = page.locator('main ul li');
  await expect(rows).toHaveCount(6);

  await page.getByRole('checkbox', { name: 'تحديد الكل' }).check();
  await expect(page.getByText('حددت 6 أدوية')).toBeVisible();
  await page.getByRole('button', { name: 'إضافة 6 أدوية' }).click();
  await expect(page.getByText('أُضيفت 6 أدوية إلى أدويتك').first()).toBeVisible({ timeout: 10_000 });

  // All six are now in the pharmacy's list; nothing is left to select.
  await expect(page.getByText('موجود في أدويتك')).toHaveCount(6);
  await expect(page.getByRole('checkbox', { name: 'تحديد الكل' })).toBeDisabled();
});

test('searching still works, across the larger catalog', async ({ page }) => {
  await freshStart(page);
  await switchTo(page, 'مالك صيدلية');
  await page.goto('/pharmacy-portal/medicines/add', { waitUntil: 'networkidle' });
  await page.getByRole('searchbox').fill('مونتيلوكاست');
  await expect(page.locator('main ul li')).toHaveCount(2);
});
