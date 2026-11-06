// PH-07 / PR-07: the portals show the public page as patients see it. It used to be an iframe holding
// a second copy of the app, which never finished loading when signed in; now it is the page itself.
import { expect, test } from '@playwright/test';
import { freshStart, switchTo } from './helpers';

test('the pharmacy owner previews the pharmacy page from the dashboard', async ({ page }) => {
  await freshStart(page);
  await switchTo(page, 'مالك صيدلية');
  await page.goto('/pharmacy-portal', { waitUntil: 'networkidle' });
  await page.getByRole('link', { name: 'معاينة كما يراها المريض' }).click();
  const panel = page.getByRole('dialog');
  await expect(panel.getByText('معاينة: هكذا يرى المريض صفحتك')).toBeVisible();
  await expect(panel.locator('h1').first()).toHaveText('صيدلية النور');
  await expect(page.locator('iframe')).toHaveCount(0);
});

test('the provider previews its public page', async ({ page }) => {
  await freshStart(page);
  await switchTo(page, 'مالك مؤسسة');
  await page.goto('/provider/preview', { waitUntil: 'networkidle' });
  await expect(page.locator('main').getByText('جمعية سند الطبية').first()).toBeVisible();
  await expect(page.locator('iframe')).toHaveCount(0);
});
