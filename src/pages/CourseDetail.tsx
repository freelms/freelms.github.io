import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { doc, getDoc, getDocs, collection, setDoc, serverTimestamp, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import type { Course, Lesson } from '../types';
import { ReportForm } from '../components/ReportForm';
import { Reviews } from '../components/Reviews';
import { AsyncButton } from '../components/AsyncButton';
import { resolveThumb } from '../lib/thumb';
import { sortLessons } from '../lib/lessons';

const shortTitle = (c: { seoTitle?: string; title: string }) =>
  c.seoTitle?.trim() || (c.title.length <= 55 ? c.title : c.title.slice(0, 55).replace(/\s+\S*$/, ''));

export default function CourseDetail() {
  const { id } = useParams();
  const [course, setCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [enrolled, setEnrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [prereqs, setPrereqs] = useState<Course[]>([]);
  const { user } = useAuth();
  const { push } = useToast();
  const nav = useNavigate();

  useEffect(() => {
    if (!db || !id) return;
    (async () => {
      const snap = await getDoc(doc(db, 'courses', id));
      if (snap.exists()) {
        const c = { id: snap.id, ...(snap.data() as any) } as Course;
        setCourse(c);
        document.title = `${shortTitle(c)} | FreeLMS GitHub`;
        const md = document.querySelector('meta[name="description"]');
        if (md) md.setAttribute('content', `Learn ${c.title} free on FreeLMS. ${c.description.slice(0, 140)}`);
        // canonical points at the prerendered static snapshot (SEO); + Course JSON-LD
        const base = (import.meta.env.SITE_URL ?? import.meta.env.VITE_APP_URL ?? '').replace(/\/?$/, '/');
        if (base) {
          let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
          if (!link) { link = document.createElement('link'); link.rel = 'canonical'; document.head.appendChild(link); }
          link.href = `${base}course/${c.id}/`;
        }
        if (!document.getElementById('course-jsonld')) {
          const s = document.createElement('script');
          s.id = 'course-jsonld';
          s.type = 'application/ld+json';
          s.textContent = JSON.stringify({
            '@context': 'https://schema.org', '@type': 'Course', name: c.title,
            description: c.description.slice(0, 500),
            provider: { '@type': 'Organization', name: 'FreeLMS' }
          });
          document.head.appendChild(s);
        }
        if (c.prerequisiteIds?.length) {
          const ps: Course[] = [];
          for (const pid of c.prerequisiteIds) {
            const p = await getDoc(doc(db, 'courses', pid));
            if (p.exists()) ps.push({ id: p.id, ...(p.data() as any) } as Course);
          }
          setPrereqs(ps);
        }
      }
      if (user) {
        try {
          const ls = await getDocs(collection(db, 'courses', id, 'lessons'));
          setLessons(sortLessons(ls.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Lesson[]));
        } catch { setLessons([]); }
        const en = await getDoc(doc(db, 'users', user.uid, 'enrollments', id));
        setEnrolled(en.exists());
      } else {
        setLessons([]);
      }
    })();
  }, [id, user]);

  if (!course) return <div className="mx-auto max-w-4xl p-6"><div className="skeleton h-40 w-full" /></div>;

  const enroll = async () => {
    if (!user) { nav('/login', { state: { from: `/course/${id}` } }); return; }
    if (!db || !id) return;
    await setDoc(doc(db, 'users', user.uid, 'enrollments', id), {
      enrolledAt: serverTimestamp(), completedLessons: [], progressPercent: 0, lastActiveAt: serverTimestamp()
    }, { merge: true });
    // enrollment counter (E4, cheap aggregate)
    try {
      const { increment, updateDoc } = await import('firebase/firestore');
      await updateDoc(doc(db, 'stats', id), { enrollmentCount: increment(1) }).catch(async () => {
        await setDoc(doc(db, 'stats', id), { enrollmentCount: 1, completionCount: 0 });
      });
    } catch { /* ignore */ }
    setEnrolled(true);
    push('Enrolled!');
    const { trackEvent } = await import('../lib/analytics');
    trackEvent('enroll', { course_id: id, course_title: course?.title ?? id });
    nav(`/learn/${id}`);
  };

  const lessonCount = lessons.length || course.lessonCount || 0;

  return (
    <div className="mx-auto max-w-6xl px-3 py-4">
      <Link to="/" className="text-xs font-medium text-slate-500 hover:text-indigo-600">← All courses</Link>

      <div className="mt-2 grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="card overflow-hidden">
          <div className="relative">
            {course.thumbnail && <img src={resolveThumb(course.thumbnail)} alt="" className="h-56 w-full object-cover sm:h-[300px]" />}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent" aria-hidden />
            <div className="absolute bottom-0 left-0 right-0 flex flex-wrap items-center gap-1.5 p-4">
              {(course.tags ?? []).map((t) => (
                <Link key={t.slug} to={`/tag/${t.slug}`} className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur hover:bg-white/25" style={t.color ? { border: `1px solid ${t.color}` } : undefined}>
                  {t.name}
                </Link>
              ))}
              {!(course.tags ?? []).length && course.topic && (
                <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">{course.topic}</span>
              )}
              {course.level && <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">{course.level}</span>}
            </div>
          </div>
          <div className="p-5">
            <h1 className="text-2xl font-extrabold leading-tight tracking-tight sm:text-[1.7rem]">{course.title}</h1>
            <div className="mt-3 flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-sm font-bold text-white" aria-hidden>
                {(course.instructor || '?').charAt(0).toUpperCase()}
              </span>
              <div>
                <p className="text-sm font-semibold">{course.instructor}</p>
                <p className="text-xs text-slate-500">{lessonCount} lessons · Free forever</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 lg:hidden">
              {enrolled
                ? <Link to={`/learn/${course.id}`} className="btn-primary flex-1">Continue learning →</Link>
                : <AsyncButton onPress={enroll} className="btn-primary flex-1">Enroll now — free</AsyncButton>}
            </div>
          </div>
        </div>

        <aside className="card hidden h-fit p-5 lg:sticky lg:top-20 lg:block">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">This course includes</p>
          <ul className="mt-3 space-y-2.5 text-sm">
            <li className="flex items-center gap-2"><span className="text-emerald-500">✓</span> {lessonCount} video lessons</li>
            <li className="flex items-center gap-2"><span className="text-emerald-500">✓</span> Quizzes with instant feedback</li>
            <li className="flex items-center gap-2"><span className="text-emerald-500">✓</span> Notes + progress tracking</li>
            <li className="flex items-center gap-2"><span className="text-emerald-500">✓</span> Lifetime access, no ads</li>
          </ul>
          <div className="mt-4">
            {enrolled
              ? <Link to={`/learn/${course.id}`} className="btn-primary w-full">Continue learning →</Link>
              : <AsyncButton onPress={enroll} className="btn-primary w-full">Enroll now — free</AsyncButton>}
            <p className="mt-2 text-center text-[11px] text-slate-500">{enrolled ? 'You’re enrolled' : 'One click, no payment'}</p>
          </div>
        </aside>
      </div>

      {prereqs.length > 0 && (
        <div className="card mt-4 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Before you start</p>
          <h2 className="mt-1 text-sm font-bold">Recommended first</h2>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {prereqs.map((p) => <Link key={p.id} to={`/course/${p.id}`} className="chip hover:bg-slate-200 dark:hover:bg-slate-700">{p.title}</Link>)}
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
      <div className="card mt-4 p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">About</p>
        <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap">{course.description}</p>
        {course.outcomes && course.outcomes.length > 0 && (
          <>
            <h3 className="mt-4 text-sm font-bold">What you'll learn</h3>
            <ul className="mt-2 space-y-1.5 text-sm">
              {course.outcomes.map((o, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" aria-hidden>✓</span>
                  <span>{o}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="card mt-4 h-fit p-5 lg:sticky lg:top-20">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Curriculum</p>
            <h2 className="text-sm font-bold">Syllabus {user && enrolled ? `· ${lessons.length}` : ''}</h2>
          </div>
          <button className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            {open ? 'Collapse' : 'Expand'}
          </button>
        </div>
        {open && (
          <ol className="mt-3 max-h-[420px] space-y-1 overflow-auto pr-1">
            {lessons.length === 0 && <li className="py-2 text-sm text-slate-500">{enrolled ? 'No lessons yet.' : '🔒 Videos unlock the moment you enroll — free.'}</li>}
            {lessons.map((l, i) => (
              <li key={l.id} className="flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition hover:bg-slate-50 dark:hover:bg-slate-800/60">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate">{l.title}</span>
                {l.duration && <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-500 dark:bg-slate-800">{l.duration}</span>}
              </li>
            ))}
          </ol>
        )}
        {!open && (
          <p className="mt-2 text-xs text-slate-500">{user && enrolled ? `${lessons.length} lessons inside — expand to browse.` : 'Expand to preview the lesson lineup.'}</p>
        )}
      </div>
      </div>

      <div className="card mt-4 p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Attribution</p>
        <h2 className="mt-1 text-sm font-bold">Credits and sources</h2>
        <ul className="mt-2 space-y-2 text-sm">
          {(course.credits ?? []).map((c, i) => (
            <li key={i} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
              <span aria-hidden>🎬</span>
              <span className="font-medium">{c.creator}</span>
              {c.channelUrl && <a className="ml-auto text-xs font-medium text-indigo-600 hover:underline" href={c.channelUrl} target="_blank" rel="noreferrer">Channel</a>}
              {c.videoUrl && <a className="text-xs font-medium text-indigo-600 hover:underline" href={c.videoUrl} target="_blank" rel="noreferrer">Original video</a>}
            </li>
          ))}
          {(course.credits ?? []).length === 0 && <li className="text-slate-500">Credits will be listed here.</li>}
        </ul>
        <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800"><ReportForm courseId={course.id} /></div>
      </div>

      <Reviews courseId={course.id} />
    </div>
  );
}
