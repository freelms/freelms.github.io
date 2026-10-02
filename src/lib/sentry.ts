import * as Sentry from '@sentry/react';

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (import.meta.env.PROD && dsn) {
    Sentry.init({ dsn, tracesSampleRate: 0.1 });
  }
}
