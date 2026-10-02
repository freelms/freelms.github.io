import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { doc, getDoc, getDocs, collection, setDoc, serverTimestamp, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import type { Course, Lesson } from '../types';
import { ReportForm } from '../components/ReportForm';
import { resolveThumb } from '../lib/thumb';

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
        document.title = `${shortTitle(c)} | FreeLMS`;
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
          setLessons(ls.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Lesson[]);
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
    nav(`/learn/${id}`);
  };

  return (
    <div className="mx-auto max-w-4xl px-3 py-4">
      <div className="card overflow-hidden">
        {course.thumbnail && <img src={resolveThumb(course.thumbnail)} alt="" className="h-52 w-full object-cover" />}
        <div className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="chip bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">{course.topic}</span>
            {course.level && <span className="chip">{course.level}</span>}
          </div>
          <h1 className="mt-2 text-xl font-bold">{course.title}</h1>
          <p className="text-sm text-slate-500">by {course.instructor}</p>
          {enrolled
            ? <Link to={`/learn/${course.id}`} className="btn-primary mt-3">Go to course</Link>
            : <button onClick={enroll} className="btn-primary mt-3">Enroll — free</button>}
        </div>
      </div>

      {prereqs.length > 0 && (
        <div className="card mt-3 p-4">
          <h2 className="text-sm font-semibold">Recommended before this course</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {prereqs.map((p) => <Link key={p.id} to={`/course/${p.id}`} className="chip hover:bg-slate-200">{p.title}</Link>)}
          </div>
        </div>
      )}

      <div className="card mt-3 p-4">
        <h2 className="text-sm font-semibold">About</h2>
        <p className="mt-1 text-sm whitespace-pre-wrap">{course.description}</p>
        {course.outcomes && course.outcomes.length > 0 && (
          <>
            <h3 className="mt-3 text-sm font-semibold">What you'll learn</h3>
            <ul className="mt-1 list-disc pl-5 text-sm">{course.outcomes.map((o, i) => <li key={i}>{o}</li>)}</ul>
          </>
        )}
      </div>

      <div className="card mt-3 p-4">
        <button className="flex w-full items-center justify-between text-sm font-semibold" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          Syllabus {user && enrolled ? `(${lessons.length} lessons)` : '(enroll to unlock videos)'} <span>{open ? '−' : '+'}</span>
        </button>
        {open && (
          <ul className="mt-2 divide-y divide-slate-100 text-sm dark:divide-slate-800">
            {lessons.length === 0 && <li className="py-2 text-slate-500">{enrolled ? 'No lessons yet.' : 'Videos are locked until you enroll.'}</li>}
            {lessons.map((l) => (
              <li key={l.id} className="flex items-center justify-between py-2">
                <span>{l.title}</span>
                <span className="text-xs text-slate-500">{l.duration ?? ''}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card mt-3 p-4">
        <h2 className="text-sm font-semibold">Credits and sources</h2>
        <ul className="mt-1 space-y-1 text-sm">
          {(course.credits ?? []).map((c, i) => (
            <li key={i}>🎬 {c.creator}
              {c.channelUrl && <a className="ml-2 underline" href={c.channelUrl} target="_blank" rel="noreferrer">Channel</a>}
              {c.videoUrl && <a className="ml-2 underline" href={c.videoUrl} target="_blank" rel="noreferrer">Original video</a>}
            </li>
          ))}
          {(course.credits ?? []).length === 0 && <li className="text-slate-500">Credits will be listed here.</li>}
        </ul>
        <div className="mt-2"><ReportForm courseId={course.id} /></div>
      </div>
    </div>
  );
}
