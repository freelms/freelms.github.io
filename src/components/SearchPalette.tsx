import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Course, Lesson } from '../types';

export function SearchPalette({ open, close, courses, lessonsByCourse }: {
  open: boolean; close: () => void;
  courses: Course[];
  lessonsByCourse: Record<string, Lesson[]>;
}) {
  const [q, setQ] = useState('');
  const nav = useNavigate();
  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return courses.slice(0, 8).map((c) => ({ label: c.title, sub: (c.tags?.[0]?.name ?? c.topic ?? ''), to: `/course/${c.id}` }));
    const out: { label: string; sub: string; to: string }[] = [];
    for (const c of courses) {
      const tagText = (c.tags ?? []).map((t) => t.name).join(' ');
      if ((c.title + ' ' + (c.topic ?? '') + ' ' + tagText).toLowerCase().includes(s)) {
        out.push({ label: c.title, sub: (c.tags?.[0]?.name ?? c.topic ?? ''), to: `/course/${c.id}` });
      }
      for (const l of lessonsByCourse[c.id] ?? []) {
        if (l.title.toLowerCase().includes(s)) out.push({ label: l.title, sub: c.title, to: `/learn/${c.id}` });
        if (out.length > 20) break;
      }
      if (out.length > 20) break;
    }
    return out;
  }, [q, courses, lessonsByCourse]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    if (open) window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, close]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/40 p-4" onClick={close} role="dialog" aria-label="Search">
      <div className="card mx-auto mt-16 max-w-lg p-2" onClick={(e) => e.stopPropagation()}>
        <input autoFocus className="input" placeholder="Search courses, topics, lessons…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
        <div className="mt-1 max-h-80 overflow-auto">
          {results.map((r, i) => (
            <button key={i} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
              onClick={() => { nav(r.to); close(); }}>
              <span className="font-medium">{r.label}</span>
              <span className="ml-2 text-xs text-slate-500">{r.sub}</span>
            </button>
          ))}
          {results.length === 0 && <p className="p-4 text-sm text-slate-500">No results.</p>}
        </div>
      </div>
    </div>
  );
}
