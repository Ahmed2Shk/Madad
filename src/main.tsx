import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { i18nReady } from './i18n';
import './styles/index.css';
import { Providers } from './app/providers';
import { router } from './app/router';

void i18nReady.then(() =>
  createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  </StrictMode>,
  ),
);
