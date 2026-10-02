/// <reference types="vite/client" />
declare module 'virtual:pwa-register' {
  export function registerSW(options?: {
    onNeedRefresh?: () => void;
    onOfflineReady?: () => void;
    onRegisteredSW?: (url: string, reg?: ServiceWorkerRegistration) => void;
  }): (reloadPage?: boolean) => void;
}
