import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import { AuthProvider } from './contexts/AuthContext';
import App from './App.jsx';
import './index.css';
import 'react-loading-skeleton/dist/skeleton.css';

// Keep the installed (home-screen) app in step with the deployed site.
// registerType is 'autoUpdate', so a new build reloads itself once found —
// but something has to go looking for it. An installed PWA is resumed rather
// than reloaded, so without these checks it can serve a stale build for days.
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
    updateSW(true);
  },
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
