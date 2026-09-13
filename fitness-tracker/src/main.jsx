import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import { AuthProvider } from './contexts/AuthContext';
import App from './App.jsx';
import './index.css';
import 'react-loading-skeleton/dist/skeleton.css';

// Keep the installed (home-screen) app in step with the deployed site.
// Something has to go looking for new builds: an installed PWA is resumed
// rather than reloaded, so without these checks it can serve a stale build
// for days. When one is found it is NOT applied immediately (that would
// reload the page mid-workout). Instead the Layout shows an "Update ready"
// bar with a Reload button, and the update applies itself quietly the next
// time the app goes to the background.
const updateSW = registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return;
    const checkForUpdate = () => {
      if (document.visibilityState === 'visible') registration.update();
    };
    checkForUpdate();
    setInterval(checkForUpdate, 60 * 60 * 1000);
    document.addEventListener('visibilitychange', checkForUpdate);
  },
  onNeedRefresh() {
    window.__fittrackUpdateReady = true;
    window.dispatchEvent(new CustomEvent('fittrack:update-ready'));
    const applyWhenHidden = () => {
      if (document.visibilityState === 'hidden') updateSW(true);
    };
    document.addEventListener('visibilitychange', applyWhenHidden);
  },
});
// Used by the "Reload" button in Layout
window.__fittrackApplyUpdate = () => updateSW(true);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
