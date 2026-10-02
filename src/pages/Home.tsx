import { useEffect, useMemo, useState } from 'react';
import { collection, doc, getDocs, getDoc, setDoc, deleteDoc, query, where } from 'firebase/firestore';
import { Link, useSearchParams } from 'react-router-dom';
import { db, hasFirebaseConfig } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import type { Course, Enrollment, Lesson } from '../types';
import { CourseCard } from '../components/CourseCard';
import { SkeletonCard, EmptyState } from '../components/ui';

const TTL = 60_000;

export default function Home({ lessonsByCourse, setLessons }: {
  lessonsByCourse: Record<string, Lesson[]>;
  setLessons: (m: Record<string, Lesson[]>) => void;
}) {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrollments, setEnrollments] = useState<Record<string, Enrollment>>({});
  const [bookmarks, setBookmarks] = useState<string[]>([]);
  const [shown, setShown] = useState(12);
  const q = params.get('q') ?? '';
  const topic = params.get('topic') ?? '';
  const mine = params.get('mine') === '1';
  const savedOnly = params.get('saved') === '1';
  useEffect(() => { setShown(12); }, [q, topic, mine, savedOnly]);

  useEffect(() => {
    (async () => {
      if (!db) { setLoading(false); return; }
      // sessionStorage cache with TTL (E16)
      try {
        const cached = sessionStorage.getItem('lh-courses');
        if (cached) {
          const { at, data } = JSON.parse(cached);
          if (Date.now() - at < TTL) { setCourses(data); setLoading(false); }
        }
      } catch { /* ignore */ }
      const snap = await getDocs(collection(db, 'courses'));
      const all = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Course[];
      const pub = all.filter((c) => c.status === 'published' || (c.published && c.status !== 'archived' && c.status !== 'draft') || (!c.status && c.published !== false));
      // published-only filter when status field present
      const filtered = all.some((c) => c.status) ? all.filter((c) => c.status === 'published') : pub;
      setCourses(filtered);
      try { sessionStorage.setItem('lh-courses', JSON.stringify({ at: Date.now(), data: filtered })); } catch { /* ignore */ }
      // prefetch lesson titles for search palette (one read per course, cached in memory)
      const m: Record<string, Lesson[]> = {};
      for (const c of filtered) {
        try {
          const ls = await getDocs(collection(db, 'courses', c.id, 'lessons'));
          m[c.id] = ls.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Lesson[];
        } catch { m[c.id] = []; }
      }
      setLessons(m);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!db || !user) { setEnrollments({}); setBookmarks([]); return; }
    (async () => {
      const es = await getDocs(collection(db, 'users', user.uid, 'enrollments'));
      const m: Record<string, Enrollment> = {};
      es.docs.forEach((d) => { m[d.id] = { courseId: d.id, ...(d.data() as any) }; });
      setEnrollments(m);
      const bs = await getDocs(collection(db, 'users', user.uid, 'bookmarks'));
      setBookmarks(bs.docs.map((d) => d.id));
    })();
  }, [user]);

  const topics = useMemo(() => [...new Set(courses.map((c) => c.topic).filter(Boolean))], [courses]);

  const visible = courses.filter((c) => {
    if (mine && user && !enrollments[c.id]) return false;
    if (savedOnly && !bookmarks.includes(c.id)) return false;
    if (topic && c.topic !== topic) return false;
    if (q && !(c.title + ' ' + c.instructor + ' ' + c.topic).toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const toggleBookmark = async (id: string) => {
    if (!db || !user) return;
    const has = bookmarks.includes(id);
    if (has) { await deleteDoc(doc(db, 'users', user.uid, 'bookmarks', id)); setBookmarks((b) => b.filter((x) => x !== id)); }
    else { await setDoc(doc(db, 'users', user.uid, 'bookmarks', id), { createdAt: new Date() }); setBookmarks((b) => [...b, id]); }
  };

  if (!hasFirebaseConfig) {
    return <div className="mx-auto max-w-6xl p-6 text-sm">Configure <code>.env</code> to load courses. See README “Firebase setup”.</div>;
  }

  const enrolledCourses = courses.filter((c) => enrollments[c.id]);

  return (
    <div className="mx-auto max-w-6xl px-3 py-4">
      {user && enrolledCourses.length > 0 && (
        <section aria-label="Continue learning">
          <h2 className="text-sm font-semibold">Continue learning</h2>
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {enrolledCourses.slice(0, 3).map((c) => {
              const total = (lessonsByCourse[c.id]?.length || c.lessonCount || 1);
              const done = (enrollments[c.id]?.completedLessons?.length ?? 0);
              return <CourseCard key={c.id} c={c} enrolled progress={Math.round((done / Math.max(1, total)) * 100)} bookmarked={bookmarks.includes(c.id)} onBookmark={() => toggleBookmark(c.id)} />;
            })}
          </div>
        </section>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input className="input max-w-xs" placeholder="Search courses…" value={q} aria-label="Search courses"
          onChange={(e) => setParams((p) => { const n = new URLSearchParams(p); e.target.value ? n.set('q', e.target.value) : n.delete('q'); return n; })} />
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Topics">
          <button className={`chip ${!topic ? 'bg-indigo-600 text-white' : ''}`} onClick={() => setParams((p) => { const n = new URLSearchParams(p); n.delete('topic'); return n; })}>All</button>
          {topics.map((t) => (
            <button key={t} className={`chip ${topic === t ? 'bg-indigo-600 text-white' : ''}`}
              onClick={() => setParams((p) => { const n = new URLSearchParams(p); n.set('topic', t); return n; })}>{t}</button>
          ))}
        </div>
        {user && <button className={`chip ${savedOnly ? 'bg-indigo-600 text-white' : ''}`}
          onClick={() => setParams((p) => { const n = new URLSearchParams(p); savedOnly ? n.delete('saved') : n.set('saved', '1'); return n; })}>♥ Saved</button>}
      </div>

      {loading ? (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => <SkeletonCard key={i} />)}
        </div>
      ) : visible.length === 0 ? (
        <div className="mt-6"><EmptyState title="No courses found" hint="Try a different search or topic." /></div>
      ) : (
        <>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.slice(0, shown).map((c) => {
            const total = (lessonsByCourse[c.id]?.length || c.lessonCount || 1);
            const done = (enrollments[c.id]?.completedLessons?.length ?? 0);
            return <CourseCard key={c.id} c={c} enrolled={Boolean(enrollments[c.id])}
              progress={enrollments[c.id] ? Math.round((done / Math.max(1, total)) * 100) : undefined}
              bookmarked={bookmarks.includes(c.id)} onBookmark={() => toggleBookmark(c.id)} />;
          })}
        </div>
        {shown < visible.length && (
          <div className="mt-4 text-center">
            <button className="btn-ghost" onClick={() => setShown((s) => s + 12)}>Load more ({visible.length - shown} left)</button>
          </div>
        )}
        </>)}
    </div>
  );
}
