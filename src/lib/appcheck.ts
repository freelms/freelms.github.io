import { auth, db } from './firebase';

// Lazy App Check (reCAPTCHA v3) — only in production with a site key.
export async function initAppCheck() {
  try {
    // Debug token for localhost (works in dev AND prod-on-localhost).
    if (location.hostname === 'localhost') {
      (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    }
    if (import.meta.env.PROD && import.meta.env.VITE_RECAPTCHA_SITE_KEY && db) {
      const { initializeAppCheck, ReCaptchaV3Provider } = await import('firebase/app-check');
      const { app } = await import('./firebase');
      initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(import.meta.env.VITE_RECAPTCHA_SITE_KEY),
        isTokenAutoRefreshEnabled: true
      });
    }
  } catch (e) {
    console.warn('AppCheck init skipped', e);
  }
}

export { auth, db };
