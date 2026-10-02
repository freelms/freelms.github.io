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
  useEffect(() => { document.title = 'FreeLMS — Free Online Courses & Video Training Platform'; }, []);

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
      <section className="card overflow-hidden" aria-label="About FreeLMS">
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 p-6 text-white sm:p-8">
          <h1 className="max-w-2xl text-2xl font-bold leading-tight sm:text-3xl">
            Free Online Courses for Everyone. Learn Anything, at Your Pace.
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-indigo-100">
            FreeLMS is a free online courses platform with curated video training, lesson-by-lesson
            progress tracking, quizzes with instant feedback and personal notes. No fees. No ads. Just learning — from web development and freelancing to
            everyday digital skills.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a href="#/paths" className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-indigo-700">Browse learning paths</a>
            <a href="#/about" className="rounded-lg border border-white/40 px-4 py-2 text-sm font-medium text-white">How it works</a>
          </div>
          <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-indigo-100">
            <li>✓ 100% free, forever</li>
            <li>✓ Learn from top creators (always credited)</li>
            <li>✓ Quizzes, notes &amp; progress tracking included</li>
          </ul>
        </div>
      </section>
      {user && enrolledCourses.length > 0 && (
        <section aria-label="Continue learning" className="mt-4">
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

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <h2 className="w-full text-sm font-semibold">Course catalog</h2>
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
      <SeoFaq />
    </div>
  );
}

const FAQS = [
  { q: 'Is FreeLMS really free?', a: 'Yes. Every course on FreeLMS is 100% free, forever. No fees, no ads, no paywalled lessons.' },
  { q: 'How do courses work?', a: 'Each course is a curated series of video lessons with a weekly timetable, quizzes with instant feedback, personal notes and a progress tracker. Enroll once, learn at your own pace.' },
  { q: 'How is my progress saved?', a: 'Enroll free with your account and every lesson you complete, quiz attempt and note is saved automatically, so you can continue learning on any device.' },
  { q: 'Who creates the videos?', a: 'Lessons embed videos from independent creators using the official YouTube player. Every creator is credited with channel and original-video links — we never re-upload their work.' }
];

function SeoFaq() {
  useEffect(() => {
    const el = document.getElementById('faq-jsonld');
    if (!el) {
      const s = document.createElement('script');
      s.id = 'faq-jsonld';
      s.type = 'application/ld+json';
      s.textContent = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: FAQS.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } }))
      });
      document.head.appendChild(s);
    }
  }, []);
  return (
    <section className="card mt-6 p-4 sm:p-6" aria-label="Frequently asked questions">
      <h2 className="text-base font-bold">Free online courses — questions, answered</h2>
      <p className="mt-1 text-sm text-slate-500">
        New to online learning? FreeLMS makes it simple: pick a free course below, enroll in one click,
        and your progress, quiz scores and notes are saved automatically.
      </p>
      <div className="mt-3 space-y-2">
        {FAQS.map((f) => (
          <details key={f.q} className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800">
            <summary className="cursor-pointer font-medium">{f.q}</summary>
            <p className="mt-1 text-slate-600 dark:text-slate-300">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
