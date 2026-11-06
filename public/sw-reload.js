// Loaded into the service worker (vite.config.ts → workbox.importScripts).
// When a new version replaces an older one, open pages are still showing the old version from the
// cache. Reload them once, so nobody keeps seeing an old build (for example the demo mode) until
// they happen to refresh. A first install (no older version) reloads nothing.
let replacesOlderVersion = false;

self.addEventListener('install', () => {
  replacesOlderVersion = Boolean(self.registration.active);
});

self.addEventListener('activate', (event) => {
  if (!replacesOlderVersion) return;
  const claimed = self.clients.claim();
  event.waitUntil(claimed);
  // Not inside waitUntil: the reload is served by this worker, so it must not wait for activation
  // to finish while activation waits for it (the page would hang).
  claimed
    .then(() => self.clients.matchAll({ type: 'window' }))
    .then((pages) => pages.forEach((page) => page.navigate(page.url).catch(() => undefined)));
});
