import { useEffect, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { AsyncButton } from './AsyncButton';
import type { Review } from '../types';

export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-amber-400" role="img" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" fill={i <= Math.round(value) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" aria-hidden>
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
    </span>
  );
}

export function Reviews({ courseId }: { courseId: string }) {
  const { user, isAdmin } = useAuth();
  const { push } = useToast();
  const [items, setItems] = useState<(Review & { id: string })[]>([]);
  const [rating, setRating] = useState(5);
  const [text, setText] = useState('');
  const [mine, setMine] = useState(false);

  const reload = async () => {
    if (!db) return;
    const snap = await getDocs(collection(db, 'courses', courseId, 'reviews'));
    const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as (Review & { id: string })[];
    list.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
    setItems(list);
  };
  useEffect(() => { reload(); }, [courseId]);

  useEffect(() => {
    if (!db || !user) { setMine(false); return; }
    getDoc(doc(db, 'users', user.uid, 'enrollments', courseId))
      .then((s) => setMine(s.exists()))
      .catch(() => setMine(false));
  }, [courseId, user]);

  const avg = items.length ? items.reduce((s, r) => s + r.rating, 0) / items.length : 0;

  const submit = async () => {
    if (!db || !user || !mine) return;
    if (!text.trim()) { push('Write a few words with your rating'); return; }
    await setDoc(doc(db, 'courses', courseId, 'reviews', user.uid), {
      uid: user.uid,
      displayName: user.displayName ?? user.email ?? 'Learner',
      rating,
      text: text.trim(),
      createdAt: serverTimestamp()
    });
    // recompute aggregates (cheap: reviews per course are few)
    const snap = await getDocs(collection(db, 'courses', courseId, 'reviews'));
    const all = snap.docs.map((d) => d.data() as any);
    const next = all.length ? all.reduce((s, r) => s + (r.rating ?? 0), 0) / all.length : 0;
    const { updateDoc } = await import('firebase/firestore');
    await updateDoc(doc(db, 'courses', courseId), { avgRating: Math.round(next * 10) / 10, ratingCount: all.length });
    setText('');
    reload();
    push('Review posted — thank you!');
  };

  return (
    <div className="card mt-4 p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Reviews</p>
      <div className="mt-1 flex items-center gap-2">
        <h2 className="text-sm font-bold">What learners say</h2>
        {items.length > 0 && (
          <span className="flex items-center gap-1.5 text-sm">
            <Stars value={avg} />
            <span className="font-bold">{avg.toFixed(1)}</span>
            <span className="text-xs text-slate-500">({items.length})</span>
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">No reviews yet — enrolled students can leave the first one.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.slice(0, 5).map((r) => (
            <li key={r.id} className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800/60">
              <div className="flex items-center gap-2">
                <Stars value={r.rating} size={12} />
                <span className="text-xs font-semibold">{r.displayName}</span>
                {(user?.uid === r.uid || isAdmin) && (
                  <button
                    className="ml-auto text-xs text-red-600 underline"
                    onClick={async () => {
                      if (!db || !confirm('Delete this review?')) return;
                      await deleteDoc(doc(db, 'courses', courseId, 'reviews', r.id));
                      reload();
                    }}
                  >
                    Delete
                  </button>
                )}
              </div>
              <p className="mt-1 text-slate-600 dark:text-slate-300">{r.text}</p>
            </li>
          ))}
        </ul>
      )}

      {user && mine && (
        <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
          <p className="text-xs font-semibold">Your review</p>
          <div className="mt-1.5 flex items-center gap-1" role="radiogroup" aria-label="Your rating">
            {[1, 2, 3, 4, 5].map((i) => (
              <button key={i} role="radio" aria-checked={rating === i} onClick={() => setRating(i)} aria-label={`${i} stars`}>
                <svg width={22} height={22} viewBox="0 0 24 24" fill={i <= rating ? '#fbbf24' : 'none'} stroke="#fbbf24" strokeWidth="2">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              </button>
            ))}
          </div>
          <textarea
            className="input mt-2"
            placeholder="What did you think of this course?"
            value={text}
            onChange={(e) => setText(e.target.value)}
            aria-label="Review text"
          />
          <AsyncButton className="btn-primary mt-2" onPress={submit}>Post review</AsyncButton>
        </div>
      )}
    </div>
  );
}
