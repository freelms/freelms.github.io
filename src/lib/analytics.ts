declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

let loaded = false;

/** Load Google Analytics (gtag.js) once, only when an ID is configured. */
export function initAnalytics() {
  const id = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;
  if (!id || loaded || typeof document === 'undefined') return;
  loaded = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer!.push(args);
  };
  window.gtag('js', new Date());
  window.gtag('config', id);
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.appendChild(s);
}

/** Fire a GA4 custom event (funnel: enroll → lesson → quiz). No-op without ID. */
export function trackEvent(name: string, params?: Record<string, unknown>) {
  try {
    window.gtag?.('event', name, params ?? {});
  } catch { /* ignore */ }
}
