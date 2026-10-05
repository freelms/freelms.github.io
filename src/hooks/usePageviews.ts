import { useEffect } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './useAuth';

const SEEN_KEY = 'lh-pv-seen';

/** Log one pageview per path per tab session (bounds write volume). */
async function beacon(path: string, uid: string | null) {
  if (!db) return;
  try {
    const seen: string[] = JSON.parse(sessionStorage.getItem(SEEN_KEY) ?? '[]');
    if (seen.includes(path)) return;
    sessionStorage.setItem(SEEN_KEY, JSON.stringify([...seen.slice(-49), path]));
  } catch {
    return;
  }
  const m = path.match(/^\/(course|learn)\/([^/?]+)/);
  try {
    await addDoc(collection(db, 'pageviews'), {
      path: path.slice(0, 200),
      courseId: m ? m[2].slice(0, 100) : null,
      uid: uid ?? null,
      ts: serverTimestamp()
    });
  } catch {
    /* analytics must never break the app */
  }
}

/** Mount once inside the router: tracks hash-route changes + initial load. */
export function usePageviews() {
  const { user } = useAuth();
  useEffect(() => {
    const send = () => {
      const hash = window.location.hash.replace(/^#/, '') || '/';
      beacon(hash.split('?')[0], user?.uid ?? null);
    };
    send();
    window.addEventListener('hashchange', send);
    return () => window.removeEventListener('hashchange', send);
  }, [user]);
}
