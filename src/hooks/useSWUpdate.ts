import { useEffect, useState } from 'react';
import { useToast } from './useToast';

/** Hook to detect SW updates and show a "New version available" toast. */
export function useSWUpdate() {
  const { push } = useToast();
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
const check = async () => {
        try {
          const reg = await navigator.serviceWorker.ready;
          await reg.update();
          if (reg.waiting) {
            setUpdateReady(true);
            push('New version available!', {
              actionLabel: 'Reload',
              onAction: () => {
                reg.waiting?.postMessage({ type: 'SKIP_WAITING' });
                location.reload();
              }
            });
          }
        } catch { /* ignore */ }
      };
    check();
    const intv = setInterval(check, 30 * 60 * 1000); // every 30 min
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      setUpdateReady(false);
    });
    return () => clearInterval(intv);
  }, [push]);

  return updateReady;
}