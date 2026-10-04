import { useEffect, useMemo, useState } from 'react';
import { collection, doc, getDoc, getDocs, orderBy, query, updateDoc, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useToast } from '../hooks/useToast';
import { streakCount } from './streak';

interface Dossier {
  enrollments: any[];
  attempts: any[];
  notes: any[];
  comments: any[];
  courses: Record<string, any>;
  lessonsByCourse: Record<string, any[]>;
}

const emptyDossier: Dossier = { enrollments: [], attempts: [], notes: [], comments: [], courses: {}, lessonsByCourse: {} };

export function StudentDashboard() {
  const { push } = useToast();
  const [users, setUsers] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [uid, setUid] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [data, setData] = useState<Dossier>(emptyDossier);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!db) return;
    getDocs(collection(db, 'users'))
      .then((s) => setUsers(s.docs.map((d) => ({ uid: d.id, ...(d.data() as any) }))))
      .catch(() => setUsers([]));
  }, []);

  const filtered = users
    .filter((u) => ((u.email ?? '') + (u.name ?? '')).toLowerCase().includes(q.toLowerCase()))
    .slice(0, 30);

  const load = async (id: string) => {
    if (!db) return;
    setUid(id);
    setLoading(true);
    try {
      const [prof, es, at, ns, cs, cm] = await Promise.all([
        getDoc(doc(db, 'users', id)),
        getDocs(collection(db, 'users', id, 'enrollments')),
        getDocs(query(collection(db, 'users', id, 'quizAttempts'), orderBy('createdAt', 'desc'))),
        getDocs(collection(db, 'users', id, 'notes')),
        getDocs(collection(db, 'courses')),
        getDocs(query(collection(db, 'comments'), where('uid', '==', id)))
      ]);
      const courses: Record<string, any> = {};
      cs.docs.forEach((d) => { courses[d.id] = { id: d.id, ...(d.data() as any) }; });
      const lessonsByCourse: Record<string, any[]> = {};
      for (const e of es.docs) {
        try {
          const ls = await getDocs(collection(db, 'courses', e.id, 'lessons'));
          lessonsByCourse[e.id] = ls.docs
            .map((d) => ({ id: d.id, ...(d.data() as any) }))
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        } catch {
          lessonsByCourse[e.id] = [];
        }
      }
      setProfile({ uid: id, ...(prof.data() as any) });
      setData({
        enrollments: es.docs.map((d) => ({ id: d.id, ...(d.data() as any) })),
        attempts: at.docs.map((d) => ({ id: d.id, ...(d.data() as any) })),
        notes: ns.docs.map((d) => ({ id: d.id, ...(d.data() as any) })),
        comments: cm.docs.map((d) => ({ id: d.id, ...(d.data() as any) })),
        courses,
        lessonsByCourse
      });
    } catch (e: any) {
      push('Failed to load dossier: ' + (e?.message ?? e));
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    const lessonsDone = data.enrollments.reduce((s, e) => s + ((e.completedLessons ?? []).length), 0);
    const passed = data.attempts.filter((a) => a.passed).length;
    const avg = data.attempts.length
      ? Math.round(data.attempts.reduce((s, a) => s + (a.score ?? 0), 0) / data.attempts.length)
      : 0;
    return { lessonsDone, passed, avg, streak: streakCount(profile?.streakDays ?? []) };
  }, [data, profile]);

  const lessonTitle = (courseId: string, lessonId: string) =>
    data.lessonsByCourse[courseId]?.find((l) => l.id === lessonId)?.title ?? lessonId;

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ profile, ...data }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `student-${profile?.email ?? uid}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="grid gap-3 lg:grid-cols-[280px_minmax(0,1fr)]">
      <div className="card max-h-[70vh] overflow-auto p-2">
        <input className="input mb-2" placeholder="Search students…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search students" />
        {filtered.map((u) => (
          <button
            key={u.uid}
            onClick={() => load(u.uid)}
            className={`block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800 ${uid === u.uid ? 'bg-indigo-50 dark:bg-indigo-950' : ''}`}
          >
            <span className="block truncate font-medium">{u.name || u.email}</span>
            <span className="block truncate text-xs text-slate-500">{u.email} · {u.status ?? 'active'}</span>
          </button>
        ))}
        {filtered.length === 0 && <p className="p-3 text-sm text-slate-500">No students found.</p>}
      </div>

      <div className="min-w-0">
        {!uid ? (
          <div className="card p-8 text-center text-sm text-slate-500">Pick a student to open their full dossier.</div>
        ) : loading ? (
          <div className="card p-6"><div className="skeleton h-40 w-full" /></div>
        ) : (
          <div className="space-y-3">
            <div className="card p-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-lg font-bold text-white">
                  {((profile?.name ?? profile?.email ?? '?') as string).charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-bold">{profile?.name || profile?.email}</h2>
                  <p className="truncate text-xs text-slate-500">{profile?.email}</p>
                </div>
                <span className={`chip ${profile?.status === 'disabled' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                  {profile?.status ?? 'active'}
                </span>
                {profile?.commenting === 'off' && <span className="chip bg-amber-100 text-amber-800">muted</span>}
                <button className="btn-ghost !py-1 text-xs" onClick={exportJson}>Export JSON</button>
                <button
                  className="btn-ghost !py-1 text-xs"
                  onClick={async () => {
                    if (!db || !confirm(`${profile?.status === 'disabled' ? 'Enable' : 'Disable'} this account?`)) return;
                    await updateDoc(doc(db, 'users', uid), { status: profile?.status === 'disabled' ? 'active' : 'disabled' });
                    load(uid);
                  }}
                >
                  {profile?.status === 'disabled' ? 'Enable' : 'Disable'}
                </button>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3 lg:grid-cols-6">
                <Stat label="Enrolled" value={data.enrollments.length} />
                <Stat label="Lessons done" value={stats.lessonsDone} />
                <Stat label="Quizzes passed" value={`${stats.passed}/${data.attempts.length}`} />
                <Stat label="Avg score" value={data.attempts.length ? `${stats.avg}%` : '—'} />
                <Stat label="Notes" value={data.notes.length} />
                <Stat label="Streak" value={stats.streak ? `${stats.streak}d 🔥` : '—'} />
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Joined {profile?.createdAt?.toDate?.()?.toLocaleDateString?.() ?? '—'} ·
                Last active {profile?.lastActiveAt?.toDate?.()?.toLocaleString?.() ?? '—'}
                {profile?.badges?.length ? ` · Badges: ${profile.badges.join(', ')}` : ''}
              </p>
            </div>

            <details className="card p-4" open>
              <summary className="cursor-pointer text-sm font-bold">Courses enrolled ({data.enrollments.length})</summary>
              <div className="mt-2 space-y-3">
                {data.enrollments.map((e) => {
                  const c = data.courses[e.id];
                  const lessons = data.lessonsByCourse[e.id] ?? [];
                  const done: string[] = e.completedLessons ?? [];
                  const pct = lessons.length ? Math.round((done.length / lessons.length) * 100) : (e.progressPercent ?? 0);
                  return (
                    <div key={e.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        <p className="flex-1 truncate text-sm font-semibold">{c?.title ?? e.id}</p>
                        <span className="text-xs font-bold text-indigo-600">{pct}%</span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                        <div className="h-full bg-indigo-600" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {done.length}/{lessons.length || '?'} lessons ·
                        enrolled {e.enrolledAt?.toDate?.()?.toLocaleDateString?.() ?? '—'} ·
                        last active {e.lastActiveAt?.toDate?.()?.toLocaleDateString?.() ?? '—'}
                        {e.lastLessonId ? ` · resume: ${lessonTitle(e.id, e.lastLessonId)}${e.lastTime ? ` @ ${Math.floor(e.lastTime / 60)}:${String(Math.floor(e.lastTime % 60)).padStart(2, '0')}` : ''}` : ''}
                      </p>
                      {lessons.length > 0 && (
                        <details className="mt-1.5">
                          <summary className="cursor-pointer text-xs text-indigo-600">Watched videos ({done.length})</summary>
                          <ul className="mt-1 space-y-0.5 text-xs">
                            {lessons.map((l) => (
                              <li key={l.id} className={done.includes(l.id) ? 'text-green-700' : 'text-slate-400'}>
                                {done.includes(l.id) ? '✓' : '○'} {l.title}
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </div>
                  );
                })}
                {data.enrollments.length === 0 && <p className="text-sm text-slate-500">Not enrolled in anything.</p>}
              </div>
            </details>

            <details className="card p-4">
              <summary className="cursor-pointer text-sm font-bold">Quiz attempts ({data.attempts.length})</summary>
              <ul className="mt-2 divide-y divide-slate-100 text-sm dark:divide-slate-800">
                {data.attempts.map((a) => (
                  <li key={a.id} className="flex items-center gap-2 py-1.5">
                    <span className={`grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold text-white ${a.passed ? 'bg-emerald-500' : 'bg-slate-400'}`}>{a.score}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{a.quizTitle ?? a.quizId}</span>
                      <span className="block truncate text-xs text-slate-500">{a.courseTitle ?? data.courses[a.courseId]?.title ?? a.courseId} · {a.createdAt?.toDate?.()?.toLocaleString?.() ?? ''}</span>
                    </span>
                    <span className="text-xs text-slate-500">{a.passed ? 'Passed' : 'Failed'}</span>
                  </li>
                ))}
                {data.attempts.length === 0 && <li className="py-2 text-slate-500">No quiz submissions.</li>}
              </ul>
            </details>

            <details className="card p-4">
              <summary className="cursor-pointer text-sm font-bold">Notes ({data.notes.length})</summary>
              <ul className="mt-2 space-y-2 text-sm">
                {data.notes.map((n) => {
                  const [ccid, ...rest] = String(n.id).split('_');
                  return (
                    <li key={n.id} className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800/60">
                      <p className="text-xs font-medium text-slate-500">
                        {data.courses[ccid]?.title ?? ccid} › {lessonTitle(ccid, rest.join('_'))}
                      </p>
                      <p className="mt-0.5 whitespace-pre-wrap">{String(n.content ?? '').slice(0, 300)}</p>
                    </li>
                  );
                })}
                {data.notes.length === 0 && <li className="text-slate-500">No notes written.</li>}
              </ul>
            </details>

            <details className="card p-4">
              <summary className="cursor-pointer text-sm font-bold">Discussions ({data.comments.length})</summary>
              <ul className="mt-2 space-y-2 text-sm">
                {data.comments.map((c) => (
                  <li key={c.id} className="rounded-lg border border-slate-200 p-2 dark:border-slate-800">
                    <p className="whitespace-pre-wrap">{c.text}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {c.courseId}/{c.lessonId} · {c.createdAt?.toDate?.()?.toLocaleString?.() ?? ''}
                      {c.reported ? ' · ⚑ reported' : ''}{c.hidden ? ' · hidden' : ''}
                    </p>
                  </li>
                ))}
                {data.comments.length === 0 && <li className="text-slate-500">Never posted in discussions.</li>}
              </ul>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-slate-50 p-2.5 text-center dark:bg-slate-800/60">
      <p className="text-base font-extrabold">{value}</p>
      <p className="text-[11px] text-slate-500">{label}</p>
    </div>
  );
}
