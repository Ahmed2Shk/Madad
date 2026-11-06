import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { i18nReady } from './i18n';
import './styles/index.css';
import { Providers } from './app/providers';
import { router } from './app/router';

// Phones keep a tab alive for days without reloading it: look for a new version whenever the tab
// comes back into view. A new version reloads the page itself (public/sw-reload.js).
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && 'serviceWorker' in navigator)
    void navigator.serviceWorker.getRegistration().then((r) => r?.update().catch(() => undefined));
});

void i18nReady.then(() =>
  createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  </StrictMode>,
  ),
);
