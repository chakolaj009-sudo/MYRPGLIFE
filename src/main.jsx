import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/rubik/latin-400.css';
import '@fontsource/rubik/latin-500.css';
import '@fontsource/rubik/latin-600.css';
import '@fontsource/rubik/hebrew-400.css';
import '@fontsource/rubik/hebrew-500.css';
import '@fontsource/rubik/hebrew-600.css';
import './index.css';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

// Service worker: precaches the app for offline use. A new version waits
// until the user taps "Refresh" (never reloads mid-task on its own).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  import('virtual:pwa-register').then(({ registerSW }) => {
    const update = registerSW({
      onNeedRefresh() {
        window.dispatchEvent(new CustomEvent('sw-need-refresh', { detail: { update: () => update(true) } }));
      },
      onOfflineReady() {
        window.dispatchEvent(new CustomEvent('sw-offline-ready'));
      },
      onRegisteredSW(_url, reg) {
        if (!reg) return;
        // Look for updates when the app comes back to the foreground, at most hourly.
        let last = Date.now();
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible' && Date.now() - last > 3600000) {
            last = Date.now();
            reg.update().catch(() => {});
          }
        });
      },
    });
  });
}
