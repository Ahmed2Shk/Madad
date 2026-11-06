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
  await expect(page.getByText(/ظاهر للعامة/).first()).toBeVisible();

  // The patient sees it available, updated just now, and got the alert.
  await switchTo(page, 'مريض');
  await page.goto('/medicine/levothyroxine-100?gov=gaza');
  const row = page.locator('main li', { hasText: 'صيدلية الشفاء' });
  await expect(row.locator('[data-status="available"]')).toBeVisible();
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
  await expect(waiting).toBeVisible();
  await context.setOffline(false);
  await expect(waiting).toBeHidden({ timeout: 10_000 });
});

test('a visitor who taps «فعّل التنبيه» can continue as the demo patient and the alert is set', async ({ page }) => {
  await freshStart(page, '/medicine/levothyroxine-100?gov=gaza');
  await page.getByRole('button', { name: 'فعّل التنبيه' }).click();
  await page.getByRole('button', { name: 'المتابعة بحساب المريض التجريبي' }).click();
  await expect(page.getByText('سنرسل لك إشعارًا عند التوفر').first()).toBeVisible();
});
