// The quick update path (SPEC §16 demo steps 3–4): a pharmacy reports a medicine available and the
// waiting patient sees it «حُدّث الآن»; staff without the price permission see no price field.
import { expect, test } from '@playwright/test';
import { freshStart, switchTo } from './helpers';

test('a PH-02 update reaches the patient, the alert fires, and confirm-all is logged', async ({ page }) => {
  await freshStart(page);

  // The patient waits for levothyroxine in Gaza (P-05 «نبّهني عند التوفر»).
  await switchTo(page, 'مريض');
  await page.goto('/medicine/levothyroxine-100?gov=gaza', { waitUntil: 'networkidle' });
  await expect(page.getByText(/لم تُبلغ أي صيدلية في غزة/)).toBeVisible();
  await page.getByRole('button', { name: 'فعّل التنبيه' }).click();

  // Staff of صيدلية الشفاء (Gaza): no price field; marks it available.
  await switchTo(page, 'موظف صيدلية');
  await page.goto(`/pharmacy-portal/update?filter=all&q=${encodeURIComponent('ليفوثيروكسين 100')}`, { waitUntil: 'networkidle' });
  await expect(page.locator('input[type="number"]')).toHaveCount(0);
  await page.getByRole('radiogroup', { name: 'حالة ليفوثيروكسين 100' }).getByRole('radio', { name: 'متوفر', exact: true }).click();
  await page.getByRole('button', { name: 'حفظ', exact: true }).click();
  // Held for 5 s with «تراجع», then sent.
  await expect(page.getByRole('button', { name: 'تراجع' })).toBeVisible();
  await expect(page.getByText(/ظاهر للعامة/).first()).toBeVisible({ timeout: 10_000 });

  // The patient sees it available, updated just now, and got the alert.
  await switchTo(page, 'مريض');
  await page.goto('/medicine/levothyroxine-100?gov=gaza');
  const row = page.locator('main li', { hasText: 'صيدلية الشفاء' });
  await expect(row.locator('[data-status="available"]')).toBeVisible({ timeout: 10_000 }); // the cached page refreshes first
  await expect(row.getByText('حُدّث الآن')).toBeVisible();
  await page.goto('/me/notifications', { waitUntil: 'networkidle' });
  await expect(page.getByText(/أبلغت صيدلية الشفاء/)).toBeVisible();

  // «تأكيد الكل كما هو» is recorded in PH-05.
  await switchTo(page, 'موظف صيدلية');
  await page.goto('/pharmacy-portal/update', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'تأكيد الكل كما هو' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'تأكيد الكل كما هو' }).click();
  await page.goto('/pharmacy-portal/history', { waitUntil: 'networkidle' });
  await expect(page.getByText(/تأكيد .+ كما (هو|هي|هما)/).filter({ visible: true }).first()).toBeVisible();
});

test('an update made offline waits on the device and is sent when back online', async ({ page, context }) => {
  await freshStart(page);
  await switchTo(page, 'موظف صيدلية');
  await page.goto(`/pharmacy-portal/update?filter=all&q=${encodeURIComponent('ليفوثيروكسين 100')}`, { waitUntil: 'networkidle' });
  await context.setOffline(true);
  await page.getByRole('radiogroup', { name: 'حالة ليفوثيروكسين 100' }).getByRole('radio', { name: 'محدود', exact: true }).click();
  await page.getByRole('button', { name: 'حفظ', exact: true }).click();
  const waiting = page.getByText(/(ينتظر|ينتظران|تنتظر) الاتصال/).first();
  await expect(waiting).toBeVisible({ timeout: 10_000 });
  await context.setOffline(false);
  await expect(waiting).toBeHidden({ timeout: 10_000 });
});

test('a visitor who taps «فعّل التنبيه» can continue as the demo patient and the alert is set', async ({ page }) => {
  await freshStart(page, '/medicine/levothyroxine-100?gov=gaza');
  await page.getByRole('button', { name: 'فعّل التنبيه' }).click();
  await page.getByRole('button', { name: 'المتابعة بحساب المريض التجريبي' }).click();
  await expect(page.getByText('سنرسل لك إشعارًا عند التوفر').first()).toBeVisible();
});

const LEVO = `/pharmacy-portal/update?filter=all&q=${encodeURIComponent('ليفوثيروكسين 100')}`;
const picker = (page: import('@playwright/test').Page) => page.getByRole('radiogroup', { name: 'حالة ليفوثيروكسين 100' });

test('«تراجع» within 5 seconds sends nothing', async ({ page }) => {
  await freshStart(page);
  await switchTo(page, 'موظف صيدلية');
  await page.goto(LEVO, { waitUntil: 'networkidle' });
  const before = await picker(page).getByRole('radio', { checked: true }).textContent();
  await picker(page).getByRole('radio', { checked: false }).first().click();
  await page.getByRole('button', { name: 'حفظ', exact: true }).click();
  await page.getByRole('button', { name: 'تراجع' }).click();
  await expect(page.getByText('أُلغي التحديث').first()).toBeVisible();
  await page.waitForTimeout(6_000);
  await page.reload({ waitUntil: 'networkidle' });
  await expect(picker(page).getByRole('radio', { checked: true })).toHaveText(before!);
});

test('leaving the screen during the 5 seconds still sends the update', async ({ page }) => {
  await freshStart(page);
  await switchTo(page, 'موظف صيدلية');
  await page.goto(LEVO, { waitUntil: 'networkidle' });
  const target = picker(page).getByRole('radio', { checked: false }).first();
  const chosen = await target.textContent();
  await target.click();
  await page.getByRole('button', { name: 'حفظ', exact: true }).click();
  // Straight to another screen of the portal, well inside the hold.
  const history = page.getByRole('link', { name: 'السجل' }).first();
  if (!(await history.isVisible())) await page.locator('header button[aria-expanded]').first().click(); // phone menu
  await history.click();
  await page.waitForURL('**/pharmacy-portal/history');
  await page.goto(LEVO, { waitUntil: 'networkidle' });
  await expect(picker(page).getByRole('radio', { checked: true })).toHaveText(chosen!);
});

test('closing the page right after «حفظ» does not lose the update', async ({ page }) => {
  await freshStart(page);
  await switchTo(page, 'موظف صيدلية');
  await page.goto(LEVO, { waitUntil: 'networkidle' });
  const target = picker(page).getByRole('radio', { checked: false }).first();
  const chosen = await target.textContent();
  await target.click();
  await page.getByRole('button', { name: 'حفظ', exact: true }).click();
  // The page goes away at once (like closing the tab) and is opened again.
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1_500);
  await page.reload({ waitUntil: 'networkidle' });
  await expect(picker(page).getByRole('radio', { checked: true })).toHaveText(chosen!);
});
