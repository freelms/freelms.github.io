import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { doc, getDoc, getDocs, collection, setDoc, serverTimestamp, addDoc, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import type { Course, Lesson, Quiz, Enrollment, QuizAttempt } from '../types';
import { ProgressRing, EmptyState } from '../components/ui';
import { YTPlayer, seekPlayer } from '../components/YTPlayer';
import { QuizRunner } from '../components/Quiz';
import { ReportForm } from '../components/ReportForm';
import { googleCalendarUrl, downloadICS } from '../lib/ics';
import { updateStreak } from '../components/streak';
import { LessonComments } from '../components/Comments';
import { AnnouncementBanner } from '../components/Banner';

type Tab = 'overview' | 'videos' | 'timetable' | 'quizzes' | 'notes';

export default function Learn() {
  const { id } = useParams();
  const { user } = useAuth();
  const { push } = useToast();
  const nav = useNavigate();
  const [course, setCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [enroll, setEnroll] = useState<Enrollment | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [lessonId, setLessonId] = useState<string | null>(null);
  const [speed, setSpeed] = useState(1);
  const [showKeys, setShowKeys] = useState(false);
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [savedTick, setSavedTick] = useState(0);
  const [allNotesQ, setAllNotesQ] = useState('');

  const lesson = useMemo(() => lessons.find((l) => l.id === lessonId) ?? lessons[0], [lessons, lessonId]);
  const done = enroll?.completedLessons ?? [];
  const pct = lessons.length ? Math.round((done.length / lessons.length) * 100) : 0;

  useEffect(() => {
    if (!db || !id || !user) return;
    (async () => {
      const en = await getDoc(doc(db, 'users', user.uid, 'enrollments', id));
      if (!en.exists()) { nav(`/course/${id}`); return; }
      setEnroll({ ...(en.data() as any) });
      const c = await getDoc(doc(db, 'courses', id));
      if (c.exists()) {
        const cd = { id: c.id, ...(c.data() as any) } as Course;
        setCourse(cd);
        document.title = `Learn: ${cd.title} | FreeLMS`;
      }
      const ls = await getDocs(collection(db, 'courses', id, 'lessons'));
      const arr = (ls.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Lesson[])
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      setLessons(arr);
      const qs = await getDocs(collection(db, 'courses', id, 'quizzes'));
      setQuizzes(qs.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Quiz[]);
      const at = await getDocs(collection(db, 'users', user.uid, 'quizAttempts'));
      setAttempts(at.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as QuizAttempt[]);
      // notes
      const ns = await getDocs(collection(db, 'users', user.uid, 'notes'));
      const m: Record<string, string> = {};
      ns.docs.forEach((d) => {
        const v = d.data() as any;
        if (String(d.id).startsWith(`${id}_`)) m[d.id] = v.content ?? '';
      });
      setNotes(m);
      // resume last lesson
      const lastId = (en.data() as any)?.lastLessonId;
      if (lastId && arr.some((l) => l.id === lastId)) setLessonId(lastId);
      else if (arr.length) {
        const next = arr.find((l) => !((en.data() as any)?.completedLessons ?? []).includes(l.id));
        setLessonId((next ?? arr[0]).id);
      }
    })();
  }, [id, user]);

  // keyboard shortcuts (E1)
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (tab !== 'videos') return;
      const t = e.target as HTMLElement;
      if (/INPUT|TEXTAREA|SELECT/.test(t.tagName)) return;
      if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
      else if (e.key === 'ArrowRight') seekPlayer(currentTimeRef.current + 10);
      else if (e.key === 'ArrowLeft') seekPlayer(currentTimeRef.current - 10);
      else if (e.key === 'n' || e.key === 'N') step(1);
      else if (e.key === 'p' || e.key === 'P') step(-1);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  const currentTimeRef = { current: 0 } as { current: number };
  const lastSaveRef = { current: 0 } as { current: number };

  function togglePlay() {
    (async () => {
      try {
        const m = await import('../components/YTPlayer');
        m.togglePlayer();
      } catch { /* ignore */ }
    })();
  }
  function step(d: number) {
    const i = lessons.findIndex((l) => l.id === lesson?.id);
    const n = lessons[i + d];
    if (n) setLessonId(n.id);
  }

  const onTime = async (t: number, dur: number) => {
    currentTimeRef.current = t;
    if (!db || !user || !id || !lesson) return;
    const now = Date.now();
    if (now - lastSaveRef.current > 10_000) {
      lastSaveRef.current = now;
      await setDoc(doc(db, 'users', user.uid, 'enrollments', id),
        { lastLessonId: lesson.id, lastTime: Math.floor(t), lastActiveAt: serverTimestamp() }, { merge: true });
    }
    if (dur > 0 && t / dur >= 0.9 && !done.includes(lesson.id)) {
      await toggleComplete(lesson.id, true);
      push('Lesson auto-marked complete (90% watched)', {
        actionLabel: 'Undo',
        onAction: () => toggleComplete(lesson.id)
      });
    }
  };

  const onPauseSave = async (t: number) => {
    if (!db || !user || !id || !lesson) return;
    lastSaveRef.current = Date.now();
    await setDoc(doc(db, 'users', user.uid, 'enrollments', id),
      { lastLessonId: lesson.id, lastTime: Math.floor(t), lastActiveAt: serverTimestamp() }, { merge: true });
  };

  const toggleComplete = async (lid: string, force?: boolean) => {
    if (!db || !user || !id) return;
    const has = done.includes(lid);
    const next = force === true || !has ? [...done, lid] : done.filter((x) => x !== lid);
    const pp = lessons.length ? Math.round((next.length / lessons.length) * 100) : 0;
    await setDoc(doc(db, 'users', user.uid, 'enrollments', id),
      { completedLessons: next, progressPercent: pp, lastLessonId: lid, lastActiveAt: serverTimestamp() }, { merge: true });
    setEnroll((e) => (e ? { ...e, completedLessons: next, progressPercent: pp } : e));
    await updateStreak(user.uid);
    if (pp === 100) {
      try {
        const { increment, updateDoc } = await import('firebase/firestore');
        await updateDoc(doc(db, 'stats', id), { completionCount: increment(1) }).catch(() => {});
      } catch { /* ignore */ }
    }
  };

  const bestFor = (qid: string) => {
    const xs = attempts.filter((a) => a.quizId === qid);
    return xs.length ? xs.reduce((m, a) => Math.max(m, a.score), 0) : null;
  };
  // notes autosave
  const saveNote = async (lid: string, content: string) => {
    if (!db || !user || !id) return;
    await setDoc(doc(db, 'users', user.uid, 'notes', `${id}_${lid}`), { content, updatedAt: serverTimestamp() }, { merge: true });
    setSavedTick(Date.now());
  };

  if (!course) return <div className="mx-auto max-w-6xl p-4"><div className="skeleton h-24 w-full" /></div>;

  return (
    <div className="mx-auto max-w-6xl px-3 py-4">
      <AnnouncementBanner courseId={id} />
      <div className="card flex items-center gap-3 p-3">
        <ProgressRing pct={pct} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-bold">{course.title}</h1>
          <p className="text-xs text-slate-500">{done.length}/{lessons.length} lessons · {pct}%</p>
        </div>
      </div>

      <div className="mt-3 flex gap-1.5 overflow-x-auto" role="tablist">
        {(['overview', 'videos', 'timetable', 'quizzes', 'notes'] as Tab[]).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
            className={`chip !px-3 !py-1.5 capitalize ${tab === t ? '!bg-indigo-600 !text-white' : ''}`}>{t}</button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="card mt-3 p-4 text-sm">
          <p className="whitespace-pre-wrap">{course.description}</p>
          <p className="mt-2 text-slate-500">Instructor: {course.instructor}</p>
          <h3 className="mt-3 font-semibold">Credits</h3>
          <ul className="mt-1 space-y-1">{(course.credits ?? []).map((c, i) => <li key={i}>🎬 {c.creator}</li>)}</ul>
        </div>
      )}

      {tab === 'videos' && (
        <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_300px]">
          <div>
            {lesson ? (
              <>
                <YTPlayer key={lesson.id} videoId={lesson.videoId}
                  startAt={lesson.id === enroll?.lastLessonId ? (enroll?.lastTime ?? 0) : 0}
                  onTime={onTime} onPause={onPauseSave}
                  onEnded={() => step(1)} speed={speed} />
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                  <h2 className="font-semibold">{lesson.title}</h2>
                  <span className="text-xs text-slate-500">{lesson.duration ?? ''}</span>
                  <label className="ml-auto flex items-center gap-1 text-xs">Speed:
                    <select className="input !w-auto !py-1" value={speed} onChange={(e) => setSpeed(Number(e.target.value))} aria-label="Playback speed">
                      {[0.75, 1, 1.25, 1.5, 2].map((s) => <option key={s} value={s}>{s}x</option>)}
                    </select>
                  </label>
                  <button className="btn-ghost !py-1 text-xs" onClick={() => setShowKeys((s) => !s)}>⌨ Shortcuts</button>
                </div>
                {showKeys && <p className="mt-1 text-xs text-slate-500">Space play/pause · ←/→ seek 10s · N next · P previous (disabled while typing).</p>}
                {(lesson.creator || lesson.videoUrl || lesson.channelUrl) && (
                  <p className="mt-1 text-xs text-slate-500">Source: {lesson.creator ?? 'Original creator'}
                    {lesson.channelUrl && <a className="ml-2 underline" href={lesson.channelUrl} target="_blank" rel="noreferrer">Channel</a>}
                    {lesson.videoUrl && <a className="ml-2 underline" href={lesson.videoUrl} target="_blank" rel="noreferrer">Original video</a>}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  <button className={`btn ${done.includes(lesson.id) ? 'btn-ghost' : 'btn-primary'}`} onClick={() => toggleComplete(lesson.id)}>
                    {done.includes(lesson.id) ? '✓ Completed — undo' : 'Mark complete'}
                  </button>
                  <button className="btn-ghost" onClick={() => step(-1)}>← Prev</button>
                  <button className="btn-ghost" onClick={() => step(1)}>Next →</button>
                </div>
                {(lesson.resources?.length ?? 0) > 0 && (
                  <div className="card mt-3 p-3">
                    <h3 className="text-sm font-semibold">Resources</h3>
                    <ul className="mt-1 space-y-1 text-sm">{lesson.resources!.map((r, i) => <li key={i}><a className="underline" href={r.url} target="_blank" rel="noreferrer">{r.label}</a> <span className="text-xs text-slate-500">{r.type}</span></li>)}</ul>
                  </div>
                )}
                {quizzes.filter((qz) => qz.lessonId === lesson.id).map((qz) => (
                  <div key={qz.id} className="card mt-3 p-3">
                    <h3 className="text-sm font-semibold">Quick check: {qz.title}</h3>
                    <button className="btn-primary mt-2" onClick={() => { setActiveQuiz(qz); setTab('quizzes'); }}>Start quick check</button>
                  </div>
                ))}
                <div className="mt-2"><ReportForm courseId={course.id} lessonId={lesson.id} /></div>
                <LessonComments courseId={course.id} lessonId={lesson.id} />
              </>
            ) : <EmptyState title="No lessons yet" />}
          </div>
          <aside className="card max-h-[70vh] overflow-auto p-2">
            {lessons.map((l) => (
              <button key={l.id} onClick={() => setLessonId(l.id)}
                className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800 ${l.id === lesson?.id ? 'bg-indigo-50 dark:bg-indigo-950' : ''}`}>
                <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] ${done.includes(l.id) ? 'bg-green-600 text-white' : 'bg-slate-200 dark:bg-slate-700'}`}>
                  {done.includes(l.id) ? '✓' : ''}
                </span>
                <span className="min-w-0 flex-1 truncate">{l.title}</span>
                {l.broken && <span className="chip bg-red-100 text-red-700">broken</span>}
              </button>
            ))}
          </aside>
        </div>
      )}

      {tab === 'timetable' && (
        <div className="card mt-3 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Weekly schedule {course.timezone && `(${course.timezone})`}</h2>
            {(course.schedule?.length ?? 0) > 0 && <button className="btn-ghost !py-1 text-xs" onClick={() => downloadICS(course.schedule ?? [], course.title)}>Download .ics</button>}
          </div>
          <ul className="mt-2 divide-y divide-slate-100 text-sm dark:divide-slate-800">
            {(course.schedule ?? []).map((s, i) => {
              const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
              const isToday = s.day.toLowerCase() === today.toLowerCase();
              return (
                <li key={i} className={`flex flex-wrap items-center gap-2 py-2 ${isToday ? 'rounded-lg bg-indigo-50 px-2 dark:bg-indigo-950' : ''}`}>
                  <span className="font-medium">{s.day} {s.time}</span>
                  <span className="flex-1">{s.topic} {isToday && <span className="chip ml-1">today</span>}</span>
                  {s.link && <a className="underline" href={s.link} target="_blank" rel="noreferrer">Join</a>}
                  <a className="underline" target="_blank" rel="noreferrer" href={googleCalendarUrl(s, course.title)}>Add to Google Calendar</a>
                </li>
              );
            })}
            {(course.schedule ?? []).length === 0 && <li className="text-slate-500">No schedule published.</li>}
          </ul>
        </div>
      )}

      {tab === 'quizzes' && (
        <div className="mt-3">
          {activeQuiz ? <QuizRunner quiz={activeQuiz} courseId={course.id} onDone={() => { setActiveQuiz(null); }} /> : (
            <div className="grid gap-2">
              {quizzes.map((qz) => (
                <div key={qz.id} className="card flex items-center gap-3 p-3">
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{qz.title}</p>
                    <p className="text-xs text-slate-500">Pass {qz.passingScore}% {qz.timeLimitMinutes ? `· ${qz.timeLimitMinutes} min` : ''} {bestFor(qz.id) !== null ? `· Best ${bestFor(qz.id)}%` : ''}</p>
                  </div>
                  <button className="btn-primary" onClick={() => setActiveQuiz(qz)}>Start</button>
                </div>
              ))}
              {quizzes.length === 0 && <EmptyState title="No quizzes yet" />}
            </div>
          )}
        </div>
      )}

      {tab === 'notes' && (
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <div className="card p-3">
            <h3 className="text-sm font-semibold">Note for: {lesson?.title ?? '—'}</h3>
            <textarea className="input mt-2 min-h-[140px]" aria-label="Lesson note"
              value={lesson ? (notes[`${id}_${lesson.id}`] ?? '') : ''}
              onChange={(e) => {
                if (!lesson || !id) return;
                const k = `${id}_${lesson.id}`;
                setNotes((n) => ({ ...n, [k]: e.target.value }));
                clearTimeout((saveNote as any)._t);
                (saveNote as any)._t = setTimeout(() => saveNote(lesson.id, e.target.value), 800);
              }} />
            <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
              <button className="btn-ghost !py-1" onClick={() => {
                if (!lesson || !id) return;
                const k = `${id}_${lesson.id}`;
                const stamp = `[${Math.floor(currentTimeRef.current / 60)}:${String(Math.floor(currentTimeRef.current % 60)).padStart(2, '0')}] `;
                setNotes((n) => ({ ...n, [k]: (n[k] ?? '') + stamp }));
              }}>+ Add timestamp</button>
              <span>Autosaved {savedTick ? new Date(savedTick).toLocaleTimeString() : '—'}</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">Tip: click a [mm:ss] chip to seek the video to that moment.</p>
            {lesson && notes[`${id}_${lesson.id}`] && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {Array.from((notes[`${id}_${lesson.id}`] ?? '').matchAll(/\[(\d+):([0-5]\d)\]/g)).map((m, i) => {
                  const sec = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
                  return (
                    <button key={i} className="chip bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                      onClick={() => { setTab('videos'); setTimeout(() => seekPlayer(sec), 100); }}>
                      {m[0]}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="card p-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">All notes</h3>
              <input className="input !py-1" placeholder="Search notes…" value={allNotesQ} onChange={(e) => setAllNotesQ(e.target.value)} aria-label="Search notes" />
              <button className="btn-ghost !py-1 text-xs" onClick={() => {
                const md = Object.entries(notes).filter(([k, v]) => v.toLowerCase().includes(allNotesQ.toLowerCase()))
                  .map(([k, v]) => `## ${k}\n\n${v}`).join('\n\n');
                const blob = new Blob([`# ${course.title} — notes\n\n${md}`], { type: 'text/markdown' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob); a.download = 'notes.md'; a.click();
              }}>Export .md</button>
            </div>
            <div className="mt-2 max-h-[50vh] space-y-2 overflow-auto text-sm">
              {Object.entries(notes).filter(([k, v]) => v.toLowerCase().includes(allNotesQ.toLowerCase())).map(([k, v]) => (
                <div key={k} className="rounded-lg border border-slate-200 p-2 dark:border-slate-800">
                  <p className="text-xs font-medium text-slate-500">{k}</p>
                  <p className="whitespace-pre-wrap">
                    {v.split(/(\[\d+:[0-5]\d\])/g).map((part, i) => {
                      const m = part.match(/\[(\d+):([0-5]\d)\]/);
                      if (!m) return <span key={i}>{part}</span>;
                      const sec = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
                      return (
                        <button key={i} className="mx-0.5 rounded bg-indigo-100 px-1 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200"
                          onClick={() => { setTab('videos'); setTimeout(() => seekPlayer(sec), 100); }}>
                          {part}
                        </button>
                      );
                    })}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
