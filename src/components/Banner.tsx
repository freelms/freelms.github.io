import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import type { Announcement } from '../types';

export function AnnouncementBanner({ courseId }: { courseId?: string }) {
  const { user } = useAuth();
  const [items, setItems] = useState<Announcement[]>([]);
  useEffect(() => {
    if (!db || !user) return;
    (async () => {
      const snap = await getDocs(collection(db, 'announcements'));
      const dismissed: string[] = JSON.parse(localStorage.getItem(`lh-dismiss-${user.uid}`) ?? '[]');
      const now = Date.now();
      setItems(
        snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as any) }))
          .filter((a) => !dismissed.includes(a.id))
          .filter((a) => !a.courseId || a.courseId === courseId || !courseId)
          .filter((a) => !a.expiresAt || a.expiresAt.toMillis?.() > now)
      );
    })();
  }, [user, courseId]);
  if (!items.length) return null;
  return (
    <div className="mx-auto max-w-6xl space-y-2 px-3 pt-3">
      {items.map((a) => (
        <div key={a.id} className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-sm dark:bg-amber-950 dark:border-amber-800">
          <span className="flex-1">{a.message}</span>
          <button aria-label="Dismiss" className="rounded px-2 hover:bg-amber-100 dark:hover:bg-amber-900" onClick={() => {
            const k = `lh-dismiss-${user!.uid}`;
            const cur: string[] = JSON.parse(localStorage.getItem(k) ?? '[]');
            localStorage.setItem(k, JSON.stringify([...cur, a.id]));
            setItems((s) => s.filter((x) => x.id !== a.id));
          }}>✕</button>
        </div>
      ))}
    </div>
  );
}
