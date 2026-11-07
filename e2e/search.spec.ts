// The patient's search path (SPEC §16): spellings, statuses with their time, nothing for sale, offline.
import { expect, test } from '@playwright/test';
import { freshStart, resultIds } from './helpers';

test('«انسولين», «إنسولين» and «insulin» find the same medicines', async ({ page }) => {
  test.slow(); // four page loads
  await freshStart(page);
  const ids: string[][] = [];
  for (const q of ['انسولين', 'إنسولين', 'insulin']) {
    await page.goto(`/search?q=${encodeURIComponent(q)}&gov=all`, { waitUntil: 'networkidle' });
    ids.push((await resultIds(page)).sort());
  }
  expect(ids[0]!.length).toBeGreaterThan(0);
  expect(ids[1]).toEqual(ids[0]);
  expect(ids[2]).toEqual(ids[0]);
});

test('a barcode with one match opens its medicine directly', async ({ page }) => {
  await freshStart(page, '/search?q=6250000000001&gov=all');
  await expect(page).toHaveURL(/\/medicine\/paracetamol-500\?gov=all$/);
  await expect(page.locator('h1').first()).toHaveText(/باراسيتامول 500/);
});

test('every availability badge on P-03 comes with the time of the report', async ({ page }) => {
  await freshStart(page, '/medicine/insulin-aspart?gov=all');
  await page.getByRole('button', { name: 'المتوفر فقط' }).click();
  const rows = page.locator('main li:has([data-status])');
  await expect(rows.first()).toBeVisible();
  const n = await rows.count();
  expect(n).toBeGreaterThan(2);
  for (let i = 0; i < n; i++) await expect(rows.nth(i).locator('time').first()).toBeVisible();
  // The three truths appear: fresh, needs an update, unconfirmed.
  for (const s of ['available', 'needs_update', 'unconfirmed']) await expect(page.locator(`main [data-status="${s}"]`).first()).toBeVisible();
});

test('no screen offers buying, a cart, delivery, booking or payment', async ({ page }) => {
  await freshStart(page);
  for (const path of ['/', '/medicine/insulin-aspart?gov=all', '/pharmacies', '/directory']) {
    await page.goto(path, { waitUntil: 'networkidle' });
    await expect(page.locator('body')).not.toHaveText(/اشترِ|اشتري|سلة|توصيل|احجز|ادفع|add to cart|checkout|buy now/i);
  }
});

test('RTL in Arabic and LTR in English', async ({ page }) => {
  await freshStart(page);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await page.getByRole('button', { name: /English/ }).first().click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page.locator('h1').first()).toHaveText(/medicine/i);
});

test.describe('offline after the first visit', () => {
  test.use({ serviceWorkers: 'allow' });

  test('P-01 and P-03 open without a connection, with the offline banner', async ({ page, context }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload({ waitUntil: 'networkidle' });
    await page.goto('/medicine/insulin-aspart?gov=khan_younis', { waitUntil: 'networkidle' });
    await context.setOffline(true);
    await page.goto('/');
    await expect(page.locator('h1').first()).toBeVisible();
    await expect(page.getByText('لا يوجد اتصال بالإنترنت').first()).toBeVisible();
    await page.goto('/medicine/insulin-aspart?gov=khan_younis');
    await expect(page.locator('main a[href^="/pharmacy/"]').first()).toBeVisible();
    await context.setOffline(false);
  });
});

test('a misspelt name offers «هل تقصد؟» choices instead of replacing the query', async ({ page }) => {
  await freshStart(page, `/search?q=${encodeURIComponent('بندول')}&gov=all`);
  await expect(page.getByRole('heading', { name: 'هل تقصد؟' })).toBeVisible();
  const choice = page.locator('main a[href^="/medicine/paracetamol-500"]').first();
  await expect(choice).toBeVisible();
  // Nothing was swapped in: the page still says nothing matched what was typed.
  await expect(page).toHaveURL(/q=%D8%A8%D9%86%D8%AF%D9%88%D9%84/);
  await choice.click();
  await expect(page).toHaveURL(/\/medicine\/paracetamol-500/);
});
