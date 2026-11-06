import { expect, type Page } from '@playwright/test';

/** Starts from the demo seeds with nobody signed in. */
export async function freshStart(page: Page, path = '/') {
  await page.goto(path);
  await page.evaluate(() => localStorage.clear());
  await page.goto(path, { waitUntil: 'networkidle' });
}

/** The floating demo role switcher (VITE_DEMO=true). It signs in, then loads the role's home page. */
export async function switchTo(page: Page, role: string) {
  await page.locator('button[aria-controls="demo-roles"]').click();
  const loaded = page.waitForEvent('load');
  await page.locator('#demo-roles').getByRole('button', { name: role, exact: true }).click();
  await loaded;
  await page.waitForLoadState('networkidle');
}

/** Medicine links on a results page, without their query strings. */
export async function resultIds(page: Page) {
  await expect(page.locator('main a[href^="/medicine/"]').first()).toBeVisible();
  return page.locator('main a[href^="/medicine/"]').evaluateAll((as) => [...new Set(as.map((a) => a.getAttribute('href')!.split('?')[0]))]);
}
