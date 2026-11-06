// Automated WCAG 2.2 AA scan with axe on the main public, portal and admin screens (SPEC §11).
// It complements, and does not replace, the manual screen-reader pass in docs/ACCESSIBILITY.md.
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { freshStart, switchTo } from './helpers';

// A scan takes a few seconds; the first one also waits for a cold browser and server.
test.describe.configure({ timeout: 120_000 });

const SCREENS: { role?: string; paths: string[] }[] = [
  {
    paths: [
      '/',
      '/search?q=insulin&gov=all',
      '/medicine/insulin-aspart?gov=all',
      '/medicine/levothyroxine-100?gov=gaza',
      '/pharmacy/ph-nour',
      '/pharmacies',
      '/directory',
      '/org/pr-sanad',
      '/login',
      '/for-organizations',
    ],
  },
  { role: 'مالك صيدلية', paths: ['/pharmacy-portal', '/pharmacy-portal/update', '/pharmacy-portal/medicines', '/pharmacy-portal/notifications', '/pharmacy-portal/settings'] },
  { role: 'مالك مؤسسة', paths: ['/provider', '/provider/programs', '/provider/announcements'] },
  { role: 'مدير نظام', paths: ['/admin', '/admin/verification', '/admin/unmet-demand', '/admin/moderation', '/admin/users'] },
];

for (const { role, paths } of SCREENS) {
  for (const path of paths) {
    test(`${path} has no axe violations${role ? ` (${role})` : ''}`, async ({ page }) => {
      await freshStart(page);
      if (role) await switchTo(page, role);
      await page.goto(path, { waitUntil: 'networkidle' });
      await expect(page.locator('h1').first()).toBeVisible();
      const { violations } = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .exclude('.leaflet-container')
        .analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.length} × ${v.help} → ${v.nodes[0]?.target.join(' ')}`)).toEqual([]);
    });
  }
}
