// End-to-end checks (SPEC §14 phase 6): the "search" and "quick update" paths, and an axe scan,
// on the production build in mock mode, so they need no network or Supabase project.
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4180',
    locale: 'ar',
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
  },
  projects: [
    // Locally the installed Chrome is enough; CI installs Playwright's Chromium.
    { name: 'mobile', use: { ...devices['Pixel 7'], channel: process.env.CI ? undefined : 'chrome' } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], channel: process.env.CI ? undefined : 'chrome' } },
  ],
  webServer: {
    command: 'npx vite preview --port 4180 --strictPort',
    url: 'http://localhost:4180',
    reuseExistingServer: !process.env.CI,
  },
});
