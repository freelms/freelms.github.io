import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import type { LearnPath } from '../types';

export default function Paths() {
  const [paths, setPaths] = useState<LearnPath[]>([]);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const { user } = useAuth();
  useEffect(() => {
    if (!db) return;
    (async () => {
      const s = await getDocs(collection(db, 'paths'));
      setPaths(s.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as LearnPath[]);
      if (user) {
        const es = await getDocs(collection(db, 'users', user.uid, 'enrollments'));
        const m: Record<string, number> = {};
        es.docs.forEach((d) => { m[d.id] = (d.data() as any).progressPercent ?? 0; });
        setProgress(m);
      }
    })();
  }, [user]);
  return (
    <div className="mx-auto max-w-4xl px-3 py-4">
      <h1 className="font-bold">Learning paths</h1>
      <div className="mt-3 grid gap-3">
        {paths.map((p) => {
          const avg = p.courseIds.length ? Math.round(p.courseIds.reduce((a, id) => a + (progress[id] ?? 0), 0) / p.courseIds.length) : 0;
          return (
            <div key={p.id} className="card p-4">
              <h2 className="text-sm font-semibold">{p.title}</h2>
              <p className="text-sm text-slate-500">{p.description}</p>
              <div className="mt-2 h-1.5 rounded-full bg-slate-200 dark:bg-slate-800"><div className="h-full rounded-full bg-indigo-600" style={{ width: `${avg}%` }} /></div>
              <div className="mt-2 flex flex-wrap gap-2">{p.courseIds.map((id) => <Link key={id} to={`/course/${id}`} className="chip">{id}</Link>)}</div>
            </div>
          );
        })}
        {paths.length === 0 && <p className="text-sm text-slate-500">No paths yet — admins can create them in Admin → Paths.</p>}
      </div>
    </div>
  );
}
