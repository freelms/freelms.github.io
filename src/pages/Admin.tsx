import { useEffect, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useToast } from '../hooks/useToast';
import type { Course, Lesson, Quiz } from '../types';
import { extractVideoId, thumbFor, checkVideoEmbeddable } from '../lib/youtube';
import { validateQuizJson } from '../components/Quiz';
import { SAMPLE_QUIZ_JSON, SAMPLE_COURSE_JSON, QUIZ_AI_PROMPT, COURSE_AI_PROMPT } from '../lib/samples';

import { ModerationTab } from '../components/Comments';

type Tab = 'courses' | 'lessons' | 'quizzes' | 'analytics' | 'students' | 'announce' | 'reports' | 'moderation' | 'paths' | 'import';

const emptyCourse: Partial<Course> = {
  title: '', description: '', topic: '', instructor: '', thumbnail: '', status: 'draft',
  level: 'Beginner', outcomes: [], credits: [], schedule: [], prerequisiteIds: []
};

export default function Admin() {
  const [tab, setTab] = useState<Tab>('courses');
  const tabs: Tab[] = ['courses', 'lessons', 'quizzes', 'analytics', 'students', 'announce', 'reports', 'moderation', 'paths', 'import'];
  return (
    <div className="mx-auto max-w-6xl px-3 py-4">
      <h1 className="font-bold">Admin</h1>
      <div className="mt-2 flex gap-1.5 overflow-x-auto" role="tablist">
        {tabs.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`chip !px-3 !py-1.5 capitalize ${tab === t ? '!bg-indigo-600 !text-white' : ''}`}>{t}</button>
        ))}
      </div>
      <div className="mt-3">
        {tab === 'courses' && <CoursesTab />}
        {tab === 'lessons' && <LessonsTab />}
        {tab === 'quizzes' && <QuizzesTab />}
        {tab === 'analytics' && <AnalyticsTab />}
        {tab === 'students' && <StudentsTab />}
        {tab === 'announce' && <AnnounceTab />}
        {tab === 'reports' && <ReportsTab />}
        {tab === 'moderation' && <ModerationTab />}
        {tab === 'paths' && <PathsTab />}
        {tab === 'import' && <ImportTab />}
      </div>
    </div>
  );
}

function useCourses() {
  const [courses, setCourses] = useState<Course[]>([]);
  const reload = async () => {
    if (!db) return;
    const s = await getDocs(collection(db, 'courses'));
    setCourses(s.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Course[]);
  };
  useEffect(() => { reload(); }, []);
  return { courses, reload };
}

