import { useEffect, useState } from 'react';
import { useToast } from './useToast';

/** Poll version.json and alert when a new deployment is detected. */
export function useVersionCheck() {
  const { push } = useToast();
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);

  useEffect(() => {
    const fetchVersion = async () => {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}version.json?v=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        const versionKey = `${data.version}-${data.timestamp}`;
        if (!currentVersion) {
          setCurrentVersion(versionKey);
        } else if (versionKey !== currentVersion) {
          push('New version deployed!', {
            actionLabel: 'Reload',
            onAction: () => { location.reload(); }
          });
          setCurrentVersion(versionKey);
        }
      } catch { /* ignore */ }
    };
    fetchVersion();
    const intv = setInterval(fetchVersion, 5 * 60 * 1000); // every 5 min
    return () => clearInterval(intv);
  }, [currentVersion, push]);
}