import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

export function todayKey(d = new Date()) { return d.toISOString().slice(0, 10); }

/** Mark a learning day for streaks. */
export async function updateStreak(uid: string) {
  if (!db) return;
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  const days: string[] = (snap.data()?.streakDays ?? []) as string[];
  const t = todayKey();
  if (!days.includes(t)) {
    await setDoc(ref, { streakDays: [...days.slice(-60), t], lastActiveAt: serverTimestamp() }, { merge: true });
  }
}

export function streakCount(days: string[]): number {
  let n = 0;
  const d = new Date();
  while (days.includes(todayKey(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