function CoursesTab() {
  const { courses, reload } = useCourses();
  const { push } = useToast();
  const [form, setForm] = useState<Partial<Course>>({ ...emptyCourse });
  const [editing, setEditing] = useState<string | null>(null);
  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!db || !form.title) { push('Title required'); return; }
    const payload = {
      ...form,
      outcomes: Array.isArray(form.outcomes) ? form.outcomes : String(form.outcomes ?? '').split('\n').filter(Boolean),
      updatedAt: serverTimestamp()
    };
    if (editing) await updateDoc(doc(db, 'courses', editing), payload as any);
    else await addDoc(collection(db, 'courses'), { ...payload, createdAt: serverTimestamp(), lessonCount: 0 });
    setForm({ ...emptyCourse }); setEditing(null); reload(); push('Saved');
  };

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <div className="card p-4 text-sm">
        <h2 className="font-semibold">{editing ? 'Edit course' : 'New course'}</h2>
        <div className="mt-2 grid gap-2">
          <input className="input" placeholder="Title" value={form.title ?? ''} onChange={(e) => set('title', e.target.value)} />
          <textarea className="input" placeholder="Description" value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <input className="input" placeholder="Topic" value={form.topic ?? ''} onChange={(e) => set('topic', e.target.value)} />
            <input className="input" placeholder="Instructor" value={form.instructor ?? ''} onChange={(e) => set('instructor', e.target.value)} />
          </div>
          <input className="input" placeholder="Thumbnail URL" value={form.thumbnail ?? ''} onChange={(e) => set('thumbnail', e.target.value)} />
          <div className="grid grid-cols-3 gap-2">
            <select className="input" value={form.status} onChange={(e) => set('status', e.target.value)} aria-label="Status">
              <option value="draft">draft</option><option value="published">published</option><option value="archived">archived</option>
            </select>
            <select className="input" value={form.level} onChange={(e) => set('level', e.target.value)} aria-label="Level">
              <option>Beginner</option><option>Intermediate</option><option>Advanced</option>
            </select>
            <input className="input" placeholder="Timezone" value={(form as any).timezone ?? ''} onChange={(e) => set('timezone', e.target.value)} />
          </div>
          <textarea className="input" placeholder="Learning outcomes (one per line)" value={Array.isArray(form.outcomes) ? form.outcomes.join('\n') : (form.outcomes as any ?? '')} onChange={(e) => set('outcomes', e.target.value.split('\n'))} />
          <textarea className="input" placeholder="Prerequisite course IDs (comma separated)" value={(form.prerequisiteIds ?? []).join(',')} onChange={(e) => set('prerequisiteIds', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))} />
          <textarea className="input" placeholder="Credits JSON: [{creator, channelUrl, videoUrl}]" value={JSON.stringify(form.credits ?? [])} onChange={(e) => { try { set('credits', JSON.parse(e.target.value)); } catch { /* ignore */ } }} />
          <textarea className="input" placeholder="Schedule JSON: [{day, time, topic, link}]" value={JSON.stringify(form.schedule ?? [])} onChange={(e) => { try { set('schedule', JSON.parse(e.target.value)); } catch { /* ignore */ } }} />
          <div className="flex gap-2">
            <button className="btn-primary" onClick={save}>Save</button>
            {editing && <button className="btn-ghost" onClick={() => { setEditing(null); setForm({ ...emptyCourse }); }}>Cancel</button>}
          </div>
        </div>
      </div>
      <div className="space-y-2">
        {courses.map((c) => (
          <div key={c.id} className="card flex items-center gap-2 p-3 text-sm">
            <div className="flex-1"><p className="font-medium">{c.title}</p><p className="text-xs text-slate-500">{c.status} · {c.topic} · {c.id}</p></div>
            <button className="btn-ghost !py-1 text-xs" onClick={() => { setEditing(c.id); setForm({ ...c }); }}>Edit</button>
            <a className="btn-ghost !py-1 text-xs" href={`#/course/${c.id}`} target="_blank" rel="noreferrer">Preview as student</a>
            <button className="btn-ghost !py-1 text-xs" onClick={async () => {
              if (!db || !confirm(`Duplicate ${c.title} with lessons + quizzes?`)) return;
              const copy = { ...c, title: c.title + ' (copy)', status: 'draft' as const };
              delete (copy as any).id;
              const ref = await addDoc(collection(db, 'courses'), { ...copy, createdAt: serverTimestamp() });
              const ls = await getDocs(collection(db, 'courses', c.id, 'lessons'));
              for (const d of ls.docs) await addDoc(collection(db, 'courses', ref.id, 'lessons'), d.data());
              const qs = await getDocs(collection(db, 'courses', c.id, 'quizzes'));
              for (const d of qs.docs) await addDoc(collection(db, 'courses', ref.id, 'quizzes'), d.data());
              push(`Duplicated with ${ls.size} lessons, ${qs.size} quizzes`);
              reload();
            }}>Duplicate</button>
            <button className="btn-ghost !py-1 text-xs !text-red-600" onClick={async () => {
              if (!db || !confirm('Delete course?')) return;
              await deleteDoc(doc(db, 'courses', c.id)); reload();
            }}>Delete</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function LessonsTab() {
  const { courses } = useCourses();
  const { push } = useToast();
  const [cid, setCid] = useState('');
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [bulk, setBulk] = useState('');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [creator, setCreator] = useState('');
  const [channelUrl, setChannelUrl] = useState('');
  const [resources, setResources] = useState('[]');
  const vid = extractVideoId(url);

  const reload = async () => {
    if (!db || !cid) return;
    const s = await getDocs(collection(db, 'courses', cid, 'lessons'));
    setLessons((s.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Lesson[]).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
  };
  useEffect(() => { reload(); }, [cid]);

  const addOne = async (yt: string, t: string) => {
    const videoId = extractVideoId(yt);
    if (!videoId || !db || !cid) { push(`Bad URL: ${yt}`); return; }
    let res: any[] = [];
    try { res = JSON.parse(resources || '[]'); } catch { res = []; }
    await addDoc(collection(db, 'courses', cid, 'lessons'), {
      title: t || videoId, videoId, order: lessons.length,
      videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
      creator: creator || '', channelUrl: channelUrl || '', resources: res,
      createdAt: serverTimestamp()
    });
    // denormalized counter (E16)
    try { await updateDoc(doc(db, 'courses', cid), { lessonCount: lessons.length + 1, updatedAt: serverTimestamp() }); } catch { /* ignore */ }
  };

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <div className="card space-y-2 p-4 text-sm">
        <select className="input" value={cid} onChange={(e) => setCid(e.target.value)} aria-label="Course">
          <option value="">Pick a course…</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
        <input className="input" placeholder="Lesson title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input className="input" placeholder="YouTube URL or ID" value={url} onChange={(e) => setUrl(e.target.value)} />
        {vid && <img src={thumbFor(vid)} alt="preview" className="h-24 rounded-lg object-cover" />}
        <div className="grid grid-cols-2 gap-2">
          <input className="input" placeholder="Creator name (source credit)" value={creator} onChange={(e) => setCreator(e.target.value)} />
          <input className="input" placeholder="Channel URL" value={channelUrl} onChange={(e) => setChannelUrl(e.target.value)} />
        </div>
        <textarea className="input font-mono text-xs" placeholder='Resources JSON: [{"label":"Slides","url":"https://…","type":"PDF"}]' value={resources} onChange={(e) => setResources(e.target.value)} />
        <button className="btn-primary" disabled={!cid || !vid} onClick={async () => { await addOne(url, title); setTitle(''); setUrl(''); reload(); }}>Add lesson</button>
        <textarea className="input min-h-[90px]" placeholder="Bulk: one YouTube URL per line" value={bulk} onChange={(e) => setBulk(e.target.value)} />
        <button className="btn-ghost" disabled={!cid || !bulk.trim()} onClick={async () => {
          for (const line of bulk.split('\n').map((s) => s.trim()).filter(Boolean)) await addOne(line, line);
          setBulk(''); reload(); push('Bulk added');
        }}>Add all URLs</button>
        <button className="btn-ghost" disabled={!cid} onClick={async () => {
          if (!db) return;
          for (const l of lessons) {
            const ok = await checkVideoEmbeddable(l.videoId);
            await updateDoc(doc(db, 'courses', cid, 'lessons', l.id), { broken: !ok, lastChecked: serverTimestamp() });
          }
          reload(); push('Video check done');
        }}>Check videos (oEmbed)</button>
      </div>
      <div className="space-y-2">
        {lessons.map((l, i) => (
          <div key={l.id} className="card flex items-center gap-2 p-2 text-sm">
            <img src={thumbFor(l.videoId)} alt="" className="h-10 w-16 rounded object-cover" />
            <span className="flex-1 truncate">{l.title} {l.broken && <span className="chip bg-red-100 text-red-700">broken</span>} {(l as any).lastChecked && <span className="text-[10px] text-slate-400">checked {(l as any).lastChecked?.toDate?.()?.toLocaleDateString?.() ?? ''}</span>}</span>
            <button aria-label="Move up" disabled={i === 0} onClick={async () => {
              if (!db) return;
              await updateDoc(doc(db, 'courses', cid, 'lessons', l.id), { order: (l.order ?? i) - 1 });
              await updateDoc(doc(db, 'courses', cid, 'lessons', lessons[i - 1].id), { order: i }); reload();
            }}>↑</button>
            <button aria-label="Move down" disabled={i === lessons.length - 1} onClick={async () => {
              if (!db) return;
              await updateDoc(doc(db, 'courses', cid, 'lessons', l.id), { order: (l.order ?? i) + 1 });
              await updateDoc(doc(db, 'courses', cid, 'lessons', lessons[i + 1].id), { order: i }); reload();
            }}>↓</button>
            <button className="text-red-600" onClick={async () => {
              if (db && confirm('Delete?')) {
                await deleteDoc(doc(db, 'courses', cid, 'lessons', l.id));
                try { await updateDoc(doc(db, 'courses', cid), { lessonCount: Math.max(0, lessons.length - 1) }); } catch { /* ignore */ }
                reload();
              }
            }}>Delete</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function QuizzesTab() {
  const { courses } = useCourses();
  const { push } = useToast();
  const [cid, setCid] = useState('');
  const [raw, setRaw] = useState(SAMPLE_QUIZ_JSON);
  const [errs, setErrs] = useState<string[]>([]);
  const [list, setList] = useState<Quiz[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [lessonId, setLessonId] = useState('');
  const reload = async () => {
    if (!db || !cid) return;
    const s = await getDocs(collection(db, 'courses', cid, 'quizzes'));
    setList(s.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Quiz[]);
    const ls = await getDocs(collection(db, 'courses', cid, 'lessons'));
    setLessons(ls.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Lesson[]);
  };
  useEffect(() => { reload(); }, [cid]);
  const v = (() => { try { return validateQuizJson(raw); } catch { return { ok: false, errors: ['Invalid'] }; } })();
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <div className="card space-y-2 p-4 text-sm">
        <select className="input" value={cid} onChange={(e) => setCid(e.target.value)} aria-label="Course">
          <option value="">Pick a course…</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost !py-1 text-xs" onClick={() => { const b = document.createElement('a'); b.href = URL.createObjectURL(new Blob([SAMPLE_QUIZ_JSON])); b.download = 'quiz-sample.json'; b.click(); }}>Download sample JSON</button>
          <button className="btn-ghost !py-1 text-xs" onClick={() => navigator.clipboard.writeText(QUIZ_AI_PROMPT)}>Copy AI prompt</button>
          <label className="btn-ghost !py-1 text-xs cursor-pointer">Upload .json<input type="file" className="hidden" accept=".json" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setRaw(await f.text()); }} /></label>
        </div>
        <textarea className="input min-h-[220px] font-mono text-xs" value={raw} onChange={(e) => setRaw(e.target.value)} aria-label="Quiz JSON" />
        <select className="input" value={lessonId} onChange={(e) => setLessonId(e.target.value)} aria-label="Attach to lesson (optional)">
          <option value="">Full-course quiz (no lesson)</option>
          {lessons.map((l) => <option key={l.id} value={l.id}>Quick check: {l.title}</option>)}
        </select>
        {!v.ok && <ul className="text-xs text-red-600">{v.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>}
        {v.ok && <p className="text-xs text-green-700">Valid ✓ {(v as any).quiz?.questions?.length} questions {lessonId && '(quick check)'}</p>}
        <button className="btn-primary" disabled={!cid || !v.ok} onClick={async () => {
          if (!db || !v.ok || !(v as any).quiz) return;
          await addDoc(collection(db, 'courses', cid, 'quizzes'), { ...(v as any).quiz, lessonId: lessonId || undefined, createdAt: serverTimestamp() });
          push('Quiz saved'); reload();
        }}>Save quiz</button>
      </div>
      <div className="space-y-2">
        {list.map((qz) => (
          <div key={qz.id} className="card p-3 text-sm">
            <p className="font-medium">{qz.title} ({qz.questions.length} Qs){qz.lessonId && <span className="chip ml-2">quick check</span>}</p>
            <button className="mt-1 text-xs text-red-600" onClick={async () => { if (db && confirm('Delete?')) { await deleteDoc(doc(db, 'courses', cid, 'quizzes', qz.id)); reload(); } }}>Delete</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function AnalyticsTab() {
  const [stats, setStats] = useState<any[]>([]);
  const [hardest, setHardest] = useState<any[]>([]);
  const [avgMap, setAvgMap] = useState<Record<string, number>>({});
  const [daily, setDaily] = useState<any[]>([]);
  useEffect(() => {
    if (!db) return;
    (async () => {
      const cs = await getDocs(collection(db, 'courses'));
      const out = [];
      const hard: any[] = [];
      try {
        // avg quiz score per quiz + enrollments last 30 days (admin collectionGroup reads)
        const { collectionGroup, getDocs: g, query: qq, orderBy, limit: lim, where: ww } = await import('firebase/firestore');
        try {
          const at = await g(qq(collectionGroup(db, 'quizAttempts'), lim(500)));
          const sums: Record<string, { t: number; n: number }> = {};
          at.docs.forEach((d) => {
            const a = d.data() as any;
            const k = `${a.courseId}/${a.quizId}`;
            sums[k] = sums[k] ?? { t: 0, n: 0 };
            sums[k].t += a.score ?? 0; sums[k].n += 1;
          });
          const m: Record<string, number> = {};
          Object.entries(sums).forEach(([k, v]) => { m[k] = Math.round(v.t / Math.max(1, v.n)); });
          setAvgMap(m);
        } catch { /* ignore */ }
        try {
          const es = await g(qq(collectionGroup(db, 'enrollments'), orderBy('enrolledAt', 'desc'), lim(500)));
          const buckets: Record<string, number> = {};
          for (let i = 29; i >= 0; i--) {
            const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
            buckets[d] = 0;
          }
          es.docs.forEach((d) => {
            const ts = (d.data() as any)?.enrolledAt?.toDate?.();
            if (!ts) return;
            const k = ts.toISOString().slice(0, 10);
            if (k in buckets) buckets[k] += 1;
          });
          setDaily(Object.entries(buckets).map(([day, n]) => ({ day: day.slice(5), n })));
        } catch { /* ignore */ }
      } catch { /* ignore */ }
      let totalStudents = 0;
      try {
        const us = await getDocs(collection(db, 'users'));
        totalStudents = us.size;
      } catch { /* ignore */ }
      for (const c of cs.docs) {
        const cdata = c.data() as any;
        let en = 0, comp = 0;
        try {
          const s = await getDoc(doc(db, 'stats', c.id));
          en = (s.data() as any)?.enrollmentCount ?? 0;
          comp = (s.data() as any)?.completionCount ?? 0;
        } catch { /* ignore */ }
        // avg quiz score: sample quizAttempts across users is expensive; approximate via per-course quizzes' wrongCounts
        let avg = 0, quizCount = 0;
        try {
          const qs = await getDocs(collection(db, 'courses', c.id, 'quizzes'));
          quizCount = qs.size;
          qs.docs.forEach((q) => {
            const qd = q.data() as any;
            const wc: number[] = qd.wrongCounts ?? [];
            const total = wc.reduce((a, b) => a + (b ?? 0), 0);
            (qd.questions ?? []).forEach((qq: any, i: number) => {
              if ((wc[i] ?? 0) > 0) hard.push({ course: cdata.title, quiz: qd.title, q: qq.question, wrong: wc[i] });
            });
            void total;
          });
        } catch { /* ignore */ }
        out.push({ id: c.id, title: cdata.title, en, comp, rate: en ? Math.round((comp / en) * 100) : 0, avg, quizCount });
      }
      hard.sort((a, b) => b.wrong - a.wrong);
      setStats(out);
      setHardest(hard.slice(0, 10));
    })();
  }, []);
  const totalEn = stats.reduce((a, s) => a + s.en, 0);
  return (
    <div className="space-y-3 text-sm">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <div className="card p-3"><p className="text-xs text-slate-500">Total enrollments</p><p className="text-xl font-bold">{totalEn}</p></div>
        <div className="card p-3"><p className="text-xs text-slate-500">Courses</p><p className="text-xl font-bold">{stats.length}</p></div>
        <div className="card p-3"><p className="text-xs text-slate-500">Avg completion</p><p className="text-xl font-bold">{stats.length ? Math.round(stats.reduce((a, s) => a + s.rate, 0) / stats.length) : 0}%</p></div>
        <div className="card p-3"><p className="text-xs text-slate-500">Completions</p><p className="text-xl font-bold">{stats.reduce((a, s) => a + s.comp, 0)}</p></div>
      </div>
      <div className="card p-4">
        <h2 className="font-semibold">Enrollments per course</h2>
        <EnrollmentChart data={stats} />
        <table className="mt-2 w-full text-left text-sm">
          <thead><tr className="text-xs text-slate-500"><th>Course</th><th>Enrolled</th><th>Completed</th><th>Rate</th></tr></thead>
          <tbody>{stats.map((s) => <tr key={s.id} className="border-t border-slate-100 dark:border-slate-800"><td>{s.title}</td><td>{s.en}</td><td>{s.comp}</td><td>{s.rate}%</td></tr>)}</tbody>
        </table>
      </div>
      <div className="card p-4">
        <h2 className="font-semibold">Enrollments — last 30 days</h2>
        <DailyChart data={daily} />
      </div>
      <div className="card p-4">
        <h2 className="font-semibold">Average quiz score per quiz</h2>
        {Object.keys(avgMap).length === 0 ? <p className="text-xs text-slate-500">No attempts yet.</p> : (
          <table className="mt-2 w-full text-left text-sm">
            <thead><tr className="text-xs text-slate-500"><th>Course/Quiz</th><th>Avg %</th></tr></thead>
            <tbody>{Object.entries(avgMap).map(([k, v]) => <tr key={k} className="border-t border-slate-100 dark:border-slate-800"><td>{k}</td><td>{v}%</td></tr>)}</tbody>
          </table>
        )}
      </div>
      <div className="card p-4">
        <h2 className="font-semibold">Hardest questions (most wrong answers)</h2>
        {hardest.length === 0 ? <p className="text-xs text-slate-500">No data yet — wrong-answer counts accumulate on quiz submit.</p> : (
          <table className="mt-2 w-full text-left text-sm">
            <thead><tr className="text-xs text-slate-500"><th>Course</th><th>Quiz</th><th>Question</th><th>Wrong</th></tr></thead>
            <tbody>{hardest.map((h, i) => <tr key={i} className="border-t border-slate-100 dark:border-slate-800"><td>{h.course}</td><td>{h.quiz}</td><td>{h.q}</td><td>{h.wrong}</td></tr>)}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function EnrollmentChart({ data }: { data: any[] }) {
  const [Comp, setComp] = useState<any>(null);
  useEffect(() => {
    import('recharts').then((m) => setComp(() => (props: any) => (
      <m.ResponsiveContainer width="100%" height={200}>
        <m.BarChart data={props.data}>
          <m.XAxis dataKey="title" hide />
          <m.YAxis allowDecimals={false} />
          <m.Tooltip />
          <m.Bar dataKey="en" fill="#4f46e5" />
        </m.BarChart>
      </m.ResponsiveContainer>
    )));
  }, []);
  if (!Comp) return <div className="skeleton h-[200px] w-full" />;
  return <Comp data={data} />;
}

function DailyChart({ data }: { data: any[] }) {
  const [Comp, setComp] = useState<any>(null);
  useEffect(() => {
    import('recharts').then((m) => setComp(() => (props: any) => (
      <m.ResponsiveContainer width="100%" height={180}>
        <m.LineChart data={props.data}>
          <m.XAxis dataKey="day" interval={4} tick={{ fontSize: 10 }} />
          <m.YAxis allowDecimals={false} />
          <m.Tooltip />
          <m.Line type="monotone" dataKey="n" stroke="#4f46e5" strokeWidth={2} dot={false} />
        </m.LineChart>
      </m.ResponsiveContainer>
    )));
  }, []);
  if (!Comp) return <div className="skeleton h-[180px] w-full" />;
  return <Comp data={data} />;
}

function StudentsTab() {
  const [users, setUsers] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const [progress, setProgress] = useState<Record<string, { n: number; pct: number; last: string }>>({});
  useEffect(() => {
    if (!db) return;
    (async () => {
      const s = await getDocs(collection(db, 'users'));
      setUsers(s.docs.map((d) => ({ uid: d.id, ...(d.data() as any) })));
    })();
  }, []);
  const filtered = users.filter((u) => ((u.email ?? '') + (u.name ?? '')).toLowerCase().includes(q.toLowerCase()));
  const pageItems = filtered.slice(page * 20, page * 20 + 20);
  useEffect(() => {
    if (!db) return;
    (async () => {
      const m: Record<string, { n: number; pct: number; last: string }> = {};
      for (const u of pageItems) {
        try {
          const es = await getDocs(collection(db, 'users', u.uid, 'enrollments'));
          const n = es.size;
          const pct = n ? Math.round(es.docs.reduce((a, d) => a + ((d.data() as any).progressPercent ?? 0), 0) / n) : 0;
          m[u.uid] = { n, pct, last: (u.lastActiveAt?.toDate?.()?.toLocaleDateString?.() ?? '') as string };
        } catch { m[u.uid] = { n: 0, pct: 0, last: '' }; }
      }
      setProgress(m);
    })();
  }, [page, users.length]);
  return (
    <div className="card p-4 text-sm">
      <input className="input max-w-xs" placeholder="Search users…" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} aria-label="Search users" />
      <div className="mt-2 space-y-1">
        {pageItems.map((u) => (
          <div key={u.uid} className="flex items-center gap-2 border-t border-slate-100 py-1.5 dark:border-slate-800">
            <span className="flex-1">{u.name || u.email} <span className="text-xs text-slate-500">{u.email} · {u.status ?? 'active'} · {progress[u.uid]?.n ?? 0} courses · {progress[u.uid]?.pct ?? 0}% · last {progress[u.uid]?.last ?? '—'}</span></span>
            <button className="btn-ghost !py-1 text-xs" onClick={async () => { if (db) { await updateDoc(doc(db, 'users', u.uid), { status: u.status === 'disabled' ? 'active' : 'disabled' }); location.reload(); } }}>Toggle disable</button>
            <button className="btn-ghost !py-1 text-xs" onClick={async () => { if (db) { await updateDoc(doc(db, 'users', u.uid), { commenting: u.commenting === 'off' ? 'on' : 'off' }); location.reload(); } }}>{u.commenting === 'off' ? 'Enable comments' : 'Disable comments'}</button>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs">
        <button className="btn-ghost !py-1" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>← Prev</button>
        <span>Page {page + 1} / {Math.max(1, Math.ceil(filtered.length / 20))}</span>
        <button className="btn-ghost !py-1" disabled={(page + 1) * 20 >= filtered.length} onClick={() => setPage((p) => p + 1)}>Next →</button>
      </div>
    </div>
  );
}

function AnnounceTab() {
  const [msg, setMsg] = useState('');
  const [courseId, setCourseId] = useState('');
  const [days, setDays] = useState('7');
  const [list, setList] = useState<any[]>([]);
  const { push } = useToast();
  const reload = async () => {
    if (!db) return;
    const s = await getDocs(collection(db, 'announcements'));
    setList(s.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
  };
  useEffect(() => { reload(); }, []);
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <form className="card grid max-w-lg gap-2 p-4 text-sm" onSubmit={async (e) => {
        e.preventDefault();
        if (!db || !msg.trim()) return;
        const expiresAt = days ? new Date(Date.now() + Number(days) * 864e5) : null;
        await addDoc(collection(db, 'announcements'), { message: msg, courseId: courseId || null, expiresAt, createdAt: serverTimestamp() });
        setMsg(''); push('Announced'); reload();
      }}>
        <input className="input" placeholder="Message" value={msg} onChange={(e) => setMsg(e.target.value)} />
        <input className="input" placeholder="Course ID (optional, blank = global)" value={courseId} onChange={(e) => setCourseId(e.target.value)} />
        <label className="text-xs">Expires in days (blank = never): <input className="input" value={days} onChange={(e) => setDays(e.target.value)} placeholder="7" /></label>
        <button className="btn-primary">Publish announcement</button>
      </form>
      <div className="space-y-2 text-sm">
        {list.map((a) => (
          <div key={a.id} className="card p-3">
            <p>{a.message}</p>
            <p className="text-xs text-slate-500">{a.courseId ?? 'global'} · expires {a.expiresAt?.toDate?.()?.toLocaleDateString?.() ?? 'never'}</p>
            <button className="mt-1 text-xs text-red-600" onClick={async () => { if (db && confirm('Delete?')) { await deleteDoc(doc(db, 'announcements', a.id)); reload(); } }}>Delete</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReportsTab() {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    if (!db) return;
    (async () => {
      const s = await getDocs(collection(db, 'reports'));
      setItems(s.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    })();
  }, []);
  return (
    <div className="space-y-2">
      {items.map((r) => (
        <div key={r.id} className="card p-3 text-sm">
          <p className="font-medium">{r.reason} {r.resolved && <span className="chip">resolved</span>}</p>
          <p>{r.details}</p><p className="text-xs text-slate-500">{r.email} · {r.courseId} {r.lessonId}</p>
          <button className="btn-ghost mt-1 !py-1 text-xs" onClick={async () => { if (db) { await updateDoc(doc(db, 'reports', r.id), { resolved: !r.resolved }); location.reload(); } }}>Toggle resolved</button>
        </div>
      ))}
      {items.length === 0 && <p className="text-sm text-slate-500">No reports.</p>}
    </div>
  );
}

function PathsTab() {
  const [title, setTitle] = useState('');
  const [ids, setIds] = useState('');
  const { push } = useToast();
  return (
    <form className="card grid max-w-lg gap-2 p-4 text-sm" onSubmit={async (e) => {
      e.preventDefault();
      if (!db) return;
      await addDoc(collection(db, 'paths'), { title, description: '', courseIds: ids.split(',').map((s) => s.trim()).filter(Boolean), createdAt: serverTimestamp() });
      setTitle(''); setIds(''); push('Path created');
    }}>
      <input className="input" placeholder="Path title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <input className="input" placeholder="Course IDs, comma separated" value={ids} onChange={(e) => setIds(e.target.value)} />
      <button className="btn-primary">Create path</button>
    </form>
  );
}

function PreviewCounts({ raw }: { raw: string }) {
  try {
    const j = JSON.parse(raw);
    return (
      <p className="text-xs text-slate-500">
        Preview: 1 course · {(j.lessons ?? []).length} lessons · {(j.quizzes ?? []).length} quizzes ·{' '}
        {(j.quizzes ?? []).reduce((a: number, q: any) => a + ((q.questions ?? []).length), 0)} questions
      </p>
    );
  } catch {
    return <p className="text-xs text-red-600">Invalid JSON — fix before import.</p>;
  }
}

function ImportTab() {
  const { push } = useToast();
  const [raw, setRaw] = useState(SAMPLE_COURSE_JSON);
  return (
    <div className="card space-y-2 p-4 text-sm">
      <div className="flex gap-2">
        <button className="btn-ghost !py-1 text-xs" onClick={() => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([SAMPLE_COURSE_JSON])); a.download = 'course-sample.json'; a.click(); }}>Download sample course JSON</button>
        <button className="btn-ghost !py-1 text-xs" onClick={() => navigator.clipboard.writeText(COURSE_AI_PROMPT)}>Copy AI prompt</button>
      </div>
      <textarea className="input min-h-[240px] font-mono text-xs" value={raw} onChange={(e) => setRaw(e.target.value)} aria-label="Course JSON" />
      <PreviewCounts raw={raw} />
      <button className="btn-primary" onClick={async () => {
        if (!db) return;
        try {
          const j = JSON.parse(raw);
          const cref = await addDoc(collection(db, 'courses'), {
            title: j.title, description: j.description, topic: j.topic, instructor: j.instructor,
            thumbnail: j.thumbnail ?? '', level: j.level ?? 'Beginner', outcomes: j.outcomes ?? [],
            credits: j.credits ?? [], schedule: j.schedule ?? [], status: 'draft',
            lessonCount: (j.lessons ?? []).length, createdAt: serverTimestamp()
          });
          for (let i = 0; i < (j.lessons ?? []).length; i++) {
            const L = j.lessons[i];
            const vid = extractVideoId(L.youtube ?? '');
            if (!vid) throw new Error(`Lesson ${i + 1}: bad YouTube URL`);
            await addDoc(collection(db, 'courses', cref.id, 'lessons'), { title: L.title, videoId: vid, duration: L.duration ?? '', order: i });
          }
          for (const qz of j.quizzes ?? []) {
            const v = validateQuizJson(JSON.stringify(qz));
            if (!v.ok) throw new Error('Quiz invalid: ' + v.errors.join('; '));
            await addDoc(collection(db, 'courses', cref.id, 'quizzes'), (v as any).quiz);
          }
          push(`Imported course ${cref.id}`);
        } catch (e: any) { push('Import failed: ' + e.message); }
      }}>Validate + import (batched)</button>
    </div>
  );
}
